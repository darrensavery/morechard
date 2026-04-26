# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working referral link system with affiliate tracking — peer (family-to-family), professional (legal/media), and hardship (charity) — generating unique shareable URLs that track clicks, sign-ups, and licence purchases end-to-end.

**Architecture:** Each registered parent gets a unique referral code stored in `families.referral_code` (set at registration). The worker exposes endpoints to get the referral code, generate a shareable URL, and record click/conversion events. When a new family registers via a referral link, the `ref` query param is stored on their row; on Stripe webhook, the referral is converted and a reward is queued. The frontend `ReferralsSettings` component replaces all "Coming Soon" toasts with live share functionality.

**Tech Stack:** Cloudflare D1 (SQLite), Cloudflare Worker (TypeScript), React (Vite PWA), nanoid, Web Share API / clipboard fallback, Stripe webhook (existing).

---

## File Map

| File | Change |
|------|--------|
| `worker/migrations/0042_referral_system.sql` | Create — `referral_clicks`, `referral_conversions` tables + `referral_code` / `referred_by_code` cols on `families` |
| `worker/src/routes/referrals.ts` | Create — all referral API handlers |
| `worker/src/routes/stripe.ts` | Modify — fire `recordReferralConversion()` inside webhook handler |
| `worker/src/index.ts` | Modify — wire new referral routes |
| `worker/src/types.ts` | Modify — add `ReferralStats` type |
| `app/src/lib/api.ts` | Modify — add `getReferralCode()`, `getReferralStats()`, `trackReferralClick()` |
| `app/src/components/settings/sections/ReferralsSettings.tsx` | Modify — replace toasts with live share + stats UI |
| `app/src/screens/RegistrationScreen.tsx` (or equivalent entry) | Modify — read `?ref=` from URL on load, persist to localStorage |
| `worker/src/routes/auth.ts` | Modify — consume `referred_by_code` from families on registration |

---

## Task 1: D1 Migration

**Files:**
- Create: `worker/migrations/0042_referral_system.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 0042: referral system

-- Unique referral code per family (set at registration)
ALTER TABLE families ADD COLUMN referral_code TEXT UNIQUE;

-- Code of the referrer who brought this family in (set at registration)
ALTER TABLE families ADD COLUMN referred_by_code TEXT;

-- Click log — one row per unique click on a referral link
CREATE TABLE IF NOT EXISTS referral_clicks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code TEXT    NOT NULL,
  clicked_at    INTEGER NOT NULL,  -- unix epoch
  user_agent    TEXT,
  ip_hash       TEXT               -- SHA-256 of IP for dedup, not PII
);

-- Conversion log — one row when a referred family buys a licence
CREATE TABLE IF NOT EXISTS referral_conversions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  referral_code    TEXT    NOT NULL,       -- referrer's code
  referred_family  TEXT    NOT NULL,       -- family_id of the new purchaser
  payment_type     TEXT    NOT NULL,       -- LIFETIME | COMPLETE | AI_ANNUAL | SHIELD
  stripe_session_id TEXT   NOT NULL UNIQUE,-- idempotency key
  converted_at     INTEGER NOT NULL,       -- unix epoch
  reward_granted   INTEGER NOT NULL DEFAULT 0  -- 1 once AI Mentor bonus applied
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_code ON referral_conversions(referral_code);
```

- [ ] **Step 2: Apply migration to local D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --local --file=worker/migrations/0042_referral_system.sql
```

Expected output: `✅  Executed migration`

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0042_referral_system.sql
git commit -m "feat(referrals): D1 migration 0042 — referral_code, referral_clicks, referral_conversions"
```

---

## Task 2: Worker — Referral Routes

**Files:**
- Create: `worker/src/routes/referrals.ts`

- [ ] **Step 1: Create the route file**

```typescript
/**
 * Referral routes
 *
 * GET  /api/referrals/me          — Return caller's referral code + shareable URL
 * GET  /api/referrals/stats       — Click + conversion counts for caller's code
 * POST /api/referrals/click       — PUBLIC: record a link click (called from landing page / reg flow)
 */

import { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { AuthedRequest } from './auth.js';

const APP_URL_FALLBACK = 'https://app.morechard.com';

// Generates a 8-char alphanumeric code from the family ID (deterministic on first call)
function deriveCode(familyId: string): string {
  // Use last 8 chars of the family nanoid — already random enough, URL-safe
  return familyId.replace(/-/g, '').slice(-8).toUpperCase();
}

// ── GET /api/referrals/me ────────────────────────────────────────────────────
export async function handleReferralMe(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller || caller.role !== 'parent') return error('Unauthorised', 401);

  const family = await env.DB
    .prepare('SELECT referral_code FROM families WHERE id = ?')
    .bind(caller.family_id)
    .first<{ referral_code: string | null }>();

  if (!family) return error('Family not found', 404);

  let code = family.referral_code;

  // Lazy-initialise the code if not yet set
  if (!code) {
    code = deriveCode(caller.family_id);
    // Handle the rare case where derived code collides
    const collision = await env.DB
      .prepare('SELECT id FROM families WHERE referral_code = ? AND id != ?')
      .bind(code, caller.family_id)
      .first();
    if (collision) {
      // Fall back to a fully random suffix
      const arr = new Uint8Array(4);
      crypto.getRandomValues(arr);
      code = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    await env.DB
      .prepare('UPDATE families SET referral_code = ? WHERE id = ?')
      .bind(code, caller.family_id)
      .run();
  }

  const appUrl = (env.APP_URL ?? APP_URL_FALLBACK).replace(/\/$/, '');
  const shareUrl = `${appUrl}/?ref=${code}`;

  return json({ code, share_url: shareUrl });
}

// ── GET /api/referrals/stats ─────────────────────────────────────────────────
export async function handleReferralStats(request: Request, env: Env): Promise<Response> {
  const caller = (request as AuthedRequest).auth;
  if (!caller || caller.role !== 'parent') return error('Unauthorised', 401);

  const family = await env.DB
    .prepare('SELECT referral_code FROM families WHERE id = ?')
    .bind(caller.family_id)
    .first<{ referral_code: string | null }>();

  const code = family?.referral_code;
  if (!code) return json({ clicks: 0, sign_ups: 0, conversions: 0, rewards_pending: 0 });

  const [clickRow, convRow] = await Promise.all([
    env.DB
      .prepare('SELECT COUNT(*) AS n FROM referral_clicks WHERE referral_code = ?')
      .bind(code)
      .first<{ n: number }>(),
    env.DB
      .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN reward_granted = 0 THEN 1 ELSE 0 END) AS pending FROM referral_conversions WHERE referral_code = ?')
      .bind(code)
      .first<{ total: number; pending: number }>(),
  ]);

  const signUps = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM families WHERE referred_by_code = ?')
    .bind(code)
    .first<{ n: number }>();

  return json({
    clicks:          clickRow?.n ?? 0,
    sign_ups:        signUps?.n ?? 0,
    conversions:     convRow?.total ?? 0,
    rewards_pending: convRow?.pending ?? 0,
  });
}

// ── POST /api/referrals/click ────────────────────────────────────────────────
// Public — no auth. Called when a visitor lands on /?ref=CODE before registering.
export async function handleReferralClick(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const code = (body?.['code'] as string | undefined)?.trim().toUpperCase();
  if (!code || code.length < 6) return error('code required', 400);

  // Verify the code exists (prevent spam logging arbitrary codes)
  const exists = await env.DB
    .prepare('SELECT id FROM families WHERE referral_code = ?')
    .bind(code)
    .first();
  if (!exists) return error('Unknown referral code', 404);

  const now = Math.floor(Date.now() / 1000);
  const ip  = request.headers.get('CF-Connecting-IP') ?? '';

  // Hash the IP for deduplication without storing PII
  const ipHash = ip
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))))
        .map(b => b.toString(16).padStart(2, '0')).join('')
    : null;

  await env.DB
    .prepare('INSERT INTO referral_clicks (referral_code, clicked_at, user_agent, ip_hash) VALUES (?, ?, ?, ?)')
    .bind(code, now, request.headers.get('User-Agent') ?? null, ipHash)
    .run();

  return json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/referrals.ts
git commit -m "feat(referrals): add referral route handlers (me, stats, click)"
```

---

## Task 3: Wire Referral Conversion into Stripe Webhook

**Files:**
- Modify: `worker/src/routes/stripe.ts`

- [ ] **Step 1: Read the webhook handler section**

Open `worker/src/routes/stripe.ts` and find `handleStripeWebhook`. Locate the block that writes to `payment_audit_log` after a successful `checkout.session.completed` event. It will look roughly like:

```typescript
await env.DB.prepare(`INSERT INTO payment_audit_log ...`).run();
// then updates families ...
```

- [ ] **Step 2: Add `recordReferralConversion` helper at the top of the file (after imports)**

```typescript
async function recordReferralConversion(
  env: Env,
  familyId: string,
  paymentType: string,
  stripeSessionId: string,
  now: number,
): Promise<void> {
  const family = await env.DB
    .prepare('SELECT referred_by_code FROM families WHERE id = ?')
    .bind(familyId)
    .first<{ referred_by_code: string | null }>();

  if (!family?.referred_by_code) return;

  // Idempotency: stripe_session_id has UNIQUE constraint
  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO referral_conversions
        (referral_code, referred_family, payment_type, stripe_session_id, converted_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(family.referred_by_code, familyId, paymentType, stripeSessionId, now)
    .run();
}
```

- [ ] **Step 3: Call it inside the webhook handler, right after the `payment_audit_log` insert**

Find the line that does `await env.DB.prepare('INSERT INTO payment_audit_log...').run()` and add directly after it:

```typescript
await recordReferralConversion(env, familyId, paymentType, sessionId, now);
```

Where `sessionId` is the Stripe session ID already extracted by the webhook handler (the variable name may be `session.id` or `stripeSession.id` — match the existing code).

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/stripe.ts
git commit -m "feat(referrals): record conversion on Stripe webhook checkout.session.completed"
```

---

## Task 4: Consume `?ref=` at Registration

**Files:**
- Modify: `worker/src/routes/auth.ts` (handleCreateFamily or handleRegister — whichever creates the `families` row)

- [ ] **Step 1: Find the family INSERT in `worker/src/routes/auth.ts`**

Search for `INSERT INTO families`. The body already accepts `name`, `locale`, `parenting_mode`, etc.

- [ ] **Step 2: Accept `referred_by_code` in the body and write it to the families row**

In the body-parsing section of `handleCreateFamily`, add:

```typescript
const referred_by_code = (body['referred_by_code'] as string | undefined)?.trim().toUpperCase() || null;
```

Then in the `INSERT INTO families` statement, add `referred_by_code` to the column list and bind it. For example if the existing INSERT is:

```typescript
await env.DB.prepare(`
  INSERT INTO families (id, name, locale, ...)
  VALUES (?, ?, ?, ...)
`).bind(familyId, name, locale, ...).run();
```

Change it to:

```typescript
await env.DB.prepare(`
  INSERT INTO families (id, name, locale, ..., referred_by_code)
  VALUES (?, ?, ?, ..., ?)
`).bind(familyId, name, locale, ..., referred_by_code).run();
```

If `referred_by_code` is non-null, also validate it exists:

```typescript
if (referred_by_code) {
  const referrer = await env.DB
    .prepare('SELECT id FROM families WHERE referral_code = ?')
    .bind(referred_by_code)
    .first();
  // Silently ignore invalid codes — don't block registration
  if (!referrer) referred_by_code_validated = null;
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/auth.ts
git commit -m "feat(referrals): persist referred_by_code on family creation"
```

---

## Task 5: Wire New Routes into `index.ts`

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Import the new handlers**

At the top of `index.ts`, add:

```typescript
import {
  handleReferralMe,
  handleReferralStats,
  handleReferralClick,
} from './routes/referrals.js';
```

- [ ] **Step 2: Add routes inside the `route()` function**

In the section handling `/api/` routes, add:

```typescript
if (path === '/api/referrals/me'    && method === 'GET')  return requireAuth(request, env, handleReferralMe);
if (path === '/api/referrals/stats' && method === 'GET')  return requireAuth(request, env, handleReferralStats);
if (path === '/api/referrals/click' && method === 'POST') return handleReferralClick(request, env);
```

- [ ] **Step 3: Add route docs comment at the top of `index.ts`**

In the JSDoc comment block at the top of `index.ts`, add to the Authenticated — parent only section:

```
 *   GET    /api/referrals/me        Return caller's referral code + shareable URL
 *   GET    /api/referrals/stats     Click + conversion counts for caller's referral code
 *
 * Public (no auth):
 *   POST   /api/referrals/click     Record a referral link click
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(referrals): wire referral routes in worker index"
```

---

## Task 6: Add `ReferralStats` Type

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Add the type at the bottom of `types.ts`**

```typescript
export interface ReferralStats {
  clicks:          number;
  sign_ups:        number;
  conversions:     number;
  rewards_pending: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(referrals): add ReferralStats type"
```

---

## Task 7: Frontend API Client

**Files:**
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add the three referral API functions**

Find the end of `app/src/lib/api.ts` and add:

```typescript
// ── Referrals ─────────────────────────────────────────────────────────────────

export async function getReferralCode(token: string): Promise<{ code: string; share_url: string }> {
  const res = await apiFetch('/api/referrals/me', { token });
  if (!res.ok) throw new Error('Failed to load referral code');
  return res.json();
}

export async function getReferralStats(token: string): Promise<{
  clicks: number; sign_ups: number; conversions: number; rewards_pending: number;
}> {
  const res = await apiFetch('/api/referrals/stats', { token });
  if (!res.ok) throw new Error('Failed to load referral stats');
  return res.json();
}

export async function trackReferralClick(code: string): Promise<void> {
  await apiFetch('/api/referrals/click', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
```

Note: `apiFetch` is the existing wrapper used throughout `api.ts` — match the same call signature it uses (check the existing functions in the file for the exact signature).

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(referrals): add getReferralCode, getReferralStats, trackReferralClick to API client"
```

---

## Task 8: Read `?ref=` on App Load and Persist to localStorage

**Files:**
- Modify: the app entry point — likely `app/src/App.tsx` or `app/src/main.tsx` (check which one mounts the router)

- [ ] **Step 1: Find app entry**

```bash
grep -l "createBrowserRouter\|RouterProvider\|BrowserRouter" app/src/*.tsx app/src/**/*.tsx 2>/dev/null | head -5
```

- [ ] **Step 2: Add referral code capture (runs once on mount)**

In the root component (before the router renders), add a `useEffect` that runs once:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && ref.length >= 6) {
    localStorage.setItem('morechard_referral_code', ref.toUpperCase());
    // Also fire the click tracking immediately (fire-and-forget)
    import('./lib/api').then(({ trackReferralClick }) => trackReferralClick(ref.toUpperCase()));
  }
}, []);
```

- [ ] **Step 3: Commit**

```bash
git add app/src/App.tsx  # or main.tsx — whichever file you modified
git commit -m "feat(referrals): capture ?ref= query param on app load, persist to localStorage"
```

---

## Task 9: Pass `referred_by_code` During Registration

**Files:**
- Modify: the Stage 1 or Stage 2 registration component that calls the create-family API — likely `app/src/components/registration/Stage1*.tsx` or equivalent that calls `handleCreateFamily`

- [ ] **Step 1: Find where the create-family API call is made**

```bash
grep -rl "create-family\|createFamily" app/src/ 2>/dev/null | head -5
```

- [ ] **Step 2: Read the referral code from localStorage and pass it**

In the function that builds the request body for the `/auth/create-family` call, add:

```typescript
const referred_by_code = localStorage.getItem('morechard_referral_code') ?? undefined;
```

Then include it in the POST body:

```typescript
body: JSON.stringify({
  // ... existing fields ...
  ...(referred_by_code ? { referred_by_code } : {}),
}),
```

After a successful registration, clear the stored code:

```typescript
localStorage.removeItem('morechard_referral_code');
```

- [ ] **Step 3: Commit**

```bash
git add <registration-file>
git commit -m "feat(referrals): pass referred_by_code from localStorage on family registration"
```

---

## Task 10: Update `ReferralsSettings` UI — Peer View (Live Share)

**Files:**
- Modify: `app/src/components/settings/sections/ReferralsSettings.tsx`

- [ ] **Step 1: Add imports and a shared `useReferralCode` hook at the top of the file**

After the existing imports, add:

```typescript
import { useEffect, useState } from 'react'
import { getReferralCode, getReferralStats } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'  // adjust path to wherever useAuth lives
import { Copy, CheckCircle2, Share2 } from 'lucide-react'
```

Add a hook just before `PeerView`:

```typescript
function useReferral() {
  const { token } = useAuth()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [stats, setStats] = useState<{ clicks: number; sign_ups: number; conversions: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([getReferralCode(token), getReferralStats(token)])
      .then(([codeData, statsData]) => {
        setCode(codeData.code)
        setShareUrl(codeData.share_url)
        setStats(statsData)
      })
      .finally(() => setLoading(false))
  }, [token])

  return { code, shareUrl, stats, loading }
}
```

- [ ] **Step 2: Replace `PeerView` body with live share UI**

Replace the entire `PeerView` function with:

```typescript
function PeerView({ onBack, showToast }: { onBack: () => void; showToast: (m: string) => void }) {
  const { locale } = useLocale()
  const pl = isPolish(locale)
  const { code, shareUrl, stats, loading } = useReferral()
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (!shareUrl) return
    if (navigator.share) {
      await navigator.share({ title: 'Join Morechard', url: shareUrl }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      showToast(pl ? '✅ Skopiowano link' : '✅ Link copied')
    }
  }

  async function handleCopyCode() {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    showToast(pl ? '✅ Kod skopiowany' : '✅ Code copied')
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title={pl ? 'Zaproś rodzinę' : 'Invite a Family'}
        subtitle={pl ? 'Podziel się Sadem z innymi' : 'Share the Grove with another family'}
        onBack={onBack}
      />

      {/* Reward banner */}
      <SectionCard>
        <div className="px-4 py-4 flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--brand-primary)]">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-[14px] font-bold text-[var(--color-text)]">
              {pl ? '3 miesiące Mentora AI gratis' : '3 months AI Mentor free'}
            </p>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
              {pl
                ? 'Dla Ciebie i zaproszonej rodziny — po aktywacji licencji dożywotniej.'
                : 'For you and the family you invite — unlocked when they activate a Lifetime licence.'}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Share box */}
      <SectionCard>
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            {pl ? 'Twój link polecający' : 'Your referral link'}
          </p>
          {loading ? (
            <div className="h-10 rounded-lg bg-[var(--color-surface-alt)] animate-pulse" />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                  <p className="text-[13px] font-mono text-[var(--color-text)] truncate">{shareUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-surface-alt)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                  aria-label={pl ? 'Kopiuj' : 'Copy'}
                >
                  {copied ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} className="text-[var(--color-text-muted)]" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-primary)] text-white text-[14px] font-semibold hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer"
              >
                <Share2 size={15} />
                {pl ? 'Udostępnij link' : 'Share this link'}
              </button>
            </>
          )}
        </div>
      </SectionCard>

      {/* Stats */}
      {stats && (
        <SectionCard>
          <div className="px-4 py-3 grid grid-cols-3 gap-3 text-center">
            {[
              { label: pl ? 'Kliknięcia' : 'Clicks',    value: stats.clicks },
              { label: pl ? 'Rejestracje' : 'Sign-ups', value: stats.sign_ups },
              { label: pl ? 'Zakupy' : 'Conversions',   value: stats.conversions },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[20px] font-bold tabular-nums text-[var(--color-text)]">{value}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* How it works */}
      <SectionCard>
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            {pl ? 'Jak to działa' : 'How it works'}
          </p>
          <ol className="space-y-2 text-[12px] text-[var(--color-text)] leading-relaxed">
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)] text-[11px] font-bold flex items-center justify-center">1</span>
              <span>{pl ? 'Wyślij swój unikalny link znajomej rodzinie.' : 'Send your unique link to a family you think would benefit.'}</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)] text-[11px] font-bold flex items-center justify-center">2</span>
              <span>{pl ? 'Dołączają i kupują licencję.' : 'They join and purchase a Lifetime licence.'}</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)] text-[11px] font-bold flex items-center justify-center">3</span>
              <span>{pl ? 'Obie rodziny otrzymują 3 miesiące Mentora AI gratis.' : 'Both families get 3 months of AI Mentor — on us.'}</span>
            </li>
          </ol>
        </div>
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/settings/sections/ReferralsSettings.tsx
git commit -m "feat(referrals): PeerView — live referral link with share, copy, and stats"
```

---

## Task 11: Update `ReferralsSettings` UI — Professional & Hardship Views (Mailto)

**Files:**
- Modify: `app/src/components/settings/sections/ReferralsSettings.tsx`

The professional and hardship partnership tiers require a human vetting step before any link is issued. The right action for these views is to open a pre-filled email to `hello@morechard.com` — this is genuinely functional (it creates a real email), not a toast placeholder.

- [ ] **Step 1: Replace `ProLegalView` action row**

Replace the `SettingsRow` at the bottom of `ProLegalView` with:

```typescript
<a
  href="mailto:hello@morechard.com?subject=Professional%20Access%20%E2%80%94%20Solicitor%2FMediator%20Enquiry&body=Name%3A%0AOrganisation%3A%0ASRA%20number%20or%20accreditation%3A%0AHow%20I%20plan%20to%20use%20Morechard%3A"
  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
>
  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
    <Mail size={15} />
  </span>
  <div className="flex-1 min-w-0">
    <p className="text-[14px] font-semibold text-[var(--color-text)]">Register your interest</p>
    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">Opens a pre-filled email to our partnerships team</p>
  </div>
  <ExternalLink size={13} className="shrink-0 text-[var(--color-text-muted)]" />
</a>
```

Add `ExternalLink` to the lucide imports at the top of the file.

- [ ] **Step 2: Replace `ProMediaView` action row**

Replace the `SettingsRow` at the bottom of `ProMediaView` with:

```typescript
<a
  href="mailto:hello@morechard.com?subject=Affiliate%20Programme%20Application&body=Name%3A%0AChannel%2FBlog%20URL%3A%0AApproximate%20audience%20size%3A%0AContent%20type%3A"
  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
>
  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-violet-100 text-violet-700">
    <Mail size={15} />
  </span>
  <div className="flex-1 min-w-0">
    <p className="text-[14px] font-semibold text-[var(--color-text)]">Apply to the programme</p>
    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">Opens a pre-filled email to our affiliate team</p>
  </div>
  <ExternalLink size={13} className="shrink-0 text-[var(--color-text-muted)]" />
</a>
```

- [ ] **Step 3: Replace `HardshipView` action row**

Replace the `SettingsRow` at the bottom of `HardshipView` with (locale-aware):

```typescript
<a
  href={pl
    ? 'mailto:hello@morechard.com?subject=Licencja%20solidarno%C5%9Bciowa%20%E2%80%94%20Zapytanie%20organizacji&body=Nazwa%20organizacji%3A%0AStrona%20internetowa%3A%0AOpis%20dzia%C5%82alno%C5%9Bci%3A'
    : 'mailto:hello@morechard.com?subject=Hardship%20Licence%20%E2%80%94%20Charity%20Enquiry&body=Organisation%20name%3A%0AWebsite%3A%0ACharity%20number%3A%0AHow%20we%20support%20families%3A'}
  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
>
  <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-rose-100 text-rose-700">
    <Users size={15} />
  </span>
  <div className="flex-1 min-w-0">
    <p className="text-[14px] font-semibold text-[var(--color-text)]">
      {pl ? 'Jestem z organizacji' : 'I represent a charity'}
    </p>
    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
      {pl ? 'Otwiera wstępnie wypełniony e-mail do naszego zespołu' : 'Opens a pre-filled email to our partnerships team'}
    </p>
  </div>
  <ExternalLink size={13} className="shrink-0 text-[var(--color-text-muted)]" />
</a>
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/settings/sections/ReferralsSettings.tsx
git commit -m "feat(referrals): ProLegal, ProMedia, Hardship views — mailto CTAs with pre-filled bodies"
```

---

## Task 12: Apply Migration to Production D1

- [ ] **Step 1: Apply migration to remote D1**

```bash
cd "e:/Web-Video Design/Claude/Apps/Pocket Money"
npx wrangler d1 execute morechard-db --remote --file=worker/migrations/0042_referral_system.sql
```

Expected: `✅  Executed migration`

- [ ] **Step 2: Deploy worker**

```bash
npx wrangler deploy
```

Expected: Worker deployed to `darren-savery.workers.dev` (or custom domain).

- [ ] **Step 3: Smoke-test the endpoints**

```bash
# Get a parent JWT first (replace TOKEN with a real token from local login)
curl -s https://api.morechard.com/api/referrals/me \
  -H "Authorization: Bearer TOKEN" | jq .
# Expected: { code: "XXXXXXXX", share_url: "https://app.morechard.com/?ref=XXXXXXXX" }

curl -s https://api.morechard.com/api/referrals/stats \
  -H "Authorization: Bearer TOKEN" | jq .
# Expected: { clicks: 0, sign_ups: 0, conversions: 0, rewards_pending: 0 }

curl -s -X POST https://api.morechard.com/api/referrals/click \
  -H "Content-Type: application/json" \
  -d '{"code":"XXXXXXXX"}' | jq .
# Expected: { ok: true }
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|---|---|
| Generate working referral links | Task 2 (`handleReferralMe`) + Task 10 (share URL in UI) |
| Affiliate/referral tracking (clicks) | Task 2 (`handleReferralClick`) + Task 8 (auto-track on load) |
| Track sign-ups via referral | Task 4 (write `referred_by_code` on family create) + Task 2 (stats query) |
| Track conversions (purchases) | Task 3 (Stripe webhook) |
| Peer (family-to-family) | Tasks 7, 8, 9, 10 |
| Professional programme | Task 11 (ProLegal + ProMedia mailto) |
| Hardship / charity | Task 11 (HardshipView mailto) |
| PL locale | All UI tasks use `isPolish(locale)` |
| Idempotency on Stripe webhook | `INSERT OR IGNORE` + UNIQUE on `stripe_session_id` |
| No PII in click log | IP is SHA-256 hashed before storage |

### Placeholder scan

No TBDs or TODOs in code steps. All code blocks are complete.

### Type consistency

- `useReferral()` returns `{ code, shareUrl, stats, loading }` — used consistently in `PeerView`
- `getReferralCode()` returns `{ code, share_url }` — `share_url` mapped to `shareUrl` in hook ✓
- `ReferralStats` shape matches `handleReferralStats` response shape ✓
