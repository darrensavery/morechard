import { describe, it, expect } from 'vitest';
import {
  resolveChildByName,
  executeFamilyErasureSoleParent,
  executeFamilyErasureLeadWithCoparent,
  executeChildErasure,
} from './dsarExecution.js';
import type { Env } from '../types.js';
import { verifyChain } from './hash.js';

function makeMockDb(opts: {
  firstBySubstring?: Array<{ match: string; value: unknown }>;
  allBySubstring?: Array<{ match: string; value: unknown[] }>;
} = {}) {
  const batchCalls: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            async first<T>() {
              const hit = (opts.firstBySubstring ?? []).find(f => sql.includes(f.match));
              return (hit?.value ?? null) as T;
            },
            async all<T>() {
              const hit = (opts.allBySubstring ?? []).find(f => sql.includes(f.match));
              return { results: (hit?.value ?? []) as T[] };
            },
            async run() { return { success: true, meta: {} }; },
            // Carry the SQL text through so batch() can record it for
            // content/ordering assertions — the default Object.toString()
            // would otherwise collapse every statement to "[object Object]".
            toString() { return sql; },
          };
        },
      };
    },
    async batch(statements: Array<{ sql?: string }>) {
      // Record the SQL text of each statement in call order for ordering assertions.
      for (const s of statements as unknown as { toString(): string }[]) {
        batchCalls.push(String(s));
      }
      return statements.map(() => ({ success: true, meta: {} }));
    },
    __batchCalls: batchCalls,
  };
  return db as unknown as D1Database & { __batchCalls: string[] };
}

describe('resolveChildByName', () => {
  it('returns "one" when exactly one child matches case-insensitively', async () => {
    const db = makeMockDb({ allBySubstring: [{ match: 'family_roles', value: [{ id: 'child-1' }] }] });
    const env = { DB: db } as unknown as Env;
    const result = await resolveChildByName(env, 'fam-1', '  Ben  ');
    expect(result).toEqual({ matched: 'one', childId: 'child-1' });
  });

  it('returns "none" when no child matches', async () => {
    const db = makeMockDb({ allBySubstring: [{ match: 'family_roles', value: [] }] });
    const env = { DB: db } as unknown as Env;
    const result = await resolveChildByName(env, 'fam-1', 'Nobody');
    expect(result).toEqual({ matched: 'none' });
  });

  it('returns "ambiguous" when more than one child matches', async () => {
    const db = makeMockDb({ allBySubstring: [{ match: 'family_roles', value: [{ id: 'c1' }, { id: 'c2' }] }] });
    const env = { DB: db } as unknown as Env;
    const result = await resolveChildByName(env, 'fam-1', 'Ben');
    expect(result).toEqual({ matched: 'ambiguous' });
  });
});

describe('executeFamilyErasureSoleParent', () => {
  it('batches family soft-delete + PII null + session revoke + invite/registration cleanup', async () => {
    const db = makeMockDb();
    const env = { DB: db } as unknown as Env;
    await executeFamilyErasureSoleParent(env, 'fam-1');
    expect(db.__batchCalls.length).toBe(5);
    expect(db.__batchCalls.some(s => s.includes('UPDATE families SET deleted_at'))).toBe(true);
    expect(db.__batchCalls.some(s => s.includes("display_name = 'Deleted User'"))).toBe(true);
  });
});

describe('executeFamilyErasureLeadWithCoparent', () => {
  it('promotes the co-parent to lead before anonymising the departing lead', async () => {
    const db = makeMockDb({
      firstBySubstring: [{ match: "parent_role = 'co_parent'", value: { user_id: 'coparent-1' } }],
    });
    const env = { DB: db } as unknown as Env;
    const result = await executeFamilyErasureLeadWithCoparent(env, 'fam-1', 'lead-1');
    expect(result).toEqual({ promotedUserId: 'coparent-1' });
    const promoteIdx = db.__batchCalls.findIndex(s => s.includes("parent_role = 'lead'") && s.includes('family_roles'));
    const nullIdx = db.__batchCalls.findIndex(s => s.includes("display_name = 'Deleted User'"));
    expect(promoteIdx).toBeGreaterThanOrEqual(0);
    expect(nullIdx).toBeGreaterThan(promoteIdx);
  });

  it('returns an error when no co-parent can be found', async () => {
    const db = makeMockDb({ firstBySubstring: [{ match: "parent_role = 'co_parent'", value: null }] });
    const env = { DB: db } as unknown as Env;
    const result = await executeFamilyErasureLeadWithCoparent(env, 'fam-1', 'lead-1');
    expect(result).toEqual({ error: 'No co-parent found to promote' });
  });
});

describe('executeChildErasure', () => {
  it('only touches the users row — never the ledger', async () => {
    const db = makeMockDb();
    const env = { DB: db } as unknown as Env;
    await executeChildErasure(env, 'child-1');
    expect(db.__batchCalls.length).toBe(1);
    expect(db.__batchCalls[0]).toContain("display_name = 'Deleted Child'");
    expect(db.__batchCalls[0]).toContain('purge_pending_at');
    expect(db.__batchCalls.some(s => s.toLowerCase().includes('ledger'))).toBe(false);
  });
});

describe('ledger integrity across erasure paths', () => {
  it('a chain that verifies before erasure still verifies after (no ledger writes occur)', async () => {
    const entries = [
      { id: 1, family_id: 'fam-1', child_id: 'child-1', amount: 500, currency: 'GBP', entry_type: 'chore_reward', previous_hash: '0'.repeat(64), record_hash: '' },
    ];
    // Compute a real hash for row 1 so the chain is valid before we assert nothing changes it.
    const { computeRecordHash } = await import('./hash.js');
    entries[0].record_hash = await computeRecordHash(1, 'fam-1', 'child-1', 500, 'GBP', 'chore_reward', '0'.repeat(64));

    const before = await verifyChain(entries);
    expect(before.valid).toBe(true);

    // Run a child erasure against a mock DB that would throw if any statement
    // touched a table with "ledger" in its name.
    const db = {
      prepare(sql: string) {
        if (sql.toLowerCase().includes('ledger')) throw new Error('erasure must never touch the ledger');
        return { bind: () => ({ run: async () => ({ success: true, meta: {} }) }) };
      },
      async batch(statements: unknown[]) { return statements.map(() => ({ success: true, meta: {} })); },
    } as unknown as D1Database;
    await executeChildErasure({ DB: db } as unknown as Env, 'child-1');

    // Chain is untouched — same entries still verify.
    const after = await verifyChain(entries);
    expect(after.valid).toBe(true);
  });
});
