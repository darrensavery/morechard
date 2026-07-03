/**
 * Admin routes — protected by X-Admin-Key header (ADMIN_SECRET env var).
 * These are internal operator tools, not end-user APIs.
 *
 * POST /api/admin/promo-codes           — create a school promo code in Stripe + D1
 * GET  /api/admin/promo-codes           — list all codes with redemption counts
 * GET  /api/admin/promo-codes/:id       — detail view: all families who redeemed a code
 *
 * GET  /api/admin/promotion-candidates           — review queue of popular child suggestions
 * POST /api/admin/promotion-candidates/:id/promote — add candidate to the market_rates library
 * POST /api/admin/promotion-candidates/:id/dismiss — reject candidate (never resurfaced)
 *
 * GET /api/admin/exchange-rates           — list locale multipliers
 * PUT /api/admin/exchange-rates/:locale   — update a locale's multiplier/label, busts cache
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { nanoid } from '../lib/nanoid.js';
import { loadMultipliers, bustExchangeRatesCache } from './exchange-rates.js';

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

// ----------------------------------------------------------------
// Promotion candidates — popular child suggestions awaiting review
// ----------------------------------------------------------------

// Locale → the market_rates median column it seeds.
const LOCALE_MEDIAN_COLUMN: Record<string, 'uk_median_pence' | 'us_median_cents' | 'pl_median_grosz'> = {
  'en-GB': 'uk_median_pence',
  'en-US': 'us_median_cents',
  'pl':    'pl_median_grosz',
};

// ----------------------------------------------------------------
// GET /api/admin/promotion-candidates?status=pending
// ----------------------------------------------------------------
export async function handleListPromotionCandidates(
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const status = new URL(request.url).searchParams.get('status') ?? 'pending';
  if (!['pending', 'promoted', 'dismissed'].includes(status)) return error('Invalid status', 400);

  const rows = await env.DB
    .prepare(`
      SELECT id, normalized_key, locale, display_name, category,
             distinct_families, suggestion_count, median_amount, sample_titles,
             status, market_rate_id, first_seen_at, last_seen_at, reviewed_at
      FROM chore_promotion_candidates
      WHERE status = ?
      ORDER BY distinct_families DESC, last_seen_at DESC
    `)
    .bind(status)
    .all();

  const candidates = rows.results.map(r => ({
    ...r,
    sample_titles: (() => { try { return JSON.parse(r.sample_titles as string); } catch { return []; } })(),
  }));

  return json({ candidates });
}

// ----------------------------------------------------------------
// POST /api/admin/promotion-candidates/:id/promote
// Body (all optional overrides): { canonical_name, category, median_amount }
// Inserts the candidate into market_rates as a community-sourced rate.
// ----------------------------------------------------------------
export async function handlePromotePromotionCandidate(
  id: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const cand = await env.DB
    .prepare('SELECT * FROM chore_promotion_candidates WHERE id = ?')
    .bind(id)
    .first<{
      id: string; locale: string; display_name: string; category: string;
      distinct_families: number; median_amount: number | null; status: string;
    }>();
  if (!cand) return error('Candidate not found', 404);
  if (cand.status !== 'pending') return error(`Candidate already ${cand.status}`, 409);

  let body: { canonical_name?: unknown; category?: unknown; median_amount?: unknown } = {};
  try { body = await request.json() as typeof body; } catch { /* body optional */ }

  const canonicalName = typeof body.canonical_name === 'string' && body.canonical_name.trim()
    ? body.canonical_name.trim() : cand.display_name;
  const category = typeof body.category === 'string' && body.category.trim()
    ? body.category.trim() : cand.category;
  const median = typeof body.median_amount === 'number' && body.median_amount > 0
    ? Math.round(body.median_amount) : cand.median_amount;

  const medianColumn = LOCALE_MEDIAN_COLUMN[cand.locale];
  if (!medianColumn) return error(`Unsupported locale ${cand.locale}`, 400);

  // Guard against colliding with an existing library entry (canonical_name is UNIQUE).
  const existing = await env.DB
    .prepare('SELECT id FROM market_rates WHERE canonical_name = ?')
    .bind(canonicalName)
    .first<{ id: string }>();
  if (existing) return error(`A market rate named "${canonicalName}" already exists`, 409);

  const rateId = nanoid();
  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`
      INSERT INTO market_rates
        (id, canonical_name, category, synonyms, ${medianColumn},
         data_source, sample_count, is_orchard_8, sort_order, created_at, updated_at)
      VALUES (?,?,?,?,?,'community_median',?,0,99,?,?)
    `)
    .bind(rateId, canonicalName, category, '[]', median, cand.distinct_families, now, now)
    .run();

  await env.DB
    .prepare(`UPDATE chore_promotion_candidates SET status = 'promoted', market_rate_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`)
    .bind(rateId, now, now, id)
    .run();

  // Bust the market-rates cache so the new chore appears immediately.
  await Promise.all(['en-GB', 'en-US', 'pl'].map(l => env.CACHE.delete(`market-rates:${l}`).catch(() => {})));

  return json({ ok: true, market_rate_id: rateId, canonical_name: canonicalName });
}

// ----------------------------------------------------------------
// POST /api/admin/promotion-candidates/:id/dismiss
// Marks the candidate dismissed so the weekly job never resurfaces it.
// ----------------------------------------------------------------
export async function handleDismissPromotionCandidate(
  id: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const cand = await env.DB
    .prepare('SELECT status FROM chore_promotion_candidates WHERE id = ?')
    .bind(id)
    .first<{ status: string }>();
  if (!cand) return error('Candidate not found', 404);
  if (cand.status !== 'pending') return error(`Candidate already ${cand.status}`, 409);

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`UPDATE chore_promotion_candidates SET status = 'dismissed', reviewed_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, id)
    .run();

  return json({ ok: true });
}

// ----------------------------------------------------------------
// GET /api/admin/exchange-rates
// ----------------------------------------------------------------

export async function handleGetAdminExchangeRates(
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const multipliers = await loadMultipliers(env);
  return json({ rates: Array.from(multipliers.values()) });
}

// ----------------------------------------------------------------
// PUT /api/admin/exchange-rates/:locale
// Body: { multiplier: number, label?: string }
// ----------------------------------------------------------------

export async function handleUpdateExchangeRate(
  locale: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const existing = await env.DB
    .prepare('SELECT locale FROM locale_multipliers WHERE locale = ?')
    .bind(locale)
    .first<{ locale: string }>();
  if (!existing) return error('Unknown locale', 404);

  let body: { multiplier?: unknown; label?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return error('Invalid JSON body', 400);
  }

  const multiplier = body.multiplier;
  const label      = typeof body.label === 'string' ? body.label.trim() : undefined;

  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier <= 0) {
    return error('multiplier must be a positive number', 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(`
      UPDATE locale_multipliers
      SET multiplier = ?, label = COALESCE(?, label), updated_at = ?
      WHERE locale = ?
    `)
    .bind(multiplier, label ?? null, now, locale)
    .run();

  await bustExchangeRatesCache(env);

  return json({ ok: true, locale, multiplier, label: label ?? undefined });
}
