/**
 * The first (and, as of this writing, only) AUTO-tier tool: resend_magic_link.
 * Fires ONLY via the one-tap approval link in the review-item email
 * (see reviewNotify.ts + routes/agentReview.ts's approve endpoint) — never
 * fully autonomously; the original design ("Confidence and preconditions
 * only ever affect queue sorting/pre-fill — never whether something
 * executes without a human", gating.ts) is preserved: a human still taps
 * approve, the AI just does everything up to that point.
 *
 * Deliberately self-contained — does NOT import from routes/auth.ts.
 * auth.ts has zero test coverage and is the single most critical path in
 * the app; this duplicates its magic-link send logic (rate limit, token,
 * email) rather than risk touching it.
 */
import { Env } from '../../../types.js';
import { registerTool, getTool } from '../registry.js';
import { nanoid } from '../../nanoid.js';
import { sha256 } from '../../hash.js';
import { EmailService } from '../../email.js';

const MAGIC_LINK_MAX = 3;
const MAGIC_LINK_WINDOW = 600; // 10-minute rolling window — matches routes/auth.ts
const MAGIC_LINK_EXPIRY = 15 * 60; // 15 minutes — matches routes/auth.ts

export function isMagicLinkRateLimited(
  attempt: { attempts: number; window_start: number } | null,
  nowSec: number,
): boolean {
  if (!attempt) return false;
  if (nowSec - attempt.window_start >= MAGIC_LINK_WINDOW) return false;
  return attempt.attempts >= MAGIC_LINK_MAX;
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

export function buildMagicLinkResendEmail(
  name: string,
  link: string,
): { subject: string; text: string; html: string } {
  const safeName = escapeHtml(name);
  const subject = 'Your Morechard sign-in link';
  const text = `Hi ${name},\n\nHere's your Morechard sign-in link:\n\n${link}\n\nThis link expires in 15 minutes.\n\n— Morechard`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1a1a1a">
    <p style="font-size:16px;font-weight:700">🌱 Morechard sign-in link</p>
    <p>Hi ${safeName},</p>
    <p><a href="${link}" style="display:inline-block;background:#0f6b4f;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">Sign in to Morechard</a></p>
    <p style="color:#999;font-size:12px">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
  </div>`;
  return { subject, text, html };
}

export interface ResendMagicLinkPayload {
  email: string; // MUST be deterministically-resolved (resolveFamilyIdentity), never model-generated text
}

export interface ResendMagicLinkResult {
  sent: boolean;
  reason?: 'rate_limited' | 'user_not_found';
}

async function resendMagicLinkHandler(
  env: Env,
  payload: ResendMagicLinkPayload,
): Promise<ResendMagicLinkResult> {
  const normEmail = payload.email.toLowerCase().trim();
  const nowSec = Math.floor(Date.now() / 1000);

  const attempt = await env.DB
    .prepare('SELECT attempts, window_start FROM magic_link_attempts WHERE email = ?')
    .bind(normEmail)
    .first<{ attempts: number; window_start: number }>();

  if (isMagicLinkRateLimited(attempt, nowSec)) {
    return { sent: false, reason: 'rate_limited' };
  }

  if (!attempt || nowSec - attempt.window_start >= MAGIC_LINK_WINDOW) {
    await env.DB
      .prepare(`INSERT INTO magic_link_attempts (email, attempts, window_start)
                VALUES (?, 1, ?)
                ON CONFLICT(email) DO UPDATE SET attempts = 1, window_start = excluded.window_start`)
      .bind(normEmail, nowSec)
      .run();
  } else {
    await env.DB
      .prepare('UPDATE magic_link_attempts SET attempts = attempts + 1 WHERE email = ?')
      .bind(normEmail)
      .run();
  }

  const user = await env.DB
    .prepare('SELECT id, display_name FROM users WHERE email = ?')
    .bind(normEmail)
    .first<{ id: string; display_name: string }>();

  if (!user) return { sent: false, reason: 'user_not_found' };

  const rawToken = nanoid(32);
  const tokenHash = await sha256(rawToken);

  await env.DB
    .prepare(`
      INSERT INTO magic_link_tokens (token_hash, user_id, expires_at, request_ip)
      VALUES (?, ?, ?, ?)
    `)
    .bind(tokenHash, user.id, nowSec + MAGIC_LINK_EXPIRY, 'agent-auto-tool')
    .run();

  const appUrl = env.APP_URL ?? 'https://app.morechard.com';
  const link = `${appUrl}/auth/verify?token=${rawToken}`;
  const { subject, text, html } = buildMagicLinkResendEmail(user.display_name, link);

  await new EmailService(env).sendTransactional({ to: normEmail, subject, html, text });

  return { sent: true };
}

/**
 * Idempotent — safe to call from every request path that might need to
 * invoke an AUTO tool (processIncident.ts's queue consumer AND
 * routes/agentApprove.ts's standalone fetch handler both call this; they
 * don't share module state across isolate boundaries, so each call site
 * must be able to call this without risking the "already registered"
 * throw from a prior call in the same isolate).
 */
export function registerAutoTools(): void {
  if (getTool('resend_magic_link')) return;
  registerTool({
    name: 'resend_magic_link',
    tier: 'auto',
    description: 'Resends a sign-in magic link to a deterministically-resolved parent email',
    handler: resendMagicLinkHandler,
  });
}
