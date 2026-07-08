import { describe, it, expect } from 'vitest';
import { validateImpulseOutcomeBody } from './child-nudges.js';

describe('validateImpulseOutcomeBody', () => {
  const valid = {
    family_id: 'fam1', child_id: 'child1',
    amount_pence: 500, balance_pence: 2000, outcome: 'waited' as const,
  };

  it('accepts a valid "waited" outcome', () => {
    expect(validateImpulseOutcomeBody(valid)).toBeNull();
  });

  it('accepts a valid "proceeded" outcome', () => {
    expect(validateImpulseOutcomeBody({ ...valid, outcome: 'proceeded' })).toBeNull();
  });

  it('rejects a missing family_id', () => {
    const { family_id, ...rest } = valid;
    expect(validateImpulseOutcomeBody(rest)).toBe('family_id required');
  });

  it('rejects a missing child_id', () => {
    const { child_id, ...rest } = valid;
    expect(validateImpulseOutcomeBody(rest)).toBe('child_id required');
  });

  it('rejects a zero amount_pence', () => {
    expect(validateImpulseOutcomeBody({ ...valid, amount_pence: 0 })).toBe(
      'amount_pence must be a positive integer',
    );
  });

  it('rejects a negative balance_pence', () => {
    expect(validateImpulseOutcomeBody({ ...valid, balance_pence: -1 })).toBe(
      'balance_pence must be a non-negative integer',
    );
  });

  it('rejects an outcome value outside the enum', () => {
    expect(validateImpulseOutcomeBody({ ...valid, outcome: 'maybe' })).toBe(
      'outcome must be "waited" or "proceeded"',
    );
  });
});
