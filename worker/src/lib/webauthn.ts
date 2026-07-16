import type { Env } from '../types.js';

const CHALLENGE_TTL_SECONDS = 120;

/** Encodes bytes as base64url (RFC 4648 §5), no padding. */
export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a base64url (unpadded) string back to raw bytes. */
export function fromBase64Url(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Native credentials have no attestation ceremony to hand us a credential
 * ID, so we derive one deterministically from the public key itself
 * (SHA-256 of the raw SPKI bytes, base64url-encoded). Deterministic so
 * re-registering the same key pair can't create a duplicate row — the
 * `UNIQUE` constraint on `webauthn_credentials.credential_id` catches that.
 */
export async function deriveNativeCredentialId(publicKeyB64Url: string): Promise<string> {
  const bytes = fromBase64Url(publicKeyB64Url);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toBase64Url(digest);
}

/**
 * Verifies a raw ECDSA P-256/SHA-256 signature against a stored SPKI public
 * key. This is the native-app path — there's no WebAuthn attestation object
 * here, just "did this exact key sign this exact challenge." Returns false
 * (never throws) on any malformed input, so callers can treat it as a plain
 * boolean check.
 */
export async function verifyNativeSignature(
  publicKeyB64Url: string,
  signatureB64Url: string,
  challengeB64Url: string,
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64Url(publicKeyB64Url),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64Url(signatureB64Url),
      fromBase64Url(challengeB64Url),
    );
  } catch {
    return false;
  }
}

/**
 * One-time, short-lived challenge storage in KV (not a new D1 table — no
 * cleanup cron needed, KV expires these for free). Keyed per-user, so a
 * user can only have one outstanding registration/login challenge at a
 * time — a second `storeChallenge` call for the same user overwrites the
 * first, which is fine (only one ceremony should be in flight per user).
 */
export async function storeChallenge(env: Env, userId: string, challenge: string): Promise<void> {
  await env.CACHE.put(`webauthn:challenge:${userId}`, challenge, { expirationTtl: CHALLENGE_TTL_SECONDS });
}

/** Reads and deletes the stored challenge in one call — one-time use. */
export async function consumeChallenge(env: Env, userId: string): Promise<string | null> {
  const key = `webauthn:challenge:${userId}`;
  const challenge = await env.CACHE.get(key);
  if (!challenge) return null;
  await env.CACHE.delete(key);
  return challenge;
}
