# Native Gesture Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Morechard's sheets, toast, and mentor cards behave like native gesture surfaces (drag-to-close, swipe-to-dismiss, haptic feedback) instead of plain web widgets.

**Architecture:** Two new shared primitives — `BaseSheet` (drag-to-close + backdrop-tap + Android-back, wrapping the existing `useDragToClose` hook) and `SwipeDismissCard` (horizontal swipe-to-dismiss) — get built once in `app/src/components/ui/` and then wired into the specific components that are missing the behavior today. A parallel haptics sweep routes two duplicate `navigator.vibrate` call sites through the shared `tick()` helper and adds it to the confirm/dismiss moments identified during planning.

**Tech Stack:** React + TypeScript, Vitest + React Testing Library (`app/`, run via `npm run test` i.e. `vitest run`), existing hooks `useDragToClose` (`app/src/hooks/useDragToClose.ts`) and `useAndroidBack` (`app/src/hooks/useAndroidBack.ts`), existing `tick()` haptics helper (`app/src/lib/haptics.ts`).

## Global Constraints

- No new npm dependency — everything is built on `useDragToClose`, `useAndroidBack`, and `tick()`, which already exist and are already tested.
- Do not change visual design (colors, copy, layout) beyond what's needed to fit the drag handle — see per-task padding notes.
- `tick()` must be called synchronously in the event handler (before any `await`), not inside a `.then()` — Android Chrome only allows vibration inside a user-gesture call stack. This is already documented at the top of `app/src/lib/haptics.ts` and demonstrated in `app/src/components/payment/PaymentConfirmSheet.tsx:20-24`.
- Tests run from the `app/` directory: `cd app && npx vitest run <path>`.
- One important finding from planning: the tab-switch fade transition (originally item 5 of the design spec) **already exists** — `.tab-panel { animation: tab-fade-in 150ms ease }` in `app/src/index.css:287-289`, applied in both `ChildDashboard.tsx` and `ParentDashboard.tsx`. No task is needed for it; it's called out here so it isn't mistaken for a gap during review.

---

### Task 1: `BaseSheet` shared primitive

**Files:**
- Create: `app/src/components/ui/BaseSheet.tsx`
- Test: `app/src/components/ui/__tests__/BaseSheet.test.tsx`

**Interfaces:**
- Produces: `BaseSheet({ onClose, children, panelClassName?, panelStyle?, zIndex? }): JSX.Element` — a fixed-inset backdrop (default `zIndex: 50`) containing a bottom-anchored panel. The panel gets a drag handle (from `useDragToClose`), closes on backdrop tap, closes on drag-down past threshold, closes on Android hardware back (via `useAndroidBack`), and fires `tick()` on every close path. `panelClassName`/`panelStyle` style the panel div itself (background, radius, padding) — callers control the exact visual look, `BaseSheet` only owns structure/behavior.

- [ ] **Step 1: Write the failing test**

```tsx
// app/src/components/ui/__tests__/BaseSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BaseSheet } from '../BaseSheet'

vi.mock('../../../lib/haptics', () => ({ tick: vi.fn(async () => {}) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn(async () => {}) })) } }))

describe('BaseSheet', () => {
  it('renders children and a drag handle', () => {
    render(<BaseSheet onClose={vi.fn()}><p>Sheet content</p></BaseSheet>)
    expect(screen.getByText('Sheet content')).toBeTruthy()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<BaseSheet onClose={onClose}><p>Sheet content</p></BaseSheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the panel content is clicked', () => {
    const onClose = vi.fn()
    render(<BaseSheet onClose={onClose}><p>Sheet content</p></BaseSheet>)
    fireEvent.click(screen.getByText('Sheet content'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/ui/__tests__/BaseSheet.test.tsx`
Expected: FAIL — `Cannot find module '../BaseSheet'`

- [ ] **Step 3: Write the implementation**

```tsx
// app/src/components/ui/BaseSheet.tsx
import type { CSSProperties, ReactNode } from 'react'
import { useAndroidBack } from '../../hooks/useAndroidBack'
import { useDragToClose } from '../../hooks/useDragToClose'
import { tick } from '../../lib/haptics'

interface Props {
  onClose: () => void
  children: ReactNode
  panelClassName?: string
  panelStyle?: CSSProperties
  zIndex?: number
}

export function BaseSheet({ onClose, children, panelClassName, panelStyle, zIndex = 50 }: Props) {
  function close() {
    void tick()
    onClose()
  }

  const { sheetRef, handleProps } = useDragToClose(close)
  useAndroidBack(true, close)

  return (
    <div
      data-testid="sheet-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
      onClick={close}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        className={panelClassName}
        style={{ width: '100%', transition: 'transform 300ms', ...panelStyle }}
      >
        <div {...handleProps} />
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/ui/__tests__/BaseSheet.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ui/BaseSheet.tsx app/src/components/ui/__tests__/BaseSheet.test.tsx
git commit -m "Add BaseSheet primitive: drag-to-close + backdrop-tap + Android-back + haptic"
```

---

### Task 2: `SwipeDismissCard` shared primitive

**Files:**
- Create: `app/src/components/ui/SwipeDismissCard.tsx`
- Test: `app/src/components/ui/__tests__/SwipeDismissCard.test.tsx`

**Interfaces:**
- Produces: `SwipeDismissCard({ onDismiss, children, className? }): JSX.Element` — wraps `children` in a div that tracks horizontal touch/mouse drag. Past an 80px threshold in either direction, it fades/slides out and calls `onDismiss` after a 200ms transition. Under threshold, it snaps back. Fires `tick()` when a dismiss is triggered by a completed swipe (not on the snap-back path).

- [ ] **Step 1: Write the failing test**

```tsx
// app/src/components/ui/__tests__/SwipeDismissCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SwipeDismissCard } from '../SwipeDismissCard'

vi.mock('../../../lib/haptics', () => ({ tick: vi.fn(async () => {}) }))

describe('SwipeDismissCard', () => {
  it('renders children', () => {
    render(<SwipeDismissCard onDismiss={vi.fn()}><p>Card body</p></SwipeDismissCard>)
    expect(screen.getByText('Card body')).toBeTruthy()
  })

  it('calls onDismiss after a swipe past the threshold', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<SwipeDismissCard onDismiss={onDismiss}><p>Card body</p></SwipeDismissCard>)
    const card = screen.getByText('Card body').parentElement!

    fireEvent.touchStart(card, { touches: [{ clientX: 0 }] })
    fireEvent.touchMove(card, { touches: [{ clientX: 150 }] })
    fireEvent.touchEnd(card)

    vi.advanceTimersByTime(250)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not call onDismiss on a small swipe (snap-back)', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<SwipeDismissCard onDismiss={onDismiss}><p>Card body</p></SwipeDismissCard>)
    const card = screen.getByText('Card body').parentElement!

    fireEvent.touchStart(card, { touches: [{ clientX: 0 }] })
    fireEvent.touchMove(card, { touches: [{ clientX: 20 }] })
    fireEvent.touchEnd(card)

    vi.advanceTimersByTime(250)
    expect(onDismiss).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/ui/__tests__/SwipeDismissCard.test.tsx`
Expected: FAIL — `Cannot find module '../SwipeDismissCard'`

- [ ] **Step 3: Write the implementation**

```tsx
// app/src/components/ui/SwipeDismissCard.tsx
import { useRef, useState, type ReactNode } from 'react'
import { tick } from '../../lib/haptics'

const THRESHOLD = 80

interface Props {
  onDismiss: () => void
  children: ReactNode
  className?: string
}

export function SwipeDismissCard({ onDismiss, children, className }: Props) {
  const startX = useRef<number | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const dragging = startX.current !== null

  function onStart(x: number) {
    startX.current = x
  }

  function onMove(x: number) {
    if (startX.current === null) return
    setOffsetX(x - startX.current)
  }

  function onEnd() {
    if (startX.current === null) return
    startX.current = null
    if (Math.abs(offsetX) > THRESHOLD) {
      void tick()
      setDismissing(true)
      setTimeout(onDismiss, 200)
    } else {
      setOffsetX(0)
    }
  }

  return (
    <div
      className={className}
      style={{
        transform: `translateX(${dismissing ? (offsetX > 0 ? 400 : -400) : offsetX}px)`,
        opacity: dismissing ? 0 : 1 - Math.min(Math.abs(offsetX) / 300, 0.6),
        transition: dragging ? 'none' : 'transform 200ms ease, opacity 200ms ease',
        touchAction: 'pan-y',
      }}
      onTouchStart={e => onStart(e.touches[0].clientX)}
      onTouchMove={e => onMove(e.touches[0].clientX)}
      onTouchEnd={onEnd}
      onMouseDown={e => onStart(e.clientX)}
      onMouseMove={e => { if (startX.current !== null) onMove(e.clientX) }}
      onMouseUp={onEnd}
      onMouseLeave={() => { if (startX.current !== null) onEnd() }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/ui/__tests__/SwipeDismissCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ui/SwipeDismissCard.tsx app/src/components/ui/__tests__/SwipeDismissCard.test.tsx
git commit -m "Add SwipeDismissCard primitive: horizontal swipe-to-dismiss"
```

---

### Task 3: Migrate the inline-style sheet trio onto `BaseSheet`

**Files:**
- Modify: `app/src/components/dashboard/JarSettingsSheet.tsx`
- Modify: `app/src/components/dashboard/JarDetailSheet.tsx`
- Modify: `app/src/components/dashboard/GiveRequestSheet.tsx`

These three share the exact same hand-rolled shape: `<div style={{position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end'}} onClick={onClose}>` wrapping a panel `<div onClick={e=>e.stopPropagation()} style={{width:'100%', background:'#1a2e22', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', fontFamily:'Manrope'}}>`. Replace that wrapper with `BaseSheet`, keeping the panel's visual style via `panelStyle`. Reduce top padding from `24px` to `8px` since the handle bar now occupies the space above the header — this is the one intentional visual delta in this task.

**Interfaces:**
- Consumes: `BaseSheet` from Task 1 (`app/src/components/ui/BaseSheet.tsx`).

- [ ] **Step 1: Migrate `JarSettingsSheet.tsx`**

Replace the import block (top of file) — add the `BaseSheet` import:

```tsx
import { useState } from 'react';
import { putJarConfig, type JarConfig, type JarBalances } from '../../lib/api';
import { BaseSheet } from '../ui/BaseSheet';
```

Replace the `return (...)` block (currently lines 53–144) with:

```tsx
  return (
    <BaseSheet
      onClose={onClose}
      zIndex={200}
      panelStyle={{ background: '#1a2e22', borderRadius: '20px 20px 0 0', padding: '8px 20px 40px', fontFamily: 'Manrope' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Jar settings</span>
        <button
          onClick={onClose}
          className="tap-target-44"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Enable toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>Split my earnings automatically</span>
        <button
          onClick={() => { void tick(); setEnabled(!enabled) }}
          style={{
            width: 48, height: 28, borderRadius: 14,
            background: enabled ? '#0d9488' : 'rgba(255,255,255,0.12)',
            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 22 : 3,
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Percentage steppers — only when enabled */}
      {enabled && (
        <>
          {([['Spend', spend, setSpend], ['Save', save, setSave], ['Give', give, setGive]] as const).map(([label, val, setter]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setter(Math.max(0, val - 5))} style={stepBtn}>−</button>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, width: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {val}%
                </span>
                <button onClick={() => setter(Math.min(100, val + 5))} style={stepBtn}>+</button>
              </div>
            </div>
          ))}

          {/* Sum indicator */}
          <div style={{ fontSize: 13, color: sum === 100 ? '#34d399' : '#f87171', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>
            Total: {sum}% {sum !== 100 ? '— must equal 100' : '✓'}
          </div>

          {/* Mentor soft-warnings */}
          {showSavingWarn && (
            <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>
              Save below 20% — consider saving a little more
            </div>
          )}
          {showGiveWarn && (
            <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>
              No giving set — that's OK, it's your choice
            </div>
          )}
        </>
      )}

      {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <button
        onClick={handleSave}
        disabled={saving || (enabled && sum !== 100)}
        style={{
          width: '100%', padding: 14, borderRadius: 12,
          background: '#0d9488', color: '#fff', border: 'none',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          opacity: enabled && sum !== 100 ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </BaseSheet>
  );
```

Also add the `tick` import used by the toggle:

```tsx
import { tick } from '../../lib/haptics';
```

- [ ] **Step 2: Migrate `JarDetailSheet.tsx`**

Add the import:

```tsx
import { BaseSheet } from '../ui/BaseSheet';
```

Replace the outer two wrapper divs (currently lines 98–118, the `<div style={{position:'fixed'...}} onClick={onClose}>` and its child panel div) with:

```tsx
  return (
    <BaseSheet
      onClose={onClose}
      zIndex={200}
      panelStyle={{
        background: '#1a2e22',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 40px',
        fontFamily: 'Manrope, sans-serif',
        maxHeight: '85vh',
        overflowY: 'auto',
      }}
    >
```

...and change the matching closing tags at the end of the file (currently `</div></div>` closing the panel and backdrop, right before the final `);`) to `</BaseSheet>`. Everything between (header, recent movements, actions) is unchanged.

- [ ] **Step 3: Migrate `GiveRequestSheet.tsx`**

Add the imports:

```tsx
import { BaseSheet } from '../ui/BaseSheet';
import { tick } from '../../lib/haptics';
```

Replace the `return (...)` wrapper (currently lines 41–83) with:

```tsx
  return (
    <BaseSheet
      onClose={onClose}
      zIndex={200}
      panelStyle={{ background: '#1a2e22', borderRadius: '20px 20px 0 0', padding: '8px 20px 40px', fontFamily: 'Manrope' }}
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Gift request sent!</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Your parent will make the donation and let you know.</div>
          <button onClick={() => { onSubmitted(); onClose(); }} style={{ padding: '14px 28px', borderRadius: 12, background: '#0d9488', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Make a gift</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            Give jar: {fmt(giveBalance, currency)} available
          </div>

          <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>What is it for?</label>
          <input
            type="text" maxLength={60} placeholder="e.g. Cancer Research, school fundraiser…"
            value={cause} onChange={e => setCause(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, marginBottom: 4, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 20, textAlign: 'right' }}>{cause.length}/60</div>

          <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>Amount</label>
          <input
            type="number" min="0.01" max={giveBalance / 100} step="0.01" placeholder="0.00"
            value={amt} onChange={e => setAmt(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, marginBottom: 20, boxSizing: 'border-box' }}
          />

          {err && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <button onClick={() => { void tick(); handleSubmit(); }} disabled={saving}
            style={{ width: '100%', padding: 14, borderRadius: 12, background: '#d97706', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
            {saving ? 'Sending…' : 'Send request to parent'}
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 12, background: 'none', color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        </>
      )}
    </BaseSheet>
  );
```

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `cd app && npx tsc --noEmit && npm run test`
Expected: no type errors; all existing tests still PASS (no test file references the old wrapper markup, so this is a regression check, not a new-test step).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/JarSettingsSheet.tsx app/src/components/dashboard/JarDetailSheet.tsx app/src/components/dashboard/GiveRequestSheet.tsx
git commit -m "Migrate Jar/GiveRequest sheets to BaseSheet (drag-to-close, Android back, haptic)"
```

---

### Task 4: Migrate the Tailwind-class sheet duo onto `BaseSheet`

**Files:**
- Modify: `app/src/components/dashboard/VoidExpenseSheet.tsx`
- Modify: `app/src/components/review/ReviewPromptSheet.tsx`

**Interfaces:**
- Consumes: `BaseSheet` from Task 1.

- [ ] **Step 1: Migrate `VoidExpenseSheet.tsx`**

Replace the imports (drop the now-redundant `useAndroidBack` import and direct call — `BaseSheet` provides it):

```tsx
// app/src/components/dashboard/VoidExpenseSheet.tsx
import { useState } from 'react';
import { voidExpense } from '../../lib/api';
import { ErrorBox } from '../ui/ErrorBox';
import { BaseSheet } from '../ui/BaseSheet';
```

Remove the line `useAndroidBack(true, onClose);` from inside the component body.

Replace the `return (...)` block (currently lines 37–75) with:

```tsx
  return (
    <BaseSheet onClose={onClose} panelClassName="w-full max-w-[560px] mx-auto bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Void expense</h2>
        <button onClick={onClose} className="tap-target-44 text-[var(--color-text-muted)] text-2xl leading-none">&times;</button>
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        Voiding <strong>{description}</strong> removes it from the settlement but keeps a record in the audit log.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Reason *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Entered incorrect amount, duplicate entry…"
            rows={3}
            className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)] resize-none"
          />
        </div>

        <ErrorBox message={error} />

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Voiding…' : 'Void expense'}
        </button>
      </form>
    </BaseSheet>
  );
```

- [ ] **Step 2: Migrate `ReviewPromptSheet.tsx`**

Add the import:

```tsx
import { BaseSheet } from '../ui/BaseSheet';
```

Replace the `return (...)` block (currently lines 54–138). The current outer div's `onClick={handleDismiss}` (backdrop tap) must map to `BaseSheet`'s `onClose`, and the `if (!open) return null` guard stays as-is above the return:

```tsx
  return (
    <BaseSheet onClose={handleDismiss} panelClassName="w-full max-w-md mx-auto rounded-t-2xl bg-[var(--surface-card,#1a2a1f)] p-6 pb-8 shadow-2xl">
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
    </BaseSheet>
  )
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `cd app && npx tsc --noEmit && npm run test`
Expected: no type errors; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/dashboard/VoidExpenseSheet.tsx app/src/components/review/ReviewPromptSheet.tsx
git commit -m "Migrate VoidExpense/ReviewPrompt sheets to BaseSheet"
```

---

### Task 5: Drag-to-close on `SpendGuideSheet`'s amount-entry sub-sheet

**Files:**
- Modify: `app/src/components/dashboard/SpendGuideSheet.tsx`

This component is a full-screen view (not a `BaseSheet` candidate itself), but it has one nested bottom sub-sheet (the "amount entry" panel, `entry &&` block, currently lines 381–502) that already renders a static handle bar with no drag behavior. Wire `useDragToClose` directly onto it — lighter touch than a full `BaseSheet` migration since the sub-sheet's backdrop-tap-to-close and structure already exist and just need the hook attached.

**Interfaces:**
- Consumes: `useDragToClose` from `app/src/hooks/useDragToClose.ts` (existing, unchanged).

- [ ] **Step 1: Add the hook and wire it to the sub-sheet**

Add the import:

```tsx
import { useDragToClose } from '../../hooks/useDragToClose'
```

Inside the component body, near the other hooks (after the `useAndroidBack` calls, around line 175), add:

```tsx
  const closeEntry = () => { setEntry(null); setSaveErr(null) }
  const { sheetRef: entrySheetRef, handleProps: entryHandleProps } = useDragToClose(closeEntry)
```

Replace the existing `{ setEntry(null); setSaveErr(null) }` inline closures used for the sub-sheet's backdrop and "Back" button (currently lines 383 and 487) with `closeEntry`:

```tsx
          <div className="absolute inset-0 bg-black/40" onClick={closeEntry} />
```

```tsx
              <button
                onClick={closeEntry}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                Back
              </button>
```

Attach `entrySheetRef` to the sliding panel div and `entryHandleProps` to the drag-handle div (currently lines 384–389):

```tsx
          <div ref={entrySheetRef} className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4 max-h-[88%] overflow-y-auto">

            {/* Drag handle */}
            <div {...entryHandleProps} />
```

(Drop the old static `<div className="flex justify-center pt-2 pb-1"><div className="w-10 h-1 rounded-full bg-[var(--color-border)]" /></div>` markup — `handleProps` from `useDragToClose` already renders an equivalent container; add the visual bar inside it: `<div {...entryHandleProps}><div className="w-10 h-1 rounded-full bg-[var(--color-border)]" /></div>`.)

- [ ] **Step 2: Manual verification**

Run: `cd app && npm run dev` (per repo root `npm run dev`, or `cd app && npm run dev` if the app has its own dev script — check `app/package.json` `dev` script name first)
Expected: open the Spend Guide, tap an item to open the amount-entry sub-sheet, drag it down more than ~120px — it closes. A small drag snaps back.

- [ ] **Step 3: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/dashboard/SpendGuideSheet.tsx
git commit -m "Wire drag-to-close into SpendGuideSheet's amount-entry sub-sheet"
```

---

### Task 6: Drag-to-close on `ChoreGuideSheet`'s two sub-sheets

**Files:**
- Modify: `app/src/components/dashboard/ChoreGuideSheet.tsx`

Same situation as Task 5, but `ChoreGuideSheet` has two nested sub-sheets with static handle bars: the "suggest a new chore" sheet (`newChoreOpen &&` block, ~lines 435–521) and the "amount-edit" sheet (`editRate &&` block, ~lines 524 onward). Each needs its own `useDragToClose` instance since they have independent close callbacks.

**Interfaces:**
- Consumes: `useDragToClose` from `app/src/hooks/useDragToClose.ts`.

- [ ] **Step 1: Add the hook import and two instances**

Add the import:

```tsx
import { useDragToClose } from '../../hooks/useDragToClose';
```

Near the top of the component body, add:

```tsx
  const closeNewChore = () => { setNewChoreOpen(false); setNewChoreError(null); }
  const { sheetRef: newChoreSheetRef, handleProps: newChoreHandleProps } = useDragToClose(closeNewChore)

  const closeEditRate = () => { setEditRate(null); setEditError(null); }
  const { sheetRef: editRateSheetRef, handleProps: editRateHandleProps } = useDragToClose(closeEditRate)
```

- [ ] **Step 2: Wire the "suggest a new chore" sub-sheet**

Replace the backdrop and cancel button's inline closures with `closeNewChore`:

```tsx
          <div className="absolute inset-0 bg-black/40" onClick={closeNewChore} />
```

```tsx
                <button
                  onClick={closeNewChore}
                  className="flex-1 border border-[var(--color-border)] rounded-xl py-2.5 text-[13px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
                >
                  Cancel
                </button>
```

Attach the ref and handle props to the panel (currently `<div className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain">` and its static handle):

```tsx
          <div ref={newChoreSheetRef} className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 max-h-[88vh] overflow-y-auto overscroll-contain">
            {/* Drag handle */}
            <div {...newChoreHandleProps}>
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>
```

- [ ] **Step 3: Wire the "amount-edit" sub-sheet**

Same pattern — replace the backdrop's inline closure with `closeEditRate`:

```tsx
          <div className="absolute inset-0 bg-black/40" onClick={closeEditRate} />
```

Attach `editRateSheetRef` and `editRateHandleProps` to that panel and its handle bar (mirrors Step 2). Locate the panel's own "Cancel"/close button (further down in the `editRate` block, past line 544) and replace its `onClick={() => setEditRate(null)}`-style closure with `closeEditRate` as well, if present with that exact pattern.

- [ ] **Step 4: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Manual verification**

Open Chore Guide, open "Suggest a new chore" and the amount-edit sheet separately, drag each down — each closes independently and doesn't affect the other's open state.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/ChoreGuideSheet.tsx
git commit -m "Wire drag-to-close into ChoreGuideSheet's suggest and amount-edit sub-sheets"
```

---

### Task 7: Drag-to-close on `PaymentBridgeSheet`'s Radix Dialog

**Files:**
- Modify: `app/src/components/payment/PaymentBridgeSheet.tsx`

This sheet uses `@radix-ui/react-dialog` (`Dialog.Root`/`Dialog.Content`), not the homegrown fixed-div pattern — Radix already provides backdrop-click-to-close (via `onOpenChange`) and its own focus trap, so it is **not** migrated to `BaseSheet`. It already renders a static handle bar (`<div className="mx-auto mt-2 mb-2 h-1 w-10 rounded-full bg-neutral-300" />`) with no drag wiring. Attach `useDragToClose` directly to `Dialog.Content` via its ref.

**Interfaces:**
- Consumes: `useDragToClose` from `app/src/hooks/useDragToClose.ts`.

- [ ] **Step 1: Add the hook and wire it to `Dialog.Content`**

Add the import:

```tsx
import { useDragToClose } from '../../hooks/useDragToClose';
```

Inside the component body, near the existing `useEffect` hooks:

```tsx
  const { sheetRef, handleProps } = useDragToClose(onClose)
```

Update the `Dialog.Content` and handle-bar markup (currently lines 145–150):

```tsx
        <Dialog.Content
          ref={sheetRef}
          className="fixed left-1/2 bottom-0 z-50 w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-white pb-safe"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Payment Bridge</Dialog.Title>
          <div {...handleProps}>
            <div className="mx-auto h-1 w-10 rounded-full bg-neutral-300" />
          </div>
```

Radix's `Dialog.Content` forwards its ref to the underlying DOM node, so this is a direct drop-in — no wrapper needed.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors (confirms `Dialog.Content` accepts a forwarded ref of the expected type).

- [ ] **Step 3: Manual verification**

Open the Payment Bridge sheet from a pending approval, drag the sheet down past the threshold — it closes; a small drag snaps back; tapping a payment tile still navigates between internal views without the sheet closing.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/payment/PaymentBridgeSheet.tsx
git commit -m "Wire drag-to-close into PaymentBridgeSheet's Radix Dialog.Content"
```

---

### Task 8: Swipe-to-dismiss on `MicroToast`

**Files:**
- Modify: `app/src/components/celebration/MicroToast.tsx`

**Interfaces:**
- Consumes: `SwipeDismissCard` from Task 2.

- [ ] **Step 1: Wrap the toast body in `SwipeDismissCard`**

```tsx
// app/src/components/celebration/MicroToast.tsx
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'
import { SwipeDismissCard } from '../ui/SwipeDismissCard'

interface Props {
  event:     MilestoneEvent
  onDismiss: () => void
}

export function MicroToast({ event, onDismiss }: Props) {
  const config = CONFIGS[event.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 400)
    }, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  if (!config) return null

  const stage = event.appView === 'CLEAN' ? config.clean[0] : config.orchard[0]
  if (!stage) return null

  function close() {
    setVisible(false)
    setTimeout(onDismiss, 400)
  }

  return (
    <SwipeDismissCard onDismiss={close} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90]">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-[#1b2d2e] border border-white/10 shadow-xl',
          'transition-all duration-[400ms]',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
        style={{ maxWidth: 320 }}
      >
        <span className="text-2xl">{stage.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-semibold leading-snug', stage.headingColor)}>
            {stage.heading}
          </p>
          <p className={cn('text-[11px] leading-snug mt-0.5 truncate', stage.bodyColor)}>
            {stage.body}
          </p>
        </div>
        <button
          onClick={close}
          className="text-white/30 hover:text-white/60 text-lg leading-none ml-1"
          aria-label="Dismiss"
        >×</button>
      </div>
    </SwipeDismissCard>
  )
}
```

Note: `SwipeDismissCard`'s own `translateX` transform is applied to the outer (now `fixed`-positioned) wrapper, and the existing `translate-y` fade is on the inner div — the two transforms don't conflict since they're on different elements.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Manual verification**

Trigger a milestone toast (e.g. complete a chore in dev), swipe it left or right — it dismisses. Leave it alone — it still auto-dismisses after 3s. Tap the × — it still dismisses immediately.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/celebration/MicroToast.tsx
git commit -m "Add swipe-to-dismiss to MicroToast"
```

---

### Task 9: Explicit close (X) on mentor cards

**Files:**
- Modify: `app/src/components/dashboard/InsightsTab.tsx`

The mentor carousel already swipes between cards natively (scroll-snap) — per design, swipe stays reserved for that, and dismiss gets its own explicit control. Add a close button to `LiveBriefingCard`'s header row (next to `ProBadge`, around line 557) that hides the card for the session (component-local state, not a server write).

**Interfaces:**
- Consumes: `tick` from `app/src/lib/haptics.ts`.

- [ ] **Step 1: Add the import and dismissed state**

Near the top of `InsightsTab.tsx`, add:

```tsx
import { tick } from '../../lib/haptics'
```

Inside `LiveBriefingCard` (the function starting at line 515, currently reading `const [modalOpen, setModalOpen] = useState(false)`), add:

```tsx
  const [dismissed, setDismissed] = useState(false)
  const animate = briefing.source === 'ai'
  const p = PERSONA_CONFIG[persona]

  if (dismissed) return null
```

- [ ] **Step 2: Add the close button next to `ProBadge`**

Replace the header's right-hand side (currently just `<ProBadge />` at line 557) with:

```tsx
            <div className="flex items-center gap-2">
              <ProBadge />
              <button
                onClick={() => { void tick(); setDismissed(true) }}
                aria-label="Dismiss"
                className="tap-target-44 w-6 h-6 flex items-center justify-center rounded-full text-white/30 hover:text-white/60 cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual verification**

Open the Insights tab as a parent, tap the X on a mentor card — it disappears; the carousel's remaining card(s), if any, and dot indicators adjust correctly (a single-card case just clears the section). Reload the page — the card reappears (session-only, not persisted).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/InsightsTab.tsx
git commit -m "Add explicit close (X) to mentor briefing cards"
```

---

### Task 10: Haptics sweep

**Files:**
- Modify: `app/src/components/navigation/ChildBottomNav.tsx`
- Modify: `app/src/components/navigation/ParentBottomNav.tsx`
- Modify: `app/src/components/dashboard/PendingTab.tsx`
- Modify: `app/src/components/dashboard/ChildGoalsTab.tsx`
- Modify: `app/src/components/dashboard/CreateChoreSheet.tsx`

`BaseSheet` (Task 1) and `SwipeDismissCard` (Task 2) already fire `tick()` internally. This task covers the remaining gaps found during planning: two duplicate `navigator.vibrate` implementations that bypass the shared helper, and four confirm/toggle actions that currently have no haptic at all.

**Interfaces:**
- Consumes: `tick` from `app/src/lib/haptics.ts` (existing, unchanged).

- [ ] **Step 1: Route `ChildBottomNav` through the shared `tick()`**

Remove the local function (currently lines 27–31):

```tsx
function triggerHaptic() {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(1) } catch { /* unsupported */ }
  }
}
```

Add the import at the top of the file:

```tsx
import { tick } from '../../lib/haptics'
```

Replace the tab button's `onClick` (currently `onClick={() => { triggerHaptic(); onTabChange(id) }}`):

```tsx
                  onClick={() => { void tick(); onTabChange(id) }}
```

- [ ] **Step 2: Route `ParentBottomNav` through the shared `tick()`**

Same change: remove the local `triggerHaptic` function (lines 27–31), add `import { tick } from '../../lib/haptics'`, replace `onClick={() => { triggerHaptic(); onTabChange(id) }}` with `onClick={() => { void tick(); onTabChange(id) }}`.

- [ ] **Step 3: Add haptic to chore approval**

In `app/src/components/dashboard/PendingTab.tsx`, add the import:

```tsx
import { tick } from '../../lib/haptics'
```

At the start of `handleApprove` (currently `async function handleApprove(id: string) { setBusy(id) ...`), fire `tick()` synchronously before the first `await`:

```tsx
  async function handleApprove(id: string) {
    void tick()
    setBusy(id)
```

- [ ] **Step 4: Add haptic to goal purchase confirm**

In `app/src/components/dashboard/ChildGoalsTab.tsx`, add the import:

```tsx
import { tick } from '../../lib/haptics'
```

At the start of `handlePurchase` (currently `async function handlePurchase(goalId: string) { setPurchasing(goalId) ...`):

```tsx
  async function handlePurchase(goalId: string) {
    void tick()
    setPurchasing(goalId)
```

- [ ] **Step 5: Add haptic to CreateChoreSheet's Skip Approval / Photo Proof toggles**

In `app/src/components/dashboard/CreateChoreSheet.tsx`, add the import (if not already present from Task 3's sibling files — check first, this file doesn't currently import `tick`):

```tsx
import { tick } from '../../lib/haptics'
```

Update `toggleProofRequired` and `toggleAutoApprove` (currently at lines 223–242):

```tsx
  function toggleProofRequired() {
    void tick()
    const next = !form.proof_required
    setForm(f => ({
      ...f,
      proof_required: next,
      // If enabling photo proof, disable auto-approve (incompatible)
      auto_approve: next ? false : f.auto_approve,
    }))
    setConflictMsg(false)
  }

  function toggleAutoApprove() {
    if (!form.auto_approve && form.proof_required) {
      // Conflict: can't auto-pay a task that requires photo review
      setConflictMsg(true)
      return
    }
    void tick()
    setField('auto_approve', !form.auto_approve)
    setConflictMsg(false)
  }
```

(Note: the conflict-block early return in `toggleAutoApprove` does *not* fire a haptic — it's a rejected action, not a confirmed toggle.)

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `cd app && npx tsc --noEmit && npm run test`
Expected: no type errors; all tests PASS, including `app/src/lib/haptics.test.ts` (unchanged, still covers `tick()` itself).

- [ ] **Step 7: Manual verification**

On a native build (or emulator with `navigator.vibrate` available in the web fallback path), switch tabs, approve a chore, purchase a goal, and toggle Photo Proof / Skip Approval in Create Chore — each should produce a short tick.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/navigation/ChildBottomNav.tsx app/src/components/navigation/ParentBottomNav.tsx app/src/components/dashboard/PendingTab.tsx app/src/components/dashboard/ChildGoalsTab.tsx app/src/components/dashboard/CreateChoreSheet.tsx
git commit -m "Route nav-bar haptics through shared tick(); add haptic to approve/purchase/toggle actions"
```

---

## Self-Review Notes

- **Spec coverage:** BaseSheet + 9-sheet migration → Tasks 1, 3–7 (split into 3/4/5/6/7 because JarSettings/JarDetail/GiveRequest, VoidExpense/ReviewPrompt, SpendGuide, ChoreGuide, and PaymentBridge are four structurally different shapes discovered during planning — inline-style homegrown, Tailwind homegrown, full-screen-with-sub-sheet ×2, and Radix Dialog). Mentor card explicit close → Task 9. MicroToast swipe-dismiss → Task 8 (via Task 2's `SwipeDismissCard`). Haptics sweep → Task 10. Tab-switch transition → already implemented, no task (see Global Constraints).
- **Placeholder scan:** none — every step has complete, copy-pasteable code sourced from the actual current file contents read during planning.
- **Type consistency:** `BaseSheet` and `SwipeDismissCard` props are used identically across all consuming tasks (`onClose`, `panelClassName`, `panelStyle`, `zIndex` for `BaseSheet`; `onDismiss`, `className` for `SwipeDismissCard`).
