// worker/src/jobs/familyPurge.ts
//
// Two-stage data purge for deleted families.
//
// Stage 1 — T+30 days (runSoftDeletePurge)
//   For families soft-deleted more than 30 days ago, hard-delete all
//   operational data. The ledger and payment_audit_log are kept because they
//   are retained as pseudonymised records under Art. 6(1)(f) + Art. 17(3)(b)
//   (see docs/governance/lia/lia.md, LIA-3). The families row is reduced to a
//   tombstone (id + deleted_at only) so the 7-year gate can fire.
//
// Stage 2 — T+7 years (runLedgerPurge)
//   For families deleted more than 7 years ago, hard-delete the pseudonymised
//   ledger rows and their associated status log, the payment audit log, and
//   the tombstone itself. 7 years aligns with the UK Limitation Act 1980
//   civil-claims window (see LIA-3 outstanding action).
//
// Both stages are idempotent and safe to re-run.

import type { Env } from '../types.js';

const THIRTY_DAYS_S = 30 * 86_400;
const SEVEN_YEARS_S = 7 * 365 * 86_400; // 220,752,000 seconds (ignores leap years — acceptable)

export async function runSoftDeletePurge(env: Env, nowEpoch: number): Promise<void> {
  const cutoff30 = nowEpoch - THIRTY_DAYS_S;

  // Collect family IDs past the 30-day window that haven't been purged yet.
  // "Not yet purged" = families row still has non-null name (tombstoning sets name to NULL).
  const rows = await env.DB
    .prepare(
      `SELECT id FROM families
       WHERE deleted_at IS NOT NULL
         AND deleted_at < ?
         AND name IS NOT NULL`,
    )
    .bind(cutoff30)
    .all<{ id: string }>();

  if (!rows.results.length) return;

  for (const { id: familyId } of rows.results) {
    // Collect ALL user IDs for this family — parents AND children (the
    // `childIds` name is legacy; the query has never filtered by role).
    // This matters: userKeyedTables below relies on this set covering
    // parent rows too (e.g. analytics_consents belongs to any user, not
    // just children).
    const childRows = await env.DB
      .prepare(`SELECT id FROM users WHERE family_id = ?`)
      .bind(familyId)
      .all<{ id: string }>();
    const childIds = childRows.results.map(r => r.id);

    const batch: D1PreparedStatement[] = [];

    // ── Family-keyed tables (real `family_id` column, verified against the
    // latest CREATE TABLE for each in worker/migrations/*.sql) ────────────
    const familyTables = [
      'chores',
      'goals',
      'completions',
      'bonus_payments',
      'insight_snapshots',
      'child_logins',
      'child_nudges',
      'family_roles',
      'push_subscriptions',
      'parent_messages',
      'payouts',
      'jar_config',
      'jar_movements',
      'give_requests',
      'plans',
      'shared_expenses',
      'spending',
      'payday_log',
      'review_feedback',
      'review_prompt_state',
      'family_governance_log',
    ];
    for (const table of familyTables) {
      batch.push(
        env.DB.prepare(`DELETE FROM ${table} WHERE family_id = ?`).bind(familyId),
      );
    }

    // referral_conversions has no `family_id` column — the purchasing
    // family is stored as `referred_family` (0042_referral_system.sql).
    batch.push(
      env.DB
        .prepare(`DELETE FROM referral_conversions WHERE referred_family = ?`)
        .bind(familyId),
    );

    // referral_clicks has neither `family_id` nor `user_id` — click events
    // are anonymous, pre-signup traffic keyed only by the referral_code
    // being clicked. Derive via this family's own outbound code. Must run
    // before the tombstone UPDATE below nulls `families.referral_code` —
    // it does, since D1 batch statements execute in the order pushed and
    // this is pushed well before the tombstone update.
    batch.push(
      env.DB
        .prepare(
          `DELETE FROM referral_clicks WHERE referral_code = (SELECT referral_code FROM families WHERE id = ?)`,
        )
        .bind(familyId),
    );

    // ── Child-keyed tables ──────────────────────────────────────────
    // Only if there are child rows to avoid a no-op IN () which SQLite rejects.
    if (childIds.length > 0) {
      const placeholders = childIds.map(() => '?').join(',');
      // child_badges and child_streaks (0058_gamification.sql) have no
      // family_id column at all — they're keyed by child_id only.
      const childKeyedTables = [
        'chat_history',
        'unlocked_modules',
        'lesson_completions',
        'module_act_progress',
        'chat_rate_limits',
        'child_badges',
        'child_streaks',
      ];
      for (const table of childKeyedTables) {
        batch.push(
          env.DB
            .prepare(`DELETE FROM ${table} WHERE child_id IN (${placeholders})`)
            .bind(...childIds),
        );
      }
      // user_settings, account_locks, sessions, and most auth tables key on
      // user_id rather than child_id. analytics_consents is also user_id-keyed
      // (0062_analytics_consent.sql has no family_id column) and belongs here
      // because `childIds` covers every family member, not just children.
      //
      // magic_link_attempts (keyed by `email`, 0060_magic_link_attempts.sql)
      // and slt_attempts (keyed by `ip`, 0022_google_oauth.sql) are
      // deliberately NOT purged here: neither table has a user_id column,
      // and by this point in the family-deletion lifecycle `users.email` has
      // already been anonymised to NULL (see the users DELETE below's
      // comment), so email can't be derived either. slt_attempts already has
      // its own generic TTL sweep (see `DELETE FROM slt_attempts WHERE
      // blocked_until < ?` in worker/src/index.ts) that reaps it independent
      // of family identity. magic_link_attempts has no equivalent sweep —
      // rows for a purged family's former email address are NOT covered by
      // this 30-day purge and persist until the rate-limit window naturally
      // ages out via normal read/reset logic in routes/auth.ts.
      const userKeyedTables = [
        'user_settings',
        'account_locks',
        'sessions',
        'magic_link_tokens',
        'email_verify_tokens',
        'upgrade_interest',
        'slt_tokens',
        'analytics_consents',
      ];
      for (const table of userKeyedTables) {
        batch.push(
          env.DB
            .prepare(`DELETE FROM ${table} WHERE user_id IN (${placeholders})`)
            .bind(...childIds),
        );
      }
    }

    // ── Hard-delete users (PII already anonymised at T=0; now remove the rows) ─
    batch.push(
      env.DB.prepare(`DELETE FROM users WHERE family_id = ?`).bind(familyId),
    );

    // ── Ledger status log contains actor_id (user_id) and ip_address ───────────
    // Delete it; the ledger rows themselves are kept as pseudonymised data.
    batch.push(
      env.DB
        .prepare(`DELETE FROM ledger_status_log WHERE ledger_id IN (SELECT id FROM ledger WHERE family_id = ?)`)
        .bind(familyId),
    );

    // ── Tombstone the families row ──────────────────────────────────
    // Set all PII columns to NULL; preserve id and deleted_at for the 7-year gate.
    batch.push(
      env.DB
        .prepare(
          `UPDATE families SET
             name            = NULL,
             home_lat        = NULL,
             home_lng        = NULL,
             referral_code   = NULL,
             referred_by_code = NULL
           WHERE id = ?`,
        )
        .bind(familyId),
    );

    // D1 batch is capped at 100 statements; families with many children could
    // theoretically exceed this, but in practice child counts are ≤ 10.
    await env.DB.batch(batch);
  }
}

export async function runLedgerPurge(env: Env, nowEpoch: number): Promise<void> {
  const cutoff7y = nowEpoch - SEVEN_YEARS_S;

  // Tombstoned families (name IS NULL, deleted_at set) older than 7 years.
  const rows = await env.DB
    .prepare(
      `SELECT id FROM families
       WHERE deleted_at IS NOT NULL
         AND deleted_at < ?
         AND name IS NULL`,
    )
    .bind(cutoff7y)
    .all<{ id: string }>();

  if (!rows.results.length) return;

  for (const { id: familyId } of rows.results) {
    await env.DB.batch([
      // Ledger status log may still have rows if families deleted before this
      // purge job existed (pre-T+30 pass). Belt-and-braces deletion.
      env.DB
        .prepare(`DELETE FROM ledger_status_log WHERE ledger_id IN (SELECT id FROM ledger WHERE family_id = ?)`)
        .bind(familyId),
      // Pseudonymised ledger rows — hard-delete after 7 years.
      env.DB.prepare(`DELETE FROM ledger WHERE family_id = ?`).bind(familyId),
      // Ledger prune archive (historical redacted entries) keyed by family_id.
      env.DB.prepare(`DELETE FROM ledger_prune_archive WHERE family_id = ?`).bind(familyId),
      // Payment audit log — pseudonymous financial record; 7-year accounting window matches.
      env.DB.prepare(`DELETE FROM payment_audit_log WHERE family_id = ?`).bind(familyId),
      // Remove the tombstone itself.
      env.DB.prepare(`DELETE FROM families WHERE id = ?`).bind(familyId),
    ]);
  }
}

/**
 * Stage 1b — T+30 days, single-child DSAR erasures.
 *
 * A child-scope DSAR request anonymises the child's users row immediately
 * (worker/src/lib/dsarExecution.ts::executeChildErasure) and sets
 * purge_pending_at. This sweep hard-deletes the bulk child-keyed tables and
 * the users row itself 30 days later — mirroring the family-scope pattern
 * in runSoftDeletePurge, but scoped to one child instead of a whole family.
 * Ledger rows are NEVER touched: `ledger.child_id` keeps pointing at the
 * same (now-deleted) id, exactly as it already does for family-scope purges.
 */
export async function runChildDsarPurge(env: Env, nowEpoch: number): Promise<void> {
  const cutoff30 = nowEpoch - THIRTY_DAYS_S;

  const rows = await env.DB
    .prepare(`SELECT id FROM users WHERE purge_pending_at IS NOT NULL AND purge_pending_at < ?`)
    .bind(cutoff30)
    .all<{ id: string }>();

  if (!rows.results.length) return;

  for (const { id: childId } of rows.results) {
    const childKeyedTables = [
      'chat_history',
      'unlocked_modules',
      'lesson_completions',
      'module_act_progress',
      'chat_rate_limits',
      'child_badges',
      'child_streaks',
      'child_nudges',
    ];
    const batch: D1PreparedStatement[] = childKeyedTables.map(table =>
      env.DB.prepare(`DELETE FROM ${table} WHERE child_id = ?`).bind(childId),
    );
    // user_settings and account_locks are keyed on user_id, not child_id.
    batch.push(env.DB.prepare(`DELETE FROM user_settings WHERE user_id = ?`).bind(childId));
    batch.push(env.DB.prepare(`DELETE FROM account_locks WHERE user_id = ?`).bind(childId));
    batch.push(env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(childId));
    batch.push(env.DB.prepare(`DELETE FROM family_roles WHERE user_id = ?`).bind(childId));
    batch.push(env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(childId));

    await env.DB.batch(batch);
  }
}
