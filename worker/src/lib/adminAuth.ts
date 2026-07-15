/**
 * Shared X-Admin-Key guard for internal operator routes. Extracted from
 * admin.ts so agentReview.ts (autonomous support agent review queue) can
 * reuse the exact same check rather than duplicating it.
 */
import { Env } from '../types.js';
import { error } from './response.js';
import { timingSafeEqual } from './crypto.js';

export function requireAdmin(request: Request, env: Env): Response | null {
  const key = request.headers.get('X-Admin-Key');
  if (!key || !env.ADMIN_SECRET) return error('Unauthorised', 401);
  const a = new TextEncoder().encode(key);
  const b = new TextEncoder().encode(env.ADMIN_SECRET);
  return timingSafeEqual(a, b) ? null : error('Unauthorised', 401);
}

/**
 * Gates the GET /admin page load itself (the panel's data calls are already
 * gated by requireAdmin() via the X-Admin-Key header the panel's JS sends —
 * but a plain browser navigation can't set that, so the HTML shell was
 * previously reachable by anyone). Uses HTTP Basic Auth against the same
 * ADMIN_SECRET so there's no second credential to manage; the browser's
 * native prompt handles it, and the panel's own X-Admin-Key flow for data
 * calls is unaffected.
 */
export function requireAdminBasicAuth(request: Request, env: Env): Response | null {
  const unauthorized = () => new Response('Unauthorised', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Morechard Admin"' },
  });

  if (!env.ADMIN_SECRET) return unauthorized();

  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Basic ')) return unauthorized();

  let password: string;
  try {
    const decoded = atob(header.slice(6));
    password = decoded.slice(decoded.indexOf(':') + 1);
  } catch {
    return unauthorized();
  }

  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(env.ADMIN_SECRET);
  return timingSafeEqual(a, b) ? null : unauthorized();
}
