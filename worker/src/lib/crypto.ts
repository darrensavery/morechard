/**
 * Password / PIN hashing using PBKDF2-SHA256 (Web Crypto — no dependencies).
 *
 * Format stored in DB: "pbkdf2$<iterations>$<base64(salt)>$<base64(hash)>"
 * This is self-describing so we can increase iterations in future without
 * breaking existing hashes.
 *
 * Iterations: 10,000 — Cloudflare Workers has a strict per-request CPU time
 * limit (~50ms free / 30s paid). OWASP recommends 310k for server apps, but
 * edge workers cannot sustain that. 10k is a pragmatic edge-safe value.
 * Mitigations: HTTPS-only transport, rate limiting at Cloudflare WAF layer,
 * account lockout after 10 failed attempts (implement at route level).
 */

const ITERATIONS = 10_000;
const KEY_LEN    = 32; // bytes

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64Decode(parts[2]);
  const expected = b64Decode(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    KEY_LEN * 8,
  );
  return new Uint8Array(bits);
}

function b64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function b64Decode(str: string): Uint8Array {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

/** Constant-time comparison to prevent timing attacks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
