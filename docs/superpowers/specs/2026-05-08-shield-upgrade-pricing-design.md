# Design Spec: Shield Upgrade Pricing

**Date:** 2026-05-08
**Status:** Approved for implementation

---

## Problem

The "Add Shield" upsell always shows £149.99 regardless of what the user has already paid. A user who bought Core (£44.99) or Core AI (£64.99) should only be charged the difference. The backend must charge the correct delta — this is not display-only.

---

## Scope

Three purchase scenarios require upgrade pricing:

| Prior purchases (non-refunded) | Already paid | Shield delta |
|---|---|---|
| COMPLETE only | £44.99 | £105.00 |
| COMPLETE_AI only | £64.99 | £85.00 |
| COMPLETE + AI_UPGRADE | £74.98 | £75.01 |
| None (trial/free) | £0 | £149.99 (full price, existing flow) |

Legacy SKUs (LIFETIME, AI_ANNUAL, SHIELD) are excluded — the app has no real customers and no historical rows exist.

---

## Architecture

### Credit calculation

A single SQL query sums `amount_paid_int` from `payment_audit_log` for the family, filtering:
- `payment_type IN ('COMPLETE', 'COMPLETE_AI', 'AI_UPGRADE')`
- `refunded_at IS NULL`
- `currency = 'GBP'`

`delta = 14999 - totalCreditPence`, floored at 30 (Stripe GBP minimum, pence).

When `delta === 14999` (no prior credit), the existing fixed `SHIELD_AI` Stripe price ID is used — no dynamic price created, no behaviour change for new users.

### Dynamic Stripe Price

When `delta < 14999`, a Stripe Price object is created on-demand:

```
POST /v1/prices
  currency:     gbp
  unit_amount:  <delta>
  product:      <STRIPE_SHIELD_PRODUCT_ID>
```

This ephemeral price is used for the Checkout session. The session metadata still carries `payment_type: SHIELD_AI` — the webhook and license grant logic are unchanged.

A new env var `STRIPE_SHIELD_PRODUCT_ID` is required (the Stripe Product ID for Shield, not a Price ID). This must be set in both test and production Cloudflare Worker environments.

---

## New endpoint: `GET /api/stripe/shield-upgrade-price`

**Auth:** Required (JWT). Lead parent only — co-parents cannot purchase.

**Purpose:** Price preview before the user taps the Shield card. Returns the personalised delta so the frontend can display it without initiating a checkout.

**Response:**
```json
{
  "full_price":   14999,
  "already_paid": 4499,
  "delta":        10500,
  "currency":     "GBP"
}
```

**Guards:**
- Returns `400` if `has_shield = 1` (already purchased — UI should never call this, but belt-and-braces)
- Returns `{ delta: 14999, already_paid: 0 }` if no prior eligible purchases

---

## Changes to `POST /api/stripe/create-checkout`

When `payment_type === 'SHIELD_AI'`:

1. Run the credit query (same logic as the preview endpoint — extracted to a shared helper `calcShieldCredit(env, familyId)`)
2. If `delta === 14999` → use existing `PRICE_IDS['SHIELD_AI']` (no change)
3. If `delta < 14999` → create a dynamic Stripe Price, use its ID for the Checkout session
4. `AUDIT_AMOUNTS['SHIELD_AI']` stays `14999` — the audit log records what the Shield licence is worth, not what was charged. The delta amount is derivable from the audit log at any time.

---

## Frontend changes

### `ParentSettingsTab` (or wherever trial status is fetched)

- On mount, fetch shield upgrade price alongside `getTrialStatus()` (parallel calls)
- Pass `shieldUpgradePrice: { delta: number; alreadyPaid: number } | null` down to both `BillingSettings` and `DataSettings` as a prop
- `null` while loading, on fetch error, or if `hasShield` is true (skip fetch entirely)
- On fetch error: silently fall back to `null` — UI shows full £149.99 price, user can still purchase (safe degradation)

### `BillingSettings` — Shield card

When `alreadyPaid > 0`:
- Price line: `£X.XX` (delta) with strikethrough `£149.99` beside it
- Sub-line: `"You've already paid £Y.YY — only the difference is charged"`
- Button: `"Upgrade to Morechard Shield — £X.XX"`

When `alreadyPaid === 0` (trial/free user):
- No change from current behaviour

Loading state: skeleton on the price figure only (rest of card renders immediately).

### `DataSettings` — Forensic Report upsell banner

Receives `shieldDelta: number | null` as prop.

- `null` (loading) → show `"Requires Shield"` with no price (avoids flash of wrong price)
- `alreadyPaid > 0` → `"Requires Shield (£X.XX to upgrade)"`
- `alreadyPaid === 0` → `"Requires Shield (£149.99 one-time)"` (current text, no change)

### `lib/api.ts`

New exported function:
```ts
export async function getShieldUpgradePrice(): Promise<{
  full_price: number;
  already_paid: number;
  delta: number;
  currency: string;
}>
```

---

## Edge cases

| Case | Handling |
|---|---|
| Partial refund (e.g. AI_UPGRADE refunded, COMPLETE not) | Credit query excludes `refunded_at IS NOT NULL` — correctly credits only the non-refunded amount |
| Stripe minimum charge (30p) | `delta = Math.max(delta, 30)` before creating dynamic price; practically unreachable with current SKUs |
| Already has Shield | Endpoint returns 400; frontend skips fetch when `hasShield` is true |
| Currency | Credit query filters `WHERE currency = 'GBP'`; future multi-currency handled by extending this filter |
| `amount_paid_int` accuracy | DB column used (actual charged amount), not hardcoded constants — correct if promos are introduced later |

---

## Files to change

| File | Change |
|---|---|
| `worker/src/routes/stripe.ts` | Add `calcShieldCredit` helper; add dynamic price creation to `handleCreateCheckout`; add `handleShieldUpgradePrice` route handler |
| `worker/src/index.ts` (or router) | Register `GET /api/stripe/shield-upgrade-price` |
| `worker/.dev.vars` / Cloudflare dashboard | Add `STRIPE_SHIELD_PRODUCT_ID` env var |
| `app/src/lib/api.ts` | Add `getShieldUpgradePrice()` |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Fetch shield price on mount; pass to children |
| `app/src/components/settings/sections/BillingSettings.tsx` | Accept + render personalised Shield price |
| `app/src/components/settings/sections/DataSettings.tsx` | Accept + render personalised upsell label |

---

## What does not change

- Webhook handler — session metadata is still `SHIELD_AI`, license grant is unchanged
- `payment_audit_log` schema — no migration needed
- `AUDIT_AMOUNTS['SHIELD_AI']` — stays 14999 (records licence value, not delta charged)
- All other purchase flows (COMPLETE, COMPLETE_AI, AI_UPGRADE) — untouched
- Refund/cooling-off logic — untouched
