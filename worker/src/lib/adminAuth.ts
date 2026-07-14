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
