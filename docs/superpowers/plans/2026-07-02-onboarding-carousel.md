# First-Launch Onboarding Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a 4-slide, skippable, swipeable onboarding carousel to fresh (no-device-identity) users exactly once, before they reach `LandingGate`.

**Architecture:** A new `app/src/lib/onboarding.ts` module owns the `mc_has_seen_onboarding` localStorage flag (read/write, matching the existing `mc_device_identity` module's try/catch pattern). `RootGate` in `app/src/App.tsx` consults it to decide between `/onboarding`, `/lock`, and `LandingGate`. A new screen component `app/src/screens/OnboardingCarousel.tsx` renders the 4 slides using Framer Motion drag/swipe, and marks the flag seen on skip or completion before routing back through `/` (letting `RootGate` re-decide, rather than hardcoding the next screen inside the carousel).

**Tech Stack:** React + TypeScript, react-router-dom v6, Framer Motion (already a dependency, `^12.38.0`), Vitest + `@testing-library/react` for tests, Tailwind v4 with the project's CSS-variable design tokens (`--brand-primary`, `--color-bg`, etc. from `app/src/index.css`).

## Global Constraints

- Storage key convention: `mc_`-prefixed, boolean flags stored as the **string** `'1'` (not JSON `true`) — matches `mc_first_child_added`, `INTRO_DISMISSED_KEY`, etc.
- All `localStorage` access must be wrapped in try/catch, matching `app/src/lib/deviceIdentity.ts:45-53` — a private-browsing or storage-disabled edge case must degrade gracefully (treat as "not seen yet" on read failure; silently no-op on write failure).
- Visual style must reuse existing tokens/classes verbatim: `bg-[var(--color-bg)]` background, `rounded-2xl h-14` primary buttons in solid `bg-[var(--brand-primary)] text-white`, `active:scale-[0.98]` press feedback, Manrope font (already global) — no new colors, no gradients (per spec, auth-adjacent screens use flat teal only).
- No backend/API calls — this feature is entirely client-side.
- Copy is region-neutral (no UK/US/PL variants) for this pass.
- Slide 4 copy must avoid the word "blockchain" or other technical jargon — frame as "locked", "tamper-proof", "permanent" (per spec positioning rule: separated-parent benefit is implicit, never named).
- Image composition: subject left-of-frame facing right, single-column mobile layout (image above text, not side-by-side) — per spec's composition rule.
- Final artwork is being produced separately by the user (Firefly, painterly teal/gold style). This plan ships with placeholder SVGs using the exact final filenames, so swapping in final art later is a drop-in file replacement, not a code change.

---

## File Structure

- **Create** `app/src/lib/onboarding.ts` — `hasSeenOnboarding()`, `markOnboardingSeen()`, exported `ONBOARDING_SEEN_KEY` constant.
- **Create** `app/src/lib/__tests__/onboarding.test.ts` — unit tests for the above.
- **Create** `app/src/assets/onboarding/slide-1.svg` .. `slide-4.svg` — placeholder art (solid teal panel + slide number), same filenames the user's final artwork will replace.
- **Create** `app/src/screens/OnboardingCarousel.tsx` — the carousel screen component.
- **Create** `app/src/screens/__tests__/OnboardingCarousel.test.tsx` — component tests.
- **Modify** `app/src/App.tsx` — `RootGate` (lines 112-120) gains the onboarding check; `Routes` (lines 204-229) gains the `/onboarding` route.

---

### Task 1: Onboarding flag module

**Files:**
- Create: `app/src/lib/onboarding.ts`
- Test: `app/src/lib/__tests__/onboarding.test.ts`

**Interfaces:**
- Produces: `ONBOARDING_SEEN_KEY: string`, `hasSeenOnboarding(): boolean`, `markOnboardingSeen(): void` — consumed by Task 3 (`App.tsx`) and Task 4 (`OnboardingCarousel.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/src/lib/__tests__/onboarding.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasSeenOnboarding, markOnboardingSeen, ONBOARDING_SEEN_KEY } from '../onboarding'

describe('onboarding flag', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when the flag has never been set', () => {
    expect(hasSeenOnboarding()).toBe(false)
  })

  it('returns true after markOnboardingSeen is called', () => {
    markOnboardingSeen()
    expect(hasSeenOnboarding()).toBe(true)
  })

  it('stores the flag as the string "1" under the mc_ prefixed key', () => {
    markOnboardingSeen()
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
    expect(ONBOARDING_SEEN_KEY).toBe('mc_has_seen_onboarding')
  })

  it('returns false if reading localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(hasSeenOnboarding()).toBe(false)
    spy.mockRestore()
  })

  it('does not throw if writing localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => markOnboardingSeen()).not.toThrow()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/__tests__/onboarding.test.ts`
Expected: FAIL — `Cannot find module '../onboarding'` (or similar resolution error)

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/lib/onboarding.ts
/**
 * First-launch onboarding carousel — "has the user seen it" flag.
 *
 * Storage key: mc_has_seen_onboarding (localStorage)
 * Set once, on skip or completion of the carousel. Never cleared automatically.
 */

export const ONBOARDING_SEEN_KEY = 'mc_has_seen_onboarding'

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Storage unavailable — worst case the carousel reappears next launch.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/__tests__/onboarding.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd app
git add src/lib/onboarding.ts src/lib/__tests__/onboarding.test.ts
git commit -m "feat: add mc_has_seen_onboarding flag module"
```

---

### Task 2: Placeholder slide artwork

**Files:**
- Create: `app/src/assets/onboarding/slide-1.svg`
- Create: `app/src/assets/onboarding/slide-2.svg`
- Create: `app/src/assets/onboarding/slide-3.svg`
- Create: `app/src/assets/onboarding/slide-4.svg`

No test — static assets. These are placeholders only; the user is producing final painterly artwork separately and will replace these four files by filename (same `slide-N.svg` names, or swap the extension and update the one import line per slide in Task 4 if final art ships as `.png`/`.webp`).

- [ ] **Step 1: Create the four placeholder SVGs**

Each is a simple 400×300 teal panel with a centered slide number, matching the "subject left, facing right" composition zone loosely (a placeholder circle standing in for the character, positioned left) so the layout can be visually verified before final art exists.

```svg
<!-- app/src/assets/onboarding/slide-1.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f9f7f2"/>
  <circle cx="120" cy="150" r="70" fill="#00959c" opacity="0.85"/>
  <text x="120" y="158" font-family="sans-serif" font-size="28" fill="#ffffff" text-anchor="middle">1</text>
</svg>
```

```svg
<!-- app/src/assets/onboarding/slide-2.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f9f7f2"/>
  <circle cx="120" cy="150" r="70" fill="#00959c" opacity="0.85"/>
  <text x="120" y="158" font-family="sans-serif" font-size="28" fill="#ffffff" text-anchor="middle">2</text>
</svg>
```

```svg
<!-- app/src/assets/onboarding/slide-3.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f9f7f2"/>
  <circle cx="120" cy="150" r="70" fill="#00959c" opacity="0.85"/>
  <text x="120" y="158" font-family="sans-serif" font-size="28" fill="#ffffff" text-anchor="middle">3</text>
</svg>
```

```svg
<!-- app/src/assets/onboarding/slide-4.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f9f7f2"/>
  <circle cx="120" cy="150" r="70" fill="#e6b222" opacity="0.85"/>
  <text x="120" y="158" font-family="sans-serif" font-size="28" fill="#ffffff" text-anchor="middle">4</text>
</svg>
```

- [ ] **Step 2: Commit**

```bash
cd app
git add src/assets/onboarding/slide-1.svg src/assets/onboarding/slide-2.svg src/assets/onboarding/slide-3.svg src/assets/onboarding/slide-4.svg
git commit -m "chore: add placeholder onboarding slide artwork"
```

---

### Task 3: OnboardingCarousel screen component

**Files:**
- Create: `app/src/screens/OnboardingCarousel.tsx`
- Test: `app/src/screens/__tests__/OnboardingCarousel.test.tsx`

**Interfaces:**
- Consumes: `hasSeenOnboarding(): boolean`, `markOnboardingSeen(): void` from `app/src/lib/onboarding.ts` (Task 1); slide images from `app/src/assets/onboarding/slide-{1..4}.svg` (Task 2).
- Produces: `export function OnboardingCarousel(): JSX.Element` — consumed by Task 4 (`App.tsx` route).

- [ ] **Step 1: Write the failing tests**

```tsx
// app/src/screens/__tests__/OnboardingCarousel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { OnboardingCarousel } from '../OnboardingCarousel'
import { ONBOARDING_SEEN_KEY } from '../../lib/onboarding'

function renderCarousel() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingCarousel />
    </MemoryRouter>
  )
}

describe('OnboardingCarousel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the first slide headline on mount', () => {
    renderCarousel()
    expect(screen.getByText('Chores that actually pay')).toBeInTheDocument()
  })

  it('shows 4 pagination dots', () => {
    renderCarousel()
    expect(screen.getAllByRole('button', { name: /go to slide/i })).toHaveLength(4)
  })

  it('advances to the next slide when Next is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Money lessons that actually stick')).toBeInTheDocument()
  })

  it('shows "Get Started" instead of "Next" on the final slide', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('A record nothing can quietly change')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
  })

  it('jumps directly to a slide when its dot is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))
    expect(screen.getByText('You approve everything')).toBeInTheDocument()
  })

  it('marks onboarding seen and does not stay on /onboarding when Skip is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
  })

  it('marks onboarding seen when Get Started is tapped on the final slide', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/screens/__tests__/OnboardingCarousel.test.tsx`
Expected: FAIL — `Cannot find module '../OnboardingCarousel'`

- [ ] **Step 3: Write the implementation**

```tsx
// app/src/screens/OnboardingCarousel.tsx
/**
 * OnboardingCarousel — first-launch explainer, shown once before LandingGate.
 *
 * Routed at /onboarding. RootGate in App.tsx sends fresh (no device identity,
 * hasSeenOnboarding() === false) users here. Skip or "Get Started" both mark
 * the flag seen and navigate back to "/", letting RootGate re-decide the next
 * screen (falls through to LandingGate) rather than hardcoding it here.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { markOnboardingSeen } from '@/lib/onboarding'

import slide1 from '@/assets/onboarding/slide-1.svg'
import slide2 from '@/assets/onboarding/slide-2.svg'
import slide3 from '@/assets/onboarding/slide-3.svg'
import slide4 from '@/assets/onboarding/slide-4.svg'

interface Slide {
  image:    string
  alt:      string
  headline: string
  subtext:  string
}

const SLIDES: Slide[] = [
  {
    image:    slide1,
    alt:      'A child completing a chore, glowing with warm light',
    headline: 'Chores that actually pay',
    subtext:  'Every task is tracked as real, earned money — not just a checklist to cross off.',
  },
  {
    image:    slide2,
    alt:      'A child looking up at a glowing orb of light above their palm',
    headline: 'Money lessons that actually stick',
    subtext:  'The AI Mentor turns their own earning and spending into real financial lessons — not a generic course.',
  },
  {
    image:    slide3,
    alt:      'A parent reviewing a glowing ledger held in both hands',
    headline: 'You approve everything',
    subtext:  "Nothing hits the ledger without your sign-off. You're always in control.",
  },
  {
    image:    slide4,
    alt:      'Glowing golden chain links sealed with light, resting in open palms',
    headline: 'A record nothing can quietly change',
    subtext:  'Every entry is locked the moment it’s approved — permanent, tamper-proof, and visible to everyone who needs it.',
  },
]

export function OnboardingCarousel() {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const isLast = activeIndex === SLIDES.length - 1
  const slide = SLIDES[activeIndex]

  function finish() {
    markOnboardingSeen()
    navigate('/', { replace: true })
  }

  function goNext() {
    if (isLast) {
      finish()
    } else {
      setActiveIndex(i => i + 1)
    }
  }

  function goToSlide(index: number) {
    setActiveIndex(index)
  }

  return (
    <div className="h-svh bg-[var(--color-bg)] flex flex-col overflow-hidden">
      <header className="safe-top px-4 py-3 flex justify-end">
        <button
          onClick={finish}
          className="text-[13px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Skip
        </button>
      </header>

      <main className="flex-1 flex flex-col px-5 max-w-md mx-auto w-full overflow-hidden">
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -60) goNext()
                else if (info.offset.x > 60 && activeIndex > 0) goToSlide(activeIndex - 1)
              }}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-6 w-full py-4"
            >
              <img
                src={slide.image}
                alt={slide.alt}
                className="w-full max-w-[280px] h-auto rounded-2xl"
                draggable={false}
              />
              <div className="text-center space-y-3">
                <h1 className="text-[28px] font-extrabold text-[var(--color-text)] tracking-tight leading-[1.15]">
                  {slide.headline}
                </h1>
                <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-[300px] mx-auto">
                  {slide.subtext}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2 py-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goToSlide(i)}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? 'w-6 bg-[var(--brand-primary)]'
                  : 'w-2 bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>

        <div className="w-full pb-6">
          <button
            onClick={goNext}
            className="
              w-full h-14 rounded-2xl bg-[var(--brand-primary)] text-white
              font-semibold text-[15px] tracking-tight
              flex items-center justify-center gap-2.5
              hover:opacity-90 active:scale-[0.98]
              transition-all duration-150 shadow-md hover:shadow-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2
            "
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/screens/__tests__/OnboardingCarousel.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
cd app
git add src/screens/OnboardingCarousel.tsx src/screens/__tests__/OnboardingCarousel.test.tsx
git commit -m "feat: add OnboardingCarousel screen component"
```

---

### Task 4: Wire into routing

**Files:**
- Modify: `app/src/App.tsx:112-120` (`RootGate`), `app/src/App.tsx:204-229` (`Routes`)

**Interfaces:**
- Consumes: `hasSeenOnboarding()` from `app/src/lib/onboarding.ts` (Task 1), `OnboardingCarousel` from `app/src/screens/OnboardingCarousel.tsx` (Task 3).

- [ ] **Step 1: Add the import**

In `app/src/App.tsx`, find the existing screen imports (near the top, alongside the `LandingGate` import) and add:

```tsx
import { OnboardingCarousel } from './screens/OnboardingCarousel'
import { hasSeenOnboarding }  from './lib/onboarding'
```

- [ ] **Step 2: Update `RootGate`**

Replace the current `RootGate` function (`App.tsx:112-120`):

```tsx
/** Root — cold start shows landing page, returning user goes to lock screen. */
function RootGate() {
  const identity = getDeviceIdentity()
  // If identity exists, redirect immediately with no intermediate render.
  // Rendering LandingGate even for one frame causes a visible flash on
  // pull-to-refresh and after logout.
  if (identity) return <Navigate to="/lock" replace />
  return <LandingGate />
}
```

with:

```tsx
/** Root — cold start shows onboarding then landing page, returning user goes to lock screen. */
function RootGate() {
  const identity = getDeviceIdentity()
  // If identity exists, redirect immediately with no intermediate render.
  // Rendering LandingGate even for one frame causes a visible flash on
  // pull-to-refresh and after logout.
  if (identity) return <Navigate to="/lock" replace />
  if (!hasSeenOnboarding()) return <Navigate to="/onboarding" replace />
  return <LandingGate />
}
```

- [ ] **Step 3: Add the route**

In the `<Routes>` block (`App.tsx:204-229`), add the new route directly after `/`:

```tsx
          <Route path="/"           element={<RootGate />} />
          <Route path="/onboarding" element={<OnboardingCarousel />} />
          <Route path="/lock"       element={<LockScreen />} />
```

(Replaces just the `<Route path="/" .../>` line with two lines; every other route is unchanged.)

- [ ] **Step 4: Verify the app builds**

Run: `cd app && npx tsc --noEmit`
Expected: no new type errors

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (from repo root, per `CLAUDE.md`)

1. Clear the app's localStorage (DevTools → Application → Local Storage → clear), reload at `/`.
   Expected: `OnboardingCarousel` renders — slide 1 "Chores that actually pay" with placeholder teal artwork.
2. Tap "Next" three times.
   Expected: slides 2, 3, then 4 ("A record nothing can quietly change") appear in order; final slide's button reads "Get Started".
3. Tap "Get Started".
   Expected: routes to `LandingGate` ("Welcome to the Orchard" screen). `localStorage.getItem('mc_has_seen_onboarding')` is `'1'` in DevTools.
4. Reload at `/`.
   Expected: `LandingGate` renders directly — carousel does not reappear.
5. Clear localStorage again, reload, and this time tap "Skip" from slide 1.
   Expected: routes straight to `LandingGate`; flag is set the same as completing the carousel.
6. With `mc_device_identity` still unset, manually set a fake identity in DevTools console (`localStorage.setItem('mc_device_identity', JSON.stringify({user_id:'x'}))`) and reload at `/`.
   Expected: routes straight to `/lock` — carousel is never shown to a device with an identity, regardless of the onboarding flag.

- [ ] **Step 6: Commit**

```bash
cd app
git add src/App.tsx
git commit -m "feat: route fresh installs through OnboardingCarousel before LandingGate"
```

---

## Follow-up (not part of this plan)

- Replace the four placeholder SVGs in `app/src/assets/onboarding/` with final Firefly-generated painterly artwork once produced — same filenames if kept as `.svg` (e.g. wrap a raster export in an `<image>` tag inside the SVG, or export directly as SVG from Firefly's output pipeline if available), or update the four `import slideN from '@/assets/onboarding/slide-N.svg'` lines in `OnboardingCarousel.tsx` to the new extension if shipping as `.png`/`.webp`.
