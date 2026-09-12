# Relocation Audit — Design Spec

**Date:** 2026-09-12
**Status:** Draft — pending review

## Problem

Onboarding copy (`Stage2FamilyConstitution.tsx:158`) promises: *"Moving country? Add a Relocation Audit to your ledger at any time in Settings."* No such feature exists. It was explicitly scoped out of `docs/superpowers/plans/2026-04-13-locale-currency-decoupled.md` ("Out of Scope", line 265) alongside general currency-conversion logic, and never revisited. This spec builds the minimal version that honours the promise without violating the Sovereign Ledger philosophy (developer-bible §16 — the ledger is an append-only record of ownership, never retroactively rewritten).

## Behaviour

Running a Relocation Audit:

1. Changes the family's **going-forward** currency (`families.currency` and `families.base_currency`).
2. Writes a permanent, zero-amount `system_note` ledger entry marking the switch (old → new currency, timestamp, optional parent note), chained and hashed like any other ledger row.
3. Does **not** touch any existing ledger row, chore, or goal — those keep whatever currency they were created with. "History stays locked to one currency" remains true; only what's created *after* the audit uses the new one.

### Why this is safe to do as a plain column update, not a ledger-rewrite

- `ledger.currency` is stamped per-row at write time from whatever source record (chore, allowance) supplied it — never re-read from `families` after the fact. Changing `families.currency` going forward cannot retroactively alter any existing row.
- The `ledger_immutable_fields` trigger (migration `0019`/`0027`) already hard-blocks any UPDATE to `currency`/`amount`/`entry_type` on existing rows — there is no code path that could violate this even by mistake.
- The weekly allowance cron (`runPaydaySweep()`, `worker/src/index.ts:478-543`) reads `families.currency` fresh from the DB on every run (joined live, not cached) and stamps that value onto the new ledger row it writes. **This means automatic allowances pivot to the new currency on the very next scheduled run with zero additional code** — verified by reading the query (line 480) and the INSERT (line 541), which both use the live `f.currency`/`child.currency` value from that run's query, not a stored/cached one.

### Known limitation (not solved here, by design)

Chores and goals created before the relocation keep their original `currency` column (set at creation, e.g. `worker/src/routes/chores.ts:506`) and will pay out in that currency even if approved/completed after the relocation. This is consistent with "history stays locked" but means a family could see a late-approved old-currency chore alongside new-currency ones for a short window. Not solving this now — no evidence of real user confusion (same reasoning as the earlier Funds Dashboard cut), and force-migrating open chores would require real currency conversion, which is explicitly out of scope (Sovereign Ledger philosophy, §16).

## API

### `POST /api/family/relocate` (new endpoint)

Body: `{ new_currency: 'GBP' | 'USD' | 'PLN', note?: string }` (note: max ~200 chars, optional free text).

- **Auth**: caller must be `role === 'parent'` AND `family_roles.parent_role === 'lead'` (same gate as `handleDeleteFamily`, `worker/src/routes/auth.ts:1148`). 403 otherwise — no co-parent approval flow; this is a factual life event, not a negotiated financial decision.
- **Validation**: `new_currency` must differ from the family's current `base_currency` — 400 "Family is already using {currency}" if identical (no-op protection, no wasted ledger row).
- **Execution** (single `env.DB.batch`, mirroring the atomic pattern in `runPaydaySweep`):
  1. `fetchAndVerifyChainTip()` to get `previousHash`/`newId` for the family's ledger.
  2. Compute `record_hash` via the existing `computeRecordHash()` for an `entry_type='system_note'`, `amount=0`, `currency=<new_currency>` row (currency field on the marker row itself records the *new* currency, consistent with how other system_notes describe the event they mark).
  3. Insert the ledger row — description: `` 🧭 Relocation Audit: currency changed from {old} to {new}.`` + (optional) ` Note: {note}` — `child_id=NULL`, `ip_address` from the request (matches existing system_note precedent in `auth.ts:964-987`).
  4. `UPDATE families SET currency = ?, base_currency = ? WHERE id = ?` with the new currency (both columns kept in sync, matching how they're set together at registration).
- **Cache invalidation**: delete `family:config:{family_id}` after the batch commits.
- **Currency enum**: inline `z.enum(['GBP', 'USD', 'PLN'])`, matching the existing convention in `finance.ts`/`market-rates.ts`/`settings.ts` rather than introducing a new shared constant — the actual constraint on adding a future currency is the D1 `CHECK` constraints on `families.currency`/`base_currency` and `ledger.currency`, which require a migration regardless of how the JS-side list is expressed.

### Tighten `PATCH /api/family` (existing endpoint)

Remove `base_currency` from `familyUpdateSchema` in `worker/src/routes/settings.ts`. Today it lets *any* parent (not even lead-gated) silently change `base_currency` with zero audit trail — confirmed via `grep`, no frontend caller sends this field outside of registration's one-time initial value (`Stage2FamilyConstitution.tsx` → `RegistrationShell.tsx`), so removing it breaks nothing. All currency changes after onboarding must go through the audited `/relocate` endpoint.

## Frontend

**Location**: `app/src/components/settings/sections/FamilySettings.tsx`, new `SettingsRow` in the existing lead-gated section alongside Allowance Day / Overdraft Policy — same `disabled={!isLead}` / `disabledReason="Only the family lead can change this"` pattern already used there.

**Flow**: tapping the row opens a confirm sheet (new small component, same family as the existing Overdraft Policy sheet):
- Three currency options, current one shown as selected/disabled.
- Optional free-text note field.
- Explanatory copy: *"New chores and goals will use {new currency}. Past entries stay recorded in their original currency — this is permanent and added to your ledger."*
- Confirm button → `POST /api/family/relocate` → on success, toast + close sheet + refetch family config (so the rest of the UI picks up the new currency immediately).
- On 400 (same currency) or 403 (not lead), surface the server's error message in the sheet.

## Testing

- Worker unit tests (new `describe` block in `settings.test.ts` or a new `family-relocate.test.ts`): lead-gate rejection (co-parent/child callers get 403), no-op rejection (same currency → 400), successful call writes a `system_note` row with correct chain fields and updates both currency columns, chain-tip failure path skips cleanly (mirrors `runPaydaySweep`'s `catch` behavior).
- Confirm `PATCH /api/family` rejects/ignores a `base_currency` field post-change (regression test for the tightened schema).
- Frontend component test for the confirm sheet: renders three currency options, disables current, submits note, handles 400/403 responses.

## Out of scope (unchanged from 2026-04-13 plan)

- Any retroactive currency conversion of historical ledger rows, chores, or goals.
- A 4th currency / dynamic currency list (requires its own migration-led spec).
- Co-parent consent/notification flow for triggering a relocation.
