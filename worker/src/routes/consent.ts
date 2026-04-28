import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { CURRENT_CONSENT_VERSION } from '../lib/consent-versions.js'

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
