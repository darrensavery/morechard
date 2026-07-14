import { describe, it, expect, vi } from 'vitest';
import { dedupeIncomingSentryEvent, handleSupportAgentRequest } from './supportAgentIngest.js';

describe('dedupeIncomingSentryEvent', () => {
  it('classifies as new when no open incident exists for this issue id', () => {
    expect(dedupeIncomingSentryEvent({ existingOpenIncidentId: null })).toBe('new');
  });

  it('classifies as duplicate when an open incident already exists for this issue id', () => {
    expect(dedupeIncomingSentryEvent({ existingOpenIncidentId: 'inc_abc' })).toBe('duplicate');
  });
});

describe('handleSupportAgentRequest — Zoho ticket creation', () => {
  it('still succeeds and enqueues the local incident even when Zoho ticket creation fails', async () => {
    const dbRun = vi.fn().mockResolvedValue(undefined);
    const dbFirst = vi.fn().mockResolvedValue({ name: 'Test Parent', email: 'parent@example.com' });
    const dbPrepare = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ run: dbRun, first: dbFirst }) });
    const queueSend = vi.fn().mockResolvedValue(undefined);

    const env = {
      DB: { prepare: dbPrepare },
      INCIDENT_QUEUE: { send: queueSend },
      ZOHO_API_DOMAIN: 'https://desk.zoho.com',
      ZOHO_ACCOUNTS_DOMAIN: 'https://accounts.zoho.com',
      ZOHO_CLIENT_ID: 'x', ZOHO_CLIENT_SECRET: 'x', ZOHO_REFRESH_TOKEN: 'x',
      ZOHO_ORG_ID: 'x', ZOHO_DEPARTMENT_ID: 'x',
    } as never;

    // No global fetch mock configured — createZohoTicket's internal
    // fetch call will reject/fail, exercising the best-effort catch path.
    const request = {
      auth: { role: 'parent', family_id: 'fam_1', sub: 'user_1' },
      json: async () => ({ description: 'Cannot see my goals', screen: 'GoalsScreen' }),
    } as never;

    const res = await handleSupportAgentRequest(request, env);
    expect(res.status).toBe(200);
    expect(queueSend).toHaveBeenCalledOnce();
    const body = await res.json() as { received: boolean };
    expect(body.received).toBe(true);
  });
});
