import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasSeenOnboarding, markOnboardingSeen, ONBOARDING_SEEN_KEY } from '../onboarding'

describe('onboarding flag', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when the flag has never been set', () => {
    expect(hasSeenOnboarding()).toBe(false)
  })

  it('returns true after markOnboardingSeen is called', () => {
    markOnboardingSeen()
    expect(hasSeenOnboarding()).toBe(true)
  })

  it('stores the flag as the string "1" under the mc_ prefixed key', () => {
    markOnboardingSeen()
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
    expect(ONBOARDING_SEEN_KEY).toBe('mc_has_seen_onboarding')
  })

  it('returns false if reading localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(hasSeenOnboarding()).toBe(false)
    spy.mockRestore()
  })

  it('does not throw if writing localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => markOnboardingSeen()).not.toThrow()
    spy.mockRestore()
  })
})
