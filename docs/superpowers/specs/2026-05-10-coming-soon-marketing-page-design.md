# Coming Soon Marketing Page — Design Spec
Date: 2026-05-10

## Overview

A single-page coming-soon marketing site for `morechard.com`. The app lives at `app.morechard.com`; this page is the public face before launch. It explains what Morechard is, who it's for, how it differs from competitors, pricing, and captures pre-launch interest via a Brevo-backed email signup.

No framework — pure static HTML/CSS/JS deployed to a second Cloudflare Pages project pointed at the `marketing/` folder.

---

## 1. Aesthetic Direction

**Style:** Refined editorial — premium financial publication meets orchard-rooted brand.

**Typography:**
- Headlines: `Playfair Display` (Google Fonts) — editorial authority, warmth
- Body / UI: `DM Sans` (Google Fonts) — clean, modern, legible

**Palette (exact brand values):**
- `--parchment: #f9f7f2` — page background
- `--teal: #00959c` — primary buttons, active accents, borders
- `--gold: #e6b222` — badges, highlights, warm accent
- `--canopy: #1b2d2e` — primary text, nav background
- `--canopy-light: #2d4a4b` — card surfaces, secondary backgrounds

**Memorable detail:** Large decorative `M` letterform watermark in the hero (opacity 0.04, Playfair Display, fills the viewport) echoing the logo's two-household duality. Subtle CSS grain texture overlay on the hero section.

**Motion:** Staggered scroll-reveal (IntersectionObserver + CSS `animation-delay`). Hover states on cards and buttons. Form submit micro-animation (button → spinner → checkmark).

---

## 2. Page Sections

### 2.1 Nav
- Morechard wordmark (Playfair Display, Deep Canopy on Parchment)
- Single CTA: "Register Interest" → scrolls to `#signup`
- Sticky on scroll, subtle shadow appears after 60px

### 2.2 Hero
- Badge: "Coming Soon" in Harvest Gold pill
- Headline: "The chore tracker for any family."
- Subhead: "Assign, approve, and pay — with financial literacy built in and a tamper-proof record underneath."
- CTA button: "Register my interest →" (Grove Teal, scrolls to form)
- Background: Parchment + CSS grain texture + large `M` watermark
- Responsive: stacks on mobile

### 2.3 What is Morechard (3-pillar cards)
- Section headline: "Everything a family needs. Nothing they don't."
- Cards:
  1. **Chore Tracker** — "Assign jobs. Mark them done. Approve and pay. Pocket money updates automatically — no bank account required."
  2. **Real-Data Literacy** — "Financial lessons triggered by your child's own earning and spending — not generic slides. Lessons land at exactly the right moment."
  3. **Truth Engine** — "Every transaction is SHA-256 hashed. Tamper-proof records — and one-click court-ready PDF exports when separated families need them."
- Layout: 3-column grid on desktop, single column on mobile
- Card style: white/parchment surface, 12px radius, teal top border accent

### 2.4 Who It's For (2 audience cards)
- Section headline: "Built for real families."
- Card 1 (primary): **Any household** — intro families, single parents, blended households. Day-one simplicity. No debit card. No bank account.
- Card 2 (secondary, Canopy dark surface, gold accent): **Separated & co-parenting families** — tamper-proof shared record. Court-ready PDF exports. Two households, one source of truth.
- Layout: 2-column on desktop, stacked on mobile

### 2.5 Differentiation Strip
- Section headline: "Built differently from the start."
- 4 differentiator tiles:
  1. No debit card required — works for any family from day one
  2. One-time payment — own it forever, no subscription trap
  3. Court-ready records — SHA-256 hashed, PDF export, admissible
  4. Real-data lessons — triggered by your child's actual behaviour
- Layout: 2×2 grid on desktop, single column mobile. Each tile: icon (SVG inline), bold label, short descriptor.

### 2.6 Pricing (3 plan cards)
- Section headline: "Own it. No subscription, ever."
- Subhead: "One-time payment — yours for life."
- Plans:
  | Plan | Price | Key features |
  |---|---|---|
  | Core | £44.99 | Chore tracker, immutable ledger, PDF export, 14-day trial |
  | Core AI | £64.99 | Everything in Core + AI Mentor coaching, weekly insights |
  | Shield | £149.99 | Everything in Core AI + forensic-grade PDF, legal integrity bundle |
- Core AI gets a "Most Popular" badge (Harvest Gold)
- Layout: 3-column desktop, stacked mobile. 12px radius, teal border on Core AI.

### 2.7 Register Interest Form (`#signup`)
- Section headline: "Be the first to know when Morechard launches."
- Subhead: "No spam. Just a single email when we open the doors."
- Fields: email input (full-width on mobile)
- Consent: explicit opt-in checkbox (unchecked by default):
  > "Yes — Morechard can send me product updates, launch news, and offers by email. I can unsubscribe at any time."
- Submit button: "Notify me" (disabled until email + consent both valid)
- Success state: replace form with "You're on the list. We'll be in touch." + teal checkmark icon
- Error state: inline red message "Something went wrong — please try again."
- GDPR note below form: "Your email is stored securely with Brevo. We won't share it with third parties. You can withdraw consent at any time by emailing hello@morechard.com."

### 2.8 Footer
- Morechard wordmark
- Links: Privacy Policy / Terms of Use (point to `app.morechard.com/privacy`, `app.morechard.com/terms`)
- Copyright: "© 2026 Morechard. All rights reserved."
- "App launching soon at app.morechard.com"

---

## 3. Worker Endpoint

**Route:** `POST /api/public/interest`
**File:** `worker/src/routes/public-interest.ts`
**Auth:** None (public endpoint)
**Rate limiting:** Worker-level: reject if same IP has submitted within 60 seconds (use a small in-memory Map with TTL, or CF's native rate limiting header check)

**Request body:**
```json
{ "email": "user@example.com", "consent": true }
```

**Validation:**
- `email` — basic regex format check + max 254 chars
- `consent` must be `true` — reject with 400 if false (we only store consented leads)

**On valid request:**
Calls Brevo `POST https://api.brevo.com/v3/contacts`:
```json
{
  "email": "<email>",
  "listIds": [4],
  "attributes": { "SOURCE": "morechard.com-prelaunch" },
  "updateEnabled": true
}
```
Headers: `api-key: <BREVO_API_KEY>` (worker secret), `Content-Type: application/json`

**Brevo duplicate handling:** `updateEnabled: true` means re-submitting an existing email just updates the contact rather than erroring — safe to silently succeed.

**Responses:**
- `200 { ok: true }` — success
- `400 { error: "..." }` — validation failure
- `409 { ok: true }` — already subscribed (Brevo returns 204 with updateEnabled, treat as success)
- `500 { error: "Failed to register interest" }` — Brevo call failed

**Env var:** `BREVO_API_KEY` — set as Cloudflare Worker secret via `wrangler secret put BREVO_API_KEY`

**Registration in index.ts:** Route added before auth middleware (no JWT required):
```
router.post('/api/public/interest', handlePublicInterest)
```

---

## 4. File Structure

```
marketing/
  index.html          ← entire page: HTML + <style> + <script>

worker/src/routes/
  public-interest.ts  ← POST /api/public/interest

worker/src/index.ts   ← register route (no auth middleware)
```

---

## 5. Cloudflare Pages Setup (Manual Step)

1. In Cloudflare Pages dashboard: **Create project** → connect repo → set **root directory** to `marketing/`
2. Build command: *(none — static HTML)*
3. Output directory: `marketing/`
4. Custom domain: `morechard.com`

This is separate from the existing `app.morechard.com` Pages project.

---

## 6. Out of Scope

- Sitemap / robots.txt (add later)
- OG/Twitter card meta tags (add later)
- Analytics (PostHog embed — Phase 8 task)
- Blog or multi-page structure
- Email provider HTML templates (separate task)
- Unsubscribe flow (handled by Brevo natively)
