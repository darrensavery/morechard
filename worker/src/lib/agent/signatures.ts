/**
 * Signature/secret verification for the four support-agent ingest routes.
 * Isolated from the existing payment-critical `stripe.ts` webhook verifier —
 * this file has its own copy so the support agent's ingest surface never
 * shares code (or a bug) with the live payment path.
 */
import { timingSafeEqual } from '../crypto.js';

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyStripeSupportAgentSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=')).map(([k, ...v]) => [k, v.join('=')]),
  );
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expectedHex = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqual(new TextEncoder().encode(expectedHex), new TextEncoder().encode(v1));
}

export async function verifySentrySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const expectedHex = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(new TextEncoder().encode(expectedHex), new TextEncoder().encode(signatureHeader));
}
