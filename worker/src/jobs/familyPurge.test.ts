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

  it('deletes child_badges and child_streaks via WHERE child_id IN (...), not family_id (0058_gamification.sql has no family_id column)', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s === 'DELETE FROM child_badges WHERE child_id IN (?)')).toBe(true);
    expect(calls.some(s => s === 'DELETE FROM child_streaks WHERE child_id IN (?)')).toBe(true);
    expect(calls.some(s => s.includes('child_badges') && s.includes('family_id'))).toBe(false);
    expect(calls.some(s => s.includes('child_streaks') && s.includes('family_id'))).toBe(false);
  });

  it('deletes analytics_consents via WHERE user_id IN (...), not family_id (0062_analytics_consent.sql has no family_id column)', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s === 'DELETE FROM analytics_consents WHERE user_id IN (?)')).toBe(true);
    expect(calls.some(s => s.includes('analytics_consents') && s.includes('family_id'))).toBe(false);
  });

  it('deletes referral_conversions via WHERE referred_family = ?, not family_id (0042_referral_system.sql has no family_id column)', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s === 'DELETE FROM referral_conversions WHERE referred_family = ?')).toBe(true);
    expect(calls.some(s => s.includes('referral_conversions') && s.includes('WHERE family_id'))).toBe(false);
  });

  it('deletes referral_clicks via a referral_code subquery, not family_id or user_id (referral_clicks has neither column)', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(
      calls.some(
        s =>
          s ===
          'DELETE FROM referral_clicks WHERE referral_code = (SELECT referral_code FROM families WHERE id = ?)',
      ),
    ).toBe(true);
  });

  it('never touches magic_link_attempts or slt_attempts (neither has a user_id column; not derivable from data in scope)', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    expect(calls.some(s => s.includes('magic_link_attempts'))).toBe(false);
    expect(calls.some(s => s.includes('slt_attempts'))).toBe(false);
  });

  it('produces exactly the expected statement list for one family with one child, with no statement referencing a column that table does not have', async () => {
    const db = makeSoftDeleteMockDb([{ id: 'family-1' }], [{ id: 'child-1' }]);
    const env = { DB: db } as unknown as Env;
    await runSoftDeletePurge(env, 1_800_000_000);
    const calls = (db as unknown as { __batchCalls: string[] }).__batchCalls;

    // Tables verified against their latest CREATE TABLE in worker/migrations/*.sql
    // to have a genuine `family_id` column.
    const familyKeyedTables = [
      'chores',
      'goals',
      'completions',
      'bonus_payments',
      'insight_snapshots',
      'child_logins',
      'child_nudges',
      'family_roles',
      'push_subscriptions',
      'parent_messages',
      'payouts',
      'jar_config',
      'jar_movements',
      'give_requests',
      'plans',
      'shared_expenses',
      'spending',
      'payday_log',
      'review_feedback',
      'review_prompt_state',
      'family_governance_log',
    ];
    // Tables verified to have a genuine `child_id` column (and no usable family_id).
    const childKeyedTables = [
      'chat_history',
      'unlocked_modules',
      'lesson_completions',
      'module_act_progress',
      'chat_rate_limits',
      'child_badges',
      'child_streaks',
    ];
    // Tables verified to have a genuine `user_id` column (and no usable family_id/child_id).
    const userKeyedTables = [
      'user_settings',
      'account_locks',
      'sessions',
      'magic_link_tokens',
      'email_verify_tokens',
      'upgrade_interest',
      'slt_tokens',
      'analytics_consents',
    ];

    const expected = [
      ...familyKeyedTables.map(t => `DELETE FROM ${t} WHERE family_id = ?`),
      'DELETE FROM referral_conversions WHERE referred_family = ?',
      'DELETE FROM referral_clicks WHERE referral_code = (SELECT referral_code FROM families WHERE id = ?)',
      ...childKeyedTables.map(t => `DELETE FROM ${t} WHERE child_id IN (?)`),
      ...userKeyedTables.map(t => `DELETE FROM ${t} WHERE user_id IN (?)`),
      'DELETE FROM users WHERE family_id = ?',
      'DELETE FROM ledger_status_log WHERE ledger_id IN (SELECT id FROM ledger WHERE family_id = ?)',
    ];

    for (const stmt of expected) {
      expect(calls).toContain(stmt);
    }
    // Exactly one extra statement: the tombstone UPDATE families ... (multi-line, checked separately).
    expect(calls.length).toBe(expected.length + 1);
    expect(calls.some(s => s.startsWith('UPDATE families SET'))).toBe(true);

    // Tables known NOT to have a family_id column must never be deleted via family_id.
    const noFamilyIdColumn = ['child_badges', 'child_streaks', 'analytics_consents', 'referral_conversions', 'referral_clicks'];
    for (const table of noFamilyIdColumn) {
      expect(calls.some(s => s.startsWith(`DELETE FROM ${table} WHERE family_id`))).toBe(false);
    }
    // Tables known NOT to have a user_id column must never be deleted via user_id.
    const noUserIdColumn = ['magic_link_attempts', 'slt_attempts', 'referral_clicks', 'referral_conversions'];
    for (const table of noUserIdColumn) {
      expect(calls.some(s => s.includes(table) && s.includes('user_id'))).toBe(false);
    }
  });
});
