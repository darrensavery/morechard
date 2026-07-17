// worker/src/jobs/familyPurge.test.ts
import { describe, it, expect } from 'vitest';
import { runChildDsarPurge, runSoftDeletePurge } from './familyPurge.js';
import type { Env } from '../types.js';

function makeSoftDeleteMockDb(families: Array<{ id: string }>, children: Array<{ id: string }>) {
  const batchCalls: string[] = [];
  return {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            toString() {
              return sql;
            },
            async all<T>() {
              if (sql.includes('FROM families')) return { results: families as T[] };
              if (sql.includes('FROM users WHERE family_id')) return { results: children as T[] };
              return { results: [] as T[] };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ toString(): string }>) {
      for (const s of statements) batchCalls.push(String(s));
      return statements.map(() => ({ success: true, meta: {} }));
    },
    __batchCalls: batchCalls,
  } as unknown as D1Database & { __batchCalls: string[] };
}

function makeMockDb(pendingChildren: Array<{ id: string }>) {
  const batchCalls: string[] = [];
  return {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            toString() {
              return sql;
            },
            async all<T>() {
              if (sql.includes('purge_pending_at')) return { results: pendingChildren as T[] };
              return { results: [] as T[] };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ toString(): string }>) {
      for (const s of statements) batchCalls.push(String(s));
      return statements.map(() => ({ success: true, meta: {} }));
    },
    __batchCalls: batchCalls,
  } as unknown as D1Database & { __batchCalls: string[] };
}

describe('runChildDsarPurge', () => {
  it('does nothing when no children are past the 30-day window', async () => {
    const db = makeMockDb([]);
    const env = { DB: db } as unknown as Env;
    await runChildDsarPurge(env, 1_800_000_000);
    expect((db as unknown as { __batchCalls: string[] }).__batchCalls.length).toBe(0);
  });

  it('hard-deletes bulk child-keyed tables and the users row, never the ledger', async () => {
    const db = makeMockDb([{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runChildDsarPurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;
    expect(calls.some(s => s.includes('chat_history'))).toBe(true);
    expect(calls.some(s => s.includes('DELETE FROM users WHERE id'))).toBe(true);
    expect(calls.some(s => s.toLowerCase().includes('ledger'))).toBe(false);
  });

  it('deletes user_settings and account_locks via WHERE user_id = ?, not child_id', async () => {
    const db = makeMockDb([{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runChildDsarPurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s === 'DELETE FROM user_settings WHERE user_id = ?')).toBe(true);
    expect(calls.some(s => s === 'DELETE FROM account_locks WHERE user_id = ?')).toBe(true);
    expect(calls.some(s => s.includes('user_settings') && s.includes('child_id'))).toBe(false);
    expect(calls.some(s => s.includes('account_locks') && s.includes('child_id'))).toBe(false);
  });
});

describe('runSoftDeletePurge', () => {
  it('deletes user_settings and account_locks via WHERE user_id IN (...), not child_id', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s === 'DELETE FROM user_settings WHERE user_id IN (?)')).toBe(true);
    expect(calls.some(s => s === 'DELETE FROM account_locks WHERE user_id IN (?)')).toBe(true);
    expect(calls.some(s => s.includes('user_settings') && s.includes('child_id'))).toBe(false);
    expect(calls.some(s => s.includes('account_locks') && s.includes('child_id'))).toBe(false);
  });
});
