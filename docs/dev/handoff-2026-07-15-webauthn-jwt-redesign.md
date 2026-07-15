# Handoff: WebAuthn + JWT Storage Redesign

Written to let a fresh conversation pick up exactly where this one left off,
without re-deriving today's context. Paste a reference to this file (or just
say "continue from the handoff doc") to resume.

## Where we are right now

We were mid-brainstorm (using the `superpowers:brainstorming` skill) on the
two remaining items from the 2026-07-15 production security audit:
1. **WebAuthn server-side verification** — currently client-side theatre.
2. **JWT storage model** — currently `localStorage`, no httpOnly cookie.

**Decision already made:** these are two separate, loosely-coupled projects,
not one combined design. Build/spec **JWT cookie migration first** — it's
the bigger risk (closes the actual "XSS = account takeover" path); WebAuthn
is a secondary device-unlock gate, lower stakes by comparison.

**Where the conversation stopped:** about to ask the first clarifying
question for the JWT cookie migration spec (native-app cookie strategy —
see "Open design questions" below) when the user paused to request this
handoff doc instead. **Next action in the new conversation: resume the
`superpowers:brainstorming` flow for the JWT cookie migration, starting
with those clarifying questions.**

## Full context: everything already shipped today (2026-07-15)

A 13-domain production security audit was run ahead of a potential school
endorsement (Bohunt Wokingham). Five remediation passes since, all
committed and deployed to production, all verified (`tsc --noEmit` clean +
full test suites passing in both `worker/` and `app/` before every commit):

1. **Quick wins**: security headers (CSP/HSTS/etc) on API + app, gated
   `POST /api/governance/expire`, removed a dead cookie-auth fallback,
   invite-code rate limiting, Dependabot + npm audit CI.
2. **PII/PIN/admin/payments/D1**: child `display_name` truncated before
   OpenAI prompts, escalating PIN lockout, `GET /admin` gated with HTTP
   Basic Auth, Stripe payment-failure Sentry capture, D1 backup/DR runbook
   (Time Travel restore procedure).
3. **D1 drill + docs/security + CI hardening**: actually drilled the D1
   restore (found and fixed a real error in the runbook — no fork-to-new-db
   option exists), created `docs/security/` as a standing audit repository,
   added gitleaks + dependency-review CI, started zod adoption
   (`worker/src/lib/validate.ts`).
4. **D1 export backstop, bank vault, Turnstile plumbing**: daily off-platform
   D1 export to R2 (`morechard-db-backups`, 30-day expiry), rewrote
   `app/src/lib/localBankDetails.ts` from plaintext sessionStorage to an
   AES-GCM encrypted IndexedDB vault (verified in a real browser via
   Playwright, not just unit tests), Cloudflare Turnstile plumbing
   (soft no-op until configured) on login/magic-link/invite-redeem, infra
   incident-response runbook, capacity-planning doc.
5. **Turnstile activated + API token rotated**: created the actual
   Turnstile site in the Cloudflare dashboard, wired both keys in, live in
   production. Separately found the CI `CLOUDFLARE_API_TOKEN` was wildly
   over-scoped (13-24 bundled permissions, "All accounts"/"All zones") —
   rotated to a minimal token (`Workers Scripts: Edit`, `D1: Edit`,
   `Workers R2 Storage: Edit`, one account, zero zones), verified via a
   real D1 export + R2 upload + Worker deploy.

**Full details, findings tables, and the reusable questionnaire answers
live in:**
- `docs/security/00-index.md` — index/entry point
- `docs/security/audits/2026-07-15-production-security-audit.md` — the
  complete findings + remediation log across all 5 passes
- `docs/security/questionnaire-answers.md` — dated, reusable answers for
  future security questionnaires
- `docs/dev/changelog.md` (2026-07-15 section) — chronological engineering log
- `docs/dev/d1-backup-recovery-runbook.md`,
  `docs/dev/infra-incident-response-runbook.md`,
  `docs/dev/capacity-planning.md` — new operational runbooks

**Still open after all 5 passes** (this doc's topic is #1 and #2):
1. WebAuthn server-side verification (this handoff)
2. JWT storage model / httpOnly cookie (this handoff — do this one first)
3. Sentry Alert Rule for Stripe payment failures — dashboard action, user's to do
4. Real load test with authenticated traffic (chat, insights, PDF export) —
   current baseline only hits public `/api/health`
5. Broader zod adoption across ~28 remaining authenticated-route call sites
6. Re-run D1 restore drill periodically (~6 months, or after wrangler major bump)
7. Delete the old over-scoped Cloudflare API tokens once confidence is
   established (`Edit Cloudflare Workers` ×2, `moneysteps-deploy`,
   `moneysteps build token`)

## Research findings for the JWT/WebAuthn redesign (already gathered, don't re-research)

### JWT lifecycle
- Hand-rolled HS256 JWT via Web Crypto, no npm dependency
  (`worker/src/lib/jwt.ts` — `signJwt`/`verifyJwt`).
- Claims: `sub`, `jti`, `family_id`, `role` ('parent'|'child'),
  optional `demo_user_type`, `iat`, `exp`.
- Expiry: parent 365 days, child 90 days (`worker/src/routes/auth.ts`
  `PARENT_JWT_EXPIRY`/`CHILD_JWT_EXPIRY`).
- `worker/src/lib/middleware.ts` `extractToken()`: **only** reads
  `Authorization: Bearer <token>` today — a prior `Cookie: token=`
  fallback was found dead (nothing ever issued it) and removed in an
  earlier pass this session.
- Client storage: `localStorage` key `mc_token`, read/written from
  `app/src/lib/api.ts` (`getToken`/`setToken`/`clearToken`), and directly
  touched in `App.tsx`, `RegistrationShell.tsx`, `ActiveSessionsSettings.tsx`,
  `JoinFamilyScreen.tsx`, `LandingScreen.tsx`, `LockScreen.tsx`,
  `deviceIdentity.ts`. **Any cookie migration needs to update all of these
  call sites.**

### Session revocation (already solid — don't need to redesign this part)
- `sessions` table keyed by `jti`, with `revoked_at`. Already fully
  revocable: individual session (`handleRevokeSession`), all-other-devices
  (`handleRevokeOtherSessions`), and bulk revocation on PIN
  reset/lockdown/family deletion. `GET /auth/sessions` backs a
  device-management UI (`ActiveSessionsSettings.tsx`). This infrastructure
  doesn't need to change — a cookie model still uses the same `jti`
  lookup, just changes how the token *travels*, not how it's *tracked*.

### WebAuthn — confirmed pure theatre, no existing crypto to build on
- `app/src/lib/biometrics.ts`: `registerBiometrics()` **does** call real
  `navigator.credentials.create()`, but only stores the credential **ID**
  in `localStorage` (`mc_biometric_id`) — the public key is never
  captured or sent anywhere.
- `challengeBiometrics()` (the "unlock" check) calls
  `navigator.credentials.get()` and only checks that *an assertion object
  came back* — the signature is never verified by anyone, client or server.
- **No WebAuthn credential table exists in D1 at all** (confirmed via
  grep across all migrations — no `credential_id`/`public_key`/`webauthn`
  hits). Making this real means: adding a mature WebAuthn library
  (hand-rolling COSE-key/signature verification is a bad idea — recommend
  `@simplewebauthn/server` + `@simplewebauthn/browser`, the standard pair),
  a new D1 table to store public keys, and **every existing user's
  biometric registration is worthless and needs re-registration** once
  this ships (their stored "credential ID" was never paired with a key).
- Existing PIN fallback already exists (`Stage3SecureApp.tsx`) — biometric
  is optional/secondary today, which softens the re-registration impact.

### Native app (Capacitor) — the key complication for cookie migration
- `capacitor.config.json`: no custom `server.url`, so the WebView serves
  from its platform default origin (`http://localhost` Android,
  `capacitor://localhost` iOS-ish) — **not** `app.morechard.com`.
- `app/src/lib/api.ts`: on native, API calls go to an **absolute
  cross-origin URL** (`https://api.morechard.com` directly — no reverse
  proxy inside the WebView). On web, relative URLs are used because
  Cloudflare Pages proxies `/auth`/`/api` same-origin.
- **This means**: web can switch to httpOnly cookies cleanly (true
  same-origin via the Pages proxy, no CORS complication). Native cannot —
  cross-origin cookies in a mobile WebView are unreliable (SameSite/ITP
  behavior, WebView cookie jar quirks), so native will likely need to keep
  a Bearer-token model, possibly moved to a more secure native storage
  (e.g. Capacitor Keychain/Keystore-backed plugin) rather than plain
  `localStorage`, as a separate, lower-priority follow-up — the native app
  isn't fully shipped yet per `CLAUDE.md`'s "Outstanding — Android App
  Links on-device verification" section, so this is lower urgency than the
  web fix.
- CORS today (`worker/src/index.ts` `corsHeaders()`) is a **static, hardcoded**
  `Access-Control-Allow-Origin: https://app.morechard.com`, no
  `Access-Control-Allow-Credentials`, no per-request origin reflection. A
  cookie model will need `Access-Control-Allow-Credentials: true` added
  for the web origin (native doesn't need CORS credential handling since
  it'll stay on Bearer tokens).

## Open design questions (pick up here in the new conversation)

These were about to be asked one-at-a-time per the brainstorming skill's
process when the handoff was requested:

1. **Native fallback confirmation** — confirm the plan above (web → httpOnly
   cookie, native → stays Bearer token, possibly hardened storage as a
   later follow-up) is acceptable, or whether native should be in scope now.
2. **Cookie attributes** — proposed: `HttpOnly; Secure; SameSite=Lax`
   (Lax rather than Strict so the magic-link redirect flow — which lands
   the user back on the app from an email link, a top-level navigation —
   still carries the cookie; Strict would break that specific flow).
3. **Token refresh / expiry UX** — current tokens are long-lived (365d/90d)
   specifically because there's no refresh mechanism. Does moving to
   cookies change anything about expiry strategy, or keep the same
   long-lived approach (just delivered differently)? Recommend: keep
   expiry unchanged for this project — don't couple a storage-mechanism
   fix to also redesigning session lifetime, that's a separate decision.
4. **Migration/rollout** — existing logged-in users have a token in
   `localStorage` today. Does login need to keep working during a
   transition window (e.g. accept both Bearer and cookie for some period),
   or is a hard cutover (next login gets a cookie, old localStorage tokens
   just stop being read) acceptable given tokens already expire regularly?

## Next steps in the new conversation

1. Re-invoke `superpowers:brainstorming` (or just continue conversationally
   — the skill's process is: ask the 4 questions above one at a time →
   propose 2-3 concrete approaches → present design in sections → write
   spec to `docs/superpowers/specs/YYYY-MM-DD-jwt-cookie-migration-design.md`
   → self-review → user reviews spec → `superpowers:writing-plans` skill
   for the implementation plan).
2. Once JWT cookie migration ships, repeat the same brainstorming process
   for WebAuthn server-side verification as its own separate spec.
