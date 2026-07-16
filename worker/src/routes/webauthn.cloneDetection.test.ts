// Isolated test file (separate from webauthn.test.ts) so mocking
// @simplewebauthn/server's verifyAuthenticationResponse and @sentry/cloudflare
// here can't affect the already-reviewed native-path/register tests, which
// rely on the real library behavior.
//
// Covers the one security-critical path the main test file doesn't:
// counter regression on the web login path must reject (401) AND raise a
// distinct Sentry alert — and a non-counter verification failure must
// reject (401) WITHOUT raising that alert.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@simplewebauthn/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@simplewebauthn/server')>();
  return {
    ...actual,
    verifyAuthenticationResponse: vi.fn(),
  };
});

vi.mock('@sentry/cloudflare', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/cloudflare';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { handleWebauthnLoginVerify } from './webauthn.js';
import type { Env } from '../types.js';

function makeMockKV(challenge: string) {
  const store = new Map<string, string>([['webauthn:challenge:user_1', challenge]]);
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
}

function makeMockDb(credRow: { credential_id: string; public_key: string; counter: number }) {
  return {
    prepare(sql: string) {
      return {
        bind: () => ({
          async first() {
            if (sql.includes('FROM users')) return { family_id: 'fam_1' };
            if (sql.includes('FROM webauthn_credentials')) return credRow;
            return null;
          },
          async run() { return { success: true, meta: {} }; },
        }),
      };
    },
  } as unknown as D1Database;
}

function makeWebLoginRequest(): Request {
  return new Request('https://api.morechard.com/auth/webauthn/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.morechard.com' },
    body: JSON.stringify({
      user_id: 'user_1', role: 'parent', platform: 'web',
      response: { id: 'cred_1', rawId: 'cred_1', type: 'public-key', response: {} },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleWebauthnLoginVerify — web path counter-regression clone detection', () => {
  it('rejects (401) and raises a distinct Sentry alert when the counter did not increase', async () => {
    (verifyAuthenticationResponse as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Response counter value 5 was lower than expected 10'),
    );
    const env = {
      DB: makeMockDb({ credential_id: 'cred_1', public_key: 'pubkey', counter: 10 }),
      CACHE: makeMockKV('the-real-challenge'),
      APP_URL: 'https://app.morechard.com',
    } as unknown as Env;

    const res = await handleWebauthnLoginVerify(makeWebLoginRequest(), env);

    expect(res.status).toBe(401);
    expect(Sentry.captureMessage).toHaveBeenCalledOnce();
    const [message, options] = (Sentry.captureMessage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toContain('counter regression');
    expect(options.fingerprint).toEqual(['webauthn-clone-detected', 'cred_1']);
  });

  it('rejects (401) WITHOUT raising the clone-detection alert on a non-counter verification failure', async () => {
    (verifyAuthenticationResponse as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected authenticator data'),
    );
    const env = {
      DB: makeMockDb({ credential_id: 'cred_1', public_key: 'pubkey', counter: 10 }),
      CACHE: makeMockKV('the-real-challenge'),
      APP_URL: 'https://app.morechard.com',
    } as unknown as Env;

    const res = await handleWebauthnLoginVerify(makeWebLoginRequest(), env);

    expect(res.status).toBe(401);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('rejects (401) WITHOUT raising the alert when verification resolves but reports unverified', async () => {
    (verifyAuthenticationResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
      verified: false,
      authenticationInfo: { newCounter: 11 },
    });
    const env = {
      DB: makeMockDb({ credential_id: 'cred_1', public_key: 'pubkey', counter: 10 }),
      CACHE: makeMockKV('the-real-challenge'),
      APP_URL: 'https://app.morechard.com',
    } as unknown as Env;

    const res = await handleWebauthnLoginVerify(makeWebLoginRequest(), env);

    expect(res.status).toBe(401);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
