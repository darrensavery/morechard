import { describe, it, expect } from 'vitest';
import {
  toBase64Url, fromBase64Url, deriveNativeCredentialId, verifyNativeSignature,
  storeChallenge, consumeChallenge,
} from './webauthn.js';
import type { Env } from '../types.js';

function makeMockKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
}

describe('base64url encode/decode', () => {
  it('round-trips arbitrary bytes without padding characters', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(37)); // odd length forces padding in plain base64
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = fromBase64Url(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe('deriveNativeCredentialId', () => {
  it('is deterministic for the same public key', async () => {
    const key = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const id1 = await deriveNativeCredentialId(key);
    const id2 = await deriveNativeCredentialId(key);
    expect(id1).toBe(id2);
    expect(id1).not.toMatch(/[+/=]/);
  });

  it('differs for different public keys', async () => {
    const keyA = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    const keyB = toBase64Url(crypto.getRandomValues(new Uint8Array(65)));
    expect(await deriveNativeCredentialId(keyA)).not.toBe(await deriveNativeCredentialId(keyB));
  });
});

describe('verifyNativeSignature — real ECDSA round trip', () => {
  it('accepts a genuine signature over the challenge', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64Url = toBase64Url(spki);

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64Url = toBase64Url(challenge);

    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, challenge);
    const signatureB64Url = toBase64Url(signature);

    const valid = await verifyNativeSignature(publicKeyB64Url, signatureB64Url, challengeB64Url);
    expect(valid).toBe(true);
  });

  it('rejects a signature over a different challenge (catches client/server format mismatch too)', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64Url = toBase64Url(spki);

    const realChallenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const otherChallenge = crypto.getRandomValues(new Uint8Array(32));
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, otherChallenge);
    const signatureB64Url = toBase64Url(signature);

    const valid = await verifyNativeSignature(publicKeyB64Url, signatureB64Url, realChallenge);
    expect(valid).toBe(false);
  });

  it('returns false (not a throw) for garbage input', async () => {
    const valid = await verifyNativeSignature('not-a-real-key', 'not-a-real-signature', 'not-a-real-challenge');
    expect(valid).toBe(false);
  });
});

describe('challenge KV storage', () => {
  it('stores then consumes a challenge exactly once', async () => {
    const env = { CACHE: makeMockKV() } as unknown as Env;
    await storeChallenge(env, 'user_1', 'abc123');
    expect(await consumeChallenge(env, 'user_1')).toBe('abc123');
    expect(await consumeChallenge(env, 'user_1')).toBe(null); // one-time use
  });

  it('returns null for a user with no stored challenge', async () => {
    const env = { CACHE: makeMockKV() } as unknown as Env;
    expect(await consumeChallenge(env, 'nobody')).toBe(null);
  });
});
