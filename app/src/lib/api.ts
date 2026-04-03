/**
 * Thin API client for the MoneySteps Cloudflare Worker.
 * All requests attach the JWT from localStorage when present.
 */

const BASE = import.meta.env.VITE_API_URL ?? ''

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('ms_token')
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  })
  const data = await res.json() as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface CreateFamilyResult {
  family_id: string
  user_id: string
  email: string
}

export function createFamily(payload: {
  display_name: string
  email: string
  password: string
  locale: 'en' | 'pl'
  parenting_mode: 'single' | 'co-parenting'
  governance_mode: 'amicable' | 'standard'
  base_currency: 'GBP' | 'PLN'
}) {
  return request<CreateFamilyResult>('/auth/create-family', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface LoginResult { token: string; expires_in: number }

export function login(email: string, password: string) {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ── Invite codes ──────────────────────────────────────────────────────────────

export interface GenerateInviteResult {
  code: string
  role: 'child' | 'co-parent'
  expires_at: number
}

export function generateInviteCode(role: 'child' | 'co-parent') {
  return request<GenerateInviteResult>('/auth/invite/generate', {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
}

// ── Children ──────────────────────────────────────────────────────────────────

export interface AddChildResult { child_id: string; invite_code: string }

export function addChild(display_name: string) {
  return request<AddChildResult>('/auth/child/add', {
    method: 'POST',
    body: JSON.stringify({ display_name }),
  })
}

// ── Registration step persistence ────────────────────────────────────────────

export function saveRegistrationStep(step: number, data: Record<string, unknown>) {
  return request<{ ok: boolean }>('/auth/registration/save-step', {
    method: 'POST',
    body: JSON.stringify({ step, data }),
  })
}
