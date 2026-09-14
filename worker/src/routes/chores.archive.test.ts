import { describe, it, expect, vi } from 'vitest';
import { handleChoreArchive } from './chores.js';

function authedRequest(auth: Record<string, unknown>) {
  const req = new Request('https://x/api/chores/chore_1', { method: 'DELETE' });
  (req as any).auth = auth;
  return req;
}

function makeEnv(opts: {
  choreRow?: { family_id: string; is_seed: number } | null;
  hasHistory?: boolean;
}) {
  const first = vi.fn((sql: string) => {
    if (sql.includes('SELECT family_id, is_seed FROM chores')) {
      return Promise.resolve(opts.choreRow ?? null);
    }
    if (sql.includes('has_history')) {
      return Promise.resolve({ has_history: opts.hasHistory ? 1 : 0 });
    }
    return Promise.resolve(null);
  });

  const run = vi.fn().mockResolvedValue({ success: true });
  const batch = vi.fn().mockResolvedValue([{ success: true }, { success: true }, { success: true }]);

  const prepare = vi.fn((sql: string) => ({
    bind: (..._args: unknown[]) => ({ first: () => first(sql), run }),
  }));

  return { DB: { prepare, batch }, run, batch, prepare } as any;
}

describe('handleChoreArchive', () => {
  it('hard-deletes a chore with no completion/ledger history', async () => {
    const env = makeEnv({ choreRow: { family_id: 'fam_1', is_seed: 0 }, hasHistory: false });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const res = await handleChoreArchive(authedRequest(auth), env, 'chore_1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, deleted: true });
    expect(env.batch).toHaveBeenCalledTimes(1);
    // plans, then stale 'available' completions, then the chore row itself
    const batchedSql = (env.batch.mock.calls[0][0] as unknown[]).length;
    expect(batchedSql).toBe(3);
  });

  it('soft-archives a chore with completion/ledger history instead of deleting it', async () => {
    const env = makeEnv({ choreRow: { family_id: 'fam_1', is_seed: 0 }, hasHistory: true });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const res = await handleChoreArchive(authedRequest(auth), env, 'chore_1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, deleted: false });
    expect(env.batch).not.toHaveBeenCalled();
    expect(env.run).toHaveBeenCalled();
  });

  it('404s for a chore that does not exist', async () => {
    const env = makeEnv({ choreRow: null });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const res = await handleChoreArchive(authedRequest(auth), env, 'chore_1');
    expect(res.status).toBe(404);
  });

  it('403s when the chore belongs to a different family', async () => {
    const env = makeEnv({ choreRow: { family_id: 'fam_other', is_seed: 0 } });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const res = await handleChoreArchive(authedRequest(auth), env, 'chore_1');
    expect(res.status).toBe(403);
  });

  it('403s for a seed chore in the demo family', async () => {
    const env = makeEnv({ choreRow: { family_id: 'fam_1', is_seed: 1 } });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const res = await handleChoreArchive(authedRequest(auth), env, 'chore_1');
    expect(res.status).toBe(403);
  });
});
