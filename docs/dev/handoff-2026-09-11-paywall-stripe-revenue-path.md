# Handoff: Post-Trial Paywall → Stripe Revenue Path — BROKEN, DEFERRED

**Status:** Logged 2026-09-11. Investigated, not fixed — deferred by decision.
**Severity:** Launch blocker. In production today, *both* checkout paths fail;
one of them fails silently after the customer's card has been charged.
**Confidence:** High, from code reading. Not yet confirmed by a live test-mode
purchase — see "Verification" below.

---

## Summary

`/paywall` is the destination for every trial-expired family, and it bypasses
the Worker entirely. It embeds a Stripe **Pricing Table** web component, while
the Worker's webhook only grants licences from checkout-session **metadata**
that only the *other* (BillingSettings) path sets. A customer who buys through
the paywall is charged, receives nothing, and stays paywalled — with no
`payment_audit_log` row to reconcile from.

Three further defects sit on the same path. All four are fixed by one change
(see "Recommended fix").

---

## The four defects

### 1. Pricing-table purchases never grant a licence (silent revenue loss)

Trial expiry → Worker returns 402 → client hard-redirects to `/paywall`:

```
app/src/lib/api.ts:156
if (res.status === 402 && !skip402) { window.location.href = '/paywall'; }
```

`PaywallScreen.tsx:78` renders `<stripe-pricing-table>`, so the session is
created by Stripe, not by `POST /api/stripe/create-checkout`. The webhook:

```
worker/src/routes/stripe.ts:362
const { family_id, payment_type: rawType } = session.metadata ?? {};
const KNOWN: string[] = [...PURCHASABLE, 'LIFETIME', 'AI_ANNUAL', 'SHIELD'];
if (!family_id || !KNOWN.includes(rawType)) {
  return;                       // <-- silent no-op, then HTTP 200 to Stripe
}
```

Pricing Table sessions carry `client_reference_id`, not `metadata`. The Worker
never reads `client_reference_id` anywhere (`grep -rn client_reference_id
worker/src/` → no hits; `StripeSession` at `stripe.ts:622` doesn't even declare
the field). Result: no audit row, no `grantLicense()`, no referral conversion,
no promo redemption — and a 200 back to Stripe so there's no retry and no alert.

### 2. Production ships placeholder price IDs, and the guard doesn't catch them

```
worker/wrangler.toml:110
STRIPE_PRICE_COMPLETE = "price_REPLACE_WITH_LIVE_COMPLETE"
STRIPE_PRICE_COMPLETE_AI = "price_REPLACE_WITH_LIVE_COMPLETE_AI"
STRIPE_PRICE_SHIELD_AI = "price_REPLACE_WITH_LIVE_SHIELD_AI"
STRIPE_PRICE_AI_UPGRADE = "price_REPLACE_WITH_LIVE_AI_UPGRADE"
STRIPE_SHIELD_PRODUCT_ID = "prod_REPLACE_WITH_LIVE_SHIELD_PRODUCT_ID"
```

The intended safety net checks for the wrong prefix:

```
worker/src/routes/stripe.ts:282
if (!priceId || priceId.startsWith('price_PLACEHOLDER')) {
  return error('This product is not yet available for purchase', 503);
}
```

`price_REPLACE_WITH_LIVE_*` doesn't start with `price_PLACEHOLDER`, so the guard
never fires. The call reaches Stripe with a non-existent price, throws, and the
user gets an opaque `502 Failed to create checkout session`. This breaks the
BillingSettings path too — i.e. the path that is otherwise correct.

### 3. The paywall hardcodes test-mode Stripe credentials

```
app/src/screens/PaywallScreen.tsx:31-32
const PRICING_TABLE_ID = 'prctbl_1TQYdxKGVFJVwtJFQaPnNZ4o'
const PUBLISHABLE_KEY  = 'pk_test_51THVv1KGVFJVwtJF…'
```

Both are test-mode and compiled into the bundle, so the production paywall
renders a test pricing table. Purchases made there aren't real charges at all.
Note the contrast with the Worker, which deliberately reads price IDs from env
vars "so test/live values are swapped without a code deploy"
(`stripe.ts:35-38`) — the client side never got the same treatment.

### 4. Wrong identifier passed as `client_reference_id`

```
app/src/screens/PaywallScreen.tsx:81
client-reference-id={identity?.user_id ?? undefined}
```

Licences are keyed on `family_id`, and `DeviceIdentity` carries both
(`app/src/lib/deviceIdentity.ts:21-22`). So even a manual reconciliation script
run against Stripe's session list would need a second `user_id → family_id`
lookup to recover the orphaned payments from defect #1.

---

## Docs already drifted

`docs/features/16-billing-stripe.md` describes `PaywallScreen.tsx` as the
"Day 15 paywall gate shown to trial-expired families; **initiates checkout**",
and documents the data flow as `client → POST /api/stripe/create-checkout → …`.
That is true of `BillingSettings.tsx` and false of `PaywallScreen.tsx`. Update
this file as part of the fix.

The CLAUDE.md roadmap item "Build Day 15 Paywall" is also misleading: the screen,
the route (`App.tsx:268`), the 402 redirect, the trial middleware
(`worker/src/lib/trial.ts`) and the success screen all exist. What's missing is
that the paywall is wired to the wrong checkout mechanism.

---

## Recommended fix

Collapse the two checkout paths into one. Delete the Pricing Table from
`PaywallScreen` and have it call `POST /api/stripe/create-checkout` exactly as
`app/src/components/settings/sections/BillingSettings.tsx` does. That single
change kills defects #1, #3 and #4 — the Worker sets `family_id` and
`payment_type` metadata itself (`stripe.ts` `createCheckoutSession`), reads
price IDs from env, and needs no publishable key in the client bundle.

Then, separately:

- Fix the guard at `stripe.ts:282` to fail loudly on *any* unresolved price ID
  (e.g. match `/REPLACE_WITH_LIVE|PLACEHOLDER/`), so a misconfigured deploy
  returns the intended 503 instead of a 502.
- Replace the `price_REPLACE_WITH_LIVE_*` / `prod_REPLACE_WITH_LIVE_*` values in
  `wrangler.toml:110` with live IDs from the Stripe dashboard.
- Consider raising a Sentry event rather than a bare `return` at `stripe.ts:365`
  — a paid session the Worker can't attribute should never be silent, whatever
  the cause.
- Update `docs/features/16-billing-stripe.md` to match.

Design note for whoever picks this up: the paywall currently shows all SKUs
side by side via Stripe's own table. Replacing it with the API path means
rebuilding that plan comparison in-app. `BillingSettings.tsx` already has a
"Compare Plans" modal — reuse it rather than writing a second one.

---

## Verification

Not yet confirmed against live Stripe. The finding rests on Stripe not copying
product/price metadata into `session.metadata` for Pricing Table checkouts —
which matches the API docs, but is worth proving before *and* after any fix:

1. Test mode, trial-expired family, buy through `/paywall`.
2. Check `payment_audit_log` for a new row and `families` for the licence flags:
   ```bash
   cd worker && npx wrangler d1 execute morechard-dev --remote \
     --command="SELECT * FROM payment_audit_log ORDER BY id DESC LIMIT 5"
   ```
3. Expect (pre-fix): no row, no flags, Stripe shows a successful payment.

Also worth a one-off audit before launch: reconcile Stripe's completed sessions
against `payment_audit_log` to see whether any real customer has already hit
this. If the paywall has only ever run with test keys (defect #3), the blast
radius should be zero — confirm rather than assume.

---

## Related open items

- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets are still unset,
  so `.github/workflows/worker-deploy.yml` never runs. Any fix here ships by
  hand until that's done.
- `api.morechard.com` custom domain: production `WORKER_URL` already claims that
  hostname (`wrangler.toml:110`) while `worker/src/routes/auth.ts` still
  hardcodes the `workers.dev` OAuth redirect URI. Same deploy window.
