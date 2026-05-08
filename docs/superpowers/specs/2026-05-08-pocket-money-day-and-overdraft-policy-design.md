# Design: Pocket Money Day & Global Overdraft Policy

**Date:** 2026-05-08  
**Status:** Approved

---

## Overview

Implement the two "Global Family Rules" settings in the Manage Family sub-menu that currently show "Coming Soon":

1. **Pocket Money Day** — family-wide ISO weekday for automated allowance drops
2. **Global Overdraft Policy** — toggle + limit controlling how far into negative balance children can go

Both features follow the existing `showSharedExpenses` sub-screen pattern in `FamilySettings.tsx`.

---

## Data Layer

### D1 Migration

New file: `worker/migrations/0053_family_global_rules.sql`

Three new columns on `families`:

```sql
ALTER TABLE families ADD COLUMN pocket_money_day INTEGER NOT NULL DEFAULT 6
  CHECK (pocket_money_day BETWEEN 0 AND 6);

ALTER TABLE families ADD COLUMN overdraft_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE families ADD COLUMN overdraft_limit_pence INTEGER NOT NULL DEFAULT 0;
```

- `pocket_money_day`: ISO weekday, 0 = Monday, 6 = Sunday. Matches existing `allowance_day` convention on `users`.
- `overdraft_enabled`: boolean (0/1). When 0, children's balances cannot go negative.
- `overdraft_limit_pence`: maximum negative balance in pence/groszy. Only enforced when `overdraft_enabled = 1`. Stored as a positive integer (e.g. 1000 = £10.00). Ledger enforcement is out of scope for this spec — stored for future use in Phase 4.

### Worker — `PATCH /api/family`

Add three new accepted fields in `handleFamilyUpdate` (`worker/src/routes/settings.ts`):

| Field | Validation |
|---|---|
| `pocket_money_day` | integer 0–6 |
| `overdraft_enabled` | boolean (0/1/true/false) |
| `overdraft_limit_pence` | non-negative integer |

`GET /api/family` already does `SELECT *` so new columns are returned automatically — no change needed.

---

## Frontend

### API client (`app/src/lib/api.ts`)

`updateFamily` already accepts `Record<string, unknown>` and hits `PATCH /api/family` — no change needed.

### `ParentSettingsTab.tsx`

- Read `pocket_money_day`, `overdraft_enabled`, `overdraft_limit_pence` from the `family` state object (already loaded via `getFamily()`).
- Add three state variables: `pocketMoneyDay`, `overdraftEnabled`, `overdraftLimitPence`.
- Seed them from `family` after load (same pattern as `threshold` / `splitBp`).
- Add two handler functions: `handleSavePocketMoneyDay(day)` and `handleSaveOverdraftPolicy(enabled, limitPence)` — both call `updateFamily(...)` then `showToast(...)`.
- Pass the new props and handlers to `FamilySettings`.

### `FamilySettings.tsx` — new props

```ts
pocketMoneyDay:         number
onSavePocketMoneyDay:   (day: number) => Promise<void>
overdraftEnabled:       boolean
overdraftLimitPence:    number
onSaveOverdraftPolicy:  (enabled: boolean, limitPence: number) => Promise<void>
```

Replace both `onComingSoon` calls in the Global Family Rules section with navigation to the respective sub-screens.

### Pocket Money Day sub-screen

State: `showPocketMoneyDay: boolean`, local `selectedDay: number` (initialised from prop), `savingDay: boolean`.

Layout:
- `SectionHeader` — title uses `terminology.allowanceLabel + ' Day'`, back sets `showPocketMoneyDay(false)`
- `SectionCard` — 7 buttons in a horizontal flex row: Mon Tue Wed Thu Fri Sat Sun (labels). Selected day styled with `bg-[var(--brand-primary)] text-white`, others with border + muted text.
- "Save Changes" button — calls `onSavePocketMoneyDay(selectedDay)`, disabled while `savingDay`.

### Global Overdraft Policy sub-screen

State: `showOverdraftPolicy: boolean`, local `localEnabled: boolean`, `localLimitPence: number`, `savingOverdraft: boolean`.

Layout:
- `SectionHeader` — title "Global Overdraft Policy", back sets `showOverdraftPolicy(false)`
- `SectionCard`:
  - Row 1: "Allow Overdraft" label + "Let children's balances go negative" description + right-aligned `<input type="checkbox">` styled as a toggle (or native toggle using existing patterns)
  - Row 2 (conditional, shown only when `localEnabled`): "Overdraft Limit" label + `£` symbol + `<input type="number">` for whole pounds. Value displayed as `localLimitPence / 100`, stored back as `Math.round(value * 100)`. Min 0. (Matches the hardcoded `£` in the existing Shared Expenses screen.)
- "Save Changes" button — calls `onSaveOverdraftPolicy(localEnabled, localLimitPence)`, disabled while `savingOverdraft`.

---

## Out of scope

- Ledger enforcement of the overdraft limit (Phase 4)
- Automated pocket money drop cron job (Phase 8)
- Per-child overrides of pocket money day

---

## Files touched

| File | Change |
|---|---|
| `worker/migrations/0053_family_global_rules.sql` | New migration |
| `worker/src/routes/settings.ts` | Add 3 fields to `handleFamilyUpdate` |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | State, handlers, new props |
| `app/src/components/settings/sections/FamilySettings.tsx` | Two new sub-screens, new props |
