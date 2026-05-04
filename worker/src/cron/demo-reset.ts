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

  // 2. Delete non-seed ledger entries.
  await env.DB
    .prepare('DELETE FROM ledger WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 3. Delete non-seed completions (seed completions have is_seed = 1).
  await env.DB
    .prepare('DELETE FROM completions WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 4. Delete non-seed spending records.
  await env.DB
    .prepare('DELETE FROM spending WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 5. Delete non-seed shared expenses.
  await env.DB
    .prepare('DELETE FROM shared_expenses WHERE family_id = ? AND is_seed = 0')
    .bind(DEMO_FAMILY_ID)
    .run();

  // 6. Restore goal progress to seeded values.
  //    Seed values: ellie trainers 4080p (68%), jake headset 1530p (34%).
  await env.DB
    .prepare(`UPDATE goals SET current_saved_pence = 4080, status = 'ACTIVE', updated_at = unixepoch()
              WHERE id = 'demo-goal-e1'`)
    .run();

  await env.DB
    .prepare(`UPDATE goals SET current_saved_pence = 1530, status = 'ACTIVE', updated_at = unixepoch()
              WHERE id = 'demo-goal-j2'`)
    .run();

  // 7. Restore unlocked_modules to seed state — delete any non-seed rows.
  await env.DB
    .prepare(`DELETE FROM unlocked_modules
              WHERE child_id IN (
                SELECT user_id FROM family_roles WHERE family_id = ? AND role = 'child'
              ) AND is_seed = 0`)
    .bind(DEMO_FAMILY_ID)
    .run();

  // 8. Keep only the two canonical week snapshots (W18 and W19).
  //    W19 observation is pre-seeded; a live AI call may overwrite it during the day
  //    but the seed values are restored each night.
  await env.DB
    .prepare(`DELETE FROM insight_snapshots
              WHERE family_id = ? AND snapshot_date NOT IN ('2026-W18', '2026-W19')`)
    .bind(DEMO_FAMILY_ID)
    .run();

  // Restore W19 briefing to pre-seeded values so demo always shows a rich AI summary.
  await env.DB
    .prepare(`UPDATE insight_snapshots
              SET consistency_score = 85, responsibility_score = 87, planning_horizon = 72,
                  total_earned_pence = 27500,
                  observation = 'Ellie has completed 30 chores over 6 months with a first-time pass rate of 87% — she rarely needs to redo work. Her consistency score of 85 reflects steady, predictable weekly effort.',
                  behavioral_root = 'Pillar 2 (Deferred Gratification) — Ellie demonstrates patient, goal-directed earning. Every penny earned is tracked against her trainers goal and she has not dipped into savings once.',
                  the_nudge = 'Ellie is on track to reach her trainers goal within 3 weeks at current pace. A small parent match of £5 on the final stretch would reinforce that consistent effort earns meaningful rewards.'
              WHERE child_id = 'demo-child-ellie' AND snapshot_date = '2026-W19'`)
    .run();

  await env.DB
    .prepare(`UPDATE insight_snapshots
              SET consistency_score = 72, responsibility_score = 80, planning_horizon = 45,
                  total_earned_pence = 16750,
                  observation = 'Jake has completed 20 chores over 6 months with a first-time pass rate of 80%. His consistency score of 72 shows he is generally reliable but has occasional quiet weeks.',
                  behavioral_root = 'Pillar 1 (Earning & Effort) — Jake understands the earning loop and responds well to clear, concrete chore assignments. He is building the habit of regular contribution.',
                  the_nudge = 'Jake has £15.30 saved toward his gaming headset — he is 21% of the way there. Setting a visible countdown (e.g. a sticker chart or app goal progress) could boost his motivation over the next month.'
              WHERE child_id = 'demo-child-jake' AND snapshot_date = '2026-W19'`)
    .run();
}
