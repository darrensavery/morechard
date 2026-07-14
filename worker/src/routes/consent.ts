import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { CURRENT_CONSENT_VERSION, ANALYTICS_CONSENT_VERSION } from '../lib/consent-versions.js'

type AuthedRequest = Request & { auth: JwtPayload }

// Brevo list ID for registered-user marketing opt-ins — distinct from list 4,
// which is the unauthenticated pre-launch "register your interest" list
// (see routes/public-interest.ts).
const BREVO_MARKETING_LIST_ID = 5

/**
 * Best-effort Brevo sync — the marketing_consents row (written by the caller
 * before this runs) is the first-party source of truth, so a Brevo outage or
 * error must never fail the request or block recording the parent's choice.
 */
async function syncBrevoMarketingConsent(env: Env, email: string, consented: boolean): Promise<void> {
  if (!env.BREVO_API_KEY) return
  try {
    if (consented) {
      const res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({ email, listIds: [BREVO_MARKETING_LIST_ID], updateEnabled: true }),
      })
      if (res.status !== 201 && res.status !== 204) {
        console.error(`[consent] Brevo subscribe failed (${res.status}): ${await res.text().catch(() => '')}`)
      }
    } else {
      const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({ unlinkListIds: [BREVO_MARKETING_LIST_ID] }),
      })
      // 404 means the contact was never subscribed — nothing to unlink, not an error.
      if (res.status !== 204 && res.status !== 404) {
        console.error(`[consent] Brevo unsubscribe failed (${res.status}): ${await res.text().catch(() => '')}`)
      }
    }
  } catch (err) {
    console.error('[consent] Brevo sync failed', err)
  }
}

// POST /api/consent/marketing
export async function handleConsentPost(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  let body: { consented?: unknown }
  try { body = await request.json() } catch { return error('Invalid JSON', 400) }

  if (typeof body.consented !== 'boolean') {
    return error('consented must be a boolean', 400)
  }

  const ip = request.headers.get('CF-Connecting-IP')
           ?? request.headers.get('X-Forwarded-For')
           ?? 'unknown'

  await env.DB
    .prepare(`INSERT INTO marketing_consents (user_id, consented, consent_version, ip_address)
              VALUES (?, ?, ?, ?)`)
    .bind(auth.sub, body.consented ? 1 : 0, CURRENT_CONSENT_VERSION, ip)
    .run()

  const user = await env.DB
    .prepare('SELECT email FROM users WHERE id = ?')
    .bind(auth.sub)
    .first<{ email: string }>()

  if (user?.email) {
    await syncBrevoMarketingConsent(env, user.email, body.consented)
  }

  return json({ ok: true })
}

// GET /api/consent/marketing
export async function handleConsentGet(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const row = await env.DB
    .prepare(`SELECT consented, consent_version FROM marketing_consents
              WHERE user_id = ? ORDER BY consented_at DESC LIMIT 1`)
    .bind(auth.sub)
    .first<{ consented: number; consent_version: string }>()

  if (!row) return json({ consented: null, consent_version: null })

  return json({ consented: row.consented === 1, consent_version: row.consent_version })
}

// ── Analytics consent ─────────────────────────────────────────────────────────
//
// Adults consent for their own device. The family-effective CHILD flag is
// recomputed here on every parent write using a veto rule:
//   child_analytics_consent = (any parent opted in) AND (no parent opted out)

/** Recompute and persist families.child_analytics_consent. Returns the new value. */
async function recomputeChildAnalytics(env: Env, familyId: string): Promise<boolean> {
  const { results } = await env.DB
    .prepare(`
      SELECT fr.user_id AS user_id,
        (SELECT consented FROM analytics_consents ac
          WHERE ac.user_id = fr.user_id
          ORDER BY ac.consented_at DESC, ac.id DESC LIMIT 1) AS consented
      FROM family_roles fr
      WHERE fr.family_id = ? AND fr.role = 'parent'
    `)
    .bind(familyId)
    .all<{ user_id: string; consented: number | null }>()

  let anyYes = false
  let anyNo  = false
  for (const r of results) {
    if (r.consented === 1) anyYes = true
    else if (r.consented === 0) anyNo = true
  }
  const effective = anyYes && !anyNo

  await env.DB
    .prepare(`UPDATE families SET child_analytics_consent = ? WHERE id = ?`)
    .bind(effective ? 1 : 0, familyId)
    .run()

  return effective
}

// POST /api/consent/analytics  — records this parent's own choice, recomputes child flag
export async function handleAnalyticsConsentPost(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  let body: { consented?: unknown }
  try { body = await request.json() } catch { return error('Invalid JSON', 400) }

  if (typeof body.consented !== 'boolean') {
    return error('consented must be a boolean', 400)
  }

  const ip = request.headers.get('CF-Connecting-IP')
           ?? request.headers.get('X-Forwarded-For')
           ?? 'unknown'

  await env.DB
    .prepare(`INSERT INTO analytics_consents (user_id, consented, consent_version, ip_address)
              VALUES (?, ?, ?, ?)`)
    .bind(auth.sub, body.consented ? 1 : 0, ANALYTICS_CONSENT_VERSION, ip)
    .run()

  const childAnalytics = await recomputeChildAnalytics(env, auth.family_id)

  return json({ ok: true, child_analytics: childAnalytics })
}

// GET /api/consent/analytics/effective — family-effective child flag (any member may read)
export async function handleAnalyticsEffectiveGet(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth

  const row = await env.DB
    .prepare(`SELECT child_analytics_consent FROM families WHERE id = ?`)
    .bind(auth.family_id)
    .first<{ child_analytics_consent: number }>()

  return json({ child_analytics: row?.child_analytics_consent === 1 })
}
