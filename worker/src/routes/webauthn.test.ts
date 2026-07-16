import { describe, it, expect } from 'vitest';
import {
  handleWebauthnRegisterOptions, handleWebauthnRegisterVerify,
  handleWebauthnLoginOptions, handleWebauthnLoginVerify,
} from './webauthn.js';
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

function makePlainRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.morechard.com' },
    body: JSON.stringify(body),
  });
}

describe('handleWebauthnLoginOptions', () => {
  it('404s when the user has no registered credential of that type', async () => {
    const dbWithEmptyAll = {
      prepare: () => ({
        bind: () => ({ async all() { return { results: [] }; } }),
      }),
    } as unknown as D1Database;
    const env = { DB: dbWithEmptyAll, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/options', {
      user_id: 'user_1', role: 'parent', platform: 'native',
    });

    const res = await handleWebauthnLoginOptions(request, env);
    expect(res.status).toBe(404);
  });

  it('returns a native challenge for a registered native credential', async () => {
    const dbWithOneCred = {
      prepare: () => ({
        bind: () => ({ async all() { return { results: [{ credential_id: 'cred_1' }] }; } }),
      }),
    } as unknown as D1Database;
    const env = { DB: dbWithOneCred, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/options', {
      user_id: 'user_1', role: 'parent', platform: 'native',
    });

    const res = await handleWebauthnLoginOptions(request, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { platform: string; challenge: string };
    expect(body.platform).toBe('native');
  });
});

describe('handleWebauthnLoginVerify — native path', () => {
  it('rejects when the signature does not match the stored public key', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey) as ArrayBuffer;
    const publicKey = toBase64Url(spki);

    const db = {
      prepare(sql: string) {
        return {
          bind: () => ({
            async first() {
              if (sql.includes('FROM users')) return { family_id: 'fam_1' };
              if (sql.includes('FROM webauthn_credentials')) return { public_key: publicKey };
              return null;
            },
            async run() { return { success: true, meta: {} }; },
          }),
        };
      },
    } as unknown as D1Database;
    const cache = makeMockKV();
    const env = { DB: db, CACHE: cache, JWT_SECRET: 'test-secret', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    await cache.put('webauthn:challenge:user_1', 'the-real-challenge');

    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: publicKey,
      signature: toBase64Url(crypto.getRandomValues(new Uint8Array(64))), // garbage signature
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(401);
  });

  it('issues a session (cookie) on a genuine signature', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey) as ArrayBuffer;
    const publicKey = toBase64Url(spki);

    const db = {
      prepare(sql: string) {
        return {
          bind: () => ({
            async first() {
              if (sql.includes('FROM users')) return { family_id: 'fam_1' };
              if (sql.includes('FROM webauthn_credentials')) return { public_key: publicKey };
              return null;
            },
            async run() { return { success: true, meta: {} }; },
          }),
        };
      },
    } as unknown as D1Database;
    const cache = makeMockKV();
    const env = { DB: db, CACHE: cache, JWT_SECRET: 'test-secret', APP_URL: 'https://app.morechard.com' } as unknown as Env;

    const challengeB64Url = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await cache.put('webauthn:challenge:user_1', challengeB64Url);

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      (await import('../lib/webauthn.js')).fromBase64Url(challengeB64Url),
    );

    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: publicKey,
      signature: toBase64Url(signature),
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(200);
    const setCookies = (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(setCookies.some(c => c.startsWith('mc_token=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects when the challenge is missing/expired', async () => {
    const db = { prepare: () => ({ bind: () => ({ async first() { return null; } }) }) } as unknown as D1Database;
    const env = { DB: db, CACHE: makeMockKV(), APP_URL: 'https://app.morechard.com' } as unknown as Env;
    const request = makePlainRequest('https://api.morechard.com/auth/webauthn/login/verify', {
      user_id: 'user_1', role: 'parent', platform: 'native',
      public_key: 'x', signature: 'y',
    });

    const res = await handleWebauthnLoginVerify(request, env);
    expect(res.status).toBe(400);
  });
});
