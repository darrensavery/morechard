---
feature: 18-referrals
title: Referral System
---

### Purpose

Gives each parent a unique, shareable referral link that tracks clicks and conversions. When a referred family purchases a Lifetime licence, both families receive 3 months of AI Mentor access free. The system also surfaces professional partnership and hardship licence contact paths within the same settings section.

### Methodology

**API endpoints (worker/src/routes/referrals.ts)**

- `GET /api/referrals/me` — Authenticated (parent only). Returns the family's referral code and full shareable URL (`https://app.morechard.com/?ref=CODE`). Lazy-initialises the code on first call: generates a cryptographically random 8-character uppercase hex string, retries up to 5 times on collision, then persists it to `families.referral_code`.
- `GET /api/referrals/stats` — Authenticated (parent only). Returns click count (from `referral_clicks`), sign-up count (families with a matching `referred_by_code`), conversion count, and pending reward count (from `referral_conversions`).
- `POST /api/referrals/click` — Public, no auth. Called from the landing page when a visitor arrives via `/?ref=CODE`. Validates the code exists, SHA-256-hashes the visitor's IP for deduplication, and inserts a row into `referral_clicks`. Duplicate clicks from the same IP within 24 hours are silently swallowed (no 429) to avoid penalising households sharing a link.

**UI component (app/src/components/settings/sections/ReferralsSettings.tsx)**

- Multi-view settings section with sub-views: `menu`, `peer`, `pro-legal`, `pro-media`, `hardship`.
- `PeerView` fetches code and stats in parallel via `useReferral()` hook, displays the shareable URL in a copyable mono pill, and triggers the Web Share API on mobile or falls back to clipboard.
- Stats (clicks, sign-ups, conversions) render as a 3-column card once loaded.
- Locale-gated: Polish locale hides the two professional partnership rows (`pro-legal`, `pro-media`) pending Polish Bar compliance review.

**Data tables touched**: `families` (referral_code, referred_by_code), `referral_clicks`, `referral_conversions`.

### Dependencies

- **External packages**: Cloudflare D1 (all persistence), Web Crypto API (`crypto.getRandomValues`, `crypto.subtle.digest` for IP hashing), Web Share API (navigator.share — browser built-in)
- **Internal modules**: `../lib/response.js` (json/error helpers), `./auth.js` (AuthedRequest type), `../../../lib/api` (getReferralCode, getReferralStats), `../../../lib/locale` (useLocale, isPolish), settings shared components (Toast, SettingsRow, SectionCard, SectionHeader)
- **APIs / services**: No third-party services; reward fulfilment (AI Mentor grant) is tracked via `referral_conversions.reward_granted` but the grant mechanism itself is not implemented in these files
