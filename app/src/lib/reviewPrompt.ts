import { Capacitor } from '@capacitor/core'
import { InAppReview } from '@capacitor-community/in-app-review'
import { postReviewOutcome, postReviewFeedback } from './api'
import { analytics } from './analytics'

export const TRUSTPILOT_URL = 'https://www.trustpilot.com/evaluate/morechard.com'

export function getAppPlatform(): 'android' | 'ios' | 'web' {
  const p = Capacitor.getPlatform()
  if (p === 'android') return 'android'
  if (p === 'ios')     return 'ios'
  return 'web'
}

export function getAppVersion(): string {
  return (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown'
}

/** Fire the platform-appropriate public review surface. */
export async function requestPublicReview(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await InAppReview.requestReview()
    } catch {
      window.open(TRUSTPILOT_URL, '_blank', 'noopener')
    }
  } else {
    window.open(TRUSTPILOT_URL, '_blank', 'noopener')
  }
}

type ReviewEvent = 'shown' | 'sentiment_positive' | 'sentiment_negative' | 'outcome' | 'feedback_submitted'

/** Track PostHog event — no-ops silently if analytics not consented. */
export function trackReviewPrompt(event: ReviewEvent, extra?: Record<string, unknown>): void {
  const eventNames: Record<ReviewEvent, string> = {
    shown:               'review_prompt_shown',
    sentiment_positive:  'review_prompt_sentiment',
    sentiment_negative:  'review_prompt_sentiment',
    outcome:             'review_prompt_outcome',
    feedback_submitted:  'review_prompt_feedback_submitted',
  }
  const sentiment =
    event === 'sentiment_positive' ? 'positive' :
    event === 'sentiment_negative' ? 'negative' :
    undefined
  analytics.track(eventNames[event], { ...(sentiment ? { sentiment } : {}), ...extra })
}

/** Record outcome server-side. Fire-and-forget — never blocks UI. */
export function recordOutcome(outcome: 'prompted' | 'dismissed' | 'maybe_later'): void {
  postReviewOutcome(outcome).catch(() => { /* non-critical */ })
}

/** Submit private feedback. Returns true on success. */
export async function submitFeedback(message: string): Promise<boolean> {
  try {
    await postReviewFeedback({
      message,
      platform:    getAppPlatform(),
      app_version: getAppVersion(),
    })
    return true
  } catch {
    return false
  }
}
