# Review Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app review prompt that fires after the Nth chore approval — binary sentiment gate, platform-split review destination (native OS prompt on Android/iOS, Trustpilot on web), private feedback path for unhappy users, and a daily email digest of feedback.

**Architecture:** Eligibility is computed inside the existing chore approval handler and returned as `showReviewPrompt: boolean` in the response. A pure eligibility function in `worker/src/lib/reviewPrompt.ts` owns all threshold logic; two new endpoints handle outcomes and feedback. The client sheet is self-contained in `app/src/components/review/`.

**Tech Stack:** Cloudflare D1, Cloudflare Worker (TypeScript), React + TypeScript (Vite), `@capacitor-community/in-app-review`, MailChannels (already on Cloudflare Pages), Vitest (worker tests), PostHog (existing `analytics.track` wrapper).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `worker/migrations/0063_review_prompts.sql` | Create | Two tables: `review_prompt_state`, `review_feedback` |
| `worker/src/lib/reviewPrompt.ts` | Create | Pure eligibility function + all constants |
| `worker/src/lib/reviewPrompt.test.ts` | Create | Unit tests for eligibility function |
| `worker/src/routes/reviewPrompt.ts` | Create | `POST /outcome`, `POST /feedback`, `handleFeedbackDigest` |
| `worker/src/routes/completions.ts` | Modify | Call eligibility after approve; add `showReviewPrompt` to response |
| `worker/src/index.ts` | Modify | Register two new endpoints + wire digest into `scheduled()` |
| `worker/src/types.ts` | Modify | Add `ReviewPromptState`, `ReviewFeedback` types |
| `app/src/lib/api.ts` | Modify | Update `approveCompletion` return type; add `postReviewOutcome`, `postReviewFeedback` |
| `app/src/lib/reviewPrompt.ts` | Create | Platform detection + native plugin invocation + Trustpilot fallback |
| `app/src/components/review/ReviewPromptSheet.tsx` | Create | Two-step sheet UI (binary question → fork) |
| `app/src/components/dashboard/PendingTab.tsx` | Modify | After successful approval, trigger review prompt if flagged |

---

## Task 1: D1 Migration — two new tables

**Files:**
- Create: `worker/migrations/0063_review_prompts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0063_review_prompts.sql

CREATE TABLE IF NOT EXISTS review_prompt_state (
  user_id                  TEXT    PRIMARY KEY,
  family_id                TEXT    NOT NULL,
  prompt_count             INTEGER NOT NULL DEFAULT 0,
  last_prompted_at         INTEGER,
  approvals_at_last_prompt INTEGER NOT NULL DEFAULT 0,
  last_outcome             TEXT,
  suppress_until           INTEGER,
  opted_out                INTEGER NOT NULL DEFAULT 0,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_state_family
  ON review_prompt_state (family_id, last_prompted_at);

CREATE TABLE IF NOT EXISTS review_feedback (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  family_id    TEXT    NOT NULL,
  message      TEXT,
  app_platform TEXT    NOT NULL,
  app_version  TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  emailed_at   INTEGER
);
```

- [ ] **Step 2: Apply migration to local D1**

```bash
wrangler d1 execute morechard-db --local --file=worker/migrations/0063_review_prompts.sql
```

Expected: `✅ Successfully executed` (no errors).

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0063_review_prompts.sql
git commit -m "feat(db): review_prompt_state and review_feedback tables (migration 0063)"
```

---

## Task 2: Types

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Add types to `worker/src/types.ts`**

Find the end of the existing type declarations and append:

```typescript
export interface ReviewPromptState {
  user_id:                  string;
  family_id:                string;
  prompt_count:             number;
  last_prompted_at:         number | null;
  approvals_at_last_prompt: number;
  last_outcome:             'prompted' | 'dismissed' | 'maybe_later' | null;
  suppress_until:           number | null;
  opted_out:                number;  // 0 | 1
  created_at:               number;
  updated_at:               number;
}

export interface ReviewFeedback {
  id:           string;
  user_id:      string;
  family_id:    string;
  message:      string | null;
  app_platform: 'android' | 'ios' | 'web';
  app_version:  string;
  created_at:   number;
  emailed_at:   number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(types): ReviewPromptState and ReviewFeedback types"
```

---

## Task 3: Eligibility pure function + unit tests (TDD)

**Files:**
- Create: `worker/src/lib/reviewPrompt.ts`
- Create: `worker/src/lib/reviewPrompt.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `worker/src/lib/reviewPrompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { evaluateEligibility, FIRST_MILESTONE, REPEAT_DELTA, COOLDOWN_DAYS, MAYBE_LATER_DAYS, MAX_PROMPTS } from './reviewPrompt'
import type { ReviewPromptState } from '../types'

const MS = 1000
const DAY_MS = 86_400 * MS
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
    // Need FIRST_MILESTONE + REPEAT_DELTA; currently at FIRST_MILESTONE + 1
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
    const familyLastPrompt = now - (COOLDOWN_DAYS - 5) * DAY_MS  // 5 days ago (within window)
    expect(evaluateEligibility(null, FIRST_MILESTONE, familyLastPrompt, now)).toEqual({ eligible: false, reason: 'family_cooldown' })
  })

  it('eligible when family last prompt is older than FAMILY_COOLDOWN_DAYS', () => {
    const familyLastPrompt = now - (31 * DAY_MS)  // 31 days ago
    expect(evaluateEligibility(null, FIRST_MILESTONE, familyLastPrompt, now)).toEqual({ eligible: true, reason: 'milestone_reached' })
  })
})
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd worker && npx vitest run src/lib/reviewPrompt.test.ts
```

Expected: fail with `Cannot find module './reviewPrompt'`.

- [ ] **Step 3: Implement the eligibility function**

Create `worker/src/lib/reviewPrompt.ts`:

```typescript
import type { ReviewPromptState } from '../types.js'

export const FIRST_MILESTONE      = 10
export const REPEAT_DELTA         = 15
export const COOLDOWN_DAYS        = 90
export const MAYBE_LATER_DAYS     = 30
export const FAMILY_COOLDOWN_DAYS = 30
export const MAX_PROMPTS          = 3
export const HAPPY_THRESHOLD      = 4   // used client-side; exported for consistency
export const KILL_SWITCH          = false

const DAY_MS = 86_400_000

export interface EligibilityResult {
  eligible: boolean
  reason:   string
}

/**
 * Pure eligibility check — no DB access, fully unit-testable.
 *
 * @param state             The caller's review_prompt_state row, or null if first time.
 * @param approvalsCount    Total approved completions for this family.
 * @param familyLastPrompt  Epoch ms of the most recent prompt for any OTHER parent in the family, or null.
 * @param now               Current epoch ms.
 */
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
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd worker && npx vitest run src/lib/reviewPrompt.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/reviewPrompt.ts worker/src/lib/reviewPrompt.test.ts
git commit -m "feat(worker): reviewPrompt eligibility function + unit tests"
```

---

## Task 4: Worker routes — outcome and feedback endpoints

**Files:**
- Create: `worker/src/routes/reviewPrompt.ts`

- [ ] **Step 1: Create the routes file**

Create `worker/src/routes/reviewPrompt.ts`:

```typescript
import { json, error, parseBody } from '../utils.js'
import type { AuthedRequest, Env, ReviewPromptState } from '../types.js'
import { evaluateEligibility, COOLDOWN_DAYS, MAYBE_LATER_DAYS, MAX_PROMPTS } from '../lib/reviewPrompt.js'

const DAY_MS  = 86_400_000
const DAY_SEC = 86_400

// ----------------------------------------------------------------
// POST /api/review-prompt/outcome
// Records what happened after the prompt was shown.
// Body: { outcome: 'prompted' | 'dismissed' | 'maybe_later' }
// ----------------------------------------------------------------
export async function handleReviewOutcome(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const body  = await parseBody(request)
  const outcome = body?.outcome as string | undefined
  if (!['prompted', 'dismissed', 'maybe_later'].includes(outcome ?? ''))
    return error('Invalid outcome', 400)

  const now     = Date.now()
  const nowSec  = Math.floor(now / 1000)

  const state = await env.DB
    .prepare('SELECT * FROM review_prompt_state WHERE user_id = ?')
    .bind(auth.sub)
    .first<ReviewPromptState>()

  const approvalsCount = await env.DB
    .prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE family_id = ? AND status = 'completed'`)
    .bind(auth.family_id)
    .first<{ cnt: number }>()
    .then(r => r?.cnt ?? 0)

  const cooldownDays   = outcome === 'maybe_later' ? MAYBE_LATER_DAYS : COOLDOWN_DAYS
  const suppressUntil  = now + cooldownDays * DAY_MS
  const newPromptCount = (state?.prompt_count ?? 0) + 1
  const optedOut       = (outcome === 'dismissed' && newPromptCount >= MAX_PROMPTS) ? 1 : (state?.opted_out ?? 0)

  if (state) {
    await env.DB.prepare(`
      UPDATE review_prompt_state
      SET prompt_count = ?, last_prompted_at = ?, approvals_at_last_prompt = ?,
          last_outcome = ?, suppress_until = ?, opted_out = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(newPromptCount, now, approvalsCount, outcome, suppressUntil, optedOut, now, auth.sub).run()
  } else {
    await env.DB.prepare(`
      INSERT INTO review_prompt_state
        (user_id, family_id, prompt_count, last_prompted_at, approvals_at_last_prompt,
         last_outcome, suppress_until, opted_out, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(auth.sub, auth.family_id, newPromptCount, now, approvalsCount, outcome, suppressUntil, optedOut, now, now).run()
  }

  return json({ ok: true })
}

// ----------------------------------------------------------------
// POST /api/review-prompt/feedback
// Saves private feedback from an unhappy parent.
// Body: { message?, platform, app_version }
// ----------------------------------------------------------------
export async function handleReviewFeedback(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const body     = await parseBody(request)
  const platform = body?.platform as string | undefined
  const version  = String(body?.app_version ?? 'unknown').slice(0, 32)
  const rawMsg   = body?.message ? String(body.message).trim() : null
  const message  = rawMsg ? rawMsg.slice(0, 500).replace(/<[^>]*>/g, '') : null

  if (!['android', 'ios', 'web'].includes(platform ?? ''))
    return error('Invalid platform', 400)

  const id  = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(`
    INSERT INTO review_feedback (id, user_id, family_id, message, app_platform, app_version, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(id, auth.sub, auth.family_id, message, platform, version, now).run()

  return json({ ok: true })
}

// ----------------------------------------------------------------
// handleFeedbackDigest — called from scheduled()
// Emails all un-digested feedback rows and marks them sent.
// ----------------------------------------------------------------
export async function handleFeedbackDigest(env: Env): Promise<void> {
  const rows = await env.DB
    .prepare(`SELECT * FROM review_feedback WHERE emailed_at IS NULL ORDER BY created_at ASC`)
    .all<{ id: string; user_id: string; message: string | null; app_platform: string; app_version: string; created_at: number }>()

  if (!rows.results.length) return

  const lines = rows.results.map((r, i) => {
    const ts   = new Date(r.created_at).toISOString()
    const body = r.message ? `"${r.message}"` : '(no message)'
    return `${i + 1}. [${r.app_platform} ${r.app_version}] ${ts}\n   ${body}`
  })

  const emailBody = `${rows.results.length} new Morechard review feedback item(s):\n\n${lines.join('\n\n')}`

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: 'darren.savery@gmail.com', name: 'Darren' }] }],
      from:    { email: 'noreply@morechard.com', name: 'Morechard' },
      subject: `[Morechard] ${rows.results.length} review feedback item(s)`,
      content: [{ type: 'text/plain', value: emailBody }],
    }),
  })

  const ids     = rows.results.map(r => r.id)
  const nowMs   = Date.now()
  const placeholders = ids.map(() => '?').join(',')
  await env.DB
    .prepare(`UPDATE review_feedback SET emailed_at = ? WHERE id IN (${placeholders})`)
    .bind(nowMs, ...ids)
    .run()
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/reviewPrompt.ts
git commit -m "feat(worker): review prompt outcome + feedback endpoints + digest handler"
```

---

## Task 5: Wire eligibility into chore approval + register routes

**Files:**
- Modify: `worker/src/routes/completions.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add the eligibility query to `handleCompletionApprove`**

In `worker/src/routes/completions.ts`, add this import at the top alongside the existing imports:

```typescript
import { evaluateEligibility } from '../lib/reviewPrompt.js'
import type { ReviewPromptState } from '../types.js'
```

Then, inside `handleCompletionApprove`, after the gamification hook (inside the try block, just before the `return json({...})` at line ~290), add:

```typescript
    // ── Review prompt eligibility check ───────────────────────────
    let showReviewPrompt = false
    try {
      const [rState, approvalsRow, familyRow] = await Promise.all([
        env.DB.prepare('SELECT * FROM review_prompt_state WHERE user_id = ?')
          .bind(auth.sub)
          .first<ReviewPromptState>(),
        env.DB.prepare(`SELECT COUNT(*) AS cnt FROM completions WHERE family_id = ? AND status = 'completed'`)
          .bind(comp.family_id)
          .first<{ cnt: number }>(),
        env.DB.prepare(`
          SELECT MIN(last_prompted_at) AS family_last
          FROM review_prompt_state
          WHERE family_id = ? AND user_id != ?
        `).bind(comp.family_id, auth.sub).first<{ family_last: number | null }>(),
      ])

      const approvalsCount  = (approvalsRow?.cnt ?? 0) + 1  // +1 for the one just approved
      const familyLastPrompt = familyRow?.family_last ?? null

      const verdict = evaluateEligibility(rState ?? null, approvalsCount, familyLastPrompt, Date.now())
      showReviewPrompt = verdict.eligible
    } catch {
      // Non-critical — never block the approval response
    }
    // ── End review prompt check ────────────────────────────────────
```

Replace the `return json({...})` block at line ~290 to include the new field:

```typescript
    return json({
      ok: true,
      ledger_id:            newLedgerId,
      record_hash:          recordHash,
      verification_status:  verificationStatus,
      amount:               comp.reward_amount,
      currency:             comp.currency,
      pending_celebrations: pendingCelebrations,
      show_review_prompt:   showReviewPrompt,
    })
```

Also update the catch block (gamification failure fallback, line ~300):

```typescript
    return json({
      ok: true,
      ledger_id:            newLedgerId,
      record_hash:          recordHash,
      verification_status:  verificationStatus,
      amount:               comp.reward_amount,
      currency:             comp.currency,
      pending_celebrations: [],
      show_review_prompt:   false,
    })
```

- [ ] **Step 2: Register routes + digest in `worker/src/index.ts`**

Add import near other route imports:

```typescript
import {
  handleReviewOutcome,
  handleReviewFeedback,
  handleFeedbackDigest,
} from './routes/reviewPrompt.js'
```

Add route handlers alongside the completions routes (around line 632):

```typescript
  if (path === '/api/review-prompt/outcome'  && method === 'POST') return withAuth(request, auth, env, handleReviewOutcome);
  if (path === '/api/review-prompt/feedback' && method === 'POST') return withAuth(request, auth, env, handleReviewFeedback);
```

Add digest call inside `scheduled()` (after step 7 — learning lab passive unlocks):

```typescript
    // ── 8. Review feedback email digest ────────────────────────
    if (new Date(now * 1000).getUTCHours() === 7) {
      await handleFeedbackDigest(env);
    }
```

- [ ] **Step 3: Build check**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/completions.ts worker/src/index.ts
git commit -m "feat(worker): wire review prompt eligibility into approval response + register routes"
```

---

## Task 6: Install native review plugin

**Files:**
- Modify: `app/package.json` (via npm)

- [ ] **Step 1: Install the Capacitor plugin**

```bash
cd app && npm install @capacitor-community/in-app-review
```

Expected: package added, no peer-dep errors.

- [ ] **Step 2: Sync Capacitor (Android + iOS)**

```bash
cd app && npx cap sync
```

Expected: `✔ Copying web assets` and sync completes without errors.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat(app): install @capacitor-community/in-app-review"
```

---

## Task 7: Client API helpers

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Update `approveCompletion` return type and add review helpers**

Find `approveCompletion` at line ~432 and replace it:

```typescript
export async function approveCompletion(id: string): Promise<{
  ledger_id:          number;
  amount:             number;
  currency:           string;
  show_review_prompt: boolean;
}> {
  return request(`/api/completions/${id}/approve`, { method: 'POST' });
}
```

Add after `rejectCompletion`:

```typescript
export async function postReviewOutcome(outcome: 'prompted' | 'dismissed' | 'maybe_later'): Promise<void> {
  await request('/api/review-prompt/outcome', {
    method: 'POST',
    body: JSON.stringify({ outcome }),
  });
}

export async function postReviewFeedback(payload: {
  message:     string;
  platform:    'android' | 'ios' | 'web';
  app_version: string;
}): Promise<void> {
  await request('/api/review-prompt/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api): update approveCompletion return type; add review outcome + feedback helpers"
```

---

## Task 8: Client review prompt lib

**Files:**
- Create: `app/src/lib/reviewPrompt.ts`

- [ ] **Step 1: Create the platform-aware lib**

```typescript
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
      // Native plugin failed (emulator, OS rate-limited) — fall back to web
      window.open(TRUSTPILOT_URL, '_blank', 'noopener')
    }
  } else {
    window.open(TRUSTPILOT_URL, '_blank', 'noopener')
  }
}

/** Track PostHog event — no-ops silently if analytics not consented. */
export function trackReviewPrompt(event: 'shown' | 'sentiment_positive' | 'sentiment_negative' | 'outcome' | 'feedback_submitted', extra?: Record<string, unknown>) {
  const map = {
    shown:               'review_prompt_shown',
    sentiment_positive:  'review_prompt_sentiment',
    sentiment_negative:  'review_prompt_sentiment',
    outcome:             'review_prompt_outcome',
    feedback_submitted:  'review_prompt_feedback_submitted',
  } as const
  analytics.track(map[event], { sentiment: event === 'sentiment_positive' ? 'positive' : event === 'sentiment_negative' ? 'negative' : undefined, ...extra })
}

/** Record outcome and update server state. Fire-and-forget — never blocks UI. */
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
```

- [ ] **Step 2: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/reviewPrompt.ts
git commit -m "feat(app): reviewPrompt lib — platform detection, native plugin, Trustpilot fallback"
```

---

## Task 9: ReviewPromptSheet component

**Files:**
- Create: `app/src/components/review/ReviewPromptSheet.tsx`

- [ ] **Step 1: Create the sheet**

```tsx
import { useState } from 'react'
import { requestPublicReview, recordOutcome, submitFeedback, trackReviewPrompt } from '../../lib/reviewPrompt'

interface Props {
  open:    boolean
  onClose: () => void
}

type Step = 'question' | 'feedback' | 'thanks'

export function ReviewPromptSheet({ open, onClose }: Props) {
  const [step,        setStep]        = useState<Step>('question')
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  if (!open) return null

  function handleLoveIt() {
    trackReviewPrompt('sentiment_positive', { platform: window.__reviewPlatform })
    recordOutcome('prompted')
    requestPublicReview()
    onClose()
  }

  function handleNotReally() {
    trackReviewPrompt('sentiment_negative')
    setStep('feedback')
  }

  async function handleFeedbackSubmit() {
    if (submitting) return
    setSubmitting(true)
    const ok = await submitFeedback(feedbackMsg.trim())
    if (ok) trackReviewPrompt('feedback_submitted')
    recordOutcome('prompted')
    setStep('thanks')
    setSubmitting(false)
  }

  function handleMaybeLater() {
    trackReviewPrompt('outcome', { outcome: 'maybe_later' })
    recordOutcome('maybe_later')
    onClose()
  }

  function handleDismiss() {
    if (step === 'question') {
      trackReviewPrompt('outcome', { outcome: 'dismissed' })
      recordOutcome('dismissed')
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-[var(--surface-card,#1a2a1f)] p-6 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'question' && (
          <>
            <h2 className="mb-2 text-center text-lg font-semibold text-white">
              Are you enjoying Morechard?
            </h2>
            <p className="mb-6 text-center text-sm text-white/60">
              Takes 30 seconds and helps other families find us.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLoveIt}
                className="w-full rounded-xl bg-[var(--brand-primary,#4ade80)] py-3 font-semibold text-[#0f1a14]"
              >
                Love it!
              </button>
              <button
                onClick={handleNotReally}
                className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white/80"
              >
                Not really
              </button>
            </div>
            <button
              onClick={handleMaybeLater}
              className="mt-4 w-full text-center text-sm text-white/40 underline"
            >
              Maybe later
            </button>
          </>
        )}

        {step === 'feedback' && (
          <>
            <h2 className="mb-2 text-center text-lg font-semibold text-white">
              Thanks for telling us
            </h2>
            <p className="mb-4 text-center text-sm text-white/60">
              What could be better? (optional)
            </p>
            <textarea
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Your feedback goes straight to Darren…"
              className="w-full rounded-xl border border-white/20 bg-white/5 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#4ade80)]"
            />
            <p className="mb-4 text-right text-xs text-white/30">{feedbackMsg.length}/500</p>
            <button
              onClick={handleFeedbackSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-[var(--brand-primary,#4ade80)] py-3 font-semibold text-[#0f1a14] disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
          </>
        )}

        {step === 'thanks' && (
          <>
            <h2 className="mb-2 text-center text-lg font-semibold text-white">
              We'll look into it
            </h2>
            <p className="mb-6 text-center text-sm text-white/60">
              Your feedback helps us improve Morechard for everyone.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-[var(--brand-primary,#4ade80)] py-3 font-semibold text-[#0f1a14]"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/review/ReviewPromptSheet.tsx
git commit -m "feat(app): ReviewPromptSheet — binary sentiment gate with feedback form"
```

---

## Task 10: Wire into PendingTab

**Files:**
- Modify: `app/src/components/dashboard/PendingTab.tsx`

- [ ] **Step 1: Add state and import to PendingTab**

At the top of `PendingTab.tsx`, add to the existing import block:

```typescript
import { ReviewPromptSheet } from '../review/ReviewPromptSheet'
import { trackReviewPrompt } from '../../lib/reviewPrompt'
```

Inside the component, add state alongside existing state declarations:

```typescript
const [showReviewPrompt, setShowReviewPrompt] = useState(false)
```

- [ ] **Step 2: Update `handleApprove` to check the flag**

Replace the existing `handleApprove` function:

```typescript
  async function handleApprove(id: string) {
    setBusy(id)
    try {
      const result = await approveCompletion(id)
      const approved = completions.find((c) => c.id === id)
      await load()
      if (approved) {
        setPendingToastAction({
          label: `Pay Now (${formatCurrency(approved.reward_amount, approved.currency)})`,
          onClick: () => setBridgeCtx({
            completionIds: [approved.id],
            total: approved.reward_amount,
            currency: approved.currency,
          }),
        })
        showToast(`Approved ✓`)
      }
      if (result.show_review_prompt) {
        setTimeout(() => {
          trackReviewPrompt('shown', { platform: 'web', trigger: 'nth_approval' })
          setShowReviewPrompt(true)
        }, 500)
      }
    } finally {
      setBusy(null)
    }
  }
```

- [ ] **Step 3: Add the sheet to the JSX**

Add inside the component's return, as the last child before the closing fragment/div:

```tsx
      <ReviewPromptSheet
        open={showReviewPrompt}
        onClose={() => setShowReviewPrompt(false)}
      />
```

- [ ] **Step 4: Build check**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/PendingTab.tsx
git commit -m "feat(app): trigger ReviewPromptSheet after Nth chore approval in PendingTab"
```

---

## Task 11: Deploy migration to production

- [ ] **Step 1: Apply migration to production D1**

```bash
wrangler d1 execute morechard-db --remote --file=worker/migrations/0063_review_prompts.sql
```

Expected: `✅ Successfully executed`.

- [ ] **Step 2: Deploy worker**

```bash
npm run dev
```

Verify the worker builds without errors, then:

```bash
wrangler deploy
```

- [ ] **Step 3: Smoke test eligibility**

Approve a chore in the live app as a parent and confirm the approval response in the network tab includes `show_review_prompt: false` (won't be true until 10 approvals are accumulated).

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: review prompt — full feature shipped (worker + app + migration)"
```

---

## Self-Review Checklist

- [x] Migration: both tables, index on `(family_id, last_prompted_at)`
- [x] Types: `ReviewPromptState`, `ReviewFeedback`
- [x] Eligibility: all 8 guard conditions including family cooldown
- [x] `handleCompletionApprove`: eligibility injected in gamification try block, both return paths include `show_review_prompt`
- [x] `approveAll` not modified — only single-approval path triggers prompt (intentional: batch approval is a bulk action, not a single delight moment)
- [x] Outcome endpoint: all three outcomes handled, `opted_out` set after MAX_PROMPTS dismissals
- [x] Feedback endpoint: 500-char trim + HTML strip
- [x] CRON digest: gated to 07:00 UTC, no email if no rows, marks `emailed_at`
- [x] Native plugin: installed, synced, graceful fallback on failure
- [x] Client lib: `getAppPlatform`, `getAppVersion`, `requestPublicReview`, `recordOutcome`, `submitFeedback`, `trackReviewPrompt`
- [x] Sheet: all steps (`question`, `feedback`, `thanks`), `maybe_later` link, backdrop dismiss
- [x] PendingTab: 500ms delay, `show_review_prompt` check, sheet wired
- [x] PostHog: 4 events via existing `analytics.track` wrapper
- [x] `approveAll` intentionally excluded — not a single-moment delight trigger
