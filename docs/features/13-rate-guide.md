---
feature: 13-rate-guide
title: Rate Guide & Market Rates
---

### Purpose

Parents and children lack a shared reference point for fair chore pay, leading to negotiation friction. The Rate Guide solves this by surfacing median pay rates for 30 canonical chores, segmented by locale (GBP/USD/PLN), so both parties see an objective benchmark before creating or suggesting a chore.

### Methodology

**API endpoints**

- `GET /api/market-rates?locale=en-GB|en-US|pl` — returns all canonical chores ordered by `sort_order`, with locale-aware `median_amount` (GBP pence, USD cents, or PLN grosz), a `value_tier` label (seeds/saplings/oaks/discoverable), and a `median_is_local` flag. PLN and USD rates are proxied from UK medians via fixed multipliers (×5 and ×1.27) when locale-specific data is absent. Response is written to KV (`market-rates:<locale>`) with a 24-hour TTL.
- `POST /api/market-rates/suggest` — child-only endpoint that writes a selected chore + proposed amount to the `suggestions` table, optionally tagging the source Learning Lab module via a `context` field stored in `reason`.
- `GET /api/market-rates/cron` — internal health check protected by `CRON_SECRET`; returns row count. Aggregation logic is stubbed and not yet implemented.

**UI components**

- `RateGuideSheet` — parent-facing bottom sheet displaying the full rate catalogue with fuzzy search; entry point is the CreateChoreSheet tile grid.
- `ChoreGuideSheet` — child-facing equivalent; lets children browse rates and trigger a `POST /api/market-rates/suggest` to propose a chore to their parent.

**Data flow**

1. `useMarketRates(currency)` maps family currency to the correct locale string, checks `sessionStorage` per-currency, and falls back to `GET /api/market-rates`.
2. `fuzzyMatch()` filters results client-side against canonical name and synonyms array.
3. On child suggestion, the worker inserts into `suggestions`; the parent reviews it via the existing `GET/POST /api/suggestions` flow (approve converts suggestion to a chore, reject requires a note).

**Value tier classification** is computed server-side in GBP-equivalent pence regardless of locale: ≤149p = seeds, ≤399p = saplings, 400p+ = oaks. Chores with no median in any locale are marked `discoverable`.

### Dependencies

- **External packages**: `nanoid` (ID generation), Cloudflare KV (`env.CACHE`), Cloudflare D1 (`env.DB`)
- **Internal modules**: `lib/response.ts` (json/error/parseBody), `lib/jwt.ts` (JwtPayload), `lib/logger.ts`, `lib/nanoid.ts`, `lib/api.ts` (getMarketRates client wrapper), `routes/suggestions.ts` (approve/reject flows), `useMarketRates` hook
- **APIs / services**: No third-party rate data source yet — all medians are seeded via `0029_market_rates.sql`; external aggregation is a future CRON task
