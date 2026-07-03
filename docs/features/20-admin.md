---
feature: 20-admin
title: Admin Panel
---

### Purpose

Provides internal operator tooling for managing school promo codes and curating the market-rate chore library. Administrators can create Stripe promotion codes for school campaigns, inspect redemption data per code, and review or dismiss community-sourced chore suggestions before they enter the public rate library.

### Methodology

All endpoints are protected by a constant-time comparison of the `X-Admin-Key` request header against the `ADMIN_SECRET` environment variable; any mismatch returns a 401.

**Promo Codes**
- `POST /api/admin/promo-codes` — Validates the request body (`coupon_id`, `label`, `code`, `max_redemptions`), creates a shared Stripe promotion code via the Stripe REST API, then records the returned `stripe_promo_code_id` in the D1 `promo_codes` table. Stripe enforces the redemption cap; D1 tracks operator metadata.
- `GET /api/admin/promo-codes` — Returns all codes with a `COUNT` of redemptions joined from `promo_code_redemptions`, ordered by creation date descending.
- `GET /api/admin/promo-codes/:id` — Returns the code record plus the full list of families that redeemed it (family ID, Stripe session ID, timestamp).

**Promotion Candidates**
- `GET /api/admin/promotion-candidates?status=pending|promoted|dismissed` — Queries the `chore_promotion_candidates` table, ordered by distinct family usage. JSON `sample_titles` is parsed from a stored string.
- `POST /api/admin/promotion-candidates/:id/promote` — Inserts the candidate into `market_rates` as a `community_median` source, writing the median value into the locale-specific column (`uk_median_pence`, `us_median_cents`, or `pl_median_grosz`). Guards against name collisions (UNIQUE constraint). Marks the candidate `promoted` in D1 and busts KV cache keys for all three locales so the new chore appears in the rate guide immediately.
- `POST /api/admin/promotion-candidates/:id/dismiss` — Marks the candidate `dismissed`; the weekly aggregation job will not resurface it.

### Dependencies

- **External packages**: `nanoid` (rate ID generation)
- **Internal modules**: `../lib/response.ts` (`json`, `error` helpers), `../lib/logger.ts`, `../lib/nanoid.ts`, `../types.ts` (`Env` bindings)
- **APIs / services**: Stripe REST API (`/v1/promotion_codes`); Cloudflare D1 (`promo_codes`, `promo_code_redemptions`, `chore_promotion_candidates`, `market_rates` tables); Cloudflare KV (`env.CACHE`) for market-rate cache invalidation
