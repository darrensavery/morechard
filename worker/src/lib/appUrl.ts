/**
 * Resolves the front-end origin a login/magic-link flow should send the
 * browser back to. Defaults to production; only ever trusts a Cloudflare
 * Pages preview subdomain (a domain only Cloudflare can issue certs/deploys
 * for — not attacker-spoofable) or the configured production APP_URL.
 * Never trusts an arbitrary value, to avoid becoming an open redirect.
 */

import { Env } from '../types.js';

const PREVIEW_HOST_RE = /^[a-z0-9-]+\.moneysteps\.pages\.dev$/;

export function resolveReturnOrigin(request: Request, env: Env): string {
  const prodUrl = env.APP_URL ?? 'https://app.morechard.com';
  const header = request.headers.get('Origin') ?? request.headers.get('Referer');
  if (!header) return prodUrl;

  try {
    const candidate = new URL(header);
    const prodHost = new URL(prodUrl).host;
    if (candidate.protocol === 'https:' && (candidate.host === prodHost || PREVIEW_HOST_RE.test(candidate.host))) {
      return `${candidate.protocol}//${candidate.host}`;
    }
  } catch {
    // Malformed header — fall through to production.
  }
  return prodUrl;
}
