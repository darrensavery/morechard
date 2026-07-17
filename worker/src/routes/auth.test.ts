import { describe, it, expect } from 'vitest';
import { handleChildLogin, handleDeleteFamily } from './auth.js';
import { hashPassword } from '../lib/crypto.js';
import type { Env } from '../types.js';
import type { JwtPayload } from '../lib/jwt.js';

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

function makeMockDeleteFamilyDb(opts: {
  callerRole: { parent_role: string | null } | null;
  otherParentsCount: number;
  coparentUserId?: string;
}) {
  const batchCalls: string[] = [];
  return {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('SELECT parent_role FROM family_roles')) return opts.callerRole as T;
              if (sql.includes('COUNT(*) AS cnt')) return { cnt: opts.otherParentsCount } as T;
              if (sql.includes("parent_role = 'co_parent'")) return (opts.coparentUserId ? { user_id: opts.coparentUserId } : null) as T;
              return null as T;
            },
            toString() {
              return sql;
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

function makeDeleteFamilyRequest(auth: JwtPayload): Request & { auth: JwtPayload } {
  const req = new Request('https://internal/auth/family', { method: 'DELETE' }) as Request & { auth: JwtPayload };
  req.auth = auth;
  return req;
}

describe('handleDeleteFamily', () => {
  it('rejects non-lead callers', async () => {
    const db = makeMockDeleteFamilyDb({ callerRole: { parent_role: 'co_parent' }, otherParentsCount: 1 });
    const env = { DB: db } as unknown as Env;
    const res = await handleDeleteFamily(makeDeleteFamilyRequest({ sub: 'u1', family_id: 'f1' } as JwtPayload), env);
    expect(res.status).toBe(403);
  });

  it('sole parent: soft-deletes the whole family', async () => {
    const db = makeMockDeleteFamilyDb({ callerRole: { parent_role: 'lead' }, otherParentsCount: 0 });
    const env = { DB: db } as unknown as Env;
    const res = await handleDeleteFamily(makeDeleteFamilyRequest({ sub: 'u1', family_id: 'f1' } as JwtPayload), env);
    expect(res.status).toBe(200);
    expect(db.__batchCalls.some(s => s.includes('UPDATE families SET deleted_at'))).toBe(true);
  });

  it('lead with a co-parent remaining: promotes co-parent, does not block', async () => {
    const db = makeMockDeleteFamilyDb({ callerRole: { parent_role: 'lead' }, otherParentsCount: 1, coparentUserId: 'coparent-1' });
    const env = { DB: db } as unknown as Env;
    const res = await handleDeleteFamily(makeDeleteFamilyRequest({ sub: 'lead-1', family_id: 'f1' } as JwtPayload), env);
    expect(res.status).toBe(200);
    const body = await res.json() as { action: string; promoted_user_id?: string };
    expect(body.action).toBe('lead_transferred');
    expect(body.promoted_user_id).toBe('coparent-1');
  });
});
