/**
 * analytics.ts — PostHog wrapper for Morechard
 *
 * All calls are no-ops in development (VITE_POSTHOG_KEY not set).
 * Import `analytics` anywhere in the app — no PostHog SDK leaking into components.
 */

import posthog from 'posthog-js'

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || !import.meta.env.PROD) return

  posthog.init(key, {
    api_host:             'https://eu.i.posthog.com',
    person_profiles:      'identified_only',
    capture_pageview:     true,
    capture_pageleave:    true,
    autocapture:          false,   // manual events only — keeps data clean
    session_recording:    { maskAllInputs: true },
  })
}

export const analytics = {
  /** Call after registration or join completes — links all future events to this user. */
  identify(userId: string, props?: Record<string, string>) {
    if (!import.meta.env.PROD) return
    posthog.identify(userId, props)
  },

  /** Call on explicit log out. */
  reset() {
    if (!import.meta.env.PROD) return
    posthog.reset()
  },

  track(event: string, props?: Record<string, unknown>) {
    if (!import.meta.env.PROD) return
    posthog.capture(event, props)
  },
}

// ── Typed event helpers ───────────────────────────────────────────────────────

export const track = {
  registrationStarted:   () => analytics.track('registration_started'),
  registrationCompleted: (props: { auth_method: string; parenting_mode: string; currency: string }) =>
    analytics.track('registration_completed', props),

  joinStarted:    () => analytics.track('join_started'),
  joinCompleted:  (props: { role: 'child' | 'co-parent' }) =>
    analytics.track('join_completed', props),
  joinFailed:     (props: { reason: string }) =>
    analytics.track('join_failed', props),

  lockScreenUnlocked: (props: { auth_method: 'biometrics' | 'pin' | 'none' }) =>
    analytics.track('lock_screen_unlocked', props),

  childGoalCompleted: (props: { goal_amount: number; currency: string }) =>
    analytics.track('child_goal_completed', props),

  choreCompleted: () => analytics.track('chore_completed'),
  choreApproved:  () => analytics.track('chore_approved'),
}
