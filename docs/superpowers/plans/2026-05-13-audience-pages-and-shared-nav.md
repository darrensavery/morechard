# Audience Pages & Shared Nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three SEO/AEO-optimised audience landing pages (Single households, Separated families, Family-law Professionals) and a forward-looking shared main nav, built on the existing Morechard marketing static-site boilerplate.

**Architecture:** Three new `src/*.html` pages with all section markup inline per-page (so copy edits don't require hunting through linked components). Shared infrastructure (nav, footer, head, register-interest form) remains as `_partials/` and `{{component:...}}` includes. Reference copies of each new block are saved to `_components/` as a documentation pattern library. `build.js` is extended once to support per-page hero-image preloads via metadata tokens and to substitute a temporary grey-SVG placeholder when an image is missing.

**Tech Stack:** Static HTML + CSS, Node-only `build.js` (no runtime deps), Cloudflare Pages, brand-book design tokens (Grove Teal `#00959c`, Harvest Gold `#e6b222`, Deep Canopy `#1b2d2e`, Parchment `#f9f7f2`), `Lora` (display) + `DM Sans` (body) — JetBrains Mono added for the Forensic Spec block.

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-05-13-audience-pages-and-shared-nav-design.md`
- Boilerplate spec: `docs/superpowers/specs/2026-05-11-marketing-boilerplate-component-library-design.md`
- Brand book: `docs/notebooklm/03-brand-book.md`
- AI personality (voice guardrails): `docs/notebooklm/02-ai-personality.md`

**Testing approach:** This is a static marketing site with no test harness. "Tests" in this plan = visual + functional checks executed by running `node marketing/build.js` and inspecting `marketing/dist/*.html` plus the rendered pages in a local browser (or `npx http-server marketing/dist`). Each task has a concrete "verify" step with the exact command and the expected output.

---

## File Structure

**Created:**
- `marketing/src/for-single-households.html` — Page 1 (all sections inline)
- `marketing/src/for-separated-families.html` — Page 2 (all sections inline)
- `marketing/src/for-professionals.html` — Page 3 (all sections inline)
- `marketing/css/page-audience.css` — audience-page layout + three signature modules + FAQ accordion + benefits grid
- `marketing/_components/audience-hero.html` — reference snippet (documentation only — not included by pages)
- `marketing/_components/audience-benefits-grid.html` — reference snippet
- `marketing/_components/signature-day-in-the-life.html` — reference snippet
- `marketing/_components/signature-split-screen-ledger.html` — reference snippet
- `marketing/_components/signature-forensic-spec.html` — reference snippet
- `marketing/_components/audience-faq.html` — reference snippet (FAQ accordion + FAQ schema template)

**Modified:**
- `marketing/_partials/_nav.html` — replaced with multi-tier nav (full taxonomy markup, hidden future items)
- `marketing/_partials/_head-common.html` — adds JetBrains Mono font (used by Forensic Spec on Page 3)
- `marketing/css/base.css` — extended with nav dropdown + mobile drawer styles
- `marketing/build.js` — extended with `HERO_IMAGE` / `HERO_IMAGE_MOBILE` metadata token support + missing-image placeholder fallback
- `marketing/_components/who-its-for.html` — homepage cards wrapped in links to `/for-single-households` and `/for-separated-families`
- `marketing/sitemap.xml` — three new URL entries

**Untouched:**
- `marketing/src/index.html` (homepage)
- `marketing/src/privacy-policy.html`, `marketing/src/terms.html`
- All existing `_components/*.html` other than `who-its-for.html`
- `marketing/css/home.css`, `marketing/css/page.css`
- `marketing/data/*.json`

---

## Task ordering rationale

The plan is ordered to **fail fast on infrastructure** before touching content:

1. Build script extension (Task 1) — without `HERO_IMAGE` and placeholder fallback, every page task afterwards would either break or render badly
2. Shared nav (Task 2) — touches every existing page; verify the homepage still renders before adding new pages
3. JetBrains Mono font (Task 3) — required by Page 3's Forensic Spec
4. `page-audience.css` (Task 4) — single CSS file all three new pages depend on
5. Pages 1, 2, 3 (Tasks 5–7) — in increasing complexity (Page 3 has the most unique signature module)
6. Homepage `who-its-for` link update (Task 8) — purely a one-line modification per card
7. Sitemap update (Task 9) — last, after URLs exist
8. Reference snippets (Task 10) — documentation library; pure copy-paste from the live pages, doesn't affect any build output
9. Final integration verification (Task 11) — full local build + visual smoke test

Each task ends with a commit. Implementation TDD discipline maps to: edit → run `node marketing/build.js` → inspect `dist/` output and (for visual tasks) open in a browser → commit.

---

## Task 1: Extend build.js for hero-image preloads and missing-image fallback

**Files:**
- Modify: `marketing/build.js`

**Why:** Audience pages need `<link rel="preload">` hero tags for LCP parity with the homepage. Today only the homepage gets these (hardcoded in `buildHomepageHeadExtras`). We add two new metadata header tokens (`HERO_IMAGE`, `HERO_IMAGE_MOBILE`) that any page can declare to opt in. We also add a placeholder fallback so a page referencing an image that doesn't exist yet renders a grey SVG rectangle instead of breaking the build.

- [ ] **Step 1: Read the current build.js metadata parser**

Confirm the existing parser is at `marketing/build.js:192-200`. Note that meta is built from header `<!-- KEY: value -->` lines.

- [ ] **Step 2: Add `HERO_IMAGE` / `HERO_IMAGE_MOBILE` preload emission helper**

Add this helper function to `marketing/build.js` immediately after the `escapeAttr` function (around line 27):

```javascript
function buildHeroPreloads(meta, srcFile) {
  if (!meta.HERO_IMAGE && !meta.HERO_IMAGE_MOBILE) return '';
  const tags = [];

  const isWebp = (p) => /\.webp(\?.*)?$/i.test(p);
  const preloadAttrs = (href, mediaQuery) => {
    const typeAttr = isWebp(href) ? ' type="image/webp"' : '';
    const mediaAttr = mediaQuery ? ` media="${mediaQuery}"` : '';
    return `<link rel="preload" as="image" href="${escapeAttr(href)}"${typeAttr}${mediaAttr} />`;
  };

  if (meta.HERO_IMAGE_MOBILE) {
    tags.push('  ' + preloadAttrs(meta.HERO_IMAGE_MOBILE, '(max-width: 720px)'));
  }
  if (meta.HERO_IMAGE) {
    const desktopMedia = meta.HERO_IMAGE_MOBILE ? '(min-width: 721px)' : '';
    tags.push('  ' + preloadAttrs(meta.HERO_IMAGE, desktopMedia));
  }

  return '\n  <!-- Hero preload -->\n' + tags.join('\n');
}
```

- [ ] **Step 3: Wire the helper into the page-assembly loop**

In `marketing/build.js`, find the block that assembles `extraHead` (currently lines 240–251). After the `else if (meta.CANONICAL) { ... }` branch and before `extraHead += schemaTag;`, insert a call to the new helper. The relevant section should look like:

```javascript
    // Build OG/Twitter/structured-data block (homepage only, when OG_TITLE present)
    let extraHead = '';
    if (meta.OG_TITLE) {
      extraHead = buildHomepageHeadExtras(pricing)
        .replace(/\{\{CANONICAL\}\}/g, escapeAttr(meta.CANONICAL || ''))
        .replace(/\{\{OG_TITLE\}\}/g, escapeAttr(meta.OG_TITLE || ''))
        .replace(/\{\{OG_DESCRIPTION\}\}/g, escapeAttr(meta.OG_DESCRIPTION || ''))
        .replace(/\{\{OG_IMAGE\}\}/g, escapeAttr(meta.OG_IMAGE || ''));
    } else if (meta.CANONICAL) {
      extraHead = `\n  <link rel="canonical" href="${meta.CANONICAL}" />`;
    }
    extraHead += buildHeroPreloads(meta, file);
    extraHead += schemaTag;
```

Note: we deliberately append `buildHeroPreloads` *after* the OG/canonical block but *before* `schemaTag`, so preload order in the rendered `<head>` is: OG → preloads → schema.

- [ ] **Step 4: Add missing-image placeholder fallback**

Add this helper to `marketing/build.js` (after `buildHeroPreloads`):

```javascript
const PLACEHOLDER_SVG_16_9 = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%23e8e3d6'/%3E%3Ctext x='800' y='460' text-anchor='middle' font-family='DM Sans,sans-serif' font-size='28' fill='%23788'%3EImage placeholder%3C/text%3E%3C/svg%3E`;
const PLACEHOLDER_SVG_3_4  = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1200'%3E%3Crect width='900' height='1200' fill='%23e8e3d6'/%3E%3Ctext x='450' y='620' text-anchor='middle' font-family='DM Sans,sans-serif' font-size='32' fill='%23788'%3EImage placeholder%3C/text%3E%3C/svg%3E`;

function substituteMissingImages(html, srcFile) {
  // Match img src="/Images/..." or src="/foo.webp" — anything starting with /
  return html.replace(/(src|srcset)="(\/[^"]+\.(?:png|jpg|jpeg|webp|svg))"/g, (full, attr, href) => {
    // Strip query string if any
    const cleanHref = href.split('?')[0];
    // Resolve against marketing/ root
    const fsPath = path.join(ROOT, cleanHref.replace(/^\//, ''));
    if (fs.existsSync(fsPath)) return full;
    // Pick aspect by filename hint
    const isPortrait = /_3_4|portrait|_3x4/i.test(cleanHref);
    const sub = isPortrait ? PLACEHOLDER_SVG_3_4 : PLACEHOLDER_SVG_16_9;
    console.log(`[build] ! placeholder for missing image: ${cleanHref} (in ${srcFile})`);
    return `${attr}="${sub}"`;
  });
}
```

- [ ] **Step 5: Call the placeholder substitution after token resolution**

In the page-assembly loop, find the line that resolves `{{data:...}}` tokens (currently around line 217). Immediately after the data-token resolution block and before the script extraction, add:

```javascript
    // Substitute placeholder SVGs for any image src that does not exist on disk
    body = substituteMissingImages(body, file);
```

- [ ] **Step 6: Verify the homepage still builds unchanged**

Run:

```
node marketing/build.js
```

Expected output includes `[build] ✓ index.html`. Open `marketing/dist/index.html` and confirm:
- The hero preload tags for `/hero-orchard-portrait.webp` and `/hero-orchard_3_2.webp` are still present (these come from `buildHomepageHeadExtras`, untouched)
- No new preload tags appear for the homepage (the homepage source has no `HERO_IMAGE` token in its header — that's the test that opt-in works)
- No `[build] ! placeholder` warnings (homepage references only existing images)

If preload tags or any homepage content has changed unexpectedly, revert and re-check the helper insertion order.

- [ ] **Step 7: Commit**

```
git add marketing/build.js
git commit -m "feat(marketing): add HERO_IMAGE preloads and missing-image placeholder fallback to build.js"
```

---

## Task 2: Replace `_nav.html` with multi-tier nav (full taxonomy, hidden future items)

**Files:**
- Modify: `marketing/_partials/_nav.html`
- Modify: `marketing/css/base.css` (append new nav-tier styles)

**Why:** The shared nav is the structural backbone of every page on the site. Build it once with the full future taxonomy in markup, hide unbuilt items via `hidden` attribute. Activating a future page becomes a one-line edit.

- [ ] **Step 1: Replace `_nav.html` with the new multi-tier markup**

Overwrite the entire contents of `marketing/_partials/_nav.html` with:

```html
  <!-- ── Nav ── -->
  <nav id="nav" aria-label="Main">
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

    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-drawer" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>

    <ul class="nav-list" id="nav-drawer" role="menubar">
      <li class="nav-group" data-group="features" hidden>
        <button class="nav-trigger" type="button" aria-expanded="false" aria-haspopup="true">Features
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="nav-panel" role="menu">
          <li><a href="/features/chore-tracker" role="menuitem">Chore Tracker</a></li>
          <li><a href="/features/learning-lab" role="menuitem">Learning Lab</a></li>
          <li><a href="/features/ai-mentor" role="menuitem">AI Mentor</a></li>
          <li><a href="/features/cryptographic-reports" role="menuitem">Cryptographic Reports</a></li>
        </ul>
      </li>

      <li class="nav-group" data-group="who">
        <button class="nav-trigger" type="button" aria-expanded="false" aria-haspopup="true">Who it&rsquo;s for
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="nav-panel" role="menu">
          <li><a href="/for-single-households.html" role="menuitem">One home</a></li>
          <li><a href="/for-separated-families.html" role="menuitem">Separated families</a></li>
        </ul>
      </li>

      <li class="nav-group" data-group="resources" hidden>
        <button class="nav-trigger" type="button" aria-expanded="false" aria-haspopup="true">Resources
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="nav-panel" role="menu">
          <li><a href="/resources/knowledge-base" role="menuitem">Knowledge base</a></li>
          <li><a href="/resources/blog" role="menuitem">Blog</a></li>
          <li><a href="/resources/press" role="menuitem">Press</a></li>
        </ul>
      </li>

      <li class="nav-item" data-group="pricing" hidden>
        <a href="/pricing" role="menuitem">Pricing</a>
      </li>

      <li class="nav-item" data-group="professionals">
        <a href="/for-professionals.html" role="menuitem">For Professionals</a>
      </li>
    </ul>

    <a class="btn-primary nav-cta" href="/#signup">
      Register interest
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  </nav>

  <script>
    (function () {
      const nav = document.getElementById('nav');
      if (!nav) return;
      const toggle = nav.querySelector('.nav-toggle');
      const drawer = nav.querySelector('#nav-drawer');
      const groups = nav.querySelectorAll('.nav-group');

      function setOpen(open) {
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
      }

      toggle.addEventListener('click', function () {
        setOpen(!nav.classList.contains('is-open'));
      });

      groups.forEach(function (group) {
        const trigger = group.querySelector('.nav-trigger');
        if (!trigger) return;
        trigger.addEventListener('click', function (e) {
          e.stopPropagation();
          const open = group.classList.toggle('is-expanded');
          trigger.setAttribute('aria-expanded', String(open));
          // Close siblings on desktop only
          if (window.matchMedia('(min-width: 920px)').matches) {
            groups.forEach(function (g) {
              if (g !== group) {
                g.classList.remove('is-expanded');
                const t = g.querySelector('.nav-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
              }
            });
          }
        });
      });

      document.addEventListener('click', function (e) {
        if (!nav.contains(e.target)) {
          groups.forEach(function (g) {
            g.classList.remove('is-expanded');
            const t = g.querySelector('.nav-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (nav.classList.contains('is-open')) setOpen(false);
          groups.forEach(function (g) {
            g.classList.remove('is-expanded');
            const t = g.querySelector('.nav-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });

      drawer.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && nav.classList.contains('is-open')) setOpen(false);
      });

      // Mark current page link
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      drawer.querySelectorAll('a').forEach(function (a) {
        const href = a.getAttribute('href') || '';
        const target = href.replace(/\/$/, '') || '/';
        if (target === path || (target === '/for-single-households.html' && path.endsWith('for-single-households.html'))) {
          a.setAttribute('aria-current', 'page');
        }
      });

      // Scrolled state shadow (same behaviour as before)
      function onScroll() {
        if (window.scrollY > 8) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    })();
  </script>
```

- [ ] **Step 2: Append new nav styles to `base.css`**

Append the following CSS block to the end of `marketing/css/base.css`:

```css
/* ── Nav: multi-tier dropdowns + mobile drawer ── */
.nav-list {
  display: flex;
  align-items: center;
  gap: 4px;
  list-style: none;
  margin: 0 auto 0 32px;
}
.nav-group, .nav-item {
  position: relative;
}
.nav-trigger,
.nav-item > a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 0;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 500;
  color: var(--text-dark);
  padding: 10px 14px;
  border-radius: 8px;
  text-decoration: none;
  letter-spacing: 0.01em;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.nav-trigger:hover,
.nav-item > a:hover { color: var(--teal); background-color: rgba(0,149,156,0.06); }
.nav-trigger svg { transition: transform 0.2s ease; }
.nav-group.is-expanded .nav-trigger svg { transform: rotate(180deg); }
.nav-list [aria-current="page"] { color: var(--teal); }
.nav-list [aria-current="page"]::after {
  content: '';
  display: block;
  position: absolute;
  left: 14px; right: 14px; bottom: 4px;
  height: 1.5px;
  background: var(--teal);
}

.nav-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 220px;
  list-style: none;
  margin: 0;
  padding: 8px;
  background: var(--bg-cream);
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
  box-shadow: 0 8px 24px rgba(27,45,46,0.08);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
}
.nav-group.is-expanded .nav-panel {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.nav-panel a {
  display: block;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-dark);
  text-decoration: none;
  border-radius: 6px;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-panel a:hover { background: rgba(0,149,156,0.08); color: var(--teal); }

.nav-cta { flex-shrink: 0; }

.nav-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px; height: 40px;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 8px;
}
.nav-toggle span {
  display: block;
  width: 22px;
  height: 1.6px;
  background: var(--text-dark);
  border-radius: 1px;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
nav.is-open .nav-toggle span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
nav.is-open .nav-toggle span:nth-child(2) { opacity: 0; }
nav.is-open .nav-toggle span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

@media (max-width: 919px) {
  .nav-list {
    position: fixed;
    top: var(--h-nav);
    left: 0; right: 0; bottom: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    margin: 0;
    padding: 24px var(--pad-x);
    background: var(--bg-cream);
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
    border-top: 1px solid var(--border-light);
  }
  nav.is-open .nav-list { transform: translateX(0); }
  .nav-toggle { display: inline-flex; }
  .nav-cta { display: none; }
  nav.is-open .nav-list::after {
    content: 'Register interest';
    display: block;
    margin-top: auto;
    padding: 14px 22px;
    background: var(--teal);
    color: #fff;
    border-radius: var(--r-pill);
    font-weight: 500;
    text-align: center;
  }
  /* Hide nav-cta on mobile, but provide a real link instead */
  nav.is-open .nav-list { padding-bottom: 80px; }
  .nav-trigger, .nav-item > a {
    width: 100%;
    justify-content: space-between;
    padding: 16px 4px;
    font-size: 17px;
    border-radius: 0;
    border-bottom: 1px solid var(--border-light);
  }
  .nav-panel {
    position: static;
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: none;
    box-shadow: none;
    border: 0;
    background: transparent;
    padding: 0 0 8px 12px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }
  .nav-group.is-expanded .nav-panel {
    max-height: 400px;
  }
  .nav-panel a { font-size: 15px; padding: 10px 8px; }
}

body.dark .nav-trigger,
body.dark .nav-item > a { color: var(--text-light); }
body.dark .nav-panel { background: var(--bg-dark); border-color: var(--border-dark); }
body.dark .nav-panel a { color: var(--text-light); }
body.dark .nav-toggle span { background: var(--text-light); }
@media (max-width: 919px) {
  body.dark .nav-list { background: var(--bg-dark); }
}

[hidden] { display: none !important; }
```

Note the final `[hidden]` rule is a safety net — some old browsers don't honour the `hidden` attribute on flex children.

- [ ] **Step 3: Run the build and verify the homepage still renders**

```
node marketing/build.js
```

Expected: `[build] ✓ index.html`, `[build] ✓ privacy-policy.html`, `[build] ✓ terms.html` all succeed.

- [ ] **Step 4: Visually verify the homepage with the new nav**

Open `marketing/dist/index.html` in a browser. Verify:
- Desktop (≥920px): logo on left, two visible nav groups in the centre ("Who it's for" and "For Professionals"), Register interest CTA on the right. Features / Resources / Pricing are not visible.
- Click "Who it's for" → dropdown shows "One home" and "Separated families".
- Mobile (<920px, use browser devtools): hamburger toggles a full-screen drawer. Tap "Who it's for" → accordion expands.

- [ ] **Step 5: Commit**

```
git add marketing/_partials/_nav.html marketing/css/base.css
git commit -m "feat(marketing): multi-tier shared nav with hidden future taxonomy"
```

---

## Task 3: Add JetBrains Mono font for the Forensic Spec block

**Files:**
- Modify: `marketing/_partials/_head-common.html`

**Why:** Page 3's Forensic Spec uses JetBrains Mono for the value column (brand-book technical/data typeface). Adding to `_head-common.html` ensures every page can use it — but it's only weighted onto the Forensic Spec component so it doesn't bloat the homepage perceived load.

- [ ] **Step 1: Update the Google Fonts link**

In `marketing/_partials/_head-common.html`, replace the fonts line (line 19):

```html
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap" rel="stylesheet" />
```

With:

```html
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Verify**

```
node marketing/build.js
```

Open `marketing/dist/index.html`. Confirm the fonts link in the head now requests JetBrains Mono. The homepage looks unchanged (it doesn't use that font yet).

- [ ] **Step 3: Commit**

```
git add marketing/_partials/_head-common.html
git commit -m "feat(marketing): add JetBrains Mono for forensic spec block"
```

---

## Task 4: Create `page-audience.css` — audience-page layout + signature modules

**Files:**
- Create: `marketing/css/page-audience.css`

**Why:** A single, focused stylesheet loaded only on the three audience pages. Carries the section spacing scale, hero, intro, benefits grid, three signature modules, FAQ accordion, sample-PDF preview, and Shield AI callout. The homepage and inner pages are unaffected.

- [ ] **Step 1: Create the file with all required styles**

Create `marketing/css/page-audience.css` with the following contents:

```css
/* ── Audience page — base layout ── */
.audience-page { padding-top: var(--h-nav); }

.audience-page .container { max-width: var(--max-w); margin: 0 auto; padding: 0 var(--pad-x); }

.audience-section { padding: 88px 0; }
@media (max-width: 720px) { .audience-section { padding: 56px 0; } }

.audience-section .section-label {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--teal);
  margin-bottom: 16px;
}
.audience-section .section-headline {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1.18;
  letter-spacing: -0.01em;
  color: var(--text-dark);
  max-width: 720px;
  margin-bottom: 18px;
}
.audience-section .section-sub {
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-sub);
  max-width: 640px;
  margin-bottom: 12px;
}

/* ── Hero ── */
.audience-hero {
  position: relative;
  min-height: 78vh;
  display: flex;
  align-items: flex-end;
  padding: 64px var(--pad-x) 80px;
  overflow: hidden;
  margin-top: calc(var(--h-nav) * -1);
}
.audience-hero img.hero-img {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  z-index: 0;
}
.audience-hero .hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(27,45,46,0.10) 0%, rgba(27,45,46,0.55) 60%, rgba(27,45,46,0.78) 100%);
  z-index: 1;
}
.audience-hero .hero-content {
  position: relative;
  z-index: 2;
  max-width: 760px;
  color: #fff;
  margin: 0 auto;
  width: 100%;
}
.audience-hero .hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 500;
  color: #fff;
  margin-bottom: 18px;
  backdrop-filter: blur(6px);
}
.audience-hero .hero-badge-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--gold);
}
.audience-hero h1 {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(34px, 5.2vw, 60px);
  line-height: 1.05;
  letter-spacing: -0.015em;
  margin-bottom: 18px;
}
.audience-hero h1 em { font-style: italic; color: var(--gold); }
.audience-hero .hero-sub {
  font-size: clamp(16px, 1.7vw, 20px);
  line-height: 1.55;
  max-width: 600px;
  color: rgba(255,255,255,0.92);
  margin-bottom: 28px;
}
.audience-hero .hero-actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.audience-hero .hero-note {
  font-size: 13px;
  color: rgba(255,255,255,0.72);
}

/* ── Editorial intro ── */
.audience-intro {
  padding: 72px 0 24px;
}
.audience-intro p {
  font-family: var(--font-display);
  font-size: clamp(20px, 2.2vw, 24px);
  line-height: 1.45;
  color: var(--text-dark);
  max-width: 720px;
  margin: 0 auto 18px;
  text-align: center;
}
.audience-intro p:last-child {
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--text-sub);
  line-height: 1.6;
}

/* ── Benefits grid ── */
.audience-benefits-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-top: 40px;
}
@media (max-width: 960px) { .audience-benefits-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .audience-benefits-grid { grid-template-columns: 1fr; } }

.benefit-card {
  background: var(--bg-cream);
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.benefit-card:hover {
  border-color: var(--teal);
  transform: translateY(-2px);
}
.benefit-card .benefit-lens {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--teal);
}
.benefit-card .benefit-feature {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub);
}
.benefit-card .benefit-headline {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  line-height: 1.25;
  color: var(--text-dark);
}
.benefit-card .benefit-body {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--text-sub);
}

/* ── Signature: Day in the life (Page 1) ── */
.signature-day {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-top: 32px;
}
@media (max-width: 900px) { .signature-day { grid-template-columns: 1fr; gap: 14px; } }

.day-card {
  background: var(--card-light);
  border-radius: var(--r-card);
  padding: 22px;
  position: relative;
}
.day-card .day-time {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--teal);
  margin-bottom: 14px;
}
.day-card .day-role {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-dark);
  margin-bottom: 8px;
}
.day-card .day-role .day-icon { margin-right: 6px; }
.day-card .day-role strong { font-weight: 500; }

.signature-day-caption {
  text-align: center;
  font-family: var(--font-display);
  font-size: 18px;
  font-style: italic;
  color: var(--text-sub);
  margin-top: 32px;
}

/* ── Signature: Split-screen ledger (Page 2) ── */
.signature-ledger {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 18px;
  margin-top: 32px;
  align-items: stretch;
}
@media (max-width: 900px) { .signature-ledger { grid-template-columns: 1fr; } }

.ledger-col {
  background: var(--card-light);
  border-radius: var(--r-card);
  padding: 22px;
  display: flex;
  flex-direction: column;
}
.ledger-col.parent-a { border-left: 3px solid var(--teal); }
.ledger-col.parent-b { border-left: 3px solid var(--gold); }
.ledger-col .ledger-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-sub);
  margin-bottom: 14px;
}
.ledger-col .ledger-entry {
  font-size: 14px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-light);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.ledger-col .ledger-entry:last-of-type { border-bottom: 0; }
.ledger-col .ledger-total {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-sub);
}
.ledger-col .ledger-total strong {
  display: block;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--text-dark);
  margin-top: 4px;
}

.ledger-col.shared {
  background: var(--bg-dark);
  color: var(--text-light);
}
.ledger-col.shared .ledger-label { color: var(--gold); }
.ledger-col.shared .ledger-entry {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  border-bottom-color: rgba(255,255,255,0.08);
}
.ledger-col.shared .ledger-hash { color: var(--gold); }
.ledger-col.shared .ledger-total { color: rgba(237,237,240,0.65); border-top-color: rgba(255,255,255,0.12); }
.ledger-col.shared .ledger-total strong { color: var(--text-light); }

.signature-ledger-caption {
  margin-top: 24px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--text-sub);
  text-align: center;
  max-width: 760px;
  margin-left: auto;
  margin-right: auto;
}

/* ── Signature: Forensic Spec (Page 3) ── */
.signature-forensic {
  background: var(--bg-dark);
  color: var(--text-light);
  border-radius: var(--r-card);
  padding: 36px;
  margin-top: 32px;
}
.signature-forensic .forensic-header {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 8px;
}
.signature-forensic h3 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 500;
  color: var(--text-light);
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}
.forensic-grid {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 10px 24px;
}
@media (max-width: 720px) { .forensic-grid { grid-template-columns: 1fr; gap: 4px 0; } }
.forensic-grid dt {
  font-size: 13px;
  color: rgba(237,237,240,0.62);
  padding: 8px 0;
}
.forensic-grid dd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13.5px;
  color: var(--text-light);
  padding: 8px 0;
}
@media (max-width: 720px) {
  .forensic-grid dt { padding: 10px 0 2px; color: var(--gold); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }
  .forensic-grid dd { padding: 0 0 12px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 4px; }
}
.forensic-grid dt + dd + dt { border-top: none; }
.signature-forensic .forensic-disclaimer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 12px;
  font-style: italic;
  color: rgba(237,237,240,0.6);
}

/* ── Is / Isn't spec table (Page 3) ── */
.audience-spec-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 32px;
}
@media (max-width: 720px) { .audience-spec-cols { grid-template-columns: 1fr; } }
.spec-col {
  background: var(--bg-cream);
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
  padding: 24px;
}
.spec-col h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 14px;
}
.spec-col.positive h3 { color: var(--teal); }
.spec-col.negative h3 { color: var(--text-sub); }
.spec-col ul { list-style: none; }
.spec-col li {
  padding: 8px 0;
  font-size: 15px;
  color: var(--text-dark);
  border-bottom: 1px dashed var(--border-light);
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.spec-col li:last-child { border-bottom: 0; }
.spec-col li::before {
  content: '';
  flex-shrink: 0;
  margin-top: 9px;
  width: 6px; height: 6px;
  border-radius: 50%;
}
.spec-col.positive li::before { background: var(--teal); }
.spec-col.negative li::before { background: var(--text-sub); opacity: 0.5; }

/* ── How-to / Case cards row ── */
.audience-cases {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 32px;
}
@media (max-width: 800px) { .audience-cases { grid-template-columns: 1fr; } }
.case-card {
  background: var(--card-light);
  border-radius: var(--r-card);
  padding: 24px;
}
.case-card .case-step {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--teal);
  margin-bottom: 12px;
}
.case-card h3 {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 500;
  margin-bottom: 10px;
  line-height: 1.25;
  color: var(--text-dark);
}
.case-card p {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--text-sub);
}

/* ── 3-step (Plant / Tend / Harvest) ── */
.audience-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  margin-top: 32px;
  counter-reset: step;
}
@media (max-width: 800px) { .audience-steps { grid-template-columns: 1fr; } }
.step-card {
  position: relative;
  padding: 28px 24px 24px;
  background: var(--bg-cream);
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
}
.step-card::before {
  counter-increment: step;
  content: counter(step, decimal-leading-zero);
  position: absolute;
  top: -16px;
  left: 22px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  color: var(--gold);
  background: var(--bg-cream);
  padding: 0 8px;
}
.step-card h3 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 10px;
  color: var(--text-dark);
}
.step-card p {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--text-sub);
}

/* ── Wide image block ── */
.audience-image-wide {
  margin: 40px 0;
  border-radius: var(--r-card);
  overflow: hidden;
}
.audience-image-wide picture, .audience-image-wide img {
  display: block;
  width: 100%;
  height: auto;
}

/* ── Shield AI callout (Page 2) ── */
.audience-callout {
  margin-top: 32px;
  padding: 32px;
  border-radius: var(--r-card);
  border: 2px solid var(--teal);
  background: rgba(0,149,156,0.04);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: center;
}
@media (max-width: 720px) { .audience-callout { grid-template-columns: 1fr; } }
.audience-callout .callout-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--teal);
}
.audience-callout h3 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  margin: 6px 0 8px;
}
.audience-callout p { font-size: 15px; line-height: 1.55; color: var(--text-sub); }
.audience-callout .callout-price {
  text-align: right;
  font-family: var(--font-display);
  font-size: 38px;
  font-weight: 500;
  color: var(--text-dark);
  white-space: nowrap;
}
.audience-callout .callout-price small {
  display: block;
  font-size: 12px;
  font-family: var(--font-body);
  color: var(--text-sub);
  font-weight: 400;
}

/* ── Sample PDF preview (Page 3) ── */
.sample-pdf {
  background: #fdfdfa;
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
  padding: 40px;
  max-width: 720px;
  margin: 32px auto 0;
  box-shadow: 0 12px 40px rgba(27,45,46,0.08), 0 2px 6px rgba(27,45,46,0.04);
}
.sample-pdf .pdf-header {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  margin-bottom: 4px;
}
.sample-pdf .pdf-subtitle { font-size: 13px; color: var(--text-sub); margin-bottom: 28px; }
.sample-pdf .pdf-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  border-bottom: 1px dashed var(--border-light);
}
.sample-pdf .pdf-row:last-of-type { border-bottom: 0; }
.sample-pdf .pdf-seal {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--border-light);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-sub);
}
.sample-pdf .pdf-seal .seal-hash { color: var(--gold); font-weight: 500; }
.sample-pdf-caption {
  margin-top: 18px;
  font-size: 13.5px;
  color: var(--text-sub);
  text-align: center;
  font-style: italic;
}

/* ── How-to-recommend row (Page 3) ── */
.recommend-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 32px;
}
@media (max-width: 800px) { .recommend-row { grid-template-columns: 1fr; } }
.recommend-card {
  border: 1px solid var(--border-light);
  border-radius: var(--r-card);
  padding: 24px;
}
.recommend-card h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--teal);
}
.recommend-card p { font-size: 14.5px; line-height: 1.55; color: var(--text-sub); }

/* ── FAQ ── */
.audience-faq { margin-top: 24px; max-width: 760px; margin-left: auto; margin-right: auto; }
.audience-faq details {
  border-bottom: 1px solid var(--border-light);
  padding: 18px 0;
}
.audience-faq summary {
  list-style: none;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  color: var(--text-dark);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.audience-faq summary::-webkit-details-marker { display: none; }
.audience-faq summary::after {
  content: '+';
  font-size: 22px;
  color: var(--teal);
  transition: transform 0.2s ease;
}
.audience-faq details[open] summary::after { content: '\2013'; }
.audience-faq .faq-answer {
  margin-top: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-sub);
}

/* ── Why-Morechard strip (page-audience variant — distinct from homepage) ── */
.audience-why {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 32px;
}
@media (max-width: 900px) { .audience-why { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .audience-why { grid-template-columns: 1fr; } }
.audience-why .why-tile {
  padding: 22px;
  background: var(--card-light);
  border-radius: var(--r-card);
}
.audience-why .why-tile .why-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 8px;
}
.audience-why .why-tile .why-body { font-size: 14px; line-height: 1.5; color: var(--text-sub); }
```

- [ ] **Step 2: Verify by building (the file is not yet referenced anywhere, so should just be copied to dist)**

```
node marketing/build.js
```

Confirm `marketing/dist/css/page-audience.css` exists after the build.

- [ ] **Step 3: Commit**

```
git add marketing/css/page-audience.css
git commit -m "feat(marketing): add page-audience.css for audience landing pages"
```

---

## Task 5: Build Page 1 — `for-single-households.html`

**Files:**
- Create: `marketing/src/for-single-households.html`

**Why:** Direct-to-consumer landing page for single-household / nuclear families. SEO + conversion. Signature module: "A day with Morechard" 4-card timeline.

- [ ] **Step 1: Create the page file**

Create `marketing/src/for-single-households.html` with the following contents:

```html
<!--
  TITLE: Chore & Pocket Money App for Families | Morechard
  DESCRIPTION: The chore tracker that turns daily responsibilities into real financial literacy. No debit card. No subscription. Built for any family, from day one.
  CANONICAL: https://morechard.com/for-single-households
  PAGE_CSS: page-audience.css
  HERO_IMAGE: /Images/single-household_16_9.png
  HERO_IMAGE_MOBILE: /Images/single-household_3_4.png
-->

<!-- SCHEMA_START -->
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What age is Morechard for?", "acceptedAnswer": { "@type": "Answer", "text": "Morechard is built for children aged 6 to 16, with an age-aware experience that grows with them — from the friendly Seedling view for younger children to the strategic Professional view for teens." } },
    { "@type": "Question", "name": "Do we need a bank account or debit card?", "acceptedAnswer": { "@type": "Answer", "text": "No. Morechard works entirely without a debit card or children's bank account. Pocket money is tracked in a live ledger inside the app; parents can pay out via existing methods like bank transfer, Monzo, or cash when funds are claimed." } },
    { "@type": "Question", "name": "How does pocket money actually get paid?", "acceptedAnswer": { "@type": "Answer", "text": "Morechard tracks every approved chore and updates your child's balance instantly. When your child wants to claim, you choose how to pay — bank transfer, Monzo, PayPal, or cash. Morechard records the payment and locks the entry into the ledger." } },
    { "@type": "Question", "name": "What if my child loses interest after a week?", "acceptedAnswer": { "@type": "Answer", "text": "Morechard is designed to land at exactly the right moment — your child's real earnings trigger short, age-appropriate Learning Lab modules and weekly AI Mentor briefings, so engagement is renewed by the data they recognise as their own, not by gamification gimmicks." } },
    { "@type": "Question", "name": "How is this different from a sticker chart or a spreadsheet?", "acceptedAnswer": { "@type": "Answer", "text": "A sticker chart rewards a task. Morechard teaches the financial system behind the task — effort to earn, opportunity cost, patience, compound growth — using your child's real data and a tamper-proof ledger that grows over years." } },
    { "@type": "Question", "name": "Is my child's data safe?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Morechard is GDPR and COPPA-compliant by design. Children are identified only by nickname; no surnames, addresses, or payment details are stored against a child profile. All data sits on UK or EU servers and belongs to your family." } }
  ]
}
<!-- SCHEMA_END -->

<!-- BODY_START -->
<main class="audience-page">

  <!-- ── Hero ── -->
  <section class="audience-hero" id="hero">
    <picture>
      <source media="(max-width: 720px)" srcset="/Images/single-household_3_4.png" />
      <img class="hero-img" src="/Images/single-household_16_9.png" alt="A parent and child sitting together checking off chores on a phone, warm natural light" loading="eager" />
    </picture>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div class="hero-badge reveal">
        <span class="hero-badge-dot"></span>
        For single households
      </div>
      <h1 class="reveal d1">The chore tracker that turns daily life into a <em>lifetime of financial confidence.</em></h1>
      <p class="hero-sub reveal d2">Pocket money that works without a debit card. Chores your child actually does. A weekly AI Mentor briefing written for them, grounded in what they really earned and spent. Built for any family, from day one.</p>
      <div class="hero-actions reveal d3">
        <a href="#signup" class="btn-primary btn-hero">
          Register my interest
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <span class="hero-note">No spam &mdash; one email at launch.</span>
      </div>
    </div>
  </section>

  <!-- ── Editorial intro ── -->
  <section class="audience-section audience-intro">
    <div class="container">
      <p class="reveal">Every family has the same Sunday-night conversation. <em>Did you do your chores? When? Are you sure?</em></p>
      <p class="reveal d1">Morechard ends it. One shared, calm, honest record of what your child did, what they earned, and what they&rsquo;re learning about money along the way.</p>
    </div>
  </section>

  <!-- ── Benefits grid ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Why families choose Morechard</span>
      <h2 class="section-headline reveal">Everyday chores. Lifelong financial habits.</h2>
      <p class="section-sub reveal">Six ways Morechard turns daily responsibility into long-term financial confidence &mdash; without a debit card, without a subscription, without the nagging.</p>

      <div class="audience-benefits-grid">
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">Immutable ledger</span>
          <h3 class="benefit-headline">Never argue about chores again.</h3>
          <p class="benefit-body">Every approved job is timestamped and locked. No more &ldquo;but I did it yesterday&rdquo; or &ldquo;I never agreed to that rate.&rdquo;</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Competitive</span>
          <span class="benefit-feature">Streaks &amp; velocity</span>
          <h3 class="benefit-headline">Build the habits that compound for life.</h3>
          <p class="benefit-body">Children see their streak grow with every approved task &mdash; the same dopamine loop that builds lifelong financial discipline.</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Spontaneous</span>
          <span class="benefit-feature">Goal planning &middot; Savings Grove</span>
          <h3 class="benefit-headline">Turn &ldquo;I want it now&rdquo; into &ldquo;I earned it.&rdquo;</h3>
          <p class="benefit-body">The Savings Grove transforms impulse wants into achievable goals &mdash; your child plans the route from chore to checkout.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Humanistic</span>
          <span class="benefit-feature">AI Mentor briefings</span>
          <h3 class="benefit-headline">A weekly financial literacy lesson, written for your child.</h3>
          <p class="benefit-body">Every Sunday, the Orchard Lead reviews your child&rsquo;s week and surfaces one teachable moment &mdash; grounded in their real earnings, not generic content.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">No debit card</span>
          <h3 class="benefit-headline">Pocket money that works without a bank account.</h3>
          <p class="benefit-body">Skip the card fees, the upsells, and the parental anxiety. Morechard works for any child, of any age, from day one.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Humanistic</span>
          <span class="benefit-feature">Choice Architect parent role</span>
          <h3 class="benefit-headline">You stay in charge &mdash; the app does the policing.</h3>
          <p class="benefit-body">Set the rules, set the rates, approve the work. Morechard removes the nagging and gives you back the relationship.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ── Signature: Day in the life ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">A day with Morechard</span>
      <h2 class="section-headline reveal">Less nagging. More noticing.</h2>
      <p class="section-sub reveal">A simple loop, designed to disappear into the rhythm of your family&rsquo;s day.</p>

      <div class="signature-day">
        <div class="day-card reveal d1">
          <div class="day-time">7:30 am</div>
          <p class="day-role"><span class="day-icon">&#127793;</span><strong>Parent:</strong> Set today&rsquo;s chores in 20 seconds.</p>
          <p class="day-role"><span class="day-icon">&#127822;</span><strong>Child:</strong> Sees the list &mdash; and the rate.</p>
        </div>
        <div class="day-card reveal d2">
          <div class="day-time">After school</div>
          <p class="day-role"><span class="day-icon">&#127793;</span><strong>Parent:</strong> &mdash;</p>
          <p class="day-role"><span class="day-icon">&#127822;</span><strong>Child:</strong> Marks bed and rubbish done. Live confirmation.</p>
        </div>
        <div class="day-card reveal d3">
          <div class="day-time">6:00 pm</div>
          <p class="day-role"><span class="day-icon">&#127793;</span><strong>Parent:</strong> Approves from your phone.</p>
          <p class="day-role"><span class="day-icon">&#127822;</span><strong>Child:</strong> Watches the balance tick up.</p>
        </div>
        <div class="day-card reveal d4">
          <div class="day-time">Sunday</div>
          <p class="day-role"><span class="day-icon">&#127793;</span><strong>Parent:</strong> Reads the AI Mentor&rsquo;s briefing.</p>
          <p class="day-role"><span class="day-icon">&#127822;</span><strong>Child:</strong> Plans next week&rsquo;s goal together.</p>
        </div>
      </div>
      <p class="signature-day-caption reveal">No nagging. No spreadsheets. No &ldquo;did you?&rdquo; conversations.</p>
    </div>
  </section>

  <!-- ── 3-step (Plant / Tend / Harvest) ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">How it works</span>
      <h2 class="section-headline reveal">Plant. Tend. Harvest.</h2>
      <p class="section-sub reveal">Three steps that turn into a habit. The Orchard does the rest.</p>

      <div class="audience-steps">
        <div class="step-card reveal d1">
          <h3>Plant</h3>
          <p>Add your child, set their chores, and choose a rate. Use our Rate Guide if you&rsquo;re not sure what&rsquo;s fair &mdash; it benchmarks every chore against real-market data.</p>
        </div>
        <div class="step-card reveal d2">
          <h3>Tend</h3>
          <p>Your child marks jobs done as they go. You approve from the kitchen, the office, or the school run. Every approved chore lands in the ledger.</p>
        </div>
        <div class="step-card reveal d3">
          <h3>Harvest</h3>
          <p>Pocket money grows in real time. Savings goals become achievable. Lessons land at exactly the right moment in your child&rsquo;s journey.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Wide image placeholder ── -->
  <section class="audience-section" style="padding:24px 0 56px;">
    <div class="container">
      <!-- TODO: replace placeholder. Generate at 1600x900 (16/9) for desktop and 900x1200 (3/4) for mobile. Alt: "A parent and child in a sunlit kitchen, the child holding a phone showing the Morechard app, the parent approving a chore — warm, candid, naturalistic." -->
      <div class="audience-image-wide reveal">
        <picture>
          <source media="(max-width: 720px)" srcset="/Images/single-household-kitchen_3_4.png" />
          <img src="/Images/single-household-kitchen_16_9.png" alt="A parent and child in a sunlit kitchen, the child holding a phone showing the Morechard app, the parent approving a chore" loading="lazy" />
        </picture>
      </div>
    </div>
  </section>

  <!-- ── Why Morechard strip ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">Why Morechard</span>
      <h2 class="section-headline reveal">A different kind of pocket money app.</h2>
      <div class="audience-why">
        <div class="why-tile reveal d1">
          <div class="why-title">No debit card</div>
          <p class="why-body">Works for any child, any age, with no card fees or bank account hoops.</p>
        </div>
        <div class="why-tile reveal d2">
          <div class="why-title">No subscription</div>
          <p class="why-body">One-time payment from &pound;44.99. No monthly drip. Nothing to cancel.</p>
        </div>
        <div class="why-tile reveal d3">
          <div class="why-title">Real-data literacy</div>
          <p class="why-body">Financial lessons triggered by your child&rsquo;s own earning and spending &mdash; not generic slides.</p>
        </div>
        <div class="why-tile reveal d4">
          <div class="why-title">Bank-grade integrity</div>
          <p class="why-body">Every ledger entry sealed with a cryptographic fingerprint. Nothing can be edited or deleted.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FAQ ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Common questions</span>
      <h2 class="section-headline reveal">Everything parents ask first.</h2>

      <div class="audience-faq">
        <details class="reveal">
          <summary>What age is Morechard for?</summary>
          <div class="faq-answer">Morechard is built for children aged 6 to 16, with an age-aware experience that grows with them &mdash; from the friendly Seedling view for younger children to the strategic Professional view for teens.</div>
        </details>
        <details class="reveal">
          <summary>Do we need a bank account or debit card?</summary>
          <div class="faq-answer">No. Morechard works entirely without a debit card or children&rsquo;s bank account. Pocket money is tracked in a live ledger inside the app; parents can pay out via existing methods like bank transfer, Monzo, or cash when funds are claimed.</div>
        </details>
        <details class="reveal">
          <summary>How does pocket money actually get paid?</summary>
          <div class="faq-answer">Morechard tracks every approved chore and updates your child&rsquo;s balance instantly. When your child wants to claim, you choose how to pay &mdash; bank transfer, Monzo, PayPal, or cash. Morechard records the payment and locks the entry into the ledger.</div>
        </details>
        <details class="reveal">
          <summary>What if my child loses interest after a week?</summary>
          <div class="faq-answer">Morechard is designed to land at exactly the right moment &mdash; your child&rsquo;s real earnings trigger short, age-appropriate Learning Lab modules and weekly AI Mentor briefings, so engagement is renewed by the data they recognise as their own, not by gamification gimmicks.</div>
        </details>
        <details class="reveal">
          <summary>How is this different from a sticker chart or a spreadsheet?</summary>
          <div class="faq-answer">A sticker chart rewards a task. Morechard teaches the financial system behind the task &mdash; effort to earn, opportunity cost, patience, compound growth &mdash; using your child&rsquo;s real data and a tamper-proof ledger that grows over years.</div>
        </details>
        <details class="reveal">
          <summary>Is my child&rsquo;s data safe?</summary>
          <div class="faq-answer">Yes. Morechard is GDPR and COPPA-compliant by design. Children are identified only by nickname; no surnames, addresses, or payment details are stored against a child profile. All data sits on UK or EU servers and belongs to your family.</div>
        </details>
      </div>
    </div>
  </section>

  {{component:register-interest}}

</main>
<!-- BODY_END -->
```

- [ ] **Step 2: Build the site**

```
node marketing/build.js
```

Expected: `[build] ✓ for-single-households.html`. You may see a `[build] ! placeholder: /Images/single-household-kitchen_16_9.png` warning &mdash; that's expected; the mid-page lifestyle photo doesn&rsquo;t exist yet, and the placeholder SVG will render in its place.

- [ ] **Step 3: Visual smoke test**

Open `marketing/dist/for-single-households.html` in a browser. Confirm:
- Nav appears with "Who it's for" highlighted as the parent path (visual hover state on "One home")
- Hero image fills the viewport (or a placeholder if `single-household_16_9.png` is unexpectedly missing)
- Six benefit cards in a 3&times;2 grid on desktop, 1-column on mobile
- The "A day with Morechard" timeline shows 4 cards horizontal on desktop, stacked on mobile
- FAQ items expand and collapse
- The register-interest form section appears at the bottom

- [ ] **Step 4: Commit**

```
git add marketing/src/for-single-households.html
git commit -m "feat(marketing): add for-single-households audience landing page"
```

---

## Task 6: Build Page 2 — `for-separated-families.html`

**Files:**
- Create: `marketing/src/for-separated-families.html`

**Why:** Direct-to-consumer landing page for separated, co-parenting, blended households. Signature module: "The Split-Screen Ledger" three-column visualisation.

- [ ] **Step 1: Create the page file**

Create `marketing/src/for-separated-families.html` with the following contents:

```html
<!--
  TITLE: Chore & Pocket Money App for Separated & Co-Parenting Families | Morechard
  DESCRIPTION: Two households. One source of truth. A tamper-proof shared record of every chore, payment, and milestone — with court-ready PDF exports when families need them.
  CANONICAL: https://morechard.com/for-separated-families
  PAGE_CSS: page-audience.css
  HERO_IMAGE: /Images/split-household_16_9.png
  HERO_IMAGE_MOBILE: /Images/split-household_3_4.png
-->

<!-- SCHEMA_START -->
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Does Morechard work if we don't speak much?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Morechard is designed for low-communication co-parenting. Each household can independently log chores, approvals, and payments — the shared ledger is the source of truth without anyone having to coordinate by message." } },
    { "@type": "Question", "name": "Can both parents see and approve chores?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Both parents have full visibility into the same child profile. Each parent can set chores, approve completions, and pay out from their own device. Every action is attributed and sealed into the immutable ledger." } },
    { "@type": "Question", "name": "Is the audit log actually accepted by courts?", "acceptedAnswer": { "@type": "Answer", "text": "Morechard generates a PDF/A audit report with a cryptographic chain-head hash and a public verification URL. Each entry is timestamped and tamper-evident. Whether a specific court accepts it depends on the jurisdiction — but the format is built to meet standard evidence requirements." } },
    { "@type": "Question", "name": "What happens if one parent withdraws from the app?", "acceptedAnswer": { "@type": "Answer", "text": "The remaining parent and the child retain full access. The withdrawn parent's historical ledger entries are preserved (and remain cryptographically sealed), but they no longer add new entries. The record they leave behind is still verifiable." } },
    { "@type": "Question", "name": "Can step-parents or grandparents be added?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Additional household members can be invited as Boost-only contributors — they can send rewards and view activity without becoming a primary approver. This keeps the parental Choice Architect role clean while allowing the wider family to participate." } },
    { "@type": "Question", "name": "Who owns the data?", "acceptedAnswer": { "@type": "Answer", "text": "Your family. Always. Morechard does not sell, monetise, or use the underlying data. Either parent can export the complete ledger at any time. The cryptographic chain remains verifiable independently, even outside the app." } }
  ]
}
<!-- SCHEMA_END -->

<!-- BODY_START -->
<main class="audience-page">

  <!-- ── Hero ── -->
  <section class="audience-hero" id="hero">
    <picture>
      <source media="(max-width: 720px)" srcset="/Images/split-household_3_4.png" />
      <img class="hero-img" src="/Images/split-household_16_9.png" alt="Two homes connected by a calm sky, suggesting one shared record across separated households" loading="eager" />
    </picture>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div class="hero-badge reveal">
        <span class="hero-badge-dot"></span>
        For separated families
      </div>
      <h1 class="reveal d1">One source of truth for <em>two households.</em></h1>
      <p class="hero-sub reveal d2">A tamper-proof shared record of every chore, every payment, every milestone. Court-ready PDF exports when families need them. Built to remove the doubt &mdash; so you can focus on the child.</p>
      <div class="hero-actions reveal d3">
        <a href="#signup" class="btn-primary btn-hero">
          Register my interest
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <span class="hero-note">No spam &mdash; one email at launch.</span>
      </div>
    </div>
  </section>

  <!-- ── Editorial intro ── -->
  <section class="audience-section audience-intro">
    <div class="container">
      <p class="reveal">Consistency is the hardest part of co-parenting. Morechard does the remembering for you.</p>
      <p class="reveal d1">No more reconstructing who paid what. No more competing memories of who agreed which rate. Just one calm, shared ledger that both households can trust &mdash; and that the child only ever sees as their pocket money.</p>
    </div>
  </section>

  <!-- ── Benefits grid ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Why separated families choose Morechard</span>
      <h2 class="section-headline reveal">Built for two homes. Honest enough for a courtroom.</h2>
      <p class="section-sub reveal">Six ways Morechard takes the friction out of co-parenting finance &mdash; without taking sides, and without anyone needing to talk more than they want to.</p>

      <div class="audience-benefits-grid">
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">SHA-256 hash chain</span>
          <h3 class="benefit-headline">Every entry locked, forever.</h3>
          <p class="benefit-body">Every chore, every payment, every approval is cryptographically sealed the moment it&rsquo;s recorded. No edits. No deletions. No disputes.</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Competitive</span>
          <span class="benefit-feature">Court-ready PDF export</span>
          <h3 class="benefit-headline">A solicitor would charge hundreds for what this exports in one click.</h3>
          <p class="benefit-body">One-tap audit log of every contribution, payment, and milestone &mdash; formatted for legal review and stamped with a verification seal.</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Humanistic</span>
          <span class="benefit-feature">Household-neutral language</span>
          <h3 class="benefit-headline">Built to keep the focus on your child, not on the conflict.</h3>
          <p class="benefit-body">Morechard uses business-neutral phrasing throughout &mdash; no &ldquo;primary parent,&rdquo; no scoring, no rankings. Both households see the same view.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">Shared expense pool</span>
          <h3 class="benefit-headline">Split costs without splitting hairs.</h3>
          <p class="benefit-body">Birthdays, school trips, new shoes &mdash; log shared expenses, agree the split, and let the ledger keep a clean record of who paid what.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Spontaneous</span>
          <span class="benefit-feature">Parental Boost</span>
          <h3 class="benefit-headline">Reward great effort even from the other house.</h3>
          <p class="benefit-body">See your child smashed it this week? Send a boost to their balance from your phone &mdash; visible to the other parent, recorded forever.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Humanistic</span>
          <span class="benefit-feature">The child sees one home</span>
          <h3 class="benefit-headline">To your child, it&rsquo;s just their pocket money app.</h3>
          <p class="benefit-body">Children get a single, calm, consistent view across both houses. The integrity layer runs underneath &mdash; they never see the friction.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ── Signature: Split-Screen Ledger ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">The Truth Engine</span>
      <h2 class="section-headline reveal">One child. Two houses. One ledger.</h2>
      <p class="section-sub reveal">Every entry both parents make flows into a single, cryptographically sealed record. Either parent can export the chain at any time.</p>

      <div class="signature-ledger">
        <div class="ledger-col parent-a reveal d1">
          <div class="ledger-label">Parent A</div>
          <div class="ledger-entry"><span>Tue &middot; Tidy room</span><span>&pound;1.50 &check;</span></div>
          <div class="ledger-entry"><span>Sat &middot; Dishes</span><span>&pound;3.00 &check;</span></div>
          <div class="ledger-entry"><span>Boost &middot; well done week</span><span>&pound;5.00 &check;</span></div>
          <div class="ledger-total">Total contributed<strong>&pound;9.50</strong></div>
        </div>
        <div class="ledger-col shared reveal d2">
          <div class="ledger-label">Shared ledger</div>
          <div class="ledger-entry"><span><span class="ledger-hash">#4f9e</span> &middot; Tidy room</span><span>&pound;1.50 &check;</span></div>
          <div class="ledger-entry"><span><span class="ledger-hash">#3a01</span> &middot; Dishes</span><span>&pound;3.00 &check;</span></div>
          <div class="ledger-entry"><span><span class="ledger-hash">#b7c2</span> &middot; Dog walk</span><span>&pound;2.00 &check;</span></div>
          <div class="ledger-entry"><span><span class="ledger-hash">#d8f4</span> &middot; Boost</span><span>&pound;5.00 &check;</span></div>
          <div class="ledger-entry"><span><span class="ledger-hash">#1ea6</span> &middot; Homework</span><span>&pound;4.50 &check;</span></div>
          <div class="ledger-total">Total this month<strong>&pound;16.00</strong></div>
        </div>
        <div class="ledger-col parent-b reveal d3">
          <div class="ledger-label">Parent B</div>
          <div class="ledger-entry"><span>Wed &middot; Dog walk</span><span>&pound;2.00 &check;</span></div>
          <div class="ledger-entry"><span>Thu &middot; Homework</span><span>&pound;4.50 &check;</span></div>
          <div class="ledger-entry"><span>Birthday gift</span><span>&mdash;</span></div>
          <div class="ledger-total">Total contributed<strong>&pound;6.50</strong></div>
        </div>
      </div>
      <p class="signature-ledger-caption reveal">Each ledger entry carries a unique cryptographic fingerprint &mdash; proving when it happened, who recorded it, and that it has never been altered.</p>
    </div>
  </section>

  <!-- ── Case cards ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">How separated families use Morechard</span>
      <h2 class="section-headline reveal">Real moments. Real solutions.</h2>

      <div class="audience-cases">
        <div class="case-card reveal d1">
          <div class="case-step">Scenario one</div>
          <h3>The weekend swap</h3>
          <p>Child arrives at Parent B&rsquo;s on Friday with two chores already approved at Parent A&rsquo;s. Parent B sees the streak and the balance &mdash; and adds Saturday&rsquo;s chores without any awkward handover conversation.</p>
        </div>
        <div class="case-card reveal d2">
          <div class="case-step">Scenario two</div>
          <h3>A birthday boost from a distance</h3>
          <p>Parent A travels for work but doesn&rsquo;t want to miss the birthday. A &pound;20 Parental Boost lands instantly in the child&rsquo;s balance &mdash; recorded forever, visible to both households, no awkward message threads.</p>
        </div>
        <div class="case-card reveal d3">
          <div class="case-step">Scenario three</div>
          <h3>The court-ready audit</h3>
          <p>A mediator asks for a record of contributions over the last twelve months. One tap exports a PDF/A audit with a chain-head hash and a public verification URL. Drop it straight into the bundle.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Wide image placeholder ── -->
  <section class="audience-section" style="padding:0 0 56px;">
    <div class="container">
      <!-- TODO: replace placeholder. Generate at 1600x900 (16/9) for desktop and 900x1200 (3/4) for mobile. Alt: "A parent at a dining table reviewing a Morechard audit PDF on a tablet, calm and considered, soft daylight." -->
      <div class="audience-image-wide reveal">
        <picture>
          <source media="(max-width: 720px)" srcset="/Images/separated-tablet-audit_3_4.png" />
          <img src="/Images/separated-tablet-audit_16_9.png" alt="A parent at a dining table reviewing a Morechard audit PDF on a tablet, calm and considered, soft daylight" loading="lazy" />
        </picture>
      </div>
    </div>
  </section>

  <!-- ── Shield AI callout ── -->
  <section class="audience-section">
    <div class="container">
      <div class="audience-callout reveal">
        <div>
          <div class="callout-eyebrow">Legal Integrity Bundle &middot; Shield AI</div>
          <h3>For families who need the full forensic toolkit.</h3>
          <p>Court-ready PDF audit export, cryptographic ledger seal, co-parent verification, and the full AI Mentor briefing &mdash; bundled as a one-time purchase. No monthly fee. No subscription trap.</p>
        </div>
        <div class="callout-price">
          &pound;{{data:pricing.shield_ai.price_whole}}.{{data:pricing.shield_ai.price_dec}}
          <small>One-time payment</small>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Why Morechard strip ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">Why Morechard</span>
      <h2 class="section-headline reveal">Built to remove the doubt.</h2>
      <div class="audience-why">
        <div class="why-tile reveal d1">
          <div class="why-title">SHA-256 hash chain</div>
          <p class="why-body">Every entry sealed with maths, not policy. A single altered byte breaks the whole chain.</p>
        </div>
        <div class="why-tile reveal d2">
          <div class="why-title">Court-admissible exports</div>
          <p class="why-body">PDF/A format with chain-head hash and public verification URL. One tap to produce.</p>
        </div>
        <div class="why-tile reveal d3">
          <div class="why-title">Both parents owned</div>
          <p class="why-body">No &ldquo;primary&rdquo; account. Both households have equal visibility, equal control, equal voice.</p>
        </div>
        <div class="why-tile reveal d4">
          <div class="why-title">Tamper-proof timeline</div>
          <p class="why-body">Append-only ledger. Once a chore is approved or a payment is made, it cannot be edited or deleted.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FAQ ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Common questions</span>
      <h2 class="section-headline reveal">Everything separated parents ask first.</h2>

      <div class="audience-faq">
        <details class="reveal">
          <summary>Does Morechard work if we don&rsquo;t speak much?</summary>
          <div class="faq-answer">Yes. Morechard is designed for low-communication co-parenting. Each household can independently log chores, approvals, and payments &mdash; the shared ledger is the source of truth without anyone having to coordinate by message.</div>
        </details>
        <details class="reveal">
          <summary>Can both parents see and approve chores?</summary>
          <div class="faq-answer">Yes. Both parents have full visibility into the same child profile. Each parent can set chores, approve completions, and pay out from their own device. Every action is attributed and sealed into the immutable ledger.</div>
        </details>
        <details class="reveal">
          <summary>Is the audit log actually accepted by courts?</summary>
          <div class="faq-answer">Morechard generates a PDF/A audit report with a cryptographic chain-head hash and a public verification URL. Each entry is timestamped and tamper-evident. Whether a specific court accepts it depends on the jurisdiction &mdash; but the format is built to meet standard evidence requirements.</div>
        </details>
        <details class="reveal">
          <summary>What happens if one parent withdraws from the app?</summary>
          <div class="faq-answer">The remaining parent and the child retain full access. The withdrawn parent&rsquo;s historical ledger entries are preserved (and remain cryptographically sealed), but they no longer add new entries. The record they leave behind is still verifiable.</div>
        </details>
        <details class="reveal">
          <summary>Can step-parents or grandparents be added?</summary>
          <div class="faq-answer">Yes. Additional household members can be invited as Boost-only contributors &mdash; they can send rewards and view activity without becoming a primary approver. This keeps the parental Choice Architect role clean while allowing the wider family to participate.</div>
        </details>
        <details class="reveal">
          <summary>Who owns the data?</summary>
          <div class="faq-answer">Your family. Always. Morechard does not sell, monetise, or use the underlying data. Either parent can export the complete ledger at any time. The cryptographic chain remains verifiable independently, even outside the app.</div>
        </details>
      </div>
    </div>
  </section>

  {{component:register-interest}}

</main>
<!-- BODY_END -->
```

- [ ] **Step 2: Build the site**

```
node marketing/build.js
```

Expected: `[build] ✓ for-separated-families.html`. Placeholder warnings expected for the mid-page tablet image.

- [ ] **Step 3: Visual smoke test**

Open `marketing/dist/for-separated-families.html` in a browser. Confirm:
- The Split-Screen Ledger renders three columns: Parent A (teal-bordered, light), Shared (Deep Canopy with gold hashes), Parent B (gold-bordered, light)
- On mobile, columns stack vertically with the Shared ledger between the two parent columns
- Shield AI callout shows the price `£149.99` (pulled from `pricing.json` via the `{{data:...}}` token) — confirm this resolves correctly in the rendered HTML, not as a literal `{{data:...}}` string

- [ ] **Step 4: Commit**

```
git add marketing/src/for-separated-families.html
git commit -m "feat(marketing): add for-separated-families audience landing page"
```

---

## Task 7: Build Page 3 — `for-professionals.html`

**Files:**
- Create: `marketing/src/for-professionals.html`

**Why:** B2B referral partner page for family lawyers and mediators. Signature module: "The Forensic Spec" monospace datasheet. More editorial and reserved than Pages 1–2.

- [ ] **Step 1: Create the page file**

Create `marketing/src/for-professionals.html` with the following contents:

```html
<!--
  TITLE: For Family Lawyers & Mediators | Morechard
  DESCRIPTION: A neutral, tamper-proof record of pocket money, chores, and shared child expenses across two households — built for the clients you advise.
  CANONICAL: https://morechard.com/for-professionals
  PAGE_CSS: page-audience.css
  HERO_IMAGE: /Images/professional_16_9.png
  HERO_IMAGE_MOBILE: /Images/professional_3_4.png
-->

<!-- SCHEMA_START -->
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Is the Morechard export admissible as evidence?", "acceptedAnswer": { "@type": "Answer", "text": "Morechard generates a PDF/A-2b export with embedded XMP metadata, a chain-head SHA-256 hash, and a public verification URL. The underlying ledger is append-only and cryptographically chained. Whether a specific court admits the export depends on jurisdictional rules of evidence — but the format is built to meet standard documentary evidence requirements." } },
    { "@type": "Question", "name": "What jurisdiction does Morechard's data sit in?", "acceptedAnswer": { "@type": "Answer", "text": "Family data is stored on Cloudflare D1, with replicas confined to UK and EU regions. No data is routed to or stored in non-EEA jurisdictions. Compliance: UK GDPR, EU GDPR, COPPA, GDPR-K, and Polish NSFE alignment for financial education content." } },
    { "@type": "Question", "name": "How is the ledger's tamper-evidence demonstrated?", "acceptedAnswer": { "@type": "Answer", "text": "Each ledger entry is hashed (SHA-256) together with the prior entry's hash, producing a chain. A single altered byte in any entry — past or present — breaks every subsequent hash in the chain. The chain-head hash is embedded in every export and independently verifiable at a public URL." } },
    { "@type": "Question", "name": "Do both parents need accounts for the record to be useful?", "acceptedAnswer": { "@type": "Answer", "text": "No, but two-parent records are stronger. A single-parent ledger is still cryptographically sealed and exportable. A two-parent ledger additionally attributes each entry to the parent who recorded it, producing a richer evidentiary picture." } },
    { "@type": "Question", "name": "Is there a referral or commission scheme?", "acceptedAnswer": { "@type": "Answer", "text": "No commission. No paid referral scheme. Practitioners who join the partner waitlist receive a one-page client pack at launch and ongoing updates. Vouching is optional and only after a practitioner has used the product themselves." } },
    { "@type": "Question", "name": "Can a mediator be added as a neutral observer?", "acceptedAnswer": { "@type": "Answer", "text": "Not in the current scope — Morechard accounts are family-owned and not designed for third-party observer roles. A mediator can request that the family generate a PDF audit export at any review point, which can be independently verified without an account." } },
    { "@type": "Question", "name": "What if a client asks Morechard to delete their records?", "acceptedAnswer": { "@type": "Answer", "text": "The family controls deletion. A family-initiated account deletion ('Uproot') anonymises personal identifiers while preserving the cryptographically chained ledger entries — the audit chain remains verifiable, but no personal data is retained. Selective deletion of individual ledger entries is not possible by design — that's the point." } }
  ]
}
<!-- SCHEMA_END -->

<!-- BODY_START -->
<main class="audience-page">

  <!-- ── Hero ── -->
  <section class="audience-hero" id="hero">
    <picture>
      <source media="(max-width: 720px)" srcset="/Images/professional_3_4.png" />
      <img class="hero-img" src="/Images/professional_16_9.png" alt="A neutral, professional desk with documents and a laptop, suggesting careful record-keeping" loading="eager" />
    </picture>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div class="hero-badge reveal">
        <span class="hero-badge-dot"></span>
        For family lawyers &amp; mediators
      </div>
      <h1 class="reveal d1">A neutral source of truth for the families <em>you advise.</em></h1>
      <p class="hero-sub reveal d2">A tamper-proof shared ledger of chores, pocket money, and shared child expenses across two households &mdash; with cryptographic integrity and one-click PDF/A audit export. Built so the small disputes resolve themselves before they reach your desk.</p>
      <div class="hero-actions reveal d3">
        <a href="#signup" class="btn-primary btn-hero">
          Join the partner waitlist
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <span class="hero-note">We&rsquo;ll be in touch ahead of launch.</span>
      </div>
    </div>
  </section>

  <!-- ── Editorial intro ── -->
  <section class="audience-section audience-intro">
    <div class="container">
      <p class="reveal">You see the same disputes month after month. Who paid what. Who agreed which rate. Who promised the &pound;20 birthday boost.</p>
      <p class="reveal d1">Morechard removes the dispute by removing the doubt. A cryptographically sealed shared ledger that both households contribute to and either can export &mdash; built so the small arguments resolve themselves long before they need a meeting room.</p>
    </div>
  </section>

  <!-- ── Is / Isn't spec table ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Before you recommend it</span>
      <h2 class="section-headline reveal">What Morechard is (and isn&rsquo;t).</h2>
      <p class="section-sub reveal">A quick disambiguation, because it sits in an unusual category.</p>

      <div class="audience-spec-cols">
        <div class="spec-col positive reveal d1">
          <h3>Morechard is&hellip;</h3>
          <ul>
            <li>A tamper-proof shared ledger</li>
            <li>A neutral record of effort and reward</li>
            <li>A one-click PDF/A audit export</li>
            <li>A tool that respects both households equally</li>
          </ul>
        </div>
        <div class="spec-col negative reveal d2">
          <h3>Morechard is not&hellip;</h3>
          <ul>
            <li>A debit card or banking product</li>
            <li>A children&rsquo;s bank account</li>
            <li>A parental control or surveillance app</li>
            <li>A substitute for legal or financial advice</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Benefits grid ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">Why mediators and family lawyers like Morechard</span>
      <h2 class="section-headline reveal">Six things that matter to a practitioner.</h2>

      <div class="audience-benefits-grid">
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">SHA-256 hash chain</span>
          <h3 class="benefit-headline">Evidentiary integrity, not stored &mdash; proved.</h3>
          <p class="benefit-body">Every ledger entry is cryptographically chained to the previous one. A single altered byte breaks the whole chain. The proof is in the maths, not in our word.</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">One-click PDF audit export</span>
          <h3 class="benefit-headline">A complete record, in the form you already use.</h3>
          <p class="benefit-body">PDF/A export with embedded hash, signature line, and a public verification URL. Drop it straight into a bundle.</p>
        </article>
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">Humanistic</span>
          <span class="benefit-feature">Household-neutral framing</span>
          <h3 class="benefit-headline">A tool that doesn&rsquo;t take sides.</h3>
          <p class="benefit-body">No &ldquo;primary&rdquo; parent. No scoring. No rankings. Both parties see the same data through the same lens &mdash; which is often what mediation needs first.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Competitive</span>
          <span class="benefit-feature">Cost-of-conflict reduction</span>
          <h3 class="benefit-headline">Resolves the small disputes before they become your problem.</h3>
          <p class="benefit-body">Most &ldquo;who paid what&rdquo; arguments never reach your desk because they no longer have anywhere to go. The ledger is the answer.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Logical</span>
          <span class="benefit-feature">Client-owned data</span>
          <h3 class="benefit-headline">Your client&rsquo;s evidence belongs to your client.</h3>
          <p class="benefit-body">Morechard does not sell, monetise, or use the underlying data. The family&rsquo;s audit chain is theirs &mdash; exportable, portable, and verifiable independently.</p>
        </article>
        <article class="benefit-card reveal d2">
          <span class="benefit-lens">Spontaneous</span>
          <span class="benefit-feature">Zero onboarding friction</span>
          <h3 class="benefit-headline">Recommend it on a Tuesday. They&rsquo;re using it by Wednesday.</h3>
          <p class="benefit-body">No bank account, no debit card, no credit check. A family can be on the ledger in under five minutes.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ── Signature: Forensic Spec ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Built for evidence</span>
      <h2 class="section-headline reveal">The forensic specification.</h2>
      <p class="section-sub reveal">For practitioners who want the technical detail before they recommend a tool.</p>

      <div class="signature-forensic reveal">
        <div class="forensic-header">Morechard &middot; Forensic Specification</div>
        <h3>Ledger, export, jurisdiction, retention.</h3>
        <dl class="forensic-grid">
          <dt>Ledger model</dt>           <dd>Append-only, cryptographically chained</dd>
          <dt>Hash function</dt>          <dd>SHA-256 (FIPS 180-4)</dd>
          <dt>Chain integrity</dt>        <dd>Each entry hashes prior entry + payload</dd>
          <dt>Mutability</dt>             <dd>None. No edit. No delete. No backdate.</dd>
          <dt>Export format</dt>          <dd>PDF/A-2b with embedded XMP metadata</dd>
          <dt>Export signing</dt>         <dd>Final-page seal: chain head hash + timestamp</dd>
          <dt>Public verification</dt>    <dd>https://morechard.com/verify/&lt;hash&gt;</dd>
          <dt>Data jurisdiction</dt>      <dd>Cloudflare D1 &middot; UK / EU regions</dd>
          <dt>Standards alignment</dt>    <dd>UK GDPR &middot; COPPA &middot; GDPR-K &middot; NSFE (PL)</dd>
          <dt>Retention</dt>              <dd>Family-controlled &middot; ledger persists post-account</dd>
          <dt>Data ownership</dt>         <dd>The family. Always.</dd>
          <dt>Languages</dt>              <dd>English (UK) &middot; English (US) &middot; Polish</dd>
          <dt>Currencies</dt>             <dd>GBP &middot; USD &middot; PLN</dd>
        </dl>
        <p class="forensic-disclaimer">This block is not legal advice. Morechard is a record-keeping tool.</p>
      </div>
    </div>
  </section>

  <!-- ── Wide image placeholder ── -->
  <section class="audience-section" style="padding:0 0 56px;">
    <div class="container">
      <!-- TODO: replace placeholder. Generate at 1600x900 (16/9) for desktop and 900x1200 (3/4) for mobile. Alt: "A family solicitor at a tidy desk reviewing a Morechard verification page on a laptop — neutral office tones, no faces required." -->
      <div class="audience-image-wide reveal">
        <picture>
          <source media="(max-width: 720px)" srcset="/Images/professional-laptop_3_4.png" />
          <img src="/Images/professional-laptop_16_9.png" alt="A family solicitor at a tidy desk reviewing a Morechard verification page on a laptop, neutral office tones" loading="lazy" />
        </picture>
      </div>
    </div>
  </section>

  <!-- ── Sample audit export ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">A sample export</span>
      <h2 class="section-headline reveal">What lands in your client&rsquo;s inbox.</h2>
      <p class="section-sub reveal">A schematic preview of the first page of a court-ready PDF/A audit export.</p>

      <div class="sample-pdf reveal">
        <div class="pdf-header">Morechard Audit Report</div>
        <div class="pdf-subtitle">Child profile: &ldquo;Alex&rdquo; &middot; Period: 01 Apr 2026 &mdash; 30 Apr 2026 &middot; Households: 2</div>

        <div class="pdf-row"><span>#4f9e &middot; 2026-04-02 &middot; Tidy room</span><span>+&pound;1.50</span></div>
        <div class="pdf-row"><span>#3a01 &middot; 2026-04-06 &middot; Dishes</span><span>+&pound;3.00</span></div>
        <div class="pdf-row"><span>#b7c2 &middot; 2026-04-09 &middot; Dog walk</span><span>+&pound;2.00</span></div>
        <div class="pdf-row"><span>#d8f4 &middot; 2026-04-14 &middot; Boost (Parent A)</span><span>+&pound;5.00</span></div>
        <div class="pdf-row"><span>#1ea6 &middot; 2026-04-21 &middot; Homework</span><span>+&pound;4.50</span></div>
        <div class="pdf-row"><span>#7c12 &middot; 2026-04-26 &middot; Withdrawal</span><span>&minus;&pound;10.00</span></div>

        <div class="pdf-seal">
          Chain-head hash: <span class="seal-hash">9b3a c1f0 4d22 e8f7 51bd 6204 a9c1 d3ef</span><br />
          Sealed at: 2026-04-30 23:59:59 UTC<br />
          Verify: https://morechard.com/verify/9b3a&hellip;d3ef
        </div>
      </div>
      <p class="sample-pdf-caption reveal">Every export carries a cryptographic seal and a public verification URL. Tampered exports fail verification instantly.</p>
    </div>
  </section>

  <!-- ── How to recommend Morechard ── -->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">If you&rsquo;d like to recommend it</span>
      <h2 class="section-headline reveal">A light, three-step partner ladder.</h2>
      <p class="section-sub reveal">No commission. No contract. No obligation. Just a tool you can pass on if it helps the families you advise.</p>

      <div class="recommend-row">
        <div class="recommend-card reveal d1">
          <h3>Mention it</h3>
          <p>A name to drop in a difficult meeting. When clients ask &ldquo;how do we keep track between two homes?&rdquo;, you have a one-line answer.</p>
        </div>
        <div class="recommend-card reveal d2">
          <h3>Share it</h3>
          <p>A page you can send. Forward this URL or share the partner pack we&rsquo;ll send to everyone on the waitlist.</p>
        </div>
        <div class="recommend-card reveal d3">
          <h3>Vouch for it</h3>
          <p>Lend your name if you like the tool. Optional. Practitioners who&rsquo;d be happy to be named as a referrer can opt in after they&rsquo;ve used it. No commission, no obligation.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FAQ ── -->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">Common questions</span>
      <h2 class="section-headline reveal">For practitioners.</h2>

      <div class="audience-faq">
        <details class="reveal">
          <summary>Is the export admissible as evidence?</summary>
          <div class="faq-answer">Morechard generates a PDF/A-2b export with embedded XMP metadata, a chain-head SHA-256 hash, and a public verification URL. The underlying ledger is append-only and cryptographically chained. Whether a specific court admits the export depends on jurisdictional rules of evidence &mdash; but the format is built to meet standard documentary evidence requirements.</div>
        </details>
        <details class="reveal">
          <summary>What jurisdiction does Morechard&rsquo;s data sit in?</summary>
          <div class="faq-answer">Family data is stored on Cloudflare D1, with replicas confined to UK and EU regions. No data is routed to or stored in non-EEA jurisdictions. Compliance: UK GDPR, EU GDPR, COPPA, GDPR-K, and Polish NSFE alignment for financial education content.</div>
        </details>
        <details class="reveal">
          <summary>How is the ledger&rsquo;s tamper-evidence demonstrated?</summary>
          <div class="faq-answer">Each ledger entry is hashed (SHA-256) together with the prior entry&rsquo;s hash, producing a chain. A single altered byte in any entry &mdash; past or present &mdash; breaks every subsequent hash in the chain. The chain-head hash is embedded in every export and independently verifiable at a public URL.</div>
        </details>
        <details class="reveal">
          <summary>Do both parents need accounts for the record to be useful?</summary>
          <div class="faq-answer">No, but two-parent records are stronger. A single-parent ledger is still cryptographically sealed and exportable. A two-parent ledger additionally attributes each entry to the parent who recorded it, producing a richer evidentiary picture.</div>
        </details>
        <details class="reveal">
          <summary>Is there a referral or commission scheme?</summary>
          <div class="faq-answer">No commission. No paid referral scheme. Practitioners who join the partner waitlist receive a one-page client pack at launch and ongoing updates. Vouching is optional and only after a practitioner has used the product themselves.</div>
        </details>
        <details class="reveal">
          <summary>Can a mediator be added as a neutral observer?</summary>
          <div class="faq-answer">Not in the current scope &mdash; Morechard accounts are family-owned and not designed for third-party observer roles. A mediator can request that the family generate a PDF audit export at any review point, which can be independently verified without an account.</div>
        </details>
        <details class="reveal">
          <summary>What if a client asks Morechard to delete their records?</summary>
          <div class="faq-answer">The family controls deletion. A family-initiated account deletion (&lsquo;Uproot&rsquo;) anonymises personal identifiers while preserving the cryptographically chained ledger entries &mdash; the audit chain remains verifiable, but no personal data is retained. Selective deletion of individual ledger entries is not possible by design &mdash; that&rsquo;s the point.</div>
        </details>
      </div>
    </div>
  </section>

  {{component:register-interest}}

</main>
<!-- BODY_END -->
```

- [ ] **Step 2: Build the site**

```
node marketing/build.js
```

Expected: `[build] ✓ for-professionals.html`. Placeholder warnings expected for the mid-page laptop image.

- [ ] **Step 3: Visual smoke test**

Open `marketing/dist/for-professionals.html` in a browser. Confirm:
- "Is / Isn't" spec table renders two columns on desktop, stacked on mobile
- Forensic Spec block: Deep Canopy background, gold field labels, JetBrains Mono values, italic disclaimer at the bottom
- Sample PDF preview: warm cream paper, monospace transaction lines, gold chain-head hash
- "Join the partner waitlist" CTA on hero (page uses the same `#signup` anchor as the others)

- [ ] **Step 4: Commit**

```
git add marketing/src/for-professionals.html
git commit -m "feat(marketing): add for-professionals partner page for family lawyers and mediators"
```

---

## Task 8: Link homepage `who-its-for` cards to the new pages

**Files:**
- Modify: `marketing/_components/who-its-for.html`

**Why:** Both audience cards on the homepage currently have no destination link. Wrap each card in an anchor so visitors can drill into the relevant audience page. Professionals stays nav-only.

- [ ] **Step 1: Update card 1 (Any family)**

In `marketing/_components/who-its-for.html`, find the first audience card (currently line 9). Change the opening tag from:

```html
        <div class="audience-card reveal d1">
```

to:

```html
        <a class="audience-card reveal d1" href="/for-single-households.html">
```

And change the closing `</div>` of that card (currently line 28) to `</a>`.

Inside the card, immediately after the closing `</ul>` of `audience-points` (still inside the card), add a small chevron:

```html
          <span class="audience-read-more">Read more
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
```

- [ ] **Step 2: Update card 2 (Separated & co-parenting)**

In the same file, find the second audience card (currently starts line 30). Change opening tag from:

```html
        <div class="audience-card tinted reveal d2">
```

to:

```html
        <a class="audience-card tinted reveal d2" href="/for-separated-families.html">
```

Change the matching closing `</div>` to `</a>`. Add the same Read more chevron after the `</ul>` inside that card.

- [ ] **Step 3: Add anchor-styling rule to base.css**

Append to `marketing/css/base.css`:

```css
a.audience-card {
  display: block;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
a.audience-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(27,45,46,0.08);
}
.audience-read-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--teal);
}
a.audience-card:hover .audience-read-more svg { transform: translateX(2px); transition: transform 0.2s ease; }
```

- [ ] **Step 4: Verify**

```
node marketing/build.js
```

Open `marketing/dist/index.html`. Scroll to "Who it's for". Confirm:
- Both cards have a "Read more →" chevron
- Hovering either card lifts it and shows a shadow
- Clicking the first card navigates to `/for-single-households.html`
- Clicking the second card navigates to `/for-separated-families.html`

- [ ] **Step 5: Commit**

```
git add marketing/_components/who-its-for.html marketing/css/base.css
git commit -m "feat(marketing): link homepage who-its-for cards to new audience pages"
```

---

## Task 9: Update sitemap.xml

**Files:**
- Modify: `marketing/sitemap.xml`

**Why:** Add the three new URLs so search engines discover them.

- [ ] **Step 1: Replace sitemap.xml contents**

Overwrite `marketing/sitemap.xml` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://morechard.com/</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://morechard.com/for-single-households.html</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://morechard.com/for-separated-families.html</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://morechard.com/for-professionals.html</loc>
    <lastmod>2026-05-13</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

- [ ] **Step 2: Verify**

```
node marketing/build.js
```

Open `marketing/dist/sitemap.xml`. Confirm all four URLs are present.

- [ ] **Step 3: Commit**

```
git add marketing/sitemap.xml
git commit -m "feat(marketing): add new audience pages to sitemap"
```

---

## Task 10: Save reference snippets to `_components/`

**Files:**
- Create: `marketing/_components/audience-hero.html`
- Create: `marketing/_components/audience-benefits-grid.html`
- Create: `marketing/_components/signature-day-in-the-life.html`
- Create: `marketing/_components/signature-split-screen-ledger.html`
- Create: `marketing/_components/signature-forensic-spec.html`
- Create: `marketing/_components/audience-faq.html`

**Why:** Per user preference, audience-page bodies are **inline** (so copy edits don't need component hunting). The `_components/` folder serves as a documented pattern library for future pages — these reference files are not referenced by any current page, but make future audience-page authoring a copy-paste away.

- [ ] **Step 1: Create `audience-hero.html` reference**

Create `marketing/_components/audience-hero.html`:

```html
<!--
  component: audience-hero (REFERENCE ONLY — not included via {{component:...}})
  source-page: src/for-single-households.html (and other audience pages)
  depends-on: page-audience.css
  expects (in page metadata header):
    HERO_IMAGE        (root-relative path)
    HERO_IMAGE_MOBILE (root-relative path)
  swap when re-using: hero badge label, h1 copy (one <em> for accent), hero-sub paragraph,
                     hero image src and alt, CTA label
-->
  <section class="audience-hero" id="hero">
    <picture>
      <source media="(max-width: 720px)" srcset="/Images/HERO_IMAGE_MOBILE.png" />
      <img class="hero-img" src="/Images/HERO_IMAGE.png" alt="ALT TEXT" loading="eager" />
    </picture>
    <div class="hero-scrim"></div>
    <div class="hero-content">
      <div class="hero-badge reveal">
        <span class="hero-badge-dot"></span>
        AUDIENCE BADGE LABEL
      </div>
      <h1 class="reveal d1">HEADLINE COPY <em>EMPHASIS PHRASE.</em></h1>
      <p class="hero-sub reveal d2">SUB COPY — one or two sentences, frame the value not the feature.</p>
      <div class="hero-actions reveal d3">
        <a href="#signup" class="btn-primary btn-hero">
          CTA LABEL
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <span class="hero-note">SUPPORTING NOTE.</span>
      </div>
    </div>
  </section>
```

- [ ] **Step 2: Create `audience-benefits-grid.html` reference**

Create `marketing/_components/audience-benefits-grid.html`:

```html
<!--
  component: audience-benefits-grid (REFERENCE ONLY)
  source-page: src/for-single-households.html (and other audience pages)
  depends-on: page-audience.css
  structure: 6 cards in a 3×2 grid on desktop, 2-col tablet, 1-col mobile.
  authoring guidance: cover all four decision-making lenses (Logical / Competitive /
                      Spontaneous / Humanistic). Two cards per lens is typical.
  swap when re-using: lens label, feature name, benefit headline, body copy. Keep cards short —
                      ~30 words of body, one feature, one headline.
-->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">SECTION LABEL</span>
      <h2 class="section-headline reveal">SECTION HEADLINE.</h2>
      <p class="section-sub reveal">SECTION INTRO COPY — one or two sentences.</p>

      <div class="audience-benefits-grid">
        <!-- Repeat 6 times. Vary reveal delay class (d1 / d2) by row. -->
        <article class="benefit-card reveal d1">
          <span class="benefit-lens">LENS</span>
          <span class="benefit-feature">FEATURE NAME</span>
          <h3 class="benefit-headline">BENEFIT HEADLINE.</h3>
          <p class="benefit-body">BODY COPY — translate the feature into a tangible outcome.</p>
        </article>
        <!-- ... -->
      </div>
    </div>
  </section>
```

- [ ] **Step 3: Create `signature-day-in-the-life.html` reference**

Create `marketing/_components/signature-day-in-the-life.html`:

```html
<!--
  component: signature-day-in-the-life (REFERENCE ONLY)
  source-page: src/for-single-households.html
  depends-on: page-audience.css (.signature-day, .day-card, .signature-day-caption)
  structure: 4 cards horizontal on desktop, 1-col on mobile.
  guidance: each card represents a moment in the day. Two roles per card (Parent + Child).
            Keep each role line under 12 words. Lead the role line with strong noun (no metaphor).
  swap when re-using: 4 time labels, 4 parent lines, 4 child lines, closing caption.
-->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">SECTION LABEL</span>
      <h2 class="section-headline reveal">SECTION HEADLINE.</h2>
      <p class="section-sub reveal">SECTION INTRO.</p>

      <div class="signature-day">
        <div class="day-card reveal d1">
          <div class="day-time">TIME 1</div>
          <p class="day-role"><span class="day-icon">&#127793;</span><strong>Parent:</strong> PARENT MOMENT 1.</p>
          <p class="day-role"><span class="day-icon">&#127822;</span><strong>Child:</strong> CHILD MOMENT 1.</p>
        </div>
        <!-- Repeat for cards 2-4 with d2 / d3 / d4 reveal classes -->
      </div>
      <p class="signature-day-caption reveal">CLOSING CAPTION.</p>
    </div>
  </section>
```

- [ ] **Step 4: Create `signature-split-screen-ledger.html` reference**

Create `marketing/_components/signature-split-screen-ledger.html`:

```html
<!--
  component: signature-split-screen-ledger (REFERENCE ONLY)
  source-page: src/for-separated-families.html
  depends-on: page-audience.css (.signature-ledger, .ledger-col, .ledger-entry, .ledger-total)
  structure: 3 columns — Parent A (teal-bordered light), Shared (dark with gold hashes), Parent B (gold-bordered light).
             Stacks vertically on mobile.
  guidance: keep entries short — chore name, day, amount. The hash on the shared column is what sells the
            "Truth Engine" idea. Hash strings are illustrative — use 4-char hex.
-->
  <section class="audience-section" style="background:#f3eee0;">
    <div class="container">
      <span class="section-label reveal">The Truth Engine</span>
      <h2 class="section-headline reveal">One child. Two houses. One ledger.</h2>
      <p class="section-sub reveal">SUPPORTING COPY.</p>

      <div class="signature-ledger">
        <div class="ledger-col parent-a reveal d1">
          <div class="ledger-label">Parent A</div>
          <div class="ledger-entry"><span>DAY &middot; CHORE</span><span>&pound;X.XX &check;</span></div>
          <!-- ... -->
          <div class="ledger-total">Total contributed<strong>&pound;X.XX</strong></div>
        </div>
        <div class="ledger-col shared reveal d2">
          <div class="ledger-label">Shared ledger</div>
          <div class="ledger-entry"><span><span class="ledger-hash">#xxxx</span> &middot; ENTRY</span><span>&pound;X.XX &check;</span></div>
          <!-- ... -->
          <div class="ledger-total">Total this month<strong>&pound;X.XX</strong></div>
        </div>
        <div class="ledger-col parent-b reveal d3">
          <div class="ledger-label">Parent B</div>
          <div class="ledger-entry"><span>DAY &middot; CHORE</span><span>&pound;X.XX &check;</span></div>
          <!-- ... -->
          <div class="ledger-total">Total contributed<strong>&pound;X.XX</strong></div>
        </div>
      </div>
      <p class="signature-ledger-caption reveal">CAPTION.</p>
    </div>
  </section>
```

- [ ] **Step 5: Create `signature-forensic-spec.html` reference**

Create `marketing/_components/signature-forensic-spec.html`:

```html
<!--
  component: signature-forensic-spec (REFERENCE ONLY)
  source-page: src/for-professionals.html
  depends-on: page-audience.css (.signature-forensic, .forensic-grid, .forensic-disclaimer)
              JetBrains Mono font (loaded via _head-common.html)
  structure: Deep Canopy block with dl/dt/dd grid. Two-column desktop, single-column mobile.
  guidance: use real technical values — this block builds trust through specificity, not marketing.
            Always end with the italic disclaimer.
-->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">SECTION LABEL</span>
      <h2 class="section-headline reveal">SECTION HEADLINE.</h2>
      <p class="section-sub reveal">SECTION INTRO.</p>

      <div class="signature-forensic reveal">
        <div class="forensic-header">PRODUCT &middot; SPECIFICATION TYPE</div>
        <h3>SHORT SUMMARY OF WHAT THIS BLOCK COVERS.</h3>
        <dl class="forensic-grid">
          <dt>FIELD LABEL</dt> <dd>VALUE (in JetBrains Mono)</dd>
          <!-- ... repeat for each field -->
        </dl>
        <p class="forensic-disclaimer">DISCLAIMER — usually a single italic sentence at the bottom.</p>
      </div>
    </div>
  </section>
```

- [ ] **Step 6: Create `audience-faq.html` reference**

Create `marketing/_components/audience-faq.html`:

```html
<!--
  component: audience-faq (REFERENCE ONLY)
  source-page: src/for-single-households.html (and other audience pages)
  depends-on: page-audience.css (.audience-faq, details/summary styling)
  structure: visible accordion via <details> + mirrored JSON-LD FAQ schema in page SCHEMA_START block.
  guidance: phrase each summary as a real search query the audience would type. Keep answers
            2-3 sentences. Always emit the matching JSON-LD entry so AI Overviews and Google can
            cite the answer.
  swap when re-using: 6-7 question/answer pairs + corresponding SCHEMA_START FAQPage entries.
-->
  <section class="audience-section">
    <div class="container">
      <span class="section-label reveal">Common questions</span>
      <h2 class="section-headline reveal">SECTION HEADLINE.</h2>

      <div class="audience-faq">
        <details class="reveal">
          <summary>QUESTION 1?</summary>
          <div class="faq-answer">ANSWER 1.</div>
        </details>
        <!-- ... repeat ... -->
      </div>
    </div>
  </section>

<!--
  Corresponding SCHEMA_START fragment to add to the page header:

  <!-- SCHEMA_START -->
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "QUESTION 1?", "acceptedAnswer": { "@type": "Answer", "text": "ANSWER 1." } },
      ...
    ]
  }
  <!-- SCHEMA_END -->
-->
```

- [ ] **Step 7: Verify build is unaffected**

```
node marketing/build.js
```

Confirm no errors. The new `_components/*.html` files are not referenced by any page via `{{component:...}}`, so they should sit silently in the folder as documentation.

- [ ] **Step 8: Commit**

```
git add marketing/_components/audience-hero.html marketing/_components/audience-benefits-grid.html marketing/_components/signature-day-in-the-life.html marketing/_components/signature-split-screen-ledger.html marketing/_components/signature-forensic-spec.html marketing/_components/audience-faq.html
git commit -m "docs(marketing): add reference snippets for audience-page blocks"
```

---

## Task 11: Final integration verification

**Files:** None directly modified — this is a verification pass.

**Why:** All previous tasks have been verified in isolation. This task confirms the full system works end-to-end before sign-off.

- [ ] **Step 1: Clean build**

Delete `marketing/dist/` to force a from-scratch build.

PowerShell:

```
Remove-Item -Recurse -Force marketing/dist
node marketing/build.js
```

Bash:

```
rm -rf marketing/dist && node marketing/build.js
```

Expected output (in some order):
```
[build] ✓ for-professionals.html
[build] ✓ for-separated-families.html
[build] ✓ for-single-households.html
[build] ✓ index.html
[build] ✓ privacy-policy.html
[build] ✓ terms.html
[build] ✓ _headers (copied)
[build] ✓ sitemap.xml (copied)
[build] ✓ robots.txt (copied)
[build] ✓ css/ (copied)
[build] ✓ images (copied)
[build] ✓ favicon.svg (copied)
[build] Done — N components, hash=XXXXXXXX
```

Plus expected placeholder warnings for the four mid-page lifestyle images:
```
[build] ! placeholder for missing image: /Images/single-household-kitchen_16_9.png (in for-single-households.html)
[build] ! placeholder for missing image: /Images/single-household-kitchen_3_4.png (in for-single-households.html)
[build] ! placeholder for missing image: /Images/separated-tablet-audit_16_9.png (in for-separated-families.html)
[build] ! placeholder for missing image: /Images/separated-tablet-audit_3_4.png (in for-separated-families.html)
[build] ! placeholder for missing image: /Images/professional-laptop_16_9.png (in for-professionals.html)
[build] ! placeholder for missing image: /Images/professional-laptop_3_4.png (in for-professionals.html)
```

- [ ] **Step 2: Serve dist locally and open all pages**

Run a quick local server. Options:

```
npx http-server marketing/dist -p 4173 -c-1
```

Or if `http-server` is not available:

```
python -m http.server --directory marketing/dist 4173
```

Visit each page in a browser:
- `http://localhost:4173/` — homepage
- `http://localhost:4173/for-single-households.html`
- `http://localhost:4173/for-separated-families.html`
- `http://localhost:4173/for-professionals.html`

- [ ] **Step 3: Per-page checklist**

For **each** new page, confirm:

| Check | Pass? |
|---|---|
| Hero image loads (or placeholder renders cleanly if missing) | |
| `<title>` matches the audience and is ≤ 60 chars | |
| `<meta description>` is present and 140–160 chars | |
| `<link rel="canonical">` is present and correct |  |
| Hero preload tags present in `<head>` (view source — there should be a `<!-- Hero preload -->` comment followed by two `<link rel="preload">` lines) | |
| JSON-LD FAQ schema present in `<head>` (view source — `<script type="application/ld+json">` with `"@type": "FAQPage"`) | |
| Nav at the top shows: logo, "Who it's for ▾", "For Professionals", Register CTA | |
| Click "Who it's for" — dropdown reveals "One home" and "Separated families" | |
| Click "Register interest" CTA — page scrolls to `#signup` form | |
| Footer at the bottom shows: logo, Privacy Policy link, Terms link, copyright | |
| The page's signature module renders correctly (timeline / ledger / forensic spec) | |
| Six benefit cards render in a 3×2 grid (desktop) | |
| FAQ accordions expand and collapse | |
| Resize to mobile (≤720px): nav collapses to hamburger, hero swaps to portrait image, benefits stack to one column, signature module stacks vertically | |
| Hamburger menu opens drawer, drawer "Who it's for" accordion works, drawer closes on link click | |

- [ ] **Step 4: Homepage regression check**

On `http://localhost:4173/`:
- Confirm hero still uses the orchard image
- Scroll to "Who it's for" — confirm both audience cards are clickable links with "Read more →" chevron
- Click each card — confirm correct destination
- All other homepage sections (`app-promo`, `why-morechard`, `learning-lab-pillars`, `pricing`, `signup`) render identically to before

- [ ] **Step 5: Cross-browser sanity check**

If possible, open the three pages in a second browser (e.g. Firefox or Safari in addition to Chrome). Confirm the Split-Screen Ledger and Forensic Spec render correctly — these are the components most likely to differ.

- [ ] **Step 6: Final commit (sweep up any small fixes)**

If Step 3–5 surfaced any issues, fix them with targeted edits and commit. If no fixes are needed, skip this step.

- [ ] **Step 7: Push branch and confirm Cloudflare Pages preview deploy**

```
git push
```

Wait for Cloudflare Pages to build the preview (typically 60–90 seconds). Open the preview URL and re-run the checklist on the deployed pages. The placeholder SVGs should still render for the four missing lifestyle images. Hero preloads, FAQ schema, and all nav behaviour should match local.

---

## Spec Coverage Self-Review

Mapping spec sections to plan tasks:

| Spec section | Implemented in |
|---|---|
| Goal & audiences | Tasks 5, 6, 7 |
| Constraints (inline bodies, shared partials, brand-book palette, same CTA) | All tasks adhere |
| File structure (created / modified / untouched) | All tasks |
| Shared Nav (multi-tier, hidden future items, mobile drawer) | Task 2 |
| Build script extension (HERO_IMAGE tokens + placeholder fallback) | Task 1 |
| Page 1 — hero, intro, 6 benefits, day-in-the-life, 3-step, image, why strip, FAQ, register | Task 5 |
| Page 2 — hero, intro, 6 benefits, split-screen ledger, case cards, image, shield callout, why strip, FAQ, register | Task 6 |
| Page 3 — hero, intro, is/isn't, 6 benefits, forensic spec, image, sample export, how-to-recommend, FAQ, register | Task 7 |
| Image placeholders + alt text | Tasks 5, 6, 7 (each page) + Task 1 (fallback mechanism) |
| Image generation list with filenames + alt texts | Embedded as `<!-- TODO: -->` comments in Tasks 5, 6, 7 |
| SEO/AEO: unique title, description, canonical, FAQ schema, OG fallback, preload | Tasks 5, 6, 7 |
| CSS (page-audience.css with all required blocks) | Task 4 |
| JetBrains Mono font load | Task 3 |
| Homepage `who-its-for` links | Task 8 |
| Sitemap update | Task 9 |
| Reference snippet library | Task 10 |
| Decision-making lens coverage (all 4 lenses on each page) | Tasks 5, 6, 7 — verified in copy |
| Success criteria | Task 11 |

No spec requirements without a task.

## Placeholder Self-Review

Scanned for "TBD", "TODO", "implement later", "appropriate", "etc.", incomplete code snippets — none found in steps. The `<!-- TODO: replace placeholder -->` comments inside Tasks 5/6/7 are intentional (they live in the shipped HTML to mark image placeholders for the user) — these are not plan placeholders.

## Type Consistency Self-Review

- CSS class names: `audience-page`, `audience-section`, `audience-hero`, `audience-benefits-grid`, `benefit-card`, `signature-day`, `day-card`, `signature-ledger`, `ledger-col`, `signature-forensic`, `forensic-grid`, `audience-spec-cols`, `spec-col`, `audience-cases`, `case-card`, `audience-steps`, `step-card`, `audience-image-wide`, `audience-callout`, `sample-pdf`, `recommend-row`, `recommend-card`, `audience-faq`, `audience-why` — all referenced consistently across Tasks 4, 5, 6, 7.
- Metadata tokens: `HERO_IMAGE`, `HERO_IMAGE_MOBILE`, `PAGE_CSS`, `CANONICAL`, `SCHEMA_START/END` — used identically in Tasks 1, 5, 6, 7.
- Function names in build.js: `buildHeroPreloads`, `substituteMissingImages`, `escapeAttr` — defined and called in Task 1 consistently.
- Nav data-groups: `features`, `who`, `resources`, `pricing`, `professionals` — only used in Task 2.

No inconsistencies found.

---
