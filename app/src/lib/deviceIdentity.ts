/**
 * Device Identity — who owns this phone/device.
 *
 * Storage key: mc_device_identity (localStorage)
 *
 * Written once at the end of registration or join flow.
 * Stays until the user explicitly logs out ("Log Out").
 * One device = one person. No profile switcher.
 */

export type DeviceRole = 'parent' | 'child'

/**
 * Parenting role — only set for parent devices.
 * LEAD_PARENT: the account creator; has full access including billing & deletion.
 * CO_PARENT: joined via invite; restricted access (read-only rules, no billing).
 */
export type ParentingRole = 'LEAD_PARENT' | 'CO_PARENT'

export interface DeviceIdentity {
  user_id:        string
  family_id:      string
  display_name:   string
  role:           DeviceRole
  /** Distinguishes the account creator from a co-parent. Only set when role === 'parent'. */
  parenting_role?: ParentingRole
  initials:       string
  registered_at:  string
  /** How this device is locked: biometrics, pin, or none (skipped) */
  auth_method:    'biometrics' | 'pin' | 'none'
  /**
   * PBKDF2-derived hash of the 4-digit PIN.
   * Never store the raw PIN — call hashPin() before setting this field.
   * Format: "<base64-salt>:<base64-hash>" (both 16 bytes / 128 bits).
   */
  pin_hash?:      string
  /** Google profile picture URL; undefined for non-Google logins */
  google_picture?: string
  /** Child avatar ID (e.g. 'bottts:spark') — kept in sync by ChildDashboard */
  avatar_id?: string
}

const STORAGE_KEY = 'mc_device_identity'

export function getDeviceIdentity(): DeviceIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DeviceIdentity
  } catch {
    return null
  }
}

export function setDeviceIdentity(identity: DeviceIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
}

export function updateDeviceIdentity(patch: Partial<DeviceIdentity>): void {
  const current = getDeviceIdentity()
  if (!current) return
  setDeviceIdentity({ ...current, ...patch })
}

export function clearDeviceIdentity(): void {
  localStorage.removeItem(STORAGE_KEY)
  // mc_token is no longer read here — callers already call clearToken()
  // separately (it's now async and platform-aware; see lib/api.ts).
}

// ── PIN hashing helpers ──────────────────────────────────────────────────────

/**
 * Hash a raw 4-digit PIN with PBKDF2-SHA-256 (100,000 iterations).
 * Returns a "<base64-salt>:<base64-hash>" string suitable for storage.
 */
export async function hashPin(rawPin: string): Promise<string> {
  const enc     = new TextEncoder()
  const salt    = crypto.getRandomValues(new Uint8Array(16))
  const keyMat  = await crypto.subtle.importKey('raw', enc.encode(rawPin), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMat,
    128,
  )
  const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  return `${b64(salt.buffer)}:${b64(derived)}`
}

/**
 * Verify a raw PIN against a stored PBKDF2 hash string.
 * Returns true when they match.
 */
export async function verifyPinHash(rawPin: string, storedHash: string): Promise<boolean> {
  try {
    const [saltB64, hashB64] = storedHash.split(':')
    if (!saltB64 || !hashB64) return false
    const salt    = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    const enc     = new TextEncoder()
    const keyMat  = await crypto.subtle.importKey('raw', enc.encode(rawPin), 'PBKDF2', false, ['deriveBits'])
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
      keyMat,
      128,
    )
    const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    return b64(derived) === hashB64
  } catch {
    return false
  }
}

// ────────────────────────────────────────────────────────────────────────────

/** Derive two-letter initials from a display name. */
export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
