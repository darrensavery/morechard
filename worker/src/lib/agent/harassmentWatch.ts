/**
 * Passive cross-ticket signal for resend_magic_link — a Freshdesk ticket
 * is not an authenticated channel, so a bad actor could open ticket after
 * ticket claiming a victim's email to spam their inbox with magic links,
 * staying under the per-request rate cap. This surfaces a count; it never
 * blocks anything automatically (locking a real parent out of their own
 * recovery path is worse than the noise) — see design spec §2 AUTO tier.
 */
import { Env } from '../../types.js';

export const HARASSMENT_WATCH_WINDOW_DAYS = 7;
export const HARASSMENT_WATCH_THRESHOLD = 3;

export function classifyHarassmentSignal(distinctTicketCount: number): boolean {
  return distinctTicketCount >= HARASSMENT_WATCH_THRESHOLD;
}

export async function countDistinctMagicLinkTriggerTickets(
  env: Env,
  email: string,
  windowDays: number = HARASSMENT_WATCH_WINDOW_DAYS,
): Promise<number> {
  const row = await env.DB
    .prepare(`
      SELECT COUNT(DISTINCT ai.source_ref) AS cnt
      FROM agent_action_log aal
      JOIN agent_incidents ai ON ai.id = aal.incident_id
      WHERE aal.tool_name = 'resend_magic_link'
        AND ai.source = 'freshdesk'
        AND json_extract(aal.payload, '$.email') = ?
        AND aal.created_at > unixepoch() - (? * 86400)
    `)
    .bind(email, windowDays)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}
