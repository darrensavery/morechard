# JWT Storage Redesign: httpOnly Cookies (Web) + Secure Storage (Native)

## Context

From the 2026-07-15 production security audit: the JWT is currently stored
in `localStorage` on web (`mc_token`, `app/src/lib/api.ts`), readable by any
script — an XSS bug anywhere in the app is a full account-takeover path.
Native (Capacitor) stores the same token, also in plain `localStorage`.

This is the first of two follow-up projects from that audit (WebAuthn
server-side verification is the second, tracked separately). Full audit
history: `docs/security/audits/2026-07-15-production-security-audit.md`.

This spec covers both the web cookie migration and native secure-storage
hardening, decided together since both close the same underlying "token at
rest in an insecure client store" problem, just via different mechanisms
required by each platform's constraints.

## Current state (confirmed via code, not assumed)

- Hand-rolled HS256 JWT (`worker/src/lib/jwt.ts`), no npm dependency.
  Claims: `sub`, `jti`, `family_id`, `role` ('parent'|'child'), optional
  `demo_user_type`, `iat`, `exp`.
- Expiry: parent 365 days, child 90 days
  (`worker/src/routes/auth.ts` `PARENT_JWT_EXPIRY`/`CHILD_JWT_EXPIRY`).
- `worker/src/lib/middleware.ts` `extractToken()`: only reads
  `Authorization: Bearer <token>` today. A prior `Cookie: token=` fallback
  was found dead and removed in an earlier audit pass.
- Session revocation (`sessions` table, keyed by `jti`, `revoked_at`) is
  already fully solid — individual/all-other-devices/bulk revocation all
  work today and need no changes. A cookie or secure-storage model still
  uses the same `jti` lookup; only how the token *travels* changes.
- CORS (`worker/src/index.ts` `corsHeaders()`) is a static, hardcoded
  `Access-Control-Allow-Origin: https://app.morechard.com` — no wildcard,
  no per-request origin reflection. Confirmed safe to add
  `Access-Control-Allow-Credentials: true` to without introducing a
  wildcard+credentials combination (which browsers block anyway).
- Native (`capacitor.config.json`, no custom `server.url`): the WebView
  serves from the platform default origin (not `app.morechard.com`), and
  `app/src/lib/api.ts` calls `https://api.morechard.com` as an absolute
  cross-origin URL on native — no same-origin proxy. This is why native
  cannot use cookies reliably (SameSite/ITP/WebView cookie-jar behavior)
  and stays on a Bearer-token model.
- Terminology note: `role: 'parent'|'child'` is the established,
  intentional vocabulary across the entire codebase (DB columns, JWT
  claims, component names) and product docs — this spec keeps it exactly
  as-is, no renaming.

## Decisions

1. **Scope**: both web cookie migration AND native secure-storage
   hardening are in scope for this single project (not split into two).
2. **Cookie attributes**: `HttpOnly; Secure; SameSite=Lax; Path=/`. Lax
   (not Strict) specifically so the magic-link email redirect — a
   top-level navigation — still carries the cookie.
3. **Token expiry**: unchanged (parent 365d, child 90d). No refresh-token
   mechanism introduced — that's a separate future decision, not coupled
   to this storage-mechanism fix.
4. **Rollout**: web is a hard cutover — next login gets a cookie, existing
   localStorage-based web sessions simply stop being read. Native gets a
   soft one-time migration (see below) so no native user is forced to
   re-login.
5. **CSRF defense**: custom header check (`X-Morechard-Client: 1`) required
   on all state-changing (`POST`/`PATCH`/`DELETE`) requests when
   cookie-authenticated. Cross-site form/img/script-tag CSRF vectors can't
   set custom headers, so this alone closes the classic attack without a
   second token to generate/store/rotate/validate.
6. **Native secure storage**: `capacitor-secure-storage-plugin` (iOS
   Keychain / Android Keystore-backed), replacing plain `localStorage` for
   the Bearer token on native only.

## Web: cookie + CSRF mechanics

- `worker/src/routes/auth.ts` login/verify endpoints (magic-link verify,
  PIN login, invite-redeem, etc.) stop returning `{ token }` in the JSON
  body for web clients; instead a new helper
  `setAuthCookie(headers, token, role)` appends:
  ```
  Set-Cookie: mc_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<expiry-seconds>
  ```
  using the existing per-role expiry (`PARENT_JWT_EXPIRY`/`CHILD_JWT_EXPIRY`,
  unchanged). Logout gets a matching `clearAuthCookie` (`Max-Age=0`).
- `worker/src/lib/middleware.ts` `extractToken()`: prefer `Cookie: mc_token=`
  when present, else fall back to `Authorization: Bearer` — this shared
  fallback path is what keeps native (still Bearer-only) working through
  the same middleware unchanged.
- New `requireCsrfHeader` check in the same middleware layer, applied to
  all mutating routes: if the request was authenticated via cookie and
  `X-Morechard-Client` is absent, reject with 403. Bearer-authenticated
  (native) requests skip this check entirely — CSRF doesn't apply to a
  model where the browser never auto-attaches credentials.
- `worker/src/index.ts` `corsHeaders()`: add
  `Access-Control-Allow-Credentials: true`. The origin allow-list stays a
  hardcoded exact match (`https://app.morechard.com`) — must never become
  a wildcard now that credentialed requests are allowed; browsers reject
  wildcard+credentials combinations anyway, but keep the explicit check as
  a guard against future regression.
- `app/src/lib/api.ts` fetch wrapper: add `credentials: 'include'` and the
  `X-Morechard-Client: 1` header on every web request. Without
  `credentials: 'include'`, the browser will not send `mc_token` at all.
- Web-only: `getToken`/`setToken`/`clearToken` in `api.ts` are removed
  entirely for the web path — the cookie is invisible to JS by design, so
  there is nothing for web code to read or store.

## Native: secure storage migration

- `getToken`/`setToken`/`clearToken` in `app/src/lib/api.ts` become
  `async`, backed by `capacitor-secure-storage-plugin` on native
  (`Capacitor.isNativePlatform()` branch). These functions no longer exist
  for the web path (see above) — native is now the only caller.
- Every native call site becomes `await`-aware: `App.tsx`,
  `RegistrationShell.tsx`, `ActiveSessionsSettings.tsx`,
  `JoinFamilyScreen.tsx`, `LandingScreen.tsx`, `LockScreen.tsx`,
  `deviceIdentity.ts`.
- `App.tsx` startup gains an explicit `checkingAuth` loading/splash state:
  render it while the async secure-storage read is in flight, then route
  to Landing (no token) or the authenticated shell (token present). Must
  never render Landing first and flash-redirect once the token resolves.
- Secure-storage reads are wrapped in try/catch. Any throw (corrupted or
  inaccessible keychain) is treated as "no token" — falls through to
  Landing/Lock, never crashes app startup.
- **One-time migration on native**: on first launch after this ships, if
  a token exists in the old `localStorage` key (`mc_token`) but not yet in
  secure storage: read it, write it into secure storage, **verify the
  write succeeded**, and only then delete the `localStorage` copy. If the
  secure-storage write fails for any transient reason, leave the
  `localStorage` key intact so the app gets another chance to migrate on
  the next boot, rather than accidentally hard-logging the user out.

## Testing & verification

- **Worker**: unit tests for `extractToken()` (cookie path, Bearer path,
  precedence when both present), `setAuthCookie`/`clearAuthCookie`, and
  `requireCsrfHeader` (missing header → 403, present → pass, Bearer
  requests bypass entirely). Existing gate stays: `tsc --noEmit` clean +
  full test suite passing before every commit.
- **App (web)**: Playwright-verified in a real browser — login sets the
  cookie, an authenticated request succeeds with the CSRF header and
  fails (401/403) without it. Same rigor as the encrypted bank vault
  verification from the prior audit pass — not unit tests alone.
- **App (native)**: manual verification on an emulator/device — confirm
  secure-storage read/write round-trips, splash-state timing (no
  Landing-screen flash), and the localStorage-carryover migration path
  (including the failed-write-doesn't-delete-source case).
- **Rollout order**: ship web hard-cutover and native soft-migration in
  the same deploy — both read the same `sessions`/`jti` infrastructure, so
  there's no reason to stagger them.

## Explicitly out of scope

- WebAuthn server-side verification — separate spec, brainstormed next.
- Short-lived tokens + refresh-token flow — a deliberate non-goal for this
  project; storage-mechanism hardening is decoupled from session-lifetime
  redesign.
- Any renaming of `parent`/`child` terminology anywhere in the codebase —
  considered and explicitly rejected; existing vocabulary stays as-is.
- Native `server.url` / same-origin proxy changes — native staying on
  Bearer + secure storage means no change to how the WebView's origin or
  API calls are configured.
