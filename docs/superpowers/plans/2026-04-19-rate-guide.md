# Rate Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chore market-rate benchmarking system — a seeded D1 table of 30 canonical chores (UK industry medians), a worker API, a redesigned chore-creation picker (tile grid + fuzzy search), a parent Rate Guide sheet, a child Chore Guide sheet, and a Fast-Track suggestion approval flow.

**Architecture:** D1 `market_rates` table (30 seeded rows, US/PL NULL) is the single source of truth. A worker route at `/api/market-rates` computes value tiers and locale proxies at query time and returns a role-aware JSON response. The frontend consumes a shared `useMarketRates` hook (sessionStorage-cached) across three surfaces: `CreateChoreSheet` (tile grid + search), `RateGuideSheet` (parent browse), and `ChoreGuideSheet` (child browse + suggest). Suggest reuses the existing `suggestions` table. Fast-Track is stored as `fast_track_enabled` on `families`.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Workers (TypeScript), React + Tailwind 4 + shadcn/radix UI patterns, Vite PWA.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `worker/migrations/0028_market_rates.sql` | `market_rates` table + 30-row seed + `families.fast_track_enabled` column |
| `worker/src/routes/market-rates.ts` | GET `/api/market-rates`, POST `/api/market-rates/suggest`, GET `/api/market-rates/cron` |
| `worker/src/jobs/marketRateAggregation.ts` | CRON stub — logs row count, returns early |
| `app/src/hooks/useMarketRates.ts` | Fetch + sessionStorage cache of rate guide data |
| `app/src/components/dashboard/RateGuideSheet.tsx` | Parent-facing searchable rate table |
| `app/src/components/dashboard/ChoreGuideSheet.tsx` | Child-facing tiered guide + Suggest Chore |

### Modified files
| File | Change |
|------|--------|
| `worker/wrangler.toml` | Add Monday 03:00 UTC CRON trigger |
| `worker/src/index.ts` | Import + route market-rates handlers; add `runMarketRateAggregation` call to `scheduled()` |
| `worker/src/routes/settings.ts` | Allow `fast_track_enabled` in `handleFamilyUpdate` |
| `app/src/lib/api.ts` | Add `getMarketRates()`, `suggestChore()` |
| `app/src/components/dashboard/CreateChoreSheet.tsx` | Replace title input with tile grid + search + suggestion list + Spark animation |
| `app/src/components/dashboard/JobsTab.tsx` | Add "Check Going Rates" button; Fast-Track suggestion banner |
| `app/src/components/dashboard/EarnTab.tsx` | Add "Chore Guide" button |
| `app/src/index.css` | Add `@keyframes spark-glow` animation |

---

## Task 1: D1 Migration — `market_rates` table + seed + `fast_track_enabled`

**Files:**
- Create: `worker/migrations/0028_market_rates.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- worker/migrations/0028_market_rates.sql
-- Market rates: 30 canonical chores with UK industry medians.
-- US and PL columns are NULL (Pioneer Phase) until community data arrives.

CREATE TABLE market_rates (
  id              TEXT    PRIMARY KEY,
  canonical_name  TEXT    NOT NULL UNIQUE,
  category        TEXT    NOT NULL,
  synonyms        TEXT    NOT NULL DEFAULT '[]',
  uk_median_pence INTEGER,
  us_median_cents INTEGER,
  pl_median_grosz INTEGER,
  data_source     TEXT    NOT NULL DEFAULT 'industry_seed'
                  CHECK(data_source IN ('industry_seed', 'community_median')),
  sample_count    INTEGER NOT NULL DEFAULT 0,
  is_orchard_8    INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 99,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

ALTER TABLE families ADD COLUMN fast_track_enabled INTEGER NOT NULL DEFAULT 0;

-- ── Seed: Official Orchard 8 (is_orchard_8 = 1) ─────────────────────────────
INSERT INTO market_rates (id,canonical_name,category,synonyms,uk_median_pence,is_orchard_8,sort_order,created_at,updated_at) VALUES
  ('mr_01','Tidying Room','Tidying','["Clean room","Pick up toys","Organize room","sprzątanie pokoju"]',112,1,1,unixepoch(),unixepoch()),
  ('mr_02','Dishwashing','Kitchen','["Unload dishwasher","Empty dishwasher","Dishes","zmywanie"]',80,1,2,unixepoch(),unixepoch()),
  ('mr_03','Vacuuming','Cleaning','["Hoovering","Sweeping","odkurzanie"]',120,1,3,unixepoch(),unixepoch()),
  ('mr_04','Taking Out Bins','Errands','["Trash","Garbage","Recycling","wynoszenie śmieci"]',60,1,4,unixepoch(),unixepoch()),
  ('mr_05','Walking Dog','Pets','["Dog exercise","Pet walk","spacer z psem"]',200,1,5,unixepoch(),unixepoch()),
  ('mr_06','Washing Car','Outdoor Work','["Clean car","Auto wash","Wash the van","mycie auta"]',333,1,6,unixepoch(),unixepoch()),
  ('mr_07','Homework/Reading','Learning & Skills','["Study","Book time","Violin practice","Maths","zadanie domowe"]',135,1,7,unixepoch(),unixepoch()),
  ('mr_08','Making Bed','Tidying','["Straightening bed","Changing sheets","ścielenie łóżka"]',115,1,8,unixepoch(),unixepoch());

-- ── Seed: Remaining 22 ───────────────────────────────────────────────────────
INSERT INTO market_rates (id,canonical_name,category,synonyms,uk_median_pence,is_orchard_8,sort_order,created_at,updated_at) VALUES
  ('mr_09','Mowing Lawn','Outdoor Work','["Cut grass","Mow grass","Lawn care","koszenie trawy"]',368,0,9,unixepoch(),unixepoch()),
  ('mr_10','Mopping','Cleaning','["Cleaning floors","Washing floors","mycie podłóg"]',140,0,10,unixepoch(),unixepoch()),
  ('mr_11','Cleaning Windows','Cleaning','["Washing windows","Glass cleaning","mycie okien"]',154,0,11,unixepoch(),unixepoch()),
  ('mr_12','Cleaning Bathroom','Cleaning','["Scrubbing toilet","Cleaning shower","mycie łazienki"]',210,0,12,unixepoch(),unixepoch()),
  ('mr_13','Cooking Dinner','Kitchen','["Making a meal","Prepping dinner","gotowanie obiadu"]',300,0,13,unixepoch(),unixepoch()),
  ('mr_14','Setting Table','Kitchen','["Laying table","Clearing table","nakrywanie do stołu"]',70,0,14,unixepoch(),unixepoch()),
  ('mr_15','Cleaning Fridge','Kitchen','["Emptying fridge","Wiping shelves","mycie lodówki"]',250,0,15,unixepoch(),unixepoch()),
  ('mr_16','Folding Clothes','Laundry','["Sorting laundry","Putting wash away","składanie ubrań"]',100,0,16,unixepoch(),unixepoch()),
  ('mr_17','Ironing','Laundry','["Pressing clothes","Laundry prep","prasowanie"]',200,0,17,unixepoch(),unixepoch()),
  ('mr_18','Loading Wash','Laundry','["Starting washing machine","Laundry load","pranie"]',90,0,18,unixepoch(),unixepoch()),
  ('mr_19','Watering Plants','Garden','["Feeding plants","Watering garden","podlewanie kwiatów"]',191,0,19,unixepoch(),unixepoch()),
  ('mr_20','Weeding','Garden','["Pulling weeds","Garden clearing","pielenie"]',166,0,20,unixepoch(),unixepoch()),
  ('mr_21','Raking Leaves','Garden','["Sweeping leaves","Garden tidy","grabienie liści"]',150,0,21,unixepoch(),unixepoch()),
  ('mr_22','Feeding Pets','Pets','["Pet food","Water bowls","karmienie zwierzaka"]',50,0,22,unixepoch(),unixepoch()),
  ('mr_23','Cleaning Cage','Pets','["Litter box","Hutch cleaning","sprzątanie klatki"]',250,0,23,unixepoch(),unixepoch()),
  ('mr_24','Grocery Shop','Errands','["Running to shop","Buying milk","zakupy"]',150,0,24,unixepoch(),unixepoch()),
  ('mr_25','Painting/DIY','Outdoor Work','["Painting fence","Sanding","Minor repairs","malowanie"]',500,0,25,unixepoch(),unixepoch()),
  ('mr_26','Babysitting','Outdoor Work','["Watching siblings","Child care","opieka nad rodzeństwem"]',1866,0,26,unixepoch(),unixepoch()),
  ('mr_27','Brushing Teeth','Good Habits','["Morning routine","Night routine","mycie zębów"]',20,0,27,unixepoch(),unixepoch()),
  ('mr_28','Getting Dressed','Good Habits','["Ready for school","School uniform","ubieranie się"]',50,0,28,unixepoch(),unixepoch()),
  ('mr_29','Good Behavior','Good Habits','["Being helpful","Listening","dobre zachowanie"]',200,0,29,unixepoch(),unixepoch()),
  ('mr_30','Reading','Learning & Skills','["Daily reading","Book log","czytanie"]',100,0,30,unixepoch(),unixepoch());
```

- [ ] **Step 2: Apply migration locally**

```bash
cd worker
npx wrangler d1 execute morechard --local --file=migrations/0028_market_rates.sql
```

Expected output: `✅ Successfully executed ...` with no errors.

- [ ] **Step 3: Verify rows**

```bash
npx wrangler d1 execute morechard --local --command="SELECT COUNT(*) as total, SUM(is_orchard_8) as orchard_8 FROM market_rates;"
```

Expected: `total: 30, orchard_8: 8`

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0028_market_rates.sql
git commit -m "feat(db): add market_rates table + 30-row seed + families.fast_track_enabled"
```

---

## Task 2: CRON skeleton — `marketRateAggregation.ts`

**Files:**
- Create: `worker/src/jobs/marketRateAggregation.ts`

- [ ] **Step 1: Create the stub file**

```typescript
// worker/src/jobs/marketRateAggregation.ts
import { Env } from '../types.js';

/**
 * Weekly market rate aggregation job.
 * Currently a stub — verifies D1 read access and logs row count.
 * Full aggregation logic (AI canonical mapper) is deferred to a future phase.
 */
export async function runMarketRateAggregation(env: Env): Promise<void> {
  const result = await env.DB
    .prepare('SELECT COUNT(*) as total FROM market_rates')
    .first<{ total: number }>();

  console.log(`[market-rate-aggregation] market_rates row count: ${result?.total ?? 0}. Aggregation not yet implemented.`);
}
```

- [ ] **Step 2: Add CRON trigger to wrangler.toml**

Open `worker/wrangler.toml`. The existing `[triggers]` section has one cron. Add the Monday aggregation trigger:

```toml
[triggers]
crons = ["0 8 * * 6", "0 3 * * 1"]
```

- [ ] **Step 3: Wire into `scheduled()` in `worker/src/index.ts`**

Add the import near the top of the file (after other job imports):

```typescript
import { runMarketRateAggregation } from './jobs/marketRateAggregation.js';
```

Then inside `async scheduled(_event, env)`, add step 3 after the existing steps:

```typescript
    // ── 4. Weekly market rate aggregation ──────────────────────
    await runMarketRateAggregation(env);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd worker
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/jobs/marketRateAggregation.ts worker/src/index.ts worker/wrangler.toml
git commit -m "feat(cron): add market rate aggregation skeleton — logs row count weekly"
```

---

## Task 3: Worker route — `GET /api/market-rates`

**Files:**
- Create: `worker/src/routes/market-rates.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Create the route file with the GET handler**

```typescript
// worker/src/routes/market-rates.ts
/**
 * Market Rates routes
 *
 * GET  /api/market-rates           — list all canonical chores with locale-aware medians
 * POST /api/market-rates/suggest   — child suggests a chore to parent (writes to suggestions table)
 * GET  /api/market-rates/cron      — internal CRON health check (no user auth)
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { nanoid } from '../lib/nanoid.js';

type AuthedRequest = Request & { auth: JwtPayload };

// ── Value tier thresholds (GBP pence equivalent) ────────────────────────────
const TIER_SEEDS_MAX    = 149;  // £0 – £1.49
const TIER_SAPLINGS_MAX = 399;  // £1.50 – £3.99
                                 // £4.00+ = oaks

// ── Proxy multipliers for Pioneer Phase ─────────────────────────────────────
const PLN_MULTIPLIER = 5;
const USD_MULTIPLIER = 1.27;

type ValueTier = 'seeds' | 'saplings' | 'oaks' | 'discoverable';

interface TierInfo {
  value_tier: ValueTier;
  value_tier_label: string;
}

function computeTier(amount: number): TierInfo {
  if (amount <= TIER_SEEDS_MAX)    return { value_tier: 'seeds',    value_tier_label: 'Small Seeds' };
  if (amount <= TIER_SAPLINGS_MAX) return { value_tier: 'saplings', value_tier_label: 'Growing Saplings' };
  return                                  { value_tier: 'oaks',     value_tier_label: 'Great Oaks' };
}

interface MarketRateRow {
  id: string;
  canonical_name: string;
  category: string;
  synonyms: string;          // JSON string
  uk_median_pence: number | null;
  us_median_cents: number | null;
  pl_median_grosz: number | null;
  data_source: string;
  sample_count: number;
  is_orchard_8: number;
  sort_order: number;
}

export async function handleMarketRateList(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const auth   = (request as AuthedRequest).auth;

  // Determine locale: query param overrides, else fall back to token locale
  const localeParam = url.searchParams.get('locale') ?? (auth as unknown as Record<string, string>).locale ?? 'en-GB';

  const rows = await env.DB
    .prepare('SELECT * FROM market_rates ORDER BY sort_order ASC')
    .all<MarketRateRow>();

  const rates = (rows.results ?? []).map(row => {
    let medianAmount: number | null = null;
    let medianIsLocal = false;

    if (localeParam === 'pl') {
      if (row.pl_median_grosz != null) {
        medianAmount  = row.pl_median_grosz;
        medianIsLocal = true;
      } else if (row.uk_median_pence != null) {
        medianAmount  = Math.round(row.uk_median_pence * PLN_MULTIPLIER);
        medianIsLocal = false;
      }
    } else if (localeParam === 'en-US') {
      if (row.us_median_cents != null) {
        medianAmount  = row.us_median_cents;
        medianIsLocal = true;
      } else if (row.uk_median_pence != null) {
        medianAmount  = Math.round(row.uk_median_pence * USD_MULTIPLIER);
        medianIsLocal = false;
      }
    } else {
      // en-GB (default)
      if (row.uk_median_pence != null) {
        medianAmount  = row.uk_median_pence;
        medianIsLocal = true;
      }
    }

    let tierInfo: TierInfo;
    if (medianAmount == null) {
      tierInfo = { value_tier: 'discoverable', value_tier_label: 'Discoverable' };
    } else {
      // Tier is always computed against GBP-equivalent pence for consistency
      const penceEquivalent = localeParam === 'pl'
        ? Math.round(medianAmount / PLN_MULTIPLIER)
        : localeParam === 'en-US'
          ? Math.round(medianAmount / USD_MULTIPLIER)
          : medianAmount;
      tierInfo = computeTier(penceEquivalent);
    }

    let synonyms: string[] = [];
    try { synonyms = JSON.parse(row.synonyms); } catch { /* malformed JSON */ }

    return {
      id:                row.id,
      canonical_name:    row.canonical_name,
      category:          row.category,
      synonyms,
      median_amount:     medianAmount,
      median_is_local:   medianIsLocal,
      value_tier:        tierInfo.value_tier,
      value_tier_label:  tierInfo.value_tier_label,
      is_orchard_8:      row.is_orchard_8 === 1,
      sort_order:        row.sort_order,
      data_source:       row.data_source,
      sample_count:      row.sample_count,
    };
  });

  return json({ tile_source: 'hardcoded_defaults', rates });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Register route in `worker/src/index.ts`**

Add the import at the top:

```typescript
import {
  handleMarketRateList,
  handleMarketRateSuggest,
  handleMarketRateCron,
} from './routes/market-rates.js';
```

In the `route()` function, add these cases (parent + child accessible, so place after the auth middleware block but before role-specific routes):

```typescript
    // ── Market Rates ────────────────────────────────────────────
    if (path === '/api/market-rates' && method === 'GET') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
      return handleMarketRateList(request, env);
    }
    if (path === '/api/market-rates/suggest' && method === 'POST') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
      return handleMarketRateSuggest(request, env);
    }
    if (path === '/api/market-rates/cron' && method === 'GET') {
      return handleMarketRateCron(request, env);
    }
```

- [ ] **Step 4: Test the GET endpoint locally**

```bash
cd worker && npx wrangler dev --local
```

In a separate terminal:
```bash
# Get a JWT first (use your local login flow), then:
curl -s "http://localhost:8787/api/market-rates" \
  -H "Authorization: Bearer <your_jwt>" | jq '.rates | length'
```

Expected: `30`

```bash
curl -s "http://localhost:8787/api/market-rates" \
  -H "Authorization: Bearer <your_jwt>" | jq '.rates[0]'
```

Expected shape:
```json
{
  "id": "mr_01",
  "canonical_name": "Tidying Room",
  "category": "Tidying",
  "synonyms": ["Clean room", "Pick up toys", "Organize room", "sprzątanie pokoju"],
  "median_amount": 112,
  "median_is_local": true,
  "value_tier": "seeds",
  "value_tier_label": "Small Seeds",
  "is_orchard_8": true,
  "sort_order": 1,
  "data_source": "industry_seed",
  "sample_count": 0
}
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/market-rates.ts worker/src/index.ts
git commit -m "feat(api): GET /api/market-rates — locale-aware medians + value tiers"
```

---

## Task 4: Worker route — `POST /api/market-rates/suggest` + CRON endpoint

**Files:**
- Modify: `worker/src/routes/market-rates.ts`

- [ ] **Step 1: Add `handleMarketRateSuggest` to `market-rates.ts`**

Append to `worker/src/routes/market-rates.ts`:

```typescript
export async function handleMarketRateSuggest(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth;
  if (auth.role !== 'child') return error('Only children can suggest chores', 403);

  const body = await request.json() as Record<string, unknown>;
  const { canonical_name, median_amount, currency, context } = body;

  if (!canonical_name || typeof canonical_name !== 'string')
    return error('canonical_name required');
  if (!Number.isInteger(median_amount) || (median_amount as number) <= 0)
    return error('median_amount must be a positive integer');
  if (!currency || !['GBP', 'PLN', 'USD'].includes(currency as string))
    return error('currency must be GBP, PLN, or USD');

  const id  = nanoid();
  const now = Math.floor(Date.now() / 1000);

  // Store context (module slug) in the existing `reason` column.
  // Format: "module:01-effort-vs-reward" or null for direct browse.
  const reason = context && typeof context === 'string' ? context : null;

  await env.DB.prepare(`
    INSERT INTO suggestions
      (id, family_id, child_id, title, proposed_amount, reason, submitted_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(
    id,
    auth.family_id,
    auth.sub,
    (canonical_name as string).trim(),
    median_amount as number,
    reason,
    now,
  ).run();

  return json({ status: 'sent' }, 201);
}
```

- [ ] **Step 2: Add `handleMarketRateCron` to `market-rates.ts`**

Append to `worker/src/routes/market-rates.ts`:

```typescript
export async function handleMarketRateCron(_request: Request, env: Env): Promise<Response> {
  const result = await env.DB
    .prepare('SELECT COUNT(*) as total FROM market_rates')
    .first<{ total: number }>();

  const rowCount = result?.total ?? 0;
  console.log(`[market-rate-cron] row_count=${rowCount}`);

  return json({ status: 'ok', row_count: rowCount, message: 'aggregation not yet implemented' });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test suggest endpoint**

With the dev server running and a child JWT:
```bash
curl -s -X POST "http://localhost:8787/api/market-rates/suggest" \
  -H "Authorization: Bearer <child_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"canonical_name":"Mowing Lawn","median_amount":368,"currency":"GBP","context":null}' | jq
```

Expected: `{ "status": "sent" }`

```bash
# Verify it landed in suggestions table
npx wrangler d1 execute morechard --local \
  --command="SELECT id, title, proposed_amount, reason FROM suggestions ORDER BY submitted_at DESC LIMIT 1;"
```

Expected: row with `title: "Mowing Lawn"`, `proposed_amount: 368`, `reason: null`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/market-rates.ts
git commit -m "feat(api): POST /api/market-rates/suggest + CRON health endpoint"
```

---

## Task 5: Allow `fast_track_enabled` in `handleFamilyUpdate`

**Files:**
- Modify: `worker/src/routes/settings.ts`

- [ ] **Step 1: Add `fast_track_enabled` to the allowed update fields**

In `worker/src/routes/settings.ts`, inside `handleFamilyUpdate`, after the `verify_mode` block add:

```typescript
  if ('fast_track_enabled' in body) {
    const val = body.fast_track_enabled;
    if (val !== 0 && val !== 1 && val !== true && val !== false)
      return error('fast_track_enabled must be a boolean');
    updates.push('fast_track_enabled = ?');
    values.push(val ? 1 : 0);
  }
```

- [ ] **Step 2: Expose `fast_track_enabled` in `handleFamilyGet`**

Find `handleFamilyGet` in `worker/src/routes/settings.ts`. Check that `fast_track_enabled` is included in the SELECT. If the query is `SELECT *` it will already be included; if it lists columns explicitly, add `fast_track_enabled` to the list.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/settings.ts
git commit -m "feat(api): allow fast_track_enabled in family update"
```

---

## Task 6: Frontend API client functions

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add the `MarketRate` type and `getMarketRates` function**

Open `app/src/lib/api.ts`. At the end of the file, append:

```typescript
// ----------------------------------------------------------------
// Market Rates
// ----------------------------------------------------------------
export interface MarketRate {
  id: string;
  canonical_name: string;
  category: string;
  synonyms: string[];
  median_amount: number | null;
  median_is_local: boolean;
  value_tier: 'seeds' | 'saplings' | 'oaks' | 'discoverable';
  value_tier_label: string;
  is_orchard_8: boolean;
  sort_order: number;
  data_source: string;
  sample_count: number;
}

export interface MarketRatesResponse {
  tile_source: 'hardcoded_defaults' | 'locale_frequent' | 'user_frequent';
  rates: MarketRate[];
}

export async function getMarketRates(locale?: string): Promise<MarketRatesResponse> {
  const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  return request<MarketRatesResponse>(`/api/market-rates${q}`);
}

export async function suggestChore(body: {
  canonical_name: string;
  median_amount: number;
  currency: string;
  context: string | null;
}): Promise<{ status: string }> {
  return request('/api/market-rates/suggest', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(client): add getMarketRates and suggestChore API functions"
```

---

## Task 7: `useMarketRates` hook

**Files:**
- Create: `app/src/hooks/useMarketRates.ts`

- [ ] **Step 1: Create the hook**

```typescript
// app/src/hooks/useMarketRates.ts
import { useState, useEffect } from 'react';
import { getMarketRates, MarketRate, MarketRatesResponse } from '../lib/api';
import { useLocale } from '../lib/locale';

const SESSION_KEY = 'mc_market_rates';

export function useMarketRates(): {
  rates: MarketRate[];
  tileSource: MarketRatesResponse['tile_source'];
  loading: boolean;
  error: string | null;
} {
  const { locale } = useLocale();
  const [rates, setRates]           = useState<MarketRate[]>([]);
  const [tileSource, setTileSource] = useState<MarketRatesResponse['tile_source']>('hardcoded_defaults');
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState<string | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as MarketRatesResponse;
        setRates(parsed.rates);
        setTileSource(parsed.tile_source);
        setLoading(false);
        return;
      } catch { /* stale cache — refetch */ }
    }

    getMarketRates(locale)
      .then(data => {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        setRates(data.rates);
        setTileSource(data.tile_source);
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Failed to load rate guide'))
      .finally(() => setLoading(false));
  }, [locale]);

  return { rates, tileSource, loading, error: err };
}

/** Returns true if the typed query matches a canonical chore name or any of its synonyms. */
export function fuzzyMatch(rate: MarketRate, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    rate.canonical_name.toLowerCase().includes(q) ||
    rate.synonyms.some(s => s.toLowerCase().includes(q))
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/hooks/useMarketRates.ts
git commit -m "feat(hook): useMarketRates — sessionStorage-cached rate guide with fuzzy match helper"
```

---

## Task 8: Spark animation CSS

**Files:**
- Modify: `app/src/index.css`

- [ ] **Step 1: Add the `@keyframes spark-glow` animation**

Open `app/src/index.css`. Find the existing `@keyframes` blocks (e.g. `treeSway`, `leafFall`). Append after them:

```css
@keyframes spark-glow {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand-primary) 60%, transparent); }
  40%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand-primary) 30%, transparent); }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.spark-animating {
  animation: spark-glow 800ms ease-out forwards;
  ring-color: var(--brand-primary);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/index.css
git commit -m "feat(css): add spark-glow animation for rate auto-fill"
```

---

## Task 9: `RateGuideSheet.tsx` — parent browse view

**Files:**
- Create: `app/src/components/dashboard/RateGuideSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/src/components/dashboard/RateGuideSheet.tsx
import { useState, useMemo } from 'react';
import { useMarketRates, fuzzyMatch } from '../../hooks/useMarketRates';
import { useLocale } from '../../lib/locale';
import { currencySymbol } from '../../lib/locale';
import { MarketRate } from '../../lib/api';

const CATEGORIES = [
  'All','Outdoor Work','Cleaning','Kitchen','Laundry','Tidying',
  'Garden','Pets','Errands','Learning & Skills','Good Habits',
];

function formatAmount(amount: number | null, symbol: string): string {
  if (amount == null) return '—';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RateGuideSheet({ open, onClose }: Props) {
  const { rates, loading, error } = useMarketRates();
  const { currency } = useLocale();
  const symbol = currencySymbol(currency);

  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All');

  const filtered: MarketRate[] = useMemo(() => {
    return rates.filter(r => {
      const matchesCategory = category === 'All' || r.category === category;
      const matchesSearch   = fuzzyMatch(r, search);
      return matchesCategory && matchesSearch;
    });
  }, [rates, search, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[--color-bg]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-[--color-border]">
        <h2 className="text-lg font-semibold text-[--color-text]">Rate Guide</h2>
        <button
          onClick={onClose}
          className="text-sm text-[--color-text-muted] hover:text-[--color-text]"
        >
          Close
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <input
          type="search"
          placeholder="Search chores…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--brand-primary]"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-[--brand-primary] text-[--color-text-on-brand]'
                : 'bg-[--color-surface] text-[--color-text-muted] border border-[--color-border]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && <p className="py-8 text-center text-sm text-[--color-text-muted]">Loading…</p>}
        {error   && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-[--color-text-muted]">No results</p>
        )}
        {!loading && !error && filtered.map(rate => (
          <div
            key={rate.id}
            className="flex items-center justify-between py-3 border-b border-[--color-border] last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-[--color-text]">{rate.canonical_name}</p>
              <p className="text-xs text-[--color-text-muted]">{rate.category}</p>
            </div>
            <div className="flex items-center gap-2">
              {!rate.median_is_local && (
                <span
                  title="Pioneer rate — based on UK average"
                  className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5"
                >
                  Pioneer
                </span>
              )}
              <span className="text-sm font-semibold tabular-nums text-[--color-text]">
                {formatAmount(rate.median_amount, symbol)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/RateGuideSheet.tsx
git commit -m "feat(ui): RateGuideSheet — parent browsable rate table with category filter"
```

---

## Task 10: `ChoreGuideSheet.tsx` — child browse + suggest view

**Files:**
- Create: `app/src/components/dashboard/ChoreGuideSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/src/components/dashboard/ChoreGuideSheet.tsx
import { useState, useMemo } from 'react';
import { useMarketRates } from '../../hooks/useMarketRates';
import { useLocale, currencySymbol } from '../../lib/locale';
import { suggestChore } from '../../lib/api';
import { MarketRate } from '../../lib/api';
import { getFamilyId } from '../../lib/api';

const TIER_ORDER = ['oaks', 'saplings', 'seeds', 'discoverable'] as const;
const TIER_HEADINGS: Record<string, string> = {
  oaks:         '🌳 Great Oaks',
  saplings:     '🌿 Growing Saplings',
  seeds:        '🌱 Small Seeds',
  discoverable: '🔍 Discoverable',
};

function formatAmount(amount: number | null, symbol: string): string {
  if (amount == null) return '—';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional: module slug passed when navigating from a Learning Lab module */
  context?: string | null;
}

export function ChoreGuideSheet({ open, onClose, context = null }: Props) {
  const { rates, loading, error } = useMarketRates();
  const { currency, locale }      = useLocale();
  const symbol                    = currencySymbol(currency);

  const [suggested, setSuggested]   = useState<string | null>(null); // id of just-suggested chore
  const [sending,   setSending]     = useState<string | null>(null);  // id currently sending
  const [success,   setSuccess]     = useState(false);

  const grouped = useMemo(() => {
    const map: Record<string, MarketRate[]> = {};
    for (const tier of TIER_ORDER) map[tier] = [];
    for (const rate of rates) map[rate.value_tier]?.push(rate);
    return map;
  }, [rates]);

  async function handleSuggest(rate: MarketRate) {
    if (sending || suggested === rate.id) return;
    setSending(rate.id);
    try {
      await suggestChore({
        canonical_name: rate.canonical_name,
        median_amount:  rate.median_amount ?? 0,
        currency:       currency || 'GBP',
        context,
      });
      setSuggested(rate.id);
      setSuccess(true);
    } catch {
      // fail silently — user can retry
    } finally {
      setSending(null);
    }
  }

  if (!open) return null;

  // Success state — shown after a suggest action
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[--color-bg] px-8 text-center">
        <p className="text-5xl mb-4">🌳</p>
        <h2 className="text-xl font-semibold text-[--color-text] mb-2">Proposal sent!</h2>
        <p className="text-sm text-[--color-text-muted] mb-8">
          Your parent will see that you're ready to grow some Great Oaks.
        </p>
        <button
          onClick={() => { setSuccess(false); onClose(); }}
          className="rounded-xl bg-[--brand-primary] text-[--color-text-on-brand] px-6 py-3 text-sm font-semibold"
        >
          Done
        </button>
      </div>
    );
  }

  const regionLabel = locale === 'pl' ? 'Poland' : locale === 'en-US' ? 'the US' : 'your area';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[--color-bg]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-[--color-border]">
        <h2 className="text-lg font-semibold text-[--color-text]">Chore Guide</h2>
        <button onClick={onClose} className="text-sm text-[--color-text-muted] hover:text-[--color-text]">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && <p className="py-8 text-center text-sm text-[--color-text-muted]">Loading…</p>}
        {error   && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
        {!loading && !error && TIER_ORDER.map(tier => {
          const tierRates = grouped[tier];
          if (!tierRates.length) return null;
          return (
            <div key={tier} className="mt-6">
              <h3 className="text-sm font-bold text-[--color-text-muted] uppercase tracking-wider mb-3">
                {TIER_HEADINGS[tier]}
              </h3>
              {tierRates.map(rate => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between py-3 border-b border-[--color-border] last:border-0"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-[--color-text] truncate">{rate.canonical_name}</p>
                    {!rate.median_is_local && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        We're still learning what this is worth in {regionLabel} — you could be the first!
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-[--color-text]">
                      {formatAmount(rate.median_amount, symbol)}
                    </span>
                    <button
                      disabled={sending === rate.id || suggested === rate.id}
                      onClick={() => handleSuggest(rate)}
                      className="rounded-lg bg-[--brand-primary] text-[--color-text-on-brand] px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-opacity"
                    >
                      {sending === rate.id ? '…' : suggested === rate.id ? '✓' : 'Suggest'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/dashboard/ChoreGuideSheet.tsx
git commit -m "feat(ui): ChoreGuideSheet — child chore guide with tier grouping and Suggest flow"
```

---

## Task 11: Redesign `CreateChoreSheet.tsx` — tile grid + search + suggestion list

**Files:**
- Modify: `app/src/components/dashboard/CreateChoreSheet.tsx`

- [ ] **Step 1: Read the current file to understand form state and structure**

Open `app/src/components/dashboard/CreateChoreSheet.tsx` and note:
- The state variable name for the chore title (likely `form.title` or `title`)
- The state variable for `reward_amount`
- Where the title `<input>` currently lives in the JSX

- [ ] **Step 2: Add imports at the top of `CreateChoreSheet.tsx`**

```tsx
import { useState, useRef, useCallback } from 'react';
import { useMarketRates, fuzzyMatch } from '../../hooks/useMarketRates';
import { MarketRate } from '../../lib/api';
```

(Keep all existing imports; add these alongside them.)

- [ ] **Step 3: Add state for picker UI inside the component**

Inside the component function, add:

```tsx
const { rates, tileSource } = useMarketRates();
const [searchQuery,     setSearchQuery]     = useState('');
const [showSuggestions, setShowSuggestions] = useState(false);
const [sparkActive,     setSparkActive]     = useState(false);
const sparkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 4: Add tile emoji map**

```tsx
const TILE_EMOJI: Record<string, string> = {
  'Tidying Room':      '🛏️',
  'Dishwashing':       '🍽️',
  'Vacuuming':         '🧹',
  'Taking Out Bins':   '🗑️',
  'Walking Dog':       '🐕',
  'Washing Car':       '🚗',
  'Homework/Reading':  '📚',
  'Making Bed':        '🛌',
};
```

- [ ] **Step 5: Add the `selectRate` handler**

```tsx
const selectRate = useCallback((rate: MarketRate) => {
  // Fill title
  setForm(prev => ({
    ...prev,
    title:         rate.canonical_name,
    reward_amount: rate.median_amount != null
      ? (rate.median_amount / 100).toFixed(2)
      : prev.reward_amount,
  }));
  setSearchQuery('');
  setShowSuggestions(false);
  // Trigger spark animation
  if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
  setSparkActive(true);
  sparkTimerRef.current = setTimeout(() => setSparkActive(false), 850);
}, []);
```

> **Note:** If the form state uses a different setter name (e.g. `setTitle`, `setAmount`), adapt the above to match. The logic is: set `title` = `rate.canonical_name`, set `reward_amount` = formatted amount string.

- [ ] **Step 6: Replace the title input with the three-layer picker**

Find the existing title `<input>` (look for `placeholder="e.g. Organising the bookshelf"` or similar). Replace it and its surrounding `<label>` with:

```tsx
{/* ── Tile grid ─────────────────────────────────────────────── */}
<div className="mb-4">
  <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-2">
    Quick Pick
  </p>
  <div className="grid grid-cols-4 gap-2">
    {rates
      .filter(r => r.is_orchard_8)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rate => (
        <button
          key={rate.id}
          type="button"
          onClick={() => selectRate(rate)}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[--color-border] bg-[--color-surface] py-3 px-1 text-center hover:border-[--brand-primary] transition-colors"
        >
          <span className="text-xl">{TILE_EMOJI[rate.canonical_name] ?? '✅'}</span>
          <span className="text-[10px] font-medium text-[--color-text] leading-tight">
            {rate.canonical_name.split('/')[0]}
          </span>
        </button>
      ))}
  </div>
</div>

{/* ── Search input ───────────────────────────────────────────── */}
<div className="mb-1 relative">
  <label className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider block mb-1">
    Or search / enter a chore title
  </label>
  <input
    type="text"
    value={searchQuery || form.title}
    placeholder="e.g. Mowing the lawn…"
    onFocus={() => setShowSuggestions(true)}
    onChange={e => {
      const val = e.target.value;
      setSearchQuery(val);
      setForm(prev => ({ ...prev, title: val }));
      setShowSuggestions(true);
    }}
    className="w-full rounded-lg border border-[--color-border] bg-[--color-surface] px-3 py-2.5 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--brand-primary]"
  />
</div>

{/* ── More Suggestions list ──────────────────────────────────── */}
{showSuggestions && (
  <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-[--color-border] bg-[--color-surface] divide-y divide-[--color-border]">
    <p className="px-3 py-1.5 text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider sticky top-0 bg-[--color-surface]">
      More Suggestions
    </p>
    {rates
      .filter(r => !r.is_orchard_8 && fuzzyMatch(r, searchQuery))
      .map(rate => (
        <button
          key={rate.id}
          type="button"
          onClick={() => selectRate(rate)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[--color-surface-alt] transition-colors"
        >
          <span className="flex items-center gap-1.5 text-sm text-[--color-text]">
            <span className="text-[--brand-primary]">🌱</span>
            {rate.canonical_name}
          </span>
          {rate.median_amount != null && (
            <span className="text-xs tabular-nums text-[--color-text-muted]">
              {currencySymbol(currency)}{(rate.median_amount / 100).toFixed(2)}
            </span>
          )}
        </button>
      ))}
    {rates.filter(r => !r.is_orchard_8 && fuzzyMatch(r, searchQuery)).length === 0 && searchQuery && (
      <p className="px-3 py-3 text-xs text-[--color-text-muted]">
        No match — your custom chore will be added.
      </p>
    )}
  </div>
)}
```

You'll need to import `currencySymbol` and `useLocale` if not already imported:
```tsx
import { useLocale, currencySymbol } from '../../lib/locale';
```
And add inside the component:
```tsx
const { currency } = useLocale();
```

- [ ] **Step 7: Add the Spark animation class to the reward amount input**

Find the reward amount `<input>` element. Add the `sparkActive` class conditionally:

```tsx
className={`... ${sparkActive ? 'spark-animating ring-2 ring-[--brand-primary]' : ''}`}
```

Also add an `onChange` handler update that clears the spark when the user manually edits:
```tsx
onChange={e => {
  setSparkActive(false);
  setForm(prev => ({ ...prev, reward_amount: e.target.value }));
}}
```

- [ ] **Step 8: Dismiss suggestions on outside click**

Wrap the suggestions list in a `useEffect` that adds a global click listener to dismiss it when clicking outside. Add near the other state:

```tsx
useEffect(() => {
  if (!showSuggestions) return;
  const handler = () => setShowSuggestions(false);
  document.addEventListener('click', handler, { capture: true, once: true });
  return () => document.removeEventListener('click', handler, { capture: true });
}, [showSuggestions]);
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 10: Start dev server and manually test**

```bash
cd app && npm run dev
```

Open the app, go to the parent Chores tab, tap "Add task":
1. Tile grid shows 8 tiles with emoji icons
2. Tapping a tile fills the title and reward amount; reward field glows briefly
3. Focusing the search input shows "More Suggestions" list with 🌱 badges
4. Typing "mow" filters list to "Mowing Lawn"
5. Typing "xyz123" shows "No match — your custom chore will be added."

- [ ] **Step 11: Commit**

```bash
git add app/src/components/dashboard/CreateChoreSheet.tsx
git commit -m "feat(ui): CreateChoreSheet — tile grid + fuzzy search + Spark animation"
```

---

## Task 12: Wire Rate Guide button into `JobsTab.tsx`

**Files:**
- Modify: `app/src/components/dashboard/JobsTab.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useState } from 'react'; // if not already present
import { RateGuideSheet } from './RateGuideSheet';
```

- [ ] **Step 2: Add state**

```tsx
const [rateGuideOpen, setRateGuideOpen] = useState(false);
```

- [ ] **Step 3: Add the "Check Going Rates" button**

Find where active chores list begins (look for the section that renders chore cards). Insert above it:

```tsx
<div className="flex justify-end mb-3">
  <button
    type="button"
    onClick={() => setRateGuideOpen(true)}
    className="text-xs font-medium text-[--brand-primary] underline-offset-2 hover:underline"
  >
    Check Going Rates
  </button>
</div>
```

- [ ] **Step 4: Add `<RateGuideSheet>` to the JSX**

At the end of the component's return, before the closing fragment or outer div:

```tsx
<RateGuideSheet open={rateGuideOpen} onClose={() => setRateGuideOpen(false)} />
```

- [ ] **Step 5: Update the suggestion banner for module-linked suggestions**

Find the existing suggestions banner in `JobsTab.tsx` (the section that renders pending suggestions). Update it to detect module context suggestions and render appropriately:

```tsx
{pendingSuggestions.map(s => {
  const hasModuleContext = s.reason?.startsWith('module:') ?? false;
  const moduleLabel = hasModuleContext
    ? s.reason!.replace('module:', '').replace(/-/g, ' ').replace(/^\d+-/, '')
    : null;

  return (
    <div key={s.id} className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3 mb-2">
      {hasModuleContext ? (
        <p className="text-sm text-[--color-text] mb-2">
          <span className="font-medium">{s.child_name}</span> just finished a lesson on{' '}
          <span className="capitalize">{moduleLabel}</span> and wants to put it into practice!
          They'd like to try{' '}
          <span className="font-medium">{s.title}</span> for{' '}
          {currencySymbol(currency)}{(s.proposed_amount / 100).toFixed(2)}.
        </p>
      ) : (
        <p className="text-sm text-[--color-text] mb-2">
          <span className="font-medium">{s.child_name}</span> wants to earn{' '}
          {currencySymbol(currency)}{(s.proposed_amount / 100).toFixed(2)}{' '}
          by <span className="font-medium">{s.title}</span>.
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => handleSuggestionAccept(s)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            hasModuleContext
              ? 'border border-[--brand-primary] bg-transparent text-[--brand-primary]'
              : 'bg-[--brand-primary] text-[--color-text-on-brand]'
          }`}
        >
          {hasModuleContext && <span>🌱</span>}
          {hasModuleContext ? 'Accept' : 'View'}
        </button>
        <button
          onClick={() => handleSuggestionReject(s.id)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[--color-text-muted] hover:text-[--color-text]"
        >
          Decline
        </button>
      </div>
    </div>
  );
})}
```

> **Note:** Replace `handleSuggestionAccept` and `handleSuggestionReject` with the actual function names already in `JobsTab.tsx`. The key change is detecting `s.reason?.startsWith('module:')` and adjusting copy + button style accordingly. The accept action (opening CreateChoreSheet pre-filled) should remain the same regardless.

- [ ] **Step 6: Add Fast-Track accept path**

Find where `handleSuggestionAccept` is defined. Add Fast-Track logic:

```tsx
// At the top of the component, fetch family settings to get fast_track_enabled
// (it should already be available if JobsTab loads family data — check existing state)

async function handleSuggestionAccept(s: Suggestion) {
  if (fastTrackEnabled) {
    // One-tap: create chore directly
    await createChore({
      family_id:     familyId,
      assigned_to:   s.child_id,
      title:         s.title,
      reward_amount: s.proposed_amount,
      currency:      currency || 'GBP',
      frequency:     'as_needed',
    });
    await rejectSuggestion(s.id); // dismiss suggestion row
    reload();
  } else {
    // Standard: pre-fill CreateChoreSheet
    openCreateSheet({ title: s.title, reward_amount: s.proposed_amount });
  }
}
```

- [ ] **Step 7: Add Fast-Track toast after chore save**

After a successful chore creation (in the existing form submit handler), add:

```tsx
if (!fastTrackEnabled) {
  setToast({
    message: "That was easy! Want to skip this step next time?",
    action: { label: "Enable Fast-Track", onClick: enableFastTrack },
  });
}
```

Where `enableFastTrack` calls:
```tsx
async function enableFastTrack() {
  await updateFamily({ fast_track_enabled: 1 });
  setFastTrackEnabled(true);
}
```

And `updateFamily` is already available from `app/src/lib/api.ts`.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add app/src/components/dashboard/JobsTab.tsx
git commit -m "feat(ui): JobsTab — Rate Guide button, module-linked suggestion banner, Fast-Track flow"
```

---

## Task 13: Wire Chore Guide button into `EarnTab.tsx`

**Files:**
- Modify: `app/src/components/dashboard/EarnTab.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useState } from 'react'; // if not already present
import { ChoreGuideSheet } from './ChoreGuideSheet';
```

- [ ] **Step 2: Add state**

```tsx
const [choreGuideOpen, setChoreGuideOpen] = useState(false);
```

- [ ] **Step 3: Add "Chore Guide" button**

Find the top area of the EarnTab content (below the header, above the chore list). Add:

```tsx
<div className="flex justify-end mb-3">
  <button
    type="button"
    onClick={() => setChoreGuideOpen(true)}
    className="text-xs font-medium text-[--brand-primary] underline-offset-2 hover:underline"
  >
    Chore Guide
  </button>
</div>
```

- [ ] **Step 4: Mount `ChoreGuideSheet`**

At the end of the return, before the closing fragment:

```tsx
<ChoreGuideSheet
  open={choreGuideOpen}
  onClose={() => setChoreGuideOpen(false)}
  context={null}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Step 6: Start dev server and manually test child flow**

```bash
cd app && npm run dev
```

Log in as a child. Go to the Earn tab:
1. "Chore Guide" button appears at the top
2. Tapping opens `ChoreGuideSheet` with tiers: Great Oaks → Growing Saplings → Small Seeds
3. Each row shows canonical name + formatted rate + "Suggest" button
4. Tapping "Suggest" on any row sends it and shows the success state
5. Tapping "Done" closes the sheet

- [ ] **Step 7: Commit**

```bash
git add app/src/components/dashboard/EarnTab.tsx
git commit -m "feat(ui): EarnTab — add Chore Guide button wired to ChoreGuideSheet"
```

---

## Task 14: Apply production D1 migration

- [ ] **Step 1: Apply migration to production D1**

```bash
cd worker
npx wrangler d1 execute morechard --remote --file=migrations/0028_market_rates.sql
```

Expected: `✅ Successfully executed` with no errors.

- [ ] **Step 2: Verify production row count**

```bash
npx wrangler d1 execute morechard --remote \
  --command="SELECT COUNT(*) as total, SUM(is_orchard_8) as orchard_8 FROM market_rates;"
```

Expected: `total: 30, orchard_8: 8`

- [ ] **Step 3: Deploy worker**

```bash
npx wrangler deploy --env production
```

- [ ] **Step 4: Smoke test production API**

```bash
curl -s "https://morechard-api.darren-savery.workers.dev/api/market-rates" \
  -H "Authorization: Bearer <production_jwt>" | jq '.rates | length'
```

Expected: `30`

- [ ] **Step 5: Update CLAUDE.md roadmap**

In CLAUDE.md, under Phase 5, add the Rate Guide item and mark the implementation tasks done:

```markdown
- [x] Rate Guide — market rate benchmarking for chores
  - [x] Design spec (2026-04-19)
  - [x] D1 migration + 30-row seed
  - [x] GET /api/market-rates + suggest endpoint + CRON skeleton
  - [x] CreateChoreSheet tile grid + fuzzy search redesign
  - [x] RateGuideSheet (parent) + ChoreGuideSheet (child)
  - [x] Fast-Track suggestion flow
```

- [ ] **Step 6: Final commit**

```bash
git add CLAUDE.md
git commit -m "chore: mark Rate Guide complete in roadmap"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ D1 migration + seed (Task 1)
- ✅ `families.fast_track_enabled` (Task 1)
- ✅ CRON skeleton + wrangler trigger (Task 2)
- ✅ GET `/api/market-rates` with locale, tiers, proxy multipliers (Task 3)
- ✅ POST `/api/market-rates/suggest` using `reason` for context (Task 4)
- ✅ GET `/api/market-rates/cron` health endpoint (Task 4)
- ✅ `fast_track_enabled` in `handleFamilyUpdate` (Task 5)
- ✅ `getMarketRates()` + `suggestChore()` client functions (Task 6)
- ✅ `useMarketRates` hook with sessionStorage cache + `fuzzyMatch` helper (Task 7)
- ✅ Spark animation CSS (Task 8)
- ✅ `RateGuideSheet` — search, category filter, Pioneer badge (Task 9)
- ✅ `ChoreGuideSheet` — tier grouping, Suggest flow, success state, Pioneer Mentor note (Task 10)
- ✅ `CreateChoreSheet` tile grid + search + suggestion list + Spark (Task 11)
- ✅ `JobsTab` — Rate Guide button, module-linked suggestion banner, Fast-Track (Task 12)
- ✅ `EarnTab` — Chore Guide button (Task 13)
- ✅ Production deploy (Task 14)

**`tile_source` prop:** Used in `CreateChoreSheet` tile grid filter — only Orchard 8 tiles shown in Phase 1 via `r.is_orchard_8`. The prop itself is exposed on the `useMarketRates` return value for future phases.
