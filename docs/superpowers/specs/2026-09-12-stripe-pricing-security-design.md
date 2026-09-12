# Stripe Pricing & Checkout Security — Design

**Date:** 2026-09-12
**Status:** Approved for implementation

## Problem

The current Stripe integration (`worker/src/routes/stripe.ts`) has three gaps:

1. **Price IDs live in `wrangler.toml`, not D1.** Dev's price IDs point at a
   test-mode Stripe catalogue that had gone missing; production's were literal
   `price_REPLACE_WITH_LIVE_*` placeholders. Pricing is config, checked into a
   file the team edits, rather than data — and per `CLAUDE.md`, D1 is the only
   data layer for this project.
2. **`PaywallScreen.tsx` embeds Stripe's own hosted Pricing Table widget**
   (`prctbl_...` + a hardcoded test-mode publishable key), a second checkout
   path that never touches our backend, our SKU/metadata, or our webhook
   validation.
3. **The webhook never validates the amount Stripe actually charged against
   what the SKU should cost.** It trusts `session.metadata.payment_type` and
   grants the license purely on signature-verified event delivery — there is
   no check that the charged amount matches our product's price.

There is no live paywall traffic yet (Phase 7 "Day 15 Paywall" is unbuilt),
so this is a clean cutover, not a live migration.

## Goals

- Client never sends a monetary amount — only a SKU (product identifier).
- Checkout sessions are built from Stripe Price IDs sourced from D1, never
  raw pence amounts, never something the client controls.
- A license is granted only after the webhook (a) verifies the Stripe
  signature and (b) verifies the charged amount matches what we expected to
  charge for that specific checkout session.
- One checkout path. Retire the Stripe-hosted Pricing Table.
- Stand up a real Stripe product catalogue (Test + Live) to replace the
  broken/placeholder IDs.

## Stripe catalogue (already created by the user in the Dashboard)

| SKU | Name | Price | Sandbox `price_id` | Live `price_id` |
|---|---|---|---|---|
| COMPLETE | Morechard Core | £44.99 | `price_1TPqqZKGVFJVwtJFo37uEPPW` | `price_1UEmyUKGVFJVwtJFbbav5F6k` |
| COMPLETE_AI | Morechard Core AI | £64.99 | `price_1TQVUFKGVFJVwtJFmYUryKw6` | `price_1UEmzzKGVFJVwtJFPWUcpeCI` |
| SHIELD_AI | Morechard Shield AI | £149.99 | `price_1TPqqcKGVFJVwtJF6cFgzWf9` | `price_1UEn0rKGVFJVwtJFDk3avBvV` |
| AI_UPGRADE | AI Mentor + Learning Lab Upgrade | £29.99 | `price_1TQVViKGVFJVwtJFLhSnEuh7` | `price_1UEn1HKGVFJVwtJFm27L00L1` |

Shield AI Product IDs (needed for the dynamic upgrade-credit price):
- Sandbox: `prod_UOe8ZtEJmwuNj6`
- Live: `prod_VFHawfwlGcBusF`

These values are not secrets (comparable to a publishable key) — safe to
commit in a D1 seed migration.

**Outstanding, not part of this implementation:** confirm a Stripe webhook
endpoint exists in both Dashboard modes (Developers → Webhooks) pointed at
the dev/preview and `https://api.morechard.com/api/stripe/webhook` URLs
respectively, subscribed to `checkout.session.completed` plus the existing
failure event set, and that `STRIPE_WEBHOOK_SECRET` in both `wrangler secret`
stores matches that endpoint's current signing secret. The old secret almost
certainly belongs to a dead/nonexistent endpoint. This is a Dashboard/secret
task for the user, not code.

## D1 schema

### `products` — replaces env-var price IDs

```sql
CREATE TABLE products (
  sku               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id   TEXT NOT NULL,
  unit_amount_pence INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  active            INTEGER NOT NULL DEFAULT 1
);
```

One migration creates the table; a per-environment seed (dev D1 gets sandbox
IDs, prod D1 gets live IDs — the two D1 databases are already separate, so no
env-var branching in code is needed) populates the four rows. `sku` values
match the existing `PaymentType` union: `COMPLETE`, `COMPLETE_AI`,
`SHIELD_AI`, `AI_UPGRADE`.

### `checkout_intents` — what we told Stripe to charge, for later verification

```sql
CREATE TABLE checkout_intents (
  stripe_session_id    TEXT PRIMARY KEY,
  family_id             TEXT NOT NULL REFERENCES families(id),
  sku                   TEXT NOT NULL,
  stripe_price_id       TEXT NOT NULL,
  expected_amount_pence INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkout_intents_family ON checkout_intents (family_id);
```

Written immediately after Stripe returns a session (so it exists before the
user can possibly reach the webhook). Covers both fixed-price SKUs and the
Shield AI dynamic upgrade-credit price (computed per family today via
`calcShieldCredit`), because in both cases we know exactly what we expect to
be charged at the moment we create the session.

**`stripe_price_id` and `expected_amount_pence` always describe the price ID
actually sent to Stripe for this session, not the catalogue default.** For
`COMPLETE` / `COMPLETE_AI` / `AI_UPGRADE` that's the catalogue row's own
`stripe_price_id` / `unit_amount_pence`. For a discounted `SHIELD_AI`
upgrade, `createDynamicPrice` returns a new one-off Stripe Price ID for
exactly the credited amount — *that* ID and *that* (lower) pence amount are
what get written here, not Shield's £149.99 catalogue price. The dynamic
price bakes the discount into its own `unit_amount`, so this is the only
amount Stripe will ever report back for that session — there is no separate
"full price minus coupon" to reconcile.

## Checkout flow (`POST /api/stripe/create-checkout`)

1. Client sends `{ payment_type: 'COMPLETE' | 'COMPLETE_AI' | 'SHIELD_AI' | 'AI_UPGRADE' }` — unchanged wire shape, still a SKU, never an amount.
2. Server: `SELECT * FROM products WHERE sku = ? AND active = 1`. 404/503 if missing.
3. For `SHIELD_AI`: compute the upgrade credit as today (`calcShieldCredit`), but the "full price" input to that calculation now comes from `products.unit_amount_pence` for `SHIELD_AI`, not the hardcoded `SHIELD_FULL_PRICE_PENCE` constant. If a dynamic (discounted) price is needed, `createDynamicPrice` uses `products.stripe_product_id` instead of `env.STRIPE_SHIELD_PRODUCT_ID`.
4. Create the Stripe Checkout Session (unchanged — `line_items[0][price]` is always a Stripe Price ID, either the catalogue one or the dynamically-created one).
5. **New:** insert one row into `checkout_intents` keyed by the returned `session.id`, recording `family_id`, `sku`, the price ID used, and the expected amount in pence.
6. Return `{ url, session_id }` as today.

`env.STRIPE_PRICE_*` and `env.STRIPE_SHIELD_PRODUCT_ID` are removed from
`types.ts` and `wrangler.toml`. `SHIELD_FULL_PRICE_PENCE` and `AUDIT_AMOUNTS`
(including the legacy-SKU entries) are deleted — `AUDIT_AMOUNTS` was only
ever a fallback for a field (`session.amount_total`) Stripe always populates
on a completed session, so it was dead defensive code hiding a hardcoded
price list. `STRIPE_MINIMUM_PENCE` (Stripe's platform charge floor, not a
product price) stays as a constant — it isn't business pricing, it's a
technical constraint of the payments API.

## Webhook flow (`POST /api/stripe/webhook`)

`handleCheckoutCompleted` gains an amount-verification step before any
grant:

1. Signature verification — unchanged.
2. Parse `family_id` / `payment_type` from `session.metadata` — unchanged
   (kept as a sanity cross-check, see below).
3. **New:** `SELECT * FROM checkout_intents WHERE stripe_session_id = ?`.
   - Not found → do not grant. Capture a Sentry error (fingerprint
     `stripe-checkout-intent-missing`) with the session id. This should never
     happen post-cutover since every session we create writes this row first;
     if it does, it means a session was created some other way.
   - Found → compare `intent.family_id === metadata.family_id` and
     `intent.sku === normaliseSku(metadata.payment_type)` as an integrity
     check between the two independently-written records.
   - Compare `session.amount_subtotal` (pre-discount — so a legitimate promo
     code doesn't trip this) and `session.currency` against
     `intent.expected_amount_pence` / `intent.currency`.
   - Mismatch on any of the above → do not grant. Capture a Sentry error
     (fingerprint `stripe-amount-mismatch`) with both amounts, the session
     id, and the family id, for manual investigation. Still ack the webhook
     with 200 so Stripe doesn't retry indefinitely.
4. Only once all checks pass: existing logic runs unchanged — idempotency
   check against `payment_audit_log`, write the audit row (using
   `session.amount_total`, which is always present on a completed session —
   no more `?? AUDIT_AMOUNTS[...] ?? 0` fallback chain), `grantLicense`,
   referral conversion, promo code redemption.

No new failure-path DB table — a Sentry capture is sufficient here, matching
how `FAILURE_EVENT_TYPES` are already handled a few lines down in the same
file, and this is expected to be a rare/never-hit path.

**Implementation note to verify:** `checkout.session.completed` events
include `amount_subtotal` and `amount_total` on the session object itself
(no line-item expansion needed) per Stripe's current API version — confirm
this against a real sandbox event payload during implementation, since the
webhook handler parses the raw JSON body directly rather than re-fetching
the session from the API.

## Frontend

- `PaywallScreen.tsx`: remove the `stripe-pricing-table` web component, the
  hardcoded publishable key, and the pricing-table script injection. Replace
  with the same plan-card UI `BillingSettings.PlanView` already renders
  (extract the plan-card + `handlePurchase` logic into a shared component
  used by both screens, since the cards are otherwise identical).
- New `GET /api/products` (parent-authenticated, matching the other billing
  routes) returns `[{ sku, name, unit_amount_pence, currency }]` from the D1
  `products` table. Both `PaywallScreen` and `BillingSettings` fetch this
  once and render prices from it, replacing the hardcoded `£44.99` /
  `£64.99` / `£149.99` literals currently duplicated across `PlanView` and
  `ComparePlansModal`. This closes the loop on "prices come from the
  database, not the front end" for display, not just for the charge itself.
- `PaymentSuccessScreen.tsx` is unchanged — it already only polls
  `getTrialStatus()` and never grants anything itself.

## Rollout

No live traffic depends on the current (broken) config, so this ships as a
straight cutover:

1. Migration: create `products` + `checkout_intents` tables.
2. Seed migration (or a one-off seed script, consistent with the existing
   `npm run seed:*` pattern): insert the 4 rows into dev D1 with sandbox IDs.
3. Update `stripe.ts`, `types.ts`, `wrangler.toml` (remove the now-dead
   `STRIPE_PRICE_*` / `STRIPE_SHIELD_PRODUCT_ID` vars from both `[vars]` and
   `[env.production]`).
4. Update frontend (`PaywallScreen`, shared plan-card component,
   `GET /api/products`, `app/src/lib/api.ts`).
5. Test end-to-end against dev (`morechard-dev`, sandbox Stripe) — all 4
   SKUs, the Shield upgrade-credit path, a promo code, and an induced
   amount-mismatch to confirm the webhook correctly refuses to grant.
6. Repeat the seed for production D1 with the live IDs, deploy.

## Testing

- Unit tests for `handleCreateCheckout`: DB-missing SKU → 503; correct price
  ID selected per SKU; `checkout_intents` row written with the right
  expected amount; Shield dynamic-price path uses the DB product ID and
  writes the *dynamic* price ID + discounted amount (not the catalogue
  price/amount) into `checkout_intents`.
- Unit tests for `handleCheckoutCompleted`, covering both pricing shapes:
  - Standard SKU (e.g. `COMPLETE`) paid **with a promo code applied** →
    `amount_total` < `amount_subtotal`, but `amount_subtotal` still equals
    `expected_amount_pence` → grants as today.
  - `SHIELD_AI` dynamic upgrade credit (no promo code) → `amount_subtotal`
    equals the discounted `expected_amount_pence` directly → grants as
    today.
  - Matching intent, no discount → grants as today.
  - Missing intent → no grant + Sentry capture.
  - Amount mismatch (neither of the two legitimate-discount shapes above) →
    no grant + Sentry capture.
  - Currency mismatch → no grant.
- Existing `stripe.test.ts` shield-credit-calculation tests updated to read
  the full price from a fixture `products` row instead of the deleted
  constant.
