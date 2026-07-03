---
feature: 11-payment-bridge
title: Payment Bridge
---

### Purpose

Payment Bridge tracks whether a parent has physically handed over money owed to a child for completed chores. It stamps a `paid_out_at` delivery flag on `completions` rows without touching the immutable ledger or hash chain, giving parents a lightweight way to confirm cash has changed hands and letting both parties see what remains outstanding.

### Methodology

**API endpoints (worker/src/routes/payments.ts)**

- `POST /api/completions/:id/mark-paid` — stamps a single completion as paid. Idempotent: if already stamped it returns the existing timestamp with `was_already_paid: true`. Uses a conditional `UPDATE … WHERE paid_out_at IS NULL` to win races against concurrent callers.
- `POST /api/completions/mark-paid-batch` — validates up to 100 completion IDs in one query (same family, `status = 'completed'`), then issues a D1 `batch()` of UPDATE statements atomically. Already-stamped rows are skipped silently; returns `stamped` count.
- `GET /api/completions/unpaid-summary?family_id=` — aggregates completed-but-unpaid completions per child with `SUM(reward_amount)` and `COUNT(*)`, grouped by `child_id` and `currency`. Parent-only.
- `PATCH /api/child/:id/payment-handles` — stores Monzo, Revolut, PayPal, and Venmo usernames on the child's `users` row. Strips leading `@`. These handles are used by the UI to construct deep-link payment URLs.

**UI (app/src/components/dashboard/LogSpendSheet.tsx)**

The spend-logging sheet lets a child record a purchase against their balance. It posts to `POST /api/spending` (in finance.ts), selecting a category from a fixed taxonomy and optionally linking the spend to a goal. This is a parallel flow to payment stamping — it tracks child outgoings, not parental pay-outs.

**Data flow**: `completions.paid_out_at` (Unix timestamp) is the only field written. No ledger row is created; the hash chain is never touched.

### Dependencies

- **External packages**: None beyond the Cloudflare Worker runtime
- **Internal modules**:
  - `worker/src/lib/response.ts` — `json()`, `error()`, `parseBody()`
  - `worker/src/lib/jwt.ts` — `JwtPayload` type and auth extraction
  - `worker/src/types.ts` — `Env` binding types
  - `worker/src/routes/finance.ts` — parallel finance routes (`/api/spending`, `/api/payouts`, `/api/bonus`)
- **APIs / services**:
  - Cloudflare D1 (`env.DB`) — all reads and writes; `batch()` used for atomic multi-row stamping
  - No third-party payment processors are called; deep-link handles (Monzo/Revolut/PayPal/Venmo) are stored as plain strings and rendered client-side
