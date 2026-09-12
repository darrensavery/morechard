---
feature: 26-gatekeeper-paywall
title: Gatekeeper & Paywall
---

### Purpose

The Gatekeeper protects sensitive parent actions (destructive writes, settings changes) by re-challenging the parent's biometric or PIN without requiring a full logout. The Paywall intercepts expired-trial sessions and routes parents to purchase a one-time licence via Morechard's own Stripe Checkout integration. Together they form the two access-control layers that separate authenticated-but-unpaid users from the full app.

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
- Renders the shared `PlanPurchaseCards` component — the same Core / Core AI / Shield AI purchase cards used in Settings → Billing — so there is exactly one checkout entry point in the app, not a separate widget.
- `PlanPurchaseCards` reads live prices from `GET /api/products` (D1-backed `products` table) and, on purchase, calls `POST /api/stripe/create-checkout`, which creates a Stripe Checkout Session server-side and returns its URL for `window.location.href` redirect.
- Both `GET /api/products` and `POST /api/stripe/create-checkout` are registered ahead of the trial/paywall gate in `worker/src/index.ts` so a family with an expired trial can still reach and complete checkout — the very purpose of this screen.
- "Back to app" link is shown only when a device identity already exists (i.e., partially onboarded users who hit the paywall mid-session).

**LandingGate**

- Shown on first install (no `mc_device_identity` in localStorage). Entry point before any auth or paywall logic applies.
- Routes to `/register` (Create Family), `/join` (co-parent join), `/auth/login`, or `/demo-register` (solicitor/mediator demo).

### Dependencies

- **External packages**: React (`useState`, `useCallback`, `useRef`, `useEffect`), React Router (`useNavigate`), Lucide React (`Users` icon)
- **Internal modules**: `app/src/lib/biometrics.ts` (`hasBiometricCredential`, `challengeBiometrics`), `app/src/lib/api.ts` (`verifyPin`, `getProducts`, `createCheckoutSession`), `app/src/lib/deviceIdentity.ts` (`getDeviceIdentity`), `app/src/lib/analytics.ts` (`track`), `app/src/components/ui/Logo.tsx` (`FullLogo`), `app/src/components/billing/PlanPurchaseCards.tsx`
- **APIs / services**: `POST /auth/verify-pin` (worker route — validates PIN, returns 401 on mismatch, 429 with lockout duration on rate limit); `GET /api/products` and `POST /api/stripe/create-checkout` (worker routes — Stripe Checkout session creation); WebAuthn browser API (via biometrics wrapper)
