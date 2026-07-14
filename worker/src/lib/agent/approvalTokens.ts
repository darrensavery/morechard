/**
 * Single-use, time-limited approval tokens for the one-tap "Approve" link
 * in the review-item email (reviewNotify.ts). Deliberately separate from
 * auth.ts's magic_link_tokens — this is an approval primitive, not the
 * login flow, and auth.ts has zero test coverage and is the single most
 * critical path in the app; nothing here touches it.
 */
import { Env } from '../../types.js';
import { nanoid } from '../nanoid.js';
import { sha256 } from '../hash.js';

export const APPROVAL_TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 hours

export async function hashApprovalToken(rawToken: string): Promise<string> {
  return sha256(rawToken);
}

/**
 * Generates and persists a fresh approval token for a review item. Returns
 * the RAW token — only ever placed in the email link, never stored.
 */
export async function generateApprovalToken(env: Env, reviewItemId: string): Promise<string> {
  const rawToken = nanoid(32);
  const tokenHash = await hashApprovalToken(rawToken);
  const now = Math.floor(Date.now() / 1000);

  await env.DB
    .prepare(`
      INSERT INTO agent_approval_tokens (token_hash, review_item_id, expires_at)
      VALUES (?, ?, ?)
    `)
    .bind(tokenHash, reviewItemId, now + APPROVAL_TOKEN_TTL_SECONDS)
    .run();

  return rawToken;
}

export interface ApprovalTokenCheckResult {
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'already_used' | 'review_item_mismatch';
}

/**
 * Verifies a raw token against a specific review item, without consuming
 * it. Callers should verify, then act, then call consumeApprovalToken —
 * kept as two steps so a caller can bail out (e.g. review item already
 * decided by another path) after verification without burning the token.
 */
export async function checkApprovalToken(
  env: Env,
  reviewItemId: string,
  rawToken: string,
): Promise<ApprovalTokenCheckResult> {
  const tokenHash = await hashApprovalToken(rawToken);
  const row = await env.DB
    .prepare('SELECT review_item_id, expires_at, used_at FROM agent_approval_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ review_item_id: string; expires_at: number; used_at: number | null }>();

  if (!row) return { valid: false, reason: 'not_found' };
  if (row.review_item_id !== reviewItemId) return { valid: false, reason: 'review_item_mismatch' };
  if (row.used_at !== null) return { valid: false, reason: 'already_used' };
  if (row.expires_at < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };

  return { valid: true };
}

export async function consumeApprovalToken(env: Env, rawToken: string): Promise<void> {
  const tokenHash = await hashApprovalToken(rawToken);
  await env.DB
    .prepare('UPDATE agent_approval_tokens SET used_at = unixepoch() WHERE token_hash = ?')
    .bind(tokenHash)
    .run();
}
