import { describe, it, expect } from 'vitest';

// calcShieldCredit logic extracted for unit testing.
// The real function queries D1; here we test the pure arithmetic.

const SHIELD_FULL_PRICE = 14999;
const STRIPE_MINIMUM_PENCE = 30;

function computeDelta(totalCreditPence: number): number {
  const raw = SHIELD_FULL_PRICE - totalCreditPence;
  return Math.max(raw, STRIPE_MINIMUM_PENCE);
}

describe('Shield upgrade delta calculation', () => {
  it('charges full price when no prior purchases', () => {
    expect(computeDelta(0)).toBe(14999);
  });

  it('deducts Core price (£44.99)', () => {
    expect(computeDelta(4499)).toBe(10500);
  });

  it('deducts Core AI price (£64.99)', () => {
    expect(computeDelta(6499)).toBe(8500);
  });

  it('deducts Core + AI Upgrade (£44.99 + £29.99 = £74.98)', () => {
    expect(computeDelta(4499 + 2999)).toBe(7501);
  });

  it('floors at Stripe minimum (30p) if credit somehow exceeds full price', () => {
    expect(computeDelta(20000)).toBe(30);
  });

  it('handles zero credit exactly at full price', () => {
    expect(computeDelta(14999)).toBe(30); // floors at minimum, not 0
  });
});
