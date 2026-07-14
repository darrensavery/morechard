/**
 * The four support-agent ingest routes. Each does the minimum: verify
 * auth/signature, write an agent_incidents row, enqueue {incidentId},
 * return 200 immediately. All real work happens in the queue consumer
 * (processIncident, Task 14).
 */
import { Env, IncidentQueueMessage } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { verifySentrySignature, verifyStripeSupportAgentSignature } from '../lib/agent/signatures.js';
import type { JwtPayload } from '../lib/jwt.js';

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

type AuthedRequest = Request & { auth: JwtPayload };

// ── POST /api/support-agent/request ──────────────────────────────────
// Parent-only, authenticated. family_id comes from the verified JWT, not
// from any text the parent typed — already a deterministic identity.
export async function handleSupportAgentRequest(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can submit a support request', 403);

  let body: { description?: string; screen?: string };
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body', 400);
  }

  const description = body.description?.trim();
  if (!description) return error('description required', 400);

  const incidentText = [
    `Screen: ${body.screen ?? '(unknown)'}`,
    `family_id: ${auth.family_id}`,
    `Description: ${description}`,
  ].join('\n');

  const incidentId = nanoid();
  await env.DB
    .prepare(`
      INSERT INTO agent_incidents (id, source, source_ref, user_facing, family_id, raw_payload)
      VALUES (?, 'in_app', ?, 1, ?, ?)
    `)
    .bind(incidentId, incidentId, auth.family_id, incidentText)
    .run();

  await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

  return json({ received: true, incident_id: incidentId });
}

const STRIPE_SUPPORT_AGENT_EVENT_TYPES = new Set([
  'charge.failed',
  'charge.dispute.created',
  'radar.early_fraud_warning.created',
]);

// ── POST /api/support-agent/stripe-webhook ───────────────────────────────
// Separate endpoint + secret from the payment-critical handleStripeWebhook
// in stripe.ts — isolates the agent's ingest surface from the live payment
// path. user_facing defaults to 0; only becomes true if this later
// correlates to an actual Freshdesk ticket (handled in processIncident's
// related_incident_id linkage, not here).
export async function handleSupportAgentStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return error('Missing stripe-signature header', 400);

  const rawBody = await request.text();
  const verified = await verifyStripeSupportAgentSignature(rawBody, signature, env.STRIPE_SUPPORT_AGENT_WEBHOOK_SECRET);
  if (!verified) return error('Invalid webhook signature', 401);

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return error('Invalid JSON body', 400);
  }

  if (!event.type || !STRIPE_SUPPORT_AGENT_EVENT_TYPES.has(event.type)) {
    return json({ received: true, ignored: true });
  }
  if (!event.id) return error('Missing event id', 400);

  const incidentId = nanoid();
  await env.DB
    .prepare(`
      INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
      VALUES (?, 'stripe', ?, 0, ?)
    `)
    .bind(incidentId, event.id, rawBody)
    .run();

  await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

  return json({ received: true, incident_id: incidentId });
}
