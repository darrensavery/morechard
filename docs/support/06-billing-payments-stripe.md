# 06 · Billing & Payments (Stripe)

Covers checkout, the trial, the paywall, webhook processing, failed/duplicate/incorrect charges, refunds, license grants, and the Shield upgrade-credit path.

> **CRITICAL — all products are ONE-TIME payments. There are no subscriptions, no auto-renewal, and nothing to "cancel" in the recurring sense.** Any older documentation mentioning "AI Mentor annual subscription," "renewal reminders," or "cancel your subscription" is **stale** and does not reflect the shipped product. The only "cancellation" that exists is the **14-day cooling-off refund** (below).

## The product catalogue (shipped)

| SKU (internal) | Product name | Price (GBP) | Unlocks (`families` flags) |
|----------------|--------------|-------------|-----------------------------|
| `COMPLETE` | Morechard Core | £44.99 | `has_lifetime_license` |
| `COMPLETE_AI` | Morechard Core AI | £64.99 | `has_lifetime_license` + `has_ai_mentor` |
| `SHIELD_AI` | Morechard Shield AI | £149.99 | `has_lifetime_license` + `has_ai_mentor` + `has_shield` |
| `AI_UPGRADE` | AI Mentor + Learning Lab upgrade | £29.99 | `has_ai_mentor` (only if already licensed) |

**Legacy SKUs** (no longer sold, still honoured by the webhook): `LIFETIME` → treated as `COMPLETE`; `AI_ANNUAL` → `AI_UPGRADE`; `SHIELD` → `SHIELD_AI`.

**Stripe is authoritative for the actual charge.** Our `payment_audit_log` records the fact of payment; the Stripe Dashboard is the source of truth for what was actually charged, declined, or refunded.

---

## Trial & paywall

**Facts:** The whole app is free during a **14-day trial**. The trial clock starts on the first **Value Event** (first chore logged / allowance set / purchase recorded), not at signup — so `trial_start_date` is NULL until then. At Day 15 with no purchase, the app hard-locks to `/paywall`; only the paywall and the **data export** route stay accessible.

### Symptom: "My trial ended too early / I barely used it"
**Diagnose:** Check `trial_start_date` (Toolkit). The clock starts at the first value event. If they created the family weeks ago but only just started using it, the trial may have started at first use — which is correct.
**Resolve:** Explain the trial is 14 days from first real use. A genuine trial-reset (e.g. they were blocked by a bug during the trial) requires a **manual operator action** — `trial_start_date` is write-once and resetting it needs an engineer. Escalate with justification.

### Symptom: "The app locked me out and I can't get to my data"
**Fact:** Even fully locked (no purchase), the **data export** route stays open — export is always free and never gated. Reassure them their data is safe and exportable. See [08](08-privacy-data-export-deletion.md).

---

## Checkout failures

### Symptom: "Checkout won't open / says product not available"
Map the error:

| Error | Cause | Resolution |
|-------|-------|------------|
| `This product is not yet available for purchase` (503) | Stripe price ID not configured / still a placeholder for that SKU/region | Ops issue — escalate; a live price ID is missing from env config |
| `Shield upgrade not available — please contact support` (503) | `STRIPE_SHIELD_PRODUCT_ID` not configured | Ops issue — escalate |
| `Failed to create checkout session` (502) | Stripe API call failed | Retry; if persistent, check Stripe status + Worker logs, escalate |
| `Only parents can purchase` (403) | A child session hit checkout | Purchases are parent-only; log in as the parent |

### Symptom: "My card was declined at checkout"
**Diagnose:** Card declines happen entirely on **Stripe's** side (insufficient funds, 3-D Secure failure, bank block, wrong country). Check the Stripe Dashboard for the decline reason.
**Resolve:** Advise per Stripe's reason (try another card, complete 3-D Secure, contact their bank). Note the **anti-arbitrage guard**: a UK card can't buy PLN pricing and vice-versa — a country/currency mismatch will block checkout by design.

---

## The webhook & "I paid but nothing unlocked" (most important billing ticket)

**How it works:** On successful payment, Stripe sends `checkout.session.completed` to `POST /api/stripe/webhook`. We verify the signature, then in `handleCheckoutCompleted` we (1) write a `payment_audit_log` row, (2) grant the license flags, (3) record any referral/promo. Idempotency is keyed on `stripe_session_id` (Stripe may deliver the same event twice — that's fine).

> ⚠️ **Known behaviour to understand:** if the webhook handler *throws* after Stripe delivered the event, we return **HTTP 200 anyway** (so Stripe stops retrying) and log the error. This means a mid-processing failure can leave a payment **taken but not granted**, and Stripe will **not** retry it. This is exactly the "I paid but it's still locked" scenario — and it requires a **manual grant**.

### Symptom: "I paid but the app is still locked / feature still gated" — P1
**Diagnose (in order):**
1. **Stripe Dashboard:** confirm the payment actually succeeded and get the `checkout session id` + `family_id` metadata.
2. **Our audit log:**
   ```bash
   npx wrangler d1 execute morechard --remote --env production --command="
     SELECT * FROM payment_audit_log WHERE stripe_session_id = 'cs_xxx';"
   ```
3. **License flags:**
   ```bash
   npx wrangler d1 execute morechard --remote --env production --command="
     SELECT has_lifetime_license, has_ai_mentor, has_shield FROM families WHERE id = 'FAMILY_ID';"
   ```

**Interpret:**
- Payment in Stripe **and** in `payment_audit_log` **and** flags set → they're actually unlocked; it's a client cache issue → have them fully close and reopen the app / log out and back in.
- Payment in Stripe but **no** `payment_audit_log` row → the webhook never processed (delivery failed or handler threw). **Escalate P1 for a manual grant + audit-log backfill.** Do not tell them to pay again.
- Payment in Stripe, audit row present, but **flags not set** → grant step failed (e.g. `AI_UPGRADE` where `has_lifetime_license` was 0 — AI upgrade only grants if a base license exists). Escalate for a manual grant.

**Resolve:** Support must **not** self-serve a license grant. Escalate to an operator/engineer with the three query outputs above. Never advise a second purchase to "fix" it.

### Symptom: "The AI upgrade (£29.99) didn't unlock anything"
**Fact:** `AI_UPGRADE` only grants `has_ai_mentor` **if the family already holds a base license** (`has_lifetime_license = 1`). If they bought the AI upgrade without owning Core first, the grant is a no-op.
**Resolve:** Confirm they own Core (Toolkit). If they paid for the AI upgrade with no base license, that's a mis-purchase — escalate for a refund of the upgrade or a correcting grant, depending on intent.

---

## Incorrect / duplicate charges

### Symptom: "I was charged twice"
**Diagnose:** Idempotency is keyed on `stripe_session_id`, so a *single* checkout won't double-grant. Two charges means **two separate checkout sessions** (e.g. they clicked buy twice, or bought two SKUs). Check the Stripe Dashboard and `payment_audit_log` for two distinct `stripe_session_id`s.
**Resolve:** If genuinely two charges for the same product, refund the duplicate (14-day self-serve, or manual — below). Escalate for the refund.

### Symptom: "I was charged the wrong amount"
**Diagnose:** Stripe's charged amount is authoritative (`amount_total`, stored in `amount_paid_int` as minor units). Compare against the catalogue above. For **Shield**, the amount is intentionally *reduced* by upgrade credit (see below) — a lower-than-£149.99 Shield charge is usually correct, not an error.
**Resolve:** If the charge genuinely doesn't match the expected price and isn't a Shield upgrade credit, escalate with the session id.

---

## Shield upgrade credit (why Shield sometimes costs less than £149.99)

**Fact:** When a family that already paid for Core / Core AI / AI upgrade buys **Shield AI**, they only pay the **difference** — prior payments (`COMPLETE`, `COMPLETE_AI`, `AI_UPGRADE`, GBP, non-refunded) are summed and subtracted from £149.99. A dynamic Stripe price is created for the delta (minimum 30p). `GET /api/stripe/shield-upgrade-price` returns the breakdown.

### Symptom: "Shield charged me less/more than £149.99 — is that right?"
**Resolve:** Almost always correct. Explain upgrade credit: they're only paying the gap between what they've already spent and the Shield price. Show the breakdown (full price / already paid / delta) if they want it. A **refunded** prior payment does **not** count toward credit (only non-refunded payments do).

---

## Refunds & cancellation (the only "cancel" that exists)

**Facts:** `DELETE /api/billing/cancel` issues a **full refund within a 14-day cooling-off window** on the most recent purchase, revokes the license flags, and marks the `payment_audit_log` row `refunded_at`. Parent-only.

**Two important guards:**
1. **Past 14 days →** `The 14-day cooling-off period has expired` (403). Self-serve refund is no longer available; a goodwill refund is a **manual** operator decision.
2. **Trial already expired before purchase →** the system **refuses** the self-serve refund (`please contact support for a manual refund`), because revoking the license would leave them with *no* access at all. This is deliberate — escalate for a manual refund so access can be handled cleanly.

### Symptom: "I want a refund"
**Diagnose:** Check `created_at` on the most recent `payment_audit_log` row.
**Resolve:**
- Within 14 days, trial still active → they can self-serve via **Settings → Plan/Billing → Cancel & refund**. Access revokes and Stripe refunds within ~14 days.
- Within 14 days but trial already expired → self-serve is blocked by design; escalate for a manual refund.
- Past 14 days → outside the statutory window; a goodwill refund is discretionary — escalate to an operator with the reason.

### Symptom: "The refund failed"
| Error | Meaning | Action |
|-------|---------|--------|
| `Could not retrieve payment details` (502) | Stripe session fetch failed | Retry; if persistent, escalate (Stripe/API issue) |
| `Refund failed — please contact support` (502) | Stripe refund API rejected | Escalate; process the refund manually from the Stripe Dashboard |
| `No purchase found` (404) | No `payment_audit_log` row for the family | They may not have purchased, or paid on a different family — verify |

**Legal note:** A user emailing to say they wish to cancel/refund within the cooling-off window is a legally binding request — treat it as a refund action, **not** a general support ticket to be closed. Process or escalate it.

---

## Escalation triggers for this domain
- **Paid in Stripe but no `payment_audit_log` row / flags not set → P1 manual grant.** Never advise re-purchasing.
- Missing/placeholder Stripe price IDs (503s) → ops/engineering (env config).
- Duplicate charge, wrong-amount charge (not explained by upgrade credit), or refund past the 14-day window → operator for manual refund.
- Trial reset requests → operator (write-once `trial_start_date`).
- Any refund the self-serve flow blocks (trial-expired guard) → operator for manual refund.
