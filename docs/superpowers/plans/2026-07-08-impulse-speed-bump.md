# Impulse Speed Bump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a child logs a spend that's over 15% of their available balance, show a one-time "Cooldown Observation" interstitial (Orchard/Clean toned) before saving, and record the outcome for the AI Mentor audit trail.

**Architecture:** A pure threshold function decides client-side whether to interrupt the existing `SpendGuideSheet` save flow with a new interstitial view (no new screen/route). Whichever button the child taps calls a new worker endpoint that writes one `child_nudges` row carrying the outcome, reusing the existing `generateChildNudge` helper and `NUDGES` content library already powering every other AI Mentor nudge.

**Tech Stack:** React + TypeScript (Vite app), Cloudflare Workers + D1 (existing `child_nudges` table, no schema change), Vitest + React Testing Library.

## Global Constraints

- Threshold: interstitial triggers only when `availableBalancePence >= 500` (£5 floor) AND `amountPence > 0.15 * availableBalancePence`.
- Threshold check runs *after* existing form validation (non-empty title, `pence > 0`) — never before.
- Outcome values are exactly `'waited' | 'proceeded'` — no other strings.
- The audit row is written once the child acts (taps a button), never merely on interstitial display.
- No goal-specific copy personalization, no subscription/tier gating, no literal 48-hour timer — per `docs/superpowers/specs/2026-07-08-impulse-speed-bump-design.md`.
- `LogSpendSheet.tsx` is dead code and must not be touched.

---

### Task 1: Threshold pure function

**Files:**
- Create: `app/src/lib/impulseSpeedBump.ts`
- Test: `app/src/lib/impulseSpeedBump.test.ts`

**Interfaces:**
- Produces: `shouldTriggerImpulseSpeedBump(amountPence: number, availableBalancePence: number): boolean` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/impulseSpeedBump.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/impulseSpeedBump.test.ts`
Expected: FAIL — `Cannot find module './impulseSpeedBump'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/impulseSpeedBump.ts
const MIN_BALANCE_PENCE = 500
const THRESHOLD_RATIO   = 0.15

/** True when a spend is large enough, relative to the child's available
 * balance, to warrant the Impulse Speed Bump cooldown interstitial. */
export function shouldTriggerImpulseSpeedBump(
  amountPence: number,
  availableBalancePence: number,
): boolean {
  if (availableBalancePence < MIN_BALANCE_PENCE) return false
  return amountPence > THRESHOLD_RATIO * availableBalancePence
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/impulseSpeedBump.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/impulseSpeedBump.ts app/src/lib/impulseSpeedBump.test.ts
git commit -m "feat: add Impulse Speed Bump threshold function"
```

---

### Task 2: Backend nudge entry + outcome endpoint

**Files:**
- Modify: `worker/src/routes/child-nudges.ts` (add `NUDGES['impulse_speed_bump']`, add `validateImpulseOutcomeBody`, add `handleImpulseOutcome`)
- Modify: `worker/src/index.ts:196` (import), `worker/src/index.ts:635-636` (route registration)
- Test: `worker/src/routes/child-nudges.test.ts` (new file)

**Interfaces:**
- Consumes: `generateChildNudge(db: D1Database, child_id: string, family_id: string, trigger_type: string, meta?: Record<string, string | number>): Promise<void>` — already defined and exported in `child-nudges.ts`.
- Consumes: `json`/`error` from `../lib/response.js`, `JwtPayload` from `../lib/jwt.js` — already imported in `child-nudges.ts`.
- Produces: `validateImpulseOutcomeBody(body: Record<string, unknown>): string | null` — exported for the test in this task.
- Produces: `handleImpulseOutcome(request: Request, env: Env): Promise<Response>` — registered at `POST /api/child-nudges/impulse-outcome`, consumed by Task 3's `logImpulseOutcome` client wrapper.

- [ ] **Step 1: Write the failing test**

```ts
// worker/src/routes/child-nudges.test.ts
import { describe, it, expect } from 'vitest';
import { validateImpulseOutcomeBody } from './child-nudges.js';

describe('validateImpulseOutcomeBody', () => {
  const valid = {
    family_id: 'fam1', child_id: 'child1',
    amount_pence: 500, balance_pence: 2000, outcome: 'waited' as const,
  };

  it('accepts a valid "waited" outcome', () => {
    expect(validateImpulseOutcomeBody(valid)).toBeNull();
  });

  it('accepts a valid "proceeded" outcome', () => {
    expect(validateImpulseOutcomeBody({ ...valid, outcome: 'proceeded' })).toBeNull();
  });

  it('rejects a missing family_id', () => {
    const { family_id, ...rest } = valid;
    expect(validateImpulseOutcomeBody(rest)).toBe('family_id required');
  });

  it('rejects a missing child_id', () => {
    const { child_id, ...rest } = valid;
    expect(validateImpulseOutcomeBody(rest)).toBe('child_id required');
  });

  it('rejects a zero amount_pence', () => {
    expect(validateImpulseOutcomeBody({ ...valid, amount_pence: 0 })).toBe(
      'amount_pence must be a positive integer',
    );
  });

  it('rejects a negative balance_pence', () => {
    expect(validateImpulseOutcomeBody({ ...valid, balance_pence: -1 })).toBe(
      'balance_pence must be a non-negative integer',
    );
  });

  it('rejects an outcome value outside the enum', () => {
    expect(validateImpulseOutcomeBody({ ...valid, outcome: 'maybe' })).toBe(
      'outcome must be "waited" or "proceeded"',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run src/routes/child-nudges.test.ts`
Expected: FAIL — `validateImpulseOutcomeBody is not exported`

- [ ] **Step 3: Add the NUDGES entry**

In `worker/src/routes/child-nudges.ts`, add this entry to the `NUDGES` dict, after `earnings_volatile` and before the `lab_reinforced_M9b` comment block (i.e. in the background-triggers section, since it's real-time-per-event not weekly-CRON, but content-wise it belongs with the other `OPPORTUNITY_COST` spend nudges):

```ts
  impulse_speed_bump: {
    screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
    parent_summary: 'Large spend flagged — impulse cooldown shown',
    orchard: "We've noticed this harvest is very large! If you keep these seeds instead, your grove keeps growing. Are you sure?",
    clean:   'This is 15% of your available balance. Delaying big spends by 48 hours usually feels better later. Shall we pause?',
  },
```

- [ ] **Step 4: Add the validation function and endpoint handler**

Add at the end of `worker/src/routes/child-nudges.ts`:

```ts
// ── POST /api/child-nudges/impulse-outcome ────────────────────────────────────
// Logs the outcome of an Impulse Speed Bump interstitial. Written once the
// child acts — taps "Wait a bit" or "I'm sure, log it" — never merely when
// the interstitial is shown, so one row always carries the full outcome.

export function validateImpulseOutcomeBody(body: Record<string, unknown>): string | null {
  if (!body.family_id || typeof body.family_id !== 'string') return 'family_id required';
  if (!body.child_id  || typeof body.child_id  !== 'string') return 'child_id required';
  if (!Number.isInteger(body.amount_pence) || (body.amount_pence as number) <= 0)
    return 'amount_pence must be a positive integer';
  if (!Number.isInteger(body.balance_pence) || (body.balance_pence as number) < 0)
    return 'balance_pence must be a non-negative integer';
  if (body.outcome !== 'waited' && body.outcome !== 'proceeded')
    return 'outcome must be "waited" or "proceeded"';
  return null;
}

export async function handleImpulseOutcome(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can log this outcome', 403);

  const body = await request.json<Record<string, unknown>>();

  const validationError = validateImpulseOutcomeBody(body);
  if (validationError) return error(validationError, 400);

  const family_id    = body.family_id as string;
  const child_id     = body.child_id as string;
  const amount_pence  = body.amount_pence as number;
  const balance_pence = body.balance_pence as number;
  const outcome       = body.outcome as 'waited' | 'proceeded';

  if (child_id !== auth.sub || family_id !== auth.family_id) return error('Forbidden', 403);

  await generateChildNudge(env.DB, child_id, family_id, 'impulse_speed_bump', {
    amount_pence, balance_pence, outcome,
  });

  return json({ ok: true });
}
```

- [ ] **Step 5: Register the route**

In `worker/src/index.ts`, change the import at line 196:

```ts
import { handleGetChildNudges, handleDismissChildNudge, handleImpulseOutcome, runChildNudgeBackgroundChecks } from './routes/child-nudges.js';
```

And add a new route line immediately after line 636 (`/api/child-nudges/dismiss`):

```ts
if (path === '/api/child-nudges/impulse-outcome' && method === 'POST') return withAuth(request, auth, env, handleImpulseOutcome);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd worker && npx vitest run src/routes/child-nudges.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 7: Run the full worker test suite to check nothing broke**

Run: `cd worker && npx vitest run`
Expected: all existing suites still PASS

- [ ] **Step 8: Commit**

```bash
git add worker/src/routes/child-nudges.ts worker/src/routes/child-nudges.test.ts worker/src/index.ts
git commit -m "feat: add impulse-speed-bump nudge entry and outcome endpoint"
```

---

### Task 3: Frontend API wrapper

**Files:**
- Modify: `app/src/lib/api.ts` (add `logImpulseOutcome`, right after the existing `dismissChildNudge` function around line 1324)

**Interfaces:**
- Consumes: `request<T>(path: string, init?: RequestInit): Promise<T>` — the existing internal fetch helper already used by every other function in this file (e.g. `dismissChildNudge`).
- Produces: `logImpulseOutcome(body: { family_id: string; child_id: string; amount_pence: number; balance_pence: number; outcome: 'waited' | 'proceeded' }): Promise<{ ok: boolean }>` — consumed by Task 4.

- [ ] **Step 1: Add the wrapper function**

In `app/src/lib/api.ts`, immediately after the `dismissChildNudge` function (currently ending around line 1324):

```ts
export async function logImpulseOutcome(body: {
  family_id: string; child_id: string;
  amount_pence: number; balance_pence: number;
  outcome: 'waited' | 'proceeded';
}): Promise<{ ok: boolean }> {
  return request('/api/child-nudges/impulse-outcome', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

This is a thin fetch wrapper with no branching logic — consistent with `dismissChildNudge` immediately above it, which has no dedicated unit test in this codebase either. No test file for this step.

- [ ] **Step 2: Type-check the file**

Run: `cd app && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat: add logImpulseOutcome API wrapper"
```

---

### Task 4: SpendGuideSheet interstitial + ChildMoneyTab wiring

**Files:**
- Modify: `app/src/components/dashboard/SpendGuideSheet.tsx`
- Modify: `app/src/components/dashboard/ChildMoneyTab.tsx`
- Test: `app/src/components/dashboard/__tests__/SpendGuideSheet.test.tsx` (new file)

**Interfaces:**
- Consumes: `shouldTriggerImpulseSpeedBump(amountPence: number, availableBalancePence: number): boolean` from Task 1 (`app/src/lib/impulseSpeedBump.ts`).
- Consumes: `logImpulseOutcome(body: {...}): Promise<{ ok: boolean }>` from Task 3 (`app/src/lib/api.ts`).
- Consumes: `logSpend`, already imported in `SpendGuideSheet.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// app/src/components/dashboard/__tests__/SpendGuideSheet.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpendGuideSheet } from '../SpendGuideSheet'
import * as api from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  logSpend: vi.fn().mockResolvedValue({ id: 'spend1', spent_at: 0 }),
  logImpulseOutcome: vi.fn().mockResolvedValue({ ok: true }),
}))

const baseProps = {
  open: true,
  familyId: 'fam1',
  childId: 'child1',
  currency: 'GBP',
  appView: 'CLEAN' as const,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

function logACustomSpend(amountStr: string) {
  fireEvent.click(screen.getByText('Add a custom spend'))
  fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'New shoes' } })
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: amountStr } })
  fireEvent.click(screen.getByText('Save spend →'))
}

describe('SpendGuideSheet — Impulse Speed Bump', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('saves immediately, without a cooldown, when the spend is below 15% of balance', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('5.00') // 500p / 10000p = 5%

    await waitFor(() => expect(api.logSpend).toHaveBeenCalled())
    expect(api.logImpulseOutcome).not.toHaveBeenCalled()
    expect(screen.queryByText(/Shall we pause/)).toBeNull()
  })

  it('shows the cooldown interstitial when the spend exceeds 15% of balance', () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00') // 2000p / 10000p = 20%

    expect(screen.getByText(/Shall we pause/)).toBeTruthy()
    expect(api.logSpend).not.toHaveBeenCalled()
  })

  it('shows Orchard-toned copy when appView is ORCHARD', () => {
    render(<SpendGuideSheet {...baseProps} appView="ORCHARD" availableBalancePence={10000} />)
    logACustomSpend('20.00')

    expect(screen.getByText(/your grove keeps growing/)).toBeTruthy()
  })

  it('"Wait a bit" logs the waited outcome and does not save the spend', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00')

    fireEvent.click(screen.getByText('Wait a bit'))

    await waitFor(() => expect(api.logImpulseOutcome).toHaveBeenCalledWith({
      family_id: 'fam1', child_id: 'child1',
      amount_pence: 2000, balance_pence: 10000,
      outcome: 'waited',
    }))
    expect(api.logSpend).not.toHaveBeenCalled()
  })

  it('"I\'m sure, log it" logs the proceeded outcome and then saves the spend', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00')

    fireEvent.click(screen.getByText("I'm sure, log it"))

    await waitFor(() => expect(api.logSpend).toHaveBeenCalledWith({
      family_id: 'fam1', title: 'New shoes', amount: 2000, currency: 'GBP',
      category: 'other', note: undefined,
    }))
    expect(api.logImpulseOutcome).toHaveBeenCalledWith({
      family_id: 'fam1', child_id: 'child1',
      amount_pence: 2000, balance_pence: 10000,
      outcome: 'proceeded',
    })
  })

  it('does not trigger the cooldown when balance is below the £5 floor', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={400} />)
    logACustomSpend('3.00') // 300p / 400p = 75%, but balance is under the floor

    await waitFor(() => expect(api.logSpend).toHaveBeenCalled())
    expect(screen.queryByText(/Shall we pause/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/components/dashboard/__tests__/SpendGuideSheet.test.tsx`
Expected: FAIL — `availableBalancePence`/`childId` don't exist on `Props`, `logImpulseOutcome` not called, cooldown text not found

- [ ] **Step 3: Update SpendGuideSheet.tsx imports and Props**

In `app/src/components/dashboard/SpendGuideSheet.tsx`, change the imports at the top:

```ts
import { logSpend, logImpulseOutcome } from '../../lib/api'
```

to:

```ts
import { logSpend, logImpulseOutcome } from '../../lib/api'
import { shouldTriggerImpulseSpeedBump } from '../../lib/impulseSpeedBump'
```

(the `logSpend` import already exists at line 9 — just add `logImpulseOutcome` to that same import line, and add the new `shouldTriggerImpulseSpeedBump` import line below it.)

Update the `Props` interface (currently at line ~147):

```ts
interface Props {
  open:      boolean
  familyId:  string
  childId:   string
  currency:  string
  appView:   'ORCHARD' | 'CLEAN'
  availableBalancePence: number
  onClose:   () => void
  onSaved:   () => void
}
```

Update the component signature (currently line 164):

```ts
export function SpendGuideSheet({ open, familyId, childId, currency, appView, availableBalancePence, onClose, onSaved }: Props) {
```

- [ ] **Step 4: Add cooldown state and update closeEntry**

Add a new state declaration right after the existing `saveErr`/`success` state (around line 169):

```ts
  const [cooldown, setCooldown] = useState<{ amountPence: number } | null>(null)
```

Update `closeEntry` (currently line 176) to also clear cooldown state:

```ts
  const closeEntry = () => { void tick(); setEntry(null); setSaveErr(null); setCooldown(null) }
```

- [ ] **Step 5: Split handleSave into handleSaveClick, doSave, and the two cooldown handlers**

Replace the existing `handleSave` function (currently lines 208-233) with:

```ts
  function handleSaveClick() {
    if (!entry) return
    const title = entry.title.trim()
    if (!title) { setSaveErr('Please add a description.'); return }
    const pence = Math.round(parseFloat(entry.amountStr || '0') * 100)
    if (!pence || pence <= 0) { setSaveErr('Please enter an amount.'); return }

    if (shouldTriggerImpulseSpeedBump(pence, availableBalancePence)) {
      setCooldown({ amountPence: pence })
      return
    }
    void doSave(pence, title)
  }

  async function doSave(pence: number, title: string) {
    if (!entry) return
    setSaving(true)
    setSaveErr(null)
    try {
      await logSpend({
        family_id: familyId,
        title,
        amount:    pence,
        currency,
        category:  entry.category,
        note:      entry.note.trim() || undefined,
      })
      setEntry(null)
      setSuccess(true)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function handleCooldownWait() {
    if (!cooldown) return
    logImpulseOutcome({
      family_id: familyId, child_id: childId,
      amount_pence: cooldown.amountPence, balance_pence: availableBalancePence,
      outcome: 'waited',
    }).catch(() => {})
    setCooldown(null)
    closeEntry()
  }

  function handleCooldownProceed() {
    if (!cooldown || !entry) return
    const amountPence = cooldown.amountPence
    const title = entry.title.trim()
    logImpulseOutcome({
      family_id: familyId, child_id: childId,
      amount_pence: amountPence, balance_pence: availableBalancePence,
      outcome: 'proceeded',
    }).catch(() => {})
    setCooldown(null)
    void doSave(amountPence, title)
  }
```

- [ ] **Step 6: Wrap the existing amount-entry form and add the cooldown view**

Find the block starting `{/* Optional note */}` down through the closing `</div>` of the Back/Save button row (the two buttons calling `closeEntry` and `handleSave`, currently ending around line 505). Wrap everything from the top of the entry sub-sheet content (`{/* Drag handle */}` through the end of the Back/Save buttons, i.e. the full existing form body) in a conditional so it only renders when there's no cooldown, and add a new cooldown block as a sibling. Concretely, change:

```tsx
      {entry && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeEntry} />
          <div ref={entrySheetRef} className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4 max-h-[88%] overflow-y-auto">

            {/* Drag handle */}
            <div {...entryHandleProps}>
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            {/* ... existing title / category / amount / note fields ... */}

            <div className="flex gap-3">
              <button onClick={closeEntry} ...>Back</button>
              <button onClick={handleSave} ...>{saving ? 'Saving…' : 'Save spend →'}</button>
            </div>
          </div>
        </div>
      )}
```

to:

```tsx
      {entry && cooldown && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={handleCooldownWait} />
          <div className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4">
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>
            <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              Just checking
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
              {appView === 'CLEAN'
                ? 'This is 15% of your available balance. Delaying big spends by 48 hours usually feels better later. Shall we pause?'
                : "We've noticed this harvest is very large! If you keep these seeds instead, your grove keeps growing. Are you sure?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCooldownWait}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                Wait a bit
              </button>
              <button
                onClick={handleCooldownProceed}
                disabled={saving}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving…' : "I'm sure, log it"}
              </button>
            </div>
          </div>
        </div>
      )}

      {entry && !cooldown && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeEntry} />
          <div ref={entrySheetRef} className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4 max-h-[88%] overflow-y-auto">

            {/* Drag handle */}
            <div {...entryHandleProps}>
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <div>
              <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
                Log a spend
              </p>
              {entry.custom ? (
                <input
                  type="text"
                  value={entry.title}
                  onChange={e => setEntry(v => v && ({ ...v, title: e.target.value, category: detectCategory(e.target.value) }))}
                  placeholder="What did you buy?"
                  autoFocus
                  className="w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[15px] font-semibold bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] mt-1"
                />
              ) : (
                <p className="text-[17px] font-bold text-[var(--color-text)]">{entry.title}</p>
              )}
            </div>

            {/* Category — read-only chip for catalogue items, picker for custom */}
            <div>
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                Category
              </label>
              {entry.custom ? (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {SPEND_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEntry(v => v && ({ ...v, category: c.id }))}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        entry.category === c.id
                          ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                      }`}
                    >
                      <CategoryIcon id={c.id} size={13} />
                      {c.heading}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
                  <CategoryIcon id={entry.category} size={13} />
                  {SPEND_CATEGORIES.find(c => c.id === entry.category)?.heading ?? 'Other'}
                </span>
              )}
            </div>

            <ErrorBox message={saveErr} />

            {/* Amount */}
            <div>
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                How much did you spend?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[var(--color-text-muted)]">
                  {symbol}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  autoFocus={!entry.custom}
                  value={entry.amountStr}
                  onChange={e => setEntry(v => v && ({ ...v, amountStr: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-[var(--color-border)] rounded-xl pl-8 pr-3 py-3 text-[20px] font-bold tabular-nums bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            {/* Optional note */}
            <div>
              <button
                type="button"
                onClick={() => setEntry(v => v && ({ ...v, noteOpen: !v.noteOpen }))}
                className="text-[13px] font-semibold text-[var(--brand-primary)] cursor-pointer"
              >
                {entry.noteOpen ? '▾ Remove note' : '▸ Add a note'}
              </button>
              {entry.noteOpen && (
                <textarea
                  value={entry.note}
                  onChange={e => setEntry(v => v && ({ ...v, note: e.target.value }))}
                  placeholder="e.g. birthday money treat"
                  rows={2}
                  className="mt-2 w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[13px] resize-none bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={closeEntry} className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer">
                Back
              </button>
              <button onClick={handleSaveClick} disabled={saving} className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all">
                {saving ? 'Saving…' : 'Save spend →'}
              </button>
            </div>
          </div>
        </div>
      )}
```

This block is identical to the sheet's existing form JSX (title/custom input, category chips, amount input, note toggle, `ErrorBox`) with two changes only: it's now gated on `!cooldown` instead of rendering unconditionally under `entry`, and the Save button's `onClick` changes from `handleSave` to `handleSaveClick`.

- [ ] **Step 7: Wire up ChildMoneyTab**

In `app/src/components/dashboard/ChildMoneyTab.tsx`, update the `<SpendGuideSheet>` call (currently lines 184-190):

```tsx
      <SpendGuideSheet
        open={logOpen}
        familyId={familyId}
        childId={childId}
        currency={currency}
        appView={appView}
        availableBalancePence={balance?.available ?? 0}
        onClose={() => setLogOpen(false)}
        onSaved={handleSaved}
      />
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd app && npx vitest run src/components/dashboard/__tests__/SpendGuideSheet.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 9: Run full frontend test suite and type-check**

Run: `cd app && npx vitest run && npx tsc --noEmit`
Expected: all suites PASS, no new type errors (this also confirms `ChildMoneyTab.tsx`'s new required props are satisfied)

- [ ] **Step 10: Manual smoke test on a small viewport**

Start the dev server (`npm run dev` from repo root) and open the app in a browser at a 375×667 viewport (iPhone SE size). As a child, log a spend over 15% of balance in both an ORCHARD-view family and a CLEAN-view family; confirm both copy variants render fully above the two buttons without the buttons being pushed off-screen or requiring scroll.

- [ ] **Step 11: Commit**

```bash
git add app/src/components/dashboard/SpendGuideSheet.tsx app/src/components/dashboard/ChildMoneyTab.tsx app/src/components/dashboard/__tests__/SpendGuideSheet.test.tsx
git commit -m "feat: add Impulse Speed Bump cooldown interstitial to Spend Guide"
```

---

## Post-implementation

Update `CLAUDE.md`'s Phase 5 checklist — the "Implement AI 'Nudges' based on spending patterns" line — noting spending-pattern nudges were already largely shipped via `child-nudges.ts`'s background sweep, and this plan closes the one remaining gap (the real-time Impulse Speed Bump). Consider whether to check that line off entirely or leave it open pending Velocity Alert / Parental Loan Modeller (out of scope here, per the spec's non-goals).
