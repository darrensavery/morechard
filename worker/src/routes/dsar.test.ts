// worker/src/routes/dsar.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDsarRequest, handleDsarVerify } from './dsar.js';
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

// ── handleDsarVerify ─────────────────────────────────────────────────────
// Mock D1 matched by SQL substring, same pattern as auth.test.ts /
// dsarExecution.test.ts. `run()` calls are recorded with their SQL text +
// bind args (via a `toString()` fallback isn't needed here since we record
// the raw sql string directly) so assertions can inspect exactly which
// UPDATE statements fired and with what id — a mock missing this recording
// would make the assertions vacuous, as happened previously in this file's
// history.
interface DsarRow {
  id: string;
  request_type: 'access' | 'erasure';
  scope: 'family' | 'child';
  target_family_id: string;
  target_child_name_raw: string | null;
  requester_email: string;
  matched_user_id: string;
}

function makeMockVerifyDb(
  dsarRow: DsarRow,
  opts: {
    claimChanges?: number;
    roleRow?: { parent_role: string | null } | null;
    otherParentsCnt?: number;
    coparentRow?: { user_id: string } | null;
    batchThrows?: boolean;
    childMatches?: Array<{ id: string }>;
  } = {},
) {
  const runCalls: Array<{ sql: string; args: unknown[] }> = [];
  const batchCalls: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      const statement = (args: unknown[]) => ({
        async first<T>() {
          if (sql.includes('SELECT id, request_type')) return dsarRow as T;
          if (sql.includes("parent_role = 'co_parent'")) return (opts.coparentRow ?? null) as T;
          if (sql.includes('SELECT parent_role FROM family_roles')) return (opts.roleRow ?? null) as T;
          if (sql.includes('COUNT(*) AS cnt')) return { cnt: opts.otherParentsCnt ?? 0 } as T;
          return null as T;
        },
        async all<T>() {
          if (sql.includes("fr.role = 'child'")) return { results: (opts.childMatches ?? []) as T[] };
          return { results: [] as T[] };
        },
        async run() {
          runCalls.push({ sql, args });
          if (sql.startsWith(`UPDATE dsar_requests SET status = 'processing'`)) {
            return { success: true, meta: { changes: opts.claimChanges ?? 1 } };
          }
          return { success: true, meta: {} };
        },
      });
      return {
        ...statement([]),
        bind(...args: unknown[]) {
          return statement(args);
        },
      };
    },
    async batch(statements: unknown[]) {
      batchCalls.push(statements);
      if (opts.batchThrows) throw new Error('D1 batch failed');
      return statements.map(() => ({ success: true, meta: {} }));
    },
    __runCalls: runCalls,
    __batchCalls: batchCalls,
  };
  return db as unknown as D1Database & {
    __runCalls: Array<{ sql: string; args: unknown[] }>;
    __batchCalls: unknown[][];
  };
}

describe('handleDsarVerify', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('family-scope lead-with-coparent erasure: when no co-parent is found, marks needs_clarification instead of completed', async () => {
    // executeFamilyErasureLeadWithCoparent's internal lookup (parent_role =
    // 'co_parent') returns nothing here even though the coarser otherParents
    // count above it in executeErasure is 1 — the exact divergence the
    // Critical finding describes. Real dsarExecution.ts logic runs
    // unmocked; only the DB responses are faked.
    const dsarRow: DsarRow = {
      id: 'req-1',
      request_type: 'erasure',
      scope: 'family',
      target_family_id: 'fam-1',
      target_child_name_raw: null,
      requester_email: 'lead@example.com',
      matched_user_id: 'lead-1',
    };
    const db = makeMockVerifyDb(dsarRow, {
      roleRow: { parent_role: 'lead' },
      otherParentsCnt: 1,
      coparentRow: null,
    });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    await handleDsarVerify(req, env);

    const needsClarification = db.__runCalls.find(
      c => c.sql.includes("status = 'needs_clarification'") && c.args.includes('req-1'),
    );
    expect(needsClarification).toBeTruthy();

    const completed = db.__runCalls.find(c => c.sql.includes("status = 'completed'"));
    expect(completed).toBeUndefined();
  });

  it('marks the request needs_clarification (not stuck on processing) when execution throws', async () => {
    const dsarRow: DsarRow = {
      id: 'req-2',
      request_type: 'erasure',
      scope: 'family',
      target_family_id: 'fam-1',
      target_child_name_raw: null,
      requester_email: 'solo@example.com',
      matched_user_id: 'solo-1',
    };
    // Sole-parent path (otherParentsCnt: 0) reaches env.DB.batch(), which is
    // made to throw here to simulate a D1/Resend/R2 failure inside the try.
    const db = makeMockVerifyDb(dsarRow, { otherParentsCnt: 0, batchThrows: true });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    const res = await handleDsarVerify(req, env);

    expect(res.status).toBe(400);
    const needsClarification = db.__runCalls.find(
      c => c.sql.includes("status = 'needs_clarification'") && c.args.includes('req-2'),
    );
    expect(needsClarification).toBeTruthy();
  });

  it('returns a no-op response and executes nothing when the atomic claim affects 0 rows (already used / expired / race loser)', async () => {
    const dsarRow: DsarRow = {
      id: 'req-race',
      request_type: 'erasure',
      scope: 'family',
      target_family_id: 'fam-1',
      target_child_name_raw: null,
      requester_email: 'racer@example.com',
      matched_user_id: 'user-1',
    };
    const db = makeMockVerifyDb(dsarRow, { claimChanges: 0 });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    const res = await handleDsarVerify(req, env);

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('already been used or has expired');
    // Proves execution never ran: no erasure batch (family/user anonymisation)
    // and no follow-up status transition beyond the claim attempt itself.
    expect(db.__batchCalls.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(db.__runCalls.some(c => c.sql.includes("status = 'completed'"))).toBe(false);
    expect(db.__runCalls.some(c => c.sql.includes("status = 'needs_clarification'"))).toBe(false);
  });

  it('erasure, family scope, sole parent: completes and runs the sole-parent erasure batch', async () => {
    const dsarRow: DsarRow = {
      id: 'req-sole',
      request_type: 'erasure',
      scope: 'family',
      target_family_id: 'fam-1',
      target_child_name_raw: null,
      requester_email: 'sole@example.com',
      matched_user_id: 'sole-1',
    };
    const db = makeMockVerifyDb(dsarRow, { otherParentsCnt: 0 });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    const res = await handleDsarVerify(req, env);

    expect(res.status).toBe(200);
    expect(db.__batchCalls.length).toBe(1); // executeFamilyErasureSoleParent's single batch
    const completed = db.__runCalls.find(
      c => c.sql.includes("status = 'completed'") && c.args.includes('req-sole'),
    );
    expect(completed).toBeTruthy();
  });

  it('erasure, child scope, ambiguous name match: sets needs_clarification and does not erase', async () => {
    const dsarRow: DsarRow = {
      id: 'req-child',
      request_type: 'erasure',
      scope: 'child',
      target_family_id: 'fam-1',
      target_child_name_raw: 'Ben',
      requester_email: 'parent@example.com',
      matched_user_id: 'parent-1',
    };
    const db = makeMockVerifyDb(dsarRow, { childMatches: [{ id: 'c1' }, { id: 'c2' }] });
    const env = { DB: db, RESEND_API_KEY: 'k', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    const res = await handleDsarVerify(req, env);

    expect(res.status).toBe(200);
    const needsClarification = db.__runCalls.find(
      c => c.sql.includes("status = 'needs_clarification'") && c.args.includes('req-child'),
    );
    expect(needsClarification).toBeTruthy();
    expect(db.__runCalls.some(c => c.sql.includes("status = 'completed'"))).toBe(false);
    expect(db.__batchCalls.length).toBe(0); // no erasure batch ever ran
    expect(fetch).toHaveBeenCalledTimes(1); // clarification email only
  });

  it('access request: generates export, stores it in R2, and emails a signed download link', async () => {
    const dsarRow: DsarRow = {
      id: 'req-access',
      request_type: 'access',
      scope: 'family',
      target_family_id: 'fam-1',
      target_child_name_raw: null,
      requester_email: 'parent@example.com',
      matched_user_id: 'parent-1',
    };
    const db = makeMockVerifyDb(dsarRow);
    const put = vi.fn(async () => undefined);
    const createSignedUrl = vi.fn(async () => 'https://r2.example.com/signed');
    const env = {
      DB: db,
      RESEND_API_KEY: 'k',
      APP_URL: 'https://app.morechard.com',
      DSAR_EXPORTS: { put, createSignedUrl } as unknown as R2Bucket,
    } as unknown as Env;

    const req = new Request('https://internal/api/dsar/verify?token=sometoken');
    const res = await handleDsarVerify(req, env);

    expect(res.status).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      'dsar-exports/req-access.json',
      expect.any(String),
      { httpMetadata: { contentType: 'application/json' } },
    );
    expect(createSignedUrl).toHaveBeenCalledWith('dsar-exports/req-access.json', { expiresIn: 3600 });
    expect(fetch).toHaveBeenCalledTimes(1); // access-link email
    const completed = db.__runCalls.find(
      c => c.sql.includes("status = 'completed'") && c.args.includes('req-access'),
    );
    expect(completed).toBeTruthy();
  });
});
