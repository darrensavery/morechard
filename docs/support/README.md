# Morechard Support Playbook

> **Audience:** Support agents handling Morechard tickets (Zoho Desk portal at `desk.zoho.eu`).
> **Purpose:** One authoritative place to diagnose and resolve every category of user problem, mapped to how the product actually behaves in code — not how it's described in marketing.

This playbook covers **every major feature area** in Morechard. Each domain file lists the common failure modes, how to diagnose them, the resolution steps, and when to escalate.

---

## How to use this playbook

1. Identify the **domain** the ticket falls into (table below).
2. Open the matching file and find the **symptom** that matches what the user reported.
3. Follow **Diagnose → Resolve → Escalate**.
4. If the symptom isn't listed, use the **Diagnostic Toolkit** below and escalate with your findings.

| # | Domain | File | Covers |
|---|--------|------|--------|
| 1 | Accounts, login & sessions | [01-accounts-login-sessions.md](01-accounts-login-sessions.md) | Magic links, passwords, PINs, biometrics, lockouts, session revocation |
| 2 | Onboarding, invites & family setup | [02-onboarding-invites-family.md](02-onboarding-invites-family.md) | Registration, 6-char invite codes, adding children, co-parent bridge |
| 3 | Chores, completions & approvals | [03-chores-completions-approvals.md](03-chores-completions-approvals.md) | Assigning chores, mark-done, approval, proof uploads, rate guide |
| 4 | Ledger, disputes & verification | [04-ledger-disputes-verification.md](04-ledger-disputes-verification.md) | Immutable ledger, governance modes, disputes, hash verification, PDF export |
| 5 | Goals, savings & payment bridge | [05-goals-savings-payment-bridge.md](05-goals-savings-payment-bridge.md) | Savings goals, boosting, "mark paid", payment handles, smart copy |
| 6 | Billing & payments (Stripe) | [06-billing-payments-stripe.md](06-billing-payments-stripe.md) | Checkout, webhooks, failed/incorrect charges, refunds, Shield upgrade, licenses |
| 7 | AI Mentor, Learning Lab & Insights | [07-ai-mentor-learning-lab-insights.md](07-ai-mentor-learning-lab-insights.md) | AI unlock gating, nudges, chat, modules, parent insights, family audit |
| 8 | Privacy, data export & deletion | [08-privacy-data-export-deletion.md](08-privacy-data-export-deletion.md) | Consent, analytics veto, GDPR export, account/family deletion (Uproot) |
| 9 | Technical, PWA & devices | [09-technical-pwa-devices.md](09-technical-pwa-devices.md) | Install/PWA, offline, push, deep links, cross-device, region/currency, language |
| 10 | Referrals & promo codes | [10-referrals-promo-codes.md](10-referrals-promo-codes.md) | Referral attribution, cash commission, promo/discount codes |

---

## For engineers: the automated agent

An AI agent reads this playbook and diagnoses incoming incidents in shadow
mode (Phase 0 — nothing executes yet). Architecture, secrets, and the
validation checklist: `docs/dev/support-agent-runbook.md`.

---

## The support model

- **Ticketing:** Zoho Desk (`desk.zoho.eu`). Agent SSO into the Zoho portal isn't available on the free tier. Parents raise support requests via **Settings → Help → Contact Support** in-app, which submits a ticket directly without browser navigation.
- **Children never raise tickets.** Child accounts have no email and no self-service auth recovery. Every child-account issue is resolved through the **parent**.
- **No human-to-human chat exists in the product** (hard product ban). If a user asks "how do I message the other parent in-app," the answer is: the app deliberately has no messaging. This is by design, not a missing feature.

## Severity guide

| Severity | Definition | Examples |
|----------|------------|----------|
| **P1 — Critical** | User locked out of paid data, money taken with no access granted, or data-integrity/legal risk | Charged but app still locked; ledger hash chain failure; wrong family's data visible |
| **P2 — High** | Core flow blocked, workaround exists | Can't log in but data intact; co-parent can't join; approval stuck in pending |
| **P3 — Normal** | Feature confusion or single-item glitch | "Why is my balance different from my bank"; one chore won't mark done |
| **P4 — Low** | Cosmetic / how-to | Language toggle, metaphor questions, feature requests |

## Golden rules

1. **Never promise a ledger edit or deletion.** The ledger is immutable by design (SHA-256 hash chain). Corrections are *reversal entries*, never edits. Promising a deletion is promising something the system cannot do.
2. **Money delivery is not in the app.** Morechard is a *record of ownership*, not a bank. "Mark paid" flags delivery status; it does not move money. A parent who "paid" in-app but the child "didn't get it" needs to settle the physical payment — the app never held the cash.
3. **Verify family ownership before acting.** Every account action is scoped to a `family_id`. Confirm the requester is the account holder (matching email) before making any change or reading any data.
4. **One-time payments, not subscriptions.** All products are one-time purchases. There is **no** subscription to cancel and **no** auto-renewal. Ignore any older "cancel your subscription / renewal reminder" language — it does not reflect the shipped product.

---

## Diagnostic Toolkit

Support-side diagnosis is read-only D1 queries against **production**. All commands run from the `worker/` directory.

> ⚠️ **Production database is `morechard`. Never omit `--env production` — without it you hit the dev database `morechard-dev` and will draw wrong conclusions.**

```bash
cd worker

# Find a family + license state by parent email
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT f.id AS family_id, f.name, f.base_currency, f.verify_mode, f.parenting_mode,
         f.has_lifetime_license, f.has_ai_mentor, f.has_shield,
         f.trial_start_date, f.deleted_at, u.id AS user_id, u.email, u.email_verified, u.email_pending
  FROM users u JOIN families f ON f.id = u.family_id
  WHERE u.email = 'user@example.com';"

# Members of a family (parents + children, roles)
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT u.id, u.display_name, fr.role, fr.parent_role, u.email
  FROM family_roles fr JOIN users u ON u.id = fr.user_id
  WHERE fr.family_id = 'FAMILY_ID';"

# Payment history for a family (has money actually landed?)
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT id, stripe_session_id, payment_type, amount_paid_int, currency, refunded_at, created_at
  FROM payment_audit_log WHERE family_id = 'FAMILY_ID' ORDER BY created_at DESC;"

# Recent ledger tail for a family (chain head)
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT id, entry_type, amount, verification_status, description, record_hash, created_at
  FROM ledger WHERE family_id = 'FAMILY_ID' ORDER BY id DESC LIMIT 10;"

# Auth lockout state
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT email, attempts, window_start, locked_until FROM login_attempts WHERE email = 'user@example.com';"

# Active sessions for a user
npx wrangler d1 execute morechard --remote --env production --command="
  SELECT jti, role, issued_at, expires_at, revoked_at FROM sessions WHERE user_id = 'USER_ID' ORDER BY issued_at DESC;"
```

**Other tools:**
- **Stripe Dashboard** — authoritative for the actual charge, card decline reasons, refund status, and webhook delivery logs. When money is in question, Stripe is the source of truth, not our audit log.
- **Sentry** — error tracking; search by family_id / route for server-side failures.
- **Cloudflare Worker logs** — `console.error` output from routes (e.g. Stripe/webhook failures) surfaces here.

## Escalation

- **P1** → engineering immediately (on-call / Darren). Do not wait for a batch.
- **P2** → engineering same day with the diagnostic query output attached.
- **Manual data actions** (grant a license Stripe didn't grant, reset a trial, manual refund outside the 14-day window) require an engineer or operator — support cannot self-serve these. Always attach `payment_audit_log` output.

See each domain file for feature-specific escalation triggers.
