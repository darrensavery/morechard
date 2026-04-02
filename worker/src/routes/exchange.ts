/**
 * POST /auth/exchange
 *
 * Bridge between Firebase Auth (Google / Magic Link) and the Worker session system.
 *
 * Flow:
 *   1. Client sends { id_token: "<firebase idToken>" }
 *   2. Worker verifies the Firebase JWT using crypto.subtle (no Admin SDK)
 *   3. Look up the user in D1 by firebase_uid, then by email (dedup guard)
 *   4. If found by email but missing firebase_uid → link them (one D1 user, one ledger identity)
 *   5. If not found → create family + user atomically
 *   6. Issue a native Worker JWT and return it
 *
 * Double-identity prevention:
 *   Email is the canonical dedup key. A user who previously registered with
 *   email/password and later signs in with Google gets their firebase_uid linked
 *   to the existing row — they do NOT get a second user_id in the ledger.
 */

import { Env } from '../types.js';
import { verifyFirebaseToken } from '../lib/firebase-verify.js';
import { signJwt } from '../lib/jwt.js';
import { nanoid } from '../lib/nanoid.js';
import { json, error, clientIp } from '../lib/response.js';

const PARENT_JWT_EXPIRY = 7 * 24 * 3600; // 7 days

export async function handleExchange(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const idToken = body['id_token'];
  if (!idToken || typeof idToken !== 'string') return error('id_token required');

  // ── 1. Verify Firebase JWT ──────────────────────────────────────────────
  let claims;
  try {
    claims = await verifyFirebaseToken(idToken, env.FIREBASE_PROJECT_ID);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token verification failed';
    return error(`Firebase token invalid: ${msg}`, 401);
  }

  const { uid: firebaseUid, email, name } = claims;

  // Firebase Google accounts always have a verified email. Magic link accounts
  // may not have email_verified=true on first sign-in — we trust them anyway
  // since Firebase already validated ownership via the link.
  if (!email) return error('Firebase account has no email address', 400);

  const normEmail = email.toLowerCase().trim();

  // ── 2. Look up user — firebase_uid first, then email (dedup guard) ──────
  let user = await env.DB
    .prepare('SELECT id, family_id FROM users WHERE firebase_uid = ?')
    .bind(firebaseUid)
    .first<{ id: string; family_id: string }>();

  if (!user) {
    // Check if email already exists (email/password registration)
    const byEmail = await env.DB
      .prepare('SELECT id, family_id FROM users WHERE email = ?')
      .bind(normEmail)
      .first<{ id: string; family_id: string }>();

    if (byEmail) {
      // Link firebase_uid to existing account — same ledger identity preserved
      await env.DB
        .prepare('UPDATE users SET firebase_uid = ?, email_verified = 1 WHERE id = ?')
        .bind(firebaseUid, byEmail.id)
        .run();
      user = byEmail;
    }
  }

  // ── 3. New user — create family + user atomically ───────────────────────
  if (!user) {
    const familyId   = nanoid();
    const userId     = nanoid();
    const displayName = name || normEmail.split('@')[0];

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO families (id, verify_mode) VALUES (?, 'amicable')`)
        .bind(familyId),
      env.DB.prepare(`
        INSERT INTO users (id, family_id, display_name, email, locale, firebase_uid, email_verified)
        VALUES (?, ?, ?, ?, 'en', ?, 1)
      `).bind(userId, familyId, displayName, normEmail, firebaseUid),
      env.DB.prepare(`INSERT INTO family_roles (user_id, family_id, role) VALUES (?, ?, 'parent')`)
        .bind(userId, familyId),
    ]);

    user = { id: userId, family_id: familyId };
  }

  // ── 4. Issue native Worker session + JWT ────────────────────────────────
  const ip  = clientIp(request);
  const now = Math.floor(Date.now() / 1000);
  const jti = nanoid();

  await env.DB
    .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, expires_at, ip_address)
              VALUES (?, ?, ?, 'parent', ?, ?)`)
    .bind(jti, user.id, user.family_id, now + PARENT_JWT_EXPIRY, ip)
    .run();

  const token = await signJwt(
    { sub: user.id, jti, family_id: user.family_id, role: 'parent', iat: now, exp: now + PARENT_JWT_EXPIRY },
    env.JWT_SECRET,
  );

  return json({ token, expires_in: PARENT_JWT_EXPIRY, family_id: user.family_id });
}