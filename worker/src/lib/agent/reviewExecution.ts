/**
 * Shared execution tail for approving an AUTO-tier review item — used by
 * both the emailed one-tap link (routes/agentApprove.ts, token-gated) and
 * the /admin Approve button (routes/agentReview.ts, X-Admin-Key-gated).
 * Callers own their own eligibility/auth checks before calling this — it
 * assumes approval has already been granted and just does the deed:
 * execute, log, mark decided.
 */
import { Env } from '../../types.js';
import { invokeAutoTool } from './registry.js';
import { registerAutoTools } from './tools/autoTools.js';
import { writeAgentActionLogEntry } from './actionLog.js';

export interface ReviewItemForExecution {
  id: string;
  incident_id: string;
  recommended_tool: string;
  recommended_payload: string; // JSON string — caller has already verified non-null
}

export async function executeReviewItemAutoTool(
  env: Env,
  item: ReviewItemForExecution,
  actor: string,
): Promise<unknown> {
  registerAutoTools();
  const payload = JSON.parse(item.recommended_payload) as Record<string, unknown>;
  const result = await invokeAutoTool(item.recommended_tool, env, payload);

  await writeAgentActionLogEntry(env.DB, {
    incidentId: item.incident_id,
    actor,
    toolName: item.recommended_tool,
    tier: 'auto',
    payload,
    result,
  });

  await env.DB
    .prepare(`
      UPDATE agent_review_items
      SET status = 'executed', decided_by = ?, decided_at = unixepoch()
      WHERE id = ? AND status = 'pending'
    `)
    .bind(actor, item.id)
    .run();

  return result;
}
