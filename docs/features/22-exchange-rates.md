---
feature: 22-exchange-rates
title: Exchange Rates (Locale Multipliers)
---

### Purpose

Enables region-appropriate chore pricing across UK (GBP), US (USD), and Poland (PLN) without a code deploy. Rather than live forex, the system stores **PPP-adjusted multipliers** — "what is a fair chore reward in this country?" — that an admin can tune as markets shift. The multipliers feed the Rate Guide so suggested chore amounts are contextually fair for each family's locale.

### Methodology

**Table: `locale_multipliers`** (migration 0075)
- Three rows, one per locale (`en-GB`, `en-US`, `pl`), each storing a `multiplier` (relative to GBP pence), `currency`, human `label`, and `updated_at`.
- Seeded with initial values: GBP ×1.0, USD ×1.27, PLN ×5.0.

**Public read — `GET /api/exchange-rates`**
- No authentication required.
- Reads from KV cache (`locale-multipliers` key, 1-hour TTL) or falls back to D1.
- Returns the full multiplier table for client-side use (e.g. chore creation default amounts).

**Admin management — `GET /api/admin/exchange-rates`** and **`PUT /api/admin/exchange-rates/:locale`**
- Protected by `X-Admin-Key` header (constant-time compare against `ADMIN_SECRET`).
- `GET` returns all rows directly from D1 (no cache — admin always sees live values).
- `PUT` accepts `{ multiplier: number, label?: string }`, updates the D1 row, then busts the KV cache for `locale-multipliers` and all three `market-rates:*` keys so the Rate Guide immediately reflects the change.

**Integration with Rate Guide (`market-rates.ts`)**
- `handleMarketRateList` calls `loadMultipliers(env)` (parallel with the `market_rates` query) to get the current PLN and USD multipliers.
- When a chore row has no native local median (`pl_median_grosz` / `us_median_cents`), the fallback is `uk_median_pence × multiplier` — rounded to the nearest integer (grosz / cents).
- Tier classification (seeds / saplings / oaks) always converts back to GBP-pence equivalent using the same multiplier, keeping tier boundaries consistent across locales.

**Cache busting chain**
- Admin update → `bustExchangeRatesCache(env)` → deletes `locale-multipliers` + `market-rates:en-GB` + `market-rates:en-US` + `market-rates:pl` from KV.

### Dependencies

- **External packages / services**: Cloudflare D1 (`locale_multipliers` table); Cloudflare KV (`CACHE` binding) for 1-hour read cache.
- **Internal modules**: `exchange-rates.ts` exports `loadMultipliers`, `bustExchangeRatesCache`, `handleGetExchangeRates`; consumed by `market-rates.ts` and `admin.ts`; wired in `index.ts`.
- **APIs / services**: None — fully self-contained. No third-party FX feed.

> **Note:** `worker/src/routes/exchange.ts` is the **Firebase Auth token bridge** (`POST /auth/exchange`) — a separate, unrelated route that happens to share a filename prefix.
