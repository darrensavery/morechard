# Marketing Boilerplate & Component Library

**Date:** 2026-05-11
**Status:** Draft — awaiting user approval

---

## Goal

Build a static-site boilerplate and growing component library for the Morechard marketing site. New pages can be authored quickly by composing pre-built blocks, with shared nav/footer maintained in one place and data-driven components (pricing, etc.) updated from a single source file.

---

## Constraints

- **Static HTML only** — no JS framework, no runtime templating
- **Build step:** Node.js script (`marketing/build.js`) runs on Cloudflare Pages before deploy
- **Cloudflare Pages output directory:** `marketing/dist`
- **Components:** HTML partials injected at build time — zero runtime JS for layout
- **Data:** Dynamic content (prices, plan names, feature lists, pillar data) lives in `marketing/data/` JSON files; the build script injects values into component HTML at build time via token replacement (`{{TOKEN}}`)

---

## File Structure

```
marketing/
  build.js                      ← Build script (Node, no dependencies beyond fs/path)
  data/
    pricing.json                ← Plan names, prices, feature lists
    pillars.json                ← Learning Lab pillar titles, descriptions, icons
  _partials/
    _head-common.html           ← <meta charset>, fonts, PostHog, base.css link
    _nav.html                   ← Full <nav> block with logo + CTA button
    _footer.html                ← Full <footer> block with logo, links, copyright
  _components/
    hero-fullbleed.html         ← Full-bleed orchard hero (image + scrim + headline)
    pricing-table.html          ← 3-column pricing cards (Core / Core AI / Shield AI)
    learning-lab-pillars.html   ← 5-pillar accordion/tab block
    app-promo.html              ← Phone mockup + feature list scroll demo
    who-its-for.html            ← Audience cards (families, co-parents, etc.)
    why-morechard.html          ← Differentiator grid
    register-interest.html      ← Email sign-up form section
    section-divider.html        ← Simple visual divider between sections
  src/
    index.html                  ← Homepage source (assembles components via tokens)
    privacy-policy.html         ← Privacy page source (content only)
    terms.html                  ← Terms page source (content only)
  css/
    base.css                    ← Global tokens, nav, footer, buttons, layout (unchanged)
    home.css                    ← Homepage-specific styles (unchanged)
    page.css                    ← Inner-page styles (new — simple prose layout)
  dist/                         ← Gitignored build output served by Cloudflare Pages
  _headers                      ← Copied unchanged to dist/
  sitemap.xml                   ← Copied unchanged to dist/
  robots.txt                    ← Copied unchanged to dist/
  *.webp / *.png / *.jpg        ← Copied unchanged to dist/
```

---

## Source Page Format

Every `src/*.html` file is a thin shell. It declares metadata tokens at the top, a body token where page content goes, and an optional script block for page-specific JavaScript. The build script fills in everything else.

```html
<!--
  TITLE: Morechard — Privacy Policy
  DESCRIPTION: Read the Morechard privacy policy.
  PAGE_CSS: page.css
-->

<!-- BODY_START -->
<main class="prose-page container">
  <h1>Privacy Policy</h1>
  <p>...</p>
</main>
<!-- BODY_END -->

<!-- SCRIPTS_START -->
<script>
  // page-specific JS only (e.g. form handlers, scroll demo)
</script>
<!-- SCRIPTS_END -->
```

The build script appends the `SCRIPTS` block just before `</body>`. Pages with no scripts simply omit the `SCRIPTS_START` / `SCRIPTS_END` block.

For the homepage (`src/index.html`), the body uses component include tokens:

```html
<!-- BODY_START -->
{{component:hero-fullbleed}}
{{component:app-promo}}
{{component:who-its-for}}
{{component:why-morechard}}
{{component:learning-lab-pillars}}
{{component:pricing-table}}
{{component:register-interest}}
<!-- BODY_END -->
```

---

## Build Script (`build.js`) Behaviour

1. **Read data files** — load `data/pricing.json` and `data/pillars.json` into memory
2. **Load partials** — read all `_partials/*.html` files into a map
3. **Load components** — read all `_components/*.html` files into a map
4. **Compute asset version hash** — generate a short hash (8-char hex of the current timestamp + a hash of `css/base.css` contents) used to bust CSS caches on deploy
5. **Process each `src/*.html`** file:
   a. Parse `TITLE`, `DESCRIPTION`, `PAGE_CSS` from the header comment
   b. Extract body content between `BODY_START` / `BODY_END`
   c. Replace any `{{component:name}}` tokens with the corresponding component HTML — **throw a hard error and exit non-zero if the component file does not exist**, printing the source file name and the missing component name
   d. Replace any `{{data:path.to.value}}` tokens with values from the JSON data files (e.g. `{{data:pricing.core.price}}` → `£44.99`) — throw a hard error if the path resolves to `undefined`
   e. Assemble the full page: `_head-common.html` + page-specific `<title>` + page CSS link + `_nav.html` + body + `_footer.html` + scripts block
   f. Write assembled HTML to `dist/`
6. **Copy static assets** — `_headers`, `sitemap.xml`, `robots.txt`, all image files, `css/` → `dist/`

### Edge Cases

**Asset cache busting**

All CSS `<link>` tags injected by the build script append `?v=<hash>`:

```html
<link rel="stylesheet" href="/css/base.css?v=a3f9e012" />
<link rel="stylesheet" href="/css/home.css?v=a3f9e012" />
```

The hash is the same for every file in a given build run (timestamp-seeded), so it changes on every deploy without needing per-file content hashing. Cloudflare Pages CDN treats `?v=` as a cache-busting parameter for returning visitors.

**Absolute paths for all injected asset URLs**

`_head-common.html` and the build script always emit root-relative paths (`/css/base.css`, `/favicon.svg`) rather than relative paths (`css/base.css`). This ensures pages served from any depth (e.g. `/blog/post/`) resolve assets correctly. Image `src` attributes inside components must also use root-relative paths (e.g. `/hero-orchard_3_2.webp`).

**Missing token hard errors**

The build script exits with code 1 and a descriptive message for:
- `{{component:X}}` where `_components/X.html` does not exist
- `{{data:a.b.c}}` where the JSON path resolves to `undefined`
- A `src/*.html` file missing a `TITLE` or `DESCRIPTION` header token

This prevents a broken or silently incomplete page from reaching Cloudflare Pages. The build fails fast and the deploy is blocked.

---

## Data Files

### `data/pricing.json`
```json
{
  "core": {
    "name": "Core",
    "price": "44.99",
    "currency": "GBP",
    "features": [
      "Unlimited chores & approvals",
      "Immutable ledger",
      "Goal planning (Savings Grove)",
      "Payment bridge",
      "Up to 6 children"
    ]
  },
  "core_ai": {
    "name": "Core AI",
    "price": "64.99",
    "currency": "GBP",
    "features": [
      "Everything in Core",
      "AI Mentor (Orchard Lead / Mistrz Sadu)",
      "Weekly insight briefings",
      "Rate Guide (market benchmarking)",
      "Copy for Child modal"
    ]
  },
  "shield_ai": {
    "name": "Shield AI",
    "price": "149.99",
    "currency": "GBP",
    "features": [
      "Everything in Core AI",
      "Court-ready PDF audit export",
      "Forensic ledger seal & verification",
      "Co-parenting household support",
      "Legal integrity bundle"
    ]
  }
}
```

### `data/pillars.json`
Five financial literacy pillars used in the Learning Lab component. Each entry: `id`, `title`, `subtitle`, `description`, `icon` (emoji or SVG filename).

---

## Component Authoring Convention

Each `_components/*.html` file:
- Contains only the HTML for that section (no `<html>`, `<head>`, `<body>` tags)
- May include `{{data:...}}` tokens that the build script resolves
- Has a comment at the top naming the component and listing its data dependencies:

```html
<!-- component: pricing-table | data: pricing.core, pricing.core_ai, pricing.shield_ai -->
<section id="pricing">
  ...
  <span class="plan-price">£{{data:pricing.core.price}}</span>
  ...
</section>
```

- Its CSS lives either in `base.css` (if globally reusable) or in a component-specific CSS file (`css/components/pricing-table.css`) that is listed in the component's header comment and auto-included by the build script

---

## CSS Strategy

| File | Purpose |
|------|---------|
| `css/base.css` | Design tokens, reset, nav, footer, buttons, layout helpers — applies to all pages |
| `css/home.css` | Homepage-only styles (hero, app-promo scroll demo, etc.) |
| `css/page.css` | Inner-page prose layout (headings, body text, links) |
| `css/components/*.css` | Per-component styles — only included on pages that use that component |

The build script reads the component header comment to determine which CSS files to inject into the page `<head>`.

---

## Cloudflare Pages Configuration

- **Build command:** `node marketing/build.js`
- **Build output directory:** `marketing/dist`
- `marketing/dist` added to `.gitignore`

No new npm dependencies — `build.js` uses only Node built-ins (`fs`, `path`).

---

## Initial Component Set (Phase 1)

Extract these from the existing `index.html`:

| Component | File | Data-driven? |
|-----------|------|-------------|
| Nav | `_partials/_nav.html` | No |
| Footer | `_partials/_footer.html` | No |
| Head common | `_partials/_head-common.html` | No |
| Hero (full-bleed) | `_components/hero-fullbleed.html` | No |
| App promo + scroll demo | `_components/app-promo.html` | No |
| Who it's for | `_components/who-its-for.html` | No |
| Why Morechard | `_components/why-morechard.html` | No |
| Learning Lab pillars | `_components/learning-lab-pillars.html` | Yes (`pillars.json`) |
| Pricing table | `_components/pricing-table.html` | Yes (`pricing.json`) |
| Register interest form | `_components/register-interest.html` | No |

---

## Future Component Candidates

As the library grows, new blocks can be added to `_components/` without touching the build script. Examples:
- `testimonials.html`
- `faq-accordion.html`
- `feature-comparison-table.html`
- `press-logos.html`
- `co-parenting-explainer.html`
- `app-store-badges.html`

---

## Success Criteria

- `node marketing/build.js` produces `marketing/dist/` with identical visual output to the current `index.html`
- A new page can be authored with only a title, description, CSS choice, and body content — no nav/footer copy-paste
- Changing `_nav.html` once updates all pages on next build
- Changing a price in `pricing.json` updates all pages on next build
- No new npm runtime dependencies
