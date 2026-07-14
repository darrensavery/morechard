/**
 * Polls Zoho Desk for tickets modified since the last poll and feeds them
 * into the existing agent_incidents → INCIDENT_QUEUE pipeline. Runs on
 * the every-5-minutes cron (wired in index.ts's scheduled() handler, Task 6)
 * since Zoho's free tier has no outgoing webhooks.
 */
import { Env, IncidentQueueMessage } from '../../types.js';
import { nanoid } from '../nanoid.js';
import { searchZohoTicketsModifiedBetween } from './zoho.js';

const POLL_CURSOR_KV_KEY = 'agent:zoho:last_poll_at';
const OVERLAP_MINUTES = 2;
const FIRST_POLL_LOOKBACK_MINUTES = 10;

export function computePollWindow(
  lastCursorIso: string | null,
  nowIso: string,
): { sinceIso: string; toIso: string } {
  const now = new Date(nowIso);
  if (!lastCursorIso) {
    const since = new Date(now.getTime() - FIRST_POLL_LOOKBACK_MINUTES * 60_000);
    return { sinceIso: since.toISOString(), toIso: nowIso };
  }
  const cursor = new Date(lastCursorIso);
  const since = new Date(cursor.getTime() - OVERLAP_MINUTES * 60_000);
  return { sinceIso: since.toISOString(), toIso: nowIso };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function pollZohoDeskTickets(
  env: Env,
): Promise<{ polled: number; created: number; deduplicated: number }> {
  const nowIso = new Date().toISOString();
  const lastCursor = await env.CACHE.get(POLL_CURSOR_KV_KEY);
  const { sinceIso, toIso } = computePollWindow(lastCursor, nowIso);

  const tickets = await searchZohoTicketsModifiedBetween(env, sinceIso, toIso);

  let created = 0;
  let deduplicated = 0;

  for (const ticket of tickets) {
    const existing = await env.DB
      .prepare(`
        SELECT id FROM agent_incidents
        WHERE source = 'zoho_desk' AND source_ref = ? AND status IN ('received','diagnosing','escalated')
      `)
      .bind(ticket.id)
      .first<{ id: string }>();

    if (existing) {
      await env.DB
        .prepare('UPDATE agent_incidents SET occurrence_count = occurrence_count + 1 WHERE id = ?')
        .bind(existing.id)
        .run();
      deduplicated++;
      continue;
    }

    const incidentText = [
      ticket.contactEmail ? `Requester: ${ticket.contactEmail}` : '',
      `Subject: ${ticket.subject}`,
      stripHtml(ticket.description ?? ''),
    ].filter(Boolean).join('\n');

    const incidentId = nanoid();
    try {
      await env.DB
        .prepare(`
          INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
          VALUES (?, 'zoho_desk', ?, 1, ?)
        `)
        .bind(incidentId, ticket.id, incidentText)
        .run();
    } catch (err) {
      // Same-ticket race between two overlapping poll windows — the
      // partial unique index rejects the loser; treat it as a dedupe.
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint failed/i.test(msg)) {
        deduplicated++;
        continue;
      }
      throw err;
    }

    await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);
    created++;
  }

  await env.CACHE.put(POLL_CURSOR_KV_KEY, nowIso);

  return { polled: tickets.length, created, deduplicated };
}
