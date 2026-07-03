---
feature: 23-freshdesk-sso
title: Freshdesk SSO & Support
---

### Purpose

Authenticated parents can open the Freshdesk help portal as a recognised contact — without creating a separate account or re-entering credentials. The SSO handshake eliminates the friction of a second login and surfaces contextual help (guides, FAQs, tickets) directly from the Morechard settings screen.

### Methodology

**API endpoint — `GET /api/freshdesk-sso`**

- Requires an authenticated session (`requireAuth`) scoped to the `parent` role (`requireRole`).
- Queries D1 for the parent's `display_name` and `email` from the `users` table.
- Builds a Freshdesk-compatible JWT: header `{ alg: "HS256", typ: "JWT" }`, payload `{ name, email, iat, jti }` where `jti` is a `nanoid()` nonce to prevent replay.
- Signs the JWT with HMAC-SHA256 using the `FRESHDESK_SSO_SECRET` environment binding via the Web Crypto API.
- Returns `{ url }` — a redirect to `https://eagereverest.freshdesk.com/login/jwt?jwt=<token>`.
- If the secret binding is absent, returns HTTP 503 rather than silently falling back.

**UI — `SupportSettings.tsx`**

- The "Search the Help Desk" button issues a `fetch` to `/api/freshdesk-sso` with auth headers.
- On success it opens the returned URL in a new tab (`window.open`, `noopener noreferrer`).
- On any failure (non-OK response or network error) it falls back to opening `https://support.morechard.com` directly, so the user always reaches help.
- The same component renders a "What's New" sub-view (in-app changelog), Privacy Policy and Terms links, and the app version string injected at build time via `__APP_VERSION__`.

**`FreshdeskWidget.tsx`** is a stub (`return null`) — the embedded widget approach was abandoned in favour of the SSO portal redirect.

No background jobs or webhooks are involved; the JWT is generated on demand per click.

### Dependencies

- **External packages**: `nanoid` (nonce generation); Web Crypto API (`crypto.subtle`) — available natively in the Cloudflare Workers runtime.
- **Internal modules**: `worker/src/lib/middleware.ts` (`requireAuth`, `requireRole`), `worker/src/lib/response.ts` (`json`, `error`), `worker/src/lib/nanoid.ts`, `app/src/lib/api.ts` (`apiUrl`, `authHeaders`), `app/src/components/settings/shared` (`Toast`, `SectionCard`, `SectionHeader`).
- **APIs / services**: Freshdesk (`eagereverest.freshdesk.com`) — JWT SSO feature must be enabled in Freshdesk Admin → Security → SSO; `FRESHDESK_SSO_SECRET` must be set as a Cloudflare Worker environment binding.
