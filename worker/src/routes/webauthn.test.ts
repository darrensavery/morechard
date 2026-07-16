import { describe, it, expect } from 'vitest';
import { handleWebauthnRegisterOptions, handleWebauthnRegisterVerify } from './webauthn.js';
import type { Env } from '../types.js';
import type { JwtPayload } from '../lib/jwt.js';
import { toBase64Url } from '../lib/webauthn.js';

type AuthedRequest = Request & { auth: JwtPayload };

function makeAuth(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'user_1', jti: 'jti_1', family_id: 'fam_1', role: 'parent', iat: 0, exp: 9999999999, ...overrides };
}

function makeAuthedRequest(url: string, body: unknown, auth: JwtPayload): AuthedRequest {
  const req = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.morechard.com' },
    body: JSON.stringify(body),
  }) as AuthedRequest;
  req.auth = auth;
  return req;
}

function makeMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
}

function makeMockDb(existingCredentials: Array<{ credential_id: string }> = []) {
  const inserted: Array<Record<string, unknown>> = [];
  return {
    db: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async all() {
                if (sql.includes('SELECT credential_id FROM webauthn_credentials')) {
                  return { results: existingCredentials };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes('INSERT INTO webauthn_credentials')) {
                  inserted.push({ args });
                }
                return { success: true, meta: {} };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
    inserted,
  };
}

describe('handleWebauthnRegisterOptions', () => {
  it('returns a native challenge when platform=native', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'native' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; challenge: string };
    expect(body.platform).toBe('native');
    expect(typeof body.challenge).toBe('string');
    expect(body.challenge).not.toMatch(/[+/=]/); // base64url, no padding
  });

  it('returns WebAuthn creation options when platform=web', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'web' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; options: { challenge: string; rp: { id: string } } };
    expect(body.platform).toBe('web');
    expect(body.options.rp.id).toBe('app.morechard.com');
    expect(typeof body.options.challenge).toBe('string');
  });

  it('rejects an invalid platform value', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makeAuthedRequest('https://api.morechard.com/auth/webauthn/register/options', { platform: 'carrier-pigeon' }, makeAuth());

    const res = await handleWebauthnRegisterOptions(request, env);
    expect(res.status).toBe(400);
  });
});

describe('handleWebauthnRegisterVerify — native path', () => {
  it('stores the public key and derives a stable credential_id', async () => {
    const { db, inserted } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const auth = makeAuth({ role: 'child' });

    // Pre-store a challenge the way register/options would have.
    await env.CACHE.put('webauthn:challenge:user_1', 'some-challenge');

    const publicKey = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const request = makeAuthedRequest(
      'https://api.morechard.com/auth/webauthn/register/verify',
      { platform: 'native', publicKey },
      auth,
    );

    const res = await handleWebauthnRegisterVerify(request, env);
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(1);
  });

  it('rejects when the challenge is missing or already used', async () => {
    const { db } = makeMockDb();
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const publicKey = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const request = makeAuthedRequest(
      'https://api.morechard.com/auth/webauthn/register/verify',
      { platform: 'native', publicKey },
      makeAuth(),
    );

    const res = await handleWebauthnRegisterVerify(request, env);
    expect(res.status).toBe(400);
  });
});
