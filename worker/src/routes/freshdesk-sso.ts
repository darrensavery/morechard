/**
 * GET /api/freshdesk-sso
 *
 * Generates a Freshdesk SSO JWT for the authenticated parent and returns
 * the portal redirect URL. The frontend opens this URL in a new tab,
 * landing the user directly into the Freshdesk portal as a contact.
 *
 * Freshdesk JWT fields: name, email, iat, jti (nonce)
 * Signing: HMAC-SHA256, secret from Freshdesk Admin → Security → SSO
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { requireAuth, requireRole } from '../lib/middleware.js';
import { nanoid } from '../lib/nanoid.js';

const FRESHDESK_HOST = 'https://eagereverest.freshdesk.com';

function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signFreshdeskJwt(
  name: string,
  email: string,
  secret: string,
): Promise<string> {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    name,
    email,
    iat: Math.floor(Date.now() / 1000),
    jti: nanoid(),
  }));
  const body = `${header}.${payload}`;
  const key  = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${b64urlBuf(sig)}`;
}

export async function handleFreshdeskSso(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const roleCheck = requireRole(auth, 'parent');
  if (roleCheck) return roleCheck;

  if (!env.FRESHDESK_SSO_SECRET) {
    return error('Freshdesk SSO not configured', 503);
  }

  // Look up the parent's name and email
  const user = await env.DB
    .prepare('SELECT name, email FROM users WHERE id = ?')
    .bind(auth.sub)
    .first<{ name: string; email: string }>();

  if (!user) return error('User not found', 404);

  const token = await signFreshdeskJwt(user.name, user.email, env.FRESHDESK_SSO_SECRET);
  const url   = `${FRESHDESK_HOST}/login/jwt?jwt=${token}`;

  return json({ url });
}
