---
feature: 25-public-interest
title: Public Interest Data & Analytics
---

### Purpose

Captures pre-launch email sign-ups from prospective users (parents, professionals, educators) via a public-facing interest form. Registers contacts directly into Brevo (email marketing platform) with segmentation attributes so the team can tailor launch communications by contact type and household structure.

### Methodology

**API endpoint:** `POST /api/public-interest` (handled by `handlePublicInterest`)

- Validates the request body for a well-formed email (RFC length ≤ 254, regex check), explicit `consent: true`, and optional enum fields `contact_type` (`parent` | `professional` | `educator`) and `family_type` (`single_household` | `multi_household`).
- Applies an in-memory IP-based rate limit: one submission per IP per 60 seconds. The map is pruned when it exceeds 10,000 entries to prevent unbounded growth; state resets on Worker cold-start, which is acceptable for a low-traffic promo page.
- On passing validation, issues a `POST` to the Brevo v3 Contacts API. The contact is added to list ID 4 with a `SOURCE` attribute of `morechard.com-prelaunch` plus any provided segmentation attributes. `updateEnabled: true` means re-submissions by existing contacts silently update rather than error.
- Returns `{ ok: true }` on Brevo 201 (new contact) or 204 (existing contact updated). Brevo errors are logged server-side and return a generic 500 to the client.

No database writes occur — Brevo is the sole store for this data. No UI components live in this route file; the form resides on the public marketing site.

### Dependencies

- **External packages / services**:
  - Brevo REST API (`https://api.brevo.com/v3/contacts`) — contact creation and list management; requires `BREVO_API_KEY` environment binding
  - Cloudflare Workers runtime — `fetch`, in-memory `Map` rate limiter, cold-start lifecycle
- **Internal modules**:
  - `../lib/response.js` — `json()`, `error()`, `clientIp()` helpers
  - `../lib/validation.js` — `EMAIL_RE` regex constant
  - `../lib/logger.js` — `logger.error()` for server-side failure logging
  - `../types.js` — `Env` type (provides `BREVO_API_KEY`)
- **APIs / services**: None beyond Brevo. No Morechard D1 database, no auth, no other internal routes.
