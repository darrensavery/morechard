import { describe, it, expect, vi } from 'vitest';
import { handleFamilyRelocate } from './settings.js';
import type { Env } from '../types.js';

function makeRelocateEnv(opts: {
  parentRole: 'lead' | 'co_parent' | null;
  baseCurrency: string;
  ledgerRows?: Array<{ id: number; family_id: string; record_hash: string }>;
}) {
  const ledgerRows = opts.ledgerRows ?? [];
  const familiesUpdated: Array<{ currency: string; base_currency: string; id: string }> = [];
  const batchCalls: unknown[][] = [];

  const DB = {
    prepare(sql: string) {
      // resolveFirst backs both call shapes production code uses: a parameterised
      // query via `.bind(args).first()`, and a bind-less `.first()` directly on
      // `.prepare()` — real D1 allows .first()/.run() with no .bind() when a query
      // has no placeholders, and prepareSystemNoteInsert's `SELECT MAX(id) FROM
      // ledger` relies on exactly that (no `?` in the SQL, so no bind is ever
      // called on it in production).
      const resolveFirst = async <T>(args: unknown[]): Promise<T> => {
        if (sql.includes('FROM family_roles')) {
          return (opts.parentRole ? { parent_role: opts.parentRole } : null) as unknown as T;
        }
        if (sql.includes('SELECT base_currency FROM families')) {
          return { base_currency: opts.baseCurrency } as unknown as T;
        }
        if (sql.includes('MAX(id) AS max_id')) {
          const maxId = ledgerRows.length ? Math.max(...ledgerRows.map(r => r.id)) : null;
          return { max_id: maxId } as unknown as T;
        }
        if (sql.includes('SELECT record_hash FROM ledger')) {
          const [familyId] = args as [string];
          const tip = ledgerRows.filter(r => r.family_id === familyId).sort((a, b) => b.id - a.id)[0];
          return (tip ? { record_hash: tip.record_hash } : null) as unknown as T;
        }
        return null as unknown as T;
      };
      return {
        first: <T>() => resolveFirst<T>([]),
        bind(...args: unknown[]) {
          return {
            first: <T>() => resolveFirst<T>(args),
            async run() {
              if (sql.includes('UPDATE families SET currency')) {
                const [currency, baseCurrency, id] = args as [string, string, string];
                familiesUpdated.push({ currency, base_currency: baseCurrency, id });
              }
              return { success: true };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      batchCalls.push(statements);
      for (const s of statements) await s.run();
      return [];
    },
  };

  const CACHE = { delete: vi.fn(async () => undefined), get: vi.fn(async () => null), put: vi.fn(async () => undefined) };

  return { env: { DB, CACHE } as unknown as Env, familiesUpdated, batchCalls };
}

describe('handleFamilyRelocate', () => {
  it('rejects a co-parent (non-lead) with 403', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'co_parent', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'USD' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects a request to relocate to the currency already in use with 400', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'GBP' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/already using GBP/);
  });

  it('rejects an unsupported currency with 400', async () => {
    const { env } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', { method: 'POST', body: JSON.stringify({ new_currency: 'EUR' }) });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(400);
  });

  it('lead relocating to a new currency writes a system_note ledger entry and updates both currency columns in one atomic batch', async () => {
    const { env, familiesUpdated, batchCalls } = makeRelocateEnv({ parentRole: 'lead', baseCurrency: 'GBP' });
    const req = new Request('https://x/api/family/relocate', {
      method: 'POST',
      body: JSON.stringify({ new_currency: 'USD', note: 'Moved to Austin' }),
    });
    (req as unknown as { auth: unknown }).auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const res = await handleFamilyRelocate(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; new_currency: string };
    expect(body).toEqual({ ok: true, new_currency: 'USD' });

    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]).toHaveLength(2); // system_note insert + families update, same batch
    expect(familiesUpdated).toEqual([{ currency: 'USD', base_currency: 'USD', id: 'fam_1' }]);
    expect(env.CACHE.delete).toHaveBeenCalledWith('family:config:fam_1');
  });
});
