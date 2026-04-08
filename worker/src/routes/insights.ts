/**
 * Insights route — worker-side SQL aggregates for parent behavioural dashboard.
 *
 * GET /api/insights?family_id=&child_id=&period=week|month|all
 *
 * Returns:
 *   isDiscoveryPhase        — true when < 3 completed tasks or < 7 days of history
 *   first_time_pass_rate    — % approved on first attempt (0–100 | null)
 *   consistency_score       — stability of weekly task volume over 28 days (0–100 | null)
 *   effort_preference       — 'high_yield' | 'steady' | null
 *   planning_horizon        — % of earned value locked in goals vs available (0–100 | null)
 *   savings_consistency     — % of (spent+saved) that went to goals (0–100 | null)
 *   tasks_completed         — total completed in period
 *   tasks_revised           — needed at least one revision
 *   total_earned_pence      — sum of ledger credits in period
 *   total_spent_pence       — sum of spending records in period
 *   total_saved_pence       — sum of goal contributions in period
 *   available_balance_pence — child's current spendable balance
 *   lifetime_earned_pence   — all-time ledger credits
 *   goals_locked_pence      — sum of (target - saved) across active goals
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ----------------------------------------------------------------
// GET /api/insights
// ----------------------------------------------------------------
export async function handleInsights(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  const url  = new URL(request.url);

  const family_id = url.searchParams.get('family_id');
  const child_id  = url.searchParams.get('child_id');
  const period    = url.searchParams.get('period') ?? 'week';

  if (!family_id) return error('family_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);

  const effectiveChildId = auth.role === 'child' ? auth.sub : child_id;
  if (!effectiveChildId) return error('child_id required');
  if (auth.role === 'child' && effectiveChildId !== auth.sub) return error('Forbidden', 403);

  const periodStart = getPeriodStart(period);
  const now         = Math.floor(Date.now() / 1000);

  // ── 1. First-Time Pass Rate ───────────────────────────────────────────────
  const passRateRow = await env.DB.prepare(`
    SELECT
      COUNT(*)                                            AS total_completed,
      SUM(CASE WHEN attempt_count = 1 THEN 1 ELSE 0 END) AS first_time_passes,
      MIN(resolved_at)                                    AS earliest_resolved
    FROM completions
    WHERE family_id = ? AND child_id = ? AND status = 'completed'
      AND (? = 0 OR resolved_at >= ?)
  `).bind(family_id, effectiveChildId, periodStart, periodStart)
    .first<{ total_completed: number; first_time_passes: number; earliest_resolved: number | null }>();

  const totalCompleted    = passRateRow?.total_completed  ?? 0;
  const firstTimePasses   = passRateRow?.first_time_passes ?? 0;
  const earliestResolved  = passRateRow?.earliest_resolved ?? null;
  const tasksRevised      = totalCompleted - firstTimePasses;

  const firstTimePassRate = totalCompleted > 0
    ? Math.round((firstTimePasses / totalCompleted) * 100)
    : null;

  // ── 2. Discovery Phase Flag ───────────────────────────────────────────────
  // < 3 completed tasks all-time OR < 7 days since first completion
  const allTimeRow = await env.DB.prepare(`
    SELECT COUNT(*) AS total FROM completions
    WHERE family_id = ? AND child_id = ? AND status = 'completed'
  `).bind(family_id, effectiveChildId)
    .first<{ total: number }>();

  const allTimeCompleted  = allTimeRow?.total ?? 0;
  const daysSinceFirst    = earliestResolved ? (now - earliestResolved) / 86400 : 0;
  const isDiscoveryPhase  = allTimeCompleted < 3 || daysSinceFirst < 7;

  // ── 3. Consistency Score (28-day weekly volume stability) ─────────────────
  // Group completed tasks into 4 weekly buckets (last 28 days).
  // Score = 100 - (coefficient_of_variation * 100), clamped 0–100.
  // CoV = stddev / mean. If mean = 0, score = 0.
  const twentyEightDaysAgo = now - 28 * 86400;

  const weeklyRows = await env.DB.prepare(`
    SELECT
      CAST((resolved_at - ?) / (7 * 86400) AS INTEGER) AS week_bucket,
      COUNT(*) AS cnt
    FROM completions
    WHERE family_id = ? AND child_id = ? AND status = 'completed'
      AND resolved_at >= ?
    GROUP BY week_bucket
  `).bind(twentyEightDaysAgo, family_id, effectiveChildId, twentyEightDaysAgo)
    .all<{ week_bucket: number; cnt: number }>();

  let consistencyScore: number | null = null;
  if (!isDiscoveryPhase) {
    // Fill all 4 buckets (0–3), defaulting missing weeks to 0
    const buckets = [0, 0, 0, 0];
    for (const row of weeklyRows.results) {
      const idx = Math.min(3, Math.max(0, row.week_bucket));
      buckets[idx] = row.cnt;
    }
    const mean = buckets.reduce((s, v) => s + v, 0) / 4;
    if (mean === 0) {
      consistencyScore = 0;
    } else {
      const variance = buckets.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 4;
      const stddev   = Math.sqrt(variance);
      const cov      = stddev / mean; // 0 = perfectly consistent, higher = more volatile
      consistencyScore = Math.max(0, Math.min(100, Math.round((1 - cov) * 100)));
    }
  }

  // ── 4. Effort Preference ─────────────────────────────────────────────────
  // Compare child's avg reward vs family avg. Requires ≥ 3 completions.
  let effortPreference: 'high_yield' | 'steady' | null = null;
  if (allTimeCompleted >= 3) {
    const [childAvgRow, familyAvgRow] = await Promise.all([
      env.DB.prepare(`
        SELECT AVG(reward_amount) AS avg_reward FROM completions
        WHERE family_id = ? AND child_id = ? AND status = 'completed'
      `).bind(family_id, effectiveChildId)
        .first<{ avg_reward: number | null }>(),
      env.DB.prepare(`
        SELECT AVG(reward_amount) AS avg_reward FROM completions
        WHERE family_id = ? AND status = 'completed'
      `).bind(family_id)
        .first<{ avg_reward: number | null }>(),
    ]);

    const childAvg  = childAvgRow?.avg_reward  ?? 0;
    const familyAvg = familyAvgRow?.avg_reward ?? 0;

    if (familyAvg > 0) {
      effortPreference = childAvg >= familyAvg * 1.1 ? 'high_yield' : 'steady';
    } else if (childAvg > 0) {
      effortPreference = 'steady';
    }
  }

  // ── 5. Financial Metrics ─────────────────────────────────────────────────
  const [earnedRow, spentRow, savedRow, balanceRow, lifetimeRow, goalsRow] = await Promise.all([
    env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
      WHERE family_id = ? AND child_id = ? AND entry_type = 'credit'
        AND (? = 0 OR created_at >= ?)
    `).bind(family_id, effectiveChildId, periodStart, periodStart)
      .first<{ total: number }>(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM spending
      WHERE family_id = ? AND child_id = ?
        AND (? = 0 OR spent_at >= ?)
    `).bind(family_id, effectiveChildId, periodStart, periodStart)
      .first<{ total: number }>(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount_pence), 0) AS total FROM goal_contributions
      WHERE family_id = ? AND child_id = ?
        AND (? = 0 OR contributed_at >= ?)
    `).bind(family_id, effectiveChildId, periodStart, periodStart)
      .first<{ total: number }>()
      .catch(() => ({ total: 0 })),

    // Available balance: sum of credits minus debits from ledger
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) AS available
      FROM ledger
      WHERE family_id = ? AND child_id = ?
    `).bind(family_id, effectiveChildId)
      .first<{ available: number }>(),

    // Lifetime earned
    env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
      WHERE family_id = ? AND child_id = ? AND entry_type = 'credit'
    `).bind(family_id, effectiveChildId)
      .first<{ total: number }>(),

    // Goals locked = sum of (target - current_saved) for active, non-archived goals
    env.DB.prepare(`
      SELECT COALESCE(SUM(target_amount - current_saved_pence), 0) AS locked
      FROM goals
      WHERE family_id = ? AND child_id = ? AND archived = 0
        AND target_amount > current_saved_pence
    `).bind(family_id, effectiveChildId)
      .first<{ locked: number }>()
      .catch(() => ({ locked: 0 })),
  ]);

  const totalEarned   = earnedRow?.total     ?? 0;
  const totalSpent    = spentRow?.total      ?? 0;
  const totalSaved    = savedRow?.total      ?? 0;
  const availableBal  = balanceRow?.available ?? 0;
  const lifetimeEarned = lifetimeRow?.total  ?? 0;
  const goalsLocked   = goalsRow?.locked     ?? 0;

  const savingsConsistency = (totalSpent + totalSaved) > 0
    ? Math.round((totalSaved / (totalSpent + totalSaved)) * 100)
    : null;

  // ── 6. Planning Horizon ───────────────────────────────────────────────────
  // % of (available + goals_locked) that is locked in goals.
  // Measures whether child is a planner or a spender.
  let planningHorizon: number | null = null;
  if (!isDiscoveryPhase) {
    const totalHeld = availableBal + goalsLocked;
    planningHorizon = totalHeld > 0
      ? Math.max(0, Math.min(100, Math.round((goalsLocked / totalHeld) * 100)))
      : 0;
  }

  return json({
    period,
    period_start_epoch: periodStart || null,
    child_id: effectiveChildId,

    // Discovery state
    is_discovery_phase: isDiscoveryPhase,
    all_time_completed: allTimeCompleted,

    // Behavioural KPIs (null = insufficient data)
    first_time_pass_rate: firstTimePassRate,
    consistency_score:    consistencyScore,
    effort_preference:    effortPreference,
    planning_horizon:     planningHorizon,

    // Financial behaviour
    savings_consistency:  savingsConsistency,
    tasks_completed:      totalCompleted,
    tasks_revised:        tasksRevised,
    total_earned_pence:   totalEarned,
    total_spent_pence:    totalSpent,
    total_saved_pence:    totalSaved,

    // Balance bar data (always present)
    available_balance_pence: Math.max(0, availableBal),
    lifetime_earned_pence:   lifetimeEarned,
    goals_locked_pence:      goalsLocked,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodStart(period: string): number {
  const now = new Date();
  if (period === 'week') {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    return Math.floor(mon.getTime() / 1000);
  }
  if (period === 'month') {
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  }
  return 0;
}
