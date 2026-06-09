# Review Prompt — Design Spec

**Date:** 2026-06-09  
**Status:** Approved (rev 2 — post-review feedback applied)  
**Scope:** In-app review/rating prompt for parent accounts

---

## Overview

Prompt parent users to leave a public review at a delight moment (Nth chore approved), using a binary emotional check. "Love it" routes to the platform-appropriate public review surface; "Not really" routes to a private in-app feedback form. Eligibility is server-authoritative (D1). Child accounts are never prompted.

---

## Architecture

### New files

**Worker:**
- `worker/src/lib/reviewPrompt.ts` — pure `evaluateEligibility(state, approvalsCount, familyRecentPrompt, now, config)` function + all threshold constants + kill switch. No side effects; unit-testable without a DB.
- `worker/src/routes/reviewPrompt.ts` — two endpoints registered in `worker/src/index.ts` (eligibility endpoint removed — see below)

**App:**
- `app/src/lib/reviewPrompt.ts` — platform-aware "fire review" (native plugin vs Trustpilot URL)
- `app/src/components/review/ReviewPromptSheet.tsx` — two-step sheet UI

**Migration:**
- `worker/migrations/0063_review_prompts.sql`

### Modified files
`worker/src/routes/chores.ts` — the chore approval endpoint runs `evaluateEligibility` internally and returns `showReviewPrompt: boolean` in the existing approval response payload. No extra network request.

### Removed from spec (vs v1 design)
- `GET /api/review-prompt/eligibility` — eliminated. Eligibility is now computed inside the approval endpoint and returned in the response. Avoids a second round-trip at the delight moment.

---

## Endpoints

### Chore approval endpoint (modified)
`POST /api/completions/:id/approve` (existing)  
Response gains one new field: `showReviewPrompt: boolean`.  
Worker calls `evaluateEligibility(...)` after writing the approval; if eligible, sets `showReviewPrompt: true`. No other changes to the approval logic.

### `POST /api/review-prompt/outcome`
Body: `{ outcome: 'prompted' | 'dismissed' | 'maybe_later' }`  
Updates `review_prompt_state`: sets `last_prompted_at`, increments `prompt_count`, sets `suppress_until`.  
`prompted` = standard 90-day cooldown (native API gives no callback — we never know if the user submitted).  
`maybe_later` = 30-day cooldown.  
`dismissed` = 90-day cooldown; if `prompt_count >= MAX_PROMPTS`, sets `opted_out = 1`.  
No terminal `reviewed_at` state — the native OS black box makes it undetectable.

### `POST /api/review-prompt/feedback`
Body: `{ sentiment: 'negative', message: string, platform: 'android' | 'ios' | 'web', app_version: string }`  
`message` validated server-side: max 500 chars, stripped of HTML.  
Writes a `review_feedback` row. The daily CRON digest picks it up.

---

## Data Model — migration `0063_review_prompts.sql`

### `review_prompt_state`
One row per parent `user_id`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | TEXT PK | Foreign key → users |
| `family_id` | TEXT | For family-scoped cooldown check |
| `prompt_count` | INTEGER DEFAULT 0 | Incremented on each prompt shown |
| `last_prompted_at` | INTEGER | Epoch ms |
| `approvals_at_last_prompt` | INTEGER DEFAULT 0 | Re-arm baseline |
| `last_outcome` | TEXT | `prompted \| dismissed \| maybe_later` |
| `suppress_until` | INTEGER | Epoch ms — don't prompt before this |
| `opted_out` | INTEGER DEFAULT 0 | 1 = permanent suppression (after MAX_PROMPTS dismissals) |
| `created_at` | INTEGER | Epoch ms |
| `updated_at` | INTEGER | Epoch ms |

Index: `CREATE INDEX idx_review_state_family ON review_prompt_state (family_id, last_prompted_at);`  
Used by the family-level cooldown query.

### `review_feedback`
Private unhappy-path feedback.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT | |
| `family_id` | TEXT | |
| `message` | TEXT | Max 500 chars, nullable; validated at API layer |
| `app_platform` | TEXT | `android \| ios \| web` |
| `app_version` | TEXT | Read from `import.meta.env.VITE_APP_VERSION` on client |
| `created_at` | INTEGER | Epoch ms |
| `emailed_at` | INTEGER | Null until digested |

---

## Eligibility Logic

Implemented as a pure function in `worker/src/lib/reviewPrompt.ts`.

### Constants

```ts
const FIRST_MILESTONE       = 10   // approvals before first ask
const REPEAT_DELTA          = 15   // additional approvals before re-arm
const COOLDOWN_DAYS         = 90   // minimum days between prompts (and after 'prompted')
const MAYBE_LATER_DAYS      = 30   // cooldown after 'maybe_later' dismissal
const FAMILY_COOLDOWN_DAYS  = 30   // family-wide: suppress if any parent prompted in last 30d
const MAX_PROMPTS           = 3    // hard cap; after this, opted_out = true
const KILL_SWITCH           = false // set true in worker env to disable globally
```

### Decision tree

```
if KILL_SWITCH → not eligible
if opted_out → not eligible
if prompt_count >= MAX_PROMPTS → not eligible
if now < suppress_until → not eligible
if any other parent in family prompted within FAMILY_COOLDOWN_DAYS → not eligible
if approvalsCount < FIRST_MILESTONE → not eligible
if state exists AND approvalsCount < (approvals_at_last_prompt + REPEAT_DELTA) → not eligible
→ eligible
```

Family cooldown query: `SELECT MIN(last_prompted_at) FROM review_prompt_state WHERE family_id = ? AND user_id != ? AND last_prompted_at > ?`

Child devices are never prompted — gated client-side before the approval call is made. No server-side check needed.

---

## Client Flow

```
Parent approves a chore
  ↓
Approval API response: { ..., showReviewPrompt: true }
  ↓
showReviewPrompt: false → do nothing
showReviewPrompt: true  → wait 500 ms (let approval celebration clear)
  ↓
ReviewPromptSheet opens
  ↓
Step 1: "Are you enjoying Morechard?"
  [ Not really ]                          [ Love it! ]
       ↓                                       ↓
"Thanks — what could be better?"    Capacitor.isNativePlatform()?
[free-text, max 500 chars]            yes → @capacitor-community/
[Submit] → POST /feedback                   in-app-review (Android/iOS)
POST /outcome { prompted }            no  → open Trustpilot URL
sheet closes                          POST /outcome { prompted }
                                      sheet closes
```

**"Maybe later" link** (bottom of sheet, both paths): `POST /outcome { maybe_later }`, 30-day cooldown.  
**Sheet dismissed/swiped away**: `POST /outcome { dismissed }`, 90-day cooldown.

**Native API note:** iOS `SKStoreReviewController` and Android Play In-App Review give no callback — we cannot tell if the user submitted or dismissed the OS dialog. Outcome is always `prompted` (not a terminal state). User may be asked again after `COOLDOWN_DAYS`.

**Native fallback:** if the plugin throws (emulator, OS rate-limited), open Trustpilot URL silently. Still POST `{ prompted }`.

---

## Compliance Note — Review Gating

Routing users based on anticipated sentiment is known as **review gating** and is prohibited by both Apple App Store Review Guidelines (§5.6.1) and Google Play Developer Policy.

The binary emotional check in this design ("Love it" / "Not really") still gates conditionally. The only fully compliant approach is to fire the native prompt with no pre-screen. The binary approach is the practical compromise: it avoids mirroring the store's own star-rating UI, reduces double-prompting friction, and is widely used — but carries a small policy risk on native platforms if an App Review auditor tests it. For the Trustpilot (web) path, no policy constraint applies.

**Mitigation:** If Apple rejects based on this, remove the binary pre-screen on iOS and fire `SKStoreReviewController` directly. The private feedback channel survives as an in-settings path (`Settings → Send Feedback`).

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
| `review_prompt_sentiment` | `{ sentiment: 'positive' \| 'negative' }` |
| `review_prompt_outcome` | `{ outcome, platform }` |
| `review_prompt_feedback_submitted` | _(none)_ |

---

## Out of Scope (v1)

- Push notification nudge — depends on Phase 8 push infra
- Child accounts — never prompted (safeguarding/COPPA)
- Settings → Send Feedback fallback path (for iOS rejection mitigation if needed)
- Mumsnet / Play Store direct link — Trustpilot is the single web destination
