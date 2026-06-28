// worker/src/routes/dev.ts
// Dev-only endpoints for trigger inspection and manual passive sweep.
// All routes return 404 when ENVIRONMENT !== 'development'.

import type { Env } from '../types.js'
import { evaluatePassive } from '../lib/labTriggers.js'

export async function handleDevRequest(req: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== 'development') {
    return new Response('Not Found', { status: 404 })
  }

  const url   = new URL(req.url)
  const path  = url.pathname
  const child = url.searchParams.get('child_id') ?? ''

  if (!child) {
    return Response.json({ error: 'child_id required' }, { status: 400 })
  }

  // GET /dev/trigger-status
  if (req.method === 'GET' && path === '/dev/trigger-status') {
    const [modules, badges, streakRow, earningsRow, balanceRow] = await Promise.all([
      env.DB.prepare(
        `SELECT module_slug FROM unlocked_modules WHERE child_id = ? ORDER BY unlocked_at`
      ).bind(child).all<{ module_slug: string }>(),

      env.DB.prepare(
        `SELECT badge_key FROM child_badges WHERE child_id = ? ORDER BY earned_at`
      ).bind(child).all<{ badge_key: string }>(),

      env.DB.prepare(
        `SELECT current_streak, longest_streak FROM child_streaks WHERE child_id = ?`
      ).bind(child).first<{ current_streak: number; longest_streak: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger
         WHERE child_id = ? AND entry_type = 'credit' AND verification_status != 'reversed'`
      ).bind(child).first<{ total: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) AS bal
         FROM ledger WHERE child_id = ? AND verification_status != 'reversed'`
      ).bind(child).first<{ bal: number }>(),
    ])

    return Response.json({
      unlocked:         (modules.results ?? []).map(r => r.module_slug),
      badges:           (badges.results ?? []).map(r => r.badge_key),
      streak:           streakRow?.current_streak ?? 0,
      longestStreak:    streakRow?.longest_streak ?? 0,
      lifetimeEarnings: earningsRow?.total ?? 0,
      balance:          balanceRow?.bal ?? 0,
    })
  }

  // POST /dev/run-passive
  if (req.method === 'POST' && path === '/dev/run-passive') {
    const beforeRow = await env.DB.prepare(
      `SELECT module_slug FROM unlocked_modules WHERE child_id = ?`
    ).bind(child).all<{ module_slug: string }>()
    const before = new Set((beforeRow.results ?? []).map(r => r.module_slug))

    await evaluatePassive(env.DB, child)

    const afterRow = await env.DB.prepare(
      `SELECT module_slug FROM unlocked_modules WHERE child_id = ?`
    ).bind(child).all<{ module_slug: string }>()
    const newlyUnlocked = (afterRow.results ?? [])
      .map(r => r.module_slug)
      .filter(s => !before.has(s))

    return Response.json({ ok: true, newlyUnlocked })
  }

  return new Response('Not Found', { status: 404 })
}
