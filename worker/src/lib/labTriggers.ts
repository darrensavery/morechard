// worker/src/lib/labTriggers.ts
// Evaluates Learning Lab unlock conditions and writes to unlocked_modules.
// All functions are idempotent — INSERT OR IGNORE prevents duplicate unlocks.
// All calls from route handlers should use .catch(() => {}) to avoid blocking responses.

import type { D1Database } from '@cloudflare/workers-types'
import { nanoid } from './nanoid.js'

// ── Core helpers ───────────────────────────────────────────────────────────────

export async function unlock(db: D1Database, childId: string, slug: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.prepare(
    `INSERT OR IGNORE INTO unlocked_modules (id, child_id, module_slug, unlocked_at)
     VALUES (?, ?, ?, ?)`
  ).bind(nanoid(), childId, slug, now).run()
}

async function isUnlocked(db: D1Database, childId: string, slug: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT id FROM unlocked_modules WHERE child_id = ? AND module_slug = ?`
  ).bind(childId, slug).first()
  return !!row
}

// ── evaluateOnChoreApproval ────────────────────────────────────────────────────
// Call after every chore approval (ledger credit write).

export async function evaluateOnChoreApproval(db: D1Database, childId: string): Promise<void> {
  const [earningsRow, avgRow, distinctRow] = await Promise.all([
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
       WHERE child_id = ? AND entry_type = 'credit' AND verification_status != 'reversed'`
    ).bind(childId).first<{ total: number }>(),
    db.prepare(
      `SELECT AVG(amount) AS avg FROM (
         SELECT amount FROM ledger WHERE child_id = ? AND entry_type = 'credit'
         AND verification_status IN ('verified_auto','verified_manual')
         ORDER BY created_at DESC LIMIT 5
       )`
    ).bind(childId).first<{ avg: number | null }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT chore_id) AS cnt FROM ledger
       WHERE child_id = ? AND entry_type = 'credit'`
    ).bind(childId).first<{ cnt: number }>(),
  ])

  const lifetimeEarnings = earningsRow?.total ?? 0
  const avgChoreValue    = avgRow?.avg ?? 0
  const distinctChores   = distinctRow?.cnt ?? 0

  // M2 — Taxes & Net Pay: cumulative >= £20 (2000 pence)
  if (lifetimeEarnings >= 2000) await unlock(db, childId, 'M2')

  // M13 — Stocks & Shares: cumulative >= £100 (10000 pence)
  if (lifetimeEarnings >= 10000) await unlock(db, childId, 'M13')

  // M3 — Entrepreneurship: 10+ distinct chore types AND avg > £3 (300 pence)
  if (distinctChores >= 10 && avgChoreValue > 300) await unlock(db, childId, 'M3')

  // M3b — Gig Trap: earnings variance > 40% week-on-week over last 4 weeks
  const weeklyRows = await db.prepare(
    `SELECT strftime('%Y-%W', datetime(created_at, 'unixepoch')) AS wk,
            SUM(amount) AS total
     FROM ledger
     WHERE child_id = ? AND entry_type = 'credit'
       AND created_at >= strftime('%s', 'now', '-28 days')
     GROUP BY wk ORDER BY wk`
  ).bind(childId).all<{ wk: string; total: number }>()

  if ((weeklyRows.results ?? []).length >= 4) {
    const vals   = weeklyRows.results.map(r => r.total)
    const avg    = vals.reduce((a, b) => a + b, 0) / vals.length
    const stddev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length)
    if (avg > 0 && stddev / avg > 0.40) await unlock(db, childId, 'M3b')
  }
}

// ── evaluatePassive ────────────────────────────────────────────────────────────
// Call on balance load or nightly cron for inactivity/streak conditions.

export async function evaluatePassive(db: D1Database, childId: string): Promise<void> {
  // M14 — Inflation: no transaction in 21 days
  const lastTxRow = await db.prepare(
    `SELECT MAX(created_at) AS last FROM ledger WHERE child_id = ?`
  ).bind(childId).first<{ last: number | null }>()

  const daysSinceTx = lastTxRow?.last
    ? (Date.now() / 1000 - lastTxRow.last) / 86400
    : 999

  if (daysSinceTx >= 21) await unlock(db, childId, 'M14')

  // M8 — Banking 101: current balance >= £30 (3000 pence)
  const balRow = await db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS bal
     FROM ledger WHERE child_id = ? AND verification_status != 'reversed'`
  ).bind(childId).first<{ bal: number }>()

  if ((balRow?.bal ?? 0) >= 3000) await unlock(db, childId, 'M8')

  // M9b — The Snowball: active goal AND current_streak >= 4
  const [activeGoalRow, streakRow] = await Promise.all([
    db.prepare(`SELECT id FROM goals WHERE child_id = ? AND archived = 0 LIMIT 1`).bind(childId).first(),
    db.prepare(`SELECT current_streak FROM child_streaks WHERE child_id = ?`).bind(childId).first<{ current_streak: number }>(),
  ])
  if (activeGoalRow && (streakRow?.current_streak ?? 0) >= 4) {
    await unlock(db, childId, 'M9b')
  }

  // M11 — Credit Scores: reliability >= 90% over last 8 weeks (minimum 10 completions)
  const relRow = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS passed
     FROM completions
     WHERE child_id = ?
       AND status IN ('completed','rejected','needs_revision')
       AND created_at >= strftime('%s', 'now', '-56 days')`
  ).bind(childId).first<{ total: number; passed: number }>()

  if (relRow && relRow.total >= 10 && (relRow.passed / relRow.total) >= 0.90) {
    await unlock(db, childId, 'M11')
  }
}

// ── evaluateOnGoalCreate ───────────────────────────────────────────────────────
// Call after a goal is created.

export async function evaluateOnGoalCreate(
  db: D1Database,
  childId: string,
  category: string,
  targetDate: string | null,
): Promise<void> {
  // M17 — Digital Currency: first goal in gaming category
  if (category === 'gaming') {
    const countRow = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM goals WHERE child_id = ? AND category = 'gaming'`
    ).bind(childId).first<{ cnt: number }>()
    if ((countRow?.cnt ?? 0) <= 1) await unlock(db, childId, 'M17')
  }

  // M15 — Risk & Diversification: 3+ active goals with at least one long-term (>90 days)
  const activeRow = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM goals WHERE child_id = ? AND archived = 0 AND status = 'ACTIVE'`
  ).bind(childId).first<{ cnt: number }>()

  if ((activeRow?.cnt ?? 0) >= 3 && targetDate) {
    const daysUntil = (new Date(targetDate).getTime() - Date.now()) / 86400000
    if (daysUntil > 90) await unlock(db, childId, 'M15')
  }
}

// ── evaluateOnGoalCancel ───────────────────────────────────────────────────────
// Call when a goal is archived/cancelled.

export async function evaluateOnGoalCancel(
  db: D1Database,
  childId: string,
  goalCreatedAt: number,
): Promise<void> {
  // M9 — Opportunity Cost: goal cancelled after a payment within the same 14-day window
  const windowEnd  = Math.floor(Date.now() / 1000)
  const daysDiff   = (windowEnd - goalCreatedAt) / 86400

  if (daysDiff <= 14) {
    const competingRow = await db.prepare(
      `SELECT id FROM ledger
       WHERE child_id = ? AND entry_type = 'payment'
         AND created_at BETWEEN ? AND ? LIMIT 1`
    ).bind(childId, goalCreatedAt, windowEnd).first()

    if (competingRow) await unlock(db, childId, 'M9')
  }
}

// ── evaluateOnGoalPurchase ─────────────────────────────────────────────────────
// Call when a goal is marked as purchased.

export async function evaluateOnGoalPurchase(db: D1Database, childId: string): Promise<void> {
  // M6 — Advertising & Influence: 3+ payments in same non-essential category within 30 days
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400
  const purchaseRow = await db.prepare(
    `SELECT category, COUNT(*) AS cnt
     FROM ledger
     WHERE child_id = ? AND entry_type = 'payment' AND created_at >= ?
     GROUP BY category HAVING cnt >= 3 LIMIT 1`
  ).bind(childId, thirtyDaysAgo).first<{ category: string; cnt: number }>()

  if (purchaseRow) await unlock(db, childId, 'M6')

  // M10 — Interest Trap: also fires when parental loan requested (handled separately)
  // M12 — Good vs Bad Debt: requires M10 complete AND an 'asset' goal
  if (await isUnlocked(db, childId, 'M10')) {
    const assetGoalRow = await db.prepare(
      `SELECT id FROM goals WHERE child_id = ? AND category = 'asset' LIMIT 1`
    ).bind(childId).first()
    if (assetGoalRow) await unlock(db, childId, 'M12')
  }
}

// ── evaluateOnLoanRequest ──────────────────────────────────────────────────────
// Call when a child requests a parental loan.

export async function evaluateOnLoanRequest(db: D1Database, childId: string): Promise<void> {
  await unlock(db, childId, 'M10')
}
