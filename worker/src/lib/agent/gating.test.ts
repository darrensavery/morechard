import { describe, it, expect } from 'vitest';
import { classifyGatedRecommendation, computeDeterministicPayloadHash } from './gating.js';

describe('classifyGatedRecommendation', () => {
  it('recommends approve at >=90% confidence with a matched category and verified preconditions', () => {
    expect(classifyGatedRecommendation({ confidence: 0.95, category: '06-billing-payments-stripe', preconditionsVerified: true }))
      .toBe('recommended_approve');
  });

  it('is exactly at the boundary — 0.90 counts as recommended', () => {
    expect(classifyGatedRecommendation({ confidence: 0.9, category: '06-billing-payments-stripe', preconditionsVerified: true }))
      .toBe('recommended_approve');
  });

  it('routes to needs_review just below the threshold', () => {
    expect(classifyGatedRecommendation({ confidence: 0.89, category: '06-billing-payments-stripe', preconditionsVerified: true }))
      .toBe('needs_review');
  });

  it('routes to needs_review when preconditions are not verified, even at high confidence', () => {
    expect(classifyGatedRecommendation({ confidence: 0.99, category: '06-billing-payments-stripe', preconditionsVerified: false }))
      .toBe('needs_review');
  });

  it('always routes novel incidents to needs_review regardless of confidence', () => {
    expect(classifyGatedRecommendation({ confidence: 0.99, category: 'novel', preconditionsVerified: true }))
      .toBe('needs_review');
  });
});

describe('computeDeterministicPayloadHash', () => {
  it('produces the same hash regardless of object key order', async () => {
    const hashA = await computeDeterministicPayloadHash({ a: 1, b: 2 });
    const hashB = await computeDeterministicPayloadHash({ b: 2, a: 1 });
    expect(hashA).toBe(hashB);
  });

  it('produces a different hash when a value changes', async () => {
    const hashA = await computeDeterministicPayloadHash({ amount: 100 });
    const hashB = await computeDeterministicPayloadHash({ amount: 200 });
    expect(hashA).not.toBe(hashB);
  });

  it('produces a 64-char hex hash', async () => {
    const hash = await computeDeterministicPayloadHash({ x: 1 });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
