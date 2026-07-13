import { describe, it, expect } from 'vitest';
import { requireAdmin } from './adminAuth.js';

function makeEnv(adminSecret: string | undefined) {
  return { ADMIN_SECRET: adminSecret } as { ADMIN_SECRET: string };
}

describe('requireAdmin', () => {
  it('returns null (allow) when the header matches ADMIN_SECRET', () => {
    const request = new Request('https://x.test', { headers: { 'X-Admin-Key': 'correct-key' } });
    const result = requireAdmin(request, makeEnv('correct-key') as never);
    expect(result).toBeNull();
  });

  it('returns a 401 Response when the header is missing', () => {
    const request = new Request('https://x.test');
    const result = requireAdmin(request, makeEnv('correct-key') as never);
    expect(result).not.toBeNull();
    expect((result as Response).status).toBe(401);
  });

  it('returns a 401 Response when the header does not match', () => {
    const request = new Request('https://x.test', { headers: { 'X-Admin-Key': 'wrong-key' } });
    const result = requireAdmin(request, makeEnv('correct-key') as never);
    expect((result as Response).status).toBe(401);
  });

  it('returns a 401 Response when ADMIN_SECRET is not configured', () => {
    const request = new Request('https://x.test', { headers: { 'X-Admin-Key': 'anything' } });
    const result = requireAdmin(request, makeEnv(undefined) as never);
    expect((result as Response).status).toBe(401);
  });
});
