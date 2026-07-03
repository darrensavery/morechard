---
feature: 04-chore-management
title: Chore Management
---

### Purpose

Chore management gives parents a structured way to create, assign, schedule, and approve household tasks with real-money payouts tied to child completion. It solves the full loop from task creation through child submission, parent review, and optional ledger write, supporting both single-parent and co-parenting households with flexible assignment and proof requirements.

### Methodology

**Chore lifecycle (worker/src/routes/chores.ts)**
- `POST /api/chores` — creates a chore record with assignment mode (`named` / `anyone` / `everyone`), frequency (`daily` / `weekly` / `one_off`), payout amount, optional photo-proof flag, and auto-approve flag; triggers lazy completion generation.
- `PUT /api/chores/:id` — updates chore fields; re-runs completion planning if schedule or assignment changes.
- `DELETE /api/chores/:id` / `POST /api/chores/:id/restore` — soft-archive / restore.
- `POST /api/chores/:id/claim` — child claims an `anyone`-mode open chore, converting it to a named assignment.
- `POST /api/chores/:id/submit` — child submits a completion (with optional proof image URL); transitions status to `awaiting_review` or auto-approves if the flag is set.

**Lazy completion generation (worker/src/routes/completionGeneration.ts)**
- `planCompletionGeneration` is a pure function that diffs existing completions against active chores and returns a `GenerationPlan` (rows to insert, rows to skip). Called on chore create/update and on list requests to fill forward any missing slots without a background scheduler.

**Completion approval (worker/src/routes/completions.ts)**
- `POST /api/completions/:id/approve` — writes an immutable ledger entry and marks completion `approved`.
- `POST /api/completions/:id/reject` — marks `rejected`; completion is removed from the child's queue.
- `POST /api/completions/:id/revise` — sends revision feedback text back to child; status becomes `needs_revision`.
- `POST /api/completions/approve-all` — bulk approves all pending completions for a family in one request.
- `POST /api/completions/:id/rate` — parent rates a completed chore 1–5 stars.

**UI components**
- `CreateChoreSheet.tsx` — form for chore creation/editing with market-rate tile grid, fuzzy chore search, child assignment picker, frequency selector, and completion-rule toggles.
- `JobsTab.tsx` — parent dashboard listing active chores with edit, archive, and weekly-plan scheduling.
- `PendingTab.tsx` — approval queue with proof image display, revision flow, approve-all, and payment-bridge deep-link.
- `EarnTab.tsx` — child view of available and in-progress tasks with submission, proof upload, and revision-feedback display.

### Dependencies

- **External packages**: Cloudflare D1 (SQL persistence for chores, completions, ledger), Cloudflare R2 (proof image storage URLs), Sentry (error capture in worker routes)
- **Internal modules**: `worker/src/routes/completionGeneration.ts` (plan logic called from chores.ts), `worker/src/routes/finance.ts` (ledger write on approval), shared auth middleware for family/parent/child role checks
- **APIs / services**: `GET /api/market-rates` (rate suggestions in CreateChoreSheet), `POST /api/ledger` (implicit via approve handler), Payment Bridge (PendingTab deep-link to Monzo/Revolut/PayPal)
