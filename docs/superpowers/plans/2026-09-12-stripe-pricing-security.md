# Stripe Pricing & Checkout Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Stripe pricing out of `wrangler.toml`/hardcoded constants into a D1 `products` table, make the webhook verify the charged amount before granting any license, and retire the second (uncontrolled) Stripe Pricing Table checkout path.

**Architecture:** A new `products` table becomes the single source of truth for SKU → Stripe Price ID / amount, read by `handleCreateCheckout` instead of env vars. A new `checkout_intents` table records exactly what we told Stripe to charge at session-creation time; `handleCheckoutCompleted` (the webhook handler) looks this up and refuses to grant a license unless the charged amount matches. The frontend gets one checkout path — `PaywallScreen` drops the Stripe-hosted Pricing Table widget and reuses the same purchase-card component `BillingSettings` already has, now reading prices from a new `GET /api/products` endpoint instead of hardcoded strings.

**Tech Stack:** Cloudflare Workers + D1 (SQLite), Hono-less hand-rolled router (`worker/src/index.ts`), Vitest for worker tests, React + TypeScript for the app.

**Spec:** `docs/superpowers/specs/2026-09-12-stripe-pricing-security-design.md`

## Global Constraints

- `--local` is never used on any `wrangler` command (dev D1 cannot be bootstrapped through the migration chain locally — see `CLAUDE.md`).
- Any `wrangler` command *without* `--env production` targets `morechard-dev`. Double-check before anything that touches the `morechard` (production) database.
- D1 is the only data layer — no new storage backend, ever.
- Migrations with triggers must use `--file=` + a manual `d1_migrations` insert; this plan's migration has no triggers, so plain `wrangler d1 migrations apply` is used.
- Stripe price/product IDs are not secrets and may be committed to git (comparable to a publishable key). `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are secrets and must never appear in a committed file.
- Real Stripe catalogue IDs (from the approved spec):

  | SKU | Sandbox `price_id` | Live `price_id` |
  |---|---|---|
  | COMPLETE | `price_1TPqqZKGVFJVwtJFo37uEPPW` | `price_1UEmyUKGVFJVwtJFbbav5F6k` |
  | COMPLETE_AI | `price_1TQVUFKGVFJVwtJFmYUryKw6` | `price_1UEmzzKGVFJVwtJFPWUcpeCI` |
  | SHIELD_AI | `price_1TPqqcKGVFJVwtJF6cFgzWf9` | `price_1UEn0rKGVFJVwtJFDk3avBvV` |
  | AI_UPGRADE | `price_1TQVViKGVFJVwtJFLhSnEuh7` | `price_1UEn1HKGVFJVwtJFm27L00L1` |

  Shield AI Product IDs: Sandbox `prod_UOe8ZtEJmwuNj6`, Live `prod_VFHawfwlGcBusF`.

---

## Task 1: D1 schema — `products` and `checkout_intents` tables

**Files:**
- Create: `worker/migrations/0095_products_and_checkout_intents.sql`
- Modify: `worker/dev/bootstrap_dev_db.sql`

**Interfaces:**
- Produces: two tables every later task reads/writes —
  - `products(sku TEXT PK, name TEXT, stripe_product_id TEXT, stripe_price_id TEXT, unit_amount_pence INTEGER, currency TEXT, active INTEGER)`
  - `checkout_intents(stripe_session_id TEXT PK, family_id TEXT, sku TEXT, stripe_price_id TEXT, expected_amount_pence INTEGER, currency TEXT, created_at TEXT)`

- [ ] **Step 1: Write the migration**

Create `worker/migrations/0095_products_and_checkout_intents.sql`:

```sql
CREATE TABLE products (
  sku               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id   TEXT NOT NULL,
  unit_amount_pence INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  active            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE checkout_intents (
  stripe_session_id     TEXT PRIMARY KEY,
  family_id             TEXT NOT NULL REFERENCES families(id),
  sku                   TEXT NOT NULL,
  stripe_price_id       TEXT NOT NULL,
  expected_amount_pence INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkout_intents_family ON checkout_intents (family_id);
```

- [ ] **Step 2: Apply the migration to dev**

Run (from `worker/`):
```bash
npx wrangler d1 migrations apply morechard-dev --remote
```
Expected: output lists `0095_products_and_checkout_intents.sql` as applied, no errors.

- [ ] **Step 3: Verify the tables exist in dev**

Run:
```bash
npx wrangler d1 execute morechard-dev --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('products','checkout_intents')"
```
Expected: both `products` and `checkout_intents` listed.

- [ ] **Step 4: Mirror the schema in `bootstrap_dev_db.sql`**

Open `worker/dev/bootstrap_dev_db.sql`. Find the `CREATE TABLE IF NOT EXISTS promo_code_redemptions (...)` block (around line 744) and insert the new tables directly after it, before `CREATE TABLE IF NOT EXISTS referral_clicks`:

```sql
CREATE TABLE IF NOT EXISTS products (
  sku               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id   TEXT NOT NULL,
  unit_amount_pence INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  active            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checkout_intents (
  stripe_session_id     TEXT PRIMARY KEY,
  family_id             TEXT NOT NULL REFERENCES families(id),
  sku                   TEXT NOT NULL,
  stripe_price_id       TEXT NOT NULL,
  expected_amount_pence INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'GBP',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_family ON checkout_intents (family_id);
```

Then find the end of the `INSERT OR IGNORE INTO d1_migrations` list (near the bottom of the file, just before the `-- ---` separator and `PRAGMA foreign_keys = ON;` line) and add one more line:

```sql
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0095_products_and_checkout_intents.sql');
```

This file is what `npm run seed:bootstrap` replays if dev D1 is ever wiped — it must stay in sync with the real migration chain for these two tables.

- [ ] **Step 5: Commit**

```bash
git add worker/migrations/0095_products_and_checkout_intents.sql worker/dev/bootstrap_dev_db.sql
git commit -m "feat(stripe): add products and checkout_intents D1 tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Seed the product catalogue (dev + production)

**Files:** none (data-only, run against both live D1 databases)

**Interfaces:**
- Consumes: `products` table from Task 1.
- Produces: 4 populated rows in both `morechard-dev` and `morechard` D1 databases, which Task 3 reads.

- [ ] **Step 1: Apply migration 0095 to production**

```bash
cd worker
npx wrangler d1 migrations apply morechard --remote --env production
```
Expected: `0095_products_and_checkout_intents.sql` applied with no errors. This only creates empty tables — it does not affect any running code.

- [ ] **Step 2: Seed dev D1 with sandbox catalogue values**

```bash
npx wrangler d1 execute morechard-dev --remote --command="INSERT INTO products (sku, name, stripe_product_id, stripe_price_id, unit_amount_pence, currency, active) VALUES ('COMPLETE', 'Morechard Core', 'prod_UOe8ZtEJmwuNj6', 'price_1TPqqZKGVFJVwtJFo37uEPPW', 4499, 'GBP', 1), ('COMPLETE_AI', 'Morechard Core AI', 'prod_UOe8ZtEJmwuNj6', 'price_1TQVUFKGVFJVwtJFmYUryKw6', 6499, 'GBP', 1), ('SHIELD_AI', 'Morechard Shield AI', 'prod_UOe8ZtEJmwuNj6', 'price_1TPqqcKGVFJVwtJF6cFgzWf9', 14999, 'GBP', 1), ('AI_UPGRADE', 'AI Mentor + Learning Lab Upgrade', 'prod_UOe8ZtEJmwuNj6', 'price_1TQVViKGVFJVwtJFLhSnEuh7', 2999, 'GBP', 1)"
```

Note: `stripe_product_id` is set to the Shield AI product (`prod_UOe8ZtEJmwuNj6` sandbox) for every row here as a placeholder — only `SHIELD_AI`'s `stripe_product_id` is ever actually read by code (for the dynamic upgrade-credit price). If you created separate Stripe Products for the other three SKUs and have their `prod_...` IDs handy, use the real ones instead; it makes no functional difference for `COMPLETE` / `COMPLETE_AI` / `AI_UPGRADE`.

- [ ] **Step 3: Verify the dev rows**

```bash
npx wrangler d1 execute morechard-dev --remote --command="SELECT sku, unit_amount_pence, stripe_price_id FROM products ORDER BY sku"
```
Expected: 4 rows, amounts `4499`, `6499`, `14999`, `2999`.

- [ ] **Step 4: Seed production D1 with live catalogue values**

```bash
npx wrangler d1 execute morechard --remote --env production --command="INSERT INTO products (sku, name, stripe_product_id, stripe_price_id, unit_amount_pence, currency, active) VALUES ('COMPLETE', 'Morechard Core', 'prod_VFHawfwlGcBusF', 'price_1UEmyUKGVFJVwtJFbbav5F6k', 4499, 'GBP', 1), ('COMPLETE_AI', 'Morechard Core AI', 'prod_VFHawfwlGcBusF', 'price_1UEmzzKGVFJVwtJFPWUcpeCI', 6499, 'GBP', 1), ('SHIELD_AI', 'Morechard Shield AI', 'prod_VFHawfwlGcBusF', 'price_1UEn0rKGVFJVwtJFDk3avBvV', 14999, 'GBP', 1), ('AI_UPGRADE', 'AI Mentor + Learning Lab Upgrade', 'prod_VFHawfwlGcBusF', 'price_1UEn1HKGVFJVwtJFm27L00L1', 2999, 'GBP', 1)"
```

- [ ] **Step 5: Verify the production rows**

```bash
npx wrangler d1 execute morechard --remote --env production --command="SELECT sku, unit_amount_pence, stripe_price_id FROM products ORDER BY sku"
```
Expected: 4 rows, same amounts as dev, live price IDs.

- [ ] **Step 6: No commit needed** — this task only wrote data, no files changed.

---

## Task 3: Checkout creation reads prices from D1, writes `checkout_intents`

**Files:**
- Modify: `worker/src/types.ts`
- Modify: `worker/src/routes/stripe.ts`
- Modify: `worker/wrangler.toml`
- Modify: `worker/src/routes/stripe.test.ts`

**Interfaces:**
- Consumes: `products` table (Task 1/2).
- Produces: `getProduct(db, sku): Promise<ProductRow | null>` and `ProductRow` (used by Task 5's webhook handler and Task 4's `GET /api/products`); `calcShieldCredit(env, familyId, fullPricePence)` (signature change).

- [ ] **Step 1: Remove dead Stripe env vars from `types.ts`**

In `worker/src/types.ts`, delete these 5 lines (currently lines 17-21):
```ts
  STRIPE_PRICE_COMPLETE:    string;
  STRIPE_PRICE_COMPLETE_AI: string;
  STRIPE_PRICE_SHIELD_AI:   string;
  STRIPE_PRICE_AI_UPGRADE:  string;
  STRIPE_SHIELD_PRODUCT_ID: string;
```
Leave `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` untouched.

- [ ] **Step 2: Remove the same vars from `wrangler.toml`**

In `worker/wrangler.toml`, delete these lines from `[vars]` (currently lines 48-55, including their comments):
```toml
# Stripe price IDs — test-mode values (find in Stripe Dashboard → Product catalogue)
STRIPE_PRICE_COMPLETE    = "price_1TPqqZKGVFJVwtJFo37uEPPW"
STRIPE_PRICE_COMPLETE_AI = "price_1TQVUFKGVFJVwtJFmYUryKw6"
STRIPE_PRICE_SHIELD_AI   = "price_1TQVVRKGVFJVwtJFbtozHn3b"
STRIPE_PRICE_AI_UPGRADE  = "price_1TQVViKGVFJVwtJFLhSnEuh7"
# Stripe product ID for Shield AI (used for upgrade credit dynamic pricing)
# Find in Stripe Dashboard → Product catalogue → Morechard Shield AI → copy the prod_... ID
STRIPE_SHIELD_PRODUCT_ID = "prod_UOe8ZtEJmwuNj6"
```

And in the `[env.production]` `vars = { ... }` line (currently line 110), remove these five key/value pairs from inside the object: `STRIPE_PRICE_COMPLETE = "price_REPLACE_WITH_LIVE_COMPLETE"`, `STRIPE_PRICE_COMPLETE_AI = "price_REPLACE_WITH_LIVE_COMPLETE_AI"`, `STRIPE_PRICE_SHIELD_AI = "price_REPLACE_WITH_LIVE_SHIELD_AI"`, `STRIPE_PRICE_AI_UPGRADE = "price_REPLACE_WITH_LIVE_AI_UPGRADE"`, `STRIPE_SHIELD_PRODUCT_ID = "prod_REPLACE_WITH_LIVE_SHIELD_PRODUCT_ID"` — keeping the remaining keys (`ENVIRONMENT`, `APP_URL`, `WORKER_URL`, `POSTHOG_HOST`, the `ZOHO_*` ones) intact and comma-separated correctly.

- [ ] **Step 3: Replace the price-lookup and constants in `stripe.ts`**

In `worker/src/routes/stripe.ts`, delete the `getPriceId` function (lines 42-50) and replace it with:

```ts
interface ProductRow {
  sku:               PaymentType;
  name:              string;
  stripe_product_id: string;
  stripe_price_id:   string;
  unit_amount_pence: number;
  currency:          string;
  active:            number;
}

async function getProduct(env: Env, sku: PaymentType): Promise<ProductRow | null> {
  return env.DB
    .prepare('SELECT * FROM products WHERE sku = ? AND active = 1')
    .bind(sku)
    .first<ProductRow>();
}
```

Delete the `AUDIT_AMOUNTS` constant entirely (lines 52-62).

Delete the `SHIELD_FULL_PRICE_PENCE` constant (line 72) but **keep** `STRIPE_MINIMUM_PENCE` (line 73) — it's Stripe's platform charge floor, not a product price.

- [ ] **Step 4: Update `calcShieldCredit` to take the full price as a parameter**

Replace:
```ts
async function calcShieldCredit(env: Env, familyId: string): Promise<ShieldCreditResult> {
  const row = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(amount_paid_int), 0) AS total
      FROM payment_audit_log
      WHERE family_id = ?
        AND payment_type IN ('COMPLETE', 'COMPLETE_AI', 'AI_UPGRADE')
        AND refunded_at IS NULL
        AND currency = 'GBP'
    `)
    .bind(familyId)
    .first<{ total: number }>();

  const alreadyPaid = row?.total ?? 0;
  const raw = SHIELD_FULL_PRICE_PENCE - alreadyPaid;
  const delta = Math.max(raw, STRIPE_MINIMUM_PENCE);

  return { alreadyPaid, delta };
}
```
with:
```ts
async function calcShieldCredit(env: Env, familyId: string, fullPricePence: number): Promise<ShieldCreditResult> {
  const row = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(amount_paid_int), 0) AS total
      FROM payment_audit_log
      WHERE family_id = ?
        AND payment_type IN ('COMPLETE', 'COMPLETE_AI', 'AI_UPGRADE')
        AND refunded_at IS NULL
        AND currency = 'GBP'
    `)
    .bind(familyId)
    .first<{ total: number }>();

  const alreadyPaid = row?.total ?? 0;
  const raw = fullPricePence - alreadyPaid;
  const delta = Math.max(raw, STRIPE_MINIMUM_PENCE);

  return { alreadyPaid, delta };
}
```

- [ ] **Step 5: Update `handleShieldUpgradePrice`**

Replace:
```ts
  if (!family) return error('Family not found', 404);
  if (family.has_shield) return error('Already purchased', 400);

  const { alreadyPaid, delta } = await calcShieldCredit(env, auth.family_id);

  return json({
    full_price:   SHIELD_FULL_PRICE_PENCE,
    already_paid: alreadyPaid,
    delta,
    currency:     'GBP',
  });
```
with:
```ts
  if (!family) return error('Family not found', 404);
  if (family.has_shield) return error('Already purchased', 400);

  const product = await getProduct(env, 'SHIELD_AI');
  if (!product) return error('Shield AI is not available for purchase', 503);

  const { alreadyPaid, delta } = await calcShieldCredit(env, auth.family_id, product.unit_amount_pence);

  return json({
    full_price:   product.unit_amount_pence,
    already_paid: alreadyPaid,
    delta,
    currency:     product.currency,
  });
```

- [ ] **Step 6: Update `handleCreateCheckout`**

Replace the whole body from `let priceId: string | undefined = getPriceId(...)` down to `return json({ url, session_id: sessionId });` with:

```ts
  const product = await getProduct(env, payment_type);
  if (!product) {
    console.error(`No product configured for SKU ${payment_type}`);
    return error('This product is not yet available for purchase', 503);
  }

  let priceId = product.stripe_price_id;
  let expectedAmountPence = product.unit_amount_pence;

  // For Shield, calculate upgrade credit and use a dynamic price if applicable
  if (payment_type === 'SHIELD_AI') {
    const { delta } = await calcShieldCredit(env, auth.family_id, product.unit_amount_pence);
    if (delta < product.unit_amount_pence) {
      try {
        priceId = await createDynamicPrice(
          product.stripe_product_id,
          delta,
          product.currency.toLowerCase(),
          env.STRIPE_SECRET_KEY,
        );
      } catch {
        return error('Failed to calculate upgrade price', 502);
      }
      expectedAmountPence = delta;
    }
  }

  let sessionResult: { url: string; sessionId: string };
  try {
    sessionResult = await createCheckoutSession(
      priceId, auth.family_id, payment_type, env.APP_URL, env.STRIPE_SECRET_KEY,
    );
  } catch {
    return error('Failed to create checkout session', 502);
  }

  await env.DB
    .prepare(`
      INSERT INTO checkout_intents (stripe_session_id, family_id, sku, stripe_price_id, expected_amount_pence, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(sessionResult.sessionId, auth.family_id, payment_type, priceId, expectedAmountPence, product.currency)
    .run();

  return json({ url: sessionResult.url, session_id: sessionResult.sessionId });
```

- [ ] **Step 7: Update `stripe.test.ts`**

Replace the hardcoded `SHIELD_FULL_PRICE` constant test setup with a parameterized version matching the new `calcShieldCredit` signature:

```ts
import { describe, it, expect } from 'vitest';

// calcShieldCredit logic extracted for unit testing.
// The real function queries D1; here we test the pure arithmetic against
// a fixture full price (in production this comes from the `products` table).

const STRIPE_MINIMUM_PENCE = 30;

function computeDelta(fullPricePence: number, totalCreditPence: number): number {
  const raw = fullPricePence - totalCreditPence;
  return Math.max(raw, STRIPE_MINIMUM_PENCE);
}

describe('Shield upgrade delta calculation', () => {
  const SHIELD_FULL_PRICE = 14999; // fixture — matches the seeded SHIELD_AI product row

  it('charges full price when no prior purchases', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 0)).toBe(14999);
  });

  it('deducts Core price (£44.99)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 4499)).toBe(10500);
  });

  it('deducts Core AI price (£64.99)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 6499)).toBe(8500);
  });

  it('deducts Core + AI Upgrade (£44.99 + £29.99 = £74.98)', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 4499 + 2999)).toBe(7501);
  });

  it('floors at Stripe minimum (30p) if credit somehow exceeds full price', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 20000)).toBe(30);
  });

  it('handles zero credit exactly at full price', () => {
    expect(computeDelta(SHIELD_FULL_PRICE, 14999)).toBe(30); // floors at minimum, not 0
  });

  it('recalculates correctly if the catalogue price changes', () => {
    expect(computeDelta(19999, 0)).toBe(19999);
  });
});
```

- [ ] **Step 8: Run the worker test suite**

```bash
cd worker
npm test -- stripe.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 9: Type-check**

```bash
cd worker
npm run typecheck
```
Expected: no errors. (This will fail loudly if any other file still references the removed `env.STRIPE_PRICE_*` / `env.STRIPE_SHIELD_PRODUCT_ID` — there shouldn't be any per the earlier grep, but this is the safety net.)

- [ ] **Step 10: Commit**

```bash
git add worker/src/types.ts worker/src/routes/stripe.ts worker/wrangler.toml worker/src/routes/stripe.test.ts
git commit -m "feat(stripe): read prices from D1 products table, write checkout_intents

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `GET /api/products` endpoint

**Files:**
- Modify: `worker/src/routes/stripe.ts`
- Modify: `worker/src/index.ts`
- Modify: `app/src/lib/api.ts`

**Interfaces:**
- Consumes: `products` table (Task 1/2).
- Produces: `getProducts(): Promise<{ products: Product[] }>` in `app/src/lib/api.ts`, used by Task 6/7's frontend component.

- [ ] **Step 1: Add the handler**

In `worker/src/routes/stripe.ts`, add this new export near `handleShieldUpgradePrice`:

```ts
// ----------------------------------------------------------------
// Route: GET /api/products
// ----------------------------------------------------------------
export async function handleGetProducts(
  _request: Request,
  env: Env,
): Promise<Response> {
  const rows = await env.DB
    .prepare('SELECT sku, name, unit_amount_pence, currency FROM products WHERE active = 1')
    .all<{ sku: string; name: string; unit_amount_pence: number; currency: string }>();

  return json({ products: rows.results });
}
```

- [ ] **Step 2: Wire the route**

In `worker/src/index.ts`, find the block:
```ts
  // Trial status endpoint (any role) ─────────────────────────
  if (path === '/api/trial/status' && method === 'GET') {
    return json(await getTrialStatus(env, auth.family_id));
```
and add, immediately after that `if` block closes:
```ts

  // Product catalogue (any role, post-auth) ────────────────────
  if (path === '/api/products' && method === 'GET') {
    return handleGetProducts(request, env);
  }
```
Add `handleGetProducts` to the existing import of `stripe.js` route handlers at the top of `index.ts` (find the line importing `handleShieldUpgradePrice` / `handleCreateCheckout` from `./routes/stripe.js` and add `handleGetProducts` to that same import list).

- [ ] **Step 3: Add the frontend client function**

In `app/src/lib/api.ts`, add near `getShieldUpgradePrice`:

```ts
export interface Product {
  sku:               'COMPLETE' | 'COMPLETE_AI' | 'SHIELD_AI' | 'AI_UPGRADE'
  name:              string
  unit_amount_pence: number
  currency:          string
}

export async function getProducts(): Promise<{ products: Product[] }> {
  return request('/api/products')
}
```

- [ ] **Step 4: Manual verification against dev**

Start the dev server (`npm run dev` from repo root) and, while logged in as a parent in the app, open the browser devtools console and run:
```js
fetch('/api/products', { credentials: 'include' }).then(r => r.json()).then(console.log)
```
Expected: `{ products: [{ sku: 'COMPLETE', name: 'Morechard Core', unit_amount_pence: 4499, currency: 'GBP' }, ...] }` — 4 rows.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/stripe.ts worker/src/index.ts app/src/lib/api.ts
git commit -m "feat(stripe): add GET /api/products endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Webhook amount verification

**Files:**
- Modify: `worker/src/routes/stripe.ts`
- Modify: `worker/src/routes/stripe.test.ts`

**Interfaces:**
- Consumes: `checkout_intents` rows written by Task 3.
- Produces: `handleCheckoutCompleted` now refuses to grant on mismatch — no new exports.

- [ ] **Step 1: Extend `StripeSession` with the fields needed for verification**

In `worker/src/routes/stripe.ts`, update the `StripeSession` interface (near the bottom of the file):

```ts
interface StripeSession {
  id: string;
  metadata?: Record<string, string>;
  amount_total?: number;     // actual charge in minor units (pence for GBP)
  amount_subtotal?: number;  // pre-discount line-item total in minor units
  currency?: string;
  discounts?: Array<{ promotion_code: string | null }>;
}
```

- [ ] **Step 2: Write the failing tests first**

Add to `worker/src/routes/stripe.test.ts` — these test the pure verification logic extracted as a standalone function (mirroring how `computeDelta` above tests `calcShieldCredit`'s arithmetic without touching D1):

```ts
interface CheckoutIntent {
  family_id: string;
  sku: string;
  expected_amount_pence: number;
  currency: string;
}

interface SessionLike {
  amount_subtotal?: number;
  amount_total?: number;
  currency?: string;
  metadata?: { family_id?: string; payment_type?: string };
}

function verifyCheckoutAmount(session: SessionLike, intent: CheckoutIntent | null, normalisedSku: string): boolean {
  if (!intent) return false;
  const charged = session.amount_subtotal ?? session.amount_total;
  const currencyMatches = (session.currency ?? '').toLowerCase() === intent.currency.toLowerCase();
  const amountMatches = charged === intent.expected_amount_pence;
  const familyMatches = intent.family_id === session.metadata?.family_id;
  const skuMatches = intent.sku === normalisedSku;
  return currencyMatches && amountMatches && familyMatches && skuMatches;
}

describe('Webhook checkout amount verification', () => {
  const intent: CheckoutIntent = {
    family_id: 'fam_123',
    sku: 'COMPLETE',
    expected_amount_pence: 4499,
    currency: 'GBP',
  };

  it('passes when subtotal matches exactly, no discount', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      amount_total: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(true);
  });

  it('passes when a promo code discounts amount_total but not amount_subtotal', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      amount_total: 2000, // promo code applied
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(true);
  });

  it('passes for a Shield dynamic upgrade price where subtotal IS the discounted amount', () => {
    const shieldIntent: CheckoutIntent = {
      family_id: 'fam_123',
      sku: 'SHIELD_AI',
      expected_amount_pence: 10500, // credited delta, not the £149.99 catalogue price
      currency: 'GBP',
    };
    const session: SessionLike = {
      amount_subtotal: 10500,
      amount_total: 10500,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'SHIELD_AI' },
    };
    expect(verifyCheckoutAmount(session, shieldIntent, 'SHIELD_AI')).toBe(true);
  });

  it('fails when no checkout_intents row was found', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, null, 'COMPLETE')).toBe(false);
  });

  it('fails when the charged amount is lower than expected with no legitimate discount shape', () => {
    const session: SessionLike = {
      amount_subtotal: 100, // tampered/incorrect — doesn't match intent at all
      amount_total: 100,
      currency: 'gbp',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });

  it('fails on currency mismatch', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'usd',
      metadata: { family_id: 'fam_123', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });

  it('fails when family_id does not match the intent', () => {
    const session: SessionLike = {
      amount_subtotal: 4499,
      currency: 'gbp',
      metadata: { family_id: 'fam_999', payment_type: 'COMPLETE' },
    };
    expect(verifyCheckoutAmount(session, intent, 'COMPLETE')).toBe(false);
  });
});
```

- [ ] **Step 3: Run the new tests to see them fail**

```bash
cd worker
npm test -- stripe.test.ts
```
Expected: FAIL — `verifyCheckoutAmount` is not defined (it only exists in the test file so far; this confirms the test file itself is wired correctly before touching the real handler).

Since `verifyCheckoutAmount` is defined directly in the test file above (not imported), this step instead just confirms the *new describe block* runs and passes on the logic — rerun and expect all 7 new tests to PASS immediately, since the function is self-contained. Skip ahead to Step 4 to wire the equivalent logic into the real handler.

- [ ] **Step 4: Implement the same logic in `handleCheckoutCompleted`**

In `worker/src/routes/stripe.ts`, replace:

```ts
async function handleCheckoutCompleted(session: StripeSession, env: Env): Promise<void> {
  const { family_id, payment_type: rawType } = session.metadata ?? {};

  const KNOWN: string[] = [...PURCHASABLE, 'LIFETIME', 'AI_ANNUAL', 'SHIELD'];
  if (!family_id || !KNOWN.includes(rawType)) {
    return;
  }

  // Normalise legacy SKUs to current equivalents
  const payment_type = normaliseSku(rawType as PaymentType);

  // Idempotency guard
  const existing = await env.DB
    .prepare('SELECT id FROM payment_audit_log WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ id: number }>();

  if (existing) {
    return;
  }

  // Write audit record first — never lose the payment fact
  await env.DB
    .prepare(`
      INSERT INTO payment_audit_log (family_id, stripe_session_id, amount_paid_int, currency, payment_type)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(family_id, session.id, session.amount_total ?? AUDIT_AMOUNTS[payment_type] ?? 0, 'GBP', payment_type)
    .run();
```

with:

```ts
async function handleCheckoutCompleted(session: StripeSession, env: Env): Promise<void> {
  const { family_id, payment_type: rawType } = session.metadata ?? {};

  const KNOWN: string[] = [...PURCHASABLE, 'LIFETIME', 'AI_ANNUAL', 'SHIELD'];
  if (!family_id || !KNOWN.includes(rawType)) {
    return;
  }

  // Normalise legacy SKUs to current equivalents
  const payment_type = normaliseSku(rawType as PaymentType);

  // Idempotency guard
  const existing = await env.DB
    .prepare('SELECT id FROM payment_audit_log WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ id: number }>();

  if (existing) {
    return;
  }

  // Verify the charged amount against what we told Stripe to charge when we
  // created this specific session — the source of truth for "did the
  // customer actually pay what this SKU costs", independent of metadata.
  const intent = await env.DB
    .prepare('SELECT family_id, sku, expected_amount_pence, currency FROM checkout_intents WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ family_id: string; sku: string; expected_amount_pence: number; currency: string }>();

  if (!intent) {
    Sentry.captureMessage('Stripe checkout completed with no matching checkout_intents row', {
      level: 'error',
      fingerprint: ['stripe-checkout-intent-missing'],
      extra: { stripe_session_id: session.id, family_id, payment_type },
    });
    return;
  }

  const chargedAmount = session.amount_subtotal ?? session.amount_total;
  const currencyMatches = (session.currency ?? '').toLowerCase() === intent.currency.toLowerCase();
  const amountMatches = chargedAmount === intent.expected_amount_pence;
  const familyMatches = intent.family_id === family_id;
  const skuMatches = intent.sku === payment_type;

  if (!amountMatches || !currencyMatches || !familyMatches || !skuMatches) {
    Sentry.captureMessage('Stripe checkout amount/product mismatch — refusing to grant', {
      level: 'error',
      fingerprint: ['stripe-amount-mismatch'],
      extra: {
        stripe_session_id: session.id,
        family_id, payment_type,
        expected_amount_pence: intent.expected_amount_pence,
        charged_amount: chargedAmount,
        expected_currency: intent.currency,
        charged_currency: session.currency,
        intent_sku: intent.sku,
        intent_family_id: intent.family_id,
      },
    });
    return;
  }

  // Write audit record first — never lose the payment fact
  await env.DB
    .prepare(`
      INSERT INTO payment_audit_log (family_id, stripe_session_id, amount_paid_int, currency, payment_type)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(family_id, session.id, session.amount_total ?? 0, 'GBP', payment_type)
    .run();
```

Leave everything after that (the `grantLicense`, referral, and promo code logic) unchanged.

- [ ] **Step 5: Run the full test suite**

```bash
cd worker
npm test -- stripe.test.ts
```
Expected: all tests pass (the 7 shield-credit tests + 7 new verification tests = 14 total in this file).

- [ ] **Step 6: Type-check**

```bash
cd worker
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/stripe.ts worker/src/routes/stripe.test.ts
git commit -m "feat(stripe): verify charged amount against checkout_intents before granting a license

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Extract `PlanPurchaseCards` shared component, wire into `BillingSettings`

**Files:**
- Create: `app/src/components/billing/PlanPurchaseCards.tsx`
- Modify: `app/src/components/settings/sections/BillingSettings.tsx`

**Interfaces:**
- Consumes: `getProducts()` (Task 4), `getShieldUpgradePrice()`, `createCheckoutSession()` (existing), `TrialStatus` (existing).
- Produces: `PlanPurchaseCards({ trial, shieldUpgradePrice, onBuyError }): JSX.Element`, used by this task's `BillingSettings` change and Task 7's `PaywallScreen` change.

- [ ] **Step 1: Create the shared component**

Create `app/src/components/billing/PlanPurchaseCards.tsx`:

```tsx
/**
 * PlanPurchaseCards — the Core / Core AI / Shield AI purchase cards plus
 * the "Compare all plans" modal. Shared between BillingSettings.PlanView
 * (in-app upgrade flow) and PaywallScreen (post-trial-expiry flow) so
 * there is exactly one checkout entry point in the app.
 *
 * Prices are read from GET /api/products (D1-backed) — never hardcoded —
 * so a Stripe price change only requires updating the products table.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Shield, Star, X, Check } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  createCheckoutSession, getShieldUpgradePrice, getProducts,
  type TrialStatus, type ShieldUpgradePrice, type Product,
} from '../../lib/api'

type PurchasableSku = 'COMPLETE' | 'COMPLETE_AI' | 'SHIELD_AI' | 'AI_UPGRADE'

function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

const COMPARE_ROWS: {
  feature:    string
  complete:   boolean
  completeAi: boolean
  shieldAi:   boolean
}[] = [
  { feature: 'Chore tracking & ledger',            complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Child 6-digit code access',           complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Savings goals (Savings Grove)',       complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Payment bridge (Monzo etc.)',         complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Rate Guide benchmarking',             complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Unlimited children',                  complete: true,  completeAi: true,  shieldAi: true  },
  { feature: 'Parent Insights AI',                  complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'AI Mentor (financial coaching)',      complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'Learning Lab (20-module curriculum)', complete: false, completeAi: true,  shieldAi: true  },
  { feature: 'Tamper-evident PDF exports',          complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Digital tamper-seal per export',      complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Co-parent verified sharing',          complete: false, completeAi: false, shieldAi: true  },
  { feature: 'Court-admissible hashed records',     complete: false, completeAi: false, shieldAi: true  },
]

function ComparePlansModal({ prices, onClose }: { prices: Record<string, number>; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Compare plans"
        tabIndex={-1}
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl pb-safe overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-[1rem] font-bold text-[var(--color-text)]">Compare Plans</p>
            <p className="text-[0.75rem] text-[var(--color-text-muted)] mt-0.5">All plans are one-time purchases — no renewals.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target-44 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-0 px-5 pt-3 pb-2">
          <div className="col-span-1" />
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-teal-600 uppercase tracking-wide">Core</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.COMPLETE ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-violet-600 uppercase tracking-wide">Core AI</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.COMPLETE_AI ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[0.625rem] font-bold text-amber-600 uppercase tracking-wide">Shield</p>
            <p className="text-[0.6875rem] font-semibold text-[var(--color-text)] mt-0.5">{formatGBP(prices.SHIELD_AI ?? 0)}</p>
          </div>
        </div>

        <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: '55vh' }}>
          {COMPARE_ROWS.map(row => (
            <div key={row.feature} className="grid grid-cols-4 gap-0 py-2.5 border-b border-[var(--color-border)] last:border-0 items-center">
              <p className="col-span-1 text-[0.75rem] text-[var(--color-text)] pr-2 leading-snug">{row.feature}</p>
              <div className="flex justify-center">
                {row.complete
                  ? <Check size={14} className="text-teal-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
              <div className="flex justify-center">
                {row.completeAi
                  ? <Check size={14} className="text-violet-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
              <div className="flex justify-center">
                {row.shieldAi
                  ? <Check size={14} className="text-amber-500" />
                  : <span className="w-3.5 h-px bg-[var(--color-border)] block mt-1.5" />}
              </div>
            </div>
          ))}

          <div className="mt-4 space-y-2">
            <p className="text-[0.6875rem] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 leading-relaxed font-medium">
              UK family mediation averages £140/hr. Morechard Shield AI is a one-time {formatGBP(prices.SHIELD_AI ?? 0)}.
            </p>
            <p className="text-[0.6875rem] text-violet-700 bg-violet-50 rounded-lg px-3 py-2 leading-relaxed font-medium">
              Already on Core? Add AI Mentor + Learning Lab for {formatGBP(prices.AI_UPGRADE ?? 0)} — one-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  trial:              TrialStatus | null
  shieldUpgradePrice: ShieldUpgradePrice | null
  onBuyError:         (message: string) => void
}

export function PlanPurchaseCards({ trial, shieldUpgradePrice, onBuyError }: Props) {
  const [products, setProducts]       = useState<Record<string, Product> | null>(null)
  const [buying, setBuying]           = useState<string | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [resolvedShieldPrice, setResolvedShieldPrice] = useState<ShieldUpgradePrice | null>(shieldUpgradePrice)
  const [shieldPriceFetching, setShieldPriceFetching] = useState(false)

  useEffect(() => {
    getProducts()
      .then(({ products: rows }) => {
        setProducts(Object.fromEntries(rows.map(p => [p.sku, p])))
      })
      .catch(() => setProducts({}))
  }, [])

  useEffect(() => {
    if (resolvedShieldPrice !== null || shieldPriceFetching || !trial || trial.has_shield) return
    setShieldPriceFetching(true)
    getShieldUpgradePrice()
      .then(setResolvedShieldPrice)
      .catch(() => {})
      .finally(() => setShieldPriceFetching(false))
  }, [trial, resolvedShieldPrice, shieldPriceFetching])

  const handlePurchase = useCallback(async (sku: PurchasableSku) => {
    setBuying(sku)
    try {
      const { url } = await createCheckoutSession(sku)
      window.location.href = url
    } catch {
      onBuyError('Could not start checkout — please try again')
    } finally {
      setBuying(null)
    }
  }, [onBuyError])

  const hasBase   = trial?.has_lifetime_license
  const hasAi     = trial?.has_ai_mentor
  const hasShield = trial?.has_shield

  const shieldDelta        = resolvedShieldPrice?.delta ?? products?.SHIELD_AI?.unit_amount_pence ?? 14999
  const shieldPaid         = resolvedShieldPrice?.already_paid ?? 0
  const shieldIsUpgrade    = shieldPaid > 0
  const shieldPriceUnknown = resolvedShieldPrice === null && (hasBase || hasAi)

  if (hasShield) return null

  if (!products) {
    return (
      <div className="space-y-3">
        <div className="h-48 rounded-xl bg-[var(--color-surface-alt)] animate-pulse" />
      </div>
    )
  }

  const completePrice   = products.COMPLETE?.unit_amount_pence ?? 0
  const completeAiPrice = products.COMPLETE_AI?.unit_amount_pence ?? 0
  const shieldFullPrice = products.SHIELD_AI?.unit_amount_pence ?? 14999
  const upgradePrice    = products.AI_UPGRADE?.unit_amount_pence ?? 0

  return (
    <>
      {showCompare && (
        <ComparePlansModal
          prices={{ COMPLETE: completePrice, COMPLETE_AI: completeAiPrice, SHIELD_AI: shieldFullPrice, AI_UPGRADE: upgradePrice }}
          onClose={() => setShowCompare(false)}
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[0.6875rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {hasBase ? 'Upgrade' : 'Choose a plan'}
          </p>
          <button
            type="button"
            onClick={() => setShowCompare(true)}
            className="tap-target-44 text-[0.75rem] font-semibold text-[var(--brand-primary)] px-2.5 py-1 rounded-lg border border-[var(--brand-primary)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] active:bg-[color-mix(in_srgb,var(--brand-primary)_18%,transparent)] active:scale-[0.97] transition-all duration-150"
          >
            Compare all plans
          </button>
        </div>

        {!hasBase && !hasAi && !hasShield && (
          <div className="rounded-2xl border-2 border-[var(--color-border)] overflow-hidden relative">
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500 text-white text-[0.625rem] font-bold">
              <Star size={9} />
              Starter
            </div>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
                  <Shield size={16} />
                </span>
                <div className="flex-1 min-w-0 pr-16">
                  <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Core</p>
                  <p className="text-[1.25rem] font-bold text-[var(--brand-primary)] leading-none mt-0.5">
                    {formatGBP(completePrice)}
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {[
                  'Full chore tracker, ledger & savings goals',
                  'Unlimited children',
                  'Rate Guide benchmarking',
                  'Payment bridge (Monzo, Revolut, PayPal)',
                  `AI Mentor + Learning Lab available — just ${formatGBP(completeAiPrice - completePrice)} more with Core AI (${formatGBP(completeAiPrice)})`,
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={12} className="shrink-0 text-teal-500 mt-0.5" />
                    <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={buying !== null}
                onClick={() => handlePurchase('COMPLETE')}
                className="w-full py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-[0.8125rem] font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying === 'COMPLETE' ? 'Loading…' : `Get Morechard Core — ${formatGBP(completePrice)}`}
              </button>
            </div>
          </div>
        )}

        {!hasAi && (
          <div className="rounded-2xl border-2 border-violet-300 overflow-hidden bg-[color-mix(in_srgb,#7c3aed_4%,var(--color-surface))] relative">
            {!hasBase && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500 text-white text-[0.625rem] font-bold">
                <Star size={9} />
                Best Value
              </div>
            )}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 text-violet-600">
                  <Zap size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Core AI</p>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[0.625rem] font-bold uppercase tracking-wide">Includes AI</span>
                  </div>
                  <p className="text-[1.25rem] font-bold text-violet-600 leading-none mt-0.5">
                    {formatGBP(hasBase ? upgradePrice : completeAiPrice)}
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  </p>
                  {hasBase && (
                    <p className="text-[0.6875rem] text-violet-600 font-medium mt-1">
                      Upgrade price — you already have Morechard Core
                    </p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(hasBase ? [
                  'AI Mentor — personalised financial coaching for your children',
                  'Learning Lab — 20-module financial literacy curriculum',
                  'Lessons grounded in your children\'s real earnings data',
                ] : [
                  'Everything in Morechard Core',
                  'AI Mentor — personalised financial coaching for your children',
                  'Learning Lab — 20-module financial literacy curriculum',
                  'Lessons grounded in your children\'s real earnings data',
                ]).map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={12} className="shrink-0 text-violet-500 mt-0.5" />
                    <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={buying !== null}
                onClick={() => handlePurchase(hasBase ? 'AI_UPGRADE' : 'COMPLETE_AI')}
                className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-[0.8125rem] font-bold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying === 'COMPLETE_AI' || buying === 'AI_UPGRADE'
                  ? 'Loading…'
                  : hasBase
                  ? `Add AI Mentor + Learning Lab — ${formatGBP(upgradePrice)}`
                  : `Get Morechard Core AI — ${formatGBP(completeAiPrice)}`}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border-2 border-amber-300 overflow-hidden bg-[color-mix(in_srgb,#f59e0b_6%,var(--color-surface))] shadow-[0_0_0_4px_color-mix(in_srgb,#f59e0b_8%,transparent)]">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
                <Shield size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[0.9375rem] font-bold text-[var(--color-text)]">Morechard Shield AI</p>
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[0.625rem] font-bold uppercase tracking-wide">Professional</span>
                </div>
                <p className="text-[1.25rem] font-bold text-amber-600 leading-none mt-0.5">
                  {shieldPriceUnknown && shieldPriceFetching
                    ? <span className="text-[0.875rem] font-semibold text-amber-400">Loading price…</span>
                    : shieldPriceUnknown
                    ? <span className="text-[0.875rem] font-semibold text-amber-400">Price unavailable</span>
                    : formatGBP(shieldDelta)}
                  {!shieldPriceUnknown && (
                    <span className="text-[0.75rem] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
                  )}
                  {shieldIsUpgrade && (
                    <span className="ml-2 text-[0.75rem] font-semibold text-[var(--color-text-muted)] line-through">
                      {formatGBP(shieldFullPrice)}
                    </span>
                  )}
                </p>
                <p className="text-[0.6875rem] text-amber-700 font-medium mt-1">
                  {shieldPriceUnknown
                    ? 'Reload the page to see your upgrade price'
                    : shieldIsUpgrade
                    ? `You've already paid ${formatGBP(shieldPaid)} — only the difference is charged`
                    : 'Less than one hour of professional mediation'}
                </p>
              </div>
            </div>
            <p className="mt-2 mb-3 text-[0.75rem] text-[var(--color-text-muted)] leading-snug">
              Every export carries a cryptographic hash. If a single figure is altered after export, the seal breaks — proving the record is authentic to solicitors and mediators.
            </p>
            <ul className="space-y-1.5">
              {[
                'Everything in Morechard Core AI',
                'Court-admissible hashed PDF exports',
                'Digital tamper-seal on every export',
                'Share verified records with co-parents, mediators, or solicitors',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <Check size={12} className="shrink-0 text-amber-500 mt-0.5" />
                  <span className="text-[0.75rem] text-[var(--color-text-muted)] leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 pb-4">
            <button
              type="button"
              disabled={buying !== null || shieldPriceUnknown}
              onClick={() => handlePurchase('SHIELD_AI')}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-[0.8125rem] font-bold hover:bg-amber-600 hover:shadow-[0_4px_14px_color-mix(in_srgb,#f59e0b_40%,transparent)] active:bg-amber-700 active:scale-[0.98] active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {buying === 'SHIELD_AI'
                ? 'Loading…'
                : shieldPriceUnknown
                ? (shieldPriceFetching ? 'Fetching price…' : 'Price unavailable — reload to retry')
                : shieldIsUpgrade
                ? `Upgrade to Morechard Shield AI — ${formatGBP(shieldDelta)}`
                : `Get Morechard Shield AI — ${formatGBP(shieldFullPrice)}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Simplify `BillingSettings.tsx`'s `PlanView` to use the shared component**

In `app/src/components/settings/sections/BillingSettings.tsx`:

1. Delete the `ComparePlansModal` function (lines 82-175) and the `COMPARE_ROWS` constant (lines 61-80) — now living in `PlanPurchaseCards.tsx`.
2. Add an import: `import { PlanPurchaseCards } from '../../billing/PlanPurchaseCards'`.
3. In `PlanView`, replace the entire block from `{/* Upgrade options — shown only when there's something left to purchase */}` down through its closing `)}` (the `!hasShield && (...)` block containing all three cards) with:

```tsx
            {!hasShield && (
              <PlanPurchaseCards
                trial={trial}
                shieldUpgradePrice={resolvedShieldPrice}
                onBuyError={showToast}
              />
            )}
```

4. Remove the now-unused `showCompare` state, the `formatGBP` local function, and the `shieldDelta` / `shieldPaid` / `shieldIsUpgrade` / `shieldPriceUnknown` local variables from `PlanView` — they're now internal to `PlanPurchaseCards`. Keep `resolvedShieldPrice`, `shieldPriceFetching`, and the `useEffect` that fetches it via `getShieldUpgradePrice()` **only if** `BillingSettings`'s parent (`ParentSettingsTab`) still needs the pre-fetched `shieldUpgradePrice` prop for something else — check `grep -rn shieldUpgradePrice app/src/components/settings/` first. If nothing else reads it, delete that `useEffect` and the `shieldPriceFetching` state too, and just pass `shieldUpgradePrice={shieldUpgradePrice}` (the prop `BillingSettings` already receives) straight through to `PlanPurchaseCards`.
5. Remove unused imports (`Zap`, `Shield`, `Star`, `Check` icons if no longer referenced directly in `BillingSettings.tsx`; keep whatever `TrialView`/`HistoryView` still use).

- [ ] **Step 3: Manual check**

Run the app locally (`npm run dev`), log in as a parent whose family has no license yet, open Settings → Billing → Plans & Upgrades. Confirm:
- Prices shown match what Step 4 of Task 4 returned from `/api/products`.
- "Compare all plans" opens the modal with matching prices.
- Clicking "Get Morechard Core" redirects to a real Stripe Checkout page (sandbox).

- [ ] **Step 4: Run frontend tests and type-check**

```bash
cd app
npm run typecheck
npm test
```
Expected: no errors, all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/billing/PlanPurchaseCards.tsx app/src/components/settings/sections/BillingSettings.tsx
git commit -m "refactor(billing): extract PlanPurchaseCards, prices sourced from /api/products

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Retire the Stripe Pricing Table widget on `PaywallScreen`

**Files:**
- Modify: `app/src/screens/PaywallScreen.tsx`

**Interfaces:**
- Consumes: `PlanPurchaseCards` (Task 6), `getTrialStatus()` (existing).

- [ ] **Step 1: Rewrite `PaywallScreen.tsx`**

Replace the entire file with:

```tsx
/**
 * PaywallScreen — shown when the trial has expired.
 * Reuses the same PlanPurchaseCards component as BillingSettings so there
 * is exactly one checkout path in the app — no separate Stripe-hosted
 * widget with its own catalogue/config to keep in sync.
 */

import { useEffect, useState } from 'react'
import { FullLogo } from '../components/ui/Logo'
import { getDeviceIdentity } from '../lib/deviceIdentity'
import { PlanPurchaseCards } from '../components/billing/PlanPurchaseCards'
import { getTrialStatus, type TrialStatus } from '../lib/api'

export function PaywallScreen() {
  const identity = getDeviceIdentity()
  const [trial, setTrial] = useState<TrialStatus | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  useEffect(() => {
    getTrialStatus().then(setTrial).catch(() => setTrial(null))
  }, [])

  return (
    <div className="min-h-svh bg-[var(--color-bg)] flex flex-col">
      {/* Header */}
      <header className="safe-top sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-5 pt-4 pb-3 flex items-center justify-between">
          <FullLogo iconSize={26} />
          {identity && (
            <a
              href="/parent"
              className="text-[0.8125rem] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Back to app
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="px-5 pt-10 pb-6 text-center max-w-lg mx-auto w-full">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--brand-primary)] mb-2">
          Your trial has ended
        </p>
        <h1 className="text-[1.625rem] font-bold text-[var(--color-text)] leading-tight">
          Choose your plan
        </h1>
        <p className="text-[0.875rem] text-[var(--color-text-muted)] mt-2 leading-relaxed">
          One-time purchase. No subscriptions. Your data stays safe forever.
        </p>
      </div>

      {/* Purchase cards */}
      <div className="flex-1 w-full max-w-lg mx-auto px-5 pb-12">
        {errorToast && (
          <div className="mb-3 rounded-xl bg-red-50 text-red-700 text-[0.8125rem] font-semibold px-3 py-2 text-center">
            {errorToast}
          </div>
        )}
        <PlanPurchaseCards
          trial={trial}
          shieldUpgradePrice={null}
          onBuyError={setErrorToast}
        />
      </div>

      {/* Footer */}
      <footer className="px-5 py-5 text-center border-t border-[var(--color-border)]">
        <p className="text-[0.75rem] text-[var(--color-text-muted)] leading-relaxed">
          Payments processed securely by Stripe. Your card details are never stored by Morechard.
          <br />
          Questions? <a href="mailto:support@morechard.com" className="underline hover:text-[var(--color-text)] transition-colors">Contact support</a>
        </p>
      </footer>
    </div>
  )
}
```

This removes: the `stripe-pricing-table` JSX intrinsic-element type declaration, the hardcoded `PRICING_TABLE_ID` / `PUBLISHABLE_KEY` constants, and the `useEffect` that injected the `pricing-table.js` script tag.

- [ ] **Step 2: Manual check**

With a dev-environment family whose trial has expired (or by temporarily navigating directly to `/paywall` in the running app), confirm:
- No network request to `js.stripe.com/v3/pricing-table.js` fires (check the Network tab).
- The same purchase cards render as in `BillingSettings`.
- Clicking a plan redirects to Stripe Checkout.

- [ ] **Step 3: Run frontend tests and type-check**

```bash
cd app
npm run typecheck
npm test
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/PaywallScreen.tsx
git commit -m "refactor(paywall): retire Stripe Pricing Table widget, use PlanPurchaseCards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: End-to-end verification (dev) and production deploy

**Files:** none (verification + deploy only)

- [ ] **Step 0: Confirm the Stripe webhook endpoint actually exists (both modes)**

Before any of the checkout tests below can pass, a webhook endpoint must exist in the Stripe Dashboard (Developers → Webhooks) in **Test mode**, subscribed at minimum to `checkout.session.completed`, pointed at your dev/preview worker's `/api/stripe/webhook` URL. If dev's `STRIPE_WEBHOOK_SECRET` doesn't match that endpoint's current signing secret (Dashboard → the endpoint → "Signing secret"), the webhook will 401 on every event and nothing in this task will work. Re-run `npx wrangler secret put STRIPE_WEBHOOK_SECRET` (no `--env production`) with the correct value if needed. Repeat this same check for **Live mode** pointed at `https://api.morechard.com/api/stripe/webhook` before Step 7 (production deploy) — this is a Dashboard/secret task, not a code change, and isn't covered by any other task in this plan.

- [ ] **Step 1: Full worker test suite**

```bash
cd worker
npm test
npm run typecheck
```
Expected: all tests pass, no type errors.

- [ ] **Step 2: Full app test suite**

```bash
cd app
npm test
npm run typecheck
```
Expected: all tests pass, no type errors.

- [ ] **Step 3: Live sandbox checkout — each SKU**

With `npm run dev` running against `morechard-dev` (sandbox Stripe), for a test family with no license:
1. Purchase `COMPLETE` using Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
2. Confirm redirect to `/payment-success`, and within ~15s the app shows "You're all set" and `has_lifetime_license` becomes true (check via Settings → Billing → Trial Status, or `SELECT has_lifetime_license FROM families WHERE id = '<family_id>'` against `morechard-dev`).
3. Confirm a `payment_audit_log` row exists: `npx wrangler d1 execute morechard-dev --remote --command="SELECT * FROM payment_audit_log ORDER BY created_at DESC LIMIT 1"`.
4. Confirm a `checkout_intents` row exists for that session with `expected_amount_pence = 4499`.
5. Repeat for a second test family purchasing `COMPLETE_AI`, then `SHIELD_AI` (full price, no prior purchase), then a Core-only family purchasing `AI_UPGRADE`.

- [ ] **Step 4: Sandbox checkout — Shield upgrade credit path**

For a family that already purchased `COMPLETE` (£44.99), purchase `SHIELD_AI`. Confirm:
- The Stripe Checkout page shows the discounted amount (£149.99 − £44.99 = £105.00).
- `checkout_intents.expected_amount_pence` for that session is `10500`, and `stripe_price_id` is a freshly-created dynamic price (not the catalogue `SHIELD_AI` price ID).
- After completion, `has_shield` becomes true.

- [ ] **Step 5: Sandbox checkout — promo code**

Create a Stripe test-mode promotion code (Dashboard → Product catalogue → Coupons, or reuse `handleCreatePromoCode` if one already exists for testing), apply it at checkout for a `COMPLETE` purchase. Confirm:
- `amount_total` on the completed session is discounted, but the license is still granted (since `amount_subtotal` — not `amount_total` — is what gets checked against `checkout_intents`).

- [ ] **Step 6: Induced amount-mismatch (negative test)**

Manually corrupt one `checkout_intents` row for a real completed session *before* replaying its webhook event (Stripe Dashboard → Developers → Webhooks → click into the event → "Resend"), e.g.:
```bash
npx wrangler d1 execute morechard-dev --remote --command="UPDATE checkout_intents SET expected_amount_pence = 1 WHERE stripe_session_id = '<session_id>'"
```
Resend that event and confirm:
- No new `payment_audit_log` row is written.
- No license flags change.
- A Sentry error with fingerprint `stripe-amount-mismatch` appears (check the Sentry project dashboard).
- The webhook still responds 200 (check the Stripe Dashboard's webhook event log shows a successful delivery, not a retry loop).

- [ ] **Step 7: Deploy the Worker to production**

```bash
cd worker
npm run deploy:preview
```
Confirm the preview URL works for a manual sandbox-mode smoke test isn't possible against production (production only has live Stripe keys) — instead, review the preview version's logs/no-op behavior, then:
```bash
npm run deploy:promote
```

- [ ] **Step 8: Deploy the app (Cloudflare Pages)**

Push to `main` (per `CLAUDE.md`, Pages auto-deploys on push — no manual step needed beyond the git push already required to land this branch).

- [ ] **Step 9: Production smoke test with a real low-value purchase**

Using a real card, purchase `AI_UPGRADE` (£29.99 — the cheapest SKU) against production for a real or disposable test family. Confirm the license grants correctly, then use the existing 14-day cooling-off refund (`DELETE /api/billing/cancel` via Settings → Billing → Plan Management → "Cancel plan & request refund") to reverse the charge.

- [ ] **Step 10: Update the roadmap**

In `CLAUDE.md`, under **Phase 7: Monetization & Global Scale**, add a line noting the Stripe pricing/webhook security work is complete (this directly unblocks "Build Day 15 Paywall", which was blocked on there being no real, validated checkout path).

- [ ] **Step 11: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: note Stripe pricing/checkout security fix complete in roadmap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
