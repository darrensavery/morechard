/**
 * Demo account routes — Thomson family shared demo.
 *
 * POST /auth/demo/register   — professional path (name + email + marketing consent)
 * POST /auth/demo/enter      — post-trial Core parent path (no form; uses existing user)
 * POST /auth/demo/notify     — "Notify me when available" for upsell prompts
 * GET  /auth/demo/active     — returns whether demo session is still valid
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { signJwt } from '../lib/jwt.js';
import type { JwtPayload } from '../lib/jwt.js';

const DEMO_FAMILY_ID   = 'demo-family-thomson';
const DEMO_LEAD_ID     = 'demo-user-sarah';
const DEMO_SESSION_TTL = 2 * 3600;  // 2 hours inactivity limit (enforced client-side via exp)

// ----------------------------------------------------------------
// POST /auth/demo/register
// Professional entry point — collects name, email, marketing consent.
// Creates a demo_registrations row then issues a JWT for the demo family.
// ----------------------------------------------------------------
export async function handleDemoRegister(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return error('Invalid JSON body');

  const name               = (body.name               as string | undefined)?.trim() ?? '';
  const email              = (body.email              as string | undefined)?.trim().toLowerCase() ?? '';
  const marketing_consent  = Boolean(body.marketing_consent);

  if (!name)  return error('name required');
  if (!email) return error('email required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('Invalid email address');

  const now = Math.floor(Date.now() / 1000);
  const id  = crypto.randomUUID();

  // Upsert — same professional may revisit; update last_active_at on re-entry.
  await env.DB
    .prepare(`
      INSERT INTO demo_registrations (id, name, email, user_type, marketing_consent, registered_at, last_active_at)
      VALUES (?, ?, ?, 'professional', ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET last_active_at = excluded.last_active_at
    `)
    .bind(id, name, email, marketing_consent ? 1 : 0, now, now)
    .run();

  const token = await issueDemoToken(env, DEMO_LEAD_ID, 'professional', now);
  return json({ token, expires_in: DEMO_SESSION_TTL });
}

// ----------------------------------------------------------------
// POST /auth/demo/enter
// Post-trial Core parent path — no form. Requires existing valid JWT.
// Writes a demo_registrations row using the caller's existing user record.
// ----------------------------------------------------------------
export async function handleDemoEnter(request: Request, env: Env): Promise<Response> {
  const caller = (request as { auth?: JwtPayload }).auth;
  if (!caller) return error('Unauthorised', 401);

  const user = await env.DB
    .prepare('SELECT id, display_name, email FROM users WHERE id = ?')
    .bind(caller.sub)
    .first<{ id: string; display_name: string; email: string | null }>();

  if (!user) return error('User not found', 404);

  const now = Math.floor(Date.now() / 1000);
  const id  = crypto.randomUUID();

  const email = user.email ?? `${user.id}@no-email.internal`;

  // Upsert — Core user may tap the card multiple times.
  await env.DB
    .prepare(`
      INSERT INTO demo_registrations (id, name, email, user_type, marketing_consent, registered_at, last_active_at)
      VALUES (?, ?, ?, 'demo_parent', 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET last_active_at = excluded.last_active_at
    `)
    .bind(id, user.display_name, email, now, now)
    .run();

  const token = await issueDemoToken(env, DEMO_LEAD_ID, 'demo_parent', now);
  return json({ token, expires_in: DEMO_SESSION_TTL });
}

// ----------------------------------------------------------------
// POST /auth/demo/notify
// "Notify me when this is available" — writes to upgrade_interest.
// Requires demo JWT (demo_user_type present) or regular JWT.
// Body: { feature: 'shield' | 'ai_mentor' | 'learning_lab' }
// ----------------------------------------------------------------
export async function handleDemoNotify(request: Request, env: Env): Promise<Response> {
  const caller = (request as { auth?: JwtPayload }).auth;
  if (!caller) return error('Unauthorised', 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return error('Invalid JSON body');

  const feature = body.feature as string | undefined;
  if (!feature || !['shield', 'ai_mentor', 'learning_lab'].includes(feature)) {
    return error('feature must be shield, ai_mentor, or learning_lab');
  }

  const now = Math.floor(Date.now() / 1000);
  const id  = crypto.randomUUID();

  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO upgrade_interest (id, user_id, feature, registered_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, caller.sub, feature, now)
    .run();

  return json({ ok: true });
}

// ----------------------------------------------------------------
// GET /auth/demo/active
// Returns whether the caller is in an active demo session.
// ----------------------------------------------------------------
export async function handleDemoActive(request: Request, env: Env): Promise<Response> {
  const caller = (request as { auth?: JwtPayload }).auth;
  if (!caller) return json({ active: false });

  return json({
    active: caller.family_id === DEMO_FAMILY_ID,
    demo_user_type: caller.demo_user_type ?? null,
  });
}

// ----------------------------------------------------------------
// Helper — issue a short-lived JWT for the demo family.
// Uses the demo lead user ID as sub so route handlers see a valid user.
// ----------------------------------------------------------------
async function issueDemoToken(
  env: Env,
  userId: string,
  demoUserType: 'professional' | 'demo_parent',
  now: number,
): Promise<string> {
  const jti = crypto.randomUUID();
  // No sessions row for demo — demo tokens are stateless (not revocable).
  return signJwt(
    {
      sub: userId,
      jti,
      family_id: DEMO_FAMILY_ID,
      role: 'parent',
      demo_user_type: demoUserType,
      iat: now,
      exp: now + DEMO_SESSION_TTL,
    },
    env.JWT_SECRET,
  );
}
