/**
 * analytics.ts — PostHog wrapper for Morechard
 *
 * All calls are no-ops in development (VITE_POSTHOG_KEY not set).
 * Import `analytics` anywhere in the app — no PostHog SDK leaking into components.
 *
 * Consent model (GDPR / PECR):
 *  - PostHog is non-essential, so it loads only when analytics are allowed.
 *  - Parents (and not-yet-identified devices) must give explicit consent during
 *    onboarding — see Stage1ParentIdentity / RegistrationShell.
 *  - Child devices inherit the FAMILY-EFFECTIVE decision (veto model: on only if a
 *    parent opted in and no parent opted out). The server computes it; the child
 *    device receives it at join + on boot and stores it as its local consent via
 *    applyInheritedChildConsent(). Child events may flow, but session replay is
 *    ALWAYS disabled for children.
 */

import posthog from 'posthog-js'
import { getDeviceIdentity } from './deviceIdentity'

const CONSENT_KEY = 'mc_analytics_consent'

let started = false

// ── Consent state ─────────────────────────────────────────────────────────────

export function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw)?.status === 'accepted' : false
  } catch {
    return false
  }
}

export function setAnalyticsConsent(accepted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      status: accepted ? 'accepted' : 'declined',
      ts:     new Date().toISOString(),
    }))
  } catch {
    /* storage blocked — nothing we can do */
  }
}

/** True when this device belongs to a child. Children are never session-recorded. */
function isChildDevice(): boolean {
  return getDeviceIdentity()?.role === 'child'
}

/**
 * Whether analytics may run on this device at all.
 * Every device gates on its local consent. For a child that local value is the
 * family-effective flag written by applyInheritedChildConsent().
 */
export function analyticsAllowed(): boolean {
  return hasAnalyticsConsent()
}

/** Whether session replay may run. Off for children and without consent. */
export function replayAllowed(): boolean {
  return hasAnalyticsConsent() && !isChildDevice()
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || !import.meta.env.PROD) return
  if (started) return
  if (!analyticsAllowed()) return

  started = true
  posthog.init(key, {
    api_host:                 'https://sap.morechard.com',  // reverse proxy — never hits posthog.com directly
    ui_host:                  'https://eu.posthog.com',     // PostHog UI for session replays / dashboards
    defaults:                 '2026-01-30',                 // pins PostHog feature behaviour to this date
    person_profiles:          'identified_only',
    capture_pageview:         true,
    capture_pageleave:        true,
    autocapture:              false,   // manual events only — keeps data clean
    disable_session_recording: isChildDevice(),  // children are never recorded
    session_recording:        { maskAllInputs: true },
  })
}

/** Parent granted consent mid-session (onboarding/settings) — start without a reload. */
export function grantAnalyticsConsent(): void {
  setAnalyticsConsent(true)
  initAnalytics()
}

/** Parent withdrew consent — stop capture immediately. */
export function revokeAnalyticsConsent(): void {
  setAnalyticsConsent(false)
  if (!started) return
  try {
    posthog.stopSessionRecording?.()
    posthog.opt_out_capturing()
  } catch {
    /* noop */
  }
}

/**
 * Apply the family-effective child decision (veto model) on a child device:
 * store it locally and start/stop analytics to match. Session replay stays off.
 */
export function applyInheritedChildConsent(childAnalytics: boolean): void {
  setAnalyticsConsent(childAnalytics)
  if (childAnalytics) {
    if (started) {
      try { posthog.opt_in_capturing() } catch { /* noop */ }
    } else {
      initAnalytics()
    }
  } else if (started) {
    try { posthog.opt_out_capturing() } catch { /* noop */ }
  }
}

// ── Event API ─────────────────────────────────────────────────────────────────

export const analytics = {
  /** Call after registration or join completes — links all future events to this user. */
  identify(userId: string, props?: Record<string, string>) {
    if (!import.meta.env.PROD || !started) return
    posthog.identify(userId, props)
  },

  /** Call on explicit log out. */
  reset() {
    if (!import.meta.env.PROD || !started) return
    posthog.reset()
  },

  track(event: string, props?: Record<string, unknown>) {
    if (!import.meta.env.PROD || !started) return
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

  uiStyleChanged: (props: { style: 'professional' | 'orchard'; child_id: string }) =>
    analytics.track('ui_style_changed', props),

  onboardingChoiceMade: (props: { choice: 'add_child' | 'skip_to_dash' }) =>
    analytics.track('onboarding_choice_made', props),

  firstChildAdded: (props: { age: number; has_opening_balance: boolean }) =>
    analytics.track('first_child_added', props),

  growthPathUpdated: (props: { mode: 'ALLOWANCE' | 'CHORES' | 'HYBRID'; frequency: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'; amount_pence: number }) =>
    analytics.track('growth_path_updated', props),

  taskSubmitStarted: (props: { chore_id: string; is_revision: boolean; has_proof_required: boolean }) =>
    analytics.track('task_submit_started', props),

  taskSubmitted: (props: { chore_id: string; is_revision: boolean; velocity_ms: number; had_proof: boolean }) =>
    analytics.track('task_submitted', props),

  revisionViewed: (props: { chore_id: string; attempt_count: number }) =>
    analytics.track('revision_viewed', props),

  revisionDwellTime: (props: { chore_id: string; dwell_ms: number }) =>
    analytics.track('revision_dwell_time', props),
}
