---
feature: 09-shared-expenses
title: Shared Expenses & Pool
---

### Purpose

Enables co-parents or separated households to log, verify, and reconcile child-related shared expenses (education, health, clothing, etc.) with a cryptographic hash chain that makes every committed record tamper-evident. Each expense goes through a configurable approval workflow before it counts toward the shared settlement, giving both parents an auditable record of who paid what.

### Methodology

**Verification modes and auto-commit logic**
- Expenses are created via `POST /api/shared-expenses`. The worker reads the family's `verify_mode` and `shared_expense_threshold` from D1. If the family is in `amicable` mode or the amount is at or below the threshold, the expense is committed immediately (`committed_auto`) and its SHA-256 hash chain entry is written atomically. Otherwise the expense sits as `pending` and an approval email is dispatched to the other parent.
- `POST /api/shared-expenses/:id/approve` — Parent B commits a pending expense. The handler verifies the caller did not log the expense (self-approval blocked), then computes and writes the `record_hash` using the chain tail (`getLastCommittedHash`).
- `POST /api/shared-expenses/:id/reject` — Marks the expense `rejected`; it is excluded from settlement but retained in the DB.
- `DELETE /api/shared-expenses/:id` — Soft-delete (sets `deleted_at`). Only allowed while status is `pending` or `rejected`; committed rows are immutable.

**Hash chain**
Every committed row stores `previous_hash` (tail of the family's chain) and `record_hash` (SHA-256 over id, family, amount, currency, split_bp, previous_hash, expense_date, note, receipt_hash, voided_at, voids_id). Voiding, receipt upload/delete, and replacement creation all recompute the hash atomically in a D1 batch so the chain remains consistent.

**Void and correction flow**
`POST /api/shared-expenses/:id/void` marks the original row with `voided_at` and re-hashes it if it was committed. An optional `replacement` body field creates a corrected successor row (linked via `voids_id`) which goes through the same auto-commit/pending logic.

**Receipt management**
- `POST /api/shared-expenses/:id/receipt` — any parent uploads a JPEG/PNG/WebP/HEIC/PDF (max 10 MB). The file is written to Cloudflare R2 (`RECEIPTS` bucket) at key `{family_id}/{expenseId}/{timestamp}.{ext}`. A SHA-256 of the bytes is stored as `receipt_hash` and folded into the record hash for committed rows.
- `GET /api/shared-expenses/:id/receipt` — returns an R2 presigned URL (1-hour expiry).
- `DELETE /api/shared-expenses/:id/receipt` — logging parent only; 48-hour window enforced server-side.

**Settlement reconciliation**
`POST /api/shared-expenses/reconcile` aggregates all uncommitted committed expenses for the requested `YYYY-MM` period, computes `net_pence` using each row's `split_bp` basis-point ratio, marks rows `reconciled_at`, and returns the settlement summary.

**UI components**
- `AddExpenseSheet.tsx` — form to log a new expense
- `PoolTab.tsx` — family expense list and settlement summary
- `VoidExpenseSheet.tsx` — void + optional replacement flow
- `SettlementCard.tsx` — net balance display
- `SpendGuideSheet.tsx` — category/amount guidance
- `ExpenseDetailSheet.tsx` — per-expense detail and receipt viewer

### Dependencies

- **External packages / Cloudflare services**: Cloudflare D1 (primary data store), Cloudflare R2 (`RECEIPTS` binding for receipt storage and presigned URLs), `crypto.subtle` (Web Crypto API for SHA-256 hashing)
- **Internal modules**: `worker/src/lib/sharedExpenseHash.ts` (`computeSharedExpenseHashV2`, `getLastCommittedHash`, `GENESIS_HASH`), `worker/src/routes/auth.ts` (`AuthedRequest`, `sendApprovalEmail`), `worker/src/lib/response.ts`, `worker/src/lib/logger.ts`
- **APIs / services**: `sendApprovalEmail` from the auth route (triggers an email notification to the co-parent when an expense requires manual approval); no third-party payment or external APIs are called at expense-log time
