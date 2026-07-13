/**
 * The four support-agent ingest routes. Each does the minimum: verify
 * auth/signature, write an agent_incidents row, enqueue {incidentId},
 * return 200 immediately. All real work happens in the queue consumer
 * (processIncident, Task 14).
 */
import { Env, IncidentQueueMessage } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { verifySharedSecret, verifySentrySignature } from '../lib/agent/signatures.js';

export function dedupeIncomingSentryEvent(input: { existingOpenIncidentId: string | null }): 'new' | 'duplicate' {
  return input.existingOpenIncidentId ? 'duplicate' : 'new';
}

// ── POST /api/support-agent/sentry-webhook ──────────────────────────────
// user_facing is HARD-CODED to 0 here — nothing downstream can flip it.
export async function handleSentryWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('Sentry-Hook-Signature');
  const rawBody = await request.text();

  if (!signature || !(await verifySentrySignature(rawBody, signature, env.SENTRY_WEBHOOK_SECRET))) {
    return error('Invalid signature', 401);
  }

  let payload: { action?: string; data?: { issue?: { id?: string } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error('Invalid JSON body', 400);
  }

  const issueId = payload.data?.issue?.id;
  if (!issueId) return error('Missing issue id', 400);

  const existing = await env.DB
    .prepare(`
      SELECT id FROM agent_incidents
      WHERE source = 'sentry' AND source_ref = ? AND status IN ('received','diagnosing','escalated')
    `)
    .bind(issueId)
    .first<{ id: string }>();

  if (dedupeIncomingSentryEvent({ existingOpenIncidentId: existing?.id ?? null }) === 'duplicate') {
    await env.DB
      .prepare('UPDATE agent_incidents SET occurrence_count = occurrence_count + 1 WHERE id = ?')
      .bind(existing!.id)
      .run();
    return json({ received: true, deduplicated: true });
  }

  const incidentId = nanoid();
  await env.DB
    .prepare(`
      INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
      VALUES (?, 'sentry', ?, 0, ?)
    `)
    .bind(incidentId, issueId, rawBody)
    .run();

  await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

  return json({ received: true, incident_id: incidentId });
}
