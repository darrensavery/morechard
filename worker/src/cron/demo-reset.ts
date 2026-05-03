/**
 * Nightly demo reset — runs at midnight UTC.
 * Restores the Thomson demo family to its seeded state.
 *
 * Scoped exclusively to family_id = 'demo-family-thomson' and is_demo = 1.
 * Never touches non-demo data.
 */

import { Env } from '../types.js';

const DEMO_FAMILY_ID = 'demo-family-thomson';

export async function runDemoReset(env: Env): Promise<void> {
  // Guard: confirm the family is flagged is_demo before touching anything.
  const family = await env.DB
    .prepare('SELECT is_demo FROM families WHERE id = ?')
    .bind(DEMO_FAMILY_ID)
    .first<{ is_demo: number }>();

  if (!family?.is_demo) return;

  // 1. Delete non-seed chores added by demo users during the day.
  await env.DB
    .prepare('DELETE FROM chores WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 2. Delete ledger entries added after the seed (non-seed rows).
  await env.DB
    .prepare('DELETE FROM ledger WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 3. Restore goal progress to seeded values.
  //    Seed values: ellie trainers 4080p (68%), jake headset 1530p (34%).
  await env.DB
    .prepare(`UPDATE goals SET current_saved_pence = 4080, status = 'ACTIVE', updated_at = unixepoch()
              WHERE id = 'demo-goal-e1'`)
    .run();

  await env.DB
    .prepare(`UPDATE goals SET current_saved_pence = 1530, status = 'ACTIVE', updated_at = unixepoch()
              WHERE id = 'demo-goal-j2'`)
    .run();

  // 4. Restore unlocked_modules to seed state — delete any non-seed rows.
  await env.DB
    .prepare(`DELETE FROM unlocked_modules
              WHERE child_id IN (
                SELECT user_id FROM family_roles WHERE family_id = ? AND role = 'child'
              ) AND is_seed = 0`)
    .bind(DEMO_FAMILY_ID)
    .run();

  // 5. Clear non-seed insight_snapshots so the static briefing is the only one shown.
  await env.DB
    .prepare(`DELETE FROM insight_snapshots
              WHERE family_id = ? AND snapshot_date NOT IN ('2026-W18')`)
    .bind(DEMO_FAMILY_ID)
    .run();

  // 6. Reset any seed chore status changes (e.g. completions left pending).
  //    Completions are stored in a separate table — remove non-seed completions.
  await env.DB
    .prepare(`DELETE FROM completions
              WHERE chore_id IN (
                SELECT id FROM chores WHERE family_id = ? AND is_seed = 1
              )`)
    .bind(DEMO_FAMILY_ID)
    .run();
}
