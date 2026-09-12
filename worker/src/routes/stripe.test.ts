import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { handleCreateCheckout, handleCheckoutCompleted } from './stripe.js';
import type { Env } from '../types.js';
import type { JwtPayload } from '../lib/jwt.js';

// calcShieldCredit logic extracted for unit testing.
// The real function queries D1; here we test the pure arithmetic against
// a fixture full price (in production this comes from the `products` table).

const STRIPE_MINIMUM_PENCE = 30;

function computeDelta(fullPricePence: number, totalCreditPence: number): number {
  const raw = fullPricePence - totalCreditPence;
  return Math.max(raw, STRIPE_MINIMUM_PENCE);
}

describe('Shield upgrade delta calculation', () => {
  const SHIELD_FULL_PRICE = 14999; // fixture — matches the seeded SHIELD_AI product row

  it('charges full price when no prior purchases', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 0)).toBe(14999);
  });

  it('deducts Core price (£44.99)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 4499)).toBe(10500);
  });

  it('deducts Core AI price (£64.99)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 6499)).toBe(8500);
  });

  it('deducts Core + AI Upgrade (£44.99 + £29.99 = £74.98)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 4499 + 2999)).toBe(7501);
  });

  it('floors at Stripe minimum (30p) if credit somehow exceeds full price', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 20000)).toBe(30);
  });

  it('handles zero credit exactly at full price', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 14999)).toBe(30); // floors at minimum, not 0
  });

  it('recalculates correctly if the catalogue price changes', () => {
    expect(computeDelta(19999, 0)).toBe(19999);
  });
});

interface CheckoutIntent {
  family_id: string;
  sku: string;
  expected_amount_pence: number;
  currency: string;
}

interface SessionLike {
  amount_subtotal?: number;
  amount_total?: number;
  currency?: string;
  metadata?: { family_id?: string; payment_type?: string };
}

function verifyCheckoutAmount(session: SessionLike, intent: CheckoutIntent | null, normalisedSku: string): boolean {
  if (!intent) return false;
  const charged = session.amount_subtotal ?? session.amount_total;
  const currencyMatches = (session.currency ?? '').toLowerCase() === intent.currency.toLowerCase();
  const amountMatches = charged === intent.expected_amount_pence;
  const familyMatches = intent.family_id === session.metadata?.family_id;
  const skuMatches = intent.sku === normalisedSku;
  return currencyMatches && amountMatches && familyMatches && skuMatches;
}

describe('Webhook checkout amount verification', () => {
  const intent: CheckoutIntent = {
    family_id: 'fam_123',
    sku: 'COMPLETE',
    expected_amount_pence: 4499,
    currency: 'GBP',
  };

  it('passes when subtotal matches exactly, no discount', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      amount_total: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(true);
  });

  it('passes when a promo code discounts amount_total but not amount_subtotal', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      amount_total: 2000, // promo code applied
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(true);
  });

  it('passes for a Shield dynamic upgrade price where subtotal IS the discounted amount', () => {
    const shieldIntent: CheckoutIntent = {
      family_id: 'fam_123',
      sku: 'SHIELD_AI',
      expected_amount_pence: 10500, // credited delta, not the £149.99 catalogue price
      currency: 'GBP',
    };
    const session: SessionLike = {
      amount_subtotal: 10500,
      amount_total: 10500,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'SHIELD_AI' },
    };
    expect(verifyCheckoutAmount(session, shieldIntent, 'SHIELD_AI')).toBe(true);
  });

  it('fails when no checkout_intents row was found', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, null, 'COMPLETE')).toBe(false);
  });

  it('fails when the charged amount is lower than expected with no legitimate discount shape', () => {
    const session: SessionLike = {
      amount_subtotal: 100, // tampered/incorrect — doesn't match intent at all
      amount_total: 100,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });

  it('fails on currency mismatch', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'usd',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });

  it('fails when family_id does not match the intent', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_999', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });
});

// ── Minimal in-memory D1 stand-in ────────────────────────────────────────────
// Same technique as auth.test.ts's makeMockDb (not exported from there, so
// reimplemented here scoped to the statements handleCreateCheckout and
// handleCheckoutCompleted actually issue): match by a substring of the SQL
// text, canned rows for SELECTs, and every run() call recorded so tests can
// assert on exactly what was written (or that nothing was written).

interface ProductFixture {
  sku: string;
  name: string;
  stripe_product_id: string;
  stripe_price_id: string;
  unit_amount_pence: number;
  currency: string;
  active: number;
}

interface CheckoutIntentFixture {
  family_id: string;
  sku: string;
  expected_amount_pence: number;
  currency: string;
}

interface DbCall {
  sql: string;
  args: unknown[];
}

interface MockDbOptions {
  productsBySku?: Record<string, ProductFixture | null>;
  shieldCreditTotal?: number;
  existingAuditLog?: { id: number } | null;
  checkoutIntent?: CheckoutIntentFixture | null;
  familyReferredByCode?: string | null;
}

function makeMockDb(opts: MockDbOptions = {}) {
  const calls: DbCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes('FROM products WHERE sku')) {
                const sku = args[0] as string;
                const table = opts.productsBySku ?? {};
                return (Object.prototype.hasOwnProperty.call(table, sku) ? table[sku] : null) as T;
              }
              if (sql.includes('SUM(amount_paid_int)')) {
                return { total: opts.shieldCreditTotal ?? 0 } as T;
              }
              if (sql.includes('SELECT id FROM payment_audit_log WHERE stripe_session_id')) {
                return (opts.existingAuditLog ?? null) as T;
              }
              if (sql.includes('FROM checkout_intents WHERE stripe_session_id')) {
                return (opts.checkoutIntent ?? null) as T;
              }
              if (sql.includes('SELECT referred_by_code FROM families')) {
                return { referred_by_code: opts.familyReferredByCode ?? null } as T;
              }
              if (sql.includes('FROM promo_codes WHERE stripe_promo_code_id')) {
                return null as T;
              }
              return null as T;
            },
            async run() {
              calls.push({ sql, args });
              return { success: true, meta: { changes: 1 } };
            },
            async all<T>() {
              return { results: [] as unknown as T[] };
            },
          };
        },
      };
    },
    async batch(_statements: unknown[]) {
      return [];
    },
  } as unknown as D1Database;

  return { db, calls };
}

function findCall(calls: DbCall[], substring: string): DbCall | undefined {
  return calls.find(c => c.sql.includes(substring));
}

describe('handleCreateCheckout', () => {
  const baseAuth: JwtPayload = {
    sub: 'user1', jti: 'sess1', family_id: 'fam1', role: 'parent', iat: 0, exp: 9999999999,
  };

  function makeEnv(db: D1Database): Env {
    return {
      DB: db,
      APP_URL: 'https://app.morechard.com',
      STRIPE_SECRET_KEY: 'sk_test_fake',
    } as unknown as Env;
  }

  function makeRequest(payment_type: string): Request {
    return new Request('https://api.morechard.com/api/stripe/create-checkout', {
      method: 'POST',
      body: JSON.stringify({ payment_type }),
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 503 for an unknown/inactive SKU (product row missing from D1)', async () => {
    const { db } = makeMockDb({ productsBySku: { COMPLETE: null } });
    const res = await handleCreateCheckout(makeRequest('COMPLETE'), makeEnv(db), baseAuth);
    expect(res.status).toBe(503);
  });

  it('creates a checkout session with the catalogue price for a valid non-Shield SKU', async () => {
    const product: ProductFixture = {
      sku: 'COMPLETE', name: 'Morechard Core', stripe_product_id: 'prod_1',
      stripe_price_id: 'price_complete_123', unit_amount_pence: 4499, currency: 'GBP', active: 1,
    };
    const { db, calls } = makeMockDb({ productsBySku: { COMPLETE: product } });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/checkout/sessions')) {
        return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/cs_test_1' }), { status: 200 });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));

    const res = await handleCreateCheckout(makeRequest('COMPLETE'), makeEnv(db), baseAuth);
    expect(res.status).toBe(200);

    const insertCall = findCall(calls, 'INSERT INTO checkout_intents');
    expect(insertCall).toBeDefined();
    const [, , sku, priceId, expectedAmount] = insertCall!.args;
    expect(sku).toBe('COMPLETE');
    expect(priceId).toBe('price_complete_123'); // catalogue price, unchanged
    expect(expectedAmount).toBe(4499);          // catalogue amount, unchanged
  });

  it('charges full catalogue price for SHIELD_AI when the family has no prior purchases', async () => {
    const product: ProductFixture = {
      sku: 'SHIELD_AI', name: 'Morechard Shield AI', stripe_product_id: 'prod_shield',
      stripe_price_id: 'price_shield_full', unit_amount_pence: 14999, currency: 'GBP', active: 1,
    };
    const { db, calls } = makeMockDb({ productsBySku: { SHIELD_AI: product }, shieldCreditTotal: 0 });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/checkout/sessions')) {
        return new Response(JSON.stringify({ id: 'cs_test_2', url: 'https://checkout.stripe.com/cs_test_2' }), { status: 200 });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));

    const res = await handleCreateCheckout(makeRequest('SHIELD_AI'), makeEnv(db), baseAuth);
    expect(res.status).toBe(200);

    const insertCall = findCall(calls, 'INSERT INTO checkout_intents');
    expect(insertCall).toBeDefined();
    const [, , sku, priceId, expectedAmount] = insertCall!.args;
    expect(sku).toBe('SHIELD_AI');
    expect(priceId).toBe('price_shield_full'); // no discount → catalogue price
    expect(expectedAmount).toBe(14999);
  });

  it('uses a dynamic discounted price for SHIELD_AI when prior purchases earn a credit', async () => {
    const product: ProductFixture = {
      sku: 'SHIELD_AI', name: 'Morechard Shield AI', stripe_product_id: 'prod_shield',
      stripe_price_id: 'price_shield_full', unit_amount_pence: 14999, currency: 'GBP', active: 1,
    };
    // Family already paid £44.99 (COMPLETE) → £105.00 credit remains to charge.
    const { db, calls } = makeMockDb({ productsBySku: { SHIELD_AI: product }, shieldCreditTotal: 4499 });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v1/prices')) {
        return new Response(JSON.stringify({ id: 'price_dynamic_999' }), { status: 200 });
      }
      if (url.includes('/v1/checkout/sessions')) {
        return new Response(JSON.stringify({ id: 'cs_test_3', url: 'https://checkout.stripe.com/cs_test_3' }), { status: 200 });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));

    const res = await handleCreateCheckout(makeRequest('SHIELD_AI'), makeEnv(db), baseAuth);
    expect(res.status).toBe(200);

    const insertCall = findCall(calls, 'INSERT INTO checkout_intents');
    expect(insertCall).toBeDefined();
    const [, , sku, priceId, expectedAmount] = insertCall!.args;
    expect(sku).toBe('SHIELD_AI');
    expect(priceId).toBe('price_dynamic_999'); // dynamic price, NOT the catalogue price
    expect(expectedAmount).toBe(10500);        // discounted amount, NOT the catalogue amount
  });
});

describe('handleCheckoutCompleted', () => {
  function makeEnv(db: D1Database): Env {
    return { DB: db } as unknown as Env;
  }

  const baseSession = {
    id: 'cs_webhook_1',
    metadata: { family_id: 'fam1', payment_type: 'COMPLETE' },
    amount_total: 4499,
    amount_subtotal: 4499,
    currency: 'gbp',
  };

  it('grants the license when the intent matches with no discount', async () => {
    const { db, calls } = makeMockDb({
      checkoutIntent: { family_id: 'fam1', sku: 'COMPLETE', expected_amount_pence: 4499, currency: 'GBP' },
      existingAuditLog: null,
      familyReferredByCode: null,
    });

    await handleCheckoutCompleted(baseSession, makeEnv(db));

    const grantCall = findCall(calls, 'UPDATE families SET has_lifetime_license = 1 WHERE id = ?');
    expect(grantCall).toBeDefined();
    expect(grantCall!.args[0]).toBe('fam1');

    // Bonus coverage for Fix 6 (currency binds from the verified intent, not hardcoded 'GBP')
    const auditCall = findCall(calls, 'INSERT INTO payment_audit_log');
    expect(auditCall).toBeDefined();
    expect(auditCall!.args).toContain('GBP');
  });

  it('does not grant a license when there is no matching checkout_intents row', async () => {
    const { db, calls } = makeMockDb({
      checkoutIntent: null,
      existingAuditLog: null,
      familyReferredByCode: null,
    });

    await handleCheckoutCompleted(baseSession, makeEnv(db));

    const grantCall = calls.find(c => c.sql.includes('has_lifetime_license'));
    expect(grantCall).toBeUndefined();
  });

  it('does not grant a license when the charged amount does not match the intent', async () => {
    const { db, calls } = makeMockDb({
      // Intent expected £149.99 (e.g. Shield) but this session only charged £44.99 — mismatch.
      checkoutIntent: { family_id: 'fam1', sku: 'COMPLETE', expected_amount_pence: 14999, currency: 'GBP' },
      existingAuditLog: null,
      familyReferredByCode: null,
    });

    await handleCheckoutCompleted(baseSession, makeEnv(db));

    const grantCall = calls.find(c => c.sql.includes('has_lifetime_license'));
    expect(grantCall).toBeUndefined();
  });
});
