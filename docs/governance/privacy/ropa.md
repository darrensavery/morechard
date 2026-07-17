# Morechard — Records of Processing Activities (ROPA)

**Document type:** Internal accountability record required under UK GDPR Art. 30. Not published. Held by the controller; produced to the ICO on request. Not legal advice — should be reviewed by a data-protection specialist before being relied upon, particularly the `[JUDGMENT]`-marked lawful-basis calls carried over from the DPIA.

| Field | Value |
|---|---|
| Controller | Darren Savery, trading as Morechard (sole trader) |
| DPO | None appointed — see `docs/governance/privacy/dpia.md` for the documented rationale (sole-trader scale; revisit if processing volume/children's-data risk grows) |
| Author | Darren Savery (drafted with Claude Code, 2026-07-17) |
| Version | 0.1 (draft) |
| Date | 2026-07-17 |
| Companion documents | `docs/governance/privacy/dpia.md` (risk assessment), `docs/governance/lia/lia.md` (legitimate-interest assessments), `docs/governance/privacy/sub-processors.md` (processor detail), `docs/governance/ai-inventory.md` (AI-specific processing) |
| Review trigger | Any new data category, new processing purpose, or new sub-processor; otherwise every 6 months |

---

## How to read this document

Each row is one processing activity, in the Art. 30(1) format: purpose, categories of data subject, categories of personal data, categories of recipient, retention, and a cross-reference to whichever risk/lawful-basis document already covers it. Where the DPIA or LIA hasn't yet settled the lawful basis, that's marked `[JUDGMENT]` and carried forward rather than invented here — resolving these is an open item, not a documentation gap.

---

## 1. Core service — chore, ledger, and family account management

| Field | Value |
|---|---|
| **Purpose** | Deliver the subscribed chore-tracking, allowance, and family-ledger service: assigning chores, recording completions, tracking pocket-money balances, multi-parent/co-parent household support. |
| **Data subjects** | Parents (account holders), children (nickname-only profiles) |
| **Personal data categories** | Parent: email, display name, password/PIN hash, Google OAuth identity (`google_sub`, profile picture), locale. Child: display name/nickname (no legal name field exists), PIN hash. Household: family name, currency, home coordinates (manually entered, used only for PDF export geo-verification — device GPS is blocked at the browser-permission level). Financial: chore descriptions, reward amounts, ledger entries (hash-chained, immutable), currency-exchange snapshots. |
| **Recipients** | No external recipient by default. Other `parent`-role members of the same family see the same ledger/chore data by design (multi-parent household support). Data may be exported by the family itself to a third party of their choosing (see §6, court/export). |
| **Retention** | Live for the life of the account. On deletion: hidden immediately, most operational tables hard-deleted at day 30; ledger, ledger-status log, and payment audit log retained pseudonymised for 7 years (see LIA-3), then hard-deleted. |
| **Lawful basis** | **[JUDGMENT — not yet finalised in the DPIA]**. Most likely basis: Art. 6(1)(b), contract — processing necessary to provide the subscribed service the parent signed up for. Recommend finalising this in the DPIA rather than leaving it open; the ROPA can't be considered complete until this is a settled position. |
| **Special category / children's data** | Children's data processed under parental consent — "the parent acts as the primary user and provides consent by creating child profiles using nicknames" (privacy policy §4). No special category data (Art. 9) is collected by design. |
| **Cross-reference** | `docs/governance/privacy/dpia.md` Step 2 (data flows), `docs/governance/lia/lia.md` LIA-1 and LIA-3 |

## 2. Authentication & session security

| Field | Value |
|---|---|
| **Purpose** | Authenticate parents and children, maintain sessions, detect and lock out brute-force attempts, revoke compromised sessions, verify biometric/WebAuthn credentials. |
| **Data subjects** | Parents, children |
| **Personal data categories** | Session tokens (JWT), session metadata (IP address, user agent, issued/expiry/revoked timestamps), login-attempt/lockout counters (PIN, magic-link, invite-code), WebAuthn/biometric public keys and signature counters (no biometric data itself — a device-bound public key only), magic-link tokens (15-min TTL, single-use), short-lived Google OAuth bridge tokens (60s TTL). |
| **Recipients** | None external. Turnstile (Cloudflare) verifies bot-likelihood on login/magic-link/invite-redeem without receiving account data itself. |
| **Retention** | Parent sessions: 365 days. Child sessions: 90 days (children have no independent re-authentication path). Magic-link/OAuth-bridge tokens: minutes, single-use. Lockout counters reset on successful auth. |
| **Lawful basis** | Art. 6(1)(f), legitimate interests — securing the service and its users against unauthorised access, and Art. 6(1)(b) contract, to the extent authentication is necessary to deliver the service itself. |
| **Cross-reference** | `docs/security/questionnaire-answers.md`, `docs/security/audits/2026-07-15-production-security-audit.md` (findings #1, #4, #13, #14 — WebAuthn, JWT storage, PIN lockout, invite-code rate limiting) |

## 3. AI Mentor — weekly parent briefing (OpenAI)

| Field | Value |
|---|---|
| **Purpose** | Generate a personalised weekly behavioural-coaching note for the parent, based on the child's chore/ledger activity. |
| **Data subjects** | Children (the subject of the analysis), parents (the recipient of the briefing) |
| **Personal data categories** | Child behavioural scores (consistency, responsibility/first-time-pass rate, planning horizon), balance figures, week-over-week trend deltas, nickname/first-name token only, family locale, co-parent/family display names for persona framing. |
| **Recipients** | OpenAI (processor, `gpt-4o-mini`) — see `docs/governance/privacy/sub-processors.md`. PostHog also receives the same prompt/response content via LLM-observability event capture. |
| **Retention** | Briefing cached in D1 (`insight_snapshots`), one live OpenAI call per child per week at most. Retention at OpenAI not independently confirmed. |
| **Lawful basis** | **[JUDGMENT — not directly stated in the DPIA as an Art. 6 basis]**. The DPIA's Art. 22 analysis concludes this is not a "solely automated decision" with legal/similarly significant effect (a human parent reads and acts on the briefing). Likely basis: Art. 6(1)(b) contract, as the AI Mentor is a paid product tier feature, or Art. 6(1)(f) legitimate interests if framed as a value-add rather than a contracted deliverable — needs a decision. |
| **Cross-reference** | `docs/governance/ai-inventory.md`, `docs/governance/privacy/dpia.md` (Art. 22 analysis) |

## 4. Customer support — ticketing and AI-assisted triage

| Field | Value |
|---|---|
| **Purpose** | Handle parent-submitted support requests; triage and draft (human-approved) responses using an AI support agent. |
| **Data subjects** | Parents (ticket submitters) |
| **Personal data categories** | Ticket subject, free-text description, requester email, requester last name, linked `family_id`. |
| **Recipients** | Zoho Desk (ticketing platform, EU-hosted), Anthropic (Claude — triage/diagnosis/reply drafting). Both disclosed in the privacy policy (v1.4, 2026-07-17) — see `docs/governance/privacy/sub-processors.md`. |
| **Retention** | Governed by Zoho's own retention policy; local `agent_incidents`/`agent_action_log`/`agent_review_items` tables subject to the standard family-purge schedule when linked to a family that deletes its account. |
| **Lawful basis** | Art. 6(1)(f), legitimate interests — providing customer support is a reasonable, expected part of the service relationship. |
| **Safeguard** | A human always reviews and approves before any AI-drafted reply reaches a customer — the AI drafts, a person sends. |
| **Cross-reference** | `docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md`, `docs/dev/support-agent-runbook.md`, `docs/governance/privacy/sub-processors.md` |

## 5. Marketing communications

| Field | Value |
|---|---|
| **Purpose** | Send marketing emails to parents who have opted in; manage the pre-launch "register your interest" list. |
| **Data subjects** | Parents (and prospective parents who registered interest before signing up) |
| **Personal data categories** | Email address, marketing-list membership, consent record (`marketing_consents` table: consented flag, consent version, IP address, timestamp). |
| **Recipients** | Brevo (Sendinblue) — disclosed in the privacy policy (v1.4, 2026-07-17). Resend for transactional (non-marketing) email is a separate processing activity, covered under §1/§2 as service-necessary communication, not marketing. |
| **Retention** | Consent record retained per standard purge; Brevo integration is best-effort (a Brevo failure never blocks the underlying request) and its own retention isn't independently confirmed. |
| **Lawful basis** | Art. 6(1)(a), consent — explicit opt-in required, tracked with a versioned consent record. |
| **Cross-reference** | `worker/migrations/0047_marketing_consent.sql`, `docs/governance/privacy/sub-processors.md` |

## 6. Analytics & product observability

| Field | Value |
|---|---|
| **Purpose** | Understand feature usage and diagnose issues to improve the product. |
| **Data subjects** | Parents (consented adult devices only) |
| **Personal data categories** | Product-analytics events, session replay (adult devices, error-triggered, fully masked), error/exception reports (PII-scrubbed via a deny-list filter). |
| **Recipients** | PostHog (EU-hosted), Sentry (EU-hosted, `ingest.de.sentry.io` — pending confirmation, see `docs/governance/privacy/sub-processors.md` finding #5). |
| **Retention** | Governed by each vendor's own retention policy; not independently overridden by Morechard. |
| **Lawful basis** | Art. 6(1)(a), consent, for analytics (client + server-side consent gating, family-wide veto rule). Art. 6(1)(f), legitimate interests, for crash/error reporting (Sentry) — see LIA-2. |
| **Children's-data safeguard** | Session replay and analytics tracking are **force-disabled on any device identified as a child's device, regardless of consent state** — a hard technical control, not a policy promise. |
| **Cross-reference** | `docs/governance/lia/lia.md` LIA-2, `docs/governance/ai-inventory.md` (PostHog `$ai_generation` capture) |

## 7. Payments

| Field | Value |
|---|---|
| **Purpose** | Process one-time purchases (Morechard Complete / Complete AI / Shield AI tiers, AI Mentor upgrade). |
| **Data subjects** | Parents (purchasers) |
| **Personal data categories** | `family_id`, `payment_type` (as Checkout metadata); cardholder data is held by Stripe only, never by Morechard. Local audit trail: `stripe_session_id`, amount, currency, payment type. |
| **Recipients** | Stripe. |
| **Retention** | Local payment audit log retained pseudonymised for 7 years alongside the ledger, then hard-deleted (aligned with LIA-3's reasoning, though not the same table). |
| **Lawful basis** | Art. 6(1)(b), contract — necessary to process a purchase the parent has requested. |
| **Cross-reference** | `docs/governance/privacy/sub-processors.md` |

## 8. Court / legal export ("Sovereign Ledger" export)

| Field | Value |
|---|---|
| **Purpose** | Allow a parent (typically in a separated-family context) to export a court-admissible record of the family ledger for their own legal purposes. |
| **Data subjects** | Parents, children (as ledger subjects) |
| **Personal data categories** | Full ledger history, session/login IP addresses and timestamps, geo-verification block (manually-entered home coordinates). |
| **Recipients** | **The requesting family, and whoever they choose to share the export with** (e.g. a court, solicitor, co-parent) — this is a data-portability/export feature the family controls, not a Morechard sub-processor relationship. |
| **Retention** | The export itself is generated on demand and not retained by Morechard beyond generation; the underlying ledger data retention is covered under §1. |
| **Lawful basis** | Art. 6(1)(b), contract (the export is a paid Shield AI tier feature) and Art. 15/20 (right of access / data portability) to the extent it fulfils those rights directly. |
| **Cross-reference** | `docs/governance/privacy/dpia.md` Step 5/5a (risks R6), `docs/notebooklm/06-developer-bible.md` |

## 9. Evidence photos & shared-expense receipts

| Field | Value |
|---|---|
| **Purpose** | Let a child attach photo proof of a completed chore; let a family record shared-expense receipts. |
| **Data subjects** | Children (evidence photos), family members (receipts) |
| **Personal data categories** | Photo binary content, extracted EXIF metadata (`dateTimeOriginal`, `gpsLat`/`gpsLng` if present in the photo file, device model) — **note this is metadata already embedded in the photo file by the device that took it, not data collected via a device GPS API call, which is blocked at the browser-permission level (`Permissions-Policy: geolocation=()`).** |
| **Recipients** | None external — stored in Cloudflare R2. |
| **Retention** | Evidence photos: 90 days, then inaccessible. Receipts: retained with the shared-expense record. |
| **Lawful basis** | Art. 6(1)(b), contract — necessary to operate the chore-verification feature the parent/child are using. |
| **Cross-reference** | `worker/src/routes/proof.ts` |

---

## Open items

1. Finalise the `[JUDGMENT]` lawful-basis calls above (§1 core service, §3 AI Mentor) in the DPIA — the ROPA is citing the DPIA's own open items rather than resolving them independently, which is correct practice but means these rows aren't yet "done."
2. ~~Resolve the sub-processor disclosure gaps (Anthropic, Zoho Desk, Brevo).~~ **Done 2026-07-17** — privacy policy v1.4.
3. No DPO is currently appointed — acceptable at current scale per the DPIA's documented rationale, but worth revisiting if a school partnership meaningfully increases the number of children's records processed.
4. This is a first draft, not yet reviewed by a data-protection specialist — flag this status explicitly if shown to a school before that review happens.
