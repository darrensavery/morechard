import type { D1Database } from '@cloudflare/workers-types';

export interface JarConfigRow {
  enabled: number;   // 0|1
  spend_pct: number;
  save_pct: number;
  give_pct: number;
  updated_at: number;
}

export interface JarBalances {
  enabled: boolean;
  spend: number;
  save: number;
  give: number;
  save_earmarked: number;   // pence earmarked for active goals within Save
  save_unallocated: number; // save - save_earmarked
}

export interface JarSignals {
  enabled: boolean;
  spend_pct: number;
  save_pct: number;
  give_pct: number;
  manual_move_count: number;
  save_raids: number;
  give_balance_age_days: number;
  auto_off_weeks: number;
  deviation_score: number;
  weeks_at_current_deviation: number;
  positive_streak_weeks: number;
}

const DEFAULT_CONFIG: JarConfigRow = {
  enabled: 0, spend_pct: 70, save_pct: 20, give_pct: 10,
  updated_at: 0,
};

export async function getJarConfig(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<JarConfigRow> {
  const row = await db
    .prepare('SELECT enabled, spend_pct, save_pct, give_pct, updated_at FROM jar_config WHERE family_id = ? AND child_id = ?')
    .bind(familyId, childId)
    .first<JarConfigRow>();
  return row ?? DEFAULT_CONFIG;
}

export async function getGoalEarmarked(
  db: D1Database,
  childId: string,
): Promise<number> {
  const earmarkRow = await db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN kind='goal_allocate'   THEN earmark_pence ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN kind='goal_deallocate' THEN earmark_pence ELSE 0 END), 0)
        AS net_earmarked
      FROM jar_movements
      WHERE child_id = ? AND kind IN ('goal_allocate','goal_deallocate')
        AND goal_id IN (SELECT id FROM goals WHERE child_id = ? AND status = 'ACTIVE')
    `)
    .bind(childId, childId)
    .first<{ net_earmarked: number }>();

  return Math.max(0, earmarkRow?.net_earmarked ?? 0);
}

export async function getJarBalances(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<JarBalances> {
  const config = await getJarConfig(db, familyId, childId);

  if (!config.enabled) {
    return { enabled: false, spend: 0, save: 0, give: 0, save_earmarked: 0, save_unallocated: 0 };
  }

  // SUM delta per jar — the authoritative balance
  const rows = await db
    .prepare(`
      SELECT jar, SUM(delta) AS total
      FROM jar_movements
      WHERE family_id = ? AND child_id = ?
      GROUP BY jar
    `)
    .bind(familyId, childId)
    .all<{ jar: string; total: number }>();

  const totals: Record<string, number> = { spend: 0, save: 0, give: 0 };
  for (const r of rows.results) totals[r.jar] = r.total ?? 0;

  const saveEarmarked = await getGoalEarmarked(db, childId);

  return {
    enabled:          true,
    spend:            totals.spend,
    save:             totals.save,
    give:             totals.give,
    save_earmarked:   saveEarmarked,
    save_unallocated: Math.max(0, totals.save - saveEarmarked),
  };
}

export async function computeJarSignals(
  db: D1Database,
  childId: string,
  familyId: string,
  now: number,
): Promise<JarSignals> {
  const config = await getJarConfig(db, familyId, childId);
  const oneWeekAgo  = now - 7 * 86400;

  // Manual moves this week
  const movesRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM jar_movements WHERE child_id = ? AND kind = 'manual_move' AND created_at >= ?`)
    .bind(childId, oneWeekAgo)
    .first<{ cnt: number }>();

  // Save-raids this week (Save→Spend manual moves = negative delta on save, positive on spend in same pair)
  // We detect by looking for manual_move rows on jar='save' with negative delta in the last 7 days
  const raidsRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM jar_movements WHERE child_id = ? AND kind = 'manual_move' AND jar = 'save' AND delta < 0 AND created_at >= ?`)
    .bind(childId, oneWeekAgo)
    .first<{ cnt: number }>();

  // Give balance age: how long since Give jar was last drawn down
  const lastGiveOut = await db
    .prepare(`SELECT MAX(created_at) AS last FROM jar_movements WHERE child_id = ? AND jar = 'give' AND delta < 0`)
    .bind(childId)
    .first<{ last: number | null }>();
  const giveBalanceAgeDays = lastGiveOut?.last
    ? Math.floor((now - lastGiveOut.last) / 86400)
    : 999;

  // Auto-off weeks: count ISO weeks in last 8 weeks with no allocation movements
  // (simplified: weeks since last allocation movement / 7)
  const lastAlloc = await db
    .prepare(`SELECT MAX(created_at) AS last FROM jar_movements WHERE child_id = ? AND kind = 'allocation'`)
    .bind(childId)
    .first<{ last: number | null }>();
  const autoOffWeeks = config.enabled
    ? 0
    : lastAlloc?.last
      ? Math.floor((now - lastAlloc.last) / (7 * 86400))
      : 99;

  // Deviation score: weighted distance from 70/20/10
  const deviationScore = Math.min(100, Math.round(
    Math.abs(config.spend_pct - 70) * 0.4 +
    Math.abs(config.save_pct  - 20) * 0.4 +
    Math.abs(config.give_pct  - 10) * 0.2,
  ));

  // weeks_at_current_deviation and positive_streak_weeks require snapshot history —
  // computed from insight_snapshots in the insights route where snapshots are available.
  // Return 0 here; the insights route will override from snapshot history.

  return {
    enabled:                   !!config.enabled,
    spend_pct:                 config.spend_pct,
    save_pct:                  config.save_pct,
    give_pct:                  config.give_pct,
    manual_move_count:         movesRow?.cnt ?? 0,
    save_raids:                raidsRow?.cnt ?? 0,
    give_balance_age_days:     giveBalanceAgeDays,
    auto_off_weeks:            autoOffWeeks,
    deviation_score:           deviationScore,
    weeks_at_current_deviation: 0,
    positive_streak_weeks:      0,
  };
}
