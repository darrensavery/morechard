# Marketing Boilerplate & Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Morechard marketing site into a build-script-driven static system with shared partials, a reusable component library, and data-driven token replacement — so new pages can be authored by composing blocks, with nav/footer and pricing data maintained in one place.

**Architecture:** A Node.js build script (`marketing/build.js`) reads source pages from `marketing/src/`, injects shared partials (`_nav`, `_footer`, `_head-common`) and component blocks (`_components/`), resolves `{{data:path}}` tokens from JSON files, and writes fully assembled HTML to `marketing/dist/`. Cloudflare Pages runs `node marketing/build.js` and serves `marketing/dist/` — no new npm dependencies.

**Tech Stack:** Node.js built-ins only (`fs`, `path`, `crypto`), static HTML/CSS, Cloudflare Pages.

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `marketing/build.js` | Build script: loads partials/components/data, processes src/, copies assets to dist/ |
| `marketing/data/pricing.json` | Single source of truth for plan names, prices, feature lists |
| `marketing/data/pillars.json` | Learning Lab pillar data (id, title, subtitle, description, modules count, color) |
| `marketing/_partials/_head-common.html` | Shared `<head>` boilerplate: charset, viewport, favicon, PostHog, fonts, base.css link |
| `marketing/_partials/_nav.html` | Full `<nav>` block extracted from index.html |
| `marketing/_partials/_footer.html` | Full `<footer>` block extracted from index.html |
| `marketing/_components/hero-fullbleed.html` | Hero section with full-bleed orchard image |
| `marketing/_components/app-promo.html` | Phone mockup + 3-feature scroll demo section |
| `marketing/_components/what-is-morechard.html` | 3-pillar card grid ("What is Morechard") |
| `marketing/_components/learning-lab-pillars.html` | 4-tab Learning Lab section with pillar roadmap |
| `marketing/_components/who-its-for.html` | Audience cards (single/co-parenting household) |
| `marketing/_components/why-morechard.html` | Differentiator grid (4 tiles) |
| `marketing/_components/pricing-table.html` | 3-column pricing cards — uses `{{data:pricing.*}}` tokens |
| `marketing/_components/register-interest.html` | Email sign-up form section |
| `marketing/src/index.html` | Homepage source: metadata tokens + `{{component:*}}` body tokens |
| `marketing/src/privacy-policy.html` | Privacy page source: metadata + prose `<main>` body |
| `marketing/src/terms.html` | Terms page source: metadata + prose `<main>` body |
| `marketing/css/page.css` | Inner-page prose layout styles (new) |

### Files that stay unchanged
| File | Note |
|------|------|
| `marketing/css/base.css` | Global tokens, nav, footer — untouched |
| `marketing/css/home.css` | Homepage-specific styles — untouched |
| `marketing/_headers` | Copied as-is to dist/ |
| `marketing/sitemap.xml` | Copied as-is to dist/ |
| `marketing/robots.txt` | Copied as-is to dist/ |
| `marketing/*.webp / *.png / *.jpg` | Copied as-is to dist/ |

### Files to delete after migration
| File | Why |
|------|-----|
| `marketing/index.html` | Replaced by `marketing/src/index.html` + build output |

---

## Task 1: Create data files

**Files:**
- Create: `marketing/data/pricing.json`
- Create: `marketing/data/pillars.json`

- [ ] **Step 1: Create `marketing/data/pricing.json`**

```json
{
  "core": {
    "name": "Core",
    "price_whole": "44",
    "price_dec": ".99",
    "badge": "",
    "featured": false,
    "groups": [
      {
        "label": "Chores & Ledger",
        "check_color": "teal",
        "items": [
          "Chore tracker & approval flow",
          "Immutable SHA-256 ledger",
          "Child 6-digit code access",
          "Unlimited children",
          "Single & multi-household compatible"
        ]
      },
      {
        "label": "Goals & Money",
        "check_color": "teal",
        "items": [
          "Savings goals (Savings Grove)",
          "Payment bridge (Monzo, Revolut, PayPal)",
          "Rate Guide benchmarking"
        ]
      }
    ]
  },
  "core_ai": {
    "name": "Core AI",
    "name_suffix_ai": true,
    "price_whole": "64",
    "price_dec": ".99",
    "badge": "Most Popular",
    "featured": true,
    "groups": [
      {
        "label": "Chores & Ledger",
        "check_color": "teal",
        "items": [
          "Chore tracker & approval flow",
          "Immutable SHA-256 ledger",
          "Child 6-digit code access",
          "Unlimited children",
          "Single & multi-household compatible"
        ]
      },
      {
        "label": "Goals & Money",
        "check_color": "teal",
        "items": [
          "Savings goals (Savings Grove)",
          "Payment bridge (Monzo, Revolut, PayPal)",
          "Rate Guide benchmarking"
        ]
      },
      {
        "label": "AI & Insights",
        "check_color": "purple",
        "items": [
          "Parent Insights AI",
          "AI Mentor coaching",
          "Learning Lab (20-module financial curriculum)"
        ]
      }
    ]
  },
  "shield_ai": {
    "name": "Shield AI",
    "name_suffix_ai": true,
    "price_whole": "149",
    "price_dec": ".99",
    "badge": "",
    "featured": false,
    "groups": [
      {
        "label": "Chores & Ledger",
        "check_color": "teal",
        "items": [
          "Chore tracker & approval flow",
          "Immutable SHA-256 ledger",
          "Child 6-digit code access",
          "Unlimited children",
          "Single & multi-household compatible"
        ]
      },
      {
        "label": "Goals & Money",
        "check_color": "teal",
        "items": [
          "Savings goals (Savings Grove)",
          "Payment bridge (Monzo, Revolut, PayPal)",
          "Rate Guide benchmarking"
        ]
      },
      {
        "label": "AI & Insights",
        "check_color": "purple",
        "items": [
          "Parent Insights AI",
          "AI Mentor coaching",
          "Learning Lab (20-module financial curriculum)"
        ]
      },
      {
        "label": "Legal & Records",
        "check_color": "gold",
        "items": [
          "Tamper-evident PDF exports",
          "Court-ready audit export",
          "Ledger seal & verification"
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Create `marketing/data/pillars.json`**

```json
{
  "pillars": [
    {
      "id": 1,
      "label": "Pillar 1",
      "name": "Earning & Value",
      "modules": 4,
      "dot_color": "teal"
    },
    {
      "id": 2,
      "label": "Pillar 2",
      "name": "Spending & Choices",
      "modules": 3,
      "dot_color": "teal"
    },
    {
      "id": 3,
      "label": "Pillar 3",
      "name": "Saving & Growth",
      "modules": 4,
      "dot_color": "teal"
    },
    {
      "id": 4,
      "label": "Pillar 4",
      "name": "Borrowing & Debt",
      "modules": 3,
      "dot_color": "gold"
    },
    {
      "id": 5,
      "label": "Pillar 5",
      "name": "Investing & Future",
      "modules": 3,
      "dot_color": "gold"
    },
    {
      "id": 6,
      "label": "Pillar 6",
      "name": "Society & Wellbeing",
      "modules": 4,
      "dot_color": "gold"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add marketing/data/pricing.json marketing/data/pillars.json
git commit -m "feat(marketing): add data files for pricing and pillars"
```

---

## Task 2: Extract partials from index.html

Extract the three shared partials. Each file must use root-relative asset paths (e.g. `/favicon.svg`, `/css/base.css`) so they work at any URL depth. CSS `<link>` tags will have `?v=BUILD_HASH` appended by the build script — write the placeholder literally in the partial; the build script will substitute it.

**Files:**
- Create: `marketing/_partials/_head-common.html`
- Create: `marketing/_partials/_nav.html`
- Create: `marketing/_partials/_footer.html`

- [ ] **Step 1: Create `marketing/_partials/_head-common.html`**

This contains everything in `<head>` that is shared across all pages, except `<title>`, `<meta name="description">`, OG/Twitter tags, structured data, and page-specific CSS links — those are injected per-page by the build script. The `BUILD_HASH` token is replaced by the build script.

```html
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- PostHog -->
  <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init("phc_zf5uHwc5ZCvCJtxHts6AGaqBPw5x2zLHJFYsL6ftvtj3", {
      api_host: "https://eu.i.posthog.com",
      person_profiles: "identified_only"
    });
  </script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap" rel="stylesheet" />

  <!-- Base styles -->
  <link rel="stylesheet" href="/css/base.css?v=BUILD_HASH" />
```

- [ ] **Step 2: Create `marketing/_partials/_nav.html`**

Copy the `<nav>` block verbatim from lines 85–106 of `marketing/index.html`. Change `href="favicon.svg"` references to `href="/favicon.svg"` (already in the nav SVG gradient via id, not a path — no path change needed there). The logo `href="#"` can stay as `href="/"`.

```html
  <!-- ── Nav ── -->
  <nav id="nav">
    <a class="nav-logo" href="/" aria-label="Morechard homepage">
      <svg class="nav-logo-mark" viewBox="0 0 441.06 442.31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="nav-grad" x1="0" y1="221.15" x2="441.06" y2="221.15" gradientUnits="userSpaceOnUse">
            <stop offset="0.5" stop-color="#00959c"/>
            <stop offset="0.5" stop-color="#e6b222"/>
          </linearGradient>
        </defs>
        <path fill="url(#nav-grad)" d="M427.64,1.69l-202.38,139.41c-.32.25-.66.46-1,.66-.1.06-.2.11-.3.16-.32.16-.64.32-.97.43-.02,0-.03,0-.05.02-.37.13-.75.22-1.13.29-.03,0-.06.01-.1.02-.39.06-.79.1-1.18.1-1.65,0-3.3-.56-4.74-1.67L13.42,1.69C7.64-2.79,0,2.16,0,10.37v421.58c0,5.72,3.89,10.35,8.68,10.35h168.33c5.21,0,9.82-3.37,11.4-8.33.98-3.06,2.13-6.89,3.34-11.35.39-1.44.79-2.95,1.18-4.52.2-.78.4-1.58.6-2.4.4-1.63.8-3.32,1.19-5.07.39-1.75.78-3.55,1.16-5.4.76-3.71,1.49-7.62,2.15-11.7.17-1.02.33-2.05.48-3.09.78-5.21,1.45-10.67,1.94-16.32.1-1.13.19-2.27.27-3.41,2.09-28.61-.6-61.56-15.95-90.46-2.45-4.62-5.23-9.14-8.37-13.53,0,0,27.23,16.74,44.08,54.11,16.85-37.37,44.08-54.11,44.08-54.11-41.71,58.29-20.37,141.01-11.99,167.25,1.58,4.96,6.19,8.32,11.4,8.32h168.37c4.8,0,8.68-4.64,8.68-10.35V10.37c0-8.22-7.64-13.16-13.42-8.68ZM278.05,203.52c8.68-1.11,17.68,2.48,23.07,10.14,5.39,7.65,5.76,17.33,1.79,25.14-8.68,1.11-17.68-2.48-23.07-10.14-5.39-7.65-5.76-17.33-1.79-25.14ZM257.86,182.83c6.09,2.37,10.04,7.85,10.75,13.92-4.62,4-11.24,5.38-17.33,3.02-6.09-2.37-10.04-7.85-10.75-13.92,4.62-4,11.24-5.38,17.33-3.02ZM220.5,174.69c5.02-.02,9.39,2.79,11.6,6.93-2.18,4.16-6.52,7.01-11.54,7.03-5.02.02-9.39-2.79-11.6-6.93,2.18-4.16,6.52-7.01,11.54-7.03ZM138.43,222.92c9.47-3.52,20.53-1.82,28.59,5.38,8.06,7.2,11,17.99,8.57,27.8-9.47,3.52-20.53,1.82-28.59-5.38-8.06-7.2-11-17.99-8.57-27.8ZM123.74,265.47c1.15-6.91,6.46-12.19,13.3-14.15,5.83,4.07,9.15,10.79,8,17.7-1.15,6.91-6.46,12.19-13.3,14.15-5.83-4.07-9.15-10.79-8-17.7ZM191.82,358.95c-8.69,3.37-18.99,1.94-26.68-4.63-7.69-6.56-10.72-16.52-8.74-25.63,8.69-3.37,18.99-1.94,26.68,4.63,7.69,6.56,10.72,16.52,8.74,25.63ZM182.94,308.24c-7.36,8.49-19.08,12.74-30.85,10.05-11.77-2.69-20.47-11.62-23.41-22.47,7.36-8.49,19.08-12.74,30.85-10.05,11.77,2.69,20.47,11.62,23.41,22.47ZM161.78,216.36c-1.43-10.47,2.82-21.36,12.01-27.94,9.18-6.59,20.86-7.12,30.32-2.41,1.43,10.47-2.82,21.36-12.01,27.94-9.18-6.59-20.86-7.12-30.32-2.41ZM186.67,236.75c2.82-12.73,12.45-22.19,24.21-25.42,9.29,7.9,14.02,20.54,11.2,33.27-2.82,12.73-12.45,22.19-24.21,25.42-9.29-7.9-14.02-20.54-11.2-33.27ZM231.53,285.81c-6.01,5.93-14.57,7.68-22.1,5.3-2.27-7.56-.4-16.09,5.62-22.02,6.01-5.93,14.57-7.68,22.1-5.3,2.27,7.56.4,16.09-5.62,22.02ZM239.57,247.8c-9.19-10.21-11.41-24.25-6.98-36.31,12.46-3.13,26.19.54,35.38,10.75,9.19,10.21,11.41,24.25,6.98,36.31-12.46,3.13-26.19-.54-35.38-10.75ZM279.72,349.22c-6.01,9.4-16.53,14.17-26.93,13.31-5.14-9.08-5.23-20.62.78-30.03,6.01-9.4,16.53-14.17,26.93-13.31,5.14,9.08,5.23,20.62-.78,30.03ZM262.83,307.05c-4.37-8.89-3.82-19.83,2.39-28.41,6.21-8.58,16.44-12.52,26.25-11.13,4.37,8.89,3.82,19.83-2.39,28.41-6.21,8.58-16.44,12.52-26.25,11.13ZM310.84,313.15c-3.42,7.3-10.51,11.71-18.04,12.07-4.54-6.02-5.69-14.28-2.27-21.58,3.42-7.3,10.51-11.71,18.04-12.07,4.54,6.02,5.69,14.28,2.27,21.58ZM309.95,281.38c-6.91-3.09-11.94-9.79-12.48-17.87-.54-8.08,3.55-15.39,9.99-19.37,6.91,3.09,11.94,9.79,12.48,17.87.54,8.08-3.55,15.39-9.99,19.37Z"/>
      </svg>
      <span class="nav-logo-wordmark">
        <span class="wm-M">M</span><span class="wm-or">or</span><span class="wm-e">e</span><span class="wm-chard">chard</span>
      </span>
    </a>
    <a class="btn-primary" href="#signup">
      Register interest
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  </nav>
```

- [ ] **Step 3: Create `marketing/_partials/_footer.html`**

Copy the `<footer>` block verbatim from lines 872–892 of `marketing/index.html`. The footer logo `href="#"` becomes `href="/"`.

```html
  <!-- ── Footer ── -->
  <footer>
    <a class="footer-logo" href="/">
      <svg class="footer-logo-mark" viewBox="0 0 441.06 442.31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="footer-grad" x1="0" y1="221.15" x2="441.06" y2="221.15" gradientUnits="userSpaceOnUse">
            <stop offset="0.5" stop-color="#00959c"/>
            <stop offset="0.5" stop-color="#e6b222"/>
          </linearGradient>
        </defs>
        <path fill="url(#footer-grad)" d="M427.64,1.69l-202.38,139.41c-.32.25-.66.46-1,.66-.1.06-.2.11-.3.16-.32.16-.64.32-.97.43-.02,0-.03,0-.05.02-.37.13-.75.22-1.13.29-.03,0-.06.01-.1.02-.39.06-.79.1-1.18.1-1.65,0-3.3-.56-4.74-1.67L13.42,1.69C7.64-2.79,0,2.16,0,10.37v421.58c0,5.72,3.89,10.35,8.68,10.35h168.33c5.21,0,9.82-3.37,11.4-8.33.98-3.06,2.13-6.89,3.34-11.35.39-1.44.79-2.95,1.18-4.52.2-.78.4-1.58.6-2.4.4-1.63.8-3.32,1.19-5.07.39-1.75.78-3.55,1.16-5.4.76-3.71,1.49-7.62,2.15-11.7.17-1.02.33-2.05.48-3.09.78-5.21,1.45-10.67,1.94-16.32.1-1.13.19-2.27.27-3.41,2.09-28.61-.6-61.56-15.95-90.46-2.45-4.62-5.23-9.14-8.37-13.53,0,0,27.23,16.74,44.08,54.11,16.85-37.37,44.08-54.11,44.08-54.11-41.71,58.29-20.37,141.01-11.99,167.25,1.58,4.96,6.19,8.32,11.4,8.32h168.37c4.8,0,8.68-4.64,8.68-10.35V10.37c0-8.22-7.64-13.16-13.42-8.68ZM278.05,203.52c8.68-1.11,17.68,2.48,23.07,10.14,5.39,7.65,5.76,17.33,1.79,25.14-8.68,1.11-17.68-2.48-23.07-10.14-5.39-7.65-5.76-17.33-1.79-25.14ZM257.86,182.83c6.09,2.37,10.04,7.85,10.75,13.92-4.62,4-11.24,5.38-17.33,3.02-6.09-2.37-10.04-7.85-10.75-13.92,4.62-4,11.24-5.38,17.33-3.02ZM220.5,174.69c5.02-.02,9.39,2.79,11.6,6.93-2.18,4.16-6.52,7.01-11.54,7.03-5.02.02-9.39-2.79-11.6-6.93,2.18-4.16,6.52-7.01,11.54-7.03ZM138.43,222.92c9.47-3.52,20.53-1.82,28.59,5.38,8.06,7.2,11,17.99,8.57,27.8-9.47,3.52-20.53,1.82-28.59-5.38-8.06-7.2-11-17.99-8.57-27.8ZM123.74,265.47c1.15-6.91,6.46-12.19,13.3-14.15,5.83,4.07,9.15,10.79,8,17.7-1.15,6.91-6.46,12.19-13.3,14.15-5.83-4.07-9.15-10.79-8-17.7ZM191.82,358.95c-8.69,3.37-18.99,1.94-26.68-4.63-7.69-6.56-10.72-16.52-8.74-25.63,8.69-3.37,18.99-1.94,26.68,4.63,7.69,6.56,10.72,16.52,8.74,25.63ZM182.94,308.24c-7.36,8.49-19.08,12.74-30.85,10.05-11.77-2.69-20.47-11.62-23.41-22.47,7.36-8.49,19.08-12.74,30.85-10.05,11.77,2.69,20.47,11.62,23.41,22.47ZM161.78,216.36c-1.43-10.47,2.82-21.36,12.01-27.94,9.18-6.59,20.86-7.12,30.32-2.41,1.43,10.47-2.82,21.36-12.01,27.94-9.18-6.59-20.86-7.12-30.32-2.41ZM186.67,236.75c2.82-12.73,12.45-22.19,24.21-25.42,9.29,7.9,14.02,20.54,11.2,33.27-2.82,12.73-12.45,22.19-24.21,25.42-9.29-7.9-14.02-20.54-11.2-33.27ZM231.53,285.81c-6.01,5.93-14.57,7.68-22.1,5.3-2.27-7.56-.4-16.09,5.62-22.02,6.01-5.93,14.57-7.68,22.1-5.3,2.27,7.56.4,16.09-5.62,22.02ZM239.57,247.8c-9.19-10.21-11.41-24.25-6.98-36.31,12.46-3.13,26.19.54,35.38,10.75,9.19,10.21,11.41,24.25,6.98,36.31-12.46,3.13-26.19-.54-35.38-10.75ZM279.72,349.22c-6.01,9.4-16.53,14.17-26.93,13.31-5.14-9.08-5.23-20.62.78-30.03,6.01-9.4,16.53-14.17,26.93-13.31,5.14,9.08,5.23,20.62-.78,30.03ZM262.83,307.05c-4.37-8.89-3.82-19.83,2.39-28.41,6.21-8.58,16.44-12.52,26.25-11.13,4.37,8.89,3.82,19.83-2.39,28.41-6.21,8.58-16.44,12.52-26.25,11.13ZM310.84,313.15c-3.42,7.3-10.51,11.71-18.04,12.07-4.54-6.02-5.69-14.28-2.27-21.58,3.42-7.3,10.51-11.71,18.04-12.07,4.54,6.02,5.69,14.28,2.27,21.58ZM309.95,281.38c-6.91-3.09-11.94-9.79-12.48-17.87-.54-8.08,3.55-15.39,9.99-19.37,6.91,3.09,11.94,9.79,12.48,17.87.54,8.08-3.55,15.39-9.99,19.37Z"/>
      </svg>
      <span class="footer-logo-wordmark">
        <span class="wm-M">M</span><span class="wm-or">or</span><span class="wm-e">e</span><span class="wm-chard">chard</span>
      </span>
    </a>
    <div class="footer-links">
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/terms">Terms of Use</a>
    </div>
    <p class="footer-copy">&copy; 2026 Morechard. All rights reserved.</p>
  </footer>
```

- [ ] **Step 4: Commit**

```bash
git add marketing/_partials/
git commit -m "feat(marketing): extract nav, footer, head-common partials"
```

---

## Task 3: Extract static components (no data tokens)

Extract sections from `marketing/index.html` that have no data dependencies. These become standalone component files. Each file must use root-relative image paths (`/hero-orchard_3_2.webp` etc).

**Files:**
- Create: `marketing/_components/hero-fullbleed.html`
- Create: `marketing/_components/app-promo.html`
- Create: `marketing/_components/what-is-morechard.html`
- Create: `marketing/_components/learning-lab-pillars.html`
- Create: `marketing/_components/who-its-for.html`
- Create: `marketing/_components/why-morechard.html`
- Create: `marketing/_components/register-interest.html`

- [ ] **Step 1: Create `marketing/_components/hero-fullbleed.html`**

Copy lines 108–136 from `marketing/index.html`. Update image paths to root-relative:

```html
<!-- component: hero-fullbleed | css: none -->
  <!-- ── Hero - full-bleed orchard image ── -->
  <section id="hero">
    <picture>
      <source media="(max-width: 720px)" srcset="/hero-orchard-portrait.webp" />
      <img class="hero-img" src="/hero-orchard_3_2.webp" alt="Morechard - a family chore tracker and pocket money app, illustrated with an orchard scene" loading="eager" />
    </picture>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div class="hero-badge reveal">
        <span class="hero-badge-dot"></span>
        Coming Soon
      </div>
      <h1 class="hero-headline reveal d1">
        The chore and pocket money app <em>that builds <br />real independence.</em>
      </h1>
      <p class="hero-sub reveal d2">
        Morechard is a logical, bank-free training ground where parents teach financial discipline through everyday responsibility. No monthly fees, no bank "funnels" - just a forensic-level source of truth for your family's growth.
      </p>
      <div class="hero-actions reveal d3">
        <a href="#signup" class="btn-primary btn-hero">
          Register my interest
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <span class="hero-note">No spam - one email at launch.</span>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Create `marketing/_components/app-promo.html`**

Copy lines 138–354 from `marketing/index.html` verbatim. Update image path `/phone-mockup.webp` if referenced (check the actual HTML — the phone mockup is rendered in CSS/HTML, no `<img>` tag needed). Add the component header comment at the top:

```html
<!-- component: app-promo | css: none -->
```

Then paste the entire `<section id="app-promo">...</section>` block from `index.html` lines 139–354.

- [ ] **Step 3: Create `marketing/_components/what-is-morechard.html`**

Copy lines 355–396 from `marketing/index.html`:

```html
<!-- component: what-is-morechard | css: none -->
```

Then paste the entire `<section id="what">...</section>` block.

- [ ] **Step 4: Create `marketing/_components/learning-lab-pillars.html`**

Copy lines 398–557 from `marketing/index.html`:

```html
<!-- component: learning-lab-pillars | css: none -->
```

Then paste the entire `<section id="learning-lab">...</section>` block.

- [ ] **Step 5: Create `marketing/_components/who-its-for.html`**

Copy lines 559–609 from `marketing/index.html`:

```html
<!-- component: who-its-for | css: none -->
```

Then paste the entire `<section id="who">...</section>` block.

- [ ] **Step 6: Create `marketing/_components/why-morechard.html`**

Copy lines 611–673 from `marketing/index.html`:

```html
<!-- component: why-morechard | css: none -->
```

Then paste the entire `<section id="different">...</section>` block.

- [ ] **Step 7: Create `marketing/_components/register-interest.html`**

Copy lines 800–869 from `marketing/index.html`:

```html
<!-- component: register-interest | css: none -->
```

Then paste the entire `<section id="signup">...</section>` block.

- [ ] **Step 8: Commit**

```bash
git add marketing/_components/
git commit -m "feat(marketing): extract static section components from index.html"
```

---

## Task 4: Create data-driven pricing-table component

The pricing table component uses `{{data:pricing.*}}` tokens instead of hardcoded values. The build script resolves these from `data/pricing.json`. Because the pricing cards have complex, variable-length feature group structures, the build script will handle pricing differently: it generates the full pricing card HTML from the JSON data rather than using inline tokens for each feature. The component file is therefore a template with a single `{{data:pricing_cards}}` token that the build script replaces with the fully generated HTML block.

**Files:**
- Create: `marketing/_components/pricing-table.html`

- [ ] **Step 1: Create `marketing/_components/pricing-table.html`**

```html
<!-- component: pricing-table | css: none | data: pricing_cards -->
  <!-- ── Pricing ── -->
  <section id="pricing">
    <div class="container">
      <span class="section-label reveal">Pricing</span>
      <h2 class="section-headline reveal">Own it. No subscription, ever.</h2>
      <p class="section-sub reveal">One-time payment - yours for life. No renewal reminders. No price hikes. No cancellations.</p>

      <div class="pricing-grid">
        {{data:pricing_cards}}
      </div>
    </div>
  </section>
```

The build script will generate the HTML for each pricing card from `data/pricing.json` and substitute `{{data:pricing_cards}}`. The card generation logic is defined in Task 6 (build script).

- [ ] **Step 2: Commit**

```bash
git add marketing/_components/pricing-table.html
git commit -m "feat(marketing): add pricing-table component with data token"
```

---

## Task 5: Create source pages and page.css

**Files:**
- Create: `marketing/src/index.html`
- Create: `marketing/src/privacy-policy.html`
- Create: `marketing/src/terms.html`
- Create: `marketing/css/page.css`

- [ ] **Step 1: Create `marketing/src/index.html`**

```html
<!--
  TITLE: Morechard - Chore Tracker &amp; Pocket Money App for Families
  DESCRIPTION: Morechard is a chore tracker and pocket money app for any family - including separated and co-parenting households. Real financial literacy built in. One-time payment.
  CANONICAL: https://morechard.com/
  OG_TITLE: Morechard - Chore Tracker &amp; Pocket Money App for Families
  OG_DESCRIPTION: A chore tracker and pocket money app for any family - including separated and co-parenting households. Real financial literacy built in. One-time payment.
  OG_IMAGE: https://morechard.com/og-image.jpg
  PAGE_CSS: home.css
-->

<!-- BODY_START -->
{{component:hero-fullbleed}}
{{component:app-promo}}
{{component:what-is-morechard}}
{{component:learning-lab-pillars}}
{{component:who-its-for}}
{{component:why-morechard}}
{{component:pricing-table}}
{{component:register-interest}}
<!-- BODY_END -->

<!-- SCRIPTS_START -->
<script>
  // ── Scroll-reveal ──
  const io = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.08 }
  );
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ── Nav: transparent → cream on scroll ──
  const nav = document.getElementById('nav');
  const darkTrigger = document.getElementById('who');
  function updateScroll() {
    const scrollY    = window.scrollY;
    const triggerTop = darkTrigger.getBoundingClientRect().top + scrollY;
    nav.classList.toggle('scrolled', scrollY > 60);
    document.body.classList.toggle('dark', scrollY >= triggerTop - window.innerHeight * 0.15);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  // ── Form logic ──
  const form        = document.getElementById('interest-form');
  const emailInput  = document.getElementById('email-input');
  const consentBox  = document.getElementById('consent-check');
  const submitBtn   = document.getElementById('submit-btn');
  const btnLabel    = document.getElementById('btn-label');
  const btnArrow    = document.getElementById('btn-arrow');
  const formPill    = document.getElementById('form-pill');
  const formError   = document.getElementById('form-error');
  const formSuccess = document.getElementById('form-success');

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const qFamilyType = document.getElementById('q-family-type');
  const selections  = { contact_type: null, family_type: null };

  document.querySelectorAll('.form-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selections[group] = btn.dataset.value;
      if (group === 'contact_type') {
        if (btn.dataset.value === 'parent') {
          qFamilyType.classList.remove('hidden');
        } else {
          qFamilyType.classList.add('hidden');
          selections.family_type = null;
          document.querySelectorAll('[data-group="family_type"]').forEach(b => b.classList.remove('selected'));
        }
      }
      updateSubmit();
    });
  });

  function updateSubmit() {
    const emailOk  = EMAIL_RE.test(emailInput.value.trim());
    const typeOk   = selections.contact_type !== null;
    const familyOk = selections.contact_type !== 'parent' || selections.family_type !== null;
    submitBtn.disabled = !(emailOk && consentBox.checked && typeOk && familyOk);
  }
  emailInput.addEventListener('input', updateSubmit);
  consentBox.addEventListener('change', updateSubmit);

  function showError(msg) { formError.textContent = msg; formError.classList.add('visible'); formPill.classList.add('error'); }
  function clearError() { formError.classList.remove('visible'); formPill.classList.remove('error'); }
  function setLoading(on) {
    if (on) { btnLabel.innerHTML = '<span class="spinner"></span>'; if (btnArrow) btnArrow.style.display = 'none'; submitBtn.disabled = true; }
    else { btnLabel.textContent = 'Notify me'; if (btnArrow) btnArrow.style.display = ''; updateSubmit(); }
  }

  /* ── Learning Lab persona tabs ── */
  (function() {
    const tabs      = Array.from(document.querySelectorAll('#ll-tabs .ll-tab'));
    const panels    = Array.from(document.querySelectorAll('.ll-panel'));
    const indicator = document.getElementById('ll-tab-indicator');

    function positionIndicator(tab) {
      const tabsRect = document.getElementById('ll-tabs').getBoundingClientRect();
      const tabRect  = tab.getBoundingClientRect();
      indicator.style.width  = tabRect.width + 'px';
      indicator.style.left   = (tabRect.left - tabsRect.left) + 'px';
    }

    function activateTab(idx) {
      tabs.forEach((t, i) => {
        t.classList.toggle('active', i === idx);
        t.setAttribute('aria-selected', i === idx);
      });
      panels.forEach((p, i) => p.classList.toggle('active', i === idx));
      positionIndicator(tabs[idx]);
    }

    tabs.forEach((tab, i) => tab.addEventListener('click', () => activateTab(i)));
    requestAnimationFrame(() => positionIndicator(tabs[0]));

    /* ── Pillar accordion ── */
    const pillars = Array.from(document.querySelectorAll('.ll-pillar'));
    const drawer  = document.getElementById('ll-pillar-drawer');

    const pillarData = [
      { id: 1, modules: ['Effort & Reward', 'Fair Pay', 'Value of Work', 'Negotiation Basics'] },
      { id: 2, modules: ['Needs vs. Wants', 'Impulse Control', 'Digital vs. Physical Currency'] },
      { id: 3, modules: ['The Snowball', 'Goal Setting', 'Emergency Funds', 'Delayed Gratification'] },
      { id: 4, modules: ['What is Debt?', 'Good Debt vs. Bad Debt', 'Credit Scores'] },
      { id: 5, modules: ['Compound Interest', 'Index Funds', 'Long-Term Thinking'] },
      { id: 6, modules: ['Tax Basics', 'Giving & Charity', 'Ethical Spending', 'Financial Wellbeing'] },
    ];

    function openPillar(idx) {
      const data = pillarData[idx];
      pillars.forEach((p, i) => p.setAttribute('aria-expanded', i === idx ? 'true' : 'false'));
      drawer.innerHTML = `
        <div class="ll-drawer-inner">
          <div class="ll-drawer-label">Pillar ${data.id} modules</div>
          <ul class="ll-drawer-modules">
            ${data.modules.map(m => `<li>${m}</li>`).join('')}
          </ul>
        </div>`;
      drawer.style.display = 'block';
    }

    pillars.forEach((p, i) => p.addEventListener('click', () => {
      if (p.getAttribute('aria-expanded') === 'true') {
        p.setAttribute('aria-expanded', 'false');
        drawer.style.display = 'none';
        drawer.innerHTML = '';
      } else {
        openPillar(i);
      }
    }));
  })();

  /* ── Phone demo tab/screen switcher ── */
  (function initScrollDemo() {
    const screens = Array.from(document.querySelectorAll('.demo-screen'));
    const dots    = Array.from(document.querySelectorAll('.demo-dot'));
    const features = Array.from(document.querySelectorAll('.promo-feature'));
    const tabItems = Array.from(document.querySelectorAll('.ds-tabnav-item'));
    const tabIndicator = document.getElementById('demo-tabnav-indicator');
    let currentScreen = 0;

    function positionTabIndicator(idx) {
      const container = document.getElementById('demo-tabnav');
      if (!container) return;
      const item = tabItems[idx];
      if (!item) return;
      tabIndicator.style.width = item.offsetWidth + 'px';
      tabIndicator.style.left  = item.offsetLeft + 'px';
    }

    function setScreen(idx) {
      currentScreen = idx;
      screens.forEach((s, i) => s.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      features.forEach((f, i) => f.classList.toggle('active', i === idx));
      tabItems.forEach((t, i) => t.classList.toggle('active', i === idx));
      positionTabIndicator(idx);
    }

    features.forEach((f, i) => f.addEventListener('click', () => setScreen(i)));
    dots.forEach((dot, i) => { dot.style.cursor = 'pointer'; dot.addEventListener('click', () => setScreen(i)); });
    tabItems.forEach((t, i) => t.addEventListener('click', () => setScreen(i)));

    let autoTimer = null;
    function startAuto() { stopAuto(); autoTimer = setInterval(() => setScreen((currentScreen + 1) % screens.length), 6000); }
    function stopAuto() { clearInterval(autoTimer); }
    [...features, ...dots, ...tabItems].forEach(el => el.addEventListener('click', () => { stopAuto(); setTimeout(startAuto, 8000); }));

    setScreen(0);
    startAuto();
  })();

  /* ── Approve button demo animation ── */
  (function() {
    const approveBtn = document.getElementById('demo-approve-btn');
    const balanceEl  = document.getElementById('demo-balance');
    if (!approveBtn || !balanceEl) return;
    approveBtn.addEventListener('click', function() {
      if (approveBtn.classList.contains('approved')) return;
      approveBtn.classList.add('approved');
      balanceEl.textContent = '£14.00';
      setTimeout(() => { approveBtn.classList.remove('approved'); balanceEl.textContent = '£12.50'; }, 2500);
    });
  })();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();
    const email = emailInput.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { showError('Please enter a valid email address.'); emailInput.focus(); return; }
    setLoading(true);
    try {
      const res = await fetch('https://morechard-api.darren-savery.workers.dev/api/public/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true, contact_type: selections.contact_type, family_type: selections.family_type }),
      });
      if (res.ok) {
        posthog.capture('signup_submitted', { contact_type: selections.contact_type, family_type: selections.family_type });
        form.style.display = 'none';
        formSuccess.classList.add('visible');
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error || 'Something went wrong - please try again.');
        setLoading(false);
      }
    } catch {
      showError('Something went wrong - please check your connection and try again.');
      setLoading(false);
    }
  });
</script>
<!-- SCRIPTS_END -->
```

- [ ] **Step 2: Create `marketing/src/privacy-policy.html`**

```html
<!--
  TITLE: Privacy Policy — Morechard
  DESCRIPTION: Read the Morechard privacy policy. Understand how we collect, use, and protect your data.
  CANONICAL: https://morechard.com/privacy-policy
  PAGE_CSS: page.css
-->

<!-- BODY_START -->
<main class="prose-page container">
  <h1>Privacy Policy</h1>
  <p class="prose-meta">Last updated: May 2026</p>

  <p>Morechard ("we", "us", "our") is committed to protecting your privacy. This policy explains what data we collect, why we collect it, and how we use it.</p>

  <h2>What we collect</h2>
  <p>We collect only the data necessary to operate the service: your email address (for account access and launch notifications), and anonymised usage data via PostHog to help us improve the product.</p>

  <h2>How we use your data</h2>
  <p>Your email is used solely for account management and, where you have consented, for product updates. We do not sell, share, or rent your data to third parties.</p>

  <h2>Data retention</h2>
  <p>You may delete your account at any time using the "Uproot" option in Settings. This permanently removes your personal data from our systems within 30 days, while retaining anonymised ledger records for hash-chain integrity.</p>

  <h2>Contact</h2>
  <p>Questions? Email us at <a href="mailto:hello@morechard.com">hello@morechard.com</a>.</p>
</main>
<!-- BODY_END -->
```

- [ ] **Step 3: Create `marketing/src/terms.html`**

```html
<!--
  TITLE: Terms of Use — Morechard
  DESCRIPTION: Read the Morechard terms of use before using the app.
  CANONICAL: https://morechard.com/terms
  PAGE_CSS: page.css
-->

<!-- BODY_START -->
<main class="prose-page container">
  <h1>Terms of Use</h1>
  <p class="prose-meta">Last updated: May 2026</p>

  <p>By using Morechard you agree to these terms. Please read them carefully.</p>

  <h2>One-time purchase</h2>
  <p>Morechard is sold as a one-time payment. You receive a perpetual licence to use the version you purchased. Future major versions may be priced separately.</p>

  <h2>Acceptable use</h2>
  <p>You may use Morechard for personal, family household management only. You may not reverse-engineer, resell, or redistribute the software.</p>

  <h2>Limitation of liability</h2>
  <p>Morechard is provided "as is". We are not liable for any indirect, incidental, or consequential damages arising from use of the service.</p>

  <h2>Contact</h2>
  <p>Questions? Email us at <a href="mailto:hello@morechard.com">hello@morechard.com</a>.</p>
</main>
<!-- BODY_END -->
```

- [ ] **Step 4: Create `marketing/css/page.css`**

```css
/* ── Inner page prose layout ── */
.prose-page {
  padding-top: calc(var(--h-nav) + 60px);
  padding-bottom: 80px;
  max-width: 720px;
}

.prose-page h1 {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 500;
  line-height: 1.15;
  margin-bottom: 8px;
  color: var(--text-dark);
}

.prose-page h2 {
  font-family: var(--font-display);
  font-size: clamp(18px, 2.5vw, 24px);
  font-weight: 500;
  margin-top: 40px;
  margin-bottom: 12px;
  color: var(--text-dark);
}

.prose-page p {
  font-size: 17px;
  line-height: 1.7;
  color: var(--text-sub);
  margin-bottom: 16px;
}

.prose-page a {
  color: var(--teal);
  text-decoration: none;
}
.prose-page a:hover { text-decoration: underline; }

.prose-meta {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 32px;
}

@media (max-width: 720px) {
  .prose-page { padding-top: calc(var(--h-nav) + 40px); padding-bottom: 60px; }
}
```

- [ ] **Step 5: Commit**

```bash
git add marketing/src/ marketing/css/page.css
git commit -m "feat(marketing): add src pages and page.css inner-page styles"
```

---

## Task 6: Write the build script

**Files:**
- Create: `marketing/build.js`

The build script uses only Node built-ins. It reads source pages, partials, components, and data; assembles full HTML pages; and copies static assets to `dist/`.

- [ ] **Step 1: Create `marketing/build.js`**

```js
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function die(msg) {
  console.error('\n[build] ERROR: ' + msg + '\n');
  process.exit(1);
}

function resolveDataPath(data, dotPath, context) {
  const parts = dotPath.split('.');
  let cur = data;
  for (const part of parts) {
    if (cur === undefined || cur === null || typeof cur !== 'object') {
      die(`Data path "{{data:${dotPath}}}" not found in ${context}`);
    }
    cur = cur[part];
  }
  if (cur === undefined) die(`Data path "{{data:${dotPath}}}" resolved to undefined in ${context}`);
  return String(cur);
}

// ── Build hash (cache busting) ────────────────────────────────────────────────

function buildHash() {
  const baseCssPath = path.join(ROOT, 'css', 'base.css');
  const baseCss = fs.existsSync(baseCssPath) ? read(baseCssPath) : '';
  const seed = Date.now().toString() + baseCss;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
}

// ── Pricing card HTML generation ─────────────────────────────────────────────

const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 7l3 3 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function generatePricingCards(pricing) {
  return Object.values(pricing).map(plan => {
    const featuredClass = plan.featured ? ' featured' : '';
    const badge = plan.badge ? `<div class="plan-badge">${plan.badge}</div>` : '';
    const nameSuffix = plan.name_suffix_ai
      ? plan.name.replace(' AI', ` <span class="plan-name-ai">AI</span>`)
      : plan.name;

    const groups = plan.groups.map(group => {
      const items = group.items.map(item =>
        `<li><span class="plan-check plan-check--${group.check_color}">${CHECK_SVG}</span>${item}</li>`
      ).join('\n            ');
      return `
          <div class="plan-group-label plan-group-label--mt">${group.label}</div>
          <ul class="plan-features">
            ${items}
          </ul>`;
    }).join('\n');

    return `
        <div class="plan-card${featuredClass} reveal">
          ${badge}
          <div class="plan-name">${nameSuffix}</div>
          <div class="plan-price">
            <span class="plan-price-currency">£</span>
            <span class="plan-price-amount">${plan.price_whole}</span>
            <span class="plan-price-dec">${plan.price_dec}</span>
          </div>
          <div class="plan-one-time">One-time payment</div>
          <hr class="plan-divider" />
          ${groups}
          <div class="plan-trial">14-day full-access trial</div>
        </div>`;
  }).join('\n');
}

// ── OG/Twitter structured-data block for homepage ────────────────────────────

function buildHomepageHeadExtras(pricing) {
  const offers = Object.values(pricing).map(p =>
    `      { "@type": "Offer", "name": "${p.name}", "price": "${p.price_whole}${p.price_dec}", "priceCurrency": "GBP" }`
  ).join(',\n');

  return `
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{{CANONICAL}}" />
  <meta property="og:site_name" content="Morechard" />
  <meta property="og:title" content="{{OG_TITLE}}" />
  <meta property="og:description" content="{{OG_DESCRIPTION}}" />
  <meta property="og:image" content="{{OG_IMAGE}}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_GB" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{{OG_TITLE}}" />
  <meta name="twitter:description" content="{{OG_DESCRIPTION}}" />
  <meta name="twitter:image" content="{{OG_IMAGE}}" />

  <!-- Hero image preload -->
  <link rel="preload" as="image" href="/hero-orchard-portrait.webp" type="image/webp" media="(max-width: 720px)" />
  <link rel="preload" as="image" href="/hero-orchard_3_2.webp" type="image/webp" media="(min-width: 721px)" />

  <!-- Structured data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Morechard",
    "url": "https://morechard.com",
    "logo": "https://morechard.com/favicon.svg",
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "hello@morechard.com",
      "contactType": "customer support"
    }
  }
  <\/script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Morechard",
    "operatingSystem": "iOS, Android",
    "applicationCategory": "FinanceApplication",
    "description": "A chore tracker and pocket money app for families, including separated and co-parenting households. Real financial literacy built in.",
    "offers": [
${offers}
    ]
  }
  <\/script>`;
}

// ── Main build ────────────────────────────────────────────────────────────────

function build() {
  // 1. Load data
  const pricing = JSON.parse(read(path.join(ROOT, 'data', 'pricing.json')));
  // pillars.json is used in _components/learning-lab-pillars.html as static HTML
  // (the pillar names are already hardcoded there; pillars.json is the source of truth for future dynamic use)

  // 2. Compute hash
  const hash = buildHash();

  // 3. Load partials
  const headCommon = read(path.join(ROOT, '_partials', '_head-common.html'))
    .replace(/BUILD_HASH/g, hash);
  const navHtml    = read(path.join(ROOT, '_partials', '_nav.html'));
  const footerHtml = read(path.join(ROOT, '_partials', '_footer.html'));

  // 4. Load components into a map
  const componentsDir = path.join(ROOT, '_components');
  const components = {};
  for (const file of fs.readdirSync(componentsDir)) {
    if (!file.endsWith('.html')) continue;
    const name = file.replace('.html', '');
    components[name] = read(path.join(componentsDir, file));
  }

  // 5. Pre-generate data-driven HTML
  const pricingCards = generatePricingCards(pricing);

  // 6. Process each src/*.html
  const srcDir = path.join(ROOT, 'src');
  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith('.html')) continue;
    const srcFile = path.join(srcDir, file);
    const src = read(srcFile);

    // Parse metadata from header comment
    const meta = {};
    const headerMatch = src.match(/<!--\s*([\s\S]*?)-->/);
    if (headerMatch) {
      for (const line of headerMatch[1].split('\n')) {
        const m = line.match(/^\s*([A-Z_]+):\s*(.+?)\s*$/);
        if (m) meta[m[1]] = m[2];
      }
    }
    if (!meta.TITLE) die(`Missing TITLE token in ${file}`);
    if (!meta.DESCRIPTION) die(`Missing DESCRIPTION token in ${file}`);

    // Extract body
    const bodyMatch = src.match(/<!-- BODY_START -->([\s\S]*?)<!-- BODY_END -->/);
    if (!bodyMatch) die(`Missing BODY_START/BODY_END in ${file}`);
    let body = bodyMatch[1];

    // Resolve {{component:name}} tokens
    body = body.replace(/\{\{component:([^}]+)\}\}/g, (_, name) => {
      name = name.trim();
      if (!components[name]) die(`Component "{{component:${name}}}" not found (referenced in ${file})`);
      return components[name];
    });

    // Resolve {{data:...}} tokens
    body = body.replace(/\{\{data:([^}]+)\}\}/g, (_, dotPath) => {
      dotPath = dotPath.trim();
      if (dotPath === 'pricing_cards') return pricingCards;
      return resolveDataPath({ pricing }, dotPath, file);
    });

    // Extract optional scripts block
    let scripts = '';
    const scriptsMatch = src.match(/<!-- SCRIPTS_START -->([\s\S]*?)<!-- SCRIPTS_END -->/);
    if (scriptsMatch) scripts = scriptsMatch[1];

    // Build page CSS link
    const pageCssLink = meta.PAGE_CSS
      ? `  <link rel="stylesheet" href="/css/${meta.PAGE_CSS}?v=${hash}" />`
      : '';

    // Build OG/Twitter/structured-data block (homepage only, when OG_TITLE present)
    let extraHead = '';
    if (meta.OG_TITLE) {
      extraHead = buildHomepageHeadExtras(pricing)
        .replace(/\{\{CANONICAL\}\}/g, meta.CANONICAL || '')
        .replace(/\{\{OG_TITLE\}\}/g, meta.OG_TITLE || '')
        .replace(/\{\{OG_DESCRIPTION\}\}/g, meta.OG_DESCRIPTION || '')
        .replace(/\{\{OG_IMAGE\}\}/g, meta.OG_IMAGE || '');
    } else if (meta.CANONICAL) {
      extraHead = `\n  <link rel="canonical" href="${meta.CANONICAL}" />`;
    }

    // Assemble full page
    const page = `<!DOCTYPE html>
<html lang="en">
<head>
${headCommon}
  <title>${meta.TITLE}</title>
  <meta name="description" content="${meta.DESCRIPTION}" />${extraHead}
${pageCssLink}
</head>
<body>
${navHtml}
${body}
${footerHtml}
${scripts}
</body>
</html>`;

    write(path.join(DIST, file), page);
    console.log(`[build] ✓ ${file}`);
  }

  // 7. Copy static assets
  const COPY_FILES = ['_headers', 'sitemap.xml', 'robots.txt'];
  for (const f of COPY_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, f));
      console.log(`[build] ✓ ${f} (copied)`);
    }
  }

  // Copy css/ directory
  const cssDir = path.join(ROOT, 'css');
  const distCssDir = path.join(DIST, 'css');
  fs.mkdirSync(distCssDir, { recursive: true });
  for (const f of fs.readdirSync(cssDir)) {
    fs.copyFileSync(path.join(cssDir, f), path.join(distCssDir, f));
  }
  console.log('[build] ✓ css/ (copied)');

  // Copy images
  const IMAGE_EXTS = ['.webp', '.png', '.jpg', '.jpeg', '.svg'];
  for (const f of fs.readdirSync(ROOT)) {
    if (IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
      fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
    }
  }
  console.log('[build] ✓ images (copied)');

  // Copy favicon.svg from root if present
  const rootFavicon = path.join(ROOT, '..', 'favicon.svg');
  if (fs.existsSync(rootFavicon)) {
    fs.copyFileSync(rootFavicon, path.join(DIST, 'favicon.svg'));
    console.log('[build] ✓ favicon.svg (copied from root)');
  }

  console.log(`\n[build] Done — ${Object.keys(components).length} components, hash=${hash}\n`);
}

build();
```

- [ ] **Step 2: Run the build script locally to verify it succeeds**

```bash
node marketing/build.js
```

Expected output (no errors):
```
[build] ✓ index.html
[build] ✓ privacy-policy.html
[build] ✓ terms.html
[build] ✓ _headers (copied)
[build] ✓ sitemap.xml (copied)
[build] ✓ robots.txt (copied)
[build] ✓ css/ (copied)
[build] ✓ images (copied)
[build] Done — N components, hash=xxxxxxxx
```

- [ ] **Step 3: Verify `marketing/dist/index.html` exists and contains the nav and footer**

```bash
grep -c "nav-logo" marketing/dist/index.html
grep -c "footer-logo" marketing/dist/index.html
grep -c "pricing-grid" marketing/dist/index.html
```

Each should output `1` (or more for footer-logo).

- [ ] **Step 4: Commit**

```bash
git add marketing/build.js
git commit -m "feat(marketing): add build.js static site assembler with partials, components, and data injection"
```

---

## Task 7: Update .gitignore and add dist to gitignore

The root `.gitignore` already contains `dist/` which catches `marketing/dist/`. Verify this and add a specific entry if needed.

**Files:**
- Modify: `.gitignore` (root)

- [ ] **Step 1: Check if `marketing/dist/` is ignored**

```bash
git check-ignore -v marketing/dist/index.html
```

Expected output: `.gitignore:X:dist/    marketing/dist/index.html`

If no output (not ignored), proceed to Step 2. If ignored, skip to Step 3.

- [ ] **Step 2: Add explicit entry if needed**

Only if Step 1 showed the path is NOT ignored — open `.gitignore` and add:

```
# Marketing build output
marketing/dist/
```

- [ ] **Step 3: Confirm `marketing/dist/` does not appear in git status**

```bash
git status --short
```

Confirm no `marketing/dist/` files appear as untracked.

- [ ] **Step 4: Commit if .gitignore was changed**

Only if Step 2 was needed:

```bash
git add .gitignore
git commit -m "chore: ignore marketing/dist build output"
```

---

## Task 8: Delete the old index.html

Now that `marketing/src/index.html` + build script produce `marketing/dist/index.html`, the original `marketing/index.html` is no longer the source of truth.

**Files:**
- Delete: `marketing/index.html`

- [ ] **Step 1: Verify `marketing/dist/index.html` renders correctly**

Open `marketing/dist/index.html` in a browser or run a quick content check:

```bash
grep -c "section-headline" marketing/dist/index.html
```

Expected: `7` or more (one per section heading).

- [ ] **Step 2: Delete the old file**

```bash
git rm marketing/index.html
```

- [ ] **Step 3: Also remove `marketing/index copy.html` if it exists**

```bash
git rm "marketing/index copy.html" 2>/dev/null || echo "not tracked"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(marketing): remove old index.html — replaced by src/ + build pipeline"
```

---

## Task 9: Configure Cloudflare Pages build settings

This task is done in the Cloudflare Pages dashboard — no code changes.

- [ ] **Step 1: Open Cloudflare Pages dashboard**

Go to: https://dash.cloudflare.com → Pages → your Morechard project → Settings → Build & deployments

- [ ] **Step 2: Update build configuration**

Set these values:
- **Build command:** `node marketing/build.js`
- **Build output directory:** `marketing/dist`
- **Root directory:** *(leave blank — the script runs from repo root via `node marketing/build.js`)*

- [ ] **Step 3: Trigger a test deploy**

Push a small commit and confirm the Pages build log shows:
```
[build] ✓ index.html
[build] Done — N components, hash=xxxxxxxx
```

And that the live site at `https://morechard.com` still renders correctly.

---

## Task 10: Smoke test

- [ ] **Step 1: Verify homepage renders identically to pre-migration**

Open `https://morechard.com` and confirm visually:
- Nav is present with logo and "Register interest" CTA
- Hero section with orchard image loads
- All 7 sections render: App promo, What is Morechard, Learning Lab, Who it's for, Why Morechard, Pricing, Register interest
- Footer is present with Privacy Policy and Terms links
- Scroll-driven dark mode triggers correctly when scrolling into "Who it's for"
- Learning Lab tabs switch correctly
- Phone demo auto-advances and responds to clicks
- Register interest form works (submits to the worker API)

- [ ] **Step 2: Verify privacy-policy and terms pages**

Open `https://morechard.com/privacy-policy` and `https://morechard.com/terms`:
- Nav and footer present
- Prose content renders with correct typography
- No broken CSS (styles loaded from `/css/base.css?v=...` and `/css/page.css?v=...`)

- [ ] **Step 3: Verify cache busting**

Inspect the page source. All CSS links should have `?v=<8-char-hash>`. Confirm the hash changes after re-running `node marketing/build.js`.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix(marketing): post-migration smoke test fixes"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✓ Build script behaviour (steps 1–6, edge cases) → Task 6
- ✓ Asset cache busting → Task 6 (`buildHash()`, `?v=BUILD_HASH`)
- ✓ Absolute paths → Task 2 & 3 (root-relative paths in partials and components)
- ✓ Missing token hard errors → Task 6 (`die()` calls for missing components, data paths, TITLE, DESCRIPTION)
- ✓ Data files (pricing.json, pillars.json) → Task 1
- ✓ Partials extraction → Task 2
- ✓ Static components extraction → Task 3
- ✓ Data-driven pricing component → Task 4
- ✓ Source pages (index, privacy, terms) → Task 5
- ✓ page.css → Task 5
- ✓ .gitignore → Task 7
- ✓ Old index.html deleted → Task 8
- ✓ Cloudflare Pages config → Task 9
- ✓ Smoke test → Task 10

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:** `generatePricingCards` reads `plan.price_whole`, `plan.price_dec`, `plan.name_suffix_ai`, `plan.groups[].check_color`, `plan.groups[].items` — all defined in `pricing.json` (Task 1). `resolveDataPath` takes `data` object and `dotPath` string — called consistently throughout Task 6.
