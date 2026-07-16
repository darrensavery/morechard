import { describe, it, expect } from 'vitest';

// ── Account lock guard logic ──────────────────────────────────────────────────
// Extracted from requireAuth — determines whether a request should be blocked
// based on child role, HTTP method, and lock status.

function shouldEnforceLock(opts: {
  role: string;
  method: string;
  isDemoUser: boolean;
  lockRow: { locked_until: number } | null;
  nowEpoch: number;
}): boolean {
  const { role, method, isDemoUser, lockRow, nowEpoch } = opts;
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (role !== 'child' || !isWrite || isDemoUser) return false;
  if (!lockRow) return false;
  return lockRow.locked_until > nowEpoch;
}

function lockMinutesRemaining(lockedUntil: number, nowEpoch: number): number {
  return Math.ceil((lockedUntil - nowEpoch) / 60);
}

const NOW = 1_700_000_000;

describe('account lock middleware guard', () => {
  // ── Role gate ────────────────────────────────────────────────────────────────
  it('does not block a parent even with a lock row', () => {
    expect(shouldEnforceLock({
      role: 'parent', method: 'POST', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(false);
  });

  it('does not block a child on GET requests', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'GET', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(false);
  });

  it('does not block a child on HEAD requests', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'HEAD', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(false);
  });

  // ── Lock active ──────────────────────────────────────────────────────────────
  it('blocks a locked child on POST', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'POST', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(true);
  });

  it('blocks a locked child on PATCH', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'PATCH', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(true);
  });

  it('blocks a locked child on DELETE', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'DELETE', isDemoUser: false,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(true);
  });

  // ── Lock expired ─────────────────────────────────────────────────────────────
  it('does not block after lock has expired', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'POST', isDemoUser: false,
      lockRow: { locked_until: NOW - 1 }, nowEpoch: NOW,
    })).toBe(false);
  });

  it('does not block when locked_until equals now (boundary)', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'POST', isDemoUser: false,
      lockRow: { locked_until: NOW }, nowEpoch: NOW,
    })).toBe(false);
  });

  // ── No lock row ──────────────────────────────────────────────────────────────
  it('does not block a child with no lock row', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'POST', isDemoUser: false,
      lockRow: null, nowEpoch: NOW,
    })).toBe(false);
  });

  // ── Demo exemption ───────────────────────────────────────────────────────────
  it('does not block demo users regardless of lock row', () => {
    expect(shouldEnforceLock({
      role: 'child', method: 'POST', isDemoUser: true,
      lockRow: { locked_until: NOW + 3600 }, nowEpoch: NOW,
    })).toBe(false);
  });
});

// ── Minutes remaining calculation ────────────────────────────────────────────

describe('lockMinutesRemaining', () => {
  it('returns 60 for a 1-hour lock', () => {
    expect(lockMinutesRemaining(NOW + 3600, NOW)).toBe(60);
  });

  it('rounds partial minutes up (ceil)', () => {
    expect(lockMinutesRemaining(NOW + 3661, NOW)).toBe(62);
  });

  it('returns 1 for 1 second remaining', () => {
    expect(lockMinutesRemaining(NOW + 1, NOW)).toBe(1);
  });
});

// ── CSRF header guard logic ──────────────────────────────────────────────────

import { requireCsrfHeader } from './middleware.js';

describe('requireCsrfHeader', () => {
  it('rejects a cookie-authenticated mutating request with no client header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Cookie: 'mc_token=abc' },
    });
    const result = requireCsrfHeader(request, true);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it('accepts a cookie-authenticated mutating request WITH the client header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Cookie: 'mc_token=abc', 'X-Morechard-Client': '1' },
    });
    expect(requireCsrfHeader(request, true)).toBeNull();
  });

  it('never blocks a Bearer-authenticated (native) request, regardless of header', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(requireCsrfHeader(request, false)).toBeNull();
  });

  it('never blocks GET requests even when cookie-authenticated', () => {
    const request = new Request('https://api.morechard.com/api/goals', {
      method: 'GET',
      headers: { Cookie: 'mc_token=abc' },
    });
    expect(requireCsrfHeader(request, true)).toBeNull();
  });
});
