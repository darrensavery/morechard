# Morechard — Sub-Processor Register

**Document type:** Internal accountability record. Should also be published (or made available on request) as a customer/school-facing sub-processor list once reviewed. Not legal advice — should be reviewed by a data-protection specialist before being relied upon or published externally.

| Field | Value |
|---|---|
| Controller | Darren Savery, trading as Morechard (sole trader) |
| Author | Darren Savery (drafted with Claude Code, 2026-07-17) |
| Version | 0.1 (draft) |
| Date | 2026-07-17 |
| Review trigger | Any new third-party integration, or removal of an existing one; otherwise every 6 months |

---

## Findings — status

A code-level audit for this document (2026-07-17) found **three sub-processors that were live and actively receiving personal data but not named anywhere in the current privacy policy, DPIA, or LIA**, plus two factual mismatches. None of this was a code change — it was a disclosure and documentation gap.

1. **Anthropic (Claude)** — powers the autonomous customer-support agent (`worker/src/lib/agent/claudeClient.ts`). Receives support-ticket text and, via Zoho, the requester's email address, for automated triage and reply drafting. **Resolved 2026-07-17** — added to `docs/notebooklm/privacy-policy.md` v1.4.
2. **Zoho Desk** — the support-ticketing platform tickets actually live in (`worker/src/lib/agent/zoho.ts`). Receives ticket subject/description, requester email, and last name. **Resolved 2026-07-17** — added to the privacy policy v1.4.
3. **Brevo (Sendinblue)** — marketing-list email management, separate from Resend's transactional email (`worker/src/routes/consent.ts`). Receives email address + marketing-list membership for consenting parents. **Resolved 2026-07-17** — added to the privacy policy v1.4.
4. **Paddle** is named in the privacy policy and in the DPIA/LIA as "Merchant of Record," but no Paddle integration exists in the codebase — only Stripe is wired up. **Resolved 2026-07-17** — confirmed with the controller: Paddle is intentionally not in use yet, reserved for a possible future US market launch (Paddle's Merchant-of-Record model would handle US sales-tax compliance Stripe alone doesn't). Privacy policy v1.4 updated to say so explicitly rather than implying it's live today.
5. **Sentry data residency** — the LIA (LIA-2) describes the international-transfer safeguard as if Sentry data leaves the UK/EU ("EU SCCs with UK Addendum"), but the actual Sentry DSN wired into the Worker points at `ingest.de.sentry.io` (Frankfurt, Germany — EU). **Still open** — needs confirming the real account region in the Sentry dashboard and correcting the LIA if it is in fact EU-hosted (a stronger, not weaker, position). Not addressed by the privacy-policy update.

Also fixed while updating the privacy policy: it stated the UK children's-data threshold as 16, which the DPIA had already flagged as wrong (UK Art. 8 digital-consent age is 13) but never corrected in this file. Corrected in v1.4; the Poland (PL) threshold is flagged in the policy itself as unconfirmed and needing legal verification.

The support-agent design already routes drafts through a human before anything reaches a customer (see `docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md`) — that safeguard hasn't changed, only the disclosure was missing.

---

## How to read this table

For each sub-processor: what Morechard data it receives, why, where it's hosted (so far as confirmed from code/config, not assumed), and what governs the retention or use of that data at the sub-processor. "Confirmed" residency means found directly in code/config (a DSN, API domain, etc.); "not confirmed" means the vendor's general jurisdiction is known but no code-level pin was found.

## Infrastructure & core platform

| Sub-processor | Data received | Purpose | Residency | Retention (at sub-processor) |
|---|---|---|---|---|
| **Cloudflare** (Workers, D1, KV, R2, Queues, Turnstile, Pages) | All personal data processed by the app — this is the primary hosting/database layer, not a bolt-on integration. Parent/child account data, ledger, chore data, session tokens, IP addresses, evidence photos, receipts. | Application hosting, primary database (D1), cache (KV), object storage (R2 — evidence photos, shared-expense receipts), message queue (support-agent incidents), bot protection (Turnstile). | Not pinned to a specific region in code — Cloudflare's global network. **Needs confirmation**: whether D1/R2 location hints have been set to keep data in the UK/EU. | Live data: indefinite (operational). Daily off-platform export to a separate R2 bucket, 30-day retention. D1 Time Travel gives ~30-day point-in-time recovery on the live database. |
| **Stripe** | `family_id`, `payment_type` (as Checkout metadata); Stripe itself holds cardholder data — Morechard's servers never see or store full card details. | Payment processing (one-time SKU purchases, checkout, refunds, webhooks). | Stripe is a global PCI-DSS Level 1 processor; standard Stripe DPA applies. | Governed by Stripe's own retention policy; Morechard's local audit trail (`payment_audit_log`) is hard-deleted at account deletion + 7 years alongside the pseudonymised ledger. |

## AI / LLM processors

| Sub-processor | Data received | Purpose | Residency | Retention (at sub-processor) |
|---|---|---|---|---|
| **OpenAI** (`gpt-4o-mini`) | Child behavioural scores (consistency, responsibility, planning horizon), balance figures, week-over-week trend deltas, **nickname/first-name token only** (never a full legal name — none exists in the schema), family locale, co-parent/family display names for persona framing. | Generates the AI Mentor's weekly parent briefing. Cached in D1 (`insight_snapshots`) so each child is scored via a live OpenAI call at most once per week. A rule-based fallback runs with **no** data sent to OpenAI if the AI call fails or times out. | Not pinned in code; OpenAI's standard processing terms apply (no region selection made). | Governed by OpenAI's API data-retention policy — not independently confirmed or overridden in Morechard's config. |
| **Anthropic (Claude)** — ✅ disclosed in privacy policy v1.4 | Support-ticket payloads: subject, free-text description, requester email (sourced from Sentry errors, Stripe payment-failure webhooks, in-app "Contact Support", and Zoho Desk tickets), linked to a `family_id`. | Powers the autonomous support agent's triage (Haiku model) and diagnosis/reply-drafting (Opus model) for customer-support incidents. **A human always reviews and approves before any customer-facing reply is sent** — the AI drafts, a person clicks send. | Not pinned in code; Anthropic's standard API terms apply. | Not independently confirmed. |

**Note (already a documented, positive decision):** a second, free-text child-facing AI chat feature was **removed entirely** on 2026-07-16, specifically over unmoderated-minor-input risk, rather than patched — see `docs/governance/ai-inventory.md`. It is not a live sub-processor relationship any more; residual database rows from when it was live are still subject to the standard purge schedule.

## Support & communications

| Sub-processor | Data received | Purpose | Residency | Retention (at sub-processor) |
|---|---|---|---|---|
| **Zoho Desk** — ✅ disclosed in privacy policy v1.4 | Ticket subject/description, requester email, requester last name. | Customer support ticketing (parent-facing support tickets). | **Confirmed EU** — the Morechard Zoho account is provisioned on the `.eu` domain (`desk.zoho.eu`, `accounts.zoho.eu`), not `.com`. | Governed by Zoho's own retention policy; not independently overridden. |
| **Resend** | Recipient email address, template used, send status. | Transactional email (magic links, trial reminders, verification). | Not pinned in code. | D1-side send log (`email_sends`) retained per standard purge; Resend's own retention not independently confirmed. |
| **Brevo (Sendinblue)** — ✅ disclosed in privacy policy v1.4 | Email address, marketing-list membership. | Marketing email list management for parents who've opted in to marketing communications, and pre-launch "register your interest" signups. | Not pinned in code. | Best-effort integration — a Brevo failure never blocks the underlying request; not independently confirmed for retention. |
| **Google** | OAuth subject ID (`google_sub`), profile picture URL, name and email (per Google's consent screen). | "Sign in with Google" for parent authentication. | Google's standard OAuth infrastructure; no separate DPA needed beyond Google's standard terms for this use case. | Morechard stores `google_sub`/`google_picture` locally; Google's own retention of the OAuth grant is governed by the parent's own Google account settings. |

## Observability & analytics

| Sub-processor | Data received | Purpose | Residency | Retention (at sub-processor) |
|---|---|---|---|---|
| **Sentry** | Error/exception data with a PII-scrubbing filter removing any field matching `password/pin/token/secret/authorization/jwt/api_key`. Session Replay on the web app is on-error only, fully masked (`maskAllText`, `blockAllMedia`), and is force-disabled on any device identified as a child's device regardless of consent. | Crash/error monitoring, uptime monitoring (`/api/health`), Cron Monitor heartbeat, dedicated alert fingerprints for Stripe payment failures and WebAuthn clone-detection. | **Likely EU** — the Worker's Sentry DSN points at `ingest.de.sentry.io` (Frankfurt). See finding #5 above — the LIA's transfer-safeguard language should be reconciled against this. | Sentry's own retention; not independently overridden. |
| **PostHog** | Product-analytics events, session replay (adult devices, consented only — never child devices), and **full LLM prompt/response content** from OpenAI calls (`$ai_generation` event — captures the same child behavioural data/nickname sent to OpenAI, for cost/latency/quality observability). | Product analytics and LLM-call observability. | **Confirmed EU** — `eu.i.posthog.com` host. | Governed by PostHog's own retention; not independently overridden. Consent-gated client-side (`mc_analytics_consent`) and server-side via a family-wide veto rule (any parent opt-in AND no parent opt-out). |

## Infrastructure with no personal-data flow (listed for completeness)

| Sub-processor | Role |
|---|---|
| **GitHub** | Source control and CI/CD deploy pipeline only. No application personal data flows through GitHub based on this review — purely build/deploy infrastructure. |

---

## Open items

1. ~~Resolve the Anthropic/Zoho/Brevo disclosure and Paddle-framing findings above.~~ **Done 2026-07-17** — privacy policy v1.4. Sentry region reconciliation (finding #5) remains open.
2. Confirm whether formal Data Processing Agreements (Art. 28 GDPR) are in place with each processor above that receives personal data (Cloudflare, Stripe, OpenAI, Anthropic, Zoho, Resend, Brevo, Google, Sentry, PostHog). Most SaaS vendors publish a standard DPA that's accepted by using the service under their terms — worth collecting links/copies of each rather than assuming.
3. Confirm Cloudflare D1/R2 regional configuration — is data pinned to the UK/EU, or is it wherever Cloudflare's network happens to place it? A school/DPO will likely ask this directly.
4. This register should be kept in sync with `docs/governance/ai-inventory.md` (AI-specific processors) and the ROPA (`docs/governance/privacy/ropa.md`) — a change to one should trigger a check of the others.
