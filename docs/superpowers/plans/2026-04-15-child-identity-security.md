# Child Identity & Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three Identity & Security actions in the Manage Family > Child sub-menu: rename child, reset child PIN, and view child login history.

**Architecture:** DB migration adds `user_agent` + `session_jti` columns to `child_logins`; worker gains two new settings routes plus logs every child login; the React settings tree gains two inline sheets (DisplayName, ResetPin) and a new `ChildLoginHistory` sub-screen, all wired through `ChildProfileSettings` → `FamilySettings` → `ParentSettingsTab`.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (TypeScript), React + Tailwind, Lucide icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `worker/migrations/0024_child_logins_columns.sql` | Create | Add `user_agent` + `session_jti` to `child_logins` |
| `worker/src/routes/auth.ts` | Modify | INSERT into `child_logins` on every successful child login |
| `worker/src/routes/settings.ts` | Modify | Add `PATCH /api/child/:id/display-name` + `GET /api/child/:id/login-history` |
| `worker/src/index.ts` | Modify | Wire both new routes; import new handlers |
| `app/src/lib/api.ts` | Modify | Add `renameChild()` + `getChildLoginHistory()` + `LoginEntry` type |
| `app/src/components/settings/sections/ChildProfileSettings.tsx` | Modify | Add `activeView` routing; wire 3 Identity rows; embed DisplayNameSheet + ResetPinSheet |
| `app/src/components/settings/sections/ChildLoginHistory.tsx` | Create | Login history sub-screen component |
| `app/src/components/settings/sections/FamilySettings.tsx` | Modify | Pass `onRenameChild` callback through to `ChildProfileSettings` |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Modify | Implement `handleRenameChild`; pass to `FamilySettings` |

---

## Task 1: DB Migration — add columns to `child_logins`

**Files:**
- Create: `worker/migrations/0024_child_logins_columns.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 0024: Add user_agent and session_jti to child_logins
--
-- user_agent   — raw UA string captured at child login time
-- session_jti  — FK to sessions.jti; used to determine is_current (active session check)

ALTER TABLE child_logins ADD COLUMN user_agent  TEXT;
ALTER TABLE child_logins ADD COLUMN session_jti TEXT REFERENCES sessions(jti);
```

- [ ] **Step 2: Apply locally**

```bash
cd "worker"
npx wrangler d1 migrations apply morechard-d1 --local
```

Expected output: `✅  Migration 0024_child_logins_columns.sql applied`

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0024_child_logins_columns.sql
git commit -m "feat(db): add user_agent + session_jti to child_logins"
```

---

## Task 2: Worker — log child logins into `child_logins`

**Files:**
- Modify: `worker/src/routes/auth.ts` (around line 316 — after the `INSERT INTO sessions` statement in `handleChildLogin`)

- [ ] **Step 1: Add the INSERT after the session INSERT in `handleChildLogin`**

Find the block that starts at line ~316:
```typescript
  await env.DB
    .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address)
              VALUES (?,?,?,'child',?,?,?)`)
    .bind(jti, user.id, family_id, now, now + CHILD_JWT_EXPIRY, ip)
    .run();
```

Replace it with:

```typescript
  const ua = request.headers.get('User-Agent') ?? null;

  await env.DB.batch([
    env.DB
      .prepare(`INSERT INTO sessions (jti, user_id, family_id, role, issued_at, expires_at, ip_address, user_agent)
                VALUES (?,?,?,'child',?,?,?,?)`)
      .bind(jti, user.id, family_id, now, now + CHILD_JWT_EXPIRY, ip, ua),
    env.DB
      .prepare(`INSERT INTO child_logins (child_id, logged_at, ip_address, user_agent, session_jti)
                VALUES (?,?,?,?,?)`)
      .bind(user.id, now, ip, ua, jti),
  ]);
```

- [ ] **Step 2: Verify the worker builds**

```bash
cd worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(auth): log child logins into child_logins table"
```

---

## Task 3: Worker — `PATCH /api/child/:id/display-name`

**Files:**
- Modify: `worker/src/routes/settings.ts` (add handler at end of file)

- [ ] **Step 1: Add `handleChildRename` to `settings.ts`**

Add this function at the end of `worker/src/routes/settings.ts`:

```typescript
// ----------------------------------------------------------------
// PATCH /api/child/:child_id/display-name
// Parent renames a child. Caller must share the same family_id.
// Body: { display_name: string }
// ----------------------------------------------------------------
export async function handleChildRename(
  request: Request,
  env: Env,
  childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can rename children', 403);

  let body: { display_name?: unknown };
  try { body = await request.json() as { display_name?: unknown }; }
  catch { return error('Invalid JSON body'); }

  const raw = body.display_name;
  if (!raw || typeof raw !== 'string') return error('display_name required');
  const display_name = raw.trim();
  if (!display_name)            return error('display_name cannot be empty');
  if (display_name.length > 40) return error('display_name too long (max 40 chars)');

  // Verify child belongs to the same family as caller
  const child = await env.DB
    .prepare(`SELECT u.id FROM users u
              JOIN family_roles fr ON fr.user_id = u.id
              WHERE u.id = ? AND fr.family_id = ? AND fr.role = 'child'`)
    .bind(childId, auth.family_id)
    .first<{ id: string }>();
  if (!child) return error('Child not found', 404);

  await env.DB
    .prepare('UPDATE users SET display_name = ? WHERE id = ?')
    .bind(display_name, childId)
    .run();

  return json({ ok: true, display_name });
}
```

- [ ] **Step 2: Verify build**

```bash
cd worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/settings.ts
git commit -m "feat(api): PATCH /api/child/:id/display-name"
```

---

## Task 4: Worker — UA parsing utility + `GET /api/child/:id/login-history`

**Files:**
- Modify: `worker/src/routes/settings.ts` (add UA helper + history handler)

- [ ] **Step 1: Add the UA parser and `handleChildLoginHistory` to `settings.ts`**

Add after `handleChildRename`:

```typescript
// ----------------------------------------------------------------
// UA parsing — pure string matching, no library dependency
// Returns { device_label, device_type }
// device_type: 'mobile' | 'tablet' | 'desktop'
// ----------------------------------------------------------------
function parseUserAgent(ua: string | null): { device_label: string; device_type: 'mobile' | 'tablet' | 'desktop' } {
  if (!ua) return { device_label: 'Unknown Device', device_type: 'desktop' };

  const s = ua.toLowerCase();

  // Detect device base
  let base: string;
  let type: 'mobile' | 'tablet' | 'desktop';

  if (s.includes('ipad')) {
    base = 'iPad'; type = 'tablet';
  } else if (s.includes('android') && (s.includes('tablet') || s.includes('tab'))) {
    base = 'Android Tablet'; type = 'tablet';
  } else if (s.includes('iphone')) {
    base = 'iPhone'; type = 'mobile';
  } else if (s.includes('android')) {
    base = 'Android Phone'; type = 'mobile';
  } else if (s.includes('cros')) {
    base = 'Chromebook'; type = 'desktop';
  } else if (s.includes('windows')) {
    base = 'Windows PC'; type = 'desktop';
  } else if (s.includes('macintosh') || s.includes('mac os x')) {
    base = 'Mac'; type = 'desktop';
  } else if (s.includes('linux')) {
    base = 'Linux PC'; type = 'desktop';
  } else {
    return { device_label: 'Unknown Device', device_type: 'desktop' };
  }

  // Detect browser — order matters (Edge contains "chrome", so check Edge first)
  let browser: string | null = null;
  if (s.includes('edg/') || s.includes('edge/'))  browser = 'Edge';
  else if (s.includes('firefox/'))                 browser = 'Firefox';
  else if (s.includes('chrome/'))                  browser = 'Chrome';
  else if (s.includes('safari/'))                  browser = 'Safari';

  const device_label = browser ? `${base} · ${browser}` : base;
  return { device_label, device_type: type };
}

// ----------------------------------------------------------------
// GET /api/child/:child_id/login-history
// Parent views a child's recent logins. Returns last 50, newest first.
// Response: { logins: LoginEntry[] }
// ----------------------------------------------------------------
export async function handleChildLoginHistory(
  request: Request,
  env: Env,
  childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'parent') return error('Only parents can view login history', 403);

  // Verify child belongs to same family
  const child = await env.DB
    .prepare(`SELECT u.id FROM users u
              JOIN family_roles fr ON fr.user_id = u.id
              WHERE u.id = ? AND fr.family_id = ? AND fr.role = 'child'`)
    .bind(childId, auth.family_id)
    .first<{ id: string }>();
  if (!child) return error('Child not found', 404);

  // Fetch last 50 logins; LEFT JOIN sessions to determine is_current
  const { results } = await env.DB
    .prepare(`
      SELECT
        cl.rowid          AS id,
        cl.logged_at,
        cl.ip_address,
        cl.user_agent,
        CASE WHEN s.jti IS NOT NULL THEN 1 ELSE 0 END AS is_current
      FROM child_logins cl
      LEFT JOIN sessions s
        ON s.jti = cl.session_jti
       AND s.user_id = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > strftime('%s','now')
      WHERE cl.child_id = ?
      ORDER BY cl.logged_at DESC
      LIMIT 50
    `)
    .bind(childId, childId)
    .all<{
      id: number;
      logged_at: number;
      ip_address: string | null;
      user_agent: string | null;
      is_current: number;
    }>();

  const logins = results.map(row => {
    const { device_label, device_type } = parseUserAgent(row.user_agent);
    return {
      id:           row.id,
      logged_at:    row.logged_at,
      ip_address:   row.ip_address ?? 'Unknown',
      device_label,
      device_type,
      is_current:   row.is_current === 1,
    };
  });

  return json({ logins });
}
```

- [ ] **Step 2: Verify build**

```bash
cd worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/settings.ts
git commit -m "feat(api): GET /api/child/:id/login-history with UA parsing"
```

---

## Task 5: Worker — wire new routes in `index.ts`

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add imports**

In `worker/src/index.ts`, find the settings import block (lines ~72–78):
```typescript
import {
  handleSettingsGet, handleSettingsUpdate,
  handleFamilyGet, handleFamilyUpdate,
  handleChildrenList,
  handleAccountLock, handleAccountUnlock,
  handleParentMessageSet, handleParentMessageGet,
  handleChildGrowthGet, handleChildGrowthUpdate,
} from './routes/settings.js';
```

Replace with:
```typescript
import {
  handleSettingsGet, handleSettingsUpdate,
  handleFamilyGet, handleFamilyUpdate,
  handleChildrenList,
  handleAccountLock, handleAccountUnlock,
  handleParentMessageSet, handleParentMessageGet,
  handleChildGrowthGet, handleChildGrowthUpdate,
  handleChildRename, handleChildLoginHistory,
} from './routes/settings.js';
```

- [ ] **Step 2: Add routes in the `route()` function**

In `index.ts`, find the `childGrowthMatch` block (around line 322):
```typescript
  const childGrowthMatch = path.match(/^\/api\/child-growth\/([^/]+)$/);
  if (childGrowthMatch && method === 'GET')   return withAuth(request, auth, env, (req, e) => handleChildGrowthGet(req, e, childGrowthMatch[1]));
  if (childGrowthMatch && method === 'PATCH') return withAuth(request, auth, env, (req, e) => handleChildGrowthUpdate(req, e, childGrowthMatch[1]));
```

Add immediately after (before the chores block):
```typescript
  // Child rename + login history (parent only — placed before trial gate intentionally)
  const childIdMatch = path.match(/^\/api\/child\/([^/]+)\/display-name$/);
  if (childIdMatch && method === 'PATCH') return withAuth(request, auth, env, (req, e) => handleChildRename(req, e, childIdMatch[1]));

  const childHistoryMatch = path.match(/^\/api\/child\/([^/]+)\/login-history$/);
  if (childHistoryMatch && method === 'GET') return withAuth(request, auth, env, (req, e) => handleChildLoginHistory(req, e, childHistoryMatch[1]));
```

- [ ] **Step 3: Update the doc comment at the top of `index.ts`**

Find the comment block near line 17:
```typescript
 * POST   /auth/child/set-pin          Set/reset child PIN
```

Add below it:
```typescript
 * PATCH  /api/child/:id/display-name  Rename a child
 * GET    /api/child/:id/login-history Child's login history (last 50)
```

- [ ] **Step 4: Verify build**

```bash
cd worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): wire child rename + login history routes"
```

---

## Task 6: Frontend — API client functions

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add `LoginEntry` type and two API functions**

In `app/src/lib/api.ts`, find the `AddChildResult` block near line 529. Add after the `generateInvite` function (after line ~543):

```typescript
// ----------------------------------------------------------------
// Child identity management
// ----------------------------------------------------------------

export async function renameChild(childId: string, display_name: string): Promise<{ ok: boolean; display_name: string }> {
  return request(`/api/child/${childId}/display-name`, {
    method: 'PATCH',
    body: JSON.stringify({ display_name }),
  });
}

export interface LoginEntry {
  id:           number;
  logged_at:    number;   // unixepoch
  ip_address:   string;
  device_label: string;   // e.g. "iPhone · Safari"
  device_type:  'mobile' | 'tablet' | 'desktop';
  is_current:   boolean;
}

export async function getChildLoginHistory(childId: string): Promise<{ logins: LoginEntry[] }> {
  return request(`/api/child/${childId}/login-history`);
}
```

- [ ] **Step 2: Verify the app builds**

```bash
cd app
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api-client): renameChild + getChildLoginHistory"
```

---

## Task 7: Frontend — `ChildLoginHistory` component

**Files:**
- Create: `app/src/components/settings/sections/ChildLoginHistory.tsx`

- [ ] **Step 1: Create the component**

```tsx
/**
 * ChildLoginHistory — sub-screen showing a child's last 50 logins.
 *
 * Rendered by ChildProfileSettings when activeView === 'login-history'.
 * Groups entries by day; shows device icon, friendly label, relative time, IP.
 * Pulsing green dot on any entry whose session is still active (is_current).
 */

import { useEffect, useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import type { LoginEntry } from '../../../lib/api'
import { getChildLoginHistory } from '../../../lib/api'
import { SectionHeader } from '../shared'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - epoch
  if (diff < 60)          return 'Just now'
  if (diff < 3600)        return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400)       return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 86400 * 7)   return `${Math.floor(diff / 86400)} days ago`
  return new Date(epoch * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dayLabel(epoch: number): string {
  const d = new Date(epoch * 1000)
  const today     = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function groupByDay(logins: LoginEntry[]): { label: string; entries: LoginEntry[] }[] {
  const map = new Map<string, LoginEntry[]>()
  for (const entry of logins) {
    const label = dayLabel(entry.logged_at)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(entry)
  }
  return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }))
}

function DeviceIcon({ type, isCurrent }: { type: LoginEntry['device_type']; isCurrent: boolean }) {
  const Icon = type === 'mobile' ? Smartphone : type === 'tablet' ? Tablet : Monitor
  return (
    <div className="relative shrink-0">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
        <Icon size={15} />
      </span>
      {isCurrent && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse border-2 border-[var(--color-surface)]" />
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-border)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-[var(--color-border)] animate-pulse" />
          </div>
          <div className="h-2.5 w-14 rounded bg-[var(--color-border)] animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  childId:   string
  childName: string
  onBack:    () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChildLoginHistory({ childId, childName, onBack }: Props) {
  const [logins,  setLogins]  = useState<LoginEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    getChildLoginHistory(childId)
      .then(r => setLogins(r.logins))
      .catch(() => setError('Could not load login history.'))
      .finally(() => setLoading(false))
  }, [childId])

  const groups = groupByDay(logins)

  return (
    <div className="space-y-4">
      <SectionHeader title={childName} subtitle="Login History" onBack={onBack} />

      {loading && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <Skeleton />
        </div>
      )}

      {!loading && error && (
        <p className="text-center text-[14px] text-red-500 px-4 py-6">{error}</p>
      )}

      {!loading && !error && logins.length === 0 && (
        <p className="text-center text-[14px] text-[var(--color-text-muted)] px-4 py-8">
          No login history yet — logins will appear here once {childName} signs in.
        </p>
      )}

      {!loading && !error && groups.map(group => (
        <div key={group.label}>
          <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-1 mb-2">
            {group.label}
          </p>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            {group.entries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${idx < group.entries.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <DeviceIcon type={entry.device_type} isCurrent={entry.is_current} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">
                    {entry.device_label}
                  </p>
                  <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                    {entry.ip_address}
                  </p>
                </div>
                <p
                  className="text-[12px] text-[var(--color-text-muted)] shrink-0"
                  title={new Date(entry.logged_at * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                >
                  {relativeTime(entry.logged_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Check `SectionHeader` accepts a `subtitle` prop**

Read `app/src/components/settings/shared.tsx` and check the `SectionHeader` signature. If it does not accept `subtitle`, add it:

```tsx
// In shared.tsx — find SectionHeader and add subtitle support:
export function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-1 mb-1">
      {onBack && (
        <button onClick={onBack} className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer" aria-label="Back">
          ←
        </button>
      )}
      <div>
        <p className="text-[18px] font-bold text-[var(--color-text)]">{title}</p>
        {subtitle && <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
```

If it already accepts `subtitle`, skip this change.

- [ ] **Step 3: Verify build**

```bash
cd app
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/ChildLoginHistory.tsx app/src/components/settings/shared.tsx
git commit -m "feat(ui): ChildLoginHistory sub-screen"
```

---

## Task 8: Frontend — `ChildProfileSettings` — wire all 3 rows + sheets

**Files:**
- Modify: `app/src/components/settings/sections/ChildProfileSettings.tsx`

- [ ] **Step 1: Replace the file with the updated version**

```tsx
/**
 * ChildProfileSettings — Child profile sub-menu.
 *
 * Rendered by FamilySettings when a child row is tapped.
 * Owns: activeView routing, sheet open/close state, growth path expand/collapse.
 * Parent (FamilySettings) owns: teen modes, growth settings, busy flags.
 */

import { useState } from 'react'
import {
  Shield, Calendar, AlertTriangle, Check,
  TreePine, Eye, Lock,
} from 'lucide-react'
import type { ChildRecord, ChildGrowthSettings } from '../../../lib/api'
import { renameChild, setChildPin as apiSetChildPin } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import { SettingsRow, SectionCard, SectionHeader } from '../shared'
import { useTone } from '../../../lib/useTone'
import { ChildLoginHistory } from './ChildLoginHistory'

// ── Growth Path config ────────────────────────────────────────────────────────

const GROWTH_PATHS = [
  { mode: 'ALLOWANCE' as const, title: 'The Automated Harvest',  subtitle: 'Allowance only',      description: 'Fruit that grows on its own every season.',           icon: '🌧️' },
  { mode: 'CHORES'    as const, title: 'The Labor of the Land',  subtitle: 'Chores only',          description: 'Fruit gathered only by tending to the trees.',        icon: '🪵' },
  { mode: 'HYBRID'    as const, title: 'The Integrated Grove',   subtitle: 'Allowance + Chores',   description: 'A steady harvest with extra rewards for hard work.',   icon: '🌳' },
]

const FREQ_LABELS: Record<string, string> = {
  WEEKLY:    'Weekly',
  BI_WEEKLY: 'Every 2 weeks',
  MONTHLY:   'Monthly',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  child:            ChildRecord
  isTeen:           boolean
  isBusy:           boolean
  growth:           ChildGrowthSettings | undefined
  growthBusy:       string | null
  isLead:           boolean
  onTeenModeToggle: (childId: string) => void
  onGrowthUpdate:   (childId: string, patch: Partial<Pick<ChildGrowthSettings, 'earnings_mode' | 'allowance_amount' | 'allowance_frequency'>>) => void
  onRenameChild:    (childId: string, newName: string) => void
  onComingSoon:     () => void
  onBack:           () => void
}

// ── DisplayName Sheet ─────────────────────────────────────────────────────────

function DisplayNameSheet({
  current, childId, onSaved, onClose,
}: { current: string; childId: string; onSaved: (name: string) => void; onClose: () => void }) {
  const [value,   setValue]   = useState(current)
  const [saving,  setSaving]  = useState(false)
  const [errMsg,  setErrMsg]  = useState<string | null>(null)

  const trimmed   = value.trim()
  const unchanged = trimmed === current.trim()
  const disabled  = !trimmed || unchanged || saving

  async function handleSave() {
    if (disabled) return
    setSaving(true)
    setErrMsg(null)
    try {
      const result = await renameChild(childId, trimmed)
      onSaved(result.display_name)
      onClose()
    } catch {
      setErrMsg('Could not update name — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[17px] font-bold text-[var(--color-text)]">Edit Display Name</p>
        <input
          autoFocus
          type="text"
          maxLength={40}
          value={value}
          onChange={e => { setValue(e.target.value); setErrMsg(null) }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="Child's name"
          className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[15px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        />
        {errMsg && <p className="text-[13px] text-red-500">{errMsg}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reset PIN Sheet ───────────────────────────────────────────────────────────

const PIN_LENGTH = 4

function ResetPinSheet({
  child, onSuccess, onClose,
}: { child: ChildRecord; onSuccess: () => void; onClose: () => void }) {
  const [digits,  setDigits]  = useState<string[]>([])
  const [saving,  setSaving]  = useState(false)
  const [errMsg,  setErrMsg]  = useState<string | null>(null)

  function handleDigit(d: string) {
    if (digits.length >= PIN_LENGTH || saving) return
    if ('vibrate' in navigator) navigator.vibrate(10)
    const next = [...digits, d]
    setDigits(next)
    if (next.length === PIN_LENGTH) submitPin(next.join(''))
  }

  function handleBackspace() {
    setDigits(prev => prev.slice(0, -1))
    setErrMsg(null)
  }

  async function submitPin(pin: string) {
    setSaving(true)
    setErrMsg(null)
    try {
      await apiSetChildPin(child.id, pin)
      onSuccess()
      onClose()
    } catch {
      setErrMsg('Something went wrong — try again.')
      setDigits([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[17px] font-bold text-[var(--color-text)] text-center">
          Set a new PIN for {child.display_name}
        </p>

        {/* Dot display */}
        <div className="flex justify-center gap-4">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-colors',
                i < digits.length
                  ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]'
                  : 'bg-transparent border-[var(--color-border)]',
              )}
            />
          ))}
        </div>

        {errMsg && <p className="text-[13px] text-red-500 text-center">{errMsg}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              disabled={saving}
              className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[22px] font-bold text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={saving}
            className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[22px] font-bold text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={saving}
            className="h-14 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[18px] text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-[13px] text-[var(--color-text-muted)] hover:underline cursor-pointer pt-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

type ActiveView = 'root' | 'login-history'

export function ChildProfileSettings({
  child, isTeen, isBusy, growth, growthBusy, isLead,
  onTeenModeToggle, onGrowthUpdate, onRenameChild, onComingSoon, onBack,
}: Props) {
  const { terminology } = useTone(0)
  const [expanded,        setExpanded]        = useState(false)
  const [activeView,      setActiveView]      = useState<ActiveView>('root')
  const [showRenameSheet, setShowRenameSheet] = useState(false)
  const [showPinSheet,    setShowPinSheet]    = useState(false)

  if (activeView === 'login-history') {
    return (
      <ChildLoginHistory
        childId={child.id}
        childName={child.display_name}
        onBack={() => setActiveView('root')}
      />
    )
  }

  return (
    <>
      {showRenameSheet && (
        <DisplayNameSheet
          current={child.display_name}
          childId={child.id}
          onSaved={newName => onRenameChild(child.id, newName)}
          onClose={() => setShowRenameSheet(false)}
        />
      )}
      {showPinSheet && (
        <ResetPinSheet
          child={child}
          onSuccess={() => {/* toast handled by parent via onComingSoon-style callback — see Task 9 */}}
          onClose={() => setShowPinSheet(false)}
        />
      )}

      <div className="space-y-4">
        <SectionHeader title={child.display_name} onBack={onBack} />

        {/* Identity & Security */}
        <div>
          <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-1 mb-2">Identity & Security</p>
          <SectionCard>
            <SettingsRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              label="Display Name"
              description="Edit this child's name"
              onClick={() => setShowRenameSheet(true)}
            />
            <SettingsRow
              icon={<Lock size={15} />}
              label="Reset PIN"
              description="Update this child's 4-digit login PIN"
              onClick={() => setShowPinSheet(true)}
            />
            <SettingsRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>}
              label="Login History"
              description="Recent sessions and device activity"
              onClick={() => setActiveView('login-history')}
            />
          </SectionCard>
        </div>

        {/* Interface & Experience */}
        <div>
          <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-1 mb-2">Interface & Experience</p>
          <SectionCard>
            <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
                    <Eye size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">Interface Style</p>
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                      {isTeen ? "Detailed 'Professional' view" : "Simplified 'Seedling' view"}
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={isTeen}
                  onClick={() => onTeenModeToggle(child.id)}
                  disabled={isBusy}
                  className={cn(
                    'shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]',
                    'disabled:opacity-50',
                    isTeen ? 'bg-[var(--brand-primary)]' : 'bg-[var(--color-border)]',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    isTeen ? 'translate-x-5' : 'translate-x-0',
                  )} />
                </button>
              </div>
            </div>
            <SettingsRow icon={<TreePine size={15} />} label="Experience Level" description="Seedling View (under 12) or Professional View (12+)" onClick={onComingSoon} />
          </SectionCard>
        </div>

        {/* Individual Rules */}
        <div>
          <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-1 mb-2">Individual Rules</p>
          <SectionCard>
            <SettingsRow icon={<Check size={15} />} label="Approval Mode" description="Parental sign-off or self-reported (trust-based)" onClick={onComingSoon} />
            <SettingsRow icon={<Calendar size={15} />} label={`${terminology.allowanceLabel} Status`} description="Pause or resume the flow of funds to this account" onClick={onComingSoon} />
            <SettingsRow icon={<Shield size={15} />} label="Safety Net" description="Overdraft limit for this child — currently £0" onClick={onComingSoon} />

            {/* Growth Path */}
            <div className="px-4 py-3.5">
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
                    <span className="text-[15px]">🌳</span>
                  </span>
                  <div className="text-left min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-text)]">Growth Path</p>
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                      {(() => {
                        const path = GROWTH_PATHS.find(p => p.mode === (growth?.earnings_mode ?? 'HYBRID'))
                        return path ? `${path.icon} ${path.subtitle}` : '🌳 Allowance + Chores'
                      })()}
                    </p>
                  </div>
                </div>
                <span className={cn('text-[var(--color-text-muted)] text-[12px] transition-transform duration-150', expanded ? 'rotate-180' : '')}>▾</span>
              </button>

              {expanded && (
                <div className="mt-3 space-y-1.5">
                  {GROWTH_PATHS.map(path => {
                    const active = (growth?.earnings_mode ?? 'HYBRID') === path.mode
                    const busy   = growthBusy === child.id
                    return (
                      <button
                        key={path.mode}
                        disabled={busy}
                        onClick={() => onGrowthUpdate(child.id, { earnings_mode: path.mode })}
                        className={cn(
                          'w-full text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer disabled:opacity-50',
                          active
                            ? 'border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)]'
                            : 'border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[16px]">{path.icon}</span>
                          <div className="min-w-0">
                            <p className={cn('text-[13px] font-semibold', active ? 'text-[var(--brand-primary)]' : 'text-[var(--color-text)]')}>{path.title}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">{path.description}</p>
                          </div>
                          {active && <Check size={14} className="ml-auto text-[var(--brand-primary)] shrink-0" />}
                        </div>
                      </button>
                    )
                  })}

                  {(growth?.earnings_mode ?? 'HYBRID') !== 'CHORES' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Amount (pence)</label>
                        <input
                          type="number" min={0} step={50}
                          defaultValue={growth?.allowance_amount ?? 0}
                          onBlur={e => {
                            const val = parseInt(e.target.value, 10)
                            if (!isNaN(val) && val >= 0) onGrowthUpdate(child.id, { allowance_amount: val })
                          }}
                          className="mt-1 w-full border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-[13px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        />
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">500 = £5.00</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Frequency</label>
                        <select
                          value={growth?.allowance_frequency ?? 'WEEKLY'}
                          onChange={e => onGrowthUpdate(child.id, { allowance_frequency: e.target.value as 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' })}
                          className="mt-1 w-full border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-[13px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
                        >
                          {Object.entries(FREQ_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Danger Zone */}
        {isLead && (
          <div>
            <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide px-1 mb-2">Danger Zone</p>
            <div className="rounded-xl border-2 border-red-500 overflow-hidden">
              <SettingsRow
                icon={<AlertTriangle size={15} />}
                label="Delete Profile"
                description="Permanently uproot this child from the orchard — deletes their ledger and all data"
                onClick={onComingSoon}
                destructive
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Check `api.ts` exports `setChildPin`**

```bash
grep -n "setChildPin\|set-pin" "app/src/lib/api.ts"
```

If `setChildPin` is not exported, add it in `api.ts` alongside `renameChild`:

```typescript
export async function setChildPin(childId: string, pin: string): Promise<{ ok: boolean }> {
  return request('/auth/child/set-pin', {
    method: 'POST',
    body: JSON.stringify({ child_id: childId, pin }),
  });
}
```

- [ ] **Step 3: Verify build**

```bash
cd app
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/ChildProfileSettings.tsx app/src/lib/api.ts
git commit -m "feat(ui): Display Name + Reset PIN sheets; Login History routing in ChildProfileSettings"
```

---

## Task 9: Frontend — thread `onRenameChild` + PIN success toast through `FamilySettings` and `ParentSettingsTab`

**Files:**
- Modify: `app/src/components/settings/sections/FamilySettings.tsx`
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

- [ ] **Step 1: Update `FamilySettings` Props interface and pass-through**

In `FamilySettings.tsx`, find the `Props` interface (around line 19) and add:

```typescript
  onRenameChild:    (childId: string, newName: string) => void
  onPinResetSuccess: () => void
```

Then find where `ChildProfileSettings` is rendered (around line 82) and add the new props:

```tsx
<ChildProfileSettings
  child={activeChild}
  isTeen={teenModes[activeChild.id] === 1}
  isBusy={teenModeBusy === activeChild.id}
  growth={growthSettings[activeChild.id]}
  growthBusy={growthBusy}
  isLead={isLead}
  onTeenModeToggle={onTeenModeToggle}
  onGrowthUpdate={onGrowthUpdate}
  onRenameChild={onRenameChild}
  onComingSoon={onComingSoon}
  onBack={() => setActiveChildId(null)}
/>
```

Also update the `ResetPinSheet` `onSuccess` callback — in `ChildProfileSettings.tsx` the sheet passes `onSuccess` through. To get the "PIN updated" toast, `FamilySettings` needs to expose `onPinResetSuccess` and `ChildProfileSettings` needs to call it. Pass it through the same way as `onRenameChild`.

Update `ChildProfileSettings` Props to add:
```typescript
  onPinResetSuccess: () => void
```

And update the `ResetPinSheet` usage in `ChildProfileSettings`:
```tsx
<ResetPinSheet
  child={child}
  onSuccess={onPinResetSuccess}
  onClose={() => setShowPinSheet(false)}
/>
```

- [ ] **Step 2: Update `ParentSettingsTab` to implement and pass the two new callbacks**

In `ParentSettingsTab.tsx`, find the `handleTeenModeToggle` style of handlers (around line 200+) and add:

```typescript
function handleRenameChild(childId: string, newName: string) {
  setChildren(prev => prev.map(c => c.id === childId ? { ...c, display_name: newName } : c))
  setToast('Name updated')
  setTimeout(() => setToast(null), 3000)
}

function handlePinResetSuccess() {
  setToast('PIN updated')
  setTimeout(() => setToast(null), 3000)
}
```

Then find where `FamilySettings` is rendered (around line 282) and add:

```tsx
onRenameChild={handleRenameChild}
onPinResetSuccess={handlePinResetSuccess}
```

- [ ] **Step 3: Verify build**

```bash
cd app
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/FamilySettings.tsx app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(ui): wire rename + PIN reset toasts through FamilySettings → ParentSettingsTab"
```

---

## Task 10: Apply migration to production + smoke test

- [ ] **Step 1: Apply migration to production D1**

```bash
cd worker
npx wrangler d1 migrations apply morechard-d1 --remote
```

Expected: `✅  Migration 0024_child_logins_columns.sql applied`

- [ ] **Step 2: Deploy worker**

```bash
npx wrangler deploy
```

Expected: deployment succeeds with no errors.

- [ ] **Step 3: Deploy frontend**

```bash
cd ../app
npm run build
```

Push to main — GitHub Actions auto-deploys to Cloudflare Pages.

```bash
git push origin main
```

- [ ] **Step 4: Manual smoke test checklist**

Open the app as a parent and navigate to **Settings → Manage Family → [child name]**.

**Display Name:**
- [ ] Tap "Display Name" → sheet opens with current name pre-filled
- [ ] Clear the field → Save button is disabled
- [ ] Type current name (same) → Save button is disabled
- [ ] Type a new name → Save button enables; tap Save → sheet closes, child name updates in the list, "Name updated" toast appears

**Reset PIN:**
- [ ] Tap "Reset PIN" → sheet opens with heading "Set a new PIN for [child name]"
- [ ] Tap digits → dots fill in; haptic on supported devices
- [ ] Enter 4 digits → auto-submits → "PIN updated" toast appears
- [ ] Verify the child can log in with the new PIN

**Login History:**
- [ ] Tap "Login History" → sub-screen opens
- [ ] Log in as the child on another device/tab
- [ ] Return to Login History → entry appears with device icon, friendly label, relative time, IP, pulsing green dot
- [ ] Check entry title attribute → shows full ISO datetime

---

## Self-Review Notes

- All three spec requirements are covered: Display Name (Tasks 3, 6, 8, 9), Reset PIN (Tasks 6, 8, 9), Login History (Tasks 1, 2, 4, 5, 6, 7).
- `setChildPin` API function is checked/added in Task 8 Step 2 — it must exist before the ResetPinSheet can compile.
- `SectionHeader` subtitle prop is checked/added in Task 7 Step 2 — guarded with a conditional read.
- The `session_jti` FK on `child_logins` references `sessions(jti)`. D1 does not enforce FK constraints by default, but the column is still correct for the JOIN in the history query.
- `onSuccess` callback on `ResetPinSheet` was left as a placeholder comment in Task 8 — Task 9 explicitly resolves this by threading `onPinResetSuccess` through the component tree.
