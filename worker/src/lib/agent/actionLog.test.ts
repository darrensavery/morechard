import { describe, it, expect } from 'vitest';
import { computeActionLogHash } from './actionLog.js';
import { GENESIS_HASH } from '../hash.js';

describe('computeActionLogHash', () => {
  it('produces a deterministic 64-char hex hash', async () => {
    const hash = await computeActionLogHash({
      id: 1,
      incidentId: 'inc_abc',
      actor: 'agent',
      toolName: 'get_family_license_state',
      tier: 'read',
      payload: '{"familyId":"fam_1"}',
      previousHash: GENESIS_HASH,
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash for the same inputs', async () => {
    const input = {
      id: 1, incidentId: 'inc_abc', actor: 'agent', toolName: 'x',
      tier: 'read' as const, payload: '{}', previousHash: GENESIS_HASH,
    };
    expect(await computeActionLogHash(input)).toBe(await computeActionLogHash(input));
  });

  it('produces a different hash when the payload changes', async () => {
    const base = {
      id: 1, incidentId: 'inc_abc', actor: 'agent', toolName: 'x',
      tier: 'read' as const, previousHash: GENESIS_HASH,
    };
    const hashA = await computeActionLogHash({ ...base, payload: '{"a":1}' });
    const hashB = await computeActionLogHash({ ...base, payload: '{"a":2}' });
    expect(hashA).not.toBe(hashB);
  });

  it('produces a different hash when previousHash changes (chaining)', async () => {
    const base = {
      id: 2, incidentId: 'inc_abc', actor: 'agent', toolName: 'x',
      tier: 'read' as const, payload: '{}',
    };
    const hashA = await computeActionLogHash({ ...base, previousHash: GENESIS_HASH });
    const hashB = await computeActionLogHash({ ...base, previousHash: 'a'.repeat(64) });
    expect(hashA).not.toBe(hashB);
  });
});
