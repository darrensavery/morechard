/**
 * Referral routes
 *
 * GET  /api/referrals/me          — Return caller's referral code + shareable URL
 * GET  /api/referrals/stats       — Click + conversion counts for caller's code
 * POST /api/referrals/click       — PUBLIC: record a link click (called from landing page / reg flow)
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { AuthedRequest } from './auth.js';

const APP_URL_FALLBACK = 'https://app.morechard.com';

// Derives an 8-char alphanumeric code from the family ID (lazy-initialised on first call)
function deriveCode(familyId: string): string {
  return familyId.replace(/-/g, '').slice(-8).toUpperCase();
}

// ── GET /api/referrals/me ────────────────────────────────────────────────────
export async function handleReferralMe(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller || caller.role !== 'parent') return error('Unauthorised', 401);

  const family = await env.DB
    .prepare('SELECT referral_code FROM families WHERE id = ?')
    .bind(caller.family_id)
    .first<{ referral_code: string | null }>();

  if (!family) return error('Family not found', 404);

  let code = family.referral_code;

  // Lazy-initialise the code if not yet set
  if (!code) {
    code = deriveCode(caller.family_id);

    // Handle the rare case where derived code collides with another family
    const collision = await env.DB
      .prepare('SELECT id FROM families WHERE referral_code = ? AND id != ?')
      .bind(code, caller.family_id)
      .first();

    if (collision) {
      const arr = new Uint8Array(4);
      crypto.getRandomValues(arr);
      code = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    await env.DB
      .prepare('UPDATE families SET referral_code = ? WHERE id = ?')
      .bind(code, caller.family_id)
      .run();
  }

  const appUrl = (env.APP_URL ?? APP_URL_FALLBACK).replace(/\/$/, '');
  const shareUrl = `${appUrl}/?ref=${code}`;

  return json({ code, share_url: shareUrl });
}

// ── GET /api/referrals/stats ─────────────────────────────────────────────────
export async function handleReferralStats(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller || caller.role !== 'parent') return error('Unauthorised', 401);

  const family = await env.DB
    .prepare('SELECT referral_code FROM families WHERE id = ?')
    .bind(caller.family_id)
    .first<{ referral_code: string | null }>();

  const code = family?.referral_code;
  if (!code) return json({ clicks: 0, sign_ups: 0, conversions: 0, rewards_pending: 0 });

  const [clickRow, convRow, signUps] = await Promise.all([
    env.DB
      .prepare('SELECT COUNT(*) AS n FROM referral_clicks WHERE referral_code = ?')
      .bind(code)
      .first<{ n: number }>(),
    env.DB
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN reward_granted = 0 THEN 1 ELSE 0 END) AS pending
        FROM referral_conversions
        WHERE referral_code = ?
      `)
      .bind(code)
      .first<{ total: number; pending: number }>(),
    env.DB
      .prepare('SELECT COUNT(*) AS n FROM families WHERE referred_by_code = ?')
      .bind(code)
      .first<{ n: number }>(),
  ]);

  return json({
    clicks:          clickRow?.n ?? 0,
    sign_ups:        signUps?.n ?? 0,
    conversions:     convRow?.total ?? 0,
    rewards_pending: convRow?.pending ?? 0,
  });
}

// ── POST /api/referrals/click ────────────────────────────────────────────────
// Public — no auth required. Called when a visitor lands on /?ref=CODE.
export async function handleReferralClick(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const code = (body?.['code'] as string | undefined)?.trim().toUpperCase();
  if (!code || code.length < 6) return error('code required', 400);

  // Verify the code exists to prevent spam logging arbitrary codes
  const exists = await env.DB
    .prepare('SELECT id FROM families WHERE referral_code = ?')
    .bind(code)
    .first();
  if (!exists) return error('Unknown referral code', 404);

  const now = Math.floor(Date.now() / 1000);
  const ip  = request.headers.get('CF-Connecting-IP') ?? '';

  // Hash the IP for deduplication without storing PII
  const ipHash = ip
    ? Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)))
      ).map(b => b.toString(16).padStart(2, '0')).join('')
    : null;

  await env.DB
    .prepare('INSERT INTO referral_clicks (referral_code, clicked_at, user_agent, ip_hash) VALUES (?, ?, ?, ?)')
    .bind(code, now, request.headers.get('User-Agent') ?? null, ipHash)
    .run();

  return json({ ok: true });
}
