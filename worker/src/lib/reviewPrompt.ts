import type { ReviewPromptState } from '../types.js'

export const FIRST_MILESTONE      = 10
export const REPEAT_DELTA         = 15
export const COOLDOWN_DAYS        = 90
export const MAYBE_LATER_DAYS     = 30
export const FAMILY_COOLDOWN_DAYS = 30
export const MAX_PROMPTS          = 3
export const HAPPY_THRESHOLD      = 4
export const KILL_SWITCH          = false

const DAY_MS = 86_400_000

export interface EligibilityResult {
  eligible: boolean
  reason:   string
}

export function evaluateEligibility(
  state:             ReviewPromptState | null,
  approvalsCount:    number,
  familyLastPrompt:  number | null,
  now:               number,
): EligibilityResult {
  if (KILL_SWITCH)
    return { eligible: false, reason: 'kill_switch' }

  if (state?.opted_out)
    return { eligible: false, reason: 'opted_out' }

  if (state && state.prompt_count >= MAX_PROMPTS)
    return { eligible: false, reason: 'max_prompts' }

  if (state?.suppress_until && now < state.suppress_until)
    return { eligible: false, reason: 'cooldown' }

  if (familyLastPrompt !== null && now - familyLastPrompt < FAMILY_COOLDOWN_DAYS * DAY_MS)
    return { eligible: false, reason: 'family_cooldown' }

  if (approvalsCount < FIRST_MILESTONE)
    return { eligible: false, reason: 'below_milestone' }

  if (state && approvalsCount < state.approvals_at_last_prompt + REPEAT_DELTA)
    return { eligible: false, reason: 'below_repeat_delta' }

  return { eligible: true, reason: 'milestone_reached' }
}
