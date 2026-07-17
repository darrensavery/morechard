// Shared erasure logic used by both the authenticated Uproot flow
// (worker/src/routes/auth.ts::handleDeleteFamily) and the public DSAR
// portal (worker/src/routes/dsar.ts). Extracted so the two entry points
// can never drift.
//
// Ledger rows (`ledger`, `ledger_status_log`) are NEVER touched here — the
// hash chain is preserved by anonymising the referenced `users` row only;
// `ledger.child_id` keeps pointing at the same immutable id forever.
//
// See docs/superpowers/specs/2026-07-17-dsar-portal-design.md

import type { Env } from '../types.js';

export interface ChildMatchResult {
  matched: 'none' | 'ambiguous' | 'one';
  childId?: string;
}

/** Resolves a free-text child display name to exactly one child, scoped to a family. */
export async function resolveChildByName(
  env: Env,
  familyId: string,
  rawName: string,
): Promise<ChildMatchResult> {
  const trimmed = rawName.trim().toLowerCase();
  const rows = await env.DB
    .prepare(
      `SELECT u.id FROM users u
       JOIN family_roles fr ON fr.user_id = u.id AND fr.family_id = u.family_id
       WHERE u.family_id = ? AND fr.role = 'child' AND LOWER(TRIM(u.display_name)) = ?`,
    )
    .bind(familyId, trimmed)
    .all<{ id: string }>();

  if (rows.results.length === 0) return { matched: 'none' };
  if (rows.results.length > 1) return { matched: 'ambiguous' };
  return { matched: 'one', childId: rows.results[0].id };
}

/** Whole-family erasure where the requester is the sole parent (no co-parent exists). */
export async function executeFamilyErasureSoleParent(env: Env, familyId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`UPDATE families SET deleted_at = unixepoch() WHERE id = ?`).bind(familyId),
    env.DB.prepare(
      `UPDATE users SET display_name = 'Deleted User', email = NULL, email_pending = NULL, password_hash = NULL, pin_hash = NULL WHERE family_id = ?`,
    ).bind(familyId),
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = unixepoch() WHERE user_id IN (SELECT id FROM users WHERE family_id = ?) AND revoked_at IS NULL`,
    ).bind(familyId),
    env.DB.prepare(`DELETE FROM invite_codes WHERE family_id = ?`).bind(familyId),
    env.DB.prepare(`DELETE FROM registration_progress WHERE family_id = ?`).bind(familyId),
  ]);
}

/**
 * Whole-family erasure where the requester is the LEAD and a co-parent remains.
 * Promotes the co-parent to lead BEFORE anonymising the departing lead's row,
 * in the same D1 batch — so there is never a window where the row being
 * anonymised still holds the lead flag (which would orphan the family or
 * lose track of who to promote). Family, ledger, and children are otherwise
 * untouched.
 */
export async function executeFamilyErasureLeadWithCoparent(
  env: Env,
  familyId: string,
  departingLeadUserId: string,
): Promise<{ promotedUserId: string } | { error: string }> {
  const coparent = await env.DB
    .prepare(
      `SELECT user_id FROM family_roles WHERE family_id = ? AND role = 'parent' AND parent_role = 'co_parent' AND user_id != ? LIMIT 1`,
    )
    .bind(familyId, departingLeadUserId)
    .first<{ user_id: string }>();

  if (!coparent) return { error: 'No co-parent found to promote' };

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE family_roles SET parent_role = 'lead' WHERE family_id = ? AND user_id = ? AND role = 'parent'`,
    ).bind(familyId, coparent.user_id),
    env.DB.prepare(
      `UPDATE family_roles SET parent_role = NULL WHERE family_id = ? AND user_id = ? AND role = 'parent'`,
    ).bind(familyId, departingLeadUserId),
    env.DB.prepare(
      `UPDATE users SET display_name = 'Deleted User', email = NULL, email_pending = NULL, password_hash = NULL, pin_hash = NULL WHERE id = ?`,
    ).bind(departingLeadUserId),
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = unixepoch() WHERE user_id = ? AND revoked_at IS NULL`,
    ).bind(departingLeadUserId),
  ]);

  return { promotedUserId: coparent.user_id };
}

/** Non-lead co-parent leaving via a DSAR request. Mirrors handleLeaveFamily's anonymisation. */
export async function executeFamilyErasureNonLeadCoparent(
  env: Env,
  familyId: string,
  userId: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET display_name = 'Deleted User', email = NULL, email_pending = NULL, password_hash = NULL, pin_hash = NULL WHERE id = ?`,
    ).bind(userId),
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = unixepoch() WHERE user_id = ? AND revoked_at IS NULL`,
    ).bind(userId),
    env.DB.prepare(`DELETE FROM family_roles WHERE user_id = ? AND family_id = ?`).bind(userId, familyId),
  ]);
}

/**
 * Single-child erasure. Writes only the identity-state (users row) synchronously
 * — bulk child-keyed tables (chat_history, progress, etc.) are swept later by
 * runChildDsarPurge (worker/src/jobs/familyPurge.ts) at T+30 days, to stay
 * within D1 transaction/statement limits. Ledger rows are NEVER touched.
 */
export async function executeChildErasure(env: Env, childUserId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET display_name = 'Deleted Child', purge_pending_at = unixepoch() WHERE id = ?`,
    ).bind(childUserId),
  ]);
}
