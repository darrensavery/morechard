# Changelog

A running log of notable engineering work, grouped by day, for future reference. This is a summary of intent and impact — see `git log` for exact diffs.

---

## 2026-07-15

### Turnstile activated
Created the Cloudflare Turnstile site (`app.morechard.com`, Managed mode) and wired in both keys: `TURNSTILE_SECRET_KEY` set on the production Worker (`wrangler secret put`), `VITE_TURNSTILE_SITE_KEY` added to `app/.env.production` (public key, safe to commit — same pattern as the existing `VITE_POSTHOG_KEY`). The plumbing from the fourth security-audit pass earlier today is now live rather than a no-op — login, magic-link request, and invite redemption are all actually challenge-protected. Also documented the test-key pattern for local dev in `worker/.dev.vars.example`.

### Production security audit — school-endorsement readiness pass
Ran a 13-domain production security audit (auth, database, app security, hosting, deployment, scaling, recovery, monitoring, secrets, supply chain, compliance) ahead of a potential school endorsement. Full findings and severity ranking captured in the conversation; "quick win" gaps closed in this pass:
- **Security headers** — API worker now sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, and a `default-src 'none'` CSP on every JSON response (the admin HTML panel gets its own permissive CSP so it isn't broken by the blanket one). The app's `_headers` (previously cache-control only) now carries the full header set plus a CSP scoped to its actual third parties (Stripe pricing table, Sentry, PostHog reverse-proxy, dicebear avatars).
- **`POST /api/governance/expire`** was reachable with zero auth (state-mutating). Gated behind the existing `X-Admin-Key` check — confirmed nothing internal (the cron job runs the SQL directly) depended on the unauthenticated route.
- **Dead cookie-auth code path removed** — `middleware.ts` accepted a `Cookie: token=` fallback that no route has ever issued via `Set-Cookie`; pure unauthenticated attack surface with no function. Bearer-token-only now.
- **Invite code brute-force** — `/auth/invite/peek` and `/auth/invite/redeem` had no throttling on a 6-char (~30-bit) code with a 72h window. Added IP-based rate limiting (15 attempts/10min, 15min lockout) mirroring the existing `login_attempts`/`slt_attempts` pattern (migration `0085_invite_redeem_attempts.sql`).
- **Dependabot + informational `npm audit`** — added `.github/dependabot.yml` (weekly, all 4 workspaces + github-actions) and a non-blocking `dependency-audit.yml` workflow. Deliberately non-blocking: current audit already shows 6 (worker) / 24 (app) known high/critical advisories, all in dev-only build tooling (wrangler, vite, miniflare, vitest/@vitest-ui, undici, ws) — none of it ships to the production bundle, but making this blocking today would break every deploy before those are triaged.

**Explicitly deferred** (flagged to the user, declined for this pass — bigger design/org decisions, not quick wins):
- WebAuthn/biometric check is client-side only — never verified server-side. Real fix is an auth-flow redesign.
- JWT held in client `localStorage` with 1yr/90-day expiry, no httpOnly-cookie model.
- MFA not enabled on Cloudflare/GitHub/Stripe/OpenAI/Sentry/PostHog — already tracked in `docs/governance/cyber-essentials-checklist.md`, org-level not code-fixable.
- No blanket global API rate limiting — deliberately not added; a naive per-IP limiter risks throttling legitimate shared-IP family/school traffic (NAT collision), and `/api/chat` (the actual LLM cost-amplification risk) already had per-child rate limiting before this pass.

### Second pass — PII, PIN lockout, admin panel, payment alerting, D1 recovery
Follow-up on the deferred items above, per user prioritisation:
- **Child display_name → OpenAI** — `getChildIntelligence()` (`intelligence.ts`) now truncates to the first name/nickname token before it enters any AI Mentor prompt. `display_name` is free-text ("nickname recommended", not enforced — developer-bible §6), so this stops a child-entered full name from leaking to the third-party LLM if one was ever typed. `insights.ts` and the sibling-list builder were already doing this; `chat.ts`'s dozens of prompt-building call sites all consume the same `intel.display_name`, so fixing it once at the source covers all of them. Deliberately did **not** replace the name with a generic placeholder — that would break the AI Mentor's whole personalised-coaching design, and the nickname-only policy already makes this materially lower-risk than real-name exposure.
- **PIN lockout escalation** — both child login (`/auth/child/login`) and parent step-up PIN (`/auth/verify-pin`) had a flat 30s lockout after repeated fails on a 4-digit PIN (10,000 combinations), grindable in under a day. Extracted shared logic to `lib/pinLockout.ts`: lockout duration now doubles each time the account is locked out again (30s → 60s → 120s → ... capped at 24h), reset on a correct PIN. New `pin_lockout_tier` column (migration `0086_pin_lockout_tier.sql`).
- **`GET /admin` panel load** — was reachable with zero auth (the data endpoints underneath were already gated by `X-Admin-Key`, but the page shell wasn't). Couldn't gate it with the same `X-Admin-Key` header check — a plain browser navigation can't set custom headers, so that would have broken the login form's own ability to load. Added HTTP Basic Auth in front of the page instead, reusing the existing `ADMIN_SECRET` (no new credential to manage) — browser's native prompt gates the page, panel's own `X-Admin-Key` JS flow for data calls is untouched.
- **Stripe payment-failure alerting** — webhook handler only ever processed `checkout.session.completed`; failure events (`payment_intent.payment_failed`, `charge.failed`, `invoice.payment_failed`, `checkout.session.expired`/`async_payment_failed`) were silently dropped, with no distinct signal from generic error-rate monitoring. Now captured to Sentry with a dedicated fingerprint (`stripe-payment-failure`) so an alert rule can target it specifically. **Still needs a Sentry Alert Rule created in the dashboard** (Settings → Alerts) to actually notify anyone — matches the existing precedent for the Cron/Uptime monitors (dashboard config, not code).
- **D1 backup / disaster recovery runbook** (`docs/dev/d1-backup-recovery-runbook.md`) — confirmed Cloudflare D1 Time Travel is live on both databases already (automatic, no setup needed — it was undocumented, not missing), with continuous point-in-time bookmarks. Documented the restore procedure, RPO (~0, continuous) and RTO. Flagged, not implemented: a scheduled off-platform `wrangler d1 export` to R2 as a true backstop for a deleted D1 resource, which Time Travel alone doesn't cover.

### Third pass, same day — D1 drill, doc created a docs/security repository, CI hardening batch
- **D1 restore drill executed for real** against `morechard-dev` (never production): restored to a ~1hr-old bookmark, verified queryable, restored forward again to undo. Measured RTO: ~5 seconds per restore call — the runbook's "budget 15–30min" placeholder is now a real number. The drill itself caught a factual error in the runbook: Cloudflare D1 Time Travel has **no fork-to-a-new-database option** — `wrangler d1 time-travel restore` only restores in place, `wrangler d1 export` has no bookmark/timestamp parameter. Corrected the runbook rather than leave a "safe preview" step in place that doesn't actually exist.
- **`docs/security/` created** as the standing repository for every future audit, pentest, and compliance questionnaire response — `00-index.md`, `audits/2026-07-15-production-security-audit.md` (full findings table, fixed/deferred status per item), `questionnaire-answers.md` (dated, reusable Q&A for common questions a school/auditor asks).
- **In-app Uproot disclosure** — the marketing privacy policy already fully disclosed the 7-year pseudonymised retention (that finding was stale); the in-app confirmation modal didn't state a timeframe, only "anonymised but structurally preserved" — updated to state the 7-year window explicitly.
- **`.github/workflows/gitleaks.yml`** — full git-history secret scan. No local gitleaks/trufflehog binary was available, so it runs as a CI check (push to main, PRs, manual dispatch) instead of a one-time ad hoc scan.
- **`.github/workflows/dependency-review.yml`** — blocks a PR introducing a new dependency with a known high/critical vulnerability, scoped to the PR's diff.
- **Cloudflare API token scope** — could not verify from this environment; the local `wrangler whoami` OAuth session is a different credential from the `CLOUDFLARE_API_TOKEN` GitHub secret used in CI, which isn't inspectable via CLI without the token itself. Needs a manual dashboard check (My Profile → API Tokens) to confirm it's scoped to Workers Scripts: Edit only.
- **`worker/src/lib/validate.ts`** — new shared zod-based body-validation helper. Applied to `/auth/invite/peek`, `/auth/invite/redeem`, and `/auth/child/login` (the unauthenticated, highest-risk endpoints), replacing ad hoc `typeof x !== 'string'` checks on those three routes specifically. Deliberately incremental — not a repo-wide refactor in the same pass as unrelated security fixes.
- CI: bumped `node-version` 20 → 22 across all workflows (GitHub Actions runners were silently forcing a deprecated Node 20 to Node 24 — pinned explicitly instead).

All changes verified: `tsc --noEmit` clean, `vitest run` 333/333 passing.

### Fourth pass, same day — D1 export backstop, encrypted bank vault, Turnstile plumbing, infra runbook, capacity planning
Picked up the remaining audit items (5 of the 6 not yet closed; WebAuthn/JWT redesign still deliberately deferred pending a design proposal):
- **Off-platform D1 export backstop** — created `morechard-db-backups` R2 bucket (30-day expiry lifecycle rule applied via `wrangler r2 bucket lifecycle`), and `.github/workflows/d1-backup-export.yml` runs a daily production export into it. Closes the one real gap Time Travel doesn't cover: a *deleted* D1 database resource, not just data loss within an existing one.
- **Bank-details encrypted vault (Spec B)** — `app/src/lib/localBankDetails.ts` rewritten from plaintext sessionStorage to an AES-GCM encrypted IndexedDB vault: non-extractable per-family key (structured-clone stored directly in IndexedDB, never exported as bytes), random IV per write, and a sessionStorage-marker comparison on read that reproduces the original "gone when the tab closes" property IndexedDB doesn't have natively. All three call sites (`PaymentBridgeSheet.tsx`, `HistoryTab.tsx`, `ChildProfileSettings.tsx`) converted to the new async API. Verified via 8 new unit tests (added `fake-indexeddb` for jsdom) plus a live check in an actual Chromium browser via Playwright confirming real IndexedDB/Web Crypto behavior, not just the test double.
- **Turnstile bot-challenge plumbing** — `worker/src/lib/turnstile.ts` (server verification) and `app/src/components/ui/TurnstileWidget.tsx` (client widget), wired into login, magic-link request, and invite redemption. Deliberately soft-no-op on both sides until `TURNSTILE_SECRET_KEY`/`VITE_TURNSTILE_SITE_KEY` are set — a hard-enforced check with no real Turnstile site configured would have locked out every login in production instantly. **Needs a Cloudflare dashboard action to activate** (Turnstile → Add site).
- **`docs/dev/infra-incident-response-runbook.md`** — detection signals inventory, triage steps, response by category (bad deploy, D1 issue, payment issue, platform outage). Explicit about being a solo-operator process (no on-call rotation).
- **`docs/dev/capacity-planning.md`** + `worker/scripts/load-test.mjs` — honest that no real traffic data exists yet; documents known platform ceilings and flags the payday/market-rate cron sweep as the most likely first bottleneck (only unbounded-by-family-count loop with no batching). Baseline `autocannon` script refuses to target the production hostname directly.
- Extended zod adoption (`worker/src/lib/validate.ts`, added Pass 3) to `auth.ts`'s remaining unauthenticated routes: register, login, magic-link request.

All changes verified: `tsc --noEmit` clean in both workspaces, `vitest run` passing (333 worker / 101 app, including the 8 new vault tests), plus the live-browser vault check above.

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

### Closed the escalation gap — Sentry Cron Monitor + a real health check
The audit above found Sentry was already *capturing* both exceptions the whole time; nothing was *escalating* them to a human. Closed with two independent signals, both alerting on the first miss/failure rather than after a delay:
- **Cron Monitor** (`worker-scheduled-heartbeat`, Sentry → Monitors → Cron): `scheduled()`'s shared body runs unconditionally on every trigger regardless of which cron fired it, and the Zoho poll (gated to the `*/5 * * * *` tick) is the last thing it does — so wrapping that tick's execution in `Sentry.withMonitor()` makes it a canary for the entire function, not just the poll. A crash anywhere earlier (exactly what the `ledger_old` bug did) now means a missed check-in, alerted same-day instead of discovered by accident months later. Monitor definition auto-creates via upsert, no manual Sentry config needed (`e86cc90`).
- **`/api/health` now actually checks D1** instead of returning `{ ok: true }` unconditionally — runs `SELECT 1`, returns `503` on failure (`e86cc90`). Backs a new **Uptime Monitor** on `https://api.morechard.com/api/health`, 5-minute interval, alert on first failure, emailed directly (Sentry dashboard config, not code).
- Both alert rules configured for first-occurrence/first-failure notification via email, deliberately not batched or threshold-gated — see the reasoning above for why.
