---
feature: 03-biometric-lock
title: Biometric Lock & PIN
---

### Purpose

Protects each device against casual access by a sibling, co-parent, or stranger without requiring a server round-trip on every app open. Because one device maps to one user (no profile switcher), the lock screen doubles as identity confirmation: whichever profile is stored on the device is shown before credentials are checked. Children re-issue their own JWT silently on unlock when the token has expired; parents are prompted to request a fresh magic link.

### Methodology

**Auth methods (three modes, set during registration)**
- `biometrics` — WebAuthn platform authenticator (Face ID / Touch ID). Credential ID stored in `localStorage` (`mc_biometric_id`). On app open, `challengeBiometrics()` calls `navigator.credentials.get()` with the stored credential ID. No private key or biometric data ever leaves the device.
- `pin` — 4-digit PIN hashed via PBKDF2 (16-byte random salt, 100k iterations, SHA-256). Stored as `<base64-salt>:<base64-hash>` in the `pin_hash` field of `mc_device_identity` in localStorage. `verifyPinHash()` re-derives and compares in the browser.
- `none` — passes straight through; stale `mc_biometric_id` is cleared on this path to prevent a tamper-guard false positive.

**Lock screen flow (`LockScreen.tsx`)**
- On mount, reads `mc_device_identity`. If absent, redirects to `/`.
- Auto-triggers biometric challenge (if `auth_method === 'biometrics'`) or focuses PIN input box 1.
- Manual lock (`?manual=1`) suppresses auto-auth; user must tap "Tap to unlock" first.
- PIN input: 4 single-digit inputs with sequential focus and backspace navigation. Submits automatically on 4th digit.
- Lockout: 5 failed PIN attempts triggers a 30-second cooldown enforced client-side.
- After success, navigates to `/parent` or `/child` via React Router `replace`.

**JWT re-issue on expired session**
- `tokenMissingOnMount` flag (checked at mount, not reactive) triggers silent child re-auth via `POST /api/auth/child-login` using the just-verified raw PIN.
- Parents with an expired JWT see a dedicated "Session expired" screen with a link to `/auth/login`; no silent re-auth is possible without email access.

**Auto-lock (native only, `AppAutoLock.tsx`)**
- Listens to Capacitor `appStateChange` events. Timestamps background entry in `mc_backgrounded_at`.
- On resume, if away for 5+ minutes and not already on `/lock`, `/`, or `/auth/*`, redirects to `/lock`.
- No-op on web PWA builds; the browser handles re-auth on cold load via the LockScreen gate.

### Dependencies

- **External packages**: `@capacitor/app` (background state events), `@capacitor/core` (platform detection), `@sentry/react` (user tagging on unlock), `react-router-dom` (navigation)
- **Internal modules**: `app/src/lib/biometrics.ts` (WebAuthn wrapper), `app/src/lib/deviceIdentity.ts` (localStorage identity model + PBKDF2 PIN hash/verify), `app/src/lib/api.ts` (`childLogin`, `setToken`), `app/src/lib/analytics.ts` (`track.lockScreenUnlocked`)
- **APIs / services**: Web Authentication API (WebCrypto/WebAuthn — browser-native, no server); `POST /api/auth/child-login` (child JWT re-issue on expired token); Sentry (user context tagging)
