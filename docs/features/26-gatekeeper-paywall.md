---
feature: 26-gatekeeper-paywall
title: Gatekeeper & Paywall
---

### Purpose

The Gatekeeper protects sensitive parent actions (destructive writes, settings changes) by re-challenging the parent's biometric or PIN without requiring a full logout. The Paywall intercepts expired-trial sessions and routes parents to purchase a one-time licence via Stripe's hosted pricing table. Together they form the two access-control layers that separate authenticated-but-unpaid users from the full app.

### Methodology

**Gatekeeper (`useGatekeeper` hook)**

- Exposes a `challenge(onSuccess)` function that callers wrap around any sensitive action.
- A 5-minute session-storage grace window (`mc_gk_verified_at`) skips re-challenge on rapid repeated actions.
- On challenge: tries WebAuthn first via `hasBiometricCredential()` + `challengeBiometrics()`; if biometrics are absent or denied, opens a 4-digit PIN modal.
- PIN entry auto-submits on the fourth digit; calls `POST /auth/verify-pin` via `verifyPin()` in `api.ts`.
- 429 responses carry a lockout duration in seconds — the hook starts a countdown timer and disables the pad until it expires.
- 401 responses trigger a shake animation and clear the digits.
- On success, `markVerified()` writes the current timestamp to session storage.
- The "Forgot PIN" link navigates to `/parent?settings=security&view=pin` and closes the modal.
- `GatekeeperModal` is returned as a stable component ref so callers mount it once in JSX and imperatively trigger it via `challenge()`.

**PaywallScreen**

- Mounted by the router when the family's trial has expired (enforced upstream by route guards reading trial/licence state from the API).
- Dynamically injects `https://js.stripe.com/v3/pricing-table.js` into `<head>` on first render.
- Renders the `<stripe-pricing-table>` web component with a hardcoded `pricing-table-id` and `publishable-key`; passes the device UUID as `client-reference-id` so Stripe Checkout can correlate the purchase to the correct family record.
- No custom `createCheckoutSession` call — Stripe's hosted table handles checkout, success redirect, and cancel redirect (`cancel_url` lands back here).
- "Back to app" link is shown only when a device identity already exists (i.e., partially onboarded users who hit the paywall mid-session).

**LandingGate**

- Shown on first install (no `mc_device_identity` in localStorage). Entry point before any auth or paywall logic applies.
- Routes to `/register` (Create Family), `/join` (co-parent join), `/auth/login`, or `/demo-register` (solicitor/mediator demo).

### Dependencies

- **External packages**: React (`useState`, `useCallback`, `useRef`, `useEffect`), React Router (`useNavigate`), Lucide React (`Users` icon), Stripe pricing-table web component (`pricing-table.js` CDN)
- **Internal modules**: `app/src/lib/biometrics.ts` (`hasBiometricCredential`, `challengeBiometrics`), `app/src/lib/api.ts` (`verifyPin`), `app/src/lib/deviceIdentity.ts` (`getDeviceIdentity`), `app/src/lib/analytics.ts` (`track`), `app/src/components/ui/Logo.tsx` (`FullLogo`)
- **APIs / services**: `POST /auth/verify-pin` (worker route — validates PIN, returns 401 on mismatch, 429 with lockout duration on rate limit); Stripe Pricing Table (hosted, no server-side session creation required); WebAuthn browser API (via biometrics wrapper)
