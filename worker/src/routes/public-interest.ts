import { Env } from '../types.js'
import { json, error, clientIp } from '../lib/response.js'
import { EMAIL_RE } from '../lib/validation.js'

// Simple in-memory rate limiter: 1 submission per IP per 60 seconds.
// Resets on worker restart (cold start) — acceptable for a low-traffic promo page.
const recentIps = new Map<string, number>()

function isRateLimited(ip: string): boolean {
  const last = recentIps.get(ip)
  const now = Date.now()
  if (last && now - last < 60_000) return true
  recentIps.set(ip, now)
  // Prune map to prevent unbounded growth
  if (recentIps.size > 10_000) {
    const cutoff = now - 60_000
    for (const [k, v] of recentIps) {
      if (v < cutoff) recentIps.delete(k)
    }
  }
  return false
}

export async function handlePublicInterest(request: Request, env: Env): Promise<Response> {
  if (!env.BREVO_API_KEY) {
    return error('Service unavailable', 503)
  }

  const ip = clientIp(request)

  if (isRateLimited(ip)) {
    return error('Too many requests — please wait a moment', 429)
  }

  let body: { email?: unknown; consent?: unknown }
  try {
    body = await request.json()
  } catch {
    return error('Invalid JSON', 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return error('A valid email address is required', 400)
  }

  if (body.consent !== true) {
    return error('Consent is required', 400)
  }

  const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      email,
      listIds: [4],
      attributes: { SOURCE: 'morechard.com-prelaunch' },
      updateEnabled: true,
    }),
  })

  // Brevo returns 201 for new contacts, 204 for existing (updateEnabled)
  if (brevoRes.status === 201 || brevoRes.status === 204) {
    return json({ ok: true })
  }

  // Log the failure detail for debugging without leaking it to the client
  const detail = await brevoRes.text().catch(() => '(no body)')
  console.error(`Brevo error ${brevoRes.status}: ${detail}`)
  return error('Failed to register interest', 500)
}
