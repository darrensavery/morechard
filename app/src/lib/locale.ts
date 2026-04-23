// app/src/lib/locale.ts
import { useState, useCallback, useContext, createContext } from 'react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
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
    const stored = localStorage.getItem('mc_locale')
    // Normalise legacy 2-char values written by older worker ('en' → 'en-GB')
    if (stored === 'en') {
      localStorage.setItem('mc_locale', 'en-GB')
      return 'en-GB'
    }
    if (stored && VALID.includes(stored as AppLocale)) return stored as AppLocale
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

// ── Context ───────────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale:    AppLocale
  setLocale: (l: AppLocale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * LocaleProvider — place once at the root of the app (inside App.tsx).
 * All useLocale() callers share this single state, so a language change in
 * AppearanceSettings re-renders every subscribed component immediately.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(getLocale)

  const setLocale = useCallback(async (l: AppLocale) => {
    setLocaleState(l)
    setLocaleStorage(l)
    await updateSettings({ locale: l }).catch(() => {/* offline — localStorage written, syncs on next load */})
  }, [])

  return createElement(LocaleContext.Provider, { value: { locale, setLocale } }, children)
}

/**
 * useLocale — reads from the shared LocaleProvider context.
 * Requires <LocaleProvider> to be present in the tree.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>')
  return ctx
}
