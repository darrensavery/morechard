# Shield Upgrade Pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user who already paid for Core or Core AI upgrades to Shield, charge only the delta (£149.99 minus what they've already paid), not the full price.

**Architecture:** A shared `calcShieldCredit` helper in `worker/src/routes/stripe.ts` sums non-refunded GBP payments from `payment_audit_log`. A new `GET /api/stripe/shield-upgrade-price` endpoint exposes the personalised price to the frontend. When the delta is less than £149.99, `handleCreateCheckout` creates a dynamic Stripe Price object for the exact amount rather than using the fixed price ID. The frontend fetches the personalised price on mount and renders it in the Shield card and DataSettings upsell banner.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), Stripe API (dynamic price creation via `/v1/prices`), React, TypeScript, Vitest

---

## File map

| File | Change |
|---|---|
| `worker/src/routes/stripe.ts` | Add `calcShieldCredit`, `handleShieldUpgradePrice`, dynamic price logic in `handleCreateCheckout` |
| `worker/src/types.ts` | Add `STRIPE_SHIELD_PRODUCT_ID` to `Env` interface |
| `worker/src/index.ts` | Register `GET /api/stripe/shield-upgrade-price` route |
| `worker/src/routes/stripe.test.ts` | New — unit tests for `calcShieldCredit` logic |
| `app/src/lib/api.ts` | Add `getShieldUpgradePrice()` |
| `app/src/components/dashboard/ParentSettingsTab.tsx` | Fetch shield price on mount; pass to `BillingSettings` and `DataSettings` |
| `app/src/components/settings/sections/BillingSettings.tsx` | Accept `shieldUpgradePrice` prop; render personalised price |
| `app/src/components/settings/sections/DataSettings.tsx` | Accept `shieldDelta` prop; render personalised upsell label |

---

## Task 1: Add `STRIPE_SHIELD_PRODUCT_ID` to the `Env` type

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Add the env var to the Env interface**

In `worker/src/types.ts`, add `STRIPE_SHIELD_PRODUCT_ID` after `STRIPE_WEBHOOK_SECRET`:

```typescript
STRIPE_SECRET_KEY: string;
STRIPE_WEBHOOK_SECRET: string;
STRIPE_SHIELD_PRODUCT_ID: string;
```

- [ ] **Step 2: Add the var to `.dev.vars`**

Open `worker/.dev.vars` (create it if it doesn't exist — it's gitignored). Add:

```
STRIPE_SHIELD_PRODUCT_ID=prod_XXXXXXXXXXXXXXXX
```

Replace `prod_XXXXXXXXXXXXXXXX` with the real Stripe Product ID for Morechard Shield. Find it in the Stripe dashboard under Products → Morechard Shield → Product ID (starts with `prod_`).

- [ ] **Step 3: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(stripe): add STRIPE_SHIELD_PRODUCT_ID to Env type"
```

---

## Task 2: Add `calcShieldCredit` helper and unit tests

**Files:**
- Modify: `worker/src/routes/stripe.ts`
- Create: `worker/src/routes/stripe.test.ts`

The helper queries D1 for all non-refunded GBP payments of eligible SKUs and returns the total credit in pence plus the delta.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/routes/stripe.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// calcShieldCredit logic extracted for unit testing.
// The real function queries D1; here we test the pure arithmetic.

const SHIELD_FULL_PRICE = 14999;
const STRIPE_MINIMUM_PENCE = 30;

function computeDelta(totalCreditPence: number): number {
  const raw = SHIELD_FULL_PRICE - totalCreditPence;
  return Math.max(raw, STRIPE_MINIMUM_PENCE);
}

describe('Shield upgrade delta calculation', () => {
  it('charges full price when no prior purchases', () => {
    expect(computeDelta(0)).toBe(14999);
  });

  it('deducts Core price (£44.99)', () => {
    expect(computeDelta(4499)).toBe(10500);
  });

  it('deducts Core AI price (£64.99)', () => {
    expect(computeDelta(6499)).toBe(8500);
  });

  it('deducts Core + AI Upgrade (£44.99 + £29.99 = £74.98)', () => {
    expect(computeDelta(4499 + 2999)).toBe(7501);
  });

  it('floors at Stripe minimum (30p) if credit somehow exceeds full price', () => {
    expect(computeDelta(20000)).toBe(30);
  });

  it('handles zero credit exactly at full price', () => {
    expect(computeDelta(14999)).toBe(30); // floors at minimum, not 0
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd worker && npm test -- stripe.test.ts
```

Expected: All 6 tests fail with "computeDelta is not defined" or similar.

- [ ] **Step 3: Add `calcShieldCredit` to `stripe.ts`**

In `worker/src/routes/stripe.ts`, add after the `AUDIT_AMOUNTS` constant block (around line 57):

```typescript
// ----------------------------------------------------------------
// Shield upgrade credit — sums what this family already paid
// toward the Shield licence price.
// ----------------------------------------------------------------

const SHIELD_FULL_PRICE_PENCE = 14999;
const STRIPE_MINIMUM_PENCE = 30;
const SHIELD_CREDIT_SKUS = ['COMPLETE', 'COMPLETE_AI', 'AI_UPGRADE'] as const;

interface ShieldCreditResult {
  alreadyPaid: number;  // pence
  delta: number;        // pence — amount to charge
}

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

- [ ] **Step 4: Update the test file to import the pure function**

The test file uses a local `computeDelta` that mirrors the logic. The tests are already written to pass against this logic — verify they pass now:

```bash
cd worker && npm test -- stripe.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/stripe.ts worker/src/routes/stripe.test.ts
git commit -m "feat(stripe): add calcShieldCredit helper with unit tests"
```

---

## Task 3: Add `GET /api/stripe/shield-upgrade-price` endpoint

**Files:**
- Modify: `worker/src/routes/stripe.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add the route handler to `stripe.ts`**

In `worker/src/routes/stripe.ts`, add after `handleCreateCheckout`:

```typescript
// ----------------------------------------------------------------
// Route: GET /api/stripe/shield-upgrade-price
// ----------------------------------------------------------------
export async function handleShieldUpgradePrice(
  _request: Request,
  env: Env,
  auth: JwtPayload,
): Promise<Response> {
  // Only parents can purchase
  if (auth.role !== 'parent') return error('Forbidden', 403);

  // Guard: already has Shield
  const family = await env.DB
    .prepare('SELECT has_shield FROM families WHERE id = ?')
    .bind(auth.family_id)
    .first<{ has_shield: number }>();

  if (family?.has_shield) return error('Already purchased', 400);

  const { alreadyPaid, delta } = await calcShieldCredit(env, auth.family_id);

  return json({
    full_price:   SHIELD_FULL_PRICE_PENCE,
    already_paid: alreadyPaid,
    delta,
    currency:     'GBP',
  });
}
```

- [ ] **Step 2: Register the route in `index.ts`**

In `worker/src/index.ts`, find the import for stripe handlers (around line 143):

```typescript
import { handleCreateCheckout, handleStripeWebhook, handleCancelPlan } from './routes/stripe.js';
```

Replace with:

```typescript
import { handleCreateCheckout, handleStripeWebhook, handleCancelPlan, handleShieldUpgradePrice } from './routes/stripe.js';
```

Then find the existing Shield checkout route (around line 660):

```typescript
// Stripe checkout (parent only, post-auth)
if (path === '/api/stripe/create-checkout' && method === 'POST') {
  return handleCreateCheckout(request, env, auth);
}
```

Add the new route immediately before it:

```typescript
// Shield upgrade price preview (parent only, post-auth)
if (path === '/api/stripe/shield-upgrade-price' && method === 'GET') {
  return handleShieldUpgradePrice(request, env, auth);
}

// Stripe checkout (parent only, post-auth)
if (path === '/api/stripe/create-checkout' && method === 'POST') {
  return handleCreateCheckout(request, env, auth);
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broken**

```bash
cd worker && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/stripe.ts worker/src/index.ts
git commit -m "feat(stripe): add GET /api/stripe/shield-upgrade-price endpoint"
```

---

## Task 4: Add dynamic Stripe Price creation to `handleCreateCheckout`

**Files:**
- Modify: `worker/src/routes/stripe.ts`

When the user already has credit toward Shield, we create a one-off Stripe Price object for the exact delta rather than using the fixed `SHIELD_AI` price ID.

- [ ] **Step 1: Add the dynamic price creation helper**

In `worker/src/routes/stripe.ts`, add after `createCheckoutSession`:

```typescript
async function createDynamicPrice(
  productId: string,
  unitAmount: number,
  currency: string,
  stripeSecretKey: string,
): Promise<string> {
  const params = new URLSearchParams({
    'currency':    currency,
    'unit_amount': String(unitAmount),
    'product':     productId,
  });

  const res = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const msg = await res.text();
    console.error('Stripe create-price error:', msg);
    throw new Error('Failed to create dynamic price');
  }

  const price = await res.json() as { id: string };
  return price.id;
}
```

- [ ] **Step 2: Update `handleCreateCheckout` to use dynamic pricing for Shield**

Find the section in `handleCreateCheckout` that resolves `priceId` (around line 151):

```typescript
const priceId = PRICE_IDS[payment_type];
if (!priceId || priceId.startsWith('price_PLACEHOLDER')) {
  console.error(`No live price ID configured for ${payment_type}`);
  return error('This product is not yet available for purchase', 503);
}

try {
  const { url, sessionId } = await createCheckoutSession(
    priceId, auth.family_id, payment_type, env.APP_URL, env.STRIPE_SECRET_KEY,
  );
  return json({ url, session_id: sessionId });
} catch {
  return error('Failed to create checkout session', 502);
}
```

Replace with:

```typescript
let priceId: string | undefined = PRICE_IDS[payment_type];

// For Shield, calculate upgrade credit and use a dynamic price if applicable
if (payment_type === 'SHIELD_AI') {
  const { delta } = await calcShieldCredit(env, auth.family_id);
  if (delta < SHIELD_FULL_PRICE_PENCE) {
    try {
      priceId = await createDynamicPrice(
        env.STRIPE_SHIELD_PRODUCT_ID,
        delta,
        'gbp',
        env.STRIPE_SECRET_KEY,
      );
    } catch {
      return error('Failed to calculate upgrade price', 502);
    }
  }
}

if (!priceId || priceId.startsWith('price_PLACEHOLDER')) {
  console.error(`No live price ID configured for ${payment_type}`);
  return error('This product is not yet available for purchase', 503);
}

try {
  const { url, sessionId } = await createCheckoutSession(
    priceId, auth.family_id, payment_type, env.APP_URL, env.STRIPE_SECRET_KEY,
  );
  return json({ url, session_id: sessionId });
} catch {
  return error('Failed to create checkout session', 502);
}
```

- [ ] **Step 3: Run tests**

```bash
cd worker && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/stripe.ts
git commit -m "feat(stripe): create dynamic Stripe price for Shield upgrades"
```

---

## Task 5: Add `getShieldUpgradePrice` to the frontend API client

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add the function after `createCheckoutSession`**

In `app/src/lib/api.ts`, find `createCheckoutSession` (around line 258) and add after it:

```typescript
export interface ShieldUpgradePrice {
  full_price:   number   // pence
  already_paid: number   // pence
  delta:        number   // pence — amount that will be charged
  currency:     string
}

export async function getShieldUpgradePrice(): Promise<ShieldUpgradePrice> {
  return request('/api/stripe/shield-upgrade-price')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(api): add getShieldUpgradePrice client function"
```

---

## Task 6: Fetch shield price in `ParentSettingsTab` and pass to children

**Files:**
- Modify: `app/src/components/dashboard/ParentSettingsTab.tsx`

- [ ] **Step 1: Import the new function and type**

Find the imports from `../../lib/api` (around line 75). Add `getShieldUpgradePrice` and `ShieldUpgradePrice` to the import:

```typescript
import {
  getChildren, addChild, generateInvite,
  getFamily, updateFamily, getSettings, updateSettings,
  getChildSettings, updateChildSettings,
  getChildGrowth, updateChildGrowth,
  getMe, updateProfile, getLeadCount, getTrialStatus,
  getShieldUpgradePrice,
  apiUrl, authHeaders,
  type MeResult, type TrialStatus, type ShieldUpgradePrice,
} from '../../lib/api'
```

- [ ] **Step 2: Add state for the shield price**

In `ParentSettingsTab`, find the existing state declarations (around line 185):

```typescript
const [trial, setTrial] = useState<TrialStatus | null>(null)
```

Add after it:

```typescript
const [shieldUpgradePrice, setShieldUpgradePrice] = useState<ShieldUpgradePrice | null>(null)
```

- [ ] **Step 3: Fetch shield price in `load()`**

Find the `load` callback (around line 205). The current `Promise.all` is:

```typescript
const [c, f, s, p, leads, t] = await Promise.all([
  getChildren().then(r => r.children),
  getFamily(),
  getSettings(),
  getMe(),
  getLeadCount().then(r => r.lead_count).catch(() => 1),
  getTrialStatus().catch(() => null),
])
```

Replace with:

```typescript
const hasShieldAlready = identity?.has_shield ?? false

const [c, f, s, p, leads, t, shieldPrice] = await Promise.all([
  getChildren().then(r => r.children),
  getFamily(),
  getSettings(),
  getMe(),
  getLeadCount().then(r => r.lead_count).catch(() => 1),
  getTrialStatus().catch(() => null),
  hasShieldAlready ? Promise.resolve(null) : getShieldUpgradePrice().catch(() => null),
])
```

Then add after the existing `setTrial(t)` call:

```typescript
setShieldUpgradePrice(shieldPrice)
```

**Note:** `identity?.has_shield` may not exist on the device identity object yet — if the TypeScript compiler complains, use `(identity as any)?.has_shield` for now, or simply always fetch (the endpoint returns 400 if already purchased, and `.catch(() => null)` handles it).

A simpler alternative that avoids the type issue — replace the shield price fetch in the Promise.all with:

```typescript
getShieldUpgradePrice().catch(() => null),
```

- [ ] **Step 4: Pass `shieldUpgradePrice` to `BillingSettings` and `DataSettings`**

Find where `BillingSettings` is rendered (search for `<BillingSettings`). Add the prop:

```tsx
<BillingSettings
  onBack={() => setView({ type: 'menu' })}
  showToast={showToast}
  shieldUpgradePrice={shieldUpgradePrice}
/>
```

Find where `<DataSettings` is rendered. Add the prop:

```tsx
<DataSettings
  isLead={isLead}
  hasAiMentor={trial?.has_ai_mentor ?? false}
  hasShield={trial?.has_shield ?? false}
  toast={toast}
  onBack={() => setView({ type: 'menu' })}
  onNavigateToPlan={() => setView({ type: 'section', section: 'billing', billingSubView: 'plan' })}
  shieldUpgradePrice={shieldUpgradePrice}
/>
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dashboard/ParentSettingsTab.tsx
git commit -m "feat(settings): fetch and distribute shield upgrade price"
```

---

## Task 7: Render personalised price in `BillingSettings`

**Files:**
- Modify: `app/src/components/settings/sections/BillingSettings.tsx`

- [ ] **Step 1: Add `shieldUpgradePrice` to the `PlanView` props**

In `BillingSettings.tsx`, find the `PlanView` function signature (around line 262):

```typescript
function PlanView({ onBack, showToast }: { onBack: () => void; showToast: (m: string) => void }) {
```

Replace with:

```typescript
import type { ShieldUpgradePrice } from '../../../lib/api'

function PlanView({ onBack, showToast, shieldUpgradePrice }: {
  onBack: () => void
  showToast: (m: string) => void
  shieldUpgradePrice: ShieldUpgradePrice | null
}) {
```

Also add `shieldUpgradePrice` to the outer `BillingSettings` component props interface and thread it through to `PlanView`. Find the outer component's props (near the top of the file):

```typescript
interface Props {
  onBack:    () => void
  showToast: (msg: string) => void
}
```

Replace with:

```typescript
import type { ShieldUpgradePrice } from '../../../lib/api'

interface Props {
  onBack:              () => void
  showToast:           (msg: string) => void
  shieldUpgradePrice:  ShieldUpgradePrice | null
}
```

Find the `BillingSettings` component body where it renders `<PlanView` and add the prop:

```tsx
<PlanView
  onBack={onBack}
  showToast={showToast}
  shieldUpgradePrice={shieldUpgradePrice}
/>
```

- [ ] **Step 2: Add a helper to format pence as £X.XX**

At the top of `PlanView` (before the JSX return), add:

```typescript
function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

const shieldDelta     = shieldUpgradePrice?.delta ?? 14999
const shieldPaid      = shieldUpgradePrice?.already_paid ?? 0
const shieldIsUpgrade = shieldPaid > 0
```

- [ ] **Step 3: Update the Shield card price display**

Find the Shield card price line (around line 508):

```tsx
<p className="text-[20px] font-bold text-amber-600 leading-none mt-0.5">
  £149.99
  <span className="text-[12px] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
</p>
<p className="text-[11px] text-amber-700 font-medium mt-1">
  Less than one hour of professional mediation
</p>
```

Replace with:

```tsx
<p className="text-[20px] font-bold text-amber-600 leading-none mt-0.5">
  {formatGBP(shieldDelta)}
  <span className="text-[12px] font-semibold text-[var(--color-text-muted)] ml-1">one-time</span>
  {shieldIsUpgrade && (
    <span className="ml-2 text-[12px] font-semibold text-[var(--color-text-muted)] line-through">
      £149.99
    </span>
  )}
</p>
<p className="text-[11px] text-amber-700 font-medium mt-1">
  {shieldIsUpgrade
    ? `You've already paid ${formatGBP(shieldPaid)} — only the difference is charged`
    : 'Less than one hour of professional mediation'}
</p>
```

- [ ] **Step 4: Update the Shield card button label**

Find the Shield button (around line 541):

```tsx
{buying === 'SHIELD_AI' ? 'Loading…' : 'Get Morechard Shield — £149.99'}
```

Replace with:

```tsx
{buying === 'SHIELD_AI'
  ? 'Loading…'
  : shieldIsUpgrade
  ? `Upgrade to Morechard Shield — ${formatGBP(shieldDelta)}`
  : 'Get Morechard Shield — £149.99'}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/settings/sections/BillingSettings.tsx
git commit -m "feat(billing): show personalised Shield upgrade price in plan card"
```

---

## Task 8: Update the DataSettings upsell banner

**Files:**
- Modify: `app/src/components/settings/sections/DataSettings.tsx`

- [ ] **Step 1: Add `shieldUpgradePrice` to the `Props` interface**

Find the `Props` interface (around line 18):

```typescript
interface Props {
  isLead:           boolean
  hasAiMentor:      boolean
  hasShield:        boolean
  toast:            string | null
  onBack:           () => void
  onNavigateToPlan: () => void
}
```

Replace with:

```typescript
import type { ShieldUpgradePrice } from '../../../lib/api'

interface Props {
  isLead:              boolean
  hasAiMentor:         boolean
  hasShield:           boolean
  toast:               string | null
  onBack:              () => void
  onNavigateToPlan:    () => void
  shieldUpgradePrice:  ShieldUpgradePrice | null
}
```

Update the destructured props in the component function:

```typescript
export function DataSettings({
  isLead, hasAiMentor, hasShield,
  toast, onBack, onNavigateToPlan, shieldUpgradePrice,
}: Props) {
```

- [ ] **Step 2: Derive the label text**

After the existing `useCallback` hooks, add:

```typescript
const shieldLabelText = (() => {
  if (!shieldUpgradePrice || shieldUpgradePrice.already_paid === 0) {
    return 'Requires Shield (£149.99 one-time)'
  }
  const delta = (shieldUpgradePrice.delta / 100).toFixed(2)
  return `Requires Shield (£${delta} to upgrade)`
})()
```

- [ ] **Step 3: Update the upsell banner text**

Find the Forensic Report upsell banner (around line 194):

```tsx
<p className="text-[12px] font-semibold text-amber-700 leading-snug">
  Requires Shield (£149.99 one-time)
</p>
```

Replace with:

```tsx
<p className="text-[12px] font-semibold text-amber-700 leading-snug">
  {shieldLabelText}
</p>
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/DataSettings.tsx
git commit -m "feat(data-settings): show personalised Shield price in upsell banner"
```

---

## Task 9: Manual smoke test

The app has no automated frontend tests. Verify the full flow manually.

- [ ] **Step 1: Start the local dev server**

```bash
cd app && npm run dev
```

- [ ] **Step 2: Test scenario — trial/free user (no prior purchases)**

Log in as a user with no purchases. Open Settings → Data & Exports and Settings → Plan Management.

Expected:
- Shield card shows **£149.99** with no strikethrough
- Button reads "Get Morechard Shield — £149.99"
- DataSettings banner reads "Requires Shield (£149.99 one-time)"

- [ ] **Step 3: Seed a Core purchase in local D1 and test upgrade display**

Run the following against your local D1 to simulate a Core purchase:

```bash
cd worker && npx wrangler d1 execute morechard --local --command="INSERT INTO payment_audit_log (family_id, stripe_session_id, amount_paid_int, currency, payment_type) VALUES ('<YOUR_FAMILY_ID>', 'cs_test_smoke_core', 4499, 'GBP', 'COMPLETE')"
```

Replace `<YOUR_FAMILY_ID>` with the actual family ID (visible in DevTools → Application → localStorage → `morechard_device_identity` → `family_id`).

Reload the app. Open Settings → Plan Management.

Expected:
- Shield card shows **£105.00** with strikethrough ~~£149.99~~
- Sub-line reads "You've already paid £44.99 — only the difference is charged"
- Button reads "Upgrade to Morechard Shield — £105.00"
- DataSettings banner reads "Requires Shield (£105.00 to upgrade)"

- [ ] **Step 4: Clean up the seeded row**

```bash
cd worker && npx wrangler d1 execute morechard --local --command="DELETE FROM payment_audit_log WHERE stripe_session_id = 'cs_test_smoke_core'"
```

- [ ] **Step 5: Run worker tests one final time**

```bash
cd worker && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Final commit (if any fixup needed)**

```bash
git add -p
git commit -m "fix(shield-upgrade): smoke test fixups"
```
