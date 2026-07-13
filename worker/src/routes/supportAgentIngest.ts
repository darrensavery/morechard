/**
 * The four support-agent ingest routes. Each does the minimum: verify
 * auth/signature, write an agent_incidents row, enqueue {incidentId},
 * return 200 immediately. All real work happens in the queue consumer
 * (processIncident, Task 14).
 */
import { Env, IncidentQueueMessage } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { verifySentrySignature, verifySharedSecret } from '../lib/agent/signatures.js';

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
  try {
    await env.DB
      .prepare(`
        INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
        VALUES (?, 'sentry', ?, 0, ?)
      `)
      .bind(incidentId, issueId, rawBody)
      .run();
  } catch (err) {
    // A concurrent delivery for the same issue can win the SELECT-then-INSERT
    // race between this request's own dedup check and its INSERT — the
    // partial unique index (migration 0078) then rejects the loser. Treat
    // that as the duplicate path rather than letting it bubble up as a 500,
    // mirroring the retry-on-UNIQUE-constraint pattern in actionLog.ts.
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) {
      await env.DB
        .prepare(`
          UPDATE agent_incidents SET occurrence_count = occurrence_count + 1
          WHERE source = 'sentry' AND source_ref = ? AND status IN ('received','diagnosing','escalated')
        `)
        .bind(issueId)
        .run();
      return json({ received: true, deduplicated: true });
    }
    throw err;
  }

  await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

  return json({ received: true, incident_id: incidentId });
}

// ── POST /api/support-agent/freshdesk-webhook ───────────────────────────
// Configured as a Freshdesk Automation Rule action ("Trigger webhook") on
// ticket-create and ticket-update. user_facing is HARD-CODED to 1.
export async function handleFreshdeskWebhook(request: Request, env: Env): Promise<Response> {
  const providedSecret = request.headers.get('X-Freshdesk-Webhook-Secret');
  if (!verifySharedSecret(providedSecret, env.FRESHDESK_WEBHOOK_SECRET)) {
    return error('Invalid webhook secret', 401);
  }

  const rawBody = await request.text();
  let payload: { ticket_id?: string | number; requester_email?: string; subject?: string; description?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error('Invalid JSON body', 400);
  }

  const ticketId = payload.ticket_id != null ? String(payload.ticket_id) : null;
  if (!ticketId) return error('Missing ticket_id', 400);

  const incidentText = [
    payload.requester_email ? `Requester: ${payload.requester_email}` : '',
    payload.subject ? `Subject: ${payload.subject}` : '',
    payload.description ?? '',
  ].filter(Boolean).join('\n');

  const incidentId = nanoid();
  await env.DB
    .prepare(`
      INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
      VALUES (?, 'freshdesk', ?, 1, ?)
    `)
    .bind(incidentId, ticketId, incidentText)
    .run();

  await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

  return json({ received: true, incident_id: incidentId });
}
