/**
 * Admin routes — protected by X-Admin-Key header (ADMIN_SECRET env var).
 * These are internal operator tools, not end-user APIs.
 *
 * POST /api/admin/promo-codes           — create a school promo code in Stripe + D1
 * GET  /api/admin/promo-codes           — list all codes with redemption counts
 * GET  /api/admin/promo-codes/:id       — detail view: all families who redeemed a code
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';

// ----------------------------------------------------------------
// Auth guard
// ----------------------------------------------------------------

function requireAdmin(request: Request, env: Env): Response | null {
  const key = request.headers.get('X-Admin-Key');
  if (!key || !env.ADMIN_SECRET) return error('Unauthorised', 401);
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(env.ADMIN_SECRET);
  if (a.length !== b.length) return error('Unauthorised', 401);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? null : error('Unauthorised', 401);
}

// ----------------------------------------------------------------
// POST /api/admin/promo-codes
// Body: { coupon_id, label, code, max_redemptions }
//
// Creates ONE shared code in Stripe (max_redemptions enforced by Stripe)
// and records it in D1. The school puts this single code in their
// newsletter/email and each family enters it at checkout.
// ----------------------------------------------------------------

export async function handleCreatePromoCode(
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  let body: { coupon_id?: unknown; label?: unknown; code?: unknown; max_redemptions?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return error('Invalid JSON body', 400);
  }

  const couponId       = typeof body.coupon_id       === 'string' ? body.coupon_id.trim() : '';
  const label          = typeof body.label           === 'string' ? body.label.trim()     : '';
  const code           = typeof body.code            === 'string' ? body.code.trim().toUpperCase().replace(/\s+/g, '') : '';
  const maxRedemptions = typeof body.max_redemptions === 'number' ? Math.floor(body.max_redemptions) : 0;

  if (!couponId)            return error('coupon_id is required', 400);
  if (!label)               return error('label is required', 400);
  if (!code)                return error('code is required (e.g. SPRINGFIELD2024)', 400);
  if (maxRedemptions < 1 || maxRedemptions > 10000)
                            return error('max_redemptions must be between 1 and 10000', 400);

  // Create in Stripe
  const res = await fetch('https://api.stripe.com/v1/promotion_codes', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      coupon:          couponId,
      code:            code,
      max_redemptions: String(maxRedemptions),
    }).toString(),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error('Stripe promo code creation error:', msg);
    // Surface the Stripe error message so the operator knows what went wrong
    // (e.g. code already exists, invalid coupon ID)
    let stripeMsg = 'Stripe error — check coupon_id and that the code does not already exist';
    try {
      const parsed = JSON.parse(msg) as { error?: { message?: string } };
      if (parsed.error?.message) stripeMsg = parsed.error.message;
    } catch { /* ignore */ }
    return error(stripeMsg, 502);
  }

  const promo = await res.json() as { id: string; code: string };

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`
      INSERT INTO promo_codes (id, stripe_promo_code_id, code, label, coupon_id, max_redemptions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(crypto.randomUUID(), promo.id, promo.code, label, couponId, maxRedemptions, now)
    .run();

  return json({
    stripe_promo_code_id: promo.id,
    code:                 promo.code,
    label,
    coupon_id:            couponId,
    max_redemptions:      maxRedemptions,
  }, 201);
}

// ----------------------------------------------------------------
// GET /api/admin/promo-codes
// ----------------------------------------------------------------

export async function handleListPromoCodes(
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const rows = await env.DB
    .prepare(`
      SELECT
        p.id, p.code, p.label, p.coupon_id, p.max_redemptions, p.created_at,
        COUNT(r.id) AS redemptions
      FROM promo_codes p
      LEFT JOIN promo_code_redemptions r ON r.promo_code_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `)
    .all<{
      id: string; code: string; label: string; coupon_id: string;
      max_redemptions: number; created_at: number; redemptions: number;
    }>();

  return json({ codes: rows.results });
}

// ----------------------------------------------------------------
// GET /api/admin/promo-codes/:id
// ----------------------------------------------------------------

export async function handleGetPromoCode(
  promoId: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const code = await env.DB
    .prepare('SELECT * FROM promo_codes WHERE id = ?')
    .bind(promoId)
    .first<{ id: string; code: string; label: string; coupon_id: string; max_redemptions: number; created_at: number }>();

  if (!code) return error('Not found', 404);

  const redemptions = await env.DB
    .prepare('SELECT family_id, stripe_session_id, redeemed_at FROM promo_code_redemptions WHERE promo_code_id = ? ORDER BY redeemed_at DESC')
    .bind(promoId)
    .all<{ family_id: string; stripe_session_id: string; redeemed_at: number }>();

  return json({ code, redemptions: redemptions.results });
}
