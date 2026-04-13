# Locale & Currency Decoupled — Design Spec

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** Language picker in AppearanceSettings; `locale` and `base_currency` decoupled; USD added; `useLocale` hook; locale-aware terminology via `useTone`

---

## Overview

Currently `locale` is derived from `base_currency` at registration (`PLN → 'pl'`, else `'en'`). This sprint breaks that coupling:

- `locale` becomes an explicit, independent field (`'en-GB'` | `'en-US'` | `'pl'`)
- `base_currency` gains a third option: `'USD'`
- A live language picker replaces the "Coming soon" row in **Appearance & Display** settings
- Registration Stage 2 collects language and currency as separate choices
- A new `locale.ts` module + `useLocale()` hook centralises all locale reads/writes
- `useTone` consumes `useLocale()` internally so locale-aware terminology flows automatically

No DB schema migration is needed — the `locale` column in D1 is already `TEXT`; we change the values written to it.

---

## New Type: `AppLocale`

```ts
// app/src/lib/locale.ts
export type AppLocale = 'en-GB' | 'en-US' | 'pl'
```

Replaces the untyped `'en'` / `'pl'` strings used throughout the codebase.

---

## `app/src/lib/locale.ts` — new file

### Detection helper (used in registration and `getLocale` fallback)

```ts
export function detectLocale(): AppLocale {
  try {
    const lang = navigator.language ?? ''
    if (lang.startsWith('pl'))    return 'pl'      // pl, pl-PL
    if (lang.startsWith('en-US')) return 'en-US'   // en-US
    // en-GB, en-AU, en, and all other en-* → en-GB (safe default)
    if (lang.startsWith('en'))    return 'en-GB'
  } catch { /* ignore */ }
  return 'en-GB'
}
```

### Core functions

```ts
/** Read mc_locale from localStorage; fall back to browser detection. */
export function getLocale(): AppLocale {
  const stored = localStorage.getItem('mc_locale') as AppLocale | null
  if (stored === 'en-GB' || stored === 'en-US' || stored === 'pl') return stored
  return detectLocale()
}

/** Write mc_locale to localStorage only. Caller is responsible for D1 sync. */
export function setLocaleStorage(l: AppLocale): void {
  localStorage.setItem('mc_locale', l)
}

/** Strip region tag: 'en-GB' → 'en', 'en-US' → 'en', 'pl' → 'pl' */
export function getLanguage(l: AppLocale): 'en' | 'pl' {
  return l === 'pl' ? 'pl' : 'en'
}

/** Convenience guard — replaces === 'pl' checks throughout the codebase. */
export function isPolish(l: AppLocale): boolean {
  return l === 'pl'
}

/** Map currency code to its display symbol. */
export function currencySymbol(currency: string): string {
  if (currency === 'PLN') return 'zł'
  if (currency === 'USD') return '$'
  return '£'  // GBP default
}
```

### `useLocale()` hook

```ts
import { useState, useCallback } from 'react'
import { updateSettings } from './api'

export function useLocale() {
  const [locale, setLocaleState] = useState<AppLocale>(getLocale)

  const setLocale = useCallback(async (l: AppLocale) => {
    setLocaleState(l)
    setLocaleStorage(l)
    await updateSettings({ locale: l })
  }, [])

  return { locale, setLocale }
}
```

- `useState(getLocale)` — lazy initialiser reads localStorage once at mount, not on every render
- `setLocale` writes localStorage immediately (sync) then persists to D1 (async); UI updates instantly
- Components call `useLocale()` once; no per-render raw `localStorage` reads

---

## `useTone.ts` — extend with locale awareness

`useTone` already returns an `allowance` terminology key. It now consumes `useLocale()` internally.

Add locale-driven terminology to the returned object:

| locale | `terminology.money` | `terminology.allowanceLabel` |
|--------|--------------------|-----------------------------|
| `en-GB` | `'pocket money'` | `'Allowance'` |
| `en-US` | `'allowance'` | `'Allowance'` |
| `pl` | `'kieszonkowe'` | `'Kieszonkowe'` |

**Interface addition:**

```ts
terminology: {
  money:          string   // 'pocket money' | 'allowance' | 'kieszonkowe'
  allowanceLabel: string   // UI-safe capitalised form
}
```

`useTone` calls `useLocale()` to read the current locale. No prop drilling required — any component already using `useTone` automatically gets locale-correct labels.

> **Note:** Internal DB/API field names (`earnings_mode: 'ALLOWANCE'`, `allowance_amount`, `weeklyAllowancePence`) are **not changed** — they are data-layer constants, not UI copy.

---

## D1 sync on login (new device)

In `ParentSettingsTab`, `getSettings()` is already called on mount and syncs `avatar_id` to localStorage (line 202). Add one line immediately after:

```ts
if (s?.locale) localStorage.setItem('mc_locale', s.locale)
```

This ensures a returning user on a fresh device inherits their saved locale before any component reads `mc_locale`.

---

## Registration — Stage 2 changes

### `RegistrationState` — add `locale` field

```ts
// RegistrationShell.tsx
export interface RegistrationState {
  // ... existing fields ...
  base_currency?: 'GBP' | 'USD' | 'PLN'   // add USD
  locale?:        AppLocale                 // new explicit field
}
```

### `Stage2FamilyConstitution.tsx` — two sections

**Section 1 — Language** (new, rendered above currency):

- 3 `CurrencyCard`-style cards: 🇬🇧 UK English / 🇺🇸 US English / 🇵🇱 Polish
- Detection via `detectLocale()` from `locale.ts` — shows "Detected" badge on the pre-suggested card
- User must tap to confirm; Continue is blocked until both language and currency are selected
- Sets `locale` on `RegistrationState`

**Section 2 — Currency** (existing, gains USD card):

- 3 cards: £ GBP / $ USD / zł PLN
- Detection: `en-US → USD`, `en-GB/en/other → GBP`, `pl → PLN` (mirrors locale detection logic)
- Existing ledger-integrity notice ("Locked to your current region") is unchanged

**`handleNext` change:**

```ts
onNext({
  locale:        locale,      // explicit — no longer derived from currency
  base_currency: currency,
  governance_mode: isCoParenting ? govMode : 'amicable',
})
```

**`createFamily` call in `RegistrationShell` (step 2):**

```ts
locale: merged.locale ?? detectLocale(),   // replaces: merged.base_currency === 'PLN' ? 'pl' : 'en'
```

---

## AppearanceSettings — live language picker

Replace the `SettingsRow` with `onClick={onComingSoon}` with an inline segment picker.

**Visual style:** 3-button row matching the existing `ThemePicker` layout (border-radius, active teal fill, weight-600 labels).

**Options:**

| Value | Label |
|-------|-------|
| `en-GB` | 🇬🇧 UK English |
| `en-US` | 🇺🇸 US English |
| `pl` | 🇵🇱 Polish |

**Behaviour:**
- Reads current selection from `useLocale()`
- On tap: calls `useLocale().setLocale(newLocale)` — updates localStorage and D1; no page reload needed
- `AppearanceSettings` receives `useLocale()` at this level; no prop changes needed in `ParentSettingsTab`

---

## UI copy updates — locale-aware strings

Files with visible user-facing copy that must read from `useTone().terminology`:

| File | Current hardcoded string | Becomes |
|------|--------------------------|---------|
| `WelcomeOrchardScreen.tsx:175` | `"How will X receive pocket money?"` | `"How will X receive ${terminology.money}?"` |
| `WelcomeNudge.tsx:122` | `"a chore, allowance, or purchase"` | `"a chore, ${terminology.allowanceLabel.toLowerCase()}, or purchase"` (en); existing pl branch unchanged |
| `FamilySettings.tsx:195` | `"Allowance Day"` label | `"${terminology.allowanceLabel} Day"` |
| `ChildProfileSettings.tsx:120` | `"Allowance Status"` | `"${terminology.allowanceLabel} Status"` |
| `Stage2FamilyConstitution.tsx:73` | `"all pocket money, chores, and savings goals"` | `"all ${terminology.money}, chores, and savings goals"` |

`WelcomeNudge` already has a Polish branch (`kieszonkowe`) — keep it, driven by `isPolish(locale)`.

---

## Existing `=== 'pl'` check migration

Files to update (mechanical find-and-replace):

| File | Change |
|------|--------|
| `RegistrationShell.tsx:106` | Replace derived locale with `merged.locale ?? detectLocale()` |
| `AuthCallbackScreen.tsx:16,19` | `locale === 'pl'` → `isPolish(locale)` |
| `ParentDashboard.tsx:314,316` | `locale === 'pl'` → `isPolish(getLocale())` |
| `WelcomeNudge.tsx:121` | existing `locale === 'pl'` branch → `isPolish(locale)` |

---

## `currencySymbol` consolidation

Replace all inline ternaries with `currencySymbol()` from `locale.ts`:

| File | Current | Replacement |
|------|---------|-------------|
| `CreateChoreSheet.tsx:68` | `c === 'PLN' ? 'zł' : '£'` | `currencySymbol(c)` |
| `GoalBoostingTab.tsx:205` | `currency === 'GBP' ? '£' : 'zł'` | `currencySymbol(currency)` |
| `SavingsGrove.tsx:163` | 3-way ternary | `currencySymbol(currency)` |
| `HistoryTab.tsx:67,90` | hardcoded `'GBP'` in `Intl.NumberFormat` | pass actual currency; use `currencySymbol` for symbols |

---

## Out of Scope

- Full i18n library (react-intl, i18next) — `useTone` + `terminology` is sufficient for current copy volume
- Translating all UI strings to Polish — only the `terminology` keys and existing `WelcomeNudge` pl branch
- Apple / system locale push notifications in the user's language
- Changing the `earnings_mode` DB enum values (`ALLOWANCE`, `CHORES`, `HYBRID`)
- Currency conversion or multi-currency ledger entries
- Relocation audit flow (mentioned in existing ledger-integrity notice)
