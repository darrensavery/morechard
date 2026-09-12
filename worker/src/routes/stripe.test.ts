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
