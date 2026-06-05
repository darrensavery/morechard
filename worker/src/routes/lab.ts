// worker/src/routes/lab.ts
// GET  /api/lab/modules   — returns unlock status, act progress, and child data for all modules
// POST /api/lab/modules/:slug/acts/:num/complete — mark an act complete

import type { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { nanoid } from '../lib/nanoid.js'
import type { JwtPayload } from '../lib/jwt.js'
import { evaluatePassive } from '../lib/labTriggers.js'

type AuthedRequest = Request & { auth: JwtPayload }

// ── GET /api/lab/modules ──────────────────────────────────────────────────────
export async function handleLabModules(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'child') return json({ error: 'Child auth required' }, 403)

  const childId = auth.sub

  // Re-evaluate passive unlock conditions (inactivity, balance, streak, reliability)
  // on every Lab open, so triggers that depend on the *absence* of activity still
  // fire (e.g. M14 Inflation after 21 days with no transactions). Awaited so any
  // newly-unlocked module is reflected in this same response. Failures are
  // swallowed — unlock evaluation must never block the Lab from loading.
  await evaluatePassive(env.DB, childId).catch(() => {})

  const [unlockRows, progressRows, settings, balanceRow, earningsRow, choreRows, streakRow] =
    await Promise.all([
      env.DB.prepare(
        `SELECT module_slug, unlocked_at FROM unlocked_modules WHERE child_id = ?`
      ).bind(childId).all(),

      env.DB.prepare(
        `SELECT module_slug, act_num, completed_at FROM module_act_progress WHERE child_id = ?`
      ).bind(childId).all(),

      env.DB.prepare(
        `SELECT age_level, app_view FROM user_settings WHERE user_id = ?`
      ).bind(childId).first<{ age_level: number; app_view: string }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS balance
         FROM ledger WHERE child_id = ? AND verification_status != 'reversed'`
      ).bind(childId).first<{ balance: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
         WHERE child_id = ? AND entry_type = 'credit' AND verification_status != 'reversed'`
      ).bind(childId).first<{ total: number }>(),

      env.DB.prepare(
        `SELECT amount FROM ledger WHERE child_id = ? AND entry_type = 'credit'
         AND verification_status IN ('verified_auto','verified_manual')
         ORDER BY created_at DESC LIMIT 5`
      ).bind(childId).all<{ amount: number }>(),

      env.DB.prepare(
        `SELECT current_streak FROM child_streaks WHERE child_id = ?`
      ).bind(childId).first<{ current_streak: number }>(),
    ])

  // Median of last 5 approved chore amounts; fallback £5 (500 pence)
  const choreAmounts = (choreRows.results ?? []).map(r => r.amount).sort((a, b) => a - b)
  const choreRateMedian = choreAmounts.length > 0
    ? choreAmounts[Math.floor(choreAmounts.length / 2)]
    : 500

  // Balance 4 weeks ago
  const fourWeeksAgo = Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60
  const [balance4wkRow, distinctChoreRow, activeGoalsRow, reliabilityRow, currencyRow] =
    await Promise.all([
      env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS balance
         FROM ledger WHERE child_id = ? AND created_at <= ? AND verification_status != 'reversed'`
      ).bind(childId, fourWeeksAgo).first<{ balance: number }>(),

      env.DB.prepare(
        `SELECT COUNT(DISTINCT chore_id) AS cnt FROM ledger
         WHERE child_id = ? AND entry_type = 'credit'`
      ).bind(childId).first<{ cnt: number }>(),

      env.DB.prepare(
        `SELECT COUNT(*) AS cnt FROM goals WHERE child_id = ? AND archived = 0 AND status = 'ACTIVE'`
      ).bind(childId).first<{ cnt: number }>(),

      env.DB.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS passed
         FROM completions WHERE child_id = ?
           AND status IN ('completed','rejected','needs_revision')`
      ).bind(childId).first<{ total: number; passed: number }>(),

      env.DB.prepare(
        `SELECT currency FROM ledger WHERE child_id = ? ORDER BY created_at DESC LIMIT 1`
      ).bind(childId).first<{ currency: string }>(),
    ])

  const reliabilityRating = reliabilityRow && reliabilityRow.total > 0
    ? Math.round((reliabilityRow.passed / reliabilityRow.total) * 100)
    : 100

  // Build unlock map
  type UnlockRow    = { module_slug: string; unlocked_at: number }
  type ProgressRow  = { module_slug: string; act_num: number }

  const unlocked = new Map<string, number>(
    (unlockRows.results as UnlockRow[]).map(r => [r.module_slug, r.unlocked_at])
  )

  const actProgress = new Map<string, number[]>()
  for (const row of progressRows.results as ProgressRow[]) {
    const existing = actProgress.get(row.module_slug) ?? []
    existing.push(row.act_num)
    actProgress.set(row.module_slug, existing)
  }

  return json({
    modules: Object.fromEntries(
      Array.from(unlocked.entries()).map(([slug, unlockedAt]) => [
        slug,
        { unlocked_at: unlockedAt, completed_acts: actProgress.get(slug) ?? [] },
      ])
    ),
    childData: {
      currency:                currencyRow?.currency ?? 'GBP',
      currentBalancePence:     balanceRow?.balance ?? 0,
      lifetimeEarningsPence:   earningsRow?.total ?? 0,
      choreRateMedianPence:    choreRateMedian,
      savingsStreakWeeks:       streakRow?.current_streak ?? 0,
      balance4wkAgoPence:       balance4wkRow?.balance ?? 0,
      consecutiveWeeklyGrowth:  streakRow?.current_streak ?? 0,
      activeGoalsCount:         activeGoalsRow?.cnt ?? 0,
      reliabilityRating,
      distinctChoreTypes:       distinctChoreRow?.cnt ?? 0,
    },
    ageLevel: settings?.age_level ?? 2,
  })
}

// ── POST /api/lab/modules/:slug/acts/:num/complete ────────────────────────────
export async function handleLabActComplete(
  request: Request,
  env: Env,
  slug: string,
  actNum: number,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'child') return json({ error: 'Child auth required' }, 403)
  if (actNum < 1 || actNum > 4) return error('act_num must be 1–4')

  const childId = auth.sub
  const now     = Math.floor(Date.now() / 1000)

  // Verify module is unlocked before recording progress
  const unlocked = await env.DB.prepare(
    `SELECT id FROM unlocked_modules WHERE child_id = ? AND module_slug = ?`
  ).bind(childId, slug).first()

  if (!unlocked) return error('Module not unlocked', 403)

  await env.DB.prepare(
    `INSERT OR IGNORE INTO module_act_progress (id, child_id, module_slug, act_num, completed_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(nanoid(), childId, slug, actNum, now).run()

  return json({ ok: true })
}
