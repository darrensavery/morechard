# Reusable Security Questionnaire Answers

Common questions asked by partners/schools/auditors, with a standing answer
and the date it was last verified. Update the date whenever an answer is
re-confirmed or changes — a stale answer here is worse than none, since it
gets copy-pasted into real responses.

Full supporting detail for anything below: [`audits/2026-07-15-production-security-audit.md`](audits/2026-07-15-production-security-audit.md).

---

**Do you encrypt data in transit?**
Yes — Cloudflare terminates TLS for all traffic (Pages + Workers). *(Verified 2026-07-15)*

**Do you encrypt data at rest?**
Relies on Cloudflare D1's platform-level encryption at rest; no additional application-level column encryption on top of that today. Bank details entered for the Payment Bridge feature are currently stored in browser `localStorage` unencrypted — a known gap, tracked for an encrypted-vault replacement ("Spec B"). *(Verified 2026-07-15)*

**Do you have a documented backup and disaster recovery process?**
Yes — Cloudflare D1 Time Travel (continuous point-in-time recovery, automatic, no separate backup job needed) with a documented restore procedure: [`docs/dev/d1-backup-recovery-runbook.md`](../dev/d1-backup-recovery-runbook.md). RPO is near-zero (continuous bookmarks); RTO is a budgeted estimate (15–30 min) pending a live restore drill. *(Verified 2026-07-15)*

**Do you have MFA enabled on your infrastructure accounts?**
Not yet — tracked as a blocking item in [`docs/governance/cyber-essentials-checklist.md`](../governance/cyber-essentials-checklist.md). This is an account-level action item, not something fixable in code. *(Verified 2026-07-15 — status: outstanding)*

**How do you handle children's personal data (COPPA/GDPR-K)?**
Nickname-only by design — no `first_name`/`last_name`/`real_name` field exists in the schema at all; the `display_name` field is free-text with "nickname recommended" guidance (a soft, not enforced, control). Account deletion ("Uproot") anonymizes all PII (name, email, password/PIN hashes) and revokes all sessions; pseudonymised ledger rows are retained for 7 years under UK Limitation Act basis (Legitimate Interest Assessment on file: [`docs/governance/lia/`](../governance/lia/)) — this retention is not yet clearly disclosed in the user-facing privacy policy, which is a known open item. *(Verified 2026-07-15)*

**Is customer/child data sent to any third-party AI/LLM provider?**
Yes — OpenAI (`gpt-4o-mini`), disclosed in the Privacy Policy as an AI Mentor sub-processor. Only a first-name/nickname token (never a full name, even if one was mistakenly entered) is included in prompts. *(Verified 2026-07-15)*

**Do you have rate limiting / brute-force protection on authentication?**
Yes — parent login (10 attempts/10min, 15min lockout), child PIN and parent step-up PIN (escalating lockout, doubling 30s→24h cap on repeated lockouts), invite-code redemption (15 attempts/10min, 15min lockout), and AI chat (20 messages/hour per child). No blanket global API rate limiter — deliberately, to avoid throttling legitimate shared-IP family/school traffic. *(Verified 2026-07-15)*

**Do you have a Web Application Firewall (WAF) or bot protection?**
Not currently — no Cloudflare Access, Turnstile, or custom rate-limiting rules configured beyond the application-level throttling above. Open item. *(Verified 2026-07-15 — status: outstanding)*

**Are all API endpoints authenticated?**
All state-mutating and data-bearing endpoints are authenticated (JWT bearer token or `X-Admin-Key` for internal admin routes). A small number of routes are intentionally public: webhook receivers (Stripe, Zoho Desk, Sentry — all signature-verified internally), invite-code peek (read-only existence check, rate-limited), and health-check endpoints. *(Verified 2026-07-15)*

**Do you run automated dependency vulnerability scanning?**
Yes as of 2026-07-15 — Dependabot (weekly, all workspaces) plus a non-blocking `npm audit` CI workflow for visibility. Currently non-blocking because existing dev-only build tooling (wrangler/vite/vitest) carries known advisories that don't ship to production; this is being triaged separately. *(Verified 2026-07-15)*

**Is authentication protected by biometrics/2FA for end users?**
Partial — the app offers a WebAuthn/biometric "device unlock" gate (Face ID/Touch ID), but this is currently a client-side-only check, not verified server-side, so it should not be represented as a strong second factor today. This is a known, flagged gap pending an auth-flow redesign. *(Verified 2026-07-15 — status: outstanding, do not overstate to a school/auditor)*

**How are user sessions managed and revoked?**
Server-side `sessions` table keyed by JWT `jti`; individually revocable, revocable "for all other devices", and revoked en masse on account/family deletion. Session tokens are held in client-side storage rather than an httpOnly cookie, which is a known open item (XSS would expose a long-lived token — 1yr parent / 90-day child). *(Verified 2026-07-15 — status: partial, cookie model still outstanding)*

**Do you have a CI/CD pipeline with automated testing before production deploys?**
Yes — every push/PR touching the worker runs `tsc --noEmit` + the full vitest suite (333 tests); both the preview and production-promotion jobs depend on that passing. Deploys use Cloudflare Worker Versions (blue/green) — a bad version can be rolled back by re-promoting the prior version ID, though this is currently a manual step, not scripted. *(Verified 2026-07-15)*
