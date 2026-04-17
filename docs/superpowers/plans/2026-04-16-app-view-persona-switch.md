# App View (Orchard ↔ Clean) — Global Persona Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary `teen_mode` integer with a brand-aligned `app_view` ENUM (`ORCHARD` | `CLEAN`) per child, wire it into the child dashboard UI via a renamed `useAppView` hook, inject it into the child AI Mentor system prompt, and show a ceremonial `GraduationOverlay` on the child's first login after being promoted to `CLEAN`.

**Architecture:** D1 migration adds the `app_view` column and copies data from `teen_mode`; the worker settings route and a new `/api/chat` child-mentor route consume `app_view`; the frontend replaces all `teen_mode` / `useTone` references with `app_view` / `useAppView`; a data-driven `CelebrationEngine` (`MilestoneOverlay` + per-achievement config files) handles the graduation ceremony and all future milestone celebrations — adding a new celebration type requires only a new config file and a registry entry.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers (TypeScript), React 18, Vite, Tailwind CSS, Lucide React

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `worker/migrations/0025_app_view.sql` | Add `app_view` column, migrate data from `teen_mode`, add CHECK constraint |
| Create | `worker/migrations/0026_child_logins_app_view.sql` | Add `app_view` snapshot to `child_logins` |
| Modify | `worker/src/routes/settings.ts` | Replace all `teen_mode` references with `app_view` |
| Modify | `worker/src/routes/auth.ts` | Store `app_view` in `child_logins` on login; emit `graduation_pending` flag |
| Create | `worker/src/routes/chat.ts` | New `/api/chat` child-mentor endpoint with `app_view`-aware system prompt |
| Modify | `worker/src/index.ts` | Register `POST /api/chat` route |
| Modify | `app/src/lib/api.ts` | Replace `teen_mode` with `app_view` in all API functions |
| Modify | `app/src/lib/useTone.ts` | Add `useAppView` export + `AppView` type; keep `useTone` as legacy alias |
| Modify | `app/src/screens/ChildDashboard.tsx` | Use `app_view`, write `mc_graduation_pending` flag |
| Modify | `app/src/App.tsx` | Read `mc_app_view` from localStorage instead of `mc_teen_mode` |
| Modify | `app/src/lib/theme.tsx` | Accept `appView` string instead of `teenMode` number |
| Create | `app/src/components/celebration/types.ts` | `MilestoneEvent` union type, `AppView` ref, per-event config shape |
| Create | `app/src/components/celebration/MilestoneOverlay.tsx` | Base full-screen engine: stage sequencing, transitions, `app_view`-aware theming |
| Create | `app/src/components/celebration/achievements/graduation.ts` | `GRADUATION` milestone config — Orchard farewell + shimmer + Clean welcome |
| Create | `app/src/components/celebration/index.ts` | Public barrel export |
| Modify | `app/src/components/settings/sections/ChildProfileSettings.tsx` | Replace Experience Level Coming Soon with live App View two-option selector |
| Modify | `app/src/components/settings/sections/FamilySettings.tsx` | Pass `appViews`/`appViewBusy`/`onAppViewToggle` instead of teen mode props |
| Modify | `app/src/components/dashboard/ParentSettingsTab.tsx` | Replace teen mode state/handler with `app_view` equivalents |

---

## Task 1: D1 Migration — add `app_view` column

**Files:**
- Create: `worker/migrations/0025_app_view.sql`

SQLite does not support `RENAME COLUMN` reliably across all D1 versions. Safe approach: add new column, copy data with mapping, leave old column in place (app layer ignores it going forward).

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 0025: Add app_view TEXT ENUM to user_settings, populated from teen_mode.
-- SQLite cannot rename or drop columns, so the old teen_mode column stays but is ignored.
-- ORCHARD = former teen_mode 0 (default child view — nature metaphors)
-- CLEAN   = former teen_mode 1 (professional view — financial terms)

ALTER TABLE user_settings ADD COLUMN app_view TEXT NOT NULL DEFAULT 'ORCHARD'
  CHECK (app_view IN ('ORCHARD', 'CLEAN'));

UPDATE user_settings SET app_view = CASE
  WHEN teen_mode = 1 THEN 'CLEAN'
  ELSE 'ORCHARD'
END;
```

Save to `worker/migrations/0025_app_view.sql`.

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply morechard-db --local
```

Expected: `✅ Applied migration 0025_app_view`

- [ ] **Step 3: Verify**

```bash
npx wrangler d1 execute morechard-db --local --command \
  "SELECT user_id, teen_mode, app_view FROM user_settings LIMIT 5;"
```

Expected: both columns present, `app_view` shows `ORCHARD` or `CLEAN` matching `teen_mode` values.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0025_app_view.sql
git commit -m "feat(db): add app_view ENUM to user_settings, migrate data from teen_mode"
```

---

## Task 2: D1 Migration — `app_view` snapshot in `child_logins`

**Files:**
- Create: `worker/migrations/0026_child_logins_app_view.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 0026: Add app_view snapshot to child_logins.
-- Records the child's app_view at the time of each login so graduation_pending
-- can be detected by comparing consecutive logins.

ALTER TABLE child_logins ADD COLUMN app_view TEXT NOT NULL DEFAULT 'ORCHARD'
  CHECK (app_view IN ('ORCHARD', 'CLEAN'));
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 migrations apply morechard-db --local
```

Expected: `✅ Applied migration 0026_child_logins_app_view`

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0026_child_logins_app_view.sql
git commit -m "feat(db): add app_view snapshot column to child_logins"
```

---

## Task 3: Worker — update `settings.ts` to read/write `app_view`

**Files:**
- Modify: `worker/src/routes/settings.ts`

- [ ] **Step 1: Update the GET handler seed row**

Find the block that seeds a new `user_settings` row when none exists and replace `teen_mode` with `app_view`:

```typescript
await env.DB
  .prepare(
    `INSERT INTO user_settings (user_id, avatar_id, theme, locale, app_view, updated_at)
     VALUES (?, 'bottts:spark', 'system', 'en', 'ORCHARD', ?)`
  )
  .bind(targetId, Math.floor(Date.now() / 1000))
  .run()
return json({ user_id: targetId, avatar_id: 'bottts:spark', theme: 'system', locale: 'en', app_view: 'ORCHARD' })
```

Also update the SELECT to return `app_view` instead of `teen_mode`:

```typescript
const row = await env.DB
  .prepare(`SELECT avatar_id, theme, locale, app_view FROM user_settings WHERE user_id = ?`)
  .bind(targetId)
  .first<{ avatar_id: string; theme: string; locale: string; app_view: string }>()
```

- [ ] **Step 2: Update the PATCH handler**

Remove the `teen_mode` block and replace with:

```typescript
if ('app_view' in body) {
  // app_view can only be changed by a parent acting on a child
  if (auth.role !== 'parent') {
    return json({ error: 'Only a parent can change app_view' }, { status: 403 })
  }
  const val = body.app_view === 'CLEAN' ? 'CLEAN' : 'ORCHARD'
  updates.push('app_view = ?')
  values.push(val)
}
```

- [ ] **Step 3: Update the upsert fallback (ON CONFLICT path)**

Any `INSERT INTO user_settings ... ON CONFLICT` block: replace `teen_mode` column with `app_view`. Keep `app_view` out of the `DO UPDATE SET` clause — parent changes go through the PATCH route only.

```typescript
.prepare(
  `INSERT INTO user_settings (user_id, avatar_id, theme, locale, app_view, updated_at)
   VALUES (?, ?, ?, ?, 'ORCHARD', ?)
   ON CONFLICT (user_id) DO UPDATE SET
     avatar_id  = excluded.avatar_id,
     theme      = excluded.theme,
     locale     = excluded.locale,
     updated_at = excluded.updated_at`
)
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit 2>&1 | grep "settings"
```

Expected: no errors on `settings.ts`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/settings.ts
git commit -m "feat(worker): replace teen_mode with app_view in settings route"
```

---

## Task 4: Worker — emit `graduation_pending` on child login

**Files:**
- Modify: `worker/src/routes/auth.ts`

- [ ] **Step 1: Fetch `app_view` after PIN verification**

In `handleChildLogin`, after the PIN check passes and before the JWT is signed, add:

```typescript
const settingsRow = await env.DB
  .prepare(`SELECT app_view FROM user_settings WHERE user_id = ?`)
  .bind(user.id)
  .first<{ app_view: string }>()

const appView = (settingsRow?.app_view ?? 'ORCHARD') as 'ORCHARD' | 'CLEAN'
```

- [ ] **Step 2: Detect graduation by comparing to previous login**

```typescript
const prevLogin = await env.DB
  .prepare(
    `SELECT app_view FROM child_logins WHERE child_id = ? ORDER BY logged_at DESC LIMIT 1`
  )
  .bind(user.id)
  .first<{ app_view: string | null }>()

const prevAppView = prevLogin?.app_view ?? 'ORCHARD'
const graduationPending = prevAppView === 'ORCHARD' && appView === 'CLEAN'
```

- [ ] **Step 3: Update the `env.DB.batch` INSERT to include `app_view`**

```typescript
await env.DB.batch([
  env.DB.prepare(
    `INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address, user_agent)
     VALUES (?,?,?,'child',?,?,?,?)`
  ).bind(jti, user.id, family_id, now, now + CHILD_JWT_EXPIRY, ip, ua),
  env.DB.prepare(
    `INSERT INTO child_logins (child_id, logged_at, ip_address, user_agent, session_jti, app_view)
     VALUES (?,?,?,?,?,?)`
  ).bind(user.id, now, ip, ua, jti, appView),
])
```

- [ ] **Step 4: Include `graduation_pending` in the login response**

```typescript
return json({ token, graduation_pending: graduationPending })
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit 2>&1 | grep "auth"
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(worker): emit graduation_pending and store app_view snapshot on child login"
```

---

## Task 5: Worker — new `/api/chat` child-mentor endpoint

**Files:**
- Create: `worker/src/routes/chat.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Create `worker/src/routes/chat.ts`**

```typescript
import type { AuthedRequest, Env } from '../types.js'
import { json } from '../lib/response.js'

const ORCHARD_SYSTEM = `You are The Head Orchardist — a warm, encouraging, narrative-driven financial mentor for children aged 6–12.
Use only nature and harvest metaphors:
- Money → "seeds" or "harvest"
- Savings goal → "a tree you are growing"
- Spending → "harvesting fruit"
- Balance → "your grove"
- Allowance → "rainfall"
Keep responses to 2–4 sentences. Be celebratory and age-appropriate.
Never use financial jargon. End with a gentle encouragement.`

const CLEAN_SYSTEM = `You are The High-Integrity Mentor — a direct, analytical, professional financial coach for young adults aged 12+.
Use standard financial terminology:
- Money → "balance" or "funds"
- Savings goal → "savings target"
- Spending → "expenditure" or "transaction"
- Allowance → "regular income"
Keep responses to 2–4 sentences. Be concise, factual, and goal-oriented.
Avoid infantilising language. Focus on financial reasoning and outcomes.`

interface ChatBody {
  message: string
}

export async function handleChildChat(
  request: AuthedRequest,
  env: Env,
): Promise<Response> {
  if (request.auth.role !== 'child') {
    return json({ error: 'Child auth required' }, { status: 403 })
  }

  const body = await request.json() as ChatBody
  if (!body?.message?.trim()) {
    return json({ error: 'message is required' }, { status: 400 })
  }

  const settings = await env.DB
    .prepare(`SELECT app_view FROM user_settings WHERE user_id = ?`)
    .bind(request.auth.sub)
    .first<{ app_view: string }>()

  const appView = settings?.app_view ?? 'ORCHARD'
  const systemPrompt = appView === 'CLEAN' ? CLEAN_SYSTEM : ORCHARD_SYSTEM

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: body.message.slice(0, 500) },
      ],
    })
    clearTimeout(timeout)
    const reply = (aiResponse as { response?: string }).response?.trim()
      ?? 'I need a moment — try again shortly.'
    return json({ reply, app_view: appView })
  } catch {
    clearTimeout(timeout)
    const fallback = appView === 'CLEAN'
      ? 'I am currently unavailable. Please check back shortly.'
      : 'The orchard is quiet right now — come back in a moment!'
    return json({ reply: fallback, app_view: appView })
  }
}
```

- [ ] **Step 2: Register the route in `worker/src/index.ts`**

Add the import near the other route imports:

```typescript
import { handleChildChat } from './routes/chat.js'
```

Add the route matcher before the 404 fallback:

```typescript
if (path === '/api/chat' && method === 'POST') {
  return withAuth(request, auth, env, (req, e) => handleChildChat(req, e))
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit 2>&1 | grep -E "chat|index"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/chat.ts worker/src/index.ts
git commit -m "feat(worker): add /api/chat child-mentor endpoint with app_view system prompt injection"
```

---

## Task 6: Frontend — `useAppView` hook and API layer

**Files:**
- Modify: `app/src/lib/useTone.ts`
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Update `app/src/lib/useTone.ts`**

Replace the entire file:

```typescript
/**
 * useAppView — returns app-view-appropriate copy based on the child's
 * app_view setting ('ORCHARD' | 'CLEAN'), and locale-aware terminology.
 *
 * app_view = 'ORCHARD' (default): nature metaphors, playful icons
 * app_view = 'CLEAN':             standard financial terms, minimal icons
 *
 * Usage:
 *   const view = useAppView('ORCHARD')
 *   view.balance   → "Your Harvest"  |  "Total Balance"
 *
 * useTone() is a legacy alias accepting the old teen_mode number — kept so
 * parent-side callers don't break during migration. Remove once all callers
 * are updated.
 */

import { useLocale, type AppLocale } from './locale'

export type AppView = 'ORCHARD' | 'CLEAN'

export interface Terminology {
  money:          string
  allowanceLabel: string
}

export interface ViewCopy {
  isChild:       boolean
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
  terminology:   Terminology
}

// Keep Tone as an alias so existing imports don't break
export type Tone = ViewCopy

const ORCHARD_BASE = {
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

const CLEAN_BASE = {
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
  return { money: 'pocket money', allowanceLabel: 'Pocket money' }
}

export function useAppView(appView: AppView | string | undefined): ViewCopy {
  const { locale } = useLocale()
  const terminology = buildTerminology(locale)
  const base = appView === 'CLEAN' ? CLEAN_BASE : ORCHARD_BASE
  return { ...base, terminology }
}

/** Legacy alias — accepts old teen_mode number. Remove once all callers updated. */
export function useTone(teenMode: number | boolean | undefined): ViewCopy {
  return useAppView(teenMode ? 'CLEAN' : 'ORCHARD')
}
```

- [ ] **Step 2: Update `app/src/lib/api.ts`**

Find and replace the four settings functions:

```typescript
export async function getSettings(): Promise<{ avatar_id: string; theme: string; locale: string; app_view: string }> {
  return apiFetch('/api/settings')
}

export async function updateSettings(body: { avatar_id?: string; theme?: string; locale?: string }): Promise<void> {
  return apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(body) })
}

export async function getChildSettings(child_id: string): Promise<{ avatar_id: string; theme: string; locale: string; app_view: string }> {
  return apiFetch(`/api/child/${child_id}/settings`)
}

export async function updateChildSettings(child_id: string, body: { app_view?: string }): Promise<void> {
  return apiFetch(`/api/child/${child_id}/settings`, { method: 'PATCH', body: JSON.stringify(body) })
}
```

- [ ] **Step 3: Build check**

```bash
cd app && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/useTone.ts app/src/lib/api.ts
git commit -m "feat(frontend): add useAppView hook, AppView type, update API layer to app_view"
```

---

## Task 7: Frontend — update `ChildDashboard`, `App.tsx`, `theme.tsx`

**Files:**
- Modify: `app/src/screens/ChildDashboard.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/lib/theme.tsx`

- [ ] **Step 1: Update `ChildDashboard.tsx` — state**

```typescript
// Replace:
// const [teenMode, setTeenMode] = useState(0)
const [appView, setAppView] = useState<'ORCHARD' | 'CLEAN'>('ORCHARD')
```

- [ ] **Step 2: Update `ChildDashboard.tsx` — data loader**

Find the section in the settings-fetch `useEffect` that reads `teen_mode` and replace:

```typescript
// Was:
// const tm = s.teen_mode ?? 0
// setTeenMode(tm)
// try { localStorage.setItem('mc_teen_mode', String(tm)) } catch { }

const av = (s.app_view ?? 'ORCHARD') as 'ORCHARD' | 'CLEAN'
setAppView(av)
try { localStorage.setItem('mc_app_view', av) } catch { /* ignore */ }

// graduation_pending comes from the login API response (stored in localStorage by ChildLoginScreen)
// ChildDashboard doesn't need to set mc_graduation_pending — the auth.ts worker response
// triggers it; the frontend login handler sets it. See Task 8 (GraduationOverlay).
```

- [ ] **Step 3: Update `ChildDashboard.tsx` — hook call and props**

```typescript
// Was: const tone = useTone(teenMode)
import { useAppView } from '../lib/useTone'
const tone = useAppView(appView)

// Any prop passed as teenMode={teenMode} → appView={appView}
// Any prop typed as teenMode: number → appView: 'ORCHARD' | 'CLEAN'
```

Search the file for every remaining `teenMode` occurrence and rename to `appView`.

- [ ] **Step 4: Update `App.tsx`**

```typescript
// Was:
// const storedTeenMode = parseInt(localStorage.getItem('mc_teen_mode') ?? '0', 10)
// <ThemeProvider teenMode={storedTeenMode}>

const storedAppView = localStorage.getItem('mc_app_view') ?? 'ORCHARD'
// ...
<ThemeProvider appView={storedAppView}>
```

- [ ] **Step 5: Update `app/src/lib/theme.tsx`**

Find the `ThemeProviderProps` interface and `ThemeProvider` function and replace the `teenMode` parameter:

```typescript
interface ThemeProviderProps {
  children: React.ReactNode
  appView?: string
}

export function ThemeProvider({ children, appView = 'ORCHARD' }: ThemeProviderProps) {
  const isClean = appView === 'CLEAN'

  function resolve(preference: ThemePreference): ResolvedTheme {
    if (preference === 'dark')  return 'dark'
    if (preference === 'light') return 'light'
    return (systemPrefersDark() || isClean) ? 'dark' : 'light'
  }
  // ... rest of provider body unchanged, replace all isTeen → isClean
}
```

- [ ] **Step 6: Build check**

```bash
cd app && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 7: Commit**

```bash
git add app/src/screens/ChildDashboard.tsx app/src/App.tsx app/src/lib/theme.tsx
git commit -m "feat(frontend): migrate ChildDashboard and ThemeProvider from teen_mode to app_view"
```

---

## Task 8: Frontend — CelebrationEngine library + Graduation achievement

**Files:**
- Create: `app/src/components/celebration/types.ts`
- Create: `app/src/components/celebration/MilestoneOverlay.tsx`
- Create: `app/src/components/celebration/achievements/graduation.ts`
- Create: `app/src/components/celebration/index.ts`
- Modify: `app/src/screens/ChildDashboard.tsx`

### Design

The engine is data-driven. Each milestone is a config object (`MilestoneConfig`) that describes its stages — emoji, heading, body, attribution, colours, and duration. `MilestoneOverlay` is a generic renderer that sequences through those stages. Adding a new celebration type (e.g. `GOAL_COMPLETED`) means adding a new config file — zero changes to the engine.

Orchard view gets warm nature colours and a shimmer gradient between stages. Clean view gets a dark professional palette and a sharp horizontal wipe.

- [ ] **Step 1: Create `app/src/components/celebration/types.ts`**

```typescript
import type { AppView } from '../../lib/useTone'

/** A single stage within a milestone sequence. */
export interface MilestoneStage {
  /** Emoji or single character shown large above the heading. */
  icon:        string
  heading:     string
  body:        string
  /** Small italic attribution line below body. Optional. */
  attribution?: string
  /** Tailwind text-color class for the heading. e.g. 'text-emerald-300' */
  headingColor: string
  /** Tailwind text-color class for the body. e.g. 'text-emerald-200/70' */
  bodyColor:    string
  /** How long this stage is visible before transitioning to the next (ms). */
  durationMs:   number
}

/** Full config for one milestone type, split by app_view. */
export interface MilestoneConfig {
  /** Unique key used to read/write localStorage flags. e.g. 'graduation' */
  key:          string
  /** Background colour for the overlay. Tailwind bg-* class or CSS value. */
  bgColor:      string
  /** Stages shown in order. Must have at least one. */
  orchard:      MilestoneStage[]
  clean:        MilestoneStage[]
  /** Transition style between stages. */
  transition:   'shimmer' | 'wipe'
}

/** All supported milestone event types. Add new values here as features grow. */
export type MilestoneEventType =
  | 'GRADUATION'
  | 'PAYDAY_REACHED'
  | 'GOAL_COMPLETED'

/** Passed to MilestoneOverlay to trigger a celebration. */
export interface MilestoneEvent {
  type:    MilestoneEventType
  appView: AppView
}
```

- [ ] **Step 2: Create `app/src/components/celebration/achievements/graduation.ts`**

```typescript
import type { MilestoneConfig } from '../types'

export const GRADUATION: MilestoneConfig = {
  key:      'graduation',
  bgColor:  '#0f1a14',
  transition: 'shimmer',

  orchard: [
    {
      icon:         '🌳',
      heading:      "You've mastered the Harvest.",
      body:         '"Every seed you planted, every drop of rainfall you saved — it brought you here. You\'re ready for something bigger."',
      attribution:  '— The Head Orchardist',
      headingColor: 'text-emerald-300',
      bodyColor:    'text-emerald-200/70',
      durationMs:   3000,
    },
    {
      icon:         '📊',
      heading:      'Welcome to your Professional Ledger.',
      body:         '"Your financial journey starts now. Track your balance, set targets, and build real wealth habits."',
      attribution:  '— The High-Integrity Mentor',
      headingColor: 'text-white',
      bodyColor:    'text-white/60',
      durationMs:   3500,
    },
  ],

  clean: [
    {
      icon:         '📈',
      heading:      'Account Upgraded.',
      body:         'Your account has been upgraded to Professional View. You now have access to full financial analytics and detailed transaction history.',
      attribution:  '— The High-Integrity Mentor',
      headingColor: 'text-white',
      bodyColor:    'text-white/60',
      durationMs:   4000,
    },
  ],
}
```

- [ ] **Step 3: Create `app/src/components/celebration/MilestoneOverlay.tsx`**

```tsx
/**
 * MilestoneOverlay — CelebrationEngine base renderer.
 *
 * Sequences through MilestoneConfig stages with timed transitions.
 * Supports two transition styles:
 *   shimmer — warm gradient pulse between stages (Orchard)
 *   wipe    — sharp horizontal clip transition (Clean)
 *
 * Usage:
 *   <MilestoneOverlay event={{ type: 'GRADUATION', appView: 'ORCHARD' }} onComplete={fn} />
 */

import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneConfig, MilestoneEvent } from './types'
import { GRADUATION } from './achievements/graduation'

// Registry — add new MilestoneConfig imports here as features grow.
const CONFIGS: Record<string, MilestoneConfig> = {
  GRADUATION,
}

interface Props {
  event:      MilestoneEvent
  onComplete: () => void
}

type Phase = 'stage' | 'transition' | 'exit'

export function MilestoneOverlay({ event, onComplete }: Props) {
  const config   = CONFIGS[event.type]
  const stages   = event.appView === 'CLEAN' ? config.clean : config.orchard
  const isShimmer = config.transition === 'shimmer'

  const [stageIdx,   setStageIdx]   = useState(0)
  const [phase,      setPhase]      = useState<Phase>('stage')
  const [visible,    setVisible]    = useState(true)

  useEffect(() => {
    if (!config) { onComplete(); return }

    const current = stages[stageIdx]

    // After the stage duration, enter the transition phase (shimmer/wipe)
    const tTransition = setTimeout(() => {
      if (stageIdx < stages.length - 1) {
        setPhase('transition')
        // After 1.5s transition, advance to next stage
        setTimeout(() => {
          setStageIdx(i => i + 1)
          setPhase('stage')
        }, 1500)
      } else {
        // Last stage — begin exit
        setPhase('exit')
        setVisible(false)
        setTimeout(onComplete, 600)
      }
    }, current.durationMs)

    return () => clearTimeout(tTransition)
  }, [stageIdx, stages, config, onComplete])

  if (!config) return null

  const current = stages[stageIdx]

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center',
        'transition-opacity duration-[600ms]',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      style={{ backgroundColor: config.bgColor }}
    >
      {/* Shimmer transition overlay */}
      {isShimmer && phase === 'transition' && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-amber-400/10 to-blue-500/20 animate-pulse pointer-events-none transition-opacity duration-300" />
      )}

      {/* Wipe transition overlay */}
      {!isShimmer && phase === 'transition' && (
        <div className="absolute inset-0 bg-white/5 pointer-events-none transition-all duration-[1500ms]" />
      )}

      {/* Transition spinner */}
      {phase === 'transition' && (
        <div className="absolute text-5xl animate-spin pointer-events-none" style={{ animationDuration: '2s' }}>
          {isShimmer ? '✦' : '◈'}
        </div>
      )}

      {/* Stage content */}
      <div className={cn(
        'text-center px-8 max-w-sm transition-all duration-700',
        phase === 'stage' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 scale-95 pointer-events-none',
      )}>
        <div className="text-6xl mb-6">{current.icon}</div>
        <p className={cn('text-[22px] font-bold leading-snug mb-3', current.headingColor)}>
          {current.heading}
        </p>
        <p className={cn('text-[15px] leading-relaxed', current.bodyColor)}>
          {current.body}
        </p>
        {current.attribution && (
          <p className="text-[12px] text-white/30 mt-4 italic">{current.attribution}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/src/components/celebration/index.ts`**

```typescript
export type { MilestoneConfig, MilestoneEvent, MilestoneEventType, MilestoneStage } from './types'
export { MilestoneOverlay } from './MilestoneOverlay'
export { GRADUATION } from './achievements/graduation'

/**
 * consumeMilestonePending
 *
 * Reads and clears a pending milestone flag from localStorage.
 * Returns the MilestoneEventType string if one is pending, otherwise null.
 *
 * Convention: flags are stored as `mc_milestone_<type>` e.g. `mc_milestone_graduation`.
 */
export function consumeMilestonePending(type: string): boolean {
  const key = `mc_milestone_${type.toLowerCase()}`
  try {
    const pending = localStorage.getItem(key) === '1'
    if (pending) localStorage.removeItem(key)
    return pending
  } catch {
    return false
  }
}

/**
 * setPendingMilestone
 *
 * Writes a pending milestone flag to localStorage.
 * Call this in the login response handler when the API returns a milestone trigger.
 */
export function setPendingMilestone(type: string): void {
  const key = `mc_milestone_${type.toLowerCase()}`
  try { localStorage.setItem(key, '1') } catch { /* ignore */ }
}
```

- [ ] **Step 5: Write the login handler flag**

Find where the child login API response is processed (the screen calling `POST /auth/child/login`). After receiving the response, add:

```typescript
import { setPendingMilestone } from '../components/celebration'

// After successful login:
if (response.graduation_pending) {
  setPendingMilestone('GRADUATION')
}
```

- [ ] **Step 6: Mount in `ChildDashboard.tsx`**

Add import:

```tsx
import { MilestoneOverlay, consumeMilestonePending } from '../components/celebration'
import type { MilestoneEvent } from '../components/celebration'
```

Add state (lazy initialiser — reads + clears flag on first render):

```tsx
const [milestone, setMilestone] = useState<MilestoneEvent | null>(() =>
  consumeMilestonePending('GRADUATION')
    ? { type: 'GRADUATION', appView: appView as 'ORCHARD' | 'CLEAN' }
    : null
)
```

Add to JSX before the main dashboard content:

```tsx
{milestone && (
  <MilestoneOverlay event={milestone} onComplete={() => setMilestone(null)} />
)}
```

- [ ] **Step 7: Build check**

```bash
cd app && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 8: Commit**

```bash
git add app/src/components/celebration/ app/src/screens/ChildDashboard.tsx
git commit -m "feat(ui): CelebrationEngine — MilestoneOverlay base + GRADUATION achievement"
```

---

### How to add a new celebration later

1. Create `app/src/components/celebration/achievements/goalCompleted.ts` with a `GOAL_COMPLETED: MilestoneConfig`
2. Import it in `MilestoneOverlay.tsx` and add to the `CONFIGS` registry
3. Export it from `index.ts`
4. Call `setPendingMilestone('GOAL_COMPLETED')` wherever the trigger fires
5. Check `consumeMilestonePending('GOAL_COMPLETED')` in the relevant screen

No changes to the engine itself.

---

## Task 9: Frontend — App View toggle in `ChildProfileSettings`

**Files:**
- Modify: `app/src/components/settings/sections/ChildProfileSettings.tsx`
- Modify: `app/src/components/settings/sections/FamilySettings.tsx`
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

- [ ] **Step 1: Update `ChildProfileSettings.tsx` Props**

Replace the teen mode props with app view equivalents:

```typescript
interface Props {
  child:            ChildRecord
  appView:          'ORCHARD' | 'CLEAN'   // was: isTeen
  appViewBusy:      boolean               // was: isBusy
  growth:           ChildGrowthSettings | undefined
  growthBusy:       string | null
  isLead:           boolean
  onAppViewToggle:  (childId: string, next: 'ORCHARD' | 'CLEAN') => void  // was: onTeenModeToggle
  onGrowthUpdate:   (childId: string, patch: Partial<Pick<ChildGrowthSettings, 'earnings_mode' | 'allowance_amount' | 'allowance_frequency'>>) => void
  onRenameChild:    (childId: string, newName: string) => void
  onPinResetSuccess: () => void
  onComingSoon:     () => void
  onBack:           () => void
}
```

Update the destructure:

```typescript
export function ChildProfileSettings({
  child, appView, appViewBusy, growth, growthBusy, isLead,
  onAppViewToggle, onGrowthUpdate, onRenameChild, onPinResetSuccess, onComingSoon, onBack,
}: Props) {
```

- [ ] **Step 2: Replace the Experience Level Coming Soon row with the App View selector**

In the Rules & Experience `SectionCard`, replace:

```tsx
<SettingsRow icon={<TreePine size={15} />} label="Experience Level" description="Seedling View (under 12) or Professional View (12+)" onClick={onComingSoon} />
```

With:

```tsx
{/* App View — two-option selector */}
<div className="px-4 py-3.5 border-b border-[var(--color-border)]">
  <div className="flex items-center gap-3 mb-3">
    <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
      <TreePine size={15} />
    </span>
    <div>
      <p className="text-[14px] font-semibold text-[var(--color-text)]">App View</p>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
        {appView === 'ORCHARD' ? 'Orchard View — nature metaphors' : 'Clean View — professional terms'}
      </p>
    </div>
  </div>
  <div className="grid grid-cols-2 gap-2">
    {(['ORCHARD', 'CLEAN'] as const).map(v => (
      <button
        key={v}
        type="button"
        disabled={appViewBusy}
        onClick={() => { if (appView !== v) onAppViewToggle(child.id, v) }}
        className={cn(
          'py-2.5 rounded-xl border text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50',
          appView === v
            ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] text-[var(--brand-primary)]'
            : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)]',
        )}
      >
        {v === 'ORCHARD' ? '🌳 Orchard' : '📊 Clean'}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Update `FamilySettings.tsx` Props**

```typescript
interface Props {
  children:          ChildRecord[]
  appViews:          Record<string, 'ORCHARD' | 'CLEAN'>   // was: teenModes
  appViewBusy:       string | null                          // was: teenModeBusy
  growthSettings:    Record<string, ChildGrowthSettings>
  growthBusy:        string | null
  isLead:            boolean
  toast:             string | null
  onBack:            () => void
  onComingSoon:      () => void
  onAddChild:        (name: string) => Promise<{ child_id: string; invite_code: string }>
  onAppViewToggle:   (childId: string, next: 'ORCHARD' | 'CLEAN') => void  // was: onTeenModeToggle
  onGrowthUpdate:    (childId: string, patch: Partial<Pick<ChildGrowthSettings, 'earnings_mode' | 'allowance_amount' | 'allowance_frequency'>>) => void
  onRenameChild:     (childId: string, newName: string) => void
  onPinResetSuccess: () => void
  onGenerateInvite:  () => Promise<{ code: string; expires_at: number }>
}
```

Update destructure and `ChildProfileSettings` call:

```typescript
export function FamilySettings({
  children, appViews, appViewBusy, growthSettings, growthBusy,
  isLead, toast, onBack, onComingSoon,
  onAddChild, onAppViewToggle, onGrowthUpdate, onRenameChild, onPinResetSuccess, onGenerateInvite,
}: Props) {
```

```tsx
<ChildProfileSettings
  child={activeChild}
  appView={appViews[activeChild.id] ?? 'ORCHARD'}
  appViewBusy={appViewBusy === activeChild.id}
  growth={growthSettings[activeChild.id]}
  growthBusy={growthBusy}
  isLead={isLead}
  onAppViewToggle={onAppViewToggle}
  onGrowthUpdate={onGrowthUpdate}
  onRenameChild={onRenameChild}
  onPinResetSuccess={onPinResetSuccess}
  onComingSoon={onComingSoon}
  onBack={() => setActiveChildId(null)}
/>
```

- [ ] **Step 4: Update `ParentSettingsTab.tsx` — state**

```typescript
// Replace:
// const [teenModes,    setTeenModes]    = useState<Record<string, number>>({})
// const [teenModeBusy, setTeenModeBusy] = useState<string | null>(null)

const [appViews,    setAppViews]    = useState<Record<string, 'ORCHARD' | 'CLEAN'>>({})
const [appViewBusy, setAppViewBusy] = useState<string | null>(null)
```

- [ ] **Step 5: Update `ParentSettingsTab.tsx` — data loader**

```typescript
// In the load() function, replace the getChildSettings fetch:
const views = await Promise.all(
  c.map(child =>
    getChildSettings(child.id)
      .then(cs => [child.id, (cs.app_view ?? 'ORCHARD') as 'ORCHARD' | 'CLEAN'] as const)
      .catch(() => [child.id, 'ORCHARD' as const] as const)
  )
)
setAppViews(Object.fromEntries(views))
```

- [ ] **Step 6: Update `ParentSettingsTab.tsx` — handler**

```typescript
// Replace handleTeenModeToggle:
async function handleAppViewToggle(childId: string, next: 'ORCHARD' | 'CLEAN') {
  setAppViewBusy(childId)
  try {
    await updateChildSettings(childId, { app_view: next })
    setAppViews(prev => ({ ...prev, [childId]: next }))
    track.uiStyleChanged({ style: next === 'CLEAN' ? 'professional' : 'orchard', child_id: childId })
  } finally {
    setAppViewBusy(null)
  }
}
```

- [ ] **Step 7: Update `ParentSettingsTab.tsx` — FamilySettings JSX**

```tsx
<FamilySettings
  children={children}
  appViews={appViews}
  appViewBusy={appViewBusy}
  growthSettings={growthSettings}
  growthBusy={growthBusy}
  isLead={isLead}
  toast={toast}
  onBack={back}
  onComingSoon={comingSoon}
  onAddChild={handleAddChild}
  onAppViewToggle={handleAppViewToggle}
  onGrowthUpdate={handleGrowthUpdate}
  onRenameChild={handleRenameChild}
  onPinResetSuccess={handlePinResetSuccess}
  onGenerateInvite={handleGenerateInvite}
/>
```

- [ ] **Step 8: Full build**

```bash
cd app && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` — zero TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add app/src/components/settings/sections/ChildProfileSettings.tsx \
        app/src/components/settings/sections/FamilySettings.tsx \
        app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(ui): wire App View two-option selector in ChildProfileSettings"
```

---

## Task 10: Production deployment

- [ ] **Step 1: Apply migrations to production D1**

```bash
npx wrangler d1 migrations apply morechard-db --remote
```

Expected: migrations 0025 and 0026 both applied.

- [ ] **Step 2: Deploy worker**

```bash
npx wrangler deploy
```

- [ ] **Step 3: Push frontend (triggers Cloudflare Pages auto-deploy)**

```bash
git push origin main
```

- [ ] **Step 4: Smoke test checklist**

1. Parent login → Manage Family → tap a child → Rules & Experience
2. Confirm "App View" selector shows 🌳 Orchard / 📊 Clean, with current value highlighted
3. Toggle to Clean → network tab shows PATCH returning 200
4. Child logs in → GraduationOverlay appears, runs full 8s sequence, auto-dismisses
5. Child logs in again → GraduationOverlay does NOT appear
6. Child dashboard shows "My Account" / "Total balance" (Clean copy)
7. Toggle back to Orchard via parent settings
8. Child logs in → no GraduationOverlay (downgrade is silent)
9. Child dashboard shows "The Orchard" / "Your harvest" (Orchard copy)

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| `app_view` ENUM replacing `teen_mode` | Tasks 1, 3 |
| Per-child, independent | Task 1 (column on `user_settings`, child-scoped) |
| Worker settings route updated | Task 3 |
| `app_view` snapshot in `child_logins` | Task 2 + Task 4 |
| `graduation_pending` flag from worker | Task 4 |
| `/api/chat` with Head Orchardist / High-Integrity Mentor prompts | Task 5 |
| `useAppView` hook (replaces `useTone`, legacy alias kept) | Task 6 |
| `ChildDashboard` + `ThemeProvider` migrated | Task 7 |
| CelebrationEngine: `types.ts`, `MilestoneOverlay`, `graduation.ts`, barrel export | Task 8 |
| Parent App View two-option selector (live, not Coming Soon) | Task 9 |
| `FamilySettings` + `ParentSettingsTab` prop chain updated | Task 9 |
| Production deploy + smoke test | Task 10 |

**No placeholders detected.**

**Type consistency:**
- `AppView = 'ORCHARD' | 'CLEAN'` defined in Task 6, used as literal strings in Tasks 7–9 ✓
- `appViews: Record<string, 'ORCHARD' | 'CLEAN'>` flows `ParentSettingsTab` → `FamilySettings` → `ChildProfileSettings` with consistent key type ✓
- `onAppViewToggle(childId: string, next: 'ORCHARD' | 'CLEAN')` consistent across all three components ✓
- `consumeGraduationPending()` defined and used in Task 8 ✓
- `appViewBusy: string | null` in `ParentSettingsTab`/`FamilySettings`, narrowed to `boolean` (`appViewBusy === activeChild.id`) before passing to `ChildProfileSettings` ✓
