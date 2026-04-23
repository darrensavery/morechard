# Data & Exports — Implementation Design
**Date:** 2026-04-23  
**Branch:** feat/settings-ui-improvements  
**Status:** Approved for implementation

---

## Problem

The Data & Exports screen (`DataSettings.tsx`) has working UI scaffolding and a complete backend (`export.ts`), but several gaps need closing before the feature is shippable:

1. Family Summary report is incorrectly gated behind `hasLifetimeLicense` — it should be free for all authenticated users.
2. The Shield SKU (`SHIELD`, £149.99) does not exist in Stripe, D1, or the trial system — `has_legal_bundle` is hardcoded `false`.
3. Locked report rows call `onComingSoon` instead of navigating to Plan Management with the relevant SKU pre-selected.
4. User-facing copy contains technical jargon ("SHA-256", "Legal") in primary labels.
5. Export state is inline in `DataSettings.tsx` — hard to test and reason about.
6. Data Pruning has no backend at all.
7. No server-side enforcement of tier gates — a crafted request can bypass frontend checks.

---

## Scope

### In scope
- `useExportManager` hook (replaces inline state)
- Family Summary gate removal (frontend + no backend change needed)
- Shield SKU wiring: `types.ts`, `stripe.ts`, `trial.ts`, D1 migration
- `has_legal_bundle` → `has_shield` rename throughout
- Upgrade navigation: `onNavigateToPlan` prop replacing `onComingSoon` for gated rows
- Label/description copy fixes
- Server-side tier enforcement for `behavioral` and `forensic` tiers
- `POST /api/export/prune` worker route
- `ledger_prune_archive` table + `pruned_at` column on ledger
- Double-confirm UI for Data Pruning
- Graceful "Details archived" display for pruned completions

### Out of scope
- PDF generation library change (already outputs HTML for print)
- Uproot flow changes
- Subscription cancellation flow (Phase 7)

---

## Architecture

### New file
`app/src/hooks/useExportManager.ts`

### Modified files
- `app/src/components/settings/sections/DataSettings.tsx`
- `app/src/components/dashboard/ParentSettingsTab.tsx`
- `app/src/lib/api.ts`
- `worker/src/types.ts`
- `worker/src/routes/stripe.ts`
- `worker/src/routes/export.ts`
- `worker/src/lib/trial.ts`
- `worker/src/index.ts`

### New migrations
- `worker/migrations/0038_shield_sku.sql`
- `worker/migrations/0039_prune_archive.sql`

---

## Section 1 — `useExportManager` hook

**File:** `app/src/hooks/useExportManager.ts`

```ts
type ExportKey = 'json-basic' | 'pdf-basic' | 'pdf-behavioral' | 'pdf-forensic' | 'prune'
type ExportState = 'idle' | 'generating' | 'success' | 'error'

interface UseExportManager {
  stateOf: (key: ExportKey) => ExportState
  errorOf: (key: ExportKey) => string | null
  triggerExport: (format: 'pdf' | 'json', tier: 'basic' | 'behavioral' | 'forensic') => Promise<void>
  triggerPrune:  () => Promise<void>
}
```

**Internal state:** Two `Map<ExportKey, …>` instances — one for state, one for error messages. Each export key is independent so concurrent row states never interfere.

**`triggerExport`:**
1. Derives key from `${format}-${tier}`.
2. Sets key state to `'generating'`.
3. Calls `fetch(apiUrl('/api/export/${format}?…'), { headers: authHeaders() })`.
4. On success: reads blob, creates object URL, triggers anchor download, revokes URL, sets state to `'success'`.
5. On error: sets state to `'error'`, stores message from `body.error ?? 'Export failed'`.
6. `'success'` auto-resets to `'idle'` after 3 seconds (via `setTimeout`).

**`triggerPrune`:**
1. Calls `POST /api/export/prune` with `{ family_id }` in body.
2. Sets `'prune'` key state to `'generating'` / `'success'` / `'error'`.
3. Does **not** handle confirmation — caller is responsible for double-confirm before invoking.

**Note:** The hook does not expose `'success'` state for prune — the component should navigate back or show an inline toast on completion.

---

## Section 2 — `DataSettings.tsx` changes

### Props interface changes

Remove `onComingSoon`. Add:
```ts
onNavigateToPlan: (sku: 'AI_ANNUAL' | 'SHIELD') => void
hasShield:        boolean   // replaces hasLegalBundle
```

### Report rows

| Row | Gate | Locked action | Badge label |
|---|---|---|---|
| Family Summary | None (session only) | N/A | N/A |
| Growth & Learning | `hasAiMentor` | `onNavigateToPlan('AI_ANNUAL')` | `Add AI Mentor` |
| Forensic Report | `hasShield` | `onNavigateToPlan('SHIELD')` | `Add Shield` |

### Copy changes

**Forensic Report row:**
- Label: `"Forensic Report"` (drop "Legal")
- Description: `"Tamper-evident record with secure digital signatures and device verification"`

**Note:** The HTML report itself keeps technical language (SHA-256, chain of custody) — its audience is legal professionals, not children or casual users.

### Data Pruning double-confirm

Local state `pruneStep: 'idle' | 'confirm' | 'pruning'` inside `DataSettings` (not in the hook — it's pure UI state).

- `pruneStep === 'idle'`: renders the normal destructive `SettingsRow`. Click → `setPruneStep('confirm')`.
- `pruneStep === 'confirm'`: row expands inline to a warning block with two buttons:
  - "Yes, archive old records" → calls `triggerPrune()`, sets `pruneStep('pruning')`
  - "Cancel" → `setPruneStep('idle')`
- `pruneStep === 'pruning'`: renders spinner inline, buttons disabled.
- On prune success: show toast "Archived X records", reset to `'idle'`.
- On prune error: show error toast, reset to `'idle'`.

Uses existing `SectionCard` styling — no new modal component.

---

## Section 3 — Shield SKU wiring

### `worker/src/types.ts`
- Add `'SHIELD'` to `PaymentType` union: `'LIFETIME' | 'AI_ANNUAL' | 'SHIELD'`
- Add `has_shield: boolean` to `TrialStatus`
- Add `has_shield: number` to `FamilyLicenseRow`

### `worker/src/routes/stripe.ts`
```ts
SHIELD: { amount: 14999, currency: 'gbp', label: 'Morechard Shield' }
```
Webhook handler: `SHIELD` payment sets `has_shield = 1` on the families row (permanent, like `has_lifetime_license`).

### `worker/src/lib/trial.ts`
- `getFamilyRow` query adds `has_shield` to SELECT
- `getTrialStatus` reads `has_shield` from row and returns it
- `checkTrialStatus` unchanged — Shield is additive, not a trial gate

### `worker/migrations/0038_shield_sku.sql`
```sql
ALTER TABLE families ADD COLUMN has_shield INTEGER NOT NULL DEFAULT 0;
```

### `app/src/lib/api.ts`
- Add `has_shield: boolean` to `TrialStatus` interface
- Remove `has_legal_bundle` (rename complete)

### `app/src/components/dashboard/ParentSettingsTab.tsx`
- Pass `hasShield={Boolean(trial?.has_shield)}` to `DataSettings`
- Wire `onNavigateToPlan` to open `BillingSettings` at the `'plan'` sub-view
  - `ParentSettingsTab` already manages sub-view state — no new navigation infrastructure needed

---

## Section 4 — Server-side tier enforcement

**In `worker/src/routes/export.ts`, `handleExportPdf`:**

After the family row is fetched, add tier checks before building the report:

```ts
if (tier === 'behavioral') {
  const family = await env.DB
    .prepare('SELECT ai_subscription_expiry FROM families WHERE id = ?')
    .bind(family_id).first<{ ai_subscription_expiry: string | null }>()
  const active = family?.ai_subscription_expiry
    && new Date(family.ai_subscription_expiry).getTime() > Date.now()
  if (!active) return error('AI Mentor subscription required', 403)
}

if (tier === 'forensic') {
  const family = await env.DB
    .prepare('SELECT has_shield FROM families WHERE id = ?')
    .bind(family_id).first<{ has_shield: number }>()
  if (!family?.has_shield) return error('Shield plan required', 403)
}
```

No gate for `tier === 'basic'` — valid JWT is sufficient.

---

## Section 5 — `POST /api/export/prune` route

**Location:** New exported function `handleExportPrune` in `worker/src/routes/export.ts`.

**Auth:** `requireAuth` + `requireRole('parent')` in `index.ts`. Lead-only check: worker queries `SELECT is_lead FROM family_roles WHERE user_id = ? AND family_id = ?` and returns 403 if not lead.

**Logic:**

```
cutoff = now() - 2 * 365 * 86400   (Unix seconds)
```

**Step 1 — identify candidates:**
```sql
SELECT id, record_hash, previous_hash
FROM ledger
WHERE family_id = ? AND created_at < ? AND pruned_at IS NULL
```

**Step 2 — archive (preserves hash chain):**
```sql
INSERT INTO ledger_prune_archive (ledger_id, record_hash, previous_hash, archived_at)
VALUES (?, ?, ?, unixepoch())
```

**Step 3 — anonymise ledger row PII:**
```sql
UPDATE ledger
SET description = '[archived]',
    ip_address  = NULL,
    receipt_id  = NULL,
    pruned_at   = unixepoch()
WHERE id = ? AND family_id = ?
```

> **Immutable trigger note:** `0001_initial_schema.sql` has a `BEFORE UPDATE ON ledger` trigger that raises an abort. Migration `0039` must also DROP this trigger and replace it with one that only aborts on updates to the hash-chain columns (`record_hash`, `previous_hash`, `amount`, `currency`, `entry_type`), while permitting updates to `description`, `ip_address`, `receipt_id`, and `pruned_at`. This is a required part of the migration.

**Step 4 — anonymise linked completions:**
```sql
UPDATE completions
SET proof_exif    = NULL,
    system_verify = NULL
WHERE chore_id IN (
  SELECT chore_id FROM ledger
  WHERE id = ? AND family_id = ?
)
```

*(Repeated per pruned ledger row, or batched with `WHERE chore_id IN (SELECT chore_id FROM ledger WHERE family_id = ? AND pruned_at = unixepoch())` in a single pass.)*

**Response:**
```json
{ "pruned": 12, "archived": 12 }
```

### `worker/migrations/0039_prune_archive.sql`
```sql
CREATE TABLE IF NOT EXISTS ledger_prune_archive (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id     INTEGER NOT NULL,
  record_hash   TEXT    NOT NULL,
  previous_hash TEXT    NOT NULL,
  archived_at   INTEGER NOT NULL
);

ALTER TABLE ledger ADD COLUMN pruned_at INTEGER;
```

### `worker/src/index.ts`
```ts
if (method === 'POST' && path === '/api/export/prune') {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth
  const roleCheck = requireRole(auth, 'parent')
  if (roleCheck instanceof Response) return roleCheck
  return handleExportPrune(request, env, auth)
}
```

---

## Section 6 — Graceful "archived" display for pruned completions

**Constraint:** When `pruned_at` is set on a ledger row, the linked completion's `proof_exif` and `system_verify` are NULL. The completions API already returns these as nullable. No API change needed.

**UI rule (applies to `HistoryTab.tsx` and any other completion-detail renderer):**

When rendering a completion's evidence block, check:
```ts
if (ledgerRow.pruned_at !== null && completion.proof_exif === null) {
  // render: "Details archived (2+ years old)"
}
```

This replaces the photo, EXIF data block, GPS/map, and device model fields with a single muted text line. The rest of the completion (chore name, amount, verification status, date) is unaffected.

**No changes required to API response shapes** — `pruned_at` is already returned on ledger rows (it's a column added by migration 0039). `proof_exif` and `system_verify` are already nullable on completions.

---

## Data flow summary

```
User clicks export
  → DataSettings calls useExportManager.triggerExport(format, tier)
  → Hook sets state 'generating', fetches /api/export/{format}?tier={tier}
  → Worker: requireAuth → tier gate check → query D1 → build HTML/JSON
  → Worker returns blob
  → Hook triggers browser download, sets state 'success' (auto-resets after 3s)

User clicks "Data Pruning"
  → pruneStep: idle → confirm (inline warning renders)
  → User clicks "Yes, archive old records"
  → pruneStep: pruning, calls useExportManager.triggerPrune()
  → Worker: requireAuth → requireRole(parent) → lead check → identify → archive → anonymise
  → Response { pruned, archived }
  → Toast: "Archived X records", pruneStep resets to idle

Locked row click
  → onNavigateToPlan('AI_ANNUAL' | 'SHIELD')
  → ParentSettingsTab opens BillingSettings at plan sub-view
```

---

## Open questions / future work

- The `onNavigateToPlan` prop currently opens `BillingSettings` at the plan list. A future iteration could scroll to or highlight the specific SKU card (AI_ANNUAL or SHIELD). Not blocking for this implementation.
- `ledger_prune_archive` has no cleanup mechanism — it grows indefinitely. Acceptable for now given families are unlikely to prune repeatedly. A future cron could compact it.
- Lead-only enforcement for pruning uses a query on `family_roles`. If the `is_lead` column exists on `family_roles` or `families`, prefer that over a separate query. Check schema before implementing.
