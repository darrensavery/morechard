/**
 * First-launch onboarding carousel — "has the user seen it" flag.
 *
 * Storage key: mc_has_seen_onboarding (localStorage)
 * Set once, on skip or completion of the carousel. Never cleared automatically.
 */

export const ONBOARDING_SEEN_KEY = 'mc_has_seen_onboarding'

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Storage unavailable — worst case the carousel reappears next launch.
  }
}
