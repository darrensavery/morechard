# Review Prompt — Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Scope:** In-app review/rating prompt for parent accounts

---

## Overview

Prompt parent users to leave a public review at a delight moment (Nth chore approved), using a two-step sentiment gate. Happy parents route to the platform-appropriate public review surface; unhappy parents route to a private in-app feedback form. Eligibility is server-authoritative (D1). Child accounts are never prompted.

---

## Architecture

### New files

**Worker:**
- `worker/src/lib/reviewPrompt.ts` — pure `evaluateEligibility(state, approvalsCount, now, config)` function + all threshold constants + kill switch. No side effects; unit-testable without a DB.
- `worker/src/routes/reviewPrompt.ts` — three endpoints registered in `worker/src/index.ts`

**App:**
- `app/src/lib/reviewPrompt.ts` — eligibility fetch + platform-aware "fire review" (native plugin vs Trustpilot URL)
- `app/src/components/review/ReviewPromptSheet.tsx` — two-step sheet UI

**Migration:**
- `worker/migrations/0063_review_prompts.sql`

### Untouched files
The chores/approval route (`worker/src/routes/chores.ts`) is **not modified**. The client calls the eligibility endpoint after an approval succeeds; no review logic enters the approval path.

---

## Endpoints

### `GET /api/review-prompt/eligibility`
Auth: parent JWT required.  
Returns `{ eligible: boolean, reason: string }`.  
Reads the family's approved completions count and the caller's `review_prompt_state` row; runs `evaluateEligibility`.

### `POST /api/review-prompt/outcome`
Body: `{ outcome: 'reviewed' | 'dismissed' | 'maybe_later' }`  
Updates `review_prompt_state`: sets `last_prompted_at`, increments `prompt_count`, sets `suppress_until`, sets `reviewed_at` (if `reviewed`), sets `opted_out` (if `dismissed` and `prompt_count >= MAX_PROMPTS`).

### `POST /api/review-prompt/feedback`
Body: `{ sentiment: number, message: string, platform: 'android' | 'ios' | 'web', app_version: string }`  
Writes a `review_feedback` row. The daily CRON digest picks it up.

---

## Data Model — migration `0063_review_prompts.sql`

### `review_prompt_state`
One row per parent `user_id`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT PK | Foreign key → users |
| `family_id` | TEXT | For family-scoped count query |
| `prompt_count` | INTEGER DEFAULT 0 | Incremented on each prompt shown |
| `last_prompted_at` | INTEGER | Epoch ms |
| `approvals_at_last_prompt` | INTEGER DEFAULT 0 | Re-arm baseline |
| `last_outcome` | TEXT | `reviewed \| feedback \| dismissed \| maybe_later` |
| `suppress_until` | INTEGER | Epoch ms — don't prompt before this |
| `reviewed_at` | INTEGER | Set once; terminal — never ask again |
| `opted_out` | INTEGER DEFAULT 0 | 1 = permanent suppression |
| `created_at` | INTEGER | Epoch ms |
| `updated_at` | INTEGER | Epoch ms |

### `review_feedback`
Private unhappy-path feedback.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT | |
| `family_id` | TEXT | |
| `sentiment` | INTEGER | 1–3 stars |
| `message` | TEXT | Max 500 chars, nullable |
| `app_platform` | TEXT | `android \| ios \| web` |
| `app_version` | TEXT | Read from `import.meta.env.VITE_APP_VERSION` on client |
| `created_at` | INTEGER | Epoch ms |
| `emailed_at` | INTEGER | Null until digested |

---

## Eligibility Logic

Implemented as a pure function in `worker/src/lib/reviewPrompt.ts`.

### Constants

```ts
const FIRST_MILESTONE  = 10   // approvals before first ask
const REPEAT_DELTA     = 15   // additional approvals before re-arm
const COOLDOWN_DAYS    = 90   // minimum days between prompts
const MAYBE_LATER_DAYS = 30   // cooldown after 'maybe_later' dismissal
const MAX_PROMPTS      = 3    // hard cap; after this, opted_out = true
const HAPPY_THRESHOLD  = 4    // stars ≥ this = happy path
const KILL_SWITCH      = false // set true in worker env to disable globally
```

### Decision tree

```
if KILL_SWITCH → not eligible
if child device → not eligible  (gated client-side before call is even made)
if opted_out → not eligible
if reviewed_at set → not eligible
if prompt_count >= MAX_PROMPTS → not eligible
if now < suppress_until → not eligible
if approvalsCount < FIRST_MILESTONE → not eligible
if state exists AND approvalsCount < (approvals_at_last_prompt + REPEAT_DELTA) → not eligible
→ eligible
```

---

## Client Flow

```
Parent approves a chore (approval API call succeeds)
  ↓
GET /api/review-prompt/eligibility
  ↓
{ eligible: false } → do nothing
{ eligible: true }  → wait 500 ms (let approval celebration clear)
  ↓
ReviewPromptSheet opens
  ↓
Step 1: "How are you finding Morechard?" — 1–5 stars
  ↓
  stars >= HAPPY_THRESHOLD (4–5)        stars < HAPPY_THRESHOLD (1–3)
        ↓                                          ↓
  Capacitor.isNativePlatform()?         "Thanks — what could be better?"
    yes → @capacitor-community/           [free-text, max 500 chars]
          in-app-review (Android/iOS)     [Submit] → POST /feedback
    no  → open Trustpilot URL             sheet closes
  POST /outcome { reviewed }
  sheet closes
```

If the native plugin call fails (emulator, OS rate-limited), fall back silently to the Trustpilot URL.

If user taps "Maybe later": `POST /outcome { maybe_later }`, sheet closes, cooldown = `MAYBE_LATER_DAYS`.  
If user dismisses/closes: `POST /outcome { dismissed }`, sheet closes, cooldown = `COOLDOWN_DAYS`.

---

## Native Dependency

Package: `@capacitor-community/in-app-review`  
Supports: Android (Play In-App Review API) and iOS (`SKStoreReviewController`).  
Platform detection: `Capacitor.isNativePlatform()` — same pattern as `haptics.ts`.  
Fallback URL (web + native failure): `https://www.trustpilot.com/evaluate/morechard.com` — held as `TRUSTPILOT_URL` constant in `app/src/lib/reviewPrompt.ts`.

---

## Email Digest (CRON)

- Cloudflare CRON trigger: `0 7 * * *` (07:00 UTC daily)
- Handler: `worker/src/routes/reviewPrompt.ts` — `handleFeedbackDigest(env)`
- Finds all `review_feedback` rows where `emailed_at IS NULL`
- If none: exits silently
- Batches into one plain-text email to `darren.savery@gmail.com` via MailChannels
- Updates `emailed_at` for all rows sent

---

## Analytics (PostHog)

All events parent-only, gated on existing `analyticsAllowed()`. Uses existing `analytics.track()` wrapper.

| Event | Props |
|---|---|
| `review_prompt_shown` | `{ platform, trigger: 'nth_approval', milestone_count }` |
| `review_prompt_sentiment` | `{ stars }` |
| `review_prompt_outcome` | `{ outcome, platform }` |
| `review_prompt_feedback_submitted` | _(none)_ |

---

## Out of Scope (v1)

- Push notification nudge — depends on Phase 8 push infra
- Child accounts — never prompted (safeguarding/COPPA)
- Co-parent deduplication — handled naturally by per-user state rows (only the approving parent's state is checked)
- Mumsnet / Play Store fallback for web — Trustpilot is the single web destination
