# Coming Soon Marketing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static coming-soon marketing page at `morechard.com` with a Brevo-backed interest signup form, plus a thin worker endpoint to proxy the Brevo API call.

**Architecture:** Pure static HTML/CSS/JS page in `marketing/index.html` (no build step, no framework). A new public worker endpoint `POST /api/public/interest` receives the form submission, validates it, and calls the Brevo contacts API server-side so the API key stays secret. The page is deployed as a second Cloudflare Pages project; the endpoint lives in the existing worker.

**Tech Stack:** HTML5, CSS custom properties, vanilla JS (no dependencies), Cloudflare Worker (TypeScript), Brevo Contacts API v3, Google Fonts (Playfair Display + DM Sans)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `marketing/index.html` | Entire coming-soon page: HTML + `<style>` + `<script>` |
| Create | `worker/src/routes/public-interest.ts` | `POST /api/public/interest` — validate + call Brevo |
| Modify | `worker/src/types.ts` | Add `BREVO_API_KEY` to `Env` interface |
| Modify | `worker/src/index.ts` | Register new public route before auth middleware |

---

## Task 1: Add `BREVO_API_KEY` to the Worker `Env` type

**Files:**
- Modify: `worker/src/types.ts`

- [ ] **Step 1: Open `worker/src/types.ts` and add the new env var**

The `Env` interface currently ends with `FRESHDESK_SSO_SECRET`. Add `BREVO_API_KEY` after it:

```typescript
export interface Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
  RECEIPTS: R2Bucket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AI: any;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  APP_URL: string;
  WORKER_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SHIELD_PRODUCT_ID: string;
  FIREBASE_PROJECT_ID: string;
  GOOGLE_CLIENT_ID:     string;
  GOOGLE_CLIENT_SECRET: string;
  POSTHOG_API_KEY:      string;
  POSTHOG_HOST:         string;
  OPENAI_API_KEY:        string;
  FRESHDESK_SSO_SECRET:  string;
  BREVO_API_KEY:         string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(worker): add BREVO_API_KEY to Env type"
```

---

## Task 2: Create the `POST /api/public/interest` worker endpoint

**Files:**
- Create: `worker/src/routes/public-interest.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Env } from '../types.js'
import { json, error, clientIp } from '../lib/response.js'

// Simple in-memory rate limiter: 1 submission per IP per 60 seconds.
// Resets on worker restart (cold start) — acceptable for a low-traffic promo page.
const recentIps = new Map<string, number>()

function isRateLimited(ip: string): boolean {
  const last = recentIps.get(ip)
  const now = Date.now()
  if (last && now - last < 60_000) return true
  recentIps.set(ip, now)
  // Prune map to prevent unbounded growth
  if (recentIps.size > 10_000) {
    const cutoff = now - 60_000
    for (const [k, v] of recentIps) {
      if (v < cutoff) recentIps.delete(k)
    }
  }
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function handlePublicInterest(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request)

  if (isRateLimited(ip)) {
    return error('Too many requests — please wait a moment', 429)
  }

  let body: { email?: unknown; consent?: unknown }
  try {
    body = await request.json()
  } catch {
    return error('Invalid JSON', 400)
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return error('A valid email address is required', 400)
  }

  if (body.consent !== true) {
    return error('Consent is required', 400)
  }

  const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      email,
      listIds: [4],
      attributes: { SOURCE: 'morechard.com-prelaunch' },
      updateEnabled: true,
    }),
  })

  // Brevo returns 201 for new contacts, 204 for existing (updateEnabled)
  if (brevoRes.status === 201 || brevoRes.status === 204) {
    return json({ ok: true })
  }

  // Log the failure detail for debugging without leaking it to the client
  const detail = await brevoRes.text().catch(() => '(no body)')
  console.error(`Brevo error ${brevoRes.status}: ${detail}`)
  return error('Failed to register interest', 500)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/public-interest.ts
git commit -m "feat(worker): add POST /api/public/interest → Brevo proxy"
```

---

## Task 3: Register the new route in `worker/src/index.ts`

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add import at the top of the imports block**

Find the line:
```typescript
import { handleConsentPost, handleConsentGet } from './routes/consent.js';
```

Add below it:
```typescript
import { handlePublicInterest } from './routes/public-interest.js';
```

- [ ] **Step 2: Register the route in the `route()` function's public section**

Find the block of public routes near line 387–391 (the referral click + demo register lines):
```typescript
  // Demo registration — public (professional path, no existing account)
  if (path === '/auth/demo/register' && method === 'POST') return handleDemoRegister(request, env);
```

Add directly after that line (before the `requireAuth` call):
```typescript
  // Pre-launch interest registration — public, no auth
  if (path === '/api/public/interest' && method === 'POST') return handlePublicInterest(request, env);
```

- [ ] **Step 3: Update the route comment block at the top of the file**

Find the "Public (no auth):" section near line 55–61. Add:
```
 *   POST   /api/public/interest         Register pre-launch interest → Brevo list 4
```

- [ ] **Step 4: Verify TypeScript compiles and test locally**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test the endpoint locally**

Start the worker dev server:
```bash
cd worker && npx wrangler dev
```

In a second terminal:
```bash
curl -s -X POST http://localhost:8787/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","consent":true}' | jq
```

Expected (Brevo call will fail locally without a real key — that's fine):
```json
{ "error": "Failed to register interest" }
```

Test validation rejects:
```bash
# Missing consent
curl -s -X POST http://localhost:8787/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","consent":false}' | jq
# Expected: { "error": "Consent is required" }

# Bad email
curl -s -X POST http://localhost:8787/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail","consent":true}' | jq
# Expected: { "error": "A valid email address is required" }
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register POST /api/public/interest route"
```

---

## Task 4: Build `marketing/index.html` — the coming-soon page

**Files:**
- Create: `marketing/index.html`

This is the full production page. Build it in one pass — HTML structure first, then styles, then JS.

- [ ] **Step 1: Create `marketing/` directory and `index.html`**

```bash
mkdir marketing
```

Create `marketing/index.html` with the complete page below. This is a single self-contained file — all CSS in a `<style>` block, all JS in a `<script>` block at the bottom.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Morechard — Coming Soon</title>
  <meta name="description" content="The chore tracker for any family — with real financial literacy built in and a tamper-proof record underneath. Coming soon." />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

  <style>
    /* ── Reset & Variables ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --parchment:    #f9f7f2;
      --parchment-d:  #f0ece2;
      --teal:         #00959c;
      --teal-dark:    #007a80;
      --gold:         #e6b222;
      --gold-dark:    #c99b1a;
      --canopy:       #1b2d2e;
      --canopy-light: #2d4a4b;
      --canopy-faint: #3a5a5b;
      --text:         #1b2d2e;
      --text-muted:   #5a7475;
      --white:        #ffffff;
      --radius:       12px;
      --radius-sm:    8px;
      --font-display: 'Playfair Display', Georgia, serif;
      --font-body:    'DM Sans', system-ui, sans-serif;
      --shadow-sm:    0 2px 8px rgba(27,45,46,0.08);
      --shadow-md:    0 4px 20px rgba(27,45,46,0.12);
      --shadow-lg:    0 8px 40px rgba(27,45,46,0.16);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--font-body);
      background: var(--parchment);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Grain texture overlay ── */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
    }

    /* ── Scroll reveal ── */
    .reveal {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .reveal-delay-1 { transition-delay: 0.1s; }
    .reveal-delay-2 { transition-delay: 0.2s; }
    .reveal-delay-3 { transition-delay: 0.3s; }
    .reveal-delay-4 { transition-delay: 0.4s; }

    /* ── Nav ── */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--parchment);
      border-bottom: 1px solid transparent;
      padding: 0 max(24px, calc((100vw - 1100px) / 2));
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    nav.scrolled {
      border-color: rgba(27,45,46,0.1);
      box-shadow: var(--shadow-sm);
    }

    .nav-wordmark {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.5rem;
      color: var(--canopy);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .nav-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--teal);
      color: var(--white);
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.875rem;
      padding: 10px 20px;
      border-radius: var(--radius-sm);
      text-decoration: none;
      transition: background 0.2s, transform 0.15s;
    }
    .nav-cta:hover { background: var(--teal-dark); transform: translateY(-1px); }

    /* ── Container ── */
    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* ── Section shared ── */
    section { padding: 96px 0; position: relative; z-index: 1; }
    section:nth-child(even) { background: var(--parchment-d); }

    .section-label {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--teal);
      margin-bottom: 16px;
    }

    .section-headline {
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 800;
      color: var(--canopy);
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
    }

    .section-sub {
      font-size: 1.125rem;
      color: var(--text-muted);
      max-width: 560px;
      line-height: 1.7;
    }

    /* ── Hero ── */
    #hero {
      min-height: 90vh;
      display: flex;
      align-items: center;
      padding: 80px 0;
      overflow: hidden;
      position: relative;
    }

    /* Large M watermark */
    #hero::after {
      content: 'M';
      position: absolute;
      right: -2%;
      top: 50%;
      transform: translateY(-50%);
      font-family: var(--font-display);
      font-size: clamp(300px, 40vw, 600px);
      font-weight: 800;
      color: var(--canopy);
      opacity: 0.035;
      line-height: 1;
      pointer-events: none;
      user-select: none;
    }

    .hero-inner {
      max-width: 720px;
      position: relative;
      z-index: 2;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(230, 178, 34, 0.15);
      border: 1px solid rgba(230, 178, 34, 0.4);
      color: var(--gold-dark);
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 100px;
      margin-bottom: 28px;
    }

    .hero-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gold);
      animation: pulse 2s ease infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .hero-headline {
      font-family: var(--font-display);
      font-size: clamp(2.8rem, 6vw, 5rem);
      font-weight: 800;
      color: var(--canopy);
      line-height: 1.05;
      letter-spacing: -0.03em;
      margin-bottom: 24px;
    }

    .hero-headline em {
      font-style: italic;
      color: var(--teal);
    }

    .hero-subhead {
      font-size: clamp(1.1rem, 2vw, 1.3rem);
      color: var(--text-muted);
      line-height: 1.65;
      margin-bottom: 40px;
      max-width: 580px;
    }

    .hero-cta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: var(--teal);
      color: var(--white);
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 1.05rem;
      padding: 16px 32px;
      border-radius: var(--radius);
      text-decoration: none;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
      box-shadow: 0 4px 16px rgba(0, 149, 156, 0.3);
    }
    .hero-cta:hover {
      background: var(--teal-dark);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 149, 156, 0.4);
    }
    .hero-cta svg { transition: transform 0.2s; }
    .hero-cta:hover svg { transform: translateX(4px); }

    /* ── Pillar Cards ── */
    .card-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 56px;
    }

    .pillar-card {
      background: var(--white);
      border-radius: var(--radius);
      padding: 32px 28px;
      box-shadow: var(--shadow-sm);
      border-top: 3px solid var(--teal);
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .pillar-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-3px);
    }

    .pillar-icon {
      width: 44px;
      height: 44px;
      background: rgba(0,149,156,0.1);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      color: var(--teal);
    }

    .pillar-title {
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--canopy);
      margin-bottom: 10px;
    }

    .pillar-body {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.65;
    }

    /* ── Audience Cards ── */
    .audience-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 56px;
    }

    .audience-card {
      border-radius: var(--radius);
      padding: 40px 36px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .audience-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    .audience-card.primary {
      background: var(--white);
      border: 1px solid rgba(27,45,46,0.08);
    }

    .audience-card.secondary {
      background: var(--canopy);
      color: var(--white);
    }

    .audience-tag {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 100px;
      margin-bottom: 20px;
    }

    .audience-card.primary .audience-tag {
      background: rgba(0,149,156,0.1);
      color: var(--teal);
    }

    .audience-card.secondary .audience-tag {
      background: rgba(230,178,34,0.2);
      color: var(--gold);
    }

    .audience-title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 14px;
      line-height: 1.2;
    }

    .audience-card.secondary .audience-title { color: var(--white); }
    .audience-card.primary .audience-title { color: var(--canopy); }

    .audience-body {
      font-size: 0.95rem;
      line-height: 1.7;
    }
    .audience-card.primary .audience-body { color: var(--text-muted); }
    .audience-card.secondary .audience-body { color: rgba(255,255,255,0.75); }

    .audience-points {
      list-style: none;
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .audience-points li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.875rem;
    }

    .audience-card.primary .audience-points li { color: var(--text-muted); }
    .audience-card.secondary .audience-points li { color: rgba(255,255,255,0.8); }

    .check-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }
    .audience-card.primary .check-icon { background: rgba(0,149,156,0.12); color: var(--teal); }
    .audience-card.secondary .check-icon { background: rgba(230,178,34,0.2); color: var(--gold); }

    /* ── Differentiation Strip ── */
    .diff-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 56px;
    }

    .diff-tile {
      background: var(--white);
      border-radius: var(--radius);
      padding: 28px 24px;
      display: flex;
      gap: 18px;
      align-items: flex-start;
      box-shadow: var(--shadow-sm);
      border-left: 3px solid var(--teal);
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .diff-tile:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

    .diff-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      background: rgba(0,149,156,0.1);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--teal);
    }

    .diff-content {}
    .diff-label {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--canopy);
      margin-bottom: 4px;
    }
    .diff-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }

    /* ── Pricing ── */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 56px;
      align-items: start;
    }

    .plan-card {
      background: var(--white);
      border-radius: var(--radius);
      padding: 32px 28px;
      box-shadow: var(--shadow-sm);
      border: 1px solid rgba(27,45,46,0.08);
      position: relative;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .plan-card:hover { box-shadow: var(--shadow-md); transform: translateY(-3px); }

    .plan-card.featured {
      border: 2px solid var(--teal);
      box-shadow: var(--shadow-md);
    }

    .plan-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--gold);
      color: var(--canopy);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 100px;
      white-space: nowrap;
    }

    .plan-name {
      font-family: var(--font-display);
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--canopy);
      margin-bottom: 8px;
    }

    .plan-price {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 4px;
    }

    .plan-price-currency { font-size: 1.4rem; font-weight: 600; color: var(--canopy); }
    .plan-price-amount { font-family: var(--font-display); font-size: 3rem; font-weight: 800; color: var(--canopy); line-height: 1; }
    .plan-price-label { font-size: 0.8rem; color: var(--text-muted); }
    .plan-one-time { font-size: 0.8rem; color: var(--teal); font-weight: 600; margin-bottom: 24px; }

    .plan-divider { border: none; border-top: 1px solid rgba(27,45,46,0.08); margin: 20px 0; }

    .plan-features {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .plan-features li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .plan-check {
      flex-shrink: 0;
      color: var(--teal);
      margin-top: 1px;
    }

    /* ── Interest Form ── */
    #signup {
      background: var(--canopy);
      color: var(--white);
    }

    #signup .section-headline { color: var(--white); }
    #signup .section-sub { color: rgba(255,255,255,0.65); }
    #signup .section-label { color: var(--gold); }

    .form-wrap {
      max-width: 560px;
      margin-top: 48px;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .form-input {
      flex: 1;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: var(--radius-sm);
      padding: 14px 18px;
      font-family: var(--font-body);
      font-size: 1rem;
      color: var(--white);
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .form-input::placeholder { color: rgba(255,255,255,0.4); }
    .form-input:focus {
      border-color: var(--teal);
      background: rgba(255,255,255,0.12);
    }
    .form-input.error { border-color: #e05252; }

    .form-submit {
      flex-shrink: 0;
      background: var(--teal);
      color: var(--white);
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 1rem;
      padding: 14px 28px;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      transition: background 0.2s, transform 0.15s;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 130px;
      justify-content: center;
    }
    .form-submit:hover:not(:disabled) { background: var(--teal-dark); transform: translateY(-1px); }
    .form-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .form-consent {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 16px;
    }

    .form-consent input[type="checkbox"] {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 2px;
      accent-color: var(--teal);
      cursor: pointer;
    }

    .form-consent label {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.65);
      line-height: 1.5;
      cursor: pointer;
    }

    .form-gdpr {
      margin-top: 20px;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.35);
      line-height: 1.6;
    }

    .form-gdpr a { color: rgba(255,255,255,0.5); text-decoration: underline; }

    .form-error {
      margin-top: 12px;
      font-size: 0.875rem;
      color: #ff8a8a;
      display: none;
    }
    .form-error.visible { display: block; }

    .form-success {
      display: none;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      margin-top: 48px;
    }
    .form-success.visible { display: flex; }

    .success-icon {
      width: 52px;
      height: 52px;
      background: rgba(0,149,156,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--teal);
    }

    .success-text {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--white);
    }

    .success-sub { font-size: 0.9rem; color: rgba(255,255,255,0.55); }

    /* Spinner */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: var(--white);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* ── Footer ── */
    footer {
      background: var(--canopy);
      border-top: 1px solid rgba(255,255,255,0.07);
      padding: 40px 24px;
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .footer-wordmark {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.3rem;
      color: rgba(255,255,255,0.85);
      display: block;
      margin-bottom: 16px;
      text-decoration: none;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .footer-links a {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.4);
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-links a:hover { color: rgba(255,255,255,0.75); }

    .footer-copy {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.25);
      line-height: 1.6;
    }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .card-grid-3 { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; max-width: 480px; margin-left: auto; margin-right: auto; }
    }

    @media (max-width: 720px) {
      section { padding: 64px 0; }
      .audience-grid { grid-template-columns: 1fr; }
      .diff-grid { grid-template-columns: 1fr; }
      .form-row { flex-direction: column; }
      .form-submit { width: 100%; }
    }

    @media (max-width: 480px) {
      nav { padding: 0 16px; }
      .container { padding: 0 16px; }
      .hero-headline { font-size: 2.4rem; }
    }
  </style>
</head>
<body>

  <!-- ── Nav ── -->
  <nav id="nav">
    <a class="nav-wordmark" href="#">Morechard</a>
    <a class="nav-cta" href="#signup">
      Register interest
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  </nav>

  <!-- ── Hero ── -->
  <section id="hero">
    <div class="container">
      <div class="hero-inner">
        <div class="hero-badge reveal">Coming Soon</div>
        <h1 class="hero-headline reveal reveal-delay-1">
          The chore tracker<br /><em>for any family.</em>
        </h1>
        <p class="hero-subhead reveal reveal-delay-2">
          Assign, approve, and pay — with financial literacy built in
          and a tamper-proof record underneath.
        </p>
        <a href="#signup" class="hero-cta reveal reveal-delay-3">
          Register my interest
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  </section>

  <!-- ── What is Morechard ── -->
  <section id="what">
    <div class="container">
      <span class="section-label reveal">What is Morechard</span>
      <h2 class="section-headline reveal">Everything a family needs.<br />Nothing they don't.</h2>
      <p class="section-sub reveal">Three pillars — working together from day one. No debit card. No bank account required.</p>

      <div class="card-grid-3">
        <div class="pillar-card reveal reveal-delay-1">
          <div class="pillar-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 11l5 5L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="pillar-title">Chore Tracker</div>
          <p class="pillar-body">Assign jobs. Mark them done. Approve and pay. Pocket money updates automatically — no bank account required.</p>
        </div>

        <div class="pillar-card reveal reveal-delay-2">
          <div class="pillar-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <path d="M11 7v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="pillar-title">Real-Data Literacy</div>
          <p class="pillar-body">Financial lessons triggered by your child's own earning and spending — not generic slides. Lessons land at exactly the right moment.</p>
        </div>

        <div class="pillar-card reveal reveal-delay-3">
          <div class="pillar-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="4" y="3" width="14" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M8 7h6M8 11h6M8 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="pillar-title">Truth Engine</div>
          <p class="pillar-body">Every transaction is SHA-256 hashed. Tamper-proof records — and one-click court-ready PDF exports when separated families need them.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Who It's For ── -->
  <section id="who">
    <div class="container">
      <span class="section-label reveal">Who it's for</span>
      <h2 class="section-headline reveal">Built for real families.</h2>

      <div class="audience-grid">
        <div class="audience-card primary reveal reveal-delay-1">
          <span class="audience-tag">Any household</span>
          <div class="audience-title">Any family, from day one</div>
          <p class="audience-body">Nuclear families, single parents, blended households. Morechard works on day one for every family structure — simple, fair, and always in sync.</p>
          <ul class="audience-points">
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              No debit card or bank account required
            </li>
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Financial literacy woven into everyday chores
            </li>
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              One-time payment — own it forever
            </li>
          </ul>
        </div>

        <div class="audience-card secondary reveal reveal-delay-2">
          <span class="audience-tag">Separated &amp; co-parenting</span>
          <div class="audience-title">Two households. One source of truth.</div>
          <p class="audience-body">Your data. Your evidence. Your life — owned by you, not rented from us. An immutable shared record that protects both parents.</p>
          <ul class="audience-points">
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Cryptographic SHA-256 hashing on every entry
            </li>
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Court-ready PDF exports — one click
            </li>
            <li>
              <span class="check-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              No disputes about who paid what
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Differentiation ── -->
  <section id="different">
    <div class="container">
      <span class="section-label reveal">Why Morechard</span>
      <h2 class="section-headline reveal">Built differently from the start.</h2>
      <p class="section-sub reveal">Other apps need a debit card. Others charge monthly. None of them serve separated families. Morechard was built to be different.</p>

      <div class="diff-grid">
        <div class="diff-tile reveal reveal-delay-1">
          <div class="diff-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.8"/>
              <path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="diff-content">
            <div class="diff-label">No debit card required</div>
            <div class="diff-desc">Works for any family from day one. RoosterMoney and GoHenry need a card — Morechard doesn't.</div>
          </div>
        </div>

        <div class="diff-tile reveal reveal-delay-2">
          <div class="diff-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 10h14M10 3v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="diff-content">
            <div class="diff-label">One-time payment — own it forever</div>
            <div class="diff-desc">No £3.99/mo trap. No cancellation anxiety. Pay once and it's yours for life.</div>
          </div>
        </div>

        <div class="diff-tile reveal reveal-delay-3">
          <div class="diff-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/>
              <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="diff-content">
            <div class="diff-label">Court-ready records</div>
            <div class="diff-desc">SHA-256 hashed, cryptographically verifiable PDF exports. OurFamilyWizard and AppClose don't offer this for children's finances.</div>
          </div>
        </div>

        <div class="diff-tile reveal reveal-delay-4">
          <div class="diff-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 15c0-4 2.5-6 6-6s6 2 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="10" cy="6" r="3" stroke="currentColor" stroke-width="1.8"/>
            </svg>
          </div>
          <div class="diff-content">
            <div class="diff-label">Real-data lessons — not generic slides</div>
            <div class="diff-desc">Financial literacy triggered by your child's actual earning and spending. Gimi and GoHenry offer generic content; Morechard responds to real behaviour.</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Pricing ── -->
  <section id="pricing">
    <div class="container">
      <span class="section-label reveal">Pricing</span>
      <h2 class="section-headline reveal">Own it. No subscription, ever.</h2>
      <p class="section-sub reveal">One-time payment — yours for life. No renewal reminders. No price hikes. No cancellations.</p>

      <div class="pricing-grid">
        <div class="plan-card reveal reveal-delay-1">
          <div class="plan-name">Core</div>
          <div class="plan-price">
            <span class="plan-price-currency">£</span>
            <span class="plan-price-amount">44</span>
            <span class="plan-price-label">.99</span>
          </div>
          <div class="plan-one-time">One-time payment</div>
          <hr class="plan-divider" />
          <ul class="plan-features">
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Chore tracker &amp; approval flow</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Immutable SHA-256 ledger</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>PDF export</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>14-day full-access trial</li>
          </ul>
        </div>

        <div class="plan-card featured reveal reveal-delay-2">
          <div class="plan-badge">Most Popular</div>
          <div class="plan-name">Core AI</div>
          <div class="plan-price">
            <span class="plan-price-currency">£</span>
            <span class="plan-price-amount">64</span>
            <span class="plan-price-label">.99</span>
          </div>
          <div class="plan-one-time">One-time payment</div>
          <hr class="plan-divider" />
          <ul class="plan-features">
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Everything in Core</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>AI Mentor coaching</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Weekly parent insights</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Financial literacy modules</li>
          </ul>
        </div>

        <div class="plan-card reveal reveal-delay-3">
          <div class="plan-name">Shield</div>
          <div class="plan-price">
            <span class="plan-price-currency">£</span>
            <span class="plan-price-amount">149</span>
            <span class="plan-price-label">.99</span>
          </div>
          <div class="plan-one-time">One-time payment</div>
          <hr class="plan-divider" />
          <ul class="plan-features">
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Everything in Core AI</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Forensic-grade PDF export</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Legal integrity bundle</li>
            <li><span class="plan-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Court-admissible records</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Register Interest ── -->
  <section id="signup">
    <div class="container">
      <span class="section-label reveal">Early access</span>
      <h2 class="section-headline reveal">Be the first to know<br />when Morechard launches.</h2>
      <p class="section-sub reveal">No spam. Just a single email when we open the doors.</p>

      <div class="form-wrap">
        <form id="interest-form">
          <div class="form-row">
            <input
              type="email"
              id="email-input"
              class="form-input"
              placeholder="your@email.com"
              autocomplete="email"
              required
            />
            <button type="submit" id="submit-btn" class="form-submit" disabled>
              <span id="btn-label">Notify me</span>
            </button>
          </div>

          <label class="form-consent">
            <input type="checkbox" id="consent-check" />
            <span>Yes — Morechard can send me product updates, launch news, and offers by email. I can unsubscribe at any time.</span>
          </label>

          <div class="form-error" id="form-error"></div>

          <p class="form-gdpr">
            Your email is stored securely with Brevo. We won't share it with third parties.
            You can withdraw consent at any time by emailing
            <a href="mailto:hello@morechard.com">hello@morechard.com</a>.
            By submitting, you confirm you are 16 or older.
          </p>
        </form>

        <div class="form-success" id="form-success">
          <div class="success-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="success-text">You're on the list.</div>
          <div class="success-sub">We'll send you one email when Morechard is ready to launch. That's it.</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Footer ── -->
  <footer>
    <a class="footer-wordmark" href="#">Morechard</a>
    <nav class="footer-links">
      <a href="https://app.morechard.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>
      <a href="https://app.morechard.com/terms" target="_blank" rel="noopener">Terms of Use</a>
      <a href="mailto:hello@morechard.com">Contact</a>
    </nav>
    <p class="footer-copy">
      App launching soon at <a href="https://app.morechard.com" style="color:rgba(255,255,255,0.4);text-decoration:underline;">app.morechard.com</a><br />
      &copy; 2026 Morechard. All rights reserved.
    </p>
  </footer>

  <script>
    // ── Scroll-reveal ──
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // ── Nav scroll shadow ──
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // ── Form logic ──
    const form        = document.getElementById('interest-form');
    const emailInput  = document.getElementById('email-input');
    const consentBox  = document.getElementById('consent-check');
    const submitBtn   = document.getElementById('submit-btn');
    const btnLabel    = document.getElementById('btn-label');
    const formError   = document.getElementById('form-error');
    const formSuccess = document.getElementById('form-success');

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function updateSubmitState() {
      const emailOk   = EMAIL_RE.test(emailInput.value.trim());
      const consentOk = consentBox.checked;
      submitBtn.disabled = !(emailOk && consentOk);
    }

    emailInput.addEventListener('input', updateSubmitState);
    consentBox.addEventListener('change', updateSubmitState);

    function showError(msg) {
      formError.textContent = msg;
      formError.classList.add('visible');
    }

    function clearError() {
      formError.classList.remove('visible');
    }

    function setLoading(loading) {
      if (loading) {
        btnLabel.innerHTML = '<span class="spinner"></span>';
        submitBtn.disabled = true;
      } else {
        btnLabel.textContent = 'Notify me';
        updateSubmitState();
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const email = emailInput.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        showError('Please enter a valid email address.');
        emailInput.classList.add('error');
        return;
      }
      emailInput.classList.remove('error');

      setLoading(true);

      try {
        const res = await fetch('https://darren-savery.workers.dev/api/public/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, consent: true }),
        });

        if (res.ok) {
          form.style.display = 'none';
          formSuccess.classList.add('visible');
        } else {
          const data = await res.json().catch(() => ({}));
          showError(data.error || 'Something went wrong — please try again.');
          setLoading(false);
        }
      } catch {
        showError('Something went wrong — please check your connection and try again.');
        setLoading(false);
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Open `marketing/index.html` in a browser and verify visually**

Open the file directly in your browser (`file:///.../marketing/index.html`). Check:
- Hero section renders with large `M` watermark visible
- All 7 sections display correctly
- 3 pillar cards appear in a row on desktop
- Pricing shows 3 cards with Core AI having a "Most Popular" badge
- Form submit button is disabled until email + consent checkbox are both filled
- Scroll-reveal animations trigger as you scroll down

- [ ] **Step 3: Test form validation in the browser (no real API key needed)**

1. Type an invalid email → submit button should stay disabled
2. Check the consent box without an email → button stays disabled
3. Fill in a valid email + check consent → button becomes active
4. Submit → expect a "Something went wrong" error (worker not deployed yet) — this is correct behaviour

- [ ] **Step 4: Commit**

```bash
git add marketing/index.html
git commit -m "feat(marketing): add coming-soon page — morechard.com"
```

---

## Task 5: Set the Brevo API key as a worker secret and deploy

**Files:** No code changes — infrastructure only.

- [ ] **Step 1: Set the Brevo API key as a Cloudflare Worker secret**

```bash
cd worker && npx wrangler secret put BREVO_API_KEY
```

When prompted, paste your Brevo API key (found in Brevo dashboard → Settings → API Keys).

Expected output:
```
✔ Success! Uploaded secret BREVO_API_KEY.
```

- [ ] **Step 2: Deploy the worker**

```bash
cd worker && npx wrangler deploy
```

Expected: deployment succeeds, worker URL shown.

- [ ] **Step 3: Smoke-test the live endpoint**

```bash
curl -s -X POST https://darren-savery.workers.dev/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"test-prelaunch@morechard.com","consent":true}' | jq
```

Expected:
```json
{ "ok": true }
```

Then log in to Brevo → Contacts → filter by list "4" — confirm `test-prelaunch@morechard.com` appears with `SOURCE = morechard.com-prelaunch`.

- [ ] **Step 4: Verify validation rejects**

```bash
# No consent
curl -s -X POST https://darren-savery.workers.dev/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","consent":false}' | jq
# Expected: { "error": "Consent is required" }

# Bad email
curl -s -X POST https://darren-savery.workers.dev/api/public/interest \
  -H "Content-Type: application/json" \
  -d '{"email":"notvalid","consent":true}' | jq
# Expected: { "error": "A valid email address is required" }
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): deploy public interest endpoint with Brevo integration"
```

---

## Task 6: End-to-end form test in the browser

**Files:** No code changes.

- [ ] **Step 1: Open `marketing/index.html` locally**

The form's `fetch` URL points to `https://darren-savery.workers.dev/api/public/interest` (live worker). Open the file in a browser.

- [ ] **Step 2: Submit a test email through the form**

Fill in a real email address + check consent → click "Notify me".

Expected:
- Button shows spinner while submitting
- Form is replaced by the success state ("You're on the list.")
- In Brevo, the email appears in list 4 within ~30 seconds

- [ ] **Step 3: Test the rate limiter**

Refresh the page, submit the same email again within 60 seconds from the same IP.

Expected: `{ "error": "Too many requests — please wait a moment" }` shown in the form error area.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: coming-soon marketing page complete — morechard.com"
```

---

## Task 7: Set up the Cloudflare Pages project for `morechard.com` (manual)

This task cannot be automated — it requires the Cloudflare dashboard.

- [ ] **Step 1: Create a new Pages project**

1. Go to [Cloudflare Pages dashboard](https://dash.cloudflare.com) → Pages → **Create a project**
2. Connect your GitHub repo
3. Set **Root directory** to `marketing`
4. **Build command:** *(leave empty)*
5. **Build output directory:** `marketing`
6. Click **Save and Deploy**

- [ ] **Step 2: Add the custom domain**

In the new Pages project → **Custom domains** → **Set up a custom domain** → enter `morechard.com`.

Follow the DNS instructions (add a CNAME or change nameservers as directed by Cloudflare).

- [ ] **Step 3: Verify deployment**

Visit `https://morechard.com` in an incognito window. Confirm:
- Page loads with the coming-soon design
- Form submits correctly (use a fresh test email)
- All sections visible, animations work

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Static HTML page in `marketing/` | Task 4 |
| Playfair Display + DM Sans fonts | Task 4 |
| Hero with badge, headline, M watermark, grain texture | Task 4 |
| 3-pillar cards (Chore Tracker / Literacy / Truth Engine) | Task 4 |
| Two audience cards (Any family / Co-parenting) | Task 4 |
| 4 differentiation tiles | Task 4 |
| 3 pricing cards (Core / Core AI / Shield) with Core AI "Most Popular" | Task 4 |
| Register interest form — email + consent checkbox | Task 4 |
| GDPR consent note + withdrawal instruction | Task 4 |
| Success state (form replaced) + error state | Task 4 |
| Worker endpoint `POST /api/public/interest` | Task 2 |
| `BREVO_API_KEY` in `Env` type | Task 1 |
| Route registered before auth middleware | Task 3 |
| Brevo list ID 4 + `SOURCE` attribute | Task 2 |
| `updateEnabled: true` for duplicate emails | Task 2 |
| IP rate limiting | Task 2 |
| Email validation (regex + 254 char max) | Task 2 |
| Consent must be `true` | Task 2 |
| Worker secret set + deployed | Task 5 |
| End-to-end browser test | Task 6 |
| Cloudflare Pages setup for `morechard.com` | Task 7 |

All spec requirements covered. No gaps, no placeholders.
