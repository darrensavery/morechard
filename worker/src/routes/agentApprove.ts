/**
 * GET /api/support-agent/review/:id/approve?token=... — the one-tap
 * approval link from reviewNotify.ts. Public (the token IS the auth,
 * same model as auth.ts's magic-link verify): no X-Admin-Key, because this
 * is clicked straight out of an email client, not called from /admin.
 *
 * Executes exactly one AUTO-tier tool (resend_magic_link, the only one
 * that exists) using the payload processIncident.ts already
 * deterministically constructed and stored on the review item — never a
 * payload built from this request. A human still had to click; nothing
 * here widens what can auto-execute.
 */
import { Env } from '../types.js';
import { checkApprovalToken, consumeApprovalToken } from '../lib/agent/approvalTokens.js';
import { invokeAutoTool } from '../lib/agent/registry.js';
import { writeAgentActionLogEntry } from '../lib/agent/actionLog.js';

interface ReviewItemRow {
  id: string;
  incident_id: string;
  recommended_tool: string | null;
  recommended_payload: string | null;
  queue_bucket: 'recommended_approve' | 'needs_review';
  status: string;
}

function htmlResponse(title: string, message: string, status: number): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#1a1a1a}
  h1{font-size:20px}</style></head>
  <body><h1>${title}</h1><p>${message}</p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function handleApproveReviewItem(
  request: Request,
  env: Env,
  reviewItemId: string,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return htmlResponse('Invalid link', 'This approval link is missing its token.', 400);

  const item = await env.DB
    .prepare(`
      SELECT id, incident_id, recommended_tool, recommended_payload, queue_bucket, status
      FROM agent_review_items WHERE id = ?
    `)
    .bind(reviewItemId)
    .first<ReviewItemRow>();
  if (!item) return htmlResponse('Not found', 'This review item no longer exists.', 404);

  if (item.status !== 'pending') {
    return htmlResponse('Already handled', `This item was already ${item.status}.`, 409);
  }

  const check = await checkApprovalToken(env, reviewItemId, token);
  if (!check.valid) {
    const reason = check.reason === 'expired'
      ? 'This approval link has expired.'
      : check.reason === 'already_used'
      ? 'This approval link has already been used.'
      : 'This approval link is not valid.';
    return htmlResponse('Link invalid', reason, 410);
  }

  if (item.recommended_tool !== 'resend_magic_link' || item.queue_bucket !== 'recommended_approve' || !item.recommended_payload) {
    return htmlResponse('Not one-tap eligible', 'This item requires review in /admin instead.', 409);
  }

  const payload = JSON.parse(item.recommended_payload) as { email: string };
  const result = await invokeAutoTool('resend_magic_link', env, payload);

  await writeAgentActionLogEntry(env.DB, {
    incidentId: item.incident_id,
    actor: 'human:one-tap-approval',
    toolName: 'resend_magic_link',
    tier: 'auto',
    payload,
    result,
  });

  await env.DB
    .prepare(`
      UPDATE agent_review_items
      SET status = 'executed', decided_by = 'human:one-tap-approval', decided_at = unixepoch()
      WHERE id = ? AND status = 'pending'
    `)
    .bind(reviewItemId)
    .run();

  await consumeApprovalToken(env, token);

  return htmlResponse('Done', 'The sign-in link was resent to the parent. You can close this tab.', 200);
}
