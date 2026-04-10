# Identity & Audit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow parents to update their display name and email inline in Account & Profile settings, with every change cross-device synced via D1 and cryptographically recorded in the hash-chained ledger.

**Architecture:** A new `PATCH /auth/me` worker endpoint validates changes, writes them to `users`, and appends a zero-amount `system_note` ledger entry to maintain audit continuity. The frontend uses inline expand forms (same expand-in-place pattern as the avatar picker) and syncs changes to localStorage identity. A D1 migration extends the ledger to accept `system_note` entry types with `amount = 0`.

**Tech Stack:** Cloudflare Workers (TypeScript), Cloudflare D1 (SQLite), React + Tailwind CSS, Wrangler CLI

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `worker/migrations/0019_system_note_entry_type.sql` | Create | Extend ledger CHECK constraints for `system_note` + `amount >= 0`; add `email_pending` to `users` |
| `worker/src/routes/auth.ts` | Modify | Add `handleMePatch`; extend `handleMe` response to include `email_pending` |
| `worker/src/index.ts` | Modify | Register `PATCH /auth/me` route; update `handleMe` import list |
| `app/src/lib/api.ts` | Modify | Extend `MeResult` with `email_pending`; add `updateProfile()` function |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Modify | Inline edit forms for display name and email; load profile in `load()` |
| `app/src/screens/ChildDashboard.tsx` | Modify | Fix "In Goals" contrast (purple → cyan) |
| `app/src/components/dashboard/JobsTab.tsx` | Modify | Rename export `JobsTab` → `ChoresTab` |
| `app/src/components/dashboard/HistoryTab.tsx` | Modify | Rename export `HistoryTab` → `ActivityTab` |
| `app/src/screens/ParentDashboard.tsx` | Modify | Update imports for renamed exports |

---

## Task 1: D1 Migration — Extend Ledger Schema

**Files:**
- Create: `worker/migrations/0019_system_note_entry_type.sql`

> **Context:** D1 (SQLite) cannot `ALTER TABLE … CHECK`. The standard approach is rename → recreate → copy → drop old. Migration `0005` did exactly this for `verification_status`. The current ledger has `entry_type IN ('credit', 'reversal', 'payment')` and `amount > 0`. We need `'system_note'` in `entry_type` and `amount >= 0` (system notes are zero-amount). `child_id` must also become nullable since system notes have no child. The `users` table gets an `email_pending` column.

- [ ] **Step 1: Create the migration file**

Create `worker/migrations/0019_system_note_entry_type.sql` with this exact content:

```sql
-- Migration 0019: Add 'system_note' entry_type; relax amount > 0 to amount >= 0;
-- make child_id nullable; add email_pending to users.
--
-- system_note rows represent non-financial audit events (e.g. profile changes).
-- They always have amount = 0 and child_id = NULL.
--
-- SQLite cannot ALTER a CHECK constraint or NOT NULL directly.
-- Standard approach: rename → recreate → copy → drop old.

PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

-- 1. Rebuild ledger with updated constraints
CREATE TABLE ledger_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT    NOT NULL REFERENCES families(id),
  child_id            TEXT    REFERENCES users(id),            -- NULL for system_note rows
  chore_id            TEXT    REFERENCES chores(id),
  entry_type          TEXT    NOT NULL
                              CHECK (entry_type IN ('credit', 'reversal', 'payment', 'system_note')),
  amount              INTEGER NOT NULL CHECK (amount >= 0),    -- 0 for system_note rows
  currency            TEXT    NOT NULL CHECK (currency IN ('GBP', 'PLN')),
  description         TEXT    NOT NULL,
  receipt_id          TEXT,
  category            TEXT,
  verification_status TEXT    NOT NULL
                              CHECK (verification_status IN
                                ('pending','verified_auto','verified_manual','disputed','reversed')),
  authorised_by       TEXT    REFERENCES users(id),
  verified_at         INTEGER,
  verified_by         TEXT    REFERENCES users(id),
  dispute_code        TEXT,
  dispute_before      INTEGER,
  previous_hash       TEXT    NOT NULL,
  record_hash         TEXT    NOT NULL,
  ip_address          TEXT    NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO ledger_new SELECT
  id, family_id, child_id, chore_id, entry_type, amount, currency, description,
  receipt_id, category, verification_status, authorised_by,
  verified_at, verified_by, dispute_code, dispute_before,
  previous_hash, record_hash, ip_address, created_at
FROM ledger;

DROP TABLE ledger;
ALTER TABLE ledger_new RENAME TO ledger;

-- Recreate immutability trigger
CREATE TRIGGER IF NOT EXISTS ledger_no_delete
  BEFORE DELETE ON ledger
BEGIN
  SELECT RAISE(ABORT, 'Ledger rows cannot be deleted.');
END;

CREATE TRIGGER IF NOT EXISTS ledger_immutable_fields
  BEFORE UPDATE ON ledger
  WHEN NEW.amount        != OLD.amount
    OR NEW.currency      != OLD.currency
    OR NEW.entry_type    != OLD.entry_type
    OR NEW.record_hash   != OLD.record_hash
    OR NEW.previous_hash != OLD.previous_hash
    OR NEW.ip_address    != OLD.ip_address
    OR NEW.created_at    != OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'Immutable ledger fields cannot be changed after insert.');
END;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ledger_family ON ledger (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_child  ON ledger (child_id,  created_at DESC);

-- 2. Add email_pending to users
ALTER TABLE users ADD COLUMN email_pending TEXT;

PRAGMA foreign_keys = ON;
```

- [ ] **Step 2: Apply migration to local D1 (if running locally)**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0019_system_note_entry_type.sql
```

Expected output: `Successfully executed SQL` (no errors)

> **Note:** Apply to production D1 only after all changes are tested:
> ```bash
> npx wrangler d1 execute morechard-db --file=worker/migrations/0019_system_note_entry_type.sql
> ```

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0019_system_note_entry_type.sql
git commit -m "feat(db): migration 0019 — system_note entry type, nullable child_id, email_pending"
```

---

## Task 2: Worker — Extend `GET /auth/me` and Add `PATCH /auth/me`

**Files:**
- Modify: `worker/src/routes/auth.ts`

> **Context:** `handleMe` at line ~352 currently selects `id, display_name, email, locale, email_verified` but not `email_pending`. We add that to the SELECT. Then we add a new `handleMePatch` function in the same file. The hash-chain helpers are in `worker/src/lib/hash.ts` — import `computeRecordHash` and `GENESIS_HASH` at the top. The `clientIp` helper and `AuthedRequest` type are already in scope.

- [ ] **Step 1: Update `handleMe` to include `email_pending`**

In `worker/src/routes/auth.ts`, find the `handleMe` function and update the SELECT:

```ts
// Before:
const user = await env.DB
  .prepare('SELECT id, display_name, email, locale, email_verified FROM users WHERE id = ?')
  .bind(caller.sub)
  .first();

// After:
const user = await env.DB
  .prepare('SELECT id, display_name, email, locale, email_verified, email_pending FROM users WHERE id = ?')
  .bind(caller.sub)
  .first();
```

- [ ] **Step 2: Add imports for hash helpers**

At the top of `worker/src/routes/auth.ts`, add to the import block:

```ts
import { computeRecordHash, GENESIS_HASH } from '../lib/hash.js';
import type { AuthedRequest } from '../types.js';
```

> Check whether `AuthedRequest` is already imported — if so, skip that line. Look for `import type { AuthedRequest` in the file.

- [ ] **Step 3: Add `handleMePatch` function**

Append this function to `worker/src/routes/auth.ts` (before the `// Internal helpers` comment block):

```ts
// ----------------------------------------------------------------
// PATCH /auth/me
// Update display name and/or email. Writes a system_note ledger
// entry for each field changed to maintain the audit trail.
// ----------------------------------------------------------------
export async function handleMePatch(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller) return error('Unauthorised', 401);

  let body: { display_name?: string; email?: string };
  try {
    body = await request.json() as { display_name?: string; email?: string };
  } catch {
    return error('Invalid JSON', 400);
  }

  const { display_name, email } = body;

  if (!display_name && !email) {
    return error('Nothing to update', 400);
  }

  const ip = clientIp(request);

  // Fetch current user
  const user = await env.DB
    .prepare('SELECT id, display_name, email, locale, email_verified, email_pending FROM users WHERE id = ?')
    .bind(caller.sub)
    .first<{ id: string; display_name: string; email: string | null; locale: string; email_verified: number; email_pending: string | null }>();
  if (!user) return error('User not found', 404);

  // Fetch family default_currency for ledger entries
  const family = await env.DB
    .prepare('SELECT default_currency FROM families WHERE id = ?')
    .bind(caller.family_id)
    .first<{ default_currency: string }>();
  const currency = family?.default_currency ?? 'GBP';

  // Helper: write a system_note ledger entry
  async function writeSystemNote(description: string): Promise<void> {
    const prevRow = await env.DB
      .prepare('SELECT id, record_hash FROM ledger WHERE family_id = ? ORDER BY id DESC LIMIT 1')
      .bind(caller.family_id)
      .first<{ id: number; record_hash: string }>();
    const previousHash = prevRow?.record_hash ?? GENESIS_HASH;

    const maxRow = await env.DB
      .prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM ledger')
      .first<{ max_id: number }>();
    const newId = (maxRow?.max_id ?? 0) + 1;

    const recordHash = await computeRecordHash(
      newId,
      caller.family_id,
      'NULL',         // child_id is NULL for system notes — stringify for hash input
      0,              // amount
      currency,
      'system_note',
      previousHash,
    );

    await env.DB
      .prepare(`
        INSERT INTO ledger
          (id, family_id, child_id, chore_id, entry_type, amount, currency,
           description, verification_status, authorised_by,
           previous_hash, record_hash, ip_address)
        VALUES (?,?,NULL,NULL,'system_note',0,?,?,  'verified_auto',?,?,?,?)
      `)
      .bind(newId, caller.family_id, currency, description, caller.sub, previousHash, recordHash, ip)
      .run();
  }

  // ── Display name update ──────────────────────────────────────
  if (display_name !== undefined) {
    const trimmed = display_name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) {
      return error('Display name must be 2–40 characters', 400);
    }
    await env.DB
      .prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(trimmed, caller.sub)
      .run();
    await writeSystemNote(`🌱 ${trimmed} updated their family name`);
  }

  // ── Email update ─────────────────────────────────────────────
  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    // Basic RFC-ish format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return error('Please enter a valid email address', 400);
    }
    // Uniqueness check — reject if another verified account has this address
    const conflict = await env.DB
      .prepare('SELECT id FROM users WHERE email = ? AND email_verified = 1 AND id != ?')
      .bind(trimmedEmail, caller.sub)
      .first<{ id: string }>();
    if (conflict) {
      return error('That email address is already registered', 409);
    }
    await env.DB
      .prepare('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?')
      .bind(trimmedEmail, caller.sub)
      .run();
    await writeSystemNote('🌱 Contact email was updated');
  }

  // Return updated profile
  const updated = await env.DB
    .prepare('SELECT id, display_name, email, locale, email_verified, email_pending FROM users WHERE id = ?')
    .bind(caller.sub)
    .first();
  if (!updated) return error('User not found', 404);

  return json({ ...updated, family_id: caller.family_id, role: caller.role });
}
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(worker): PATCH /auth/me — update display name and email with ledger audit trail"
```

---

## Task 3: Worker — Register the New Route

**Files:**
- Modify: `worker/src/index.ts`

> **Context:** The route table at line ~285 has `GET /auth/me`. We add `PATCH /auth/me` directly below it and add `handleMePatch` to the import from `./routes/auth.js`.

- [ ] **Step 1: Add `handleMePatch` to the auth import**

In `worker/src/index.ts`, find the import that includes `handleMe`:

```ts
// Find this line (exact text may vary slightly):
import { ..., handleMe, ... } from './routes/auth.js';
// Add handleMePatch to it:
import { ..., handleMe, handleMePatch, ... } from './routes/auth.js';
```

- [ ] **Step 2: Register the route**

Find the line:
```ts
if (path === '/auth/me'     && method === 'GET')  return withAuth(request, auth, env, handleMe);
```

Add immediately below it:
```ts
if (path === '/auth/me'     && method === 'PATCH') return withAuth(request, auth, env, handleMePatch);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register PATCH /auth/me route"
```

---

## Task 4: Frontend API — Extend `MeResult` and Add `updateProfile`

**Files:**
- Modify: `app/src/lib/api.ts`

> **Context:** `MeResult` at line ~94 is the return type for `getMe()`. We extend it with `email_pending` and add a new `updateProfile()` function. Both changes are small and isolated to the Auth section of `api.ts`.

- [ ] **Step 1: Extend `MeResult`**

Find:
```ts
export interface MeResult {
  id: string; display_name: string; email: string | null;
  family_id: string; role: 'parent' | 'child'; locale: string;
}
```

Replace with:
```ts
export interface MeResult {
  id: string; display_name: string; email: string | null;
  email_verified: number; email_pending: string | null;
  family_id: string; role: 'parent' | 'child'; locale: string;
}
```

- [ ] **Step 2: Add `updateProfile` function**

Immediately after the closing brace of `getMe()`, add:

```ts
export async function updateProfile(
  body: { display_name?: string; email?: string },
): Promise<MeResult> {
  return request('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api): extend MeResult with email_pending; add updateProfile()"
```

---

## Task 5: Frontend — Inline Edit Forms in Account & Profile

**Files:**
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

> **Context:** The Account & Profile section is rendered at line ~626 (the `if (view.section === 'account')` branch). Currently the Display Name and Email rows both call `comingSoon()`. We replace that with inline expand forms, following the same pattern as the avatar picker (a `useState` flag that reveals a form card below the row). We also need to: (1) add `profile` state loaded from `getMe()` in the existing `load()` callback, (2) add edit state vars, (3) import `updateProfile` and `updateDeviceIdentity` from their respective modules.

- [ ] **Step 1: Add imports**

At the top of `ParentSettingsTab.tsx`, find the api imports block:

```ts
import {
  getChildren, addChild, generateInvite,
  getFamily, getSettings, updateSettings,
  getChildSettings, updateChildSettings,
  getChildGrowth, updateChildGrowth,
} from '../../lib/api'
```

Replace with:

```ts
import {
  getChildren, addChild, generateInvite,
  getFamily, getSettings, updateSettings,
  getChildSettings, updateChildSettings,
  getChildGrowth, updateChildGrowth,
  getMe, updateProfile,
  type MeResult,
} from '../../lib/api'
import { updateDeviceIdentity } from '../../lib/deviceIdentity'
```

- [ ] **Step 2: Add state variables**

Inside `ParentSettingsTab`, find the `const { toast, showToast } = useToast()` line and add the new state directly below it:

```ts
// Profile (loaded from GET /auth/me)
const [profile, setProfile] = useState<MeResult | null>(null)

// Display name inline edit
const [editingName,  setEditingName]  = useState(false)
const [nameInput,    setNameInput]    = useState('')
const [nameSaving,   setNameSaving]   = useState(false)
const [nameError,    setNameError]    = useState<string | null>(null)

// Email inline edit
const [editingEmail, setEditingEmail] = useState(false)
const [emailInput,   setEmailInput]   = useState('')
const [emailSaving,  setEmailSaving]  = useState(false)
const [emailError,   setEmailError]   = useState<string | null>(null)
```

- [ ] **Step 3: Load profile in `load()`**

Find the `load` callback. It contains:
```ts
const [c, f, s] = await Promise.all([
  getChildren().then(r => r.children),
  getFamily(),
  getSettings(),
])
setChildren(c)
onChildrenChange(c)
setFamily(f)
setSettings(s)
```

Replace with:
```ts
const [c, f, s, p] = await Promise.all([
  getChildren().then(r => r.children),
  getFamily(),
  getSettings(),
  getMe(),
])
setChildren(c)
onChildrenChange(c)
setFamily(f)
setSettings(s)
setProfile(p)
```

- [ ] **Step 4: Add save handlers**

Find the `function comingSoon()` function and add these two handlers directly below it:

```ts
async function handleSaveName(e: React.FormEvent) {
  e.preventDefault()
  if (!nameInput.trim() || nameInput.trim() === (profile?.display_name ?? '')) return
  setNameSaving(true)
  setNameError(null)
  try {
    const updated = await updateProfile({ display_name: nameInput.trim() })
    setProfile(updated)
    updateDeviceIdentity({ display_name: updated.display_name })
    setFamily(prev => ({ ...prev, display_name: updated.display_name }))
    setEditingName(false)
    showToast('🌿 Name updated')
  } catch (err: unknown) {
    setNameError((err as Error).message)
  } finally {
    setNameSaving(false)
  }
}

async function handleSaveEmail(e: React.FormEvent) {
  e.preventDefault()
  if (!emailInput.trim() || emailInput.trim() === (profile?.email ?? '')) return
  setEmailSaving(true)
  setEmailError(null)
  try {
    const updated = await updateProfile({ email: emailInput.trim() })
    setProfile(updated)
    setEditingEmail(false)
    showToast('📬 Email updated')
  } catch (err: unknown) {
    setEmailError((err as Error).message)
  } finally {
    setEmailSaving(false)
  }
}
```

- [ ] **Step 5: Replace the Display Name and Email rows**

Find this block in the account section (around line ~693):

```tsx
<SectionCard>
  <SettingsRow
    icon={<User size={15} />}
    label="Display Name"
    description="Update your name as shown in the app"
    onClick={comingSoon}
  />
  <SettingsRow
    icon={<Shield size={15} />}
    label="Email Management"
    description="Update or verify your email address"
    onClick={comingSoon}
  />
</SectionCard>
```

Replace with:

```tsx
<SectionCard>
  {/* Display Name row */}
  <SettingsRow
    icon={<User size={15} />}
    label="Display Name"
    description={profile?.display_name ?? identity?.display_name ?? 'Not set'}
    onClick={() => {
      setNameInput(profile?.display_name ?? identity?.display_name ?? '')
      setNameError(null)
      setEditingName(v => !v)
      setEditingEmail(false)
    }}
  />
  {editingName && (
    <form onSubmit={handleSaveName} className="px-4 py-3 border-t border-[var(--color-border)] space-y-2">
      <input
        type="text"
        value={nameInput}
        onChange={e => setNameInput(e.target.value)}
        maxLength={40}
        autoFocus
        placeholder="Your name"
        className="w-full px-3 py-2 text-[14px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
      />
      {nameError && <p className="text-[12px] text-red-500">{nameError}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={
            nameSaving ||
            nameInput.trim().length < 2 ||
            nameInput.trim() === (profile?.display_name ?? identity?.display_name ?? '')
          }
          className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-[var(--brand-primary)] text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {nameSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setEditingName(false); setNameError(null) }}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )}

  {/* Email row */}
  <SettingsRow
    icon={<Shield size={15} />}
    label="Email"
    description={profile?.email ?? 'No email set'}
    badge={
      profile && (profile.email_verified === 0 || profile.email_pending)
        ? 'Unverified'
        : undefined
    }
    onClick={() => {
      setEmailInput(profile?.email ?? '')
      setEmailError(null)
      setEditingEmail(v => !v)
      setEditingName(false)
    }}
  />
  {editingEmail && (
    <form onSubmit={handleSaveEmail} className="px-4 py-3 border-t border-[var(--color-border)] space-y-2">
      <input
        type="email"
        value={emailInput}
        onChange={e => setEmailInput(e.target.value)}
        autoFocus
        placeholder="your@email.com"
        className="w-full px-3 py-2 text-[14px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
      />
      {emailError && <p className="text-[12px] text-red-500">{emailError}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={
            emailSaving ||
            !emailInput.trim() ||
            emailInput.trim() === (profile?.email ?? '')
          }
          className="flex-1 py-2 rounded-xl text-[13px] font-bold bg-[var(--brand-primary)] text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {emailSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setEditingEmail(false); setEmailError(null) }}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )}
</SectionCard>
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(ui): inline display name and email editing in Account & Profile"
```

---

## Task 6: Cosmetic — "In Goals" Contrast Fix

**Files:**
- Modify: `app/src/screens/ChildDashboard.tsx`

> **Context:** The "In Goals" metric shows how much balance is reserved for savings goals. It currently uses a purple/violet colour that has poor contrast in dark mode. Search for the exact class to confirm, then replace.

- [ ] **Step 1: Find the "In Goals" colour**

```bash
grep -n "In Goals\|in_goals\|inGoals\|reserved\|purple\|violet" "app/src/screens/ChildDashboard.tsx"
```

If found, note the exact class (e.g. `text-purple-500`). If not found in `ChildDashboard.tsx`, also check:

```bash
grep -rn "In Goals\|purple\|violet" app/src/components/dashboard/
```

- [ ] **Step 2: Replace the colour**

Once located, replace the purple/violet text class with:
- `text-cyan-600 dark:text-cyan-400`

Example — if the current code is:
```tsx
<strong className="text-purple-600 tabular-nums">
```
Replace with:
```tsx
<strong className="text-cyan-600 dark:text-cyan-400 tabular-nums">
```

Apply the same replacement in both `OrchardView` and `ProfessionalView` sections if the pattern appears in both.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/ChildDashboard.tsx
git commit -m "fix(ui): replace poor-contrast purple with cyan on 'In Goals' metric"
```

---

## Task 7: Rename `JobsTab` → `ChoresTab` and `HistoryTab` → `ActivityTab`

**Files:**
- Modify: `app/src/components/dashboard/JobsTab.tsx`
- Modify: `app/src/components/dashboard/HistoryTab.tsx`
- Modify: `app/src/screens/ParentDashboard.tsx`

> **Context:** The tab labels in `ParentDashboard.tsx` already say `'Chores'` and `'Activity'`. Only the component export names need updating. Filenames stay the same to avoid import path churn across the codebase.

- [ ] **Step 1: Rename export in `JobsTab.tsx`**

In `app/src/components/dashboard/JobsTab.tsx`, find:
```ts
export function JobsTab(
```
Replace with:
```ts
export function ChoresTab(
```

- [ ] **Step 2: Rename export in `HistoryTab.tsx`**

In `app/src/components/dashboard/HistoryTab.tsx`, find:
```ts
export function HistoryTab(
```
Replace with:
```ts
export function ActivityTab(
```

- [ ] **Step 3: Update imports in `ParentDashboard.tsx`**

Find:
```ts
import { JobsTab }     from '../components/dashboard/JobsTab'
```
Replace with:
```ts
import { ChoresTab }   from '../components/dashboard/JobsTab'
```

Find:
```ts
import { HistoryTab }  from '../components/dashboard/HistoryTab'
```
Replace with:
```ts
import { ActivityTab } from '../components/dashboard/HistoryTab'
```

- [ ] **Step 4: Update usages in `ParentDashboard.tsx`**

Find:
```tsx
{tab === 'chores'    && <JobsTab          familyId={familyId} child={activeChild} />}
```
Replace with:
```tsx
{tab === 'chores'    && <ChoresTab        familyId={familyId} child={activeChild} />}
```

Find:
```tsx
{tab === 'activity'  && <HistoryTab        familyId={familyId} child={activeChild} />}
```
Replace with:
```tsx
{tab === 'activity'  && <ActivityTab       familyId={familyId} child={activeChild} />}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/JobsTab.tsx app/src/components/dashboard/HistoryTab.tsx app/src/screens/ParentDashboard.tsx
git commit -m "refactor: rename JobsTab→ChoresTab, HistoryTab→ActivityTab"
```

---

## Task 8: Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npm run dev
```

- [ ] **Step 2: Test Display Name editing**

1. Open the app, navigate to Settings → Account & Profile
2. Click the Display Name row — the inline form should expand
3. The Save button should be **disabled** while the input matches the current name
4. Change the name → Save button enables
5. Submit → toast "🌿 Name updated" appears
6. The avatar card at the top of Account & Profile reflects the new name
7. Reopen the row — the description shows the updated name

- [ ] **Step 3: Test Email editing**

1. Click the Email row — inline form expands
2. Change email → submit
3. Toast "📬 Email updated" appears
4. The row now shows an amber "Unverified" badge

- [ ] **Step 4: Test no-op guard**

1. Open Display Name, clear input, type exactly the current name → Save button is disabled

- [ ] **Step 5: Verify ledger entries in D1**

```bash
npx wrangler d1 execute morechard-db --local --command="SELECT id, entry_type, amount, description, created_at FROM ledger ORDER BY id DESC LIMIT 5;"
```

Expected: two rows with `entry_type = 'system_note'`, `amount = 0`, descriptions matching the changes made.

- [ ] **Step 6: Final commit if any fixes needed, then push**

```bash
git push
```

---

## Self-Review Notes

- `computeRecordHash` takes `childId: string` — we pass `'NULL'` (string) for system notes so the hash input is deterministic and consistent. This is intentional and documented in the handler.
- `SettingsRow` component accepts a `badge` prop — confirmed at line ~207 in `ParentSettingsTab.tsx`. The `'Unverified'` badge uses the existing amber style already applied to other badges in that component.
- `updateDeviceIdentity` (not `setDeviceIdentity`) is used in the save handler — this is the correct helper that merges a partial patch rather than replacing the full identity object.
- Migration `0019` uses `currency IN ('GBP', 'PLN')` — confirmed matches the existing constraint; USD is not in the schema.
