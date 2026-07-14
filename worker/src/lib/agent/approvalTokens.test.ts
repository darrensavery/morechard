import { describe, it, expect } from 'vitest';
import { hashApprovalToken, APPROVAL_TOKEN_TTL_SECONDS } from './approvalTokens.js';

describe('hashApprovalToken', () => {
  it('produces a deterministic 64-char hex hash', async () => {
    const hash = await hashApprovalToken('raw-token-abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash for the same input', async () => {
    expect(await hashApprovalToken('same')).toBe(await hashApprovalToken('same'));
  });

  it('produces a different hash for different input', async () => {
    expect(await hashApprovalToken('a')).not.toBe(await hashApprovalToken('b'));
  });
});

describe('APPROVAL_TOKEN_TTL_SECONDS', () => {
  it('is 48 hours', () => {
    expect(APPROVAL_TOKEN_TTL_SECONDS).toBe(48 * 60 * 60);
  });
});
