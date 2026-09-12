import { describe, it, expect } from 'vitest';

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
