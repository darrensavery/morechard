import { describe, it, expect, vi } from 'vitest';
import {
  handleGovernanceRequest,
  handleGovernanceConfirm,
  handleGovernanceReject,
  handleGovernanceGet,
} from './governance.js';

// Security-review follow-up: a child's JWT (role: 'child') carries the same
// family_id as their parents, so before these handlers gated on auth.role,
// a child could request/confirm/reject the family's Approval Mode change —
// or read the pending-request log — entirely on their own. See the sibling
// fix in childControls.test.ts for the per-child governance equivalent.

function authedRequest(url: string, auth: Record<string, unknown>, body?: unknown, method = 'POST') {
  const req = new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  (req as any).auth = auth;
  return req;
}

function makeEnv() {
  const first = vi.fn().mockResolvedValue(null);
  const all   = vi.fn().mockResolvedValue({ results: [] });
  const run   = vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 1 } });
  const prepare = vi.fn(() => ({ bind: () => ({ first, all, run }) }));
  const batch = vi.fn().mockResolvedValue([]);
  return { DB: { prepare, batch } } as any;
}

const childAuth = { sub: 'child_1', family_id: 'fam_1', role: 'child' };

describe('governance routes — child-role gate', () => {
  it('rejects a child requesting a verify_mode change', async () => {
    const env = makeEnv();
    const req = authedRequest('https://x/api/governance/request', childAuth, { new_mode: 'amicable' });
    const res = await handleGovernanceRequest(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects a child confirming a pending request', async () => {
    const env = makeEnv();
    const req = authedRequest('https://x/api/governance/1/confirm', childAuth);
    const res = await handleGovernanceConfirm(req, env, '1');
    expect(res.status).toBe(403);
  });

  it('rejects a child rejecting a pending request', async () => {
    const env = makeEnv();
    const req = authedRequest('https://x/api/governance/1/reject', childAuth);
    const res = await handleGovernanceReject(req, env, '1');
    expect(res.status).toBe(403);
  });

  it('rejects a child reading the governance log', async () => {
    const env = makeEnv();
    const req = authedRequest('https://x/api/governance?family_id=fam_1', childAuth, undefined, 'GET');
    const res = await handleGovernanceGet(req, env);
    expect(res.status).toBe(403);
  });
});
