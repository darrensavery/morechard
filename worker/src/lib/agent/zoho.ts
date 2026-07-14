/**
 * Zoho Desk API client — OAuth token refresh, ticket search (used for
 * polling, since Zoho's free tier has no outgoing webhooks — see
 * docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md),
 * and ticket creation for the in-app "Contact Support" flow. Raw fetch,
 * no SDK — matches the existing pattern in claudeClient.ts.
 */
import { Env } from '../../types.js';

export interface ZohoTicketSummary {
  id: string;
  subject: string;
  description: string;
  contactEmail: string | null;
}

const ZOHO_ACCESS_TOKEN_KV_KEY = 'agent:zoho:access_token';

/**
 * Exchanges the long-lived refresh token for a short-lived access token,
 * caching it in KV for slightly under its 1-hour lifetime so repeated
 * polls within that window don't re-authenticate every time.
 */
export async function getZohoAccessToken(env: Env): Promise<string> {
  const cached = await env.CACHE.get(ZOHO_ACCESS_TOKEN_KV_KEY);
  if (cached) return cached;

  const url = new URL(`${env.ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`);
  url.searchParams.set('client_id', env.ZOHO_CLIENT_ID);
  url.searchParams.set('client_secret', env.ZOHO_CLIENT_SECRET);
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('refresh_token', env.ZOHO_REFRESH_TOKEN);

  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Zoho token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };

  // Cache for slightly less than the token's real lifetime (default 3600s)
  // so a poll never uses a token that expires mid-request.
  await env.CACHE.put(ZOHO_ACCESS_TOKEN_KV_KEY, data.access_token, {
    expirationTtl: Math.max(60, data.expires_in - 120),
  });
  return data.access_token;
}

export function buildZohoSearchUrl(
  env: Env,
  sinceIso: string,
  toIso: string,
  from: number,
  limit: number,
): string {
  const url = new URL(`${env.ZOHO_API_DOMAIN}/api/v1/tickets/search`);
  url.searchParams.set('modifiedTimeRange', `${sinceIso},${toIso}`);
  url.searchParams.set('sortBy', 'modifiedTime');
  url.searchParams.set('from', String(from));
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

export function parseZohoSearchResponse(body: unknown): ZohoTicketSummary[] {
  const data = (body as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const t = raw as { id: string; subject: string; description: string; contact?: { email?: string } };
    return {
      id: t.id,
      subject: t.subject,
      description: t.description,
      contactEmail: t.contact?.email ?? null,
    };
  });
}

/**
 * Fetches every page of tickets modified in the given window. Zoho's
 * search endpoint caps `limit` in practice around 100/page — this loops
 * until a short page signals the end.
 */
export async function searchZohoTicketsModifiedBetween(
  env: Env,
  sinceIso: string,
  toIso: string,
): Promise<ZohoTicketSummary[]> {
  const accessToken = await getZohoAccessToken(env);
  const pageSize = 100;
  const results: ZohoTicketSummary[] = [];
  let from = 0;

  for (;;) {
    const res = await fetch(buildZohoSearchUrl(env, sinceIso, toIso, from, pageSize), {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: env.ZOHO_ORG_ID,
      },
    });
    if (!res.ok) {
      throw new Error(`Zoho ticket search failed (${res.status}): ${await res.text()}`);
    }
    // Zoho returns 204 No Content (empty body) when a search matches zero
    // tickets, rather than 200 with {"data": []} — calling res.json() on
    // that empty body throws. Read as text first and treat an empty body
    // as an empty page.
    const rawBody = await res.text();
    const page = rawBody ? parseZohoSearchResponse(JSON.parse(rawBody)) : [];
    results.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return results;
}

export function buildZohoCreateTicketBody(
  env: Env,
  params: { subject: string; description: string; email: string; lastName: string },
): object {
  return {
    subject: params.subject,
    description: params.description,
    departmentId: env.ZOHO_DEPARTMENT_ID,
    status: 'Open',
    contact: { email: params.email, lastName: params.lastName },
  };
}

/**
 * Best-effort ticket creation for the in-app "Contact Support" flow.
 * Returns null on failure rather than throwing — the caller (Task 7)
 * treats the local agent_incidents write as the source of truth and
 * this as a nice-to-have for human visibility.
 */
export async function createZohoTicket(
  env: Env,
  params: { subject: string; description: string; email: string; lastName: string },
): Promise<{ id: string } | null> {
  try {
    const accessToken = await getZohoAccessToken(env);
    const res = await fetch(`${env.ZOHO_API_DOMAIN}/api/v1/tickets`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: env.ZOHO_ORG_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildZohoCreateTicketBody(env, params)),
    });
    if (!res.ok) return null;
    const data = await res.json() as { id: string };
    return { id: data.id };
  } catch {
    return null;
  }
}
