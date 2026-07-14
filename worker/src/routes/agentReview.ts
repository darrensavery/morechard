/**
 * Review Queue API — GET (list), POST decline, POST approve. Approve is
 * also reachable via the emailed one-tap link (routes/agentApprove.ts,
 * token-authenticated — for clicking straight out of an email). This
 * endpoint is the X-Admin-Key-authenticated equivalent for approving from
 * within /admin itself, and deliberately allows approving items in EITHER
 * queue bucket (not just recommended_approve) — an admin reading the full
 * diagnosis in context is the safety valve the needs_review bucket exists
 * for; the emailed link stays narrower because clicking it requires no
 * context-reading. Both paths share the same execution tail
 * (lib/agent/reviewExecution.ts).
 */
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { requireAdmin } from '../lib/adminAuth.js';
import { executeReviewItemAutoTool } from '../lib/agent/reviewExecution.js';
import { postZohoTicketReply } from '../lib/agent/zoho.js';
import { draftReplyToHtml } from '../lib/agent/replyFormat.js';
import { writeAgentActionLogEntry } from '../lib/agent/actionLog.js';

interface ReviewItemRow {
  id: string;
  incident_id: string;
  diagnosis: string;
  recommended_tier: string | null;
  recommended_tool: string | null;
  recommended_payload: string | null;
  draft_reply: string | null;
  confidence: number;
  category: string | null;
  queue_bucket: 'recommended_approve' | 'needs_review';
  status: string;
  decided_by: string | null;
  decided_at: number | null;
  decision_note: string | null;
  created_at: number;
  source: string;
  reply_sent_at: number | null;
}

export function sortReviewItems<T extends { queue_bucket: string }>(items: T[]): T[] {
  const rank = (b: string) => (b === 'recommended_approve' ? 0 : 1);
  return [...items].sort((a, b) => rank(a.queue_bucket) - rank(b.queue_bucket));
}

// ── GET /api/admin/agent-review?status=pending ──────────────────────────
export async function handleListAgentReviewItems(request: Request, env: Env): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  if (!['pending', 'approved', 'edited_approved', 'declined', 'executed'].includes(status)) {
    return error('Invalid status', 400);
  }

  const { results } = await env.DB
    .prepare(`
      SELECT ari.id, ari.incident_id, ari.diagnosis, ari.recommended_tier, ari.recommended_tool, ari.recommended_payload,
             ari.draft_reply, ari.confidence, ari.category, ari.queue_bucket, ari.status,
             ari.decided_by, ari.decided_at, ari.decision_note, ari.created_at, ai.source, ari.reply_sent_at
      FROM agent_review_items ari
      JOIN agent_incidents ai ON ai.id = ari.incident_id
      WHERE ari.status = ? ORDER BY ari.created_at DESC
    `)
    .bind(status)
    .all<ReviewItemRow>();

  return json({ items: sortReviewItems(results) });
}

// ── POST /api/admin/agent-review/:id/decline ─────────────────────────────
export async function handleDeclineAgentReviewItem(request: Request, env: Env, id: string): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body', 400);
  }

  const note = body.note?.trim();
  if (!note) return error('note required', 400);

  const result = await env.DB
    .prepare(`
      UPDATE agent_review_items
      SET status = 'declined', decided_by = 'admin', decided_at = unixepoch(), decision_note = ?
      WHERE id = ? AND status = 'pending'
    `)
    .bind(note, id)
    .run();

  if (result.meta.changes === 0) return error('Review item not found or already decided', 404);
  return json({ ok: true });
}

// ── POST /api/admin/agent-review/:id/approve ──────────────────────────────
export async function handleApproveAgentReviewItem(request: Request, env: Env, id: string): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const item = await env.DB
    .prepare(`
      SELECT id, incident_id, recommended_tier, recommended_tool, recommended_payload, status
      FROM agent_review_items WHERE id = ?
    `)
    .bind(id)
    .first<{ id: string; incident_id: string; recommended_tier: string | null; recommended_tool: string | null; recommended_payload: string | null; status: string }>();

  if (!item) return error('Review item not found', 404);
  if (item.status !== 'pending') return error(`Review item already ${item.status}`, 409);
  if (item.recommended_tier !== 'auto' || !item.recommended_tool || !item.recommended_payload) {
    return error('This item has no executable AUTO-tier tool', 409);
  }

  const result = await executeReviewItemAutoTool(
    env,
    { id: item.id, incident_id: item.incident_id, recommended_tool: item.recommended_tool, recommended_payload: item.recommended_payload },
    'human:admin-approval',
  );

  return json({ ok: true, result });
}

// ── POST /api/admin/agent-review/:id/send-reply ────────────────────────────
// Posts the LLM-drafted reply as a real customer-facing email on the
// originating Zoho Desk ticket. Deliberately independent of Approve/Decline
// (a reply can be sent with or without the recommended AUTO tool having
// run) — always human-triggered via this button, never autonomous.
export async function handleSendReplyAgentReviewItem(request: Request, env: Env, id: string): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const item = await env.DB
    .prepare(`
      SELECT ari.id, ari.incident_id, ari.draft_reply, ari.status, ari.reply_sent_at, ai.source, ai.source_ref
      FROM agent_review_items ari
      JOIN agent_incidents ai ON ai.id = ari.incident_id
      WHERE ari.id = ?
    `)
    .bind(id)
    .first<{ id: string; incident_id: string; draft_reply: string | null; status: string; reply_sent_at: number | null; source: string; source_ref: string }>();

  if (!item) return error('Review item not found', 404);
  if (item.status === 'declined') return error('Cannot send a reply for a declined item', 409);
  if (item.reply_sent_at) return error('Reply already sent', 409);
  if (!item.draft_reply) return error('This item has no draft reply', 409);
  if (item.source !== 'zoho_desk') return error(`Sending replies is only supported for Zoho Desk tickets (this incident's source is "${item.source}")`, 409);

  const html = draftReplyToHtml(item.draft_reply);
  const result = await postZohoTicketReply(env, item.source_ref, html);

  if (!result.ok) return error(result.error, 502);

  await writeAgentActionLogEntry(env.DB, {
    incidentId: item.incident_id,
    actor: 'human:admin-approval',
    toolName: 'zoho_send_reply',
    tier: 'auto',
    payload: { ticketId: item.source_ref },
    result: { ok: true },
  });

  await env.DB
    .prepare(`UPDATE agent_review_items SET reply_sent_at = unixepoch() WHERE id = ?`)
    .bind(id)
    .run();

  return json({ ok: true });
}
