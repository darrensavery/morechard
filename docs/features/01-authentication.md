---
feature: 01-authentication
title: Authentication & Sessions
---

### Purpose

Provides secure identity management for parents (via Google OAuth or magic-link email), children (via 6-digit family code + PIN), and co-parents (via invite token). Handles session lifecycle including JWT issuance, multi-device session tracking, biometric re-authentication, and family account deletion.

### Methodology

**Parent authentication flows**

- `POST /auth/google` — exchanges Google ID token for a Morechard JWT; creates or retrieves the family row and parent user record in D1
- `POST /auth/magic-link` — sends a one-time token via email; `GET /auth/magic-link/verify` exchanges it for a short-lived token (SLT) that the client swaps for a full JWT via `POST /auth/exchange-slt`
- `GET /auth/callback` (AuthCallbackScreen) — receives the SLT from URL params, calls `/auth/exchange-slt`, persists the JWT and device identity, then flushes any buffered analytics consent

**Child authentication**

- `POST /auth/child/login` — child enters their 6-digit family code and 4-digit PIN; returns a child-scoped JWT with reduced claims

**Session management**

- `GET /auth/sessions` / `DELETE /auth/sessions/:id` — list and revoke individual device sessions stored in the `sessions` D1 table; each session records device name, last-seen timestamp, and a hashed token
- Sessions are created on every successful login; the JWT payload carries `session_id` for revocation checks on each request

**Family & co-parent operations**

- `POST /auth/invite` — lead parent generates an invite token (stored in `invite_codes`); co-parent redeems via `POST /auth/invite/redeem`
- `DELETE /auth/family` — soft-deletes the family row (`deleted_at`), NULLs all PII columns, hard-deletes invite codes; requires typing `UPROOT` in the UI and that all co-parents have already left
- `POST /auth/leave-family` — co-parent self-removal path

**Consent**

- `POST /consent` — persists marketing and analytics flags; recomputes the child analytics veto flag (any co-parent opt-out blocks child event capture for the whole family)

### Dependencies

- **External packages**: `jose` (JWT sign/verify), Cloudflare D1 (session and family storage), Cloudflare Workers (runtime), `@sendgrid/mail` or equivalent for magic-link email delivery
- **Internal modules**: `worker/src/routes/consent.ts` (veto-flag recomputation), `worker/src/routes/verify.ts` (second-parent ledger verification), `app/src/lib/api.ts` (client-side wrappers: `exchangeSlt`, `getActiveSessions`, `revokeSession`, `leaveFamily`, `deleteFamily`), `app/src/lib/deviceIdentity.ts` (device fingerprint persisted after SLT exchange)
- **APIs / services**: Google OAuth token introspection endpoint, SendGrid (magic-link email), Sentry (error capture on auth failures)
