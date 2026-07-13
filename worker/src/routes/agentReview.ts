/**
 * Review Queue API — GET (list) and POST decline. NO approve/execute
 * endpoint in Phase 0: nothing is executable yet (no AUTO/GATED tool has a
 * live handler). That arrives with Phase 1's tool implementations.
 */
import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { requireAdmin } from '../lib/adminAuth.js';

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
  created_at: number;
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

  const { results } = await env.DB
    .prepare(`
      SELECT id, incident_id, diagnosis, recommended_tier, recommended_tool, recommended_payload,
             draft_reply, confidence, category, queue_bucket, status, created_at
      FROM agent_review_items WHERE status = ? ORDER BY created_at DESC
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
