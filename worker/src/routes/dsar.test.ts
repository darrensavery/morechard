// worker/src/routes/dsar.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDsarRequest } from './dsar.js';
import type { Env } from '../types.js';

function makeMockDb(matchedParent: { user_id: string; family_id: string } | null) {
  const inserted: Array<Record<string, unknown>> = [];
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM users u JOIN family_roles')) return matchedParent as T;
              return null as T;
            },
            async run() {
              if (sql.startsWith('INSERT INTO dsar_requests')) inserted.push({ args });
              return { success: true, meta: {} };
            },
          };
        },
      };
    },
    __inserted: inserted,
  } as unknown as D1Database & { __inserted: unknown[] };
}

describe('handleDsarRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('returns the generic response and creates no row for an unmatched email', async () => {
    const db = makeMockDb(null);
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const req = new Request('https://internal/api/dsar/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@example.com', request_type: 'erasure', scope: 'family' }),
    });
    const res = await handleDsarRequest(req, env);
    expect(res.status).toBe(200);
    expect(db.__inserted.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('creates a row and sends a verification email for a matched parent email', async () => {
    const db = makeMockDb({ user_id: 'parent-1', family_id: 'fam-1' });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const req = new Request('https://internal/api/dsar/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'parent@example.com', request_type: 'erasure', scope: 'family' }),
    });
    const res = await handleDsarRequest(req, env);
    expect(res.status).toBe(200);
    expect(db.__inserted.length).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a child-scope request with no child_name', async () => {
    const db = makeMockDb({ user_id: 'parent-1', family_id: 'fam-1' });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const req = new Request('https://internal/api/dsar/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'parent@example.com', request_type: 'erasure', scope: 'child' }),
    });
    const res = await handleDsarRequest(req, env);
    expect(res.status).toBe(400);
  });
});
