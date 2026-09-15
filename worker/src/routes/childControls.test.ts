import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  handleChildControlsGet,
  handleChildAllowancePauseUpdate,
  handleChildGovernanceRequest,
  handleChildGovernanceConfirm,
  handleChildGovernanceReject,
} from './childControls.js';

function authedRequest(url: string, auth: Record<string, unknown>, body?: unknown, method = 'POST') {
  const req = new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  (req as any).auth = auth;
  return req;
}

interface ChildRow {
  id: string; family_id: string;
  verify_mode_override: string | null;
  allowance_paused: number;
  overdraft_enabled_override: number | null;
  overdraft_limit_pence_override: number | null;
}

interface GovRow {
  id: number; family_id: string; child_id: string; requested_by: string;
  confirmed_by: string | null; setting: string; old_value: string; new_value: string;
  status: string; requested_at: number; expires_at: number; confirmed_at: number | null;
}

function makeEnv(opts: {
  child?: Partial<ChildRow>;
  otherParents?: string[]; // ids of other parents in the family (besides requester)
  familyVerifyMode?: string;
  familyOverdraftEnabled?: number;
  familyOverdraftLimitPence?: number;
  existingPending?: GovRow;
} = {}) {
  const child: ChildRow = {
    id: 'child_1', family_id: 'fam_1',
    verify_mode_override: null, allowance_paused: 0,
    overdraft_enabled_override: null, overdraft_limit_pence_override: null,
    ...opts.child,
  };
  const govRows: GovRow[] = opts.existingPending ? [opts.existingPending] : [];
  let nextGovId = (opts.existingPending?.id ?? 0) + 1;

  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        if (sql.includes('FROM users u JOIN family_roles fr') && sql.includes("fr.role = 'child'")) {
          return child.id === args[0] ? { ...child } : null;
        }
        if (sql.includes("role = 'parent' AND user_id != ?")) {
          return (opts.otherParents && opts.otherParents.length > 0) ? { 1: 1 } : null;
        }
        if (sql.includes('SELECT verify_mode, overdraft_enabled, overdraft_limit_pence FROM families')) {
          return {
            verify_mode: opts.familyVerifyMode ?? 'standard',
            overdraft_enabled: opts.familyOverdraftEnabled ?? 0,
            overdraft_limit_pence: opts.familyOverdraftLimitPence ?? 0,
          };
        }
        if (sql.includes("SELECT id FROM child_governance_log WHERE child_id = ? AND setting = ? AND status = 'pending'")) {
          const found = govRows.find(r => r.child_id === args[0] && r.setting === args[1] && r.status === 'pending');
          return found ? { id: found.id } : null;
        }
        if (sql.includes('FROM child_governance_log WHERE id = ?')) {
          return govRows.find(r => r.id === Number(args[0])) ?? null;
        }
        if (sql.includes('SELECT id FROM child_governance_log WHERE child_id = ? AND status')) {
          const found = govRows.find(r => r.child_id === args[0] && r.status === 'pending');
          return found ? { id: found.id } : null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes('FROM child_governance_log WHERE child_id')) {
          return { results: govRows.filter(r => r.child_id === args[0]) };
        }
        return { results: [] };
      },
      run: async () => {
        if (sql.includes('UPDATE users SET')) {
          if (sql.includes('verify_mode_override')) child.verify_mode_override = args[0] as string | null;
          if (sql.includes('allowance_paused')) child.allowance_paused = args[0] as number;
          if (sql.includes('overdraft_enabled_override = NULL')) {
            child.overdraft_enabled_override = null;
            child.overdraft_limit_pence_override = null;
          } else if (sql.includes('overdraft_enabled_override = ?')) {
            child.overdraft_enabled_override = args[0] as number;
            child.overdraft_limit_pence_override = args[1] as number;
          }
          return { success: true };
        }
        if (sql.includes('INSERT INTO child_governance_log') && sql.includes("'pending'")) {
          const [family_id, child_id, requested_by, setting, old_value, new_value, requested_at, expires_at] = args as [
            string, string, string, string, string, string, number, number,
          ];
          const row: GovRow = {
            id: nextGovId++, family_id, child_id, requested_by, confirmed_by: null,
            setting, old_value, new_value, status: 'pending', requested_at, expires_at, confirmed_at: null,
          };
          govRows.push(row);
          return { success: true, meta: { last_row_id: row.id } };
        }
        if (sql.includes('INSERT INTO child_governance_log') && sql.includes("'confirmed'")) {
          const [family_id, child_id, requested_by, confirmed_by, setting, old_value, new_value, requested_at, expires_at, confirmed_at] = args as [
            string, string, string, string, string, string, string, number, number, number,
          ];
          const row: GovRow = {
            id: nextGovId++, family_id, child_id, requested_by, confirmed_by,
            setting, old_value, new_value, status: 'confirmed', requested_at, expires_at, confirmed_at,
          };
          govRows.push(row);
          return { success: true, meta: { last_row_id: row.id } };
        }
        if (sql.includes("UPDATE child_governance_log SET status = 'confirmed'")) {
          const [confirmed_by, confirmed_at, , id] = args as [string, number, string, string];
          const row = govRows.find(r => r.id === Number(id));
          if (row) { row.status = 'confirmed'; row.confirmed_by = confirmed_by; row.confirmed_at = confirmed_at; }
          return { success: true };
        }
        if (sql.includes("UPDATE child_governance_log SET status = 'rejected'")) {
          const [rejected_by, confirmed_at, , id] = args as [string, number, string, string];
          const row = govRows.find(r => r.id === Number(id));
          if (row) { row.status = 'rejected'; row.confirmed_by = rejected_by; row.confirmed_at = confirmed_at; }
          return { success: true };
        }
        return { success: true };
      },
    }),
  }));

  const batch = vi.fn(async (stmts: unknown[]) => {
    // Each queued statement is itself the { bind, run } chain result — replay in order.
    for (const s of stmts as any[]) await s.run();
    return [];
  });

  const CACHE = { get: vi.fn(async () => null), put: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };

  return { env: { DB: { prepare, batch }, CACHE } as any, child, govRows };
}

afterEach(() => vi.restoreAllMocks());

// ── handleChildGovernanceRequest ──────────────────────────────────────────────

describe('handleChildGovernanceRequest — solo parent', () => {
  it('applies the change immediately and self-confirms the log entry', async () => {
    const { env, child, govRows } = makeEnv({ otherParents: [] });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/request', auth, {
      child_id: 'child_1', setting: 'verify_mode', new_value: 'amicable',
    });

    const res = await handleChildGovernanceRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('confirmed');
    expect(child.verify_mode_override).toBe('amicable');
    expect(govRows).toHaveLength(1);
    expect(govRows[0].status).toBe('confirmed');
    expect(govRows[0].requested_by).toBe('parent_1');
    expect(govRows[0].confirmed_by).toBe('parent_1');
  });
});

describe('handleChildGovernanceRequest — co-parenting family', () => {
  it('creates a pending request instead of applying immediately', async () => {
    const { env, child, govRows } = makeEnv({ otherParents: ['parent_2'] });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/request', auth, {
      child_id: 'child_1', setting: 'verify_mode', new_value: 'amicable',
    });

    const res = await handleChildGovernanceRequest(req, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { governance_request_id: number };
    expect(body.governance_request_id).toBeDefined();
    // Not applied yet — still the pre-change value.
    expect(child.verify_mode_override).toBeNull();
    expect(govRows).toHaveLength(1);
    expect(govRows[0].status).toBe('pending');
  });

  it('rejects a second request while one is already pending for the same setting', async () => {
    const { env } = makeEnv({
      otherParents: ['parent_2'],
      existingPending: {
        id: 1, family_id: 'fam_1', child_id: 'child_1', requested_by: 'parent_1', confirmed_by: null,
        setting: 'verify_mode', old_value: 'inherit', new_value: 'standard',
        status: 'pending', requested_at: 0, expires_at: 999999999999, confirmed_at: null,
      },
    });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/request', auth, {
      child_id: 'child_1', setting: 'verify_mode', new_value: 'amicable',
    });

    const res = await handleChildGovernanceRequest(req, env);
    expect(res.status).toBe(409);
  });

  it('rejects a request that matches the current value', async () => {
    const { env } = makeEnv({ otherParents: ['parent_2'], child: { verify_mode_override: 'amicable' } });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/request', auth, {
      child_id: 'child_1', setting: 'verify_mode', new_value: 'amicable',
    });

    const res = await handleChildGovernanceRequest(req, env);
    expect(res.status).toBe(400);
  });
});

// ── handleChildGovernanceConfirm / reject ─────────────────────────────────────

describe('handleChildGovernanceConfirm', () => {
  const pending: GovRow = {
    id: 5, family_id: 'fam_1', child_id: 'child_1', requested_by: 'parent_1', confirmed_by: null,
    setting: 'overdraft', old_value: 'inherit', new_value: JSON.stringify({ enabled: true, limit_pence: 5000 }),
    status: 'pending', requested_at: 0, expires_at: Math.floor(Date.now() / 1000) + 3600, confirmed_at: null,
  };

  it('rejects a child-role JWT confirming a pending request', async () => {
    const { env, child } = makeEnv({ otherParents: ['parent_2'], existingPending: { ...pending } });
    const auth = { sub: 'child_1', family_id: 'fam_1', role: 'child' };
    const req = authedRequest('https://x/api/child-governance/5/confirm', auth, undefined);

    const res = await handleChildGovernanceConfirm(req, env, '5');
    expect(res.status).toBe(403);
    expect(child.overdraft_enabled_override).toBeNull();
  });

  it('rejects the requesting parent confirming their own request', async () => {
    const { env } = makeEnv({ otherParents: ['parent_2'], existingPending: pending });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/5/confirm', auth, undefined);

    const res = await handleChildGovernanceConfirm(req, env, '5');
    expect(res.status).toBe(400);
  });

  it('applies the overdraft override when the other parent confirms', async () => {
    const { env, child } = makeEnv({ otherParents: ['parent_2'], existingPending: { ...pending } });
    const auth = { sub: 'parent_2', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/5/confirm', auth, undefined);

    const res = await handleChildGovernanceConfirm(req, env, '5');
    expect(res.status).toBe(200);
    expect(child.overdraft_enabled_override).toBe(1);
    expect(child.overdraft_limit_pence_override).toBe(5000);
  });
});

describe('handleChildGovernanceReject', () => {
  it('rejects a child-role JWT rejecting a pending request', async () => {
    const pending: GovRow = {
      id: 8, family_id: 'fam_1', child_id: 'child_1', requested_by: 'parent_1', confirmed_by: null,
      setting: 'verify_mode', old_value: 'inherit', new_value: 'standard',
      status: 'pending', requested_at: 0, expires_at: Math.floor(Date.now() / 1000) + 3600, confirmed_at: null,
    };
    const { env, govRows } = makeEnv({ otherParents: ['parent_2'], existingPending: pending });
    const auth = { sub: 'child_1', family_id: 'fam_1', role: 'child' };
    const req = authedRequest('https://x/api/child-governance/8/reject', auth, undefined);

    const res = await handleChildGovernanceReject(req, env, '8');
    expect(res.status).toBe(403);
    expect(govRows[0].status).toBe('pending');
  });

  it('marks the request rejected without applying any change', async () => {
    const pending: GovRow = {
      id: 7, family_id: 'fam_1', child_id: 'child_1', requested_by: 'parent_1', confirmed_by: null,
      setting: 'verify_mode', old_value: 'inherit', new_value: 'standard',
      status: 'pending', requested_at: 0, expires_at: Math.floor(Date.now() / 1000) + 3600, confirmed_at: null,
    };
    const { env, child } = makeEnv({ otherParents: ['parent_2'], existingPending: pending });
    const auth = { sub: 'parent_2', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-governance/7/reject', auth, undefined);

    const res = await handleChildGovernanceReject(req, env, '7');
    expect(res.status).toBe(200);
    expect(child.verify_mode_override).toBeNull();
  });
});

// ── Pocket Money Status (pause) — ungated ─────────────────────────────────────

describe('handleChildAllowancePauseUpdate', () => {
  it('pauses and resumes without any governance step', async () => {
    const { env, child } = makeEnv({ otherParents: ['parent_2'] });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };

    const pauseReq = authedRequest('https://x/api/child-controls/child_1/pause', auth, { paused: true }, 'PATCH');
    const res1 = await handleChildAllowancePauseUpdate(pauseReq, env, 'child_1');
    expect(res1.status).toBe(200);
    expect(child.allowance_paused).toBe(1);

    const resumeReq = authedRequest('https://x/api/child-controls/child_1/pause', auth, { paused: false }, 'PATCH');
    const res2 = await handleChildAllowancePauseUpdate(resumeReq, env, 'child_1');
    expect(res2.status).toBe(200);
    expect(child.allowance_paused).toBe(0);
  });
});

// ── handleChildControlsGet — effective value resolution ───────────────────────

describe('handleChildControlsGet', () => {
  it('falls back to family defaults when no override is set', async () => {
    const { env } = makeEnv({ familyVerifyMode: 'amicable', familyOverdraftEnabled: 1, familyOverdraftLimitPence: 2000 });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-controls/child_1', auth, undefined, 'GET');

    const res = await handleChildControlsGet(req, env, 'child_1');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.effective_verify_mode).toBe('amicable');
    expect(body.effective_overdraft_enabled).toBe(true);
    expect(body.effective_overdraft_limit_pence).toBe(2000);
    expect(body.has_pending_request).toBe(false);
  });

  it('prefers the per-child override over the family default', async () => {
    const { env } = makeEnv({
      familyVerifyMode: 'standard',
      child: { verify_mode_override: 'amicable', overdraft_enabled_override: 0, overdraft_limit_pence_override: 0 },
    });
    const auth = { sub: 'parent_1', family_id: 'fam_1', role: 'parent' };
    const req = authedRequest('https://x/api/child-controls/child_1', auth, undefined, 'GET');

    const res = await handleChildControlsGet(req, env, 'child_1');
    const body = await res.json() as any;
    expect(body.effective_verify_mode).toBe('amicable');
    expect(body.effective_overdraft_enabled).toBe(false);
  });
});
