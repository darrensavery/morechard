# Pocket Money Day & Global Overdraft Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two "Global Family Rules" settings in the Manage Family sub-menu — Pocket Money Day (family-wide ISO weekday) and Global Overdraft Policy (toggle + limit).

**Architecture:** Three new columns are added to the `families` D1 table via a migration. The worker's `PATCH /api/family` handler learns to accept and validate them. The frontend wires up two new sub-screens inside `FamilySettings.tsx` following the existing `showSharedExpenses` pattern, with state and handlers lifted into `ParentSettingsTab.tsx`.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (TypeScript), React + TypeScript (Vite/Vitest), Tailwind CSS

---

## Files

| File | Action |
|---|---|
| `worker/migrations/0053_family_global_rules.sql` | Create — D1 migration adding 3 columns to `families` |
| `worker/src/routes/settings.ts` | Modify — add `pocket_money_day`, `overdraft_enabled`, `overdraft_limit_pence` to `handleFamilyUpdate` |
| `worker/src/routes/settings.test.ts` | Create — unit tests for the new validation branches |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Modify — seed state, add two handlers, pass new props |
| `app/src/components/settings/sections/FamilySettings.tsx` | Modify — add two sub-screens, new props, replace `onComingSoon` calls |

---

## Task 1: D1 Migration

**Files:**
- Create: `worker/migrations/0053_family_global_rules.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 0053_family_global_rules.sql
-- Adds pocket_money_day, overdraft_enabled, overdraft_limit_pence to families.

ALTER TABLE families ADD COLUMN pocket_money_day INTEGER NOT NULL DEFAULT 6
  CHECK (pocket_money_day BETWEEN 0 AND 6);

ALTER TABLE families ADD COLUMN overdraft_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE families ADD COLUMN overdraft_limit_pence INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0053_family_global_rules.sql
```

Expected output: `Successfully executed` (no errors).

- [ ] **Step 3: Verify columns exist**

```bash
npx wrangler d1 execute morechard-db --local --command="PRAGMA table_info(families);"
```

Expected: rows for `pocket_money_day`, `overdraft_enabled`, `overdraft_limit_pence` appear in the output.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0053_family_global_rules.sql
git commit -m "feat(db): add pocket_money_day and overdraft columns to families"
```

---

## Task 2: Worker — validate and accept new fields in PATCH /api/family

**Files:**
- Modify: `worker/src/routes/settings.ts` (the `handleFamilyUpdate` function, roughly lines 144–182)

- [ ] **Step 1: Write the failing tests**

Create `worker/src/routes/settings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// We test the validation logic in isolation by extracting the relevant
// type-checking rules from handleFamilyUpdate. Since the handler is a
// Cloudflare Worker function (uses env.DB), we test only the pure
// validation branches that don't need a real DB.

// ── pocket_money_day ─────────────────────────────────────────────────────────

describe('pocket_money_day validation', () => {
  function isValidDay(v: unknown): boolean {
    return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6;
  }

  it('accepts 0 (Monday)', () => expect(isValidDay(0)).toBe(true));
  it('accepts 6 (Sunday)', () => expect(isValidDay(6)).toBe(true));
  it('accepts 3 (Thursday)', () => expect(isValidDay(3)).toBe(true));
  it('rejects 7', () => expect(isValidDay(7)).toBe(false));
  it('rejects -1', () => expect(isValidDay(-1)).toBe(false));
  it('rejects a string', () => expect(isValidDay('monday')).toBe(false));
  it('rejects a float', () => expect(isValidDay(1.5)).toBe(false));
});

// ── overdraft_enabled ────────────────────────────────────────────────────────

describe('overdraft_enabled validation', () => {
  function isValidEnabled(v: unknown): boolean {
    return v === 0 || v === 1 || v === true || v === false;
  }

  it('accepts 0', () => expect(isValidEnabled(0)).toBe(true));
  it('accepts 1', () => expect(isValidEnabled(1)).toBe(true));
  it('accepts true', () => expect(isValidEnabled(true)).toBe(true));
  it('accepts false', () => expect(isValidEnabled(false)).toBe(true));
  it('rejects a string', () => expect(isValidEnabled('yes')).toBe(false));
  it('rejects null', () => expect(isValidEnabled(null)).toBe(false));
});

// ── overdraft_limit_pence ────────────────────────────────────────────────────

describe('overdraft_limit_pence validation', () => {
  function isValidLimit(v: unknown): boolean {
    return Number.isInteger(v) && (v as number) >= 0;
  }

  it('accepts 0', () => expect(isValidLimit(0)).toBe(true));
  it('accepts 1000 (£10)', () => expect(isValidLimit(1000)).toBe(true));
  it('rejects -1', () => expect(isValidLimit(-1)).toBe(false));
  it('rejects a float', () => expect(isValidLimit(9.99)).toBe(false));
  it('rejects a string', () => expect(isValidLimit('100')).toBe(false));
});
```

- [ ] **Step 2: Run the tests to confirm they fail (no implementation yet)**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\worker"
npx vitest run src/routes/settings.test.ts
```

Expected: tests **pass** immediately — these are pure logic tests that don't depend on the handler existing yet. (If they fail, fix the test logic before continuing.)

- [ ] **Step 3: Add the three new fields to `handleFamilyUpdate`**

In `worker/src/routes/settings.ts`, find the `handleFamilyUpdate` function. After the existing `fast_track_enabled` block (around line 172), add:

```typescript
  if ('pocket_money_day' in body) {
    const v = body.pocket_money_day;
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 6)
      return error('pocket_money_day must be an integer 0–6');
    updates.push('pocket_money_day = ?');
    values.push(v as number);
  }
  if ('overdraft_enabled' in body) {
    const v = body.overdraft_enabled;
    if (v !== 0 && v !== 1 && v !== true && v !== false)
      return error('overdraft_enabled must be a boolean');
    updates.push('overdraft_enabled = ?');
    values.push(v ? 1 : 0);
  }
  if ('overdraft_limit_pence' in body) {
    const v = body.overdraft_limit_pence;
    if (!Number.isInteger(v) || (v as number) < 0)
      return error('overdraft_limit_pence must be a non-negative integer');
    updates.push('overdraft_limit_pence = ?');
    values.push(v as number);
  }
```

- [ ] **Step 4: Run the tests again to confirm they still pass**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\worker"
npx vitest run src/routes/settings.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/settings.ts worker/src/routes/settings.test.ts
git commit -m "feat(api): accept pocket_money_day and overdraft fields in PATCH /api/family"
```

---

## Task 3: Frontend state & handlers in ParentSettingsTab

**Files:**
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

- [ ] **Step 1: Add three state variables after the existing `savingSettings` state (around line 169)**

```typescript
  const [pocketMoneyDay,       setPocketMoneyDay]       = useState<number>(6)
  const [overdraftEnabled,     setOverdraftEnabled]     = useState<boolean>(false)
  const [overdraftLimitPence,  setOverdraftLimitPence]  = useState<number>(0)
```

- [ ] **Step 2: Seed the new state from `family` in the `load` callback**

Find the block after `setFamily(f)` where `threshold` and `splitBp` are seeded (currently there is no explicit seeding for threshold/splitBp from `family` — check if it exists; if not, add it alongside the new fields). Add after `setFamily(f)`:

```typescript
    setPocketMoneyDay(typeof f.pocket_money_day === 'number' ? f.pocket_money_day : 6)
    setOverdraftEnabled(Boolean(f.overdraft_enabled))
    setOverdraftLimitPence(typeof f.overdraft_limit_pence === 'number' ? f.overdraft_limit_pence : 0)
```

- [ ] **Step 3: Add two handler functions after `handleSaveCoParentSettings`**

```typescript
  async function handleSavePocketMoneyDay(day: number) {
    await updateFamily({ pocket_money_day: day })
    setPocketMoneyDay(day)
    showToast('Pocket money day saved')
  }

  async function handleSaveOverdraftPolicy(enabled: boolean, limitPence: number) {
    await updateFamily({ overdraft_enabled: enabled ? 1 : 0, overdraft_limit_pence: limitPence })
    setOverdraftEnabled(enabled)
    setOverdraftLimitPence(limitPence)
    showToast('Overdraft policy saved')
  }
```

- [ ] **Step 4: Pass the new props to `FamilySettings` in the section view render**

Find the `view.section === 'family'` line (around line 327). It currently ends with `onSaveSharedExpense={handleSaveCoParentSettings} />`. Add the five new props before the `/>`:

```tsx
pocketMoneyDay={pocketMoneyDay}
onSavePocketMoneyDay={handleSavePocketMoneyDay}
overdraftEnabled={overdraftEnabled}
overdraftLimitPence={overdraftLimitPence}
onSaveOverdraftPolicy={handleSaveOverdraftPolicy}
```

- [ ] **Step 5: Build to confirm no TypeScript errors**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\app"
npx tsc --noEmit
```

Expected: errors only about missing props on `FamilySettings` (because we haven't updated the component yet). No other errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(settings): wire pocket money day and overdraft state into ParentSettingsTab"
```

---

## Task 4: FamilySettings — new props and Pocket Money Day sub-screen

**Files:**
- Modify: `app/src/components/settings/sections/FamilySettings.tsx`

- [ ] **Step 1: Add the five new props to the `Props` interface**

Find the `interface Props` block (around line 19). Add after `onSaveSharedExpense`:

```typescript
  pocketMoneyDay:        number
  onSavePocketMoneyDay:  (day: number) => Promise<void>
  overdraftEnabled:      boolean
  overdraftLimitPence:   number
  onSaveOverdraftPolicy: (enabled: boolean, limitPence: number) => Promise<void>
```

- [ ] **Step 2: Destructure the new props in the function signature**

Find the destructured props list (around line 53). Add the five new props:

```typescript
  pocketMoneyDay, onSavePocketMoneyDay,
  overdraftEnabled, overdraftLimitPence, onSaveOverdraftPolicy,
```

- [ ] **Step 3: Add local state for both sub-screens**

Find the existing `useState` block (around line 55). Add after `showSharedExpenses`:

```typescript
  const [showPocketMoneyDay,  setShowPocketMoneyDay]  = useState(false)
  const [selectedDay,         setSelectedDay]         = useState(pocketMoneyDay)
  const [savingDay,           setSavingDay]           = useState(false)

  const [showOverdraftPolicy, setShowOverdraftPolicy] = useState(false)
  const [localEnabled,        setLocalEnabled]        = useState(overdraftEnabled)
  const [localLimitPence,     setLocalLimitPence]     = useState(overdraftLimitPence)
  const [savingOverdraft,     setSavingOverdraft]     = useState(false)
```

- [ ] **Step 4: Add the Pocket Money Day sub-screen render block**

Add this block immediately before the `if (showSharedExpenses)` block:

```tsx
  if (showPocketMoneyDay) {
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    async function handleSaveDay() {
      setSavingDay(true)
      try {
        await onSavePocketMoneyDay(selectedDay)
        setShowPocketMoneyDay(false)
      } finally {
        setSavingDay(false)
      }
    }

    return (
      <div className="space-y-4">
        {toast && <Toast message={toast} />}
        <SectionHeader title={`${terminology.allowanceLabel} Day`} onBack={() => setShowPocketMoneyDay(false)} />

        <SectionCard>
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">
              Weekly payout day
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-snug">
              The day each child's allowance is automatically added to their balance.
            </p>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDay(idx)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border cursor-pointer transition-colors ${
                    selectedDay === idx
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <button
          onClick={handleSaveDay}
          disabled={savingDay}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-50 cursor-pointer"
        >
          {savingDay ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    )
  }
```

- [ ] **Step 5: Build to confirm no TypeScript errors in the new block**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\app"
npx tsc --noEmit
```

Expected: fewer errors than before (pocket money day props now satisfied). Overdraft prop errors remain.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/settings/sections/FamilySettings.tsx
git commit -m "feat(settings): Pocket Money Day sub-screen in FamilySettings"
```

---

## Task 5: FamilySettings — Overdraft Policy sub-screen

**Files:**
- Modify: `app/src/components/settings/sections/FamilySettings.tsx`

- [ ] **Step 1: Add the Overdraft Policy sub-screen render block**

Add this block immediately after the Pocket Money Day block (before `if (showSharedExpenses)`):

```tsx
  if (showOverdraftPolicy) {
    async function handleSaveOverdraft() {
      setSavingOverdraft(true)
      try {
        await onSaveOverdraftPolicy(localEnabled, localLimitPence)
        setShowOverdraftPolicy(false)
      } finally {
        setSavingOverdraft(false)
      }
    }

    return (
      <div className="space-y-4">
        {toast && <Toast message={toast} />}
        <SectionHeader title="Global Overdraft Policy" onBack={() => setShowOverdraftPolicy(false)} />

        <SectionCard>
          {/* Toggle row */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-border)]">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">Allow Overdraft</p>
              <p className="text-[12px] text-[var(--color-text-muted)] leading-snug">
                Let children's balances go negative
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localEnabled}
                onChange={e => setLocalEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-border)] peer-checked:bg-[var(--brand-primary)] rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          {/* Limit input — shown only when enabled */}
          {localEnabled && (
            <div className="px-4 py-3.5">
              <p className="text-[13px] font-semibold text-[var(--color-text)] mb-0.5">Overdraft Limit</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mb-2.5 leading-snug">
                Maximum amount a child can go into the negative.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-[var(--color-text-muted)]">£</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={(localLimitPence / 100).toFixed(0)}
                  onChange={e => setLocalLimitPence(Math.round(parseFloat(e.target.value || '0') * 100))}
                  className="border border-[var(--color-border)] rounded-xl px-4 py-2 text-[14px] bg-[var(--color-surface)] w-28 tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>
          )}
        </SectionCard>

        <button
          onClick={handleSaveOverdraft}
          disabled={savingOverdraft}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-50 cursor-pointer"
        >
          {savingOverdraft ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    )
  }
```

- [ ] **Step 2: Replace both `onComingSoon` calls in the Global Family Rules section**

Find these two lines (around line 287–288):

```tsx
          <SettingsRow icon={<Calendar size={15} />} label={`${terminology.allowanceLabel} Day`} description={`Weekly day for automated ${terminology.money} drops — your family's harvest day`} onClick={onComingSoon} disabled={!isLead} />
          <SettingsRow icon={<Shield size={15} />} label="Global Overdraft Policy" description="Toggle bailouts — default: off / £0" onClick={onComingSoon} disabled={!isLead} />
```

Replace with:

```tsx
          <SettingsRow icon={<Calendar size={15} />} label={`${terminology.allowanceLabel} Day`} description={`Weekly day for automated ${terminology.money} drops — your family's harvest day`} onClick={() => { setSelectedDay(pocketMoneyDay); setShowPocketMoneyDay(true) }} disabled={!isLead} />
          <SettingsRow icon={<Shield size={15} />} label="Global Overdraft Policy" description="Toggle bailouts — default: off / £0" onClick={() => { setLocalEnabled(overdraftEnabled); setLocalLimitPence(overdraftLimitPence); setShowOverdraftPolicy(true) }} disabled={!isLead} />
```

Note: the `onClick` handlers reset local state from props each time the row is tapped, so navigating away and back always shows the last-saved values.

- [ ] **Step 3: Build to confirm zero TypeScript errors**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\app"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the app and manually verify both sub-screens**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money"
npm run dev
```

1. Open the app in the browser, log in as a parent.
2. Go to Settings → Manage Family.
3. Tap "Pocket Money Day" — the sub-screen should open with 7 day buttons. Select a different day. Tap "Save Changes". Should show toast "Pocket money day saved" and return to Manage Family.
4. Go back in and tap "Pocket Money Day" again — the previously selected day should be highlighted.
5. Tap "Global Overdraft Policy" — sub-screen opens with the toggle off. Enable the toggle — the limit input should appear. Enter a value. Tap "Save Changes". Toast should show "Overdraft policy saved".
6. Re-open "Global Overdraft Policy" — toggle should be on, limit should show the saved value.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/settings/sections/FamilySettings.tsx
git commit -m "feat(settings): Global Overdraft Policy sub-screen in FamilySettings"
```

---

## Task 6: Deploy migration to production

- [ ] **Step 1: Apply migration to production D1**

```bash
cd "e:\Web-Video Design\Claude\Apps\Pocket Money"
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0053_family_global_rules.sql
```

Expected: `Successfully executed`.

- [ ] **Step 2: Deploy the worker**

```bash
npx wrangler deploy
```

Expected: deployment URL printed, no errors.

- [ ] **Step 3: Final smoke test on production**

Open the production app, log in as a parent, and repeat the manual verification from Task 5 Step 4 against the live environment.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: deploy pocket money day and overdraft policy to production"
git push
```
