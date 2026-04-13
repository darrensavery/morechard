# Locale & Currency Decoupled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple language (`locale`) from currency (`base_currency`), add USD and US English support, and wire a live language picker into Appearance & Display settings.

**Architecture:** A new `locale.ts` module owns all locale reads/writes and exports `useLocale()`. `useTone` consumes `useLocale()` internally to return locale-aware terminology. Registration Stage 2 gains a language section above the existing currency section. `AppearanceSettings` replaces its "Coming soon" row with a live 3-option segment picker.

**Tech Stack:** React, TypeScript, Cloudflare D1 (via existing `updateSettings` API), localStorage (`mc_locale`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `app/src/lib/locale.ts` | `AppLocale` type, detection, `getLocale`, `setLocaleStorage`, `getLanguage`, `isPolish`, `currencySymbol`, `useLocale` hook |
| **Modify** | `app/src/lib/useTone.ts` | Add `terminology` field; consume `useLocale()` internally |
| **Modify** | `app/src/components/settings/sections/AppearanceSettings.tsx` | Replace "Coming soon" row with live language segment picker |
| **Modify** | `app/src/components/dashboard/ParentSettingsTab.tsx` | Sync D1 locale → localStorage on login (`load` callback, line 202) |
| **Modify** | `app/src/components/registration/RegistrationShell.tsx` | Add `locale` to `RegistrationState`; pass to `createFamily` directly |
| **Modify** | `app/src/components/registration/Stage2FamilyConstitution.tsx` | Add language section; add USD currency card |
| **Modify** | `app/src/components/dashboard/CreateChoreSheet.tsx` | Replace inline `currencySymbol` ternary |
| **Modify** | `app/src/components/dashboard/GoalBoostingTab.tsx` | Replace inline `currencySymbol` ternary |
| **Modify** | `app/src/components/dashboard/SavingsGrove.tsx` | Replace inline `currencySymbol` 3-way ternary |
| **Modify** | `app/src/components/dashboard/HistoryTab.tsx` | Pass real currency; use `currencySymbol` |
| **Modify** | `app/src/screens/AuthCallbackScreen.tsx` | Use `isPolish(getLocale())` |
| **Modify** | `app/src/screens/ParentDashboard.tsx` | Use `isPolish(getLocale())` |
| **Modify** | `app/src/components/registration/WelcomeNudge.tsx` | Use `isPolish(locale)` |
| **Modify** | `app/src/screens/WelcomeOrchardScreen.tsx` | Use `terminology.money` |
| **Modify** | `app/src/components/settings/sections/FamilySettings.tsx` | Use `terminology.allowanceLabel` |
| **Modify** | `app/src/components/settings/sections/ChildProfileSettings.tsx` | Use `terminology.allowanceLabel` |
| **Modify** | `app/src/components/registration/Stage2FamilyConstitution.tsx` | Use `terminology.money` in ledger-integrity copy |

---

## Task 1: Create `locale.ts`

**Files:**
- Create: `app/src/lib/locale.ts`

- [ ] **Step 1: Create the file**

```ts
// app/src/lib/locale.ts
import { useState, useCallback } from 'react'
import { updateSettings } from './api'

export type AppLocale = 'en-GB' | 'en-US' | 'pl'

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Detect the best AppLocale from the browser's navigator.language.
 * Handles: en-US, en-GB, en-AU, en, pl, pl-PL, and all variants.
 * Falls back to 'en-GB' for anything unrecognised.
 */
export function detectLocale(): AppLocale {
  try {
    const lang = navigator.language ?? ''
    if (lang.startsWith('pl'))    return 'pl'
    if (lang.startsWith('en-US')) return 'en-US'
    if (lang.startsWith('en'))    return 'en-GB'  // en-GB, en-AU, plain 'en' → en-GB
  } catch { /* storage blocked or SSR */ }
  return 'en-GB'
}

// ── Storage ───────────────────────────────────────────────────────────────────

const VALID: AppLocale[] = ['en-GB', 'en-US', 'pl']

/**
 * Read mc_locale from localStorage.
 * Falls back to browser detection if absent or contains a legacy value ('en'/'pl-PL').
 */
export function getLocale(): AppLocale {
  try {
    const stored = localStorage.getItem('mc_locale') as AppLocale | null
    if (stored && VALID.includes(stored)) return stored
  } catch { /* storage blocked */ }
  return detectLocale()
}

/**
 * Write mc_locale to localStorage only.
 * The useLocale() hook handles the D1 sync — do not call this directly from components.
 */
export function setLocaleStorage(l: AppLocale): void {
  try {
    localStorage.setItem('mc_locale', l)
  } catch { /* storage blocked */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip region tag: 'en-GB' → 'en', 'en-US' → 'en', 'pl' → 'pl' */
export function getLanguage(l: AppLocale): 'en' | 'pl' {
  return l === 'pl' ? 'pl' : 'en'
}

/**
 * Convenience guard for all existing === 'pl' checks in the codebase.
 * Prefer this over string comparison so narrowing to 'pl' stays in one place.
 */
export function isPolish(l: AppLocale): boolean {
  return l === 'pl'
}

/** Map a currency code to its display symbol. */
export function currencySymbol(currency: string): string {
  if (currency === 'PLN') return 'zł'
  if (currency === 'USD') return '$'
  return '£'  // GBP default
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useLocale — single source of truth for reading and changing the app locale.
 *
 * - Initialised lazily from localStorage (one read at mount, not per render).
 * - setLocale: writes localStorage synchronously, then persists to D1 async.
 *   The UI reflects the change immediately; the API call is fire-and-forget.
 */
export function useLocale(): { locale: AppLocale; setLocale: (l: AppLocale) => Promise<void> } {
  const [locale, setLocaleState] = useState<AppLocale>(getLocale)

  const setLocale = useCallback(async (l: AppLocale) => {
    setLocaleState(l)
    setLocaleStorage(l)
    await updateSettings({ locale: l })
  }, [])

  return { locale, setLocale }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npm run build 2>&1 | head -40
```

Expected: no errors in `locale.ts`

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/locale.ts
git commit -m "feat(locale): add locale.ts — AppLocale type, detection, helpers, useLocale hook"
```

---

## Task 2: Extend `useTone` with locale-aware terminology

**Files:**
- Modify: `app/src/lib/useTone.ts`

The `Tone` interface gains a `terminology` field. `useTone` calls `useLocale()` internally — no prop change needed at call sites.

- [ ] **Step 1: Replace `useTone.ts` entirely**

```ts
/**
 * useTone — returns age-appropriate copy based on teen_mode setting,
 * and locale-aware terminology based on the current AppLocale.
 *
 * teen_mode = 0 (default): child view — orchard language, playful icons visible
 * teen_mode = 1:           mature view — fintech language, minimal icon set
 *
 * Usage:
 *   const tone = useTone(teenMode)
 *   tone.balance          → "Your Harvest"  |  "Total Balance"
 *   tone.terminology.money → "pocket money" | "allowance" | "kieszonkowe"
 */

import { useLocale, type AppLocale } from './locale'

export interface Terminology {
  money:          string   // 'pocket money' | 'allowance' | 'kieszonkowe'
  allowanceLabel: string   // UI-safe capitalised form: 'Allowance' | 'Kieszonkowe'
}

export interface Tone {
  isChild: boolean        // true = child view, false = mature/teen view

  // Labels
  dashboard:     string
  balance:       string
  addToSchedule: string
  allowance:     string
  rewards:       string
  weekSection:   string
  weekSubtitle:  string
  emptyGrove:    string
  emptyGroveSub: string
  nothingToday:  string
  doneButton:    string
  submitButton:  string
  waitingBadge:  string
  allChores:     string

  // Locale-driven parent-side terminology
  terminology: Terminology
}

const CHILD_TONE_BASE = {
  isChild:       true,
  dashboard:     'The Orchard',
  balance:       'Your harvest',
  addToSchedule: 'Plant in my grove',
  allowance:     'Rainfall',
  rewards:       'Sunshine',
  weekSection:   'Your week in the grove',
  weekSubtitle:  "Tap a day to see what's growing",
  emptyGrove:    'Your grove is empty',
  emptyGroveSub: 'Ask a parent to plant some jobs for you.',
  nothingToday:  'Nothing planted for',
  doneButton:    'Done!',
  submitButton:  'Send to parent',
  waitingBadge:  'Waiting…',
  allChores:     'All my jobs',
}

const TEEN_TONE_BASE = {
  isChild:       false,
  dashboard:     'My Account',
  balance:       'Total balance',
  addToSchedule: 'Add to schedule',
  allowance:     'Regular pay',
  rewards:       'Bonus',
  weekSection:   'My week',
  weekSubtitle:  'Select a day to filter tasks',
  emptyGrove:    'No tasks yet',
  emptyGroveSub: 'A parent will assign tasks to your account.',
  nothingToday:  'No tasks scheduled for',
  doneButton:    'Mark complete',
  submitButton:  'Submit for approval',
  waitingBadge:  'Pending',
  allChores:     'All tasks',
}

function buildTerminology(locale: AppLocale): Terminology {
  if (locale === 'pl') return { money: 'kieszonkowe', allowanceLabel: 'Kieszonkowe' }
  if (locale === 'en-US') return { money: 'allowance', allowanceLabel: 'Allowance' }
  return { money: 'pocket money', allowanceLabel: 'Allowance' }  // en-GB default
}

export function useTone(teenMode: number | boolean | undefined): Tone {
  const { locale } = useLocale()
  const terminology = buildTerminology(locale)
  const base = teenMode ? TEEN_TONE_BASE : CHILD_TONE_BASE
  return { ...base, terminology }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/useTone.ts
git commit -m "feat(locale): extend useTone with locale-aware terminology field"
```

---

## Task 3: D1 sync on login — `ParentSettingsTab`

**Files:**
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx` (line 202)

After settings are loaded, sync the D1 locale value into localStorage so returning users on fresh devices inherit their saved language immediately.

- [ ] **Step 1: Edit the `load` callback**

Find this block (around line 202):
```ts
    if (s?.avatar_id) localStorage.setItem('mc_parent_avatar', s.avatar_id)
```

Replace with:
```ts
    if (s?.avatar_id) localStorage.setItem('mc_parent_avatar', s.avatar_id)
    if (s?.locale)    localStorage.setItem('mc_locale', s.locale)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(locale): sync D1 locale into localStorage on settings load"
```

---

## Task 4: Language picker in `AppearanceSettings`

**Files:**
- Modify: `app/src/components/settings/sections/AppearanceSettings.tsx`

Replace the "Coming soon" `SettingsRow` with an inline 3-button segment picker styled to match `ThemePicker`.

- [ ] **Step 1: Replace `AppearanceSettings.tsx` entirely**

```tsx
/**
 * AppearanceSettings — Appearance & Display section.
 * ThemePicker is self-contained; LanguagePicker reads/writes via useLocale().
 */

import { useLocale, type AppLocale } from '../../../lib/locale'
import { ThemePicker } from '../../../lib/theme'
import { Toast, SectionCard, SectionHeader } from '../shared'
import { cn } from '../../../lib/utils'

interface Props {
  toast:        string | null
  onBack:       () => void
  onComingSoon: () => void
}

const LANGUAGE_OPTIONS: { value: AppLocale; flag: string; label: string }[] = [
  { value: 'en-GB', flag: '🇬🇧', label: 'UK English' },
  { value: 'en-US', flag: '🇺🇸', label: 'US English' },
  { value: 'pl',    flag: '🇵🇱', label: 'Polish'     },
]

export function AppearanceSettings({ toast, onBack }: Props) {
  const { locale, setLocale } = useLocale()

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} />}
      <SectionHeader title="Appearance & Display" onBack={onBack} />
      <SectionCard>
        <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
          <ThemePicker />
        </div>
        <div className="px-4 py-3.5">
          <p className="text-[13px] font-semibold text-[var(--color-text)] mb-2.5">Language</p>
          <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden">
            {LANGUAGE_OPTIONS.map(({ value, flag, label }, i) => (
              <button
                key={value}
                type="button"
                onClick={() => setLocale(value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-center transition-colors cursor-pointer',
                  i < LANGUAGE_OPTIONS.length - 1 && 'border-r border-[var(--color-border)]',
                  locale === value
                    ? 'bg-teal-600 text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-teal-50 hover:text-teal-700',
                )}
              >
                <span className="text-base leading-none">{flag}</span>
                <span className="text-[11px] font-semibold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
```

Note: `onComingSoon` prop is removed from usage inside this component. The `Props` interface keeps it to avoid breaking the call site in `ParentSettingsTab` — it's already passed there and removing it from the interface would require a call-site change. Leave it in the interface, just unused.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Manual smoke test**
  - Open Appearance & Display in settings
  - Confirm 3-button language picker renders with flags
  - Tap each option — active button turns teal
  - Reload page — selection persists (reads from localStorage)

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/AppearanceSettings.tsx
git commit -m "feat(locale): live language picker in Appearance & Display settings"
```

---

## Task 5: Update `RegistrationShell` — add `locale` to state and `createFamily` call

**Files:**
- Modify: `app/src/components/registration/RegistrationShell.tsx`

- [ ] **Step 1: Add `locale` import and update `RegistrationState`**

At the top of the file, add the import:
```ts
import { detectLocale, type AppLocale } from '@/lib/locale'
```

Find the `RegistrationState` interface and update two fields:
```ts
  // Step 2
  base_currency?: 'GBP' | 'USD' | 'PLN'   // add USD
  locale?:        AppLocale                 // new — no longer derived from currency
```

- [ ] **Step 2: Fix the `createFamily` call (around line 106)**

Find:
```ts
            locale:          merged.base_currency === 'PLN' ? 'pl' : 'en',
```

Replace with:
```ts
            locale:          merged.locale ?? detectLocale(),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/registration/RegistrationShell.tsx
git commit -m "feat(locale): add explicit locale field to RegistrationState; remove currency derivation"
```

---

## Task 6: Update `Stage2FamilyConstitution` — language section + USD card

**Files:**
- Modify: `app/src/components/registration/Stage2FamilyConstitution.tsx`

This is the largest change: a new Language section is added above the existing Currency section, USD is added as a currency option, and the ledger copy uses `terminology.money`.

- [ ] **Step 1: Replace `Stage2FamilyConstitution.tsx` entirely**

```tsx
/**
 * Stage 2 — Family Setup
 *
 * Collects: locale (en-GB | en-US | pl) and base_currency (GBP | USD | PLN)
 * These are independent choices — language does not determine currency.
 * For co-parenting only: governance_mode (amicable | standard)
 * Single-parent accounts always use amicable — no choice shown.
 *
 * Smart detection: uses navigator.language to pre-highlight cards,
 * but the user must tap to confirm. No selection = Continue is blocked.
 */

import { useState, useEffect } from 'react'
import { Info, Scale, Zap, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectLocale, type AppLocale } from '@/lib/locale'
import type { RegistrationState } from './RegistrationShell'

interface Props {
  data: RegistrationState
  onNext: (patch: Partial<RegistrationState>) => void
  onBack: () => void
}

type Currency = 'GBP' | 'USD' | 'PLN'

/** Detect likely currency from browser locale. Returns null if ambiguous. */
function detectCurrency(): Currency | null {
  try {
    const lang = navigator.language ?? ''
    if (lang.startsWith('pl') || lang.includes('-PL')) return 'PLN'
    if (lang.startsWith('en-US'))                       return 'USD'
    if (lang.startsWith('en-GB') || lang.includes('-GB')) return 'GBP'
    if (lang.startsWith('en'))                          return 'GBP'
  } catch { /* ignore */ }
  return null
}

const LANGUAGE_OPTIONS: { value: AppLocale; flag: string; label: string; region: string }[] = [
  { value: 'en-GB', flag: '🇬🇧', label: 'UK English', region: 'United Kingdom' },
  { value: 'en-US', flag: '🇺🇸', label: 'US English', region: 'United States'  },
  { value: 'pl',    flag: '🇵🇱', label: 'Polish',     region: 'Poland'          },
]

const CURRENCY_OPTIONS: { value: Currency; symbol: string; label: string; region: string }[] = [
  { value: 'GBP', symbol: '£',  label: 'British Pound', region: 'United Kingdom' },
  { value: 'USD', symbol: '$',  label: 'US Dollar',     region: 'United States'  },
  { value: 'PLN', symbol: 'zł', label: 'Polish Zloty',  region: 'Poland'          },
]

export function Stage2FamilyConstitution({ data, onNext, onBack }: Props) {
  const [locale,      setLocale]      = useState<AppLocale | null>(data.locale ?? null)
  const [currency,    setCurrency]    = useState<Currency | null>(data.base_currency ?? null)
  const [sugLocale,   setSugLocale]   = useState<AppLocale | null>(null)
  const [sugCurrency, setSugCurrency] = useState<Currency | null>(null)
  const [govMode,     setGovMode]     = useState<'amicable' | 'standard'>(
    data.governance_mode ?? (data.parenting_mode === 'co-parenting' ? 'standard' : 'amicable')
  )
  const [showGovInfo, setShowGovInfo] = useState(false)
  const [attempted,   setAttempted]   = useState(false)

  const isCoParenting = data.parenting_mode === 'co-parenting'

  useEffect(() => {
    if (data.locale || data.base_currency) return  // came back from step 3
    setSugLocale(detectLocale())
    const detectedCurrency = detectCurrency()
    if (detectedCurrency) setSugCurrency(detectedCurrency)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    setAttempted(true)
    if (!locale || !currency) return
    onNext({
      locale,
      base_currency:   currency,
      governance_mode: isCoParenting ? govMode : 'amicable',
    })
  }

  const noSelection = !locale || !currency

  const moneyWord = locale === 'pl' ? 'kieszonkowe' : locale === 'en-US' ? 'allowance' : 'pocket money'

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Family Setup</h2>
        <p className="text-[#6b6a66] text-sm leading-relaxed">
          Choose your language and currency. These can be changed later in Settings.
        </p>
      </div>

      {/* Language selection */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1C1C1A]">Language</span>
          {sugLocale && !locale && (
            <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 font-medium">
              Detected from your device
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map(opt => (
            <SelectionCard
              key={opt.value}
              active={locale === opt.value}
              suggested={sugLocale === opt.value && !locale}
              onClick={() => setLocale(opt.value)}
              symbol={opt.flag}
              label={opt.label}
              region={opt.region}
            />
          ))}
        </div>

        {attempted && !locale && (
          <p className="text-xs font-semibold text-red-600 pl-1">Please choose a language to continue.</p>
        )}
      </section>

      {/* Currency selection */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1C1C1A]">Base currency</span>
          {sugCurrency && !currency && (
            <span className="text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 font-medium">
              Detected from your device
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {CURRENCY_OPTIONS.map(opt => (
            <SelectionCard
              key={opt.value}
              active={currency === opt.value}
              suggested={sugCurrency === opt.value && !currency}
              onClick={() => setCurrency(opt.value)}
              symbol={opt.symbol}
              label={opt.label}
              region={opt.region}
            />
          ))}
        </div>

        {attempted && !currency && (
          <p className="text-xs font-semibold text-red-600 pl-1">Please choose a currency to continue.</p>
        )}

        {/* Ledger integrity notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
          <BookOpen size={14} className="text-[#6b6a66] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[#1C1C1A]">Locked to your current region</p>
            <p className="text-xs text-[#6b6a66] mt-0.5 leading-relaxed">
              To keep your financial history accurate, all entries must use a single
              currency. All {moneyWord}, chores, and savings goals are tracked in this currency.
              If you move country, a Relocation Audit entry can be added to the ledger at any time.
            </p>
          </div>
        </div>
      </section>

      {/* Approval model — co-parenting only */}
      {isCoParenting && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#1C1C1A]">Approval style</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowGovInfo(v => !v)}
                className="rounded-full p-1 text-[#9b9a96] hover:text-[#1C1C1A] hover:bg-gray-100 transition-colors"
                aria-label="Learn about approval styles"
              >
                <Info size={15} />
              </button>

              {showGovInfo && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowGovInfo(false)} />
                  <div className="absolute left-0 top-8 z-50 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 space-y-3">
                    <div>
                      <p className="text-sm font-bold text-[#1C1C1A]">How should payments be approved?</p>
                      <p className="text-xs text-[#6b6a66] mt-1 leading-relaxed">
                        This controls whether one parent can approve payments alone, or whether both of you need to agree.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1">
                        <p className="text-xs font-bold text-[#1C1C1A] flex items-center gap-1.5">
                          <Zap size={11} className="text-amber-500" /> Quick approval
                        </p>
                        <p className="text-xs text-[#6b6a66] leading-relaxed">
                          Either parent can approve and it's recorded straight away. The other parent gets a notification.
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1">
                        <p className="text-xs font-bold text-[#1C1C1A] flex items-center gap-1.5">
                          <Scale size={11} className="text-teal-600" /> Both parents agree
                        </p>
                        <p className="text-xs text-[#6b6a66] leading-relaxed">
                          Every payment needs a sign-off from both of you before it's recorded. Creates a full, verifiable history.
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9b9a96] border-t border-gray-100 pt-2 leading-relaxed">
                      You can change this later — it requires agreement from both parents and is logged permanently.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <GovernanceCard
              active={govMode === 'amicable'}
              onClick={() => setGovMode('amicable')}
              icon={<Zap size={20} />}
              title="Quick approval"
              subtitle="Either parent"
              description="Either parent can approve a payment and it's recorded straight away. The other parent is notified."
            />
            <GovernanceCard
              active={govMode === 'standard'}
              onClick={() => setGovMode('standard')}
              icon={<Scale size={20} />}
              title="Both parents agree"
              subtitle="Dual sign-off"
              description="Every payment waits for both parents to approve before it's recorded. Best if you want a complete, shared paper trail."
            />
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-xl border-2 border-[#D3D1C7] bg-white text-sm font-semibold text-[#1C1C1A] hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={cn(
            'flex-[2] h-12 rounded-xl text-white text-sm font-semibold transition-all shadow-sm cursor-pointer active:scale-[0.98]',
            noSelection
              ? 'bg-teal-300 cursor-not-allowed'
              : 'bg-teal-600 hover:bg-teal-700',
          )}
        >
          Continue — Child Setup
        </button>
      </div>
    </div>
  )
}

// ── SelectionCard (shared for both language and currency) ─────────────────────

function SelectionCard({
  active, suggested, onClick, symbol, label, region,
}: {
  active: boolean
  suggested: boolean
  onClick: () => void
  symbol: string
  label: string
  region: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start gap-2 rounded-2xl border-2 p-3 text-left transition-all duration-150 cursor-pointer w-full',
        active
          ? 'border-teal-500 bg-teal-50 shadow-md'
          : suggested
          ? 'border-teal-300 bg-teal-50/40 shadow-sm'
          : 'border-[#D3D1C7] bg-white hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-sm',
      )}
    >
      {suggested && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold text-teal-600 bg-teal-100 rounded-full px-1.5 py-0.5">
          Detected
        </span>
      )}
      <span className={cn(
        'text-[22px] font-extrabold tabular-nums leading-none',
        active ? 'text-teal-700' : 'text-[#1C1C1A]',
      )}>
        {symbol}
      </span>
      <div>
        <p className={cn('text-xs font-bold', active ? 'text-teal-700' : 'text-[#1C1C1A]')}>{label}</p>
        <p className="text-[10px] text-[#9b9a96] mt-0.5">{region}</p>
      </div>
    </button>
  )
}

// ── GovernanceCard ────────────────────────────────────────────────────────────

function GovernanceCard({
  active, onClick, icon, title, subtitle, description,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-150 cursor-pointer w-full',
        active
          ? 'border-teal-500 bg-teal-50 shadow-md'
          : 'border-[#D3D1C7] bg-white hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-sm',
      )}
    >
      <span className={cn(
        'rounded-xl p-2 mt-0.5 shrink-0 transition-colors',
        active ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500',
      )}>
        {icon}
      </span>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn('text-sm font-bold', active ? 'text-teal-700' : 'text-[#1C1C1A]')}>{title}</p>
          <span className="text-[11px] text-[#9b9a96] border border-[#D3D1C7] rounded-full px-2 py-0.5">{subtitle}</span>
        </div>
        <p className="text-xs text-[#6b6a66] leading-relaxed">{description}</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/registration/Stage2FamilyConstitution.tsx
git commit -m "feat(locale): Stage 2 — add language picker, USD currency card, decouple locale from currency"
```

---

## Task 7: Migrate `=== 'pl'` checks to `isPolish()`

**Files:**
- Modify: `app/src/screens/AuthCallbackScreen.tsx`
- Modify: `app/src/screens/ParentDashboard.tsx`
- Modify: `app/src/components/registration/WelcomeNudge.tsx`

- [ ] **Step 1: `AuthCallbackScreen.tsx`**

Find and read lines 14–20:
```ts
  const locale = (localStorage.getItem('mc_locale') as string | null)
```
and:
```ts
  const bridgeText = locale === 'pl' ? 'Logowanie do Sadu…' : 'Consulting the Orchard Lead…'
```

Replace both with:
```ts
  import { getLocale, isPolish } from '../lib/locale'
  // ...
  const locale = getLocale()
  const bridgeText = isPolish(locale) ? 'Logowanie do Sadu…' : 'Consulting the Orchard Lead…'
```

Add the import at the top of the file alongside existing imports.

- [ ] **Step 2: `ParentDashboard.tsx`**

Find (around line 314):
```ts
            const locale   = localStorage.getItem('mc_locale') ?? (navigator.language.startsWith('pl') ? 'pl' : 'en')
```
and (around line 316):
```ts
            const welcome  = locale === 'pl'
```

Replace both with:
```ts
            const locale   = getLocale()
            const welcome  = isPolish(locale)
```

Add at the top of the file:
```ts
import { getLocale, isPolish } from '../lib/locale'
```

- [ ] **Step 3: `WelcomeNudge.tsx`**

Find the existing `locale === 'pl'` check and replace with `isPolish(locale)`. Add import:
```ts
import { isPolish, type AppLocale } from '../../lib/locale'
```

Update the locale variable type to `AppLocale` if it's typed as `string`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/AuthCallbackScreen.tsx app/src/screens/ParentDashboard.tsx app/src/components/registration/WelcomeNudge.tsx
git commit -m "refactor(locale): replace hardcoded === 'pl' checks with isPolish() from locale.ts"
```

---

## Task 8: Consolidate `currencySymbol` across dashboard files

**Files:**
- Modify: `app/src/components/dashboard/CreateChoreSheet.tsx` (line 68)
- Modify: `app/src/components/dashboard/GoalBoostingTab.tsx` (line 205)
- Modify: `app/src/components/dashboard/SavingsGrove.tsx` (line 163)
- Modify: `app/src/components/dashboard/HistoryTab.tsx` (lines 67, 90)

- [ ] **Step 1: `CreateChoreSheet.tsx`**

Find:
```ts
function currencySymbol(c: string) { return c === 'PLN' ? 'zł' : '£' }
```

Delete the local function and add the import at the top:
```ts
import { currencySymbol } from '../../lib/locale'
```

All existing `currencySymbol(c)` calls in this file continue to work unchanged.

- [ ] **Step 2: `GoalBoostingTab.tsx`**

Find (around line 205):
```tsx
{currency === 'GBP' ? '£' : 'zł'}
```

Replace with:
```tsx
{currencySymbol(currency)}
```

Add import:
```ts
import { currencySymbol } from '../../lib/locale'
```

- [ ] **Step 3: `SavingsGrove.tsx`**

Find (around line 163):
```tsx
{currency === 'GBP' ? '£' : currency === 'PLN' ? 'zł' : '$'}
```

Replace with:
```tsx
{currencySymbol(currency)}
```

Add import:
```ts
import { currencySymbol } from '../../lib/locale'
```

- [ ] **Step 4: `HistoryTab.tsx`**

Read lines 60–95 first to understand the context. The hardcoded `'GBP'` in `Intl.NumberFormat` should use the actual currency passed from the parent (or stored in settings). Replace:
```ts
currency: 'GBP',
```
with the actual currency value available in scope. If currency is not yet threaded through, use `'GBP'` as a temporary default and note it in a TODO comment for when currency is wired to the history API.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/CreateChoreSheet.tsx app/src/components/dashboard/GoalBoostingTab.tsx app/src/components/dashboard/SavingsGrove.tsx app/src/components/dashboard/HistoryTab.tsx
git commit -m "refactor(locale): consolidate currencySymbol() — remove inline ternaries, add USD support"
```

---

## Task 9: UI copy — locale-aware terminology via `useTone`

**Files:**
- Modify: `app/src/screens/WelcomeOrchardScreen.tsx` (line 175)
- Modify: `app/src/components/settings/sections/FamilySettings.tsx` (line 195)
- Modify: `app/src/components/settings/sections/ChildProfileSettings.tsx` (line 120)

These files gain `terminology` from their existing or new `useTone` call.

- [ ] **Step 1: `WelcomeOrchardScreen.tsx`**

Read the file to find the `useTone` call and line 175.

If `useTone` is already called, destructure `terminology` from it:
```ts
const { terminology, ...rest } = useTone(teenMode)
```

Find:
```tsx
How will {childFirstName} receive pocket money?
```

Replace with:
```tsx
How will {childFirstName} receive {terminology.money}?
```

- [ ] **Step 2: `FamilySettings.tsx`**

Read the file to find how `useTone` is (or isn't) called. Add/extend the call:
```ts
import { useTone } from '../../../lib/useTone'
// ...
const tone = useTone(0)  // parent view — always non-teen
const { terminology } = tone
```

Find (line 195):
```tsx
description="Weekly day for automated allowance drops — your family's harvest day"
```

Replace label text:
```tsx
label={`${terminology.allowanceLabel} Day`}
description={`Weekly day for automated ${terminology.money} drops — your family's harvest day`}
```

- [ ] **Step 3: `ChildProfileSettings.tsx`**

Read the file. Add `useTone`:
```ts
import { useTone } from '../../../lib/useTone'
// inside component:
const { terminology } = useTone(0)
```

Find (line 120):
```tsx
label="Allowance Status"
```

Replace:
```tsx
label={`${terminology.allowanceLabel} Status`}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/WelcomeOrchardScreen.tsx app/src/components/settings/sections/FamilySettings.tsx app/src/components/settings/sections/ChildProfileSettings.tsx
git commit -m "feat(locale): locale-aware UI copy via useTone terminology — money/allowance labels"
```

---

## Task 10: Final build + smoke test

- [ ] **Step 1: Full production build**

```bash
npm run build 2>&1
```

Expected: exits 0, no TypeScript errors, no missing import warnings.

- [ ] **Step 2: Start dev server and smoke test**

```bash
npm run dev
```

Manually verify:
1. **Settings → Appearance & Display:** 3-button language picker renders; tapping each option changes active state to teal; reload preserves selection.
2. **Register as new user:** Stage 2 shows Language section (3 cards) above Currency section (3 cards including USD). Both must be selected to continue.
3. **US English selected:** Appearance & Display shows "US English" active; terminology in FamilySettings shows "Allowance Day" (unchanged for en-US).
4. **Polish selected:** `WelcomeNudge`, `FamilySettings`, and `ChildProfileSettings` show Polish terminology (`Kieszonkowe`).
5. **Clear localStorage, reload:** `getLocale()` falls back to `detectLocale()` from `navigator.language`.

- [ ] **Step 3: Final commit**

```bash
git add -p  # review any remaining unstaged changes
git commit -m "feat(locale): locale & currency decoupled — language picker, USD, useLocale hook complete"
```
