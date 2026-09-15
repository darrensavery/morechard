import { describe, it, expect } from 'vitest';
import { isTransientD1Error } from './transientD1Error.js';

describe('isTransientD1Error', () => {
  it('matches a D1 Durable Object timeout reset', () => {
    expect(isTransientD1Error(new Error('D1 DB storage operation exceeded timeout which caused object to be reset'))).toBe(true);
  });

  it('matches the account-wide D1 throughput cap message from the 2026-09-15 Sentry incident', () => {
    expect(isTransientD1Error(new Error(
      'D1_ERROR: Your account is generating too much load on D1 DBs. Please back off and try again later.',
    ))).toBe(true);
  });

  it('does not match an unrelated D1 error (real bug — should still page Sentry)', () => {
    expect(isTransientD1Error(new Error('D1_ERROR: NOT NULL constraint failed: users.email'))).toBe(false);
  });

  it('does not match a non-Error value', () => {
    expect(isTransientD1Error('some string')).toBe(false);
    expect(isTransientD1Error(null)).toBe(false);
    expect(isTransientD1Error(undefined)).toBe(false);
  });
});
