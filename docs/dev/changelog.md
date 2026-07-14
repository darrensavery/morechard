# Changelog

A running log of notable engineering work, grouped by day, for future reference. This is a summary of intent and impact — see `git log` for exact diffs.

---

## 2026-07-14

### Freshdesk → Zoho Desk support migration
Replaced Freshdesk entirely with Zoho Desk (EU data center) as the support ticketing system:
- Zoho Desk API client — OAuth token refresh, ticket search, ticket create (`2e85b9c`)
- Scheduled cron polling with cursor-based dedup replaces the old Freshdesk webhook ingestion (`e8c471e`, `105cd43`, `ae731ba`)
- In-app "Contact Support" form replaces the Freshdesk SSO button; submissions create a Zoho Desk ticket directly (`a619de1`, `67cf180`)
- `agent_incidents.source` enum value renamed `freshdesk` → `zoho_desk` (`b9716da`)
- Env vars, `wrangler.toml` domain vars corrected to the EU data center, and remaining Freshdesk references scrubbed from knowledge-base/docs (`a0aaac6`, `63dcc4c`, `4d29fb6`, `d020307`)
- Handled Zoho's `204 No Content` response for zero-match ticket searches, which had been treated as an error (`1121677`)
- Support playbook and runbook updated for the new provider (`4195843`)

### Autonomous Support Agent
- **Phase 0 (shadow mode)** merged in — diagnosis-only, no autonomous execution. See `docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md` and the Phase 0 plan (`f6eb6ab` merge, `375b642`).
- **Phase 1 — one-tap approve**: added a single AUTO-tier tool (`resend_magic_link`) a diagnosis can become eligible for via `isOneTapEligible()` (high confidence + deterministic identity + no harassment signal). Surfaced as a one-tap "Approve" link in the review-item email; execution is gated by single-use 48h approval tokens (`agent_approval_tokens`) and only ever fires on a human click — never from confidence or queue placement alone (`d2fafd4`, `d24a490`).
- Immediate email sent when a new agent review item is created (`1469936`).

### Agent Review admin panel (parent-admin UI)
Built out the reviewer workflow for support-agent diagnoses:
- Sort and filtering on the Agent Review tab (`b9a14a4`)
- Draft replies render as formatted HTML with a copy button (`3cf33db`, escaped a backslash-regex bug this introduced in `448e96c`)
- One-click "Send Reply" posts the draft straight to the Zoho ticket (`99e99f9`)
- In-admin Approve button plus Declined/Executed history tabs (`d4dbdfa`)
- `created_at` timestamp shown on review cards (`17d0042`)
- `ZOHO_FROM_EMAIL` corrected to the actual verified Zoho Desk sender (`35969c3`)

### Production data-integrity fixes
All three found live while debugging why the Zoho Desk cron poll never ran — the poll step never got that far:
- `currency_snapshots`, `payday_log`, `bonus_payments` FKs still pointed at `ledger_old`, a table that stopped existing after migration 0019's rename-swap; every `scheduled()` invocation was crashing before reaching the payday sweep, GDPR purge, or Zoho poll. Zero-data-loss rebuild, since the crash meant these tables were always empty (`e81d4fd`).
- `marketing_consents` and `email_sends` (from migration 0047) were missing from production with no record of why, crashing `POST /api/consent/marketing` and the dead Resend-based re-engagement cron on every tick. `marketing_consents` recreated (migration 0081) and now syncs opt-ins to Brevo list 5 as best-effort (DB write remains the compliance source of truth). The dead Resend re-engagement path (`marketing-emails.ts`, `EmailService`) was removed outright rather than restored (`7695aae`).
- `shared_expenses.is_seed` column, missing since the same data-integrity gap, recreated (`7d0f543`).

### Concurrency fixes
Closed check-then-act races that could collide under simultaneous requests: hash-chain ledger insert now retries on `UNIQUE` collision instead of failing; chore-approval status update and invite-code redemption now atomically claim their row before writing (`2f9cecf`).

### Other
- Legal copy (Privacy Policy, Terms) corrected to match the actual product: Stripe not Paddle, one-time pricing not subscriptions, OpenAI disclosed as an AI Mentor sub-processor, court-use language reconciled with the Shield AI Forensic Report tier (`ff2c423`, dated 07-09 but same effort).
- Cyber Essentials readiness checklist added (`375b642`).
- Workers Observability logs mirrored into `wrangler.toml` for dashboard visibility (`250ca01`).
- **Magic-link sign-in email** brought in line with the actual brand: correct teal (`#00959c`, not the `#0f6b4f`/`#0d9488` used before), real tree logo mark, Manrope font, plain dark wordmark text matching `FullLogo` (not the unused split-color `BrandWordmark`) (`1e7e98f`, `576f750`). Corrected a stale brand memory that had the wrong teal value and wrongly assumed the wordmark was split-colored.

### CI safety net — worker now type-checks and tests before every deploy
Prompted by discovering the `ledger_old` FK bug and the missing `marketing_consents`/`email_sends` tables above — both had been silently crashing every cron tick for months. An audit found Sentry was actually capturing both exceptions the whole time (nobody was alerted loudly enough to notice), and that `.github/workflows/worker-deploy.yml` ran `npm ci` + deploy with **no test run, no type-check, and no migration check at all**, despite 34 test files (333 tests) sitting unused in CI.
- Added a `test` job (`tsc --noEmit` + `vitest run`) that both `preview` and `deploy` now depend on (`e0cfc97`)
- Before gating on it, ran both against `main` to size up existing debt: tests were already clean (333/333), but 12 pre-existing type errors existed. Fixed all 12 rather than gate around them — `registerTool()` made generic instead of needing an unsafe cast at every agent-tool call site (7 of the 12), a test's `as never` cast that was hiding a real field from the inferred return type, a few unused imports/locals, and a Resend error-body that was fetched but never logged (`e0cfc97`)
- Deliberately **not** done (see reasoning below): a migration-drift check and a real `scheduled()` test harness. The drift check wouldn't have caught the `ledger_old` bug (it was wrong on the day it was written, not drifted later); the full harness is real ongoing maintenance whose payoff mostly overlaps with just making Sentry alerting loud enough. Next step if a third silent-cron bug appears: revisit this, since it'd mean detection — not escalation — is the actual gap
- **Follow-up still open**: configure a Sentry alert rule on first-occurrence exceptions in `scheduled()`, not just volume/frequency spikes — this is dashboard config, not code, and wasn't done in this session
