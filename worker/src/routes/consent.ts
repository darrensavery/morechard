import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { CURRENT_CONSENT_VERSION, ANALYTICS_CONSENT_VERSION } from '../lib/consent-versions.js'

type AuthedRequest = Request & { auth: JwtPayload }

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
