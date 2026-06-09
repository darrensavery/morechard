import { describe, it, expect } from 'vitest'
import { evaluateEligibility, FIRST_MILESTONE, REPEAT_DELTA, MAX_PROMPTS, FAMILY_COOLDOWN_DAYS } from './reviewPrompt'
import type { ReviewPromptState } from '../types'

const DAY_MS = 86_400_000
const now = 1_750_000_000_000  // fixed timestamp for determinism

function baseState(overrides: Partial<ReviewPromptState> = {}): ReviewPromptState {
  return {
    user_id:                  'u1',
    family_id:                'f1',
    prompt_count:             0,
    last_prompted_at:         null,
    approvals_at_last_prompt: 0,
    last_outcome:             null,
    suppress_until:           null,
    opted_out:                0,
    created_at:               now - DAY_MS * 30,
    updated_at:               now - DAY_MS * 30,
    ...overrides,
  }
}

describe('evaluateEligibility', () => {
  it('not eligible below FIRST_MILESTONE', () => {
    expect(evaluateEligibility(null, FIRST_MILESTONE - 1, null, now)).toEqual({ eligible: false, reason: 'below_milestone' })
  })

  it('eligible at FIRST_MILESTONE with no prior state', () => {
    expect(evaluateEligibility(null, FIRST_MILESTONE, null, now)).toEqual({ eligible: true, reason: 'milestone_reached' })
  })

  it('not eligible when opted_out', () => {
    const state = baseState({ opted_out: 1 })
    expect(evaluateEligibility(state, FIRST_MILESTONE + 5, null, now)).toEqual({ eligible: false, reason: 'opted_out' })
  })

  it('not eligible when prompt_count >= MAX_PROMPTS', () => {
    const state = baseState({ prompt_count: MAX_PROMPTS })
    expect(evaluateEligibility(state, FIRST_MILESTONE + 5, null, now)).toEqual({ eligible: false, reason: 'max_prompts' })
  })

  it('not eligible when within cooldown window', () => {
    const state = baseState({
      suppress_until: now + DAY_MS,
    })
    expect(evaluateEligibility(state, FIRST_MILESTONE + 5, null, now)).toEqual({ eligible: false, reason: 'cooldown' })
  })

  it('not eligible when re-arm delta not reached', () => {
    const state = baseState({
      prompt_count:             1,
      approvals_at_last_prompt: FIRST_MILESTONE,
      suppress_until:           now - DAY_MS,  // cooldown passed
    })
    expect(evaluateEligibility(state, FIRST_MILESTONE + 1, null, now)).toEqual({ eligible: false, reason: 'below_repeat_delta' })
  })

  it('eligible after re-arm delta reached', () => {
    const state = baseState({
      prompt_count:             1,
      approvals_at_last_prompt: FIRST_MILESTONE,
      suppress_until:           now - DAY_MS,
    })
    expect(evaluateEligibility(state, FIRST_MILESTONE + REPEAT_DELTA, null, now)).toEqual({ eligible: true, reason: 'milestone_reached' })
  })

  it('not eligible when another family member prompted within FAMILY_COOLDOWN_DAYS', () => {
    const familyLastPrompt = now - (FAMILY_COOLDOWN_DAYS - 5) * DAY_MS  // within window
    expect(evaluateEligibility(null, FIRST_MILESTONE, familyLastPrompt, now)).toEqual({ eligible: false, reason: 'family_cooldown' })
  })

  it('eligible when family last prompt is older than FAMILY_COOLDOWN_DAYS', () => {
    const familyLastPrompt = now - (FAMILY_COOLDOWN_DAYS + 1) * DAY_MS
    expect(evaluateEligibility(null, FIRST_MILESTONE, familyLastPrompt, now)).toEqual({ eligible: true, reason: 'milestone_reached' })
  })
})
