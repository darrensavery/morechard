import { describe, it, expect } from 'vitest'
import { shouldTriggerImpulseSpeedBump } from './impulseSpeedBump'

describe('shouldTriggerImpulseSpeedBump', () => {
  it('returns false when balance is below the £5 floor, even if the spend is 100% of it', () => {
    expect(shouldTriggerImpulseSpeedBump(499, 499)).toBe(false)
  })

  it('returns false when spend is exactly 15% of balance (boundary is exclusive)', () => {
    expect(shouldTriggerImpulseSpeedBump(300, 2000)).toBe(false) // 300 / 2000 = 0.15 exactly
  })

  it('returns true when spend exceeds 15% of balance and balance is at the floor', () => {
    expect(shouldTriggerImpulseSpeedBump(76, 500)).toBe(true) // 76 / 500 = 0.152
  })

  it('returns false when spend is small relative to a large balance', () => {
    expect(shouldTriggerImpulseSpeedBump(100, 10000)).toBe(false)
  })

  it('returns true for a large spend against a large balance', () => {
    expect(shouldTriggerImpulseSpeedBump(2000, 10000)).toBe(true) // 2000 / 10000 = 0.20
  })
})
