import { describe, it, expect } from 'vitest';
import { handleChildLogin } from './auth.js';
import { hashPassword } from '../lib/crypto.js';
import type { Env } from '../types.js';

// ── Minimal in-memory D1 stand-in ────────────────────────────────────────────
// This codebase has no shared D1 test-fixture/pool-workers harness (checked
// src/routes/*.test.ts and src/lib/*.test.ts — all test pure/extracted logic,
// none stub a D1Database). handleChildLogin needs a DB, so we fake just the
// handful of statements it issues, matched by a substring of the SQL text.
function makeMockDb(childRow: Record<string, unknown> | null) {
  const run = async () => ({ success: true, meta: {} }) as unknown;
  return {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM users u') && sql.includes('family_roles')) return childRow as T;
              if (sql.includes('FROM user_settings')) return null as T;
              if (sql.includes('FROM child_logins')) return null as T;
              return null as T;
            },
            run,
          };
        },
      };
    },
    async batch(_statements: unknown[]) {
      return [];
    },
  } as unknown as D1Database;
}

describe('handleChildLogin cookie issuance', () => {
  it('sets both mc_token (HttpOnly) and mc_session (role) cookies on success', async () => {
    const pinHash = await hashPassword('1234');
    const db = makeMockDb({
      id: 'child1',
      pin_hash: pinHash,
      pin_attempt_count: 0,
      pin_locked_until: null,
      pin_lockout_tier: 0,
    });
    const testEnv = { DB: db, JWT_SECRET: 'test-secret' } as unknown as Env;

    const request = new Request('https://api.morechard.com/auth/child/login', {
      method: 'POST',
      body: JSON.stringify({ family_id: 'fam1', child_id: 'child1', pin: '1234' }),
    });
    const res = await handleChildLogin(request, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; expires_in: number };
    expect(typeof body.token).toBe('string');

    const setCookies = (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(setCookies.some(c => c.startsWith('mc_token=') && c.includes('HttpOnly'))).toBe(true);
    expect(setCookies.some(c => c.startsWith('mc_session=child') && !c.includes('HttpOnly'))).toBe(true);
  });
});
