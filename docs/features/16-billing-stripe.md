---
feature: 16-billing-stripe
title: Billing & Subscriptions (Stripe)
---

### Purpose

Enables lead parents to purchase one-time licence upgrades that permanently unlock features (AI Mentor, Learning Lab, Shield PDF exports) beyond the free trial period. All products are one-time payments — no recurring subscriptions are issued or stored.

### Methodology

**API endpoints (`worker/src/routes/stripe.ts`)**

- `POST /api/stripe/create-checkout` — Authenticated (parent only). Validates the requested SKU, optionally calculates a Shield upgrade credit (summing prior payments toward £149.99), creates a dynamic Stripe price for partial-credit cases, then calls Stripe's `/v1/checkout/sessions` API and returns a redirect URL. Price IDs are read from env vars so test/live keys swap without a code deploy.
- `GET /api/stripe/shield-upgrade-price` — Returns `full_price`, `already_paid`, and `delta` (amount owed) for the Shield upgrade, so the UI can display the net price before checkout.
- `POST /api/stripe/webhook` — Public endpoint. Verifies the `stripe-signature` header using HMAC-SHA-256 with a 5-minute replay window. On `checkout.session.completed`, writes to `payment_audit_log` first (idempotency-safe via `stripe_session_id` dedup), then calls `grantLicense()` to set boolean flag columns on `families`, records referral conversions, and records promo code redemptions. Always returns HTTP 200 to prevent Stripe retries.

**SKU catalogue**

| SKU | Price | Grants |
|-----|-------|--------|
| `COMPLETE` | £44.99 | Base tracker |
| `COMPLETE_AI` | £64.99 | Core + AI Mentor + Learning Lab |
| `SHIELD_AI` | £149.99 | Core AI + court-admissible PDF exports |
| `AI_UPGRADE` | £29.99 | AI Mentor + Learning Lab add-on |

Legacy SKUs (`LIFETIME`, `AI_ANNUAL`, `SHIELD`) are normalised to current equivalents in the webhook handler for idempotency.

**UI components (`app/src/`)**

- `BillingSettings.tsx` — Lead-parent-only settings panel with four sub-views: trial status tracker, plan management (upgrade options with Compare Plans modal), payment history from `payment_audit_log`, and a menu entry point.
- `PaywallScreen.tsx` — Day 15 paywall gate shown to trial-expired families; initiates checkout.
- `PaymentSuccessScreen.tsx` — Post-redirect landing page after Stripe Checkout completes.

**Data flow**: client calls `POST /api/stripe/create-checkout` → worker returns Stripe-hosted checkout URL → user completes payment on Stripe → Stripe POSTs `checkout.session.completed` to webhook → worker grants licence flags on `families` table.

### Dependencies

- **External packages**: Stripe Checkout (via direct Fetch to `api.stripe.com`), Web Crypto API (HMAC-SHA-256 signature verification)
- **Internal modules**: `../lib/response.js` (`json`, `error`), `../lib/jwt.js` (`JwtPayload`), `../lib/logger.js` (`logger`), `../lib/api.ts` (`createCheckoutSession`, `getTrialStatus`, `getBillingHistory`, `getShieldUpgradePrice`, `cancelPlan`)
- **APIs / services**: Cloudflare D1 (`payment_audit_log`, `families`, `promo_codes`, `promo_code_redemptions`, `referrals` tables); Stripe Checkout Sessions API; Stripe Prices API (dynamic price creation for Shield credit)
