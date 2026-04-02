/**
 * Minimal JWT implementation using Web Crypto (HMAC-SHA256).
 * No npm dependencies — runs natively on Cloudflare Workers.
 *
 * Token structure: base64url(header).base64url(payload).base64url(signature)
 * Header: { alg: "HS256", typ: "JWT" }
 */

export interface JwtPayload {
  sub: string;       // user_id
  jti: string;       // session id (for revocation)
  family_id: string;
  role: 'parent' | 'child';
  iat: number;
  exp: number;
}

const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const body      = `${HEADER}.${b64url(JSON.stringify(payload))}`;
  const key       = await importKey(secret);
  const sig       = await crypto.subtle.sign('HMAC', key, enc(body));
  return `${body}.${b64urlBuf(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [header, payload, sig] = parts;
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc(`${header}.${payload}`));
  if (!valid) throw new Error('Invalid signature');

  const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return claims;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function enc(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
