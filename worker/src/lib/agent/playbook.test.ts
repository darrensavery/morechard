import { describe, it, expect } from 'vitest';
import { computeContentHash, getPlaybookBundle, PLAYBOOK_BUNDLE_KEY, PLAYBOOK_HASH_KEY } from './playbook.js';

describe('computeContentHash', () => {
  it('produces a 64-char hex hash', async () => {
    const hash = await computeContentHash('# hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    expect(await computeContentHash('same content')).toBe(await computeContentHash('same content'));
  });

  it('differs when content differs', async () => {
    expect(await computeContentHash('a')).not.toBe(await computeContentHash('b'));
  });
});

describe('getPlaybookBundle', () => {
  it('returns null when the KV bundle has not been seeded yet', async () => {
    const fakeCache = { get: async () => null } as unknown as KVNamespace;
    const result = await getPlaybookBundle({ CACHE: fakeCache } as never);
    expect(result).toBeNull();
  });

  it('returns the bundle when both content and hash are present in KV', async () => {
    const store: Record<string, string> = {
      [PLAYBOOK_BUNDLE_KEY]: '# playbook content',
      [PLAYBOOK_HASH_KEY]: 'abc123',
    };
    const fakeCache = { get: async (key: string) => store[key] ?? null } as unknown as KVNamespace;
    const result = await getPlaybookBundle({ CACHE: fakeCache } as never);
    expect(result).toEqual({ content: '# playbook content', hash: 'abc123' });
  });
});
