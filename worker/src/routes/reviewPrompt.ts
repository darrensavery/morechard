/**
 * Review Prompt routes.
 *
 * POST /api/review-prompt/outcome   — records what happened after the prompt was shown
 * POST /api/review-prompt/feedback  — saves private feedback from an unhappy parent
 * handleFeedbackDigest              — called from the scheduled() CRON handler
 */

import { Env, ReviewPromptState } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { COOLDOWN_DAYS, MAYBE_LATER_DAYS, MAX_PROMPTS } from '../lib/reviewPrompt.js'

type AuthedRequest = Request & { auth: JwtPayload }

const DAY_MS = 86_400_000

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try { return await request.json() as Record<string, unknown> }
  catch { return null }
}

// ----------------------------------------------------------------
// POST /api/review-prompt/outcome
// Records what happened after the prompt was shown.
// Body: { outcome: 'prompted' | 'dismissed' | 'maybe_later' }
// ----------------------------------------------------------------
export async function handleReviewOutcome(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const body    = await parseBody(request)
  const outcome = (body as Record<string, unknown>)?.outcome as string | undefined
  if (!['prompted', 'dismissed', 'maybe_later'].includes(outcome ?? ''))
    return error('Invalid outcome', 400)

  const now = Date.now()

  const state = await env.DB
    .prepare('SELECT * FROM review_prompt_state WHERE user_id = ?')
    .bind(auth.sub)
    .first<ReviewPromptState>()

  const approvalsRow = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE family_id = ? AND status = 'completed'`)
    .bind(auth.family_id)
    .first<{ cnt: number }>()
  const approvalsCount = approvalsRow?.cnt ?? 0

  const cooldownDays   = outcome === 'maybe_later' ? MAYBE_LATER_DAYS : COOLDOWN_DAYS
  const suppressUntil  = now + cooldownDays * DAY_MS
  const newPromptCount = (state?.prompt_count ?? 0) + 1
  const optedOut       = (outcome === 'dismissed' && newPromptCount >= MAX_PROMPTS) ? 1 : (state?.opted_out ?? 0)

  if (state) {
    await env.DB.prepare(`
      UPDATE review_prompt_state
      SET prompt_count = ?, last_prompted_at = ?, approvals_at_last_prompt = ?,
          last_outcome = ?, suppress_until = ?, opted_out = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(newPromptCount, now, approvalsCount, outcome, suppressUntil, optedOut, now, auth.sub).run()
  } else {
    await env.DB.prepare(`
      INSERT INTO review_prompt_state
        (user_id, family_id, prompt_count, last_prompted_at, approvals_at_last_prompt,
         last_outcome, suppress_until, opted_out, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(auth.sub, auth.family_id, newPromptCount, now, approvalsCount, outcome, suppressUntil, optedOut, now, now).run()
  }

  return json({ ok: true })
}

// ----------------------------------------------------------------
// POST /api/review-prompt/feedback
// Saves private feedback from an unhappy parent.
// Body: { message?, platform, app_version }
// ----------------------------------------------------------------
export async function handleReviewFeedback(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const body     = await parseBody(request)
  const platform = (body as Record<string, unknown>)?.platform as string | undefined
  const version  = String((body as Record<string, unknown>)?.app_version ?? 'unknown').slice(0, 32)
  const rawMsg   = (body as Record<string, unknown>)?.message
    ? String((body as Record<string, unknown>).message).trim()
    : null
  const message  = rawMsg ? rawMsg.slice(0, 500).replace(/<[^>]*>/g, '') : null

  if (!['android', 'ios', 'web'].includes(platform ?? ''))
    return error('Invalid platform', 400)

  const id  = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(`
    INSERT INTO review_feedback (id, user_id, family_id, message, app_platform, app_version, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(id, auth.sub, auth.family_id, message, platform, version, now).run()

  return json({ ok: true })
}

// ----------------------------------------------------------------
// handleFeedbackDigest — called from scheduled()
// Emails all un-digested feedback rows and marks them sent.
// ----------------------------------------------------------------
export async function handleFeedbackDigest(env: Env): Promise<void> {
  const rows = await env.DB
    .prepare(`SELECT * FROM review_feedback WHERE emailed_at IS NULL ORDER BY created_at ASC`)
    .all<{ id: string; user_id: string; message: string | null; app_platform: string; app_version: string; created_at: number }>()

  if (!rows.results.length) return

  const lines = rows.results.map((r, i) => {
    const ts   = new Date(r.created_at).toISOString()
    const body = r.message ? `"${r.message}"` : '(no message)'
    return `${i + 1}. [${r.app_platform} ${r.app_version}] ${ts}\n   ${body}`
  })

  const emailBody = `${rows.results.length} new Morechard review feedback item(s):\n\n${lines.join('\n\n')}`

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: 'darren.savery@gmail.com', name: 'Darren' }] }],
      from:    { email: 'noreply@morechard.com', name: 'Morechard' },
      subject: `[Morechard] ${rows.results.length} review feedback item(s)`,
      content: [{ type: 'text/plain', value: emailBody }],
    }),
  })

  const ids          = rows.results.map(r => r.id)
  const nowMs        = Date.now()
  const placeholders = ids.map(() => '?').join(',')
  await env.DB
    .prepare(`UPDATE review_feedback SET emailed_at = ? WHERE id IN (${placeholders})`)
    .bind(nowMs, ...ids)
    .run()
}
