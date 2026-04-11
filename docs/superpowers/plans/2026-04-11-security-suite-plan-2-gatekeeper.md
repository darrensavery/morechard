# Security Suite — Plan 2: useGatekeeper Hook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `useGatekeeper` hook and its inline modal so any component can challenge the parent for biometrics/PIN before performing a sensitive action.

**Architecture:** A single React hook (`useGatekeeper`) holds all challenge state. It returns a `challenge(onSuccess)` function and a `GatekeeperModal` component. The modal renders inline (not in a portal) so callers just drop `<GatekeeperModal />` into their JSX. The hook checks a 5-minute sessionStorage grace window first, then tries biometrics, then falls back to a PIN pad that calls the existing `POST /auth/verify-pin` route. On 429 the pad dims and shows a live countdown. The hook lives in `app/src/hooks/useGatekeeper.ts`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, existing `challengeBiometrics` / `hasBiometricCredential` from `app/src/lib/biometrics.ts`, existing `request` helper pattern from `app/src/lib/api.ts`.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/src/lib/api.ts` | **Modify** | Add `verifyPin`, `MeResult` gains `has_password`/`has_pin`, add `SessionRow`, `getSessions`, `revokeSession`, `revokeOtherSessions`, `setParentPin`, `resetPinWithPassword` |
| `app/src/hooks/useGatekeeper.ts` | **Create** | The hook + `GatekeeperModal` component |

No other files change in this plan. UI components (Plan 3) will import from both of these.

---

## Task 1: Extend `api.ts` with security client functions

**Files:**
- Modify: `app/src/lib/api.ts`

The existing `MeResult` interface is missing `has_password` and `has_pin`. Add them, plus six new functions. All follow the existing `request<T>()` pattern already in the file.

- [ ] **Step 1: Update `MeResult` and add security functions**

Find the existing `MeResult` interface (around line 94):

```ts
export interface MeResult {
  id: string; display_name: string; email: string | null;
  email_verified: number; email_pending: string | null;
  family_id: string; role: 'parent' | 'child'; locale: string;
}
```

Replace with:

```ts
export interface MeResult {
  id: string; display_name: string; email: string | null;
  email_verified: number; email_pending: string | null;
  family_id: string; role: 'parent' | 'child'; locale: string;
  has_password: boolean;
  has_pin: boolean;
}
```

Then, after the last existing export in the Auth section (after `getMe`), add:

```ts
// ----------------------------------------------------------------
// Security — PIN & Sessions
// ----------------------------------------------------------------

export interface SessionRow {
  jti: string;
  issued_at: number;
  user_agent: string | null;
}

/** Set or change the parent PIN. Always requires the email password (master key). */
export async function setParentPin(password: string, newPin: string): Promise<{ ok: boolean }> {
  return request('/auth/pin/set', { method: 'POST', body: JSON.stringify({ password, new_pin: newPin }) });
}

/** Same server route as setParentPin — separate name for distinct UI copy ("Forgot PIN?"). */
export async function resetPinWithPassword(password: string, newPin: string): Promise<{ ok: boolean }> {
  return request('/auth/pin/reset-with-password', { method: 'POST', body: JSON.stringify({ password, new_pin: newPin }) });
}

/** Verify the parent's 4-digit PIN. Throws on 401 (wrong) or 429 (locked). */
export async function verifyPin(pin: string): Promise<{ ok: boolean }> {
  return request('/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) });
}

/** List all active sessions for the current parent. */
export async function getSessions(): Promise<{ sessions: SessionRow[] }> {
  return request('/auth/sessions');
}

/** Revoke a single session by JTI. */
export async function revokeSession(jti: string): Promise<{ ok: boolean }> {
  return request(`/auth/sessions/${jti}`, { method: 'DELETE' });
}

/** Revoke all sessions except the current one. */
export async function revokeOtherSessions(): Promise<{ ok: boolean; revoked: number }> {
  return request('/auth/sessions?others=true', { method: 'DELETE' });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | grep -E "api\.ts"
```

Expected: no lines (no errors in api.ts).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api): add security client functions — verifyPin, sessions CRUD, setParentPin"
```

---

## Task 2: Create `useGatekeeper` hook

**Files:**
- Create: `app/src/hooks/useGatekeeper.ts`

This is the core of Plan 2. The hook manages all state internally. The `GatekeeperModal` is a component defined inside the same file and returned from the hook — this avoids prop-drilling and keeps the modal logic co-located with the state it reads.

**Grace window:** `sessionStorage` key `mc_gk_verified_at` stores a Unix ms timestamp. If `Date.now() - stored < 5 * 60 * 1000`, the grace window is active and `challenge()` calls `onSuccess()` immediately.

**PIN length:** 4 digits (matches the server's `/^\d{4}$/` validation).

**Digit pad layout** (matches `LockScreen.tsx`): buttons 1–9, then 0 and ⌫, arranged in a 3-column grid.

- [ ] **Step 1: Create the file**

Create `app/src/hooks/useGatekeeper.ts` with the following complete implementation:

```ts
/**
 * useGatekeeper — Challenge the parent for biometrics or PIN before sensitive actions.
 *
 * Usage:
 *   const { challenge, GatekeeperModal } = useGatekeeper()
 *   // In JSX: <GatekeeperModal />
 *   // On action: challenge(() => doTheSensitiveThing())
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { challengeBiometrics, hasBiometricCredential } from '../lib/biometrics'
import { verifyPin } from '../lib/api'

const GRACE_MS    = 5 * 60 * 1000   // 5 minutes
const GRACE_KEY   = 'mc_gk_verified_at'
const PIN_LENGTH  = 4

function isWithinGrace(): boolean {
  const stored = sessionStorage.getItem(GRACE_KEY)
  if (!stored) return false
  return Date.now() - parseInt(stored, 10) < GRACE_MS
}

function markVerified(): void {
  sessionStorage.setItem(GRACE_KEY, String(Date.now()))
}

// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────

export function useGatekeeper() {
  const navigate = useNavigate()

  const [open,        setOpen]        = useState(false)
  const [digits,      setDigits]      = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [errorMsg,    setErrorMsg]    = useState('')
  const [shake,       setShake]       = useState(false)
  const [locked,      setLocked]      = useState(false)       // 429 lockout
  const [lockSeconds, setLockSeconds] = useState(0)
  const [submitting,  setSubmitting]  = useState(false)

  const pendingRef   = useRef<(() => void) | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up countdown on unmount
  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  // ── Challenge entry point ────────────────────────────────────────
  const challenge = useCallback(async (onSuccess: () => void) => {
    if (isWithinGrace()) { onSuccess(); return }

    pendingRef.current = onSuccess

    // Try biometrics first if registered
    if (hasBiometricCredential()) {
      const result = await challengeBiometrics()
      if (result.ok) {
        markVerified()
        onSuccess()
        return
      }
      // Denied or unavailable — fall through to PIN modal
    }

    // Show PIN modal
    setDigits(Array(PIN_LENGTH).fill(''))
    setErrorMsg('')
    setShake(false)
    setLocked(false)
    setLockSeconds(0)
    setOpen(true)
  }, [])

  // ── PIN submission ───────────────────────────────────────────────
  const submitPin = useCallback(async (pin: string) => {
    if (submitting || locked) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      await verifyPin(pin)
      markVerified()
      setOpen(false)
      setDigits(Array(PIN_LENGTH).fill(''))
      pendingRef.current?.()
      pendingRef.current = null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)

      // Parse 429 — message is "Too many attempts. Try again in N seconds."
      const lockMatch = msg.match(/(\d+)\s*seconds?/)
      if (lockMatch) {
        const secs = parseInt(lockMatch[1], 10)
        setLocked(true)
        setLockSeconds(secs)
        setDigits(Array(PIN_LENGTH).fill(''))
        setErrorMsg('')
        countdownRef.current = setInterval(() => {
          setLockSeconds(prev => {
            if (prev <= 1) {
              clearInterval(countdownRef.current!)
              countdownRef.current = null
              setLocked(false)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        // 401 wrong PIN — shake
        setShake(true)
        setErrorMsg('Incorrect PIN')
        setDigits(Array(PIN_LENGTH).fill(''))
        setTimeout(() => setShake(false), 600)
      }
    } finally {
      setSubmitting(false)
    }
  }, [submitting, locked])

  // ── Digit pad handler ────────────────────────────────────────────
  const handleDigit = useCallback((digit: string) => {
    if (locked || submitting) return
    setDigits(prev => {
      const next = [...prev]
      const idx  = next.findIndex(d => d === '')
      if (idx === -1) return prev          // already full
      next[idx] = digit
      if (idx === PIN_LENGTH - 1) {
        // Filled — submit after this render
        setTimeout(() => submitPin(next.join('')), 0)
      }
      return next
    })
    setErrorMsg('')
  }, [locked, submitting, submitPin])

  const handleBackspace = useCallback(() => {
    if (locked || submitting) return
    setDigits(prev => {
      const next = [...prev]
      // Find last filled position
      let idx = -1
      for (let i = PIN_LENGTH - 1; i >= 0; i--) {
        if (next[i] !== '') { idx = i; break }
      }
      if (idx === -1) return prev
      next[idx] = ''
      return next
    })
  }, [locked, submitting])

  const handleClose = useCallback(() => {
    setOpen(false)
    pendingRef.current = null
    setDigits(Array(PIN_LENGTH).fill(''))
    setErrorMsg('')
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setLocked(false)
    setLockSeconds(0)
  }, [])

  // ── GatekeeperModal component ────────────────────────────────────
  function GatekeeperModal() {
    if (!open) return null

    const padDisabled = locked || submitting

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 pt-6 pb-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-bold text-[var(--color-text)]">Confirm it's you</h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-[22px] leading-none cursor-pointer"
              aria-label="Cancel"
            >
              ×
            </button>
          </div>

          {/* Dot indicators */}
          <div
            className={`flex justify-center gap-4 mb-3 transition-transform ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
          >
            {digits.map((d, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  d
                    ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]'
                    : 'bg-transparent border-[var(--color-border)]'
                }`}
              />
            ))}
          </div>

          {/* Error / lockout message */}
          <div className="h-5 flex items-center justify-center mb-4">
            {locked ? (
              <p className="text-[12px] font-semibold text-amber-600">
                Locked for {lockSeconds}s…
              </p>
            ) : errorMsg ? (
              <p className="text-[12px] font-semibold text-red-500">{errorMsg}</p>
            ) : null}
          </div>

          {/* Digit pad */}
          <div
            className={`grid grid-cols-3 gap-2 transition-opacity ${padDisabled ? 'opacity-40 pointer-events-none' : ''}`}
          >
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[22px] font-bold text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer"
              >
                {d}
              </button>
            ))}
            {/* Bottom row: empty, 0, backspace */}
            <div />
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[22px] font-bold text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[18px] text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer"
              aria-label="Backspace"
            >
              ⌫
            </button>
          </div>

          {/* Forgot PIN link */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                handleClose()
                navigate('/parent?settings=security&view=pin')
              }}
              className="text-[12px] text-[var(--color-text-muted)] underline underline-offset-2 cursor-pointer hover:text-[var(--color-text)]"
            >
              Forgot PIN? Manage in Settings
            </button>
          </div>

        </div>
      </div>
    )
  }

  return { challenge, GatekeeperModal }
}
```

- [ ] **Step 2: Add the shake keyframe to Tailwind config**

The `animate-[shake_...]` class requires a custom keyframe. Check if it already exists:

```bash
grep -r "shake" "e:/Web-Video Design/Claude/Apps/Pocket Money/app/tailwind.config.js" 2>/dev/null || grep -r "shake" "e:/Web-Video Design/Claude/Apps/Pocket Money/app/tailwind.config.ts" 2>/dev/null || echo "NOT FOUND"
```

If not found, open the Tailwind config file (whichever of `.js` or `.ts` exists at `app/tailwind.config.*`) and add to the `theme.extend` block:

```js
keyframes: {
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '20%':      { transform: 'translateX(-6px)' },
    '40%':      { transform: 'translateX(6px)' },
    '60%':      { transform: 'translateX(-4px)' },
    '80%':      { transform: 'translateX(4px)' },
  },
},
animation: {
  shake: 'shake 0.5s ease-in-out',
},
```

If a `keyframes` block already exists, merge `shake` into it. If `animate-[shake_0.5s_ease-in-out]` is already defined elsewhere, skip this step.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money/app" && npx tsc --noEmit 2>&1 | grep -E "useGatekeeper"
```

Expected: no lines.

- [ ] **Step 4: Manual smoke-test**

There are no unit tests for this hook (it depends on browser APIs and React state). Smoke-test by temporarily importing it into a parent screen and calling `challenge(() => console.log('passed'))` from a button. Verify:

- Without biometrics registered: modal opens immediately
- Type 4 digits: `verifyPin` is called (check Network tab)
- Correct PIN: modal closes, `console.log('passed')` fires
- Wrong PIN: dots shake, "Incorrect PIN" shows, digits clear
- After 3 wrong PINs: pad dims, countdown ticks down

Remove the test import before committing.

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useGatekeeper.ts app/tailwind.config.* 2>/dev/null; git add app/src/hooks/useGatekeeper.ts
git commit -m "feat(hooks): useGatekeeper — biometric/PIN challenge with grace window and 429 dim-pad"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered |
|---|---|
| Grace window: 5 min, sessionStorage `mc_gk_verified_at` | ✅ `isWithinGrace()` / `markVerified()` |
| Try biometrics first if `hasBiometricCredential()` | ✅ `challenge()` tries bio before showing modal |
| Bio success → write grace, call `onSuccess()` | ✅ |
| Bio denied → show PIN modal | ✅ falls through |
| PIN 401 → shake dots, show "Incorrect PIN", clear digits | ✅ |
| PIN 429 → dim pad (opacity-40, pointer-events-none), live countdown | ✅ `locked` state + `setInterval` |
| Countdown re-enables pad when it reaches 0 | ✅ `setLocked(false)` in interval |
| `GatekeeperModal` renders 4 dot indicators | ✅ |
| Digit pad same style as LockScreen | ✅ matching button classes |
| "Forgot PIN?" link → navigate to PIN Management | ✅ `navigate('/parent?settings=security&view=pin')` |
| `GatekeeperModal` returns `null` when not challenged | ✅ `if (!open) return null` |
| Closing modal cancels pending action | ✅ `handleClose` nulls `pendingRef` |

**Placeholder scan:** No TBDs, no "handle appropriately", all code present. ✅

**Type consistency:**
- `verifyPin` imported from `../lib/api` — matches Task 1 export name ✅
- `hasBiometricCredential` / `challengeBiometrics` from `../lib/biometrics` — match existing exports ✅
- `GatekeeperModal` is a function component returned from the hook ✅
- `challenge: (onSuccess: () => void) => void` — consistent throughout ✅
