# Shared Expense Presets + Receipt Upload — Design

**Date:** 2026-05-04
**Status:** Design — awaiting user sign-off before plan
**Touches:** `app/src/components/dashboard/AddExpenseSheet.tsx`, `worker/src/routes/sharedExpenses.ts`, `worker/src/lib/sharedExpenseHash.ts`, new client util, new D1 migration, new worker routes, R2 receipts prefix.

---

## 1. Problem

The current shared-expense logging flow (`AddExpenseSheet.tsx`) asks parents to type a free-text description and pick from 6 broad categories (Education, Health, Clothing, Travel, Activities, Other). Two problems:

1. **Wording drift** — the same expense is logged inconsistently across time and across co-parents (e.g. "school trip", "School Trip — Year 6", "PGL £35"). This weakens the audit value of the Shield-Plan court-ready PDF.
2. **No quick path** — every entry requires typing. The chore side of the app already solved this with the Rate Guide tile + search pattern (`CreateChoreSheet.tsx`); shared expenses lag behind.

Separately, there's no way to attach a **receipt** to an expense. Receipts are the strongest evidentiary artefact for separated-parent disputes; their absence weakens the Shield Plan's core value proposition.

## 2. Goals

- Speed up logging of common expenses to two taps + an amount.
- Enforce consistent wording so categorised reports and court PDFs read cleanly.
- Allow a receipt image (or PDF) to be attached to any expense, with client-side compression so 48MP phone photos don't fail the upload cap.
- Keep the change scoped — re-use the existing chore patterns rather than inventing a new system.
- Add an explicit `expense_date` field so parents can backfill expenses (matches the knowledge-base copy that already promises this).

## 3. Non-goals

- No median price benchmarks for expenses (unlike chores). School-trip and uniform prices vary too widely by school/region for medians to be useful.
- No standalone "Expense Guide" sheet equivalent to `RateGuideSheet` / `ChoreGuideSheet`. The picker is the guide.
- No multi-receipt support per expense in v1. Re-upload replaces the previous receipt.
- No HEIC decoding library in the bundle. We rely on browser support and a clear fallback message.
- No retrofit of compression to chore-proof uploads in this spec (flagged as a follow-up).
- No backfill of categories on existing rows. The new categories (`childcare`, `food`, `tech`, `gifts`) only apply to new entries.

## 4. Decisions and rationale

| # | Decision | Rationale |
|---|---|---|
| Q1 | Tappable preset library that pre-fills description + category AND ensures consistent wording | Combines speed and consistency; both matter for the Shield Plan PDF |
| Q2 | Search-first UI mirroring `CreateChoreSheet` (tile grid + fuzzy search dropdown) | Re-uses the established mental model; minimal new code |
| Q3 | Name + category only — no median amount benchmarks | Shared expenses vary wildly; medians would mislead more than help |
| Q4 | 10 categories, 65 presets (4 new categories: Childcare, Food, Tech, Gifts) | Coarse 6-category bucket fails the audit test for separated-parent disputes |
| Q5 | One universal preset list with localised wording per locale | Underlying concepts are universal; per-locale wording is a flat translation table |
| — | Static client-side TS catalogue (`sharedExpensePresets.ts`) | No median data to keep current → no D1 table justified |
| — | Include `expense_date` and `note` columns | Knowledge base already promises a date field; note matches the chore description pattern |
| — | Add `Upload Receipt` with R2 storage, client-side compression, two-button picker (Take photo / Upload from device) | Receipts are court-defensible artefacts; compression is needed because chore proofs already hit the 10MB cap with HEIC photos |
| — | Receipts: single per expense, no auto-deletion, included in hash chain | Single keeps v1 lean; no deletion because they are evidentiary; hash-chain inclusion keeps the cryptographic seal honest |
| — | Receipt deletion: 48-hour window from upload (any plan); after 48h, **Void-and-Re-log** is the only path | 30 days is too generous for the Shield Plan's high-conflict threat model; 48h covers honest mistakes only |
| — | Court-PDF export embeds receipts as a numbered **Exhibit section** (PDFs appended, images embedded inline) | Links to R2 are not court-friendly; physical pages in the bundle are |
| — | New dedicated `RECEIPTS` R2 bucket (not a prefix on `EVIDENCE`) | Prevents any future cleanup of chore proofs from accidentally wiping evidentiary receipts |
| — | `hash_version` as a column, not a leading byte | Easier for queries and future migrations |
| — | `legally_distinguishable: true` flag on certain presets auto-expands and autofocuses the note field | Judges look for "why" — encourages parents to capture intent at logging time |

## 5. The catalogue

10 categories, 64 presets. 8 universal "Quick Pick" tiles surface as icon buttons; the rest are reachable via fuzzy search.

### Quick Pick tiles (top 8)

| # | Preset | Category |
|---|---|---|
| 1 | School trip | Education |
| 2 | School uniform | Clothing |
| 3 | Lunch money / lunch account | Food |
| 4 | Sports club fees | Activities |
| 5 | Birthday gift | Gifts |
| 6 | Doctor / dentist visit | Health |
| 7 | Childcare / wraparound | Childcare |
| 8 | Shoes | Clothing |

### Full catalogue

**Education (8)** — School trip / field trip · School supplies & stationery · Textbooks · Tutoring / extra lessons · Exam fees *(UK GCSE/A-Level, US ACT/SAT/AP, PL matura)* · Music lessons · Yearbook *(US-only)* · School photos

**Health (8)** — Doctor / GP visit · Dentist · Orthodontist / braces · Optician / glasses / contact lenses · Prescription medicine · Therapy / counselling · Vaccinations · Medical equipment / orthotics

**Clothing (6)** — School uniform · Shoes · Coat / outerwear · Sportswear / kit · Everyday clothes · Special-occasion outfit

**Travel (5)** — Family holiday share · Visiting other parent (transport) · School residential / overnight trip · Public transport pass · Passport / visa fees

**Activities (9)** — Sports club / team fees · School clubs / extra-curricular *(chess, drama society, coding club, choir, debate)* · Sports equipment & kit · Music / instrument lessons · Drama / dance classes · Scouts / Brownies / cadets *(UK)* / Scouting *(US)* / harcerze *(PL)* · Summer camp / holiday club · Swimming lessons · Martial arts

**Childcare (5)** — Childminder / nursery · Wraparound / breakfast / after-school care · Babysitter · Nanny share · Holiday childcare

**Food (3)** — School lunch money / account · Special diet groceries · Birthday / event catering

**Tech & Devices (5)** — School laptop / tablet · Phone (device) · Phone bill / data plan · Headphones / accessories · Software / app subscriptions (educational)

**Gifts & Celebrations (6)** — Birthday gift (for child) · Christmas / holiday gift · Birthday party costs · Other family gift (from child) · Religious milestone *(communion, bar/bat mitzvah, etc.)* · School prom / graduation

**Other (6)** — Pocket money top-up · Pet costs (child's pet) · Hobby supplies · Hairdresser / barber · Subscription / membership · Custom expense *(opens free-text)*

Region-flagged items (e.g. "Yearbook" US-only) are filtered out of suggestions when the family's region doesn't match. PL/US-locale wording is provided per preset via a `locale_overrides` map.

### 5.1 Search aliases

Every preset gets a `search_aliases` array so parents searching by broad concept hit the right item. Examples:

- *Doctor / dentist visit* → `['medical', 'GP', 'doctor', 'dentist', 'check-up', 'appointment']`
- *Shoes* → `['uniform', 'trainers', 'school shoes', 'football boots', 'pumps']`
- *School uniform* → `['uniform', 'shirt', 'trousers', 'skirt', 'tie', 'blazer', 'PE kit']`
- *Sportswear / kit* → `['kit', 'football kit', 'rugby kit', 'PE', 'tracksuit']`
- *Wraparound / breakfast / after-school care* → `['after-school', 'before-school', 'breakfast club', 'wraparound']`
- *Therapy / counselling* → `['mental health', 'counselling', 'CBT', 'therapy', 'psychologist']`
- *Lunch money / lunch account* → `['dinner money', 'lunch', 'ParentPay', 'school meals']`

Aliases are matched via the existing `fuzzyMatch` util (already used by `useMarketRates`).

## 6. Architecture

### 6.1 Static catalogue file

`app/src/lib/sharedExpensePresets.ts`

```typescript
export type ExpenseCategory =
  | 'education' | 'health' | 'clothing' | 'travel' | 'activities'
  | 'childcare' | 'food'   | 'tech'     | 'gifts'  | 'other';

export type ExpensePreset = {
  id: string;                                  // stable slug, e.g. 'school-trip'
  name: string;                                // canonical English name
  category: ExpenseCategory;
  is_top_8: boolean;
  regions?: ('UK' | 'US' | 'PL')[];           // undefined = universal
  locale_overrides?: {
    'en-US'?: string;
    'pl'?: string;
  };
  search_aliases?: string[];                   // for fuzzy match (e.g. ['lunch', 'dinner money', 'medical', 'GP'])
  legally_distinguishable?: boolean;           // auto-expands + autofocuses the note field on selection
};

export const PRESETS: ExpensePreset[] = [ /* 64 entries */ ];

export function getPresetsForRegion(region: 'UK' | 'US' | 'PL'): ExpensePreset[];
export function localiseName(preset: ExpensePreset, locale: string): string;
```

The icon mapping for the 8 tiles lives alongside the catalogue, mirroring the `TILE_ICONS` map in `CreateChoreSheet.tsx`.

### 6.2 D1 schema migration

`worker/migrations/00XX_shared_expense_extensions.sql`:

```sql
ALTER TABLE shared_expenses ADD COLUMN expense_date TEXT;
ALTER TABLE shared_expenses ADD COLUMN note TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_r2_key TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_hash TEXT;
ALTER TABLE shared_expenses ADD COLUMN receipt_uploaded_at INTEGER;
ALTER TABLE shared_expenses ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;

-- Void-and-re-log support (48-hour delete window, then this becomes the only path)
ALTER TABLE shared_expenses ADD COLUMN voided_at INTEGER;          -- unix ms; null = active
ALTER TABLE shared_expenses ADD COLUMN voided_by TEXT;             -- user_id of the parent who voided
ALTER TABLE shared_expenses ADD COLUMN voids_id TEXT;              -- FK to the row this row replaces; null on originals

-- Update CHECK constraint on category to include the new values.
-- D1 doesn't support ALTER COLUMN — done by table rebuild via temp table.
```

Existing rows get `hash_version = 1` (legacy hash input). New rows write `hash_version = 2` (extended hash input including `expense_date`, `note`, `receipt_hash`, and the void linkage). Verification reads `hash_version` per row and applies the matching derivation. Voided rows retain their original hash; the new replacing row gets its own hash entry referencing `voids_id`.

The `category` CHECK rebuild expands the allowed enum from `('education','health','clothing','travel','activities','other')` to also include `'childcare','food','tech','gifts'`. Existing rows retain their current values; nothing is migrated.

### 6.3 Hash chain update

`worker/src/lib/sharedExpenseHash.ts` currently derives the row hash from the original column set. The hash input must be extended to incorporate `expense_date`, `note`, `receipt_hash`, `voided_at`, and `voids_id` so these fields are all inside the cryptographic seal.

**Versioning:** `hash_version` is a column on the row. Existing rows are `hash_version = 1` and verify with the legacy derivation. New rows are `hash_version = 2` and verify with the extended derivation. The verifier dispatches by version per row, so the chain stays intact across the upgrade. A v2 row's hash also incorporates `hash_version` itself, which makes downgrade attacks (rewriting a row as v1 to drop fields from the seal) detectable.

### 6.4 Worker routes

| Route | Purpose | Notes |
|---|---|---|
| `POST /api/shared-expenses` | Existing — create expense | Payload extended with `expense_date`, `note`, `category` (now any of 10 values) |
| `POST /api/shared-expenses/:id/receipt` | New — upload receipt bytes | Mirrors `handleProofUpload`. Allowed types: JPEG, PNG, WebP, HEIC, **PDF**. Max 10MB. Hashes payload, writes to R2, updates row, re-derives row hash entry. |
| `GET /api/shared-expenses/:id/receipt` | New — fetch presigned R2 URL | 1-hour expiry; same pattern as `handleProofGet` |
| `DELETE /api/shared-expenses/:id/receipt` | New — removes receipt only (not the expense). Allowed on **any plan** within **48 hours** of receipt upload; returns 409 after that with a payload pointing to the Void-and-Re-log flow. | Tight window covers honest mistakes; high-conflict co-parents can't quietly retcon receipts weeks later. |
| `POST /api/shared-expenses/:id/void` | New — voids the expense row, optionally creates a replacement | Available on any plan, no time limit. Sets `voided_at`, `voided_by`. If `replacement: { ... }` is in the body, creates a new row with `voids_id` pointing back. Both rows remain in the hash chain and appear in the court PDF as "Voided 2026-05-12 by [parent]" with the replacement labelled accordingly. |

**Bucket:** new dedicated `RECEIPTS` R2 bucket (binding name `RECEIPTS`), separate from `EVIDENCE`. Hard separation against any future cleanup script on chore proofs.

**Key format:** `{family_id}/{shared_expense_id}/{timestamp}.{ext}` (no `receipts/` prefix needed since the bucket is dedicated).

**No 90-day lifecycle policy.** Receipts persist for the lifetime of the family account; cascaded delete only via the existing "Uproot" flow.

### 6.5 Client-side image compression

`app/src/lib/imageCompression.ts` (new shared util — also retrofittable to chore proofs in a later change).

```typescript
export async function compressImage(file: File): Promise<File>
```

Behaviour:

- **PDF** (any size up to 10MB) → pass through unchanged.
- **Image < 500KB** → pass through unchanged.
- **HEIC** → attempt `createImageBitmap`. On success, run resize/encode pipeline. On failure (Chrome on Android, most cases), pass original through up to 10MB cap.
- **JPEG / PNG / WebP > 500KB** → resize longest edge to 1600px, re-encode JPEG at q=0.82.
- **EXIF preservation:** if input was JPEG with an APP1 segment, splice it back into the compressed output so the worker's existing `extractExif` logic still works on receipts.
- **Final size > 10MB** → throw with a user-friendly error: "Image too large after compression — try a smaller photo."

Compression runs in a Web Worker if file >2MB to avoid main-thread jank; inline otherwise.

### 6.6 UI changes — `AddExpenseSheet.tsx`

Replaces the current free-text description + `<select>` category combo with the Rate-Guide pattern:

1. **Quick Pick tile grid** (8 icons, 4-column layout, mirrors `CreateChoreSheet` lines 405–429).
2. **Search input** below — typing matches against `PRESETS` via `fuzzyMatch`. Selecting a result fills the title, sets the category, and shows the "Filed under: X" chip.
3. **"Filed under: X" chip** (replaces the category dropdown). For custom typed entries, defaults to `other` with a pencil icon to override via a popover of the 10 category text pills.
4. **Date row** — new explicit `expense_date` input next to the amount field. Defaults to today.
5. **Co-parenting split slider** — unchanged.
6. **Receipt section** — collapsible (collapsed by default). When opened:
   - Two buttons: **Take photo** (`<input type="file" accept="image/jpeg,image/png" capture="environment">`) and **Upload from device** (`<input type="file" accept="image/*,application/pdf">`).
   - After selection: thumbnail preview + "Replace" button. PDFs show a generic PDF icon.
   - HEIC fallback message if Canvas decode fails: "iPhone HEIC photos can't always be processed in the browser. Tap **Take photo** instead, or open the photo on your iPhone, tap Share → Save as JPEG."
7. **"+ Add note" collapsible** — optional text area, mirrors the chore description pattern. **Auto-expanded and autofocused** when the selected preset has `legally_distinguishable: true` (e.g. Special diet groceries, Therapy/counselling, Medical equipment, Custom expense). Placeholder copy hints at the *why*: e.g. *"e.g. Prescribed gluten-free diet — supplier: Schar"*.

8. **Void-and-Re-log flow** — on an existing logged expense (in PoolTab/SettlementCard, not the Add sheet), a "Void" action triggers a confirmation modal:
   - Required reason text (free-form, stored in the new row's `note` if a replacement is created, otherwise on the voided row).
   - Optional "Re-log with corrected details" toggle that opens the Add sheet pre-filled from the voided row, on submit creates the new row with `voids_id` pointing back.
   - The original row remains visible in the list with a "Voided" badge; tapping shows when, by whom, and the replacement (if any).

### 6.7 Court-PDF export — Exhibit section

The Shield Plan's court-ready PDF export (in `worker/src/routes/export.ts`) is updated so receipts are physically embedded in the bundle, not linked.

- **Section structure:** the existing financial summary is unchanged; a new **"Exhibits"** section is appended at the end of the PDF.
- **Numbering:** each exhibit is labelled `Exhibit A`, `Exhibit B`, … in chronological order, cross-referenced from the corresponding row in the financial summary table.
- **Image receipts:** embedded inline at print quality. Source images are downscaled at PDF-generation time to a max long edge of 1600px and re-encoded JPEG q=0.85, then placed one per page with caption `Exhibit X: [expense name] — [expense_date] — uploaded [receipt_uploaded_at]`.
- **PDF receipts:** appended as additional pages via [`pdf-lib`](https://pdf-lib.js.org/) (`PDFDocument.copyPages` → `addPage`). ~50KB gzipped, runs comfortably in a Worker.
- **Voided expenses:** appear in the financial summary with a strike-through and "Voided 2026-05-12 by [parent]" annotation. Their receipts (if any) still appear in the Exhibits section, labelled `Exhibit X (Voided)`. Replacement rows reference both the original `Exhibit X` and their own `Exhibit Y`.
- **Implementation note:** the export route already streams from R2; the new logic adds a second pass for the `RECEIPTS` bucket and a final `pdf-lib` merge step. The route's existing memory budget should be re-checked for very large families with many receipts (flagged as a follow-up task).

### 6.8 Submit flow

1. `POST /api/shared-expenses` — creates the row with `expense_date`, `note`, derived `category`, etc.
2. If a receipt was attached: `POST /api/shared-expenses/:id/receipt` with raw image bytes.
3. If receipt upload fails after the expense is saved: non-blocking banner "Expense saved, but receipt failed to upload. Tap to retry." Saving without a receipt is fine (receipts are optional).

## 7. Affected files

**New**
- `app/src/lib/sharedExpensePresets.ts` — catalogue (65 entries) + helpers
- `app/src/lib/imageCompression.ts` — Canvas-based compression util
- `worker/migrations/00XX_shared_expense_extensions.sql` — schema additions (incl. `hash_version`, void columns)
- `worker/src/routes/sharedExpenseReceipt.ts` — `POST` / `GET` / `DELETE` (48h-gated) receipt routes
- `worker/src/routes/sharedExpenseVoid.ts` — `POST /api/shared-expenses/:id/void` with optional replacement payload
- `pdf-lib` dependency on the worker side (~50KB gzipped) — for appending PDF receipts to the export bundle

**Modified**
- `app/src/components/dashboard/AddExpenseSheet.tsx` — full UI rebuild around the new pattern
- `app/src/components/dashboard/PoolTab.tsx` and/or `SettlementCard.tsx` — Voided badges, Void action, Re-log entry point
- `worker/src/routes/sharedExpenses.ts` — accept new fields on POST; route registrations for receipt + void
- `worker/src/lib/sharedExpenseHash.ts` — extend hash input; dispatch by `hash_version`
- `worker/src/routes/export.ts` — append Exhibits section, embed images, merge PDF receipts via `pdf-lib`
- `worker/src/types.ts` — env binding for the new `RECEIPTS` R2 bucket
- `wrangler.toml` — declare the new `RECEIPTS` R2 bucket binding

**Untouched but referenced**
- `app/src/components/dashboard/CreateChoreSheet.tsx` — pattern source
- `app/src/hooks/useMarketRates.ts` — `fuzzyMatch` reused
- `worker/src/routes/proof.ts` — pattern source for upload/get/EXIF

## 8. Testing plan

- **Catalogue file** — unit test that every preset has a unique slug; that all `is_top_8` items number exactly 8; that `getPresetsForRegion('UK')` excludes `regions: ['US']` items.
- **Compression util** — fixture-based tests with known-size JPEG, PNG, WebP, HEIC, PDF. Assert: PDF passes through, small JPEG passes through, large JPEG resizes, EXIF APP1 round-trips through compression.
- **Worker** — integration test: POST expense → POST receipt → GET receipt returns presigned URL. Assert hash chain verifies for the new row. Assert receipt upload after 30 days on Shield Plan still allows DELETE for non-Shield families and 409s for Shield families.
- **End-to-end** — manual test on a real phone for: HEIC iPhone Safari path, JPEG Android Chrome path, PDF email-forwarded path, gallery-uploaded path.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| HEIC fails silently for some iPhone users | Two-button UI surfaces the camera path explicitly; clear error message guides toward "Take photo" or manual conversion |
| Hash chain version handling has a bug, breaks audit verification | Version tag is added before any new column is written; verify path tests both v1 and v2 rows |
| Receipt R2 storage costs grow unbounded (no auto-deletion) | Acceptable — Shield Plan is paid; family deletion ("Uproot") cascades and removes receipts |
| Static catalogue drifts from real-world expense vocabulary | Catalogue is one PR away from edit; no migration needed |
| Existing rows have null `expense_date` after migration | UI treats null as "unknown date"; export PDF labels them "Date not recorded" |

## 10. Open questions

- **Whether to retrofit `compressImage` to chore proofs** in this same spec, or as a follow-up. Recommend follow-up — keeps this spec focused, gets the util battle-tested on receipts first.
- **Worker memory budget on Exhibits-heavy exports.** A family with 200 receipts at ~400KB each plus a 50-page PDF base will push CPU/memory limits on the Worker. Mitigation options: (a) cap exhibits per export with overflow into a second PDF, (b) move export to a Durable Object or queue if it doesn't fit. Decide during implementation once we have realistic numbers.

## 11. Out of scope (follow-ups)

- Retrofitting `compressImage` to `ChildDashboard.tsx` chore-proof uploads.
- HEIC→JPEG via lazy-loaded `heic2any` if Sentry data shows real failure rates.
- Multi-receipt-per-expense support.
- An "Expense Guide" sheet equivalent to `RateGuideSheet` (out of scope until Morechard has enough expense data to compute meaningful ranges).
- Court-PDF rendering of PDF receipts as embedded attachments (separate work in the Shield Plan export route).
