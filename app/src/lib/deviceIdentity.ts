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

export interface DeviceIdentity {
  user_id:       string
  family_id:     string
  display_name:  string
  role:          DeviceRole
  initials:      string
  registered_at: string
  /** How this device is locked: biometrics, pin, or none (skipped) */
  auth_method:   'biometrics' | 'pin' | 'none'
  /** 4-digit PIN — only set when auth_method === 'pin' */
  pin?:          string
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
  localStorage.removeItem('mc_token')
}

/** Derive two-letter initials from a display name. */
export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
