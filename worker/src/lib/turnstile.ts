/**
 * Cloudflare Turnstile bot-challenge verification.
 *
 * Deliberately a soft no-op when `env.TURNSTILE_SECRET_KEY` isn't set — this
 * lets the plumbing ship now without breaking login/invite-redemption in
 * production. It activates the moment a Turnstile widget is created in the
 * Cloudflare dashboard (Turnstile → Add site) and both `TURNSTILE_SECRET_KEY`
 * (wrangler secret) and `VITE_TURNSTILE_SITE_KEY` (app build env) are set —
 * see docs/security/audits/2026-07-15-production-security-audit.md.
 */
import { Env } from '../types.js';
import { error, clientIp } from './response.js';

export async function verifyTurnstile(request: Request, env: Env, token: string | undefined): Promise<Response | null> {
  if (!env.TURNSTILE_SECRET_KEY) return null; // not configured yet — no-op

  if (!token) return error('Verification required — please try again', 400);

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: clientIp(request),
    }),
  }).catch(() => null);

  if (!resp) return null; // Cloudflare's verify endpoint unreachable — fail open, don't block real users on our dependency being down
  const data = await resp.json().catch(() => null) as { success?: boolean } | null;

  if (!data?.success) return error('Verification failed — please try again', 403);
  return null;
}
