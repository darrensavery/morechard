/**
 * Payment integration — Morechard (Stripe, UK Phase 1)
 *
 * POST /api/stripe/create-checkout  — create a Checkout session (authenticated)
 * POST /api/stripe/webhook          — receive payment events (public, signature-verified)
 *
 * All products are one-time payments. No subscriptions are issued.
 *
 * SKU catalogue:
 *   COMPLETE     £44.99  — Morechard Core: base tracker; AI Mentor / Learning Lab locked after trial
 *   COMPLETE_AI  £64.99  — Morechard Core AI: Core + AI Mentor + Learning Lab permanently unlocked
 *   SHIELD_AI    £149.99 — Morechard Shield AI: Core AI + court-admissible hashed PDF exports
 *   AI_UPGRADE   £29.99  — AI Mentor + Learning Lab one-time upgrade (existing Core purchasers)
 *
 * Legacy SKUs (no longer sold; handled in webhook for idempotency only):
 *   LIFETIME     → treated as COMPLETE
 *   AI_ANNUAL    → treated as AI_UPGRADE (permanent unlock, not time-limited)
 *
 * Idempotency: webhook checks payment_audit_log for duplicate stripe_session_id
 * before writing. Stripe may deliver the same event more than once.
 *
 * Signature verification uses STRIPE_WEBHOOK_SECRET from env (never hardcoded).
 *
 * Provider abstraction: all Stripe-specific logic is contained in this file.
 * To migrate to a different payment provider, replace createCheckoutSession()
 * and verifyWebhookSignature() — the license-grant logic below them is provider-neutral.
 */

import * as Sentry from '@sentry/cloudflare';
import { Env, PaymentType } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';

// ----------------------------------------------------------------
// Product catalogue
// Prices are read from the `products` D1 table (Task 1/2) so that
// live/test values are swapped by editing a row, not the codebase.
// All modes are 'payment' (one-time). No 'subscription' mode used.
// ----------------------------------------------------------------

interface ProductRow {
  sku:               PaymentType;
  name:              string;
  stripe_product_id: string;
  stripe_price_id:   string;
  unit_amount_pence: number;
  currency:          string;
  active:            number;
}

async function getProduct(env: Env, sku: PaymentType): Promise<ProductRow | null> {
  return env.DB
    .prepare('SELECT * FROM products WHERE sku = ? AND active = 1')
    .bind(sku)
    .first<ProductRow>();
}

// SKUs accepted at checkout (legacy and alias SKUs not directly purchasable)
const PURCHASABLE: PaymentType[] = ['COMPLETE', 'COMPLETE_AI', 'SHIELD_AI', 'AI_UPGRADE'];

// ----------------------------------------------------------------
// Shield upgrade credit — sums what this family already paid
// toward the Shield licence price.
// ----------------------------------------------------------------

const STRIPE_MINIMUM_PENCE = 30;

interface ShieldCreditResult {
  alreadyPaid: number;  // pence
  delta: number;        // pence — amount to charge
}

async function calcShieldCredit(env: Env, familyId: string, fullPricePence: number): Promise<ShieldCreditResult> {
  const row = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(amount_paid_int), 0) AS total
      FROM payment_audit_log
      WHERE family_id = ?
        AND payment_type IN ('COMPLETE', 'COMPLETE_AI', 'AI_UPGRADE')
        AND refunded_at IS NULL
        AND currency = 'GBP'
    `)
    .bind(familyId)
    .first<{ total: number }>();

  const alreadyPaid = row?.total ?? 0;
  const raw = fullPricePence - alreadyPaid;
  const delta = Math.max(raw, STRIPE_MINIMUM_PENCE);

  return { alreadyPaid, delta };
}

// ----------------------------------------------------------------
// Referral: only acquisition SKUs (not upgrades) earn referral credit
// ----------------------------------------------------------------
const REFERRAL_ELIGIBLE: PaymentType[] = ['COMPLETE', 'COMPLETE_AI', 'SHIELD_AI', 'LIFETIME'];

// ----------------------------------------------------------------
// Provider layer — Stripe-specific. Replace this section to migrate.
// ----------------------------------------------------------------

async function createCheckoutSession(
  priceId: string,
  familyId: string,
  paymentType: PaymentType,
  appUrl: string,
  stripeSecretKey: string,
): Promise<{ url: string; sessionId: string }> {
  const params = new URLSearchParams({
    'payment_method_types[]':  'card',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': '1',
    'mode':                    'payment',
    'allow_promotion_codes':   'true',
    'metadata[family_id]':     familyId,
    'metadata[payment_type]':  paymentType,
    'success_url':             `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url':              `${appUrl}/paywall`,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error('Stripe create-checkout error:', msg);
    throw new Error('Payment provider error');
  }

  const session = await res.json() as { url: string; id: string };
  return { url: session.url, sessionId: session.id };
}

async function createDynamicPrice(
  productId: string,
  unitAmount: number,
  currency: string,
  stripeSecretKey: string,
): Promise<string> {
  const params = new URLSearchParams({
    'currency':    currency,
    'unit_amount': String(unitAmount),
    'product':     productId,
  });

  const res = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error('Stripe create-price error:', msg);
    throw new Error('Failed to create dynamic price');
  }

  const price = await res.json() as { id: string };
  return price.id;
}

async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=')).map(([k, ...v]) => [k, v.join('=')])
  );

  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes (replay attack guard)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(`${timestamp}.${rawBody}`);

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to prevent timing attacks.
  const a = new TextEncoder().encode(hex);
  const b = new TextEncoder().encode(v1);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ----------------------------------------------------------------
// Route: GET /api/products
// ----------------------------------------------------------------
export async function handleGetProducts(
  _request: Request,
  env: Env,
): Promise<Response> {
  const rows = await env.DB
    .prepare('SELECT sku, name, unit_amount_pence, currency FROM products WHERE active = 1')
    .all<{ sku: string; name: string; unit_amount_pence: number; currency: string }>();

  return json({ products: rows.results });
}

// ----------------------------------------------------------------
// Route: GET /api/stripe/shield-upgrade-price
// ----------------------------------------------------------------
export async function handleShieldUpgradePrice(
  _request: Request,
  env: Env,
  auth: JwtPayload,
): Promise<Response> {
  // Only parents can purchase
  if (auth.role !== 'parent') return error('Forbidden', 403);

  // Guard: already has Shield
  const family = await env.DB
    .prepare('SELECT has_shield FROM families WHERE id = ?')
    .bind(auth.family_id)
    .first<{ has_shield: number }>();

  if (!family) return error('Family not found', 404);
  if (family.has_shield) return error('Already purchased', 400);

  const product = await getProduct(env, 'SHIELD_AI');
  if (!product) return error('Shield AI is not available for purchase', 503);

  const { alreadyPaid, delta } = await calcShieldCredit(env, auth.family_id, product.unit_amount_pence);

  return json({
    full_price:   product.unit_amount_pence,
    already_paid: alreadyPaid,
    delta,
    currency:     product.currency,
  });
}

// ----------------------------------------------------------------
// Route: POST /api/stripe/create-checkout
// ----------------------------------------------------------------
export async function handleCreateCheckout(
  request: Request,
  env: Env,
  auth: JwtPayload,
): Promise<Response> {
  if (auth.role !== 'parent') return error('Only parents can purchase', 403);

  const body = await request.json() as { payment_type?: unknown };
  const payment_type = body.payment_type as PaymentType;

  if (!PURCHASABLE.includes(payment_type)) {
    return error(`payment_type must be one of: ${PURCHASABLE.join(', ')}`, 400);
  }

  const product = await getProduct(env, payment_type);
  if (!product) {
    console.error(`No product configured for SKU ${payment_type}`);
    return error('This product is not yet available for purchase', 503);
  }

  let priceId = product.stripe_price_id;
  let expectedAmountPence = product.unit_amount_pence;

  // For Shield, calculate upgrade credit and use a dynamic price if applicable
  if (payment_type === 'SHIELD_AI') {
    const { delta } = await calcShieldCredit(env, auth.family_id, product.unit_amount_pence);
    if (delta < product.unit_amount_pence) {
      try {
        priceId = await createDynamicPrice(
          product.stripe_product_id,
          delta,
          product.currency.toLowerCase(),
          env.STRIPE_SECRET_KEY,
        );
      } catch {
        return error('Failed to calculate upgrade price', 502);
      }
      expectedAmountPence = delta;
    }
  }

  let sessionResult: { url: string; sessionId: string };
  try {
    sessionResult = await createCheckoutSession(
      priceId, auth.family_id, payment_type, env.APP_URL, env.STRIPE_SECRET_KEY,
    );
  } catch {
    return error('Failed to create checkout session', 502);
  }

  try {
    await env.DB
      .prepare(`
        INSERT INTO checkout_intents (stripe_session_id, family_id, sku, stripe_price_id, expected_amount_pence, currency)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(sessionResult.sessionId, auth.family_id, payment_type, priceId, expectedAmountPence, product.currency)
      .run();
  } catch (err) {
    console.error('Failed to write checkout_intents row:', String(err));
    return error('Failed to create checkout session', 502);
  }

  return json({ url: sessionResult.url, session_id: sessionResult.sessionId });
}

// ----------------------------------------------------------------
// Route: POST /api/stripe/webhook
// ----------------------------------------------------------------
export async function handleStripeWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return error('Missing stripe-signature header', 400);

  const rawBody = await request.text();

  const verified = await verifyWebhookSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return error('Invalid webhook signature', 401);

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return error('Invalid JSON in webhook body', 400);
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await handleCheckoutCompleted(event.data.object, env);
    } catch (err) {
      console.error('handleCheckoutCompleted threw:', String(err), err instanceof Error ? err.stack : '');
      // Return 200 so Stripe stops retrying — we log the error for diagnosis
      return json({ received: true, error: String(err) });
    }
  }

  const FAILURE_EVENT_TYPES = new Set([
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
    'payment_intent.payment_failed',
    'charge.failed',
    'invoice.payment_failed',
  ]);

  if (FAILURE_EVENT_TYPES.has(event.type)) {
    const obj = event.data.object as unknown as Record<string, unknown>;
    const lastError = obj['last_payment_error'] as Record<string, unknown> | undefined;
    // Distinct fingerprint so this groups into its own Sentry issue — a
    // dedicated alert rule can fire on this specific fingerprint rather than
    // relying on generic exception-rate alerting to happen to cover it.
    Sentry.captureMessage(`Stripe payment failure: ${event.type}`, {
      level: 'error',
      fingerprint: ['stripe-payment-failure', event.type],
      extra: {
        stripe_object_id: obj['id'],
        family_id: obj['metadata'] && (obj['metadata'] as Record<string, string>)['family_id'],
        failure_message: lastError?.['message'] ?? obj['failure_message'],
      },
    });
  }

  // Always 200 — Stripe retries on non-2xx
  return json({ received: true });
}

// ----------------------------------------------------------------
// License grant logic — provider-neutral
//
// Exported (rather than kept module-private) purely for unit testability —
// handleStripeWebhook's own entry point requires a valid HMAC-SHA256
// signature over the raw body, which makes driving it directly in tests
// impractical for the scenarios that matter here (missing/duplicate/mismatched
// checkout_intents). See stripe.test.ts.
// ----------------------------------------------------------------
export async function handleCheckoutCompleted(session: StripeSession, env: Env): Promise<void> {
  const { family_id, payment_type: rawType } = session.metadata ?? {};

  const KNOWN: string[] = [...PURCHASABLE, 'LIFETIME', 'AI_ANNUAL', 'SHIELD'];
  if (!family_id || !KNOWN.includes(rawType)) {
    return;
  }

  // Normalise legacy SKUs to current equivalents
  const payment_type = normaliseSku(rawType as PaymentType);

  // Idempotency guard
  const existing = await env.DB
    .prepare('SELECT id FROM payment_audit_log WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ id: number }>();

  if (existing) {
    return;
  }

  // Verify the charged amount against what we told Stripe to charge when we
  // created this specific session — the source of truth for "did the
  // customer actually pay what this SKU costs", independent of metadata.
  const intent = await env.DB
    .prepare('SELECT family_id, sku, expected_amount_pence, currency FROM checkout_intents WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ family_id: string; sku: string; expected_amount_pence: number; currency: string }>();

  if (!intent) {
    Sentry.captureMessage('Stripe checkout completed with no matching checkout_intents row', {
      level: 'error',
      fingerprint: ['stripe-checkout-intent-missing'],
      extra: { stripe_session_id: session.id, family_id, payment_type },
    });
    return;
  }

  const chargedAmount = session.amount_subtotal ?? session.amount_total;
  const currencyMatches = (session.currency ?? '').toLowerCase() === intent.currency.toLowerCase();
  const amountMatches = chargedAmount === intent.expected_amount_pence;
  const familyMatches = intent.family_id === family_id;
  const skuMatches = intent.sku === payment_type;

  if (!amountMatches || !currencyMatches || !familyMatches || !skuMatches) {
    Sentry.captureMessage('Stripe checkout amount/product mismatch — refusing to grant', {
      level: 'error',
      fingerprint: ['stripe-amount-mismatch'],
      extra: {
        stripe_session_id: session.id,
        family_id, payment_type,
        expected_amount_pence: intent.expected_amount_pence,
        charged_amount: chargedAmount,
        expected_currency: intent.currency,
        charged_currency: session.currency,
        intent_sku: intent.sku,
        intent_family_id: intent.family_id,
      },
    });
    return;
  }

  // Write audit record first — never lose the payment fact
  await env.DB
    .prepare(`
      INSERT INTO payment_audit_log (family_id, stripe_session_id, amount_paid_int, currency, payment_type)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(family_id, session.id, session.amount_total ?? 0, intent.currency, payment_type)
    .run();

  // Grant license flags
  await grantLicense(env, family_id, payment_type);

  // Record referral conversion if applicable
  const now = Math.floor(Date.now() / 1000);
  await recordReferralConversion(env, family_id, payment_type, session.id, now);

  // Record promo code redemption if one was applied at checkout
  const promoCodeId = session.discounts?.[0]?.promotion_code ?? null;
  if (promoCodeId) {
    const promoRow = await env.DB
      .prepare('SELECT id FROM promo_codes WHERE stripe_promo_code_id = ?')
      .bind(promoCodeId)
      .first<{ id: string }>();
    if (promoRow) {
      await env.DB
        .prepare(`
          INSERT OR IGNORE INTO promo_code_redemptions (id, promo_code_id, family_id, stripe_session_id, redeemed_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(crypto.randomUUID(), promoRow.id, family_id, session.id, now)
        .run();
    }
  }

}

function normaliseSku(sku: PaymentType): PaymentType {
  if (sku === 'LIFETIME') return 'COMPLETE';
  if (sku === 'AI_ANNUAL') return 'AI_UPGRADE';
  if (sku === 'SHIELD') return 'SHIELD_AI';
  return sku;
}

async function grantLicense(env: Env, familyId: string, paymentType: PaymentType): Promise<void> {
  switch (paymentType) {
    case 'COMPLETE':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 1 WHERE id = ?')
        .bind(familyId)
        .run();
      break;

    case 'COMPLETE_AI':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 1, has_ai_mentor = 1 WHERE id = ?')
        .bind(familyId)
        .run();
      break;

    case 'SHIELD_AI':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 1, has_ai_mentor = 1, has_shield = 1 WHERE id = ?')
        .bind(familyId)
        .run();
      break;

    case 'AI_UPGRADE':
      // Only grant if family already holds a base license
      await env.DB
        .prepare('UPDATE families SET has_ai_mentor = 1 WHERE id = ? AND has_lifetime_license = 1')
        .bind(familyId)
        .run();
      break;
  }
}

// ----------------------------------------------------------------
// Referral conversion — cash-commission model
// Fires only for acquisition SKUs (not upgrades).
// Actual cash payout is handled externally (Rewardful or similar).
// This records the conversion fact so the affiliate dashboard can settle.
// ----------------------------------------------------------------
async function recordReferralConversion(
  env: Env,
  familyId: string,
  paymentType: PaymentType,
  stripeSessionId: string,
  now: number,
): Promise<void> {
  if (!REFERRAL_ELIGIBLE.includes(paymentType)) return;

  const family = await env.DB
    .prepare('SELECT referred_by_code FROM families WHERE id = ?')
    .bind(familyId)
    .first<{ referred_by_code: string | null }>();

  if (!family?.referred_by_code) return;

  const result = await env.DB
    .prepare(`
      INSERT OR IGNORE INTO referral_conversions
        (referral_code, referred_family, payment_type, stripe_session_id, converted_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(family.referred_by_code, familyId, paymentType, stripeSessionId, now)
    .run();

  if (!result.meta.changes) return;

  // Mark as pending cash settlement (no AI-time grants — cash affiliate model)
  await env.DB
    .prepare('UPDATE referral_conversions SET reward_granted = 1 WHERE stripe_session_id = ?')
    .bind(stripeSessionId)
    .run();
}

// ----------------------------------------------------------------
// Route: DELETE /api/billing/cancel  (14-day cooling-off refund)
// ----------------------------------------------------------------
export async function handleCancelPlan(
  request: Request,
  env: Env,
  auth: JwtPayload,
): Promise<Response> {
  // Only lead parent can cancel
  if (auth.role !== 'parent') return error('Forbidden', 403);

  // Find the most recent paid purchase for this family
  const purchase = await env.DB
    .prepare(`
      SELECT id, stripe_session_id, payment_type, created_at
      FROM payment_audit_log
      WHERE family_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(auth.family_id)
    .first<{ id: number; stripe_session_id: string; payment_type: string; created_at: string }>();

  if (!purchase) return error('No purchase found', 404);

  // Enforce 14-day cooling-off window
  const purchasedAt = new Date(purchase.created_at).getTime();
  const daysSince = (Date.now() - purchasedAt) / (1000 * 60 * 60 * 24);
  if (daysSince > 14) {
    return error('The 14-day cooling-off period has expired', 403);
  }

  // Refuse if the family's trial had already expired before they purchased —
  // revoking the licence would leave them with no access at all.
  const family = await env.DB
    .prepare('SELECT trial_start_date, is_activated FROM families WHERE id = ?')
    .bind(auth.family_id)
    .first<{ trial_start_date: string | null; is_activated: number }>();

  if (family?.is_activated && family.trial_start_date) {
    const trialExpiry = new Date(family.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000;
    if (Date.now() > trialExpiry) {
      return error(
        'Your free trial has already ended. Cancelling would leave you without access — please contact support for a manual refund.',
        403,
      );
    }
  }

  // Fetch the Stripe session to get the payment_intent
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${purchase.stripe_session_id}`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
  );
  if (!sessionRes.ok) {
    console.error('Stripe session fetch failed:', await sessionRes.text());
    return error('Could not retrieve payment details', 502);
  }
  const session = await sessionRes.json() as { payment_intent?: string };
  if (!session.payment_intent) {
    return error('No payment intent found for this session', 400);
  }

  // Issue the refund
  const refundParams = new URLSearchParams({ payment_intent: session.payment_intent });
  const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: refundParams.toString(),
  });
  if (!refundRes.ok) {
    console.error('Stripe refund failed:', await refundRes.text());
    return error('Refund failed — please contact support', 502);
  }

  // Revoke licence flags
  await revokeLicense(env, auth.family_id, purchase.payment_type as PaymentType);

  // Mark the audit record as refunded
  await env.DB
    .prepare('UPDATE payment_audit_log SET refunded_at = datetime(\'now\') WHERE id = ?')
    .bind(purchase.id)
    .run();

  console.log(`Refund issued for family ${auth.family_id}, session ${purchase.stripe_session_id}`);
  return json({ refunded: true });
}

async function revokeLicense(env: Env, familyId: string, paymentType: PaymentType): Promise<void> {
  switch (normaliseSku(paymentType)) {
    case 'COMPLETE':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 0 WHERE id = ?')
        .bind(familyId).run();
      break;
    case 'COMPLETE_AI':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 0, has_ai_mentor = 0 WHERE id = ?')
        .bind(familyId).run();
      break;
    case 'SHIELD_AI':
      await env.DB
        .prepare('UPDATE families SET has_lifetime_license = 0, has_ai_mentor = 0, has_shield = 0 WHERE id = ?')
        .bind(familyId).run();
      break;
    case 'AI_UPGRADE':
      await env.DB
        .prepare('UPDATE families SET has_ai_mentor = 0 WHERE id = ?')
        .bind(familyId).run();
      break;
  }
}

// ----------------------------------------------------------------
// Minimal Stripe type stubs
// ----------------------------------------------------------------
interface StripeEvent {
  type: string;
  data: { object: StripeSession };
}

interface StripeSession {
  id: string;
  metadata?: Record<string, string>;
  amount_total?: number;     // actual charge in minor units (pence for GBP)
  amount_subtotal?: number;  // pre-discount line-item total in minor units
  currency?: string;
  discounts?: Array<{ promotion_code: string | null }>;
}
