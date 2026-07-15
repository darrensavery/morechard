# Production Security Audit — 2026-07-15

**Trigger:** Preparing for a potential school endorsement (Bohunt Wokingham) —
anticipating a security review/questionnaire before a school will promote
Morechard to its pupils. Ran a self-assessment first rather than waiting to
be asked.

**Scope:** 13 production-readiness domains: authentication & identity,
database security, application security, hosting & network, deployment/CI-CD,
scaling, backup & disaster recovery, monitoring & incident response, secrets
management, dependency/supply-chain security, and data privacy/compliance
(COPPA/GDPR-K, since this handles children's data).

**Method:** Four parallel code-reading audits (one per domain cluster) across
the full worker + app codebase — grep/read of every auth route, every D1
query pattern, CORS/CSP/rate-limit config, CI workflows, and the existing
`docs/governance/cyber-essentials-checklist.md`. Not a black-box pentest —
this is a source-code-level self-assessment. No external scanning tools were
run against the live production endpoints.

**Repo state at time of audit:** commit history through `7b90796` (docs:
flag the AUTO-tier design spec as superseded by one-tap approve).

---

## Summary — what's solid

Confirmed, not just claimed:
- Parameterized SQL everywhere — 284 `.prepare().bind()` call sites sampled across 52 route files, no string-concatenated/template-literal SQL interpolating user input found.
- CORS scoped to `https://app.morechard.com` (not wildcard).
- Session model: server-side `sessions` table, individually revocable, "all others", and en-masse on account/family deletion; middleware checks `revoked_at` per request.
- Login rate limiting: 10 attempts/10min then 15min lockout, enumeration-safe generic errors.
- `/api/chat` (AI Mentor) already had per-child rate limiting (20 msgs/hour) before this audit — the LLM-cost-amplification risk was already covered.
- Real Sentry wiring (not just claimed): error capture with PII-scrubbing `beforeSend`, a Cron Monitor canary wrapping `scheduled()`, and `/api/health` genuinely checking D1 (`SELECT 1`, 503 on failure) backing an Uptime Monitor.
- Blue/green Worker deploys (Cloudflare Worker Versions) with a CI gate (`tsc --noEmit` + 333 vitest tests) blocking both preview and production promotion.
- Clean secrets hygiene: no committed keys found in the current tree; all secrets via `wrangler secret put`; dev/prod D1 databases and bindings cleanly separated.
- GDPR retention/purge job already implemented (two-stage: 30-day operational purge, 7-year pseudonymised ledger purge per UK Limitation Act).
- Nickname-only child data collection confirmed at the schema level — no `first_name`/`last_name`/`real_name` column exists anywhere.
- Uproot (account deletion) flow anonymizes PII thoroughly: `display_name`→'Deleted User', nulls email/password/PIN hashes, revokes sessions, deletes invite codes.

---

## Findings by severity, with remediation status

### 🔴 Critical

| # | Finding | Status |
|---|---|---|
| 1 | WebAuthn/biometric check (`app/src/lib/biometrics.ts`) is client-side only — the challenge/signature is never sent to or verified by the worker. Trivially bypassable; presented to users as a real security control. | **Deferred.** Architecture-level auth redesign, not a quick fix. User explicitly declined this scope for now — flagged as the highest-value remaining item. |
| 2 | No D1 backup strategy documented or tested — no Time Travel usage, no RTO/RPO, no restore runbook. | **Fixed 2026-07-15.** See [`docs/dev/d1-backup-recovery-runbook.md`](../../dev/d1-backup-recovery-runbook.md). Turned out Time Travel was already live on both databases automatically — the gap was documentation/testing, not missing infrastructure. RTO is still an *estimate* (15–30min) pending a real drill — see Open Items below. |
| 3 | No MFA on Cloudflare, GitHub, Stripe, OpenAI, Sentry, PostHog. | **Not code-fixable — org-level.** Already tracked in [`docs/governance/cyber-essentials-checklist.md`](../../governance/cyber-essentials-checklist.md). User elected to leave as-is (self-actioned outside of Claude Code). |

### 🟠 High

| # | Finding | Status |
|---|---|---|
| 4 | JWT held in client `localStorage`, no httpOnly-cookie model. 1yr (parent) / 90-day (child) token life means any XSS = long-lived full account takeover. | **Deferred.** Architecture-level — touches every login flow, web + any wrapped app. User declined this scope for now. |
| 5 | No CSP/HSTS/X-Frame-Options/Referrer-Policy on the app or worker API responses — only the marketing site had headers. | **Fixed.** Full header set added to both the worker (`worker/src/index.ts` — `securityHeaders()`) and the app (`app/public/_headers`), with a CSP scoped to actual third parties (Stripe pricing table, Sentry, PostHog reverse-proxy, dicebear avatars). The admin HTML panel gets its own permissive CSP so the blanket JSON-API CSP doesn't break it. |
| 6 | `GET /admin` served the full admin panel UI with zero auth. | **Fixed.** HTTP Basic Auth added in front of the page load, reusing the existing `ADMIN_SECRET` (no new credential). Couldn't reuse the `X-Admin-Key` header check the data endpoints use — a plain browser navigation can't set custom headers, which would have broken the login form's own ability to load. |
| 7 | `POST /api/governance/expire` was reachable with zero auth — a state-mutating endpoint. | **Fixed.** Gated behind the existing `X-Admin-Key` check (`requireAdmin`). Confirmed nothing internal depended on the unauthenticated route — the cron job runs the underlying SQL directly, never calls this HTTP route. |
| 8 | No Dependabot, no `npm audit`/SCA step anywhere in CI. | **Fixed (informational, non-blocking).** `.github/dependabot.yml` (weekly, all 4 workspaces + github-actions) and `.github/workflows/dependency-audit.yml`. Deliberately non-blocking: current audit shows 6 (worker) / 24 (app) known high/critical advisories, all in dev-only build tooling (wrangler, vite, miniflare, vitest/@vitest-ui, undici, ws) that never ships to the production bundle — making this blocking today would break every deploy before those are triaged. |
| 9 | Children's `display_name` sent unredacted to OpenAI (`insights.ts`, `chat.ts`) — no anonymization step before third-party LLM calls. | **Fixed.** `getChildIntelligence()` (`worker/src/lib/intelligence.ts`) now truncates to the first name/nickname token before it enters any AI Mentor prompt — fixed once at the source, covering every `chat.ts` call site. Deliberately did *not* replace the name with a generic placeholder (would break the AI Mentor's personalized-coaching design); nickname-only policy already caps the real exposure vs. a genuine real-name leak. |
| 10 | No dedicated alerting for failed Stripe payments — only generic Sentry exception capture. | **Fixed (partial — needs one dashboard step).** Stripe webhook now captures failure events (`payment_intent.payment_failed`, `charge.failed`, `invoice.payment_failed`, `checkout.session.expired`/`async_payment_failed`) to Sentry with a dedicated fingerprint (`stripe-payment-failure`). **Still needs a Sentry Alert Rule created in the dashboard** to actually notify anyone — same pattern as the existing Cron/Uptime monitors (dashboard config, not code). |
| 11 | Bank details stored in plaintext browser `localStorage` (Payment Bridge V1). | **Deferred — already tracked.** Documented in `CLAUDE.md` as "Spec B" (encrypted vault), not yet built. Not addressed in either pass; pre-existing known gap, not newly discovered by this audit. |

### 🟡 Medium

| # | Finding | Status |
|---|---|---|
| 12 | No global API rate limiting outside login/PIN/SLT/chat endpoints. | **Deliberately not fixed.** A naive per-IP limiter risks throttling legitimate shared-IP family/school traffic (NAT collision) — worse than the gap it closes. The actual cost-amplification risk (`/api/chat`) was already covered before this audit. |
| 13 | Child PIN lockout was flat 30s after 5 fails on a 4-digit PIN (10,000 combinations) — grindable in under a day. | **Fixed.** Escalating lockout (30s → 60s → 120s → ... capped at 24h) via new shared `worker/src/lib/pinLockout.ts`, applied to both child login and parent step-up PIN. New `pin_lockout_tier` column (migration `0086_pin_lockout_tier.sql`). |
| 14 | Invite-code redemption (`/auth/invite/peek`, `/auth/invite/redeem`) had no rate limiting on a 6-char (~30-bit) code with a 72h TTL. | **Fixed.** IP-based rate limiting (15 attempts/10min, 15min lockout), mirroring the existing `login_attempts`/`slt_attempts` pattern. Migration `0085_invite_redeem_attempts.sql`. |
| 15 | No WAF/bot-protection layer (no Cloudflare Access, Turnstile, or rate-limiting rules found in config). | **Not addressed.** Flagged, no action taken this pass. |
| 16 | Dead `Cookie: token=` auth fallback in `middleware.ts` — no route ever issued a `Set-Cookie` for it. | **Fixed.** Removed outright; Bearer-token-only now. |
| 17 | No formal infra incident-response runbook (the support-agent runbook covers customer support, not infra incidents). | **Partially addressed** — the D1 backup/DR runbook covers the database-loss scenario specifically. A broader infra incident runbook (payment outage, cron silent failure escalation) is still open. |
| 18 | No documented D1/Worker scaling ceilings or growth plan. | **Not addressed.** Flagged, no action taken this pass. |
| 19 | No validation library (zod) — ad hoc `typeof x !== 'string'` checks per-route. | **Not addressed.** Works today; flagged as a nice-to-have, not urgent. |
| 20 | Rollback is manual (`wrangler versions deploy <id>@100`), not scripted. | **Not addressed.** |
| 21 | Uproot's 7-year pseudonymised ledger retention isn't clearly disclosed in the privacy policy/deletion UI. | **Not addressed.** Small doc fix, still open. |
| 22 | `display_name` isn't validated against real names — free-text, soft control only. | **Not addressed** — by design (`CLAUDE.md` §6, confirmed deliberate). |

### 🟢 Low

| # | Finding | Status |
|---|---|---|
| 23 | No full git-history secret scan (gitleaks/trufflehog) — current tree confirmed clean, history unverified. | Not addressed. |
| 24 | Cloudflare API token scope unverified (should be Workers Scripts: Edit only). | Not addressed — needs dashboard check. |
| 25 | No SBOM/dependency-review CI step. | Not addressed. |
| 26 | No load testing / capacity planning doc. | Not addressed. |
| 27 | Caret-ranged dependency versions (standard practice, but no CI audit signal before this pass). | Superseded by the Dependabot/audit fix above. |

---

## Remediation log (files & migrations touched)

**Pass 1 (quick wins):**
- `worker/src/index.ts` — `securityHeaders()`, admin/governance auth gates, Basic Auth import.
- `worker/src/lib/adminAuth.ts` — `requireAdminBasicAuth()`.
- `worker/src/lib/middleware.ts` — removed dead cookie-auth path.
- `worker/src/routes/invite.ts` — rate limiting on peek/redeem.
- `app/public/_headers` — full security header set + CSP.
- `.github/dependabot.yml`, `.github/workflows/dependency-audit.yml` — new.
- `worker/migrations/0085_invite_redeem_attempts.sql` — new table, applied to both `morechard-dev` and `morechard` (production).

**Pass 2 (PII, PIN lockout, admin panel, payment alerting, D1 recovery):**
- `worker/src/lib/intelligence.ts` — `display_name` truncated to first token at the source.
- `worker/src/lib/pinLockout.ts` — new shared escalating-lockout module.
- `worker/src/routes/auth.ts` — wired `pinLockout.ts` into child login + parent PIN verify.
- `worker/src/routes/stripe.ts` — Stripe failure-event capture with dedicated Sentry fingerprint.
- `worker/migrations/0086_pin_lockout_tier.sql` — new column, applied to both `morechard-dev` and `morechard` (production).
- `docs/dev/d1-backup-recovery-runbook.md` — new.

Both passes verified: `tsc --noEmit` clean, `vitest run` 333/333 passing, both migrations applied to dev and production D1 before commit.

---

## Open items for the next audit pass

Roughly in priority order:
1. **WebAuthn server-side verification** and **JWT storage model** (httpOnly cookie) — the two remaining architecture-level auth gaps. These are the highest-value items left; both need a proposed design before implementation, not a silent code change.
2. **Sentry Alert Rule for Stripe payment failures** — code-side capture is done, the dashboard rule isn't created yet.
3. **D1 restore drill** — run the documented runbook against `morechard-dev` for real, replace the 15–30min RTO estimate with a measured number.
4. **Off-platform D1 export backstop** (`wrangler d1 export` to R2) — Time Travel doesn't cover a deleted D1 resource; needs a decision on frequency/retention/cost before building.
5. Bank-details encrypted vault (Spec B, already tracked separately).
6. WAF/bot protection (Cloudflare Turnstile or rate-limiting rules) if abuse patterns emerge.
7. Formal infra incident-response runbook beyond the D1-specific one.
8. Privacy policy: explicit disclosure of the 7-year pseudonymised retention post-Uproot.
