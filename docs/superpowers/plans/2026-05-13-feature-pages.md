# Feature Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three feature pages (Earn/Save/Spend, Financial Literacy, Trust & Peace of Mind) with a shared light/clean layout, CSS app mockups, video placeholders, and activate the Features nav dropdown as the final step.

**Architecture:** Static HTML pages built by the existing `marketing/build.js` pipeline. Build.js needs a one-line subdirectory fix to process `src/features/*.html`. New `page-features.css` handles all feature-page layout. No new JS framework — reuses existing `.reveal` scroll system and nav partial.

**Tech Stack:** Vanilla HTML/CSS, Node.js build script, existing Morechard design tokens from `base.css`, Lora + DM Sans + JetBrains Mono fonts already loaded.

---

## File Map

**Create:**
- `marketing/src/features/earn-save-spend.html`
- `marketing/src/features/financial-literacy.html`
- `marketing/src/features/trust-and-peace-of-mind.html`
- `marketing/css/page-features.css`

**Modify:**
- `marketing/build.js` — extend src scan to process subdirectories
- `marketing/_partials/_nav.html` — update Features dropdown items (NOT remove `hidden` yet)

**Final step only:**
- `marketing/_partials/_nav.html` — remove `hidden` from Features `<li>`

---

## Task 1: Extend build.js to handle src subdirectories

**Files:**
- Modify: `marketing/build.js`

The current build loop is:
```js
for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.html')) continue;
  ...
  write(path.join(DIST, file), page);
}
```
This only processes flat files. We need it to walk one level deep so `src/features/earn-save-spend.html` outputs to `dist/features/earn-save-spend.html`.

- [ ] Open `marketing/build.js`. Find the `// 6. Process each src/*.html` comment (line ~232).

- [ ] Replace the existing src-processing loop with this version that handles one subdirectory level:

```js
  // 6. Process each src/**/*.html (flat + one subdir level)
  const srcDir = path.join(ROOT, 'src');

  function collectSrcFiles(dir, base) {
    const results = [];
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel  = base ? base + '/' + entry : entry;
      if (fs.statSync(full).isDirectory()) {
        // one level deep only
        if (!base) {
          for (const sub of fs.readdirSync(full)) {
            if (sub.endsWith('.html')) results.push({ file: sub, subdir: entry, full: path.join(full, sub), rel: entry + '/' + sub });
          }
        }
      } else if (entry.endsWith('.html')) {
        results.push({ file: entry, subdir: null, full, rel: entry });
      }
    }
    return results;
  }

  for (const { file, subdir, full: srcFile, rel } of collectSrcFiles(srcDir)) {
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
    if (!meta.TITLE) die(`Missing TITLE token in ${rel}`);
    if (!meta.DESCRIPTION) die(`Missing DESCRIPTION token in ${rel}`);

    // Extract body
    const bodyMatch = src.match(/<!-- BODY_START -->([\s\S]*?)<!-- BODY_END -->/);
    if (!bodyMatch) die(`Missing BODY_START/BODY_END in ${rel}`);
    let body = bodyMatch[1];

    // Resolve {{component:name}} tokens
    body = body.replace(/\{\{component:([^}]+)\}\}/g, (_, name) => {
      name = name.trim();
      if (!components[name]) die(`Component "{{component:${name}}}" not found (referenced in ${rel})`);
      return components[name];
    });

    // Resolve {{data:...}} tokens
    body = body.replace(/\{\{data:([^}]+)\}\}/g, (_, dotPath) => {
      dotPath = dotPath.trim();
      if (dotPath === 'pricing_cards') return pricingCards;
      return resolveDataPath({ pricing }, dotPath, rel);
    });

    // Substitute placeholder SVGs for any image src that does not exist on disk
    body = substituteMissingImages(body, rel);

    // Extract optional scripts block
    let scripts = '';
    const scriptsMatch = src.match(/<!-- SCRIPTS_START -->([\s\S]*?)<!-- SCRIPTS_END -->/);
    if (scriptsMatch) scripts = scriptsMatch[1];

    // Extract optional per-page schema block
    let schemaTag = '';
    const schemaMatch = src.match(/<!-- SCHEMA_START -->([\s\S]*?)<!-- SCHEMA_END -->/);
    if (schemaMatch) {
      schemaTag = `\n  <script type="application/ld+json">${schemaMatch[1].trim()}<\/script>`;
    }

    // Build page CSS link
    const pageCssLink = meta.PAGE_CSS
      ? `  <link rel="stylesheet" href="/css/${meta.PAGE_CSS}?v=${hash}" />`
      : '';

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
    extraHead += buildHeroPreloads(meta, rel);
    extraHead += schemaTag;

    // Assemble full page
    const page = `<!DOCTYPE html>
<html lang="en">
<head>
${headCommon}
  <title>${escapeAttr(meta.TITLE)}</title>
  <meta name="description" content="${escapeAttr(meta.DESCRIPTION)}" />${extraHead}
${pageCssLink}
</head>
<body>
${navHtml}
${body}
${footerHtml}
${scripts}
</body>
</html>`;

    const outPath = subdir ? path.join(DIST, subdir, file) : path.join(DIST, file);
    write(outPath, page);
    console.log(`[build] ✓ ${rel}`);
  }
```

- [ ] Run the build to verify existing pages still build correctly:
```
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\marketing"
node build.js
```
Expected output: same files as before, all `[build] ✓` lines, no errors.

- [ ] Commit:
```
git add marketing/build.js
git commit -m "feat(marketing): extend build to process src subdirectories"
```

---

## Task 2: Create page-features.css

**Files:**
- Create: `marketing/css/page-features.css`

- [ ] Create `marketing/css/page-features.css` with this content:

```css
/* ── Feature pages — shared layout ── */

/* Page wrapper */
.feature-page {
  padding-top: var(--h-nav);
  background: var(--bg-cream);
}

/* ── Hero ── */
.fp-hero {
  padding: 80px var(--pad-x) 0;
  text-align: center;
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%,
      rgba(0,149,156,0.07) 0%,
      transparent 70%),
    var(--bg-cream);
}

.fp-hero-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.fp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border: 1px solid var(--teal);
  border-radius: var(--r-pill);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--teal);
  margin-bottom: 28px;
}

.fp-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-dark);
  max-width: 680px;
  margin: 0 auto 20px;
}

.fp-hero .fp-sub {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.65;
  color: var(--text-sub);
  max-width: 560px;
  margin: 0 auto 36px;
}

.fp-hero .fp-hero-cta {
  margin-bottom: 64px;
}

/* Hero mockup frame */
.fp-mockup-frame {
  max-width: 900px;
  margin: 0 auto;
  background: var(--card-light);
  border-radius: 16px;
  border: 1px solid var(--border-light);
  box-shadow: 0 24px 80px rgba(0,149,156,0.10);
  overflow: hidden;
  /* Load animation */
  opacity: 0;
  transform: scale(0.97) translateY(12px);
  transition: opacity 0.8s cubic-bezier(0,0,0.2,1), transform 0.8s cubic-bezier(0,0,0.2,1);
}
.fp-mockup-frame.loaded {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* ── Pitch strip ── */
.fp-pitch {
  padding: 88px var(--pad-x);
  text-align: center;
}
.fp-pitch-inner {
  max-width: 640px;
  margin: 0 auto;
}
.fp-pitch p {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.75;
  color: var(--text-dark);
  margin-bottom: 24px;
}
.fp-pitch p:last-child { margin-bottom: 0; }

/* ── Feature pairs ── */
.fp-pairs { padding: 0 var(--pad-x); }

.fp-pair {
  max-width: 1100px;
  margin: 0 auto;
  padding: 80px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
  border-top: 1px solid var(--border-light);
}
.fp-pair:first-child { border-top: none; }

/* Alternate: odd pairs = text left, even = text right */
.fp-pair:nth-child(even) .fp-pair-text { order: 2; }
.fp-pair:nth-child(even) .fp-pair-visual { order: 1; }

.fp-pair-label {
  display: block;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--teal);
  margin-bottom: 14px;
}

.fp-pair-text h3 {
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--text-dark);
  margin-bottom: 16px;
}

.fp-pair-text p {
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.7;
  color: var(--text-sub);
  margin-bottom: 20px;
}

.fp-pair-bullets {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fp-pair-bullets li {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-dark);
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.fp-pair-bullets li::before {
  content: '›';
  color: var(--teal);
  font-size: 18px;
  line-height: 1.2;
  flex-shrink: 0;
}

/* Visual column slide-in */
.fp-pair-visual {
  border-radius: var(--r-card);
  overflow: hidden;
}
.reveal-left {
  opacity: 0;
  transform: translateX(-24px);
  transition: opacity 0.65s cubic-bezier(0,0,0.2,1), transform 0.65s cubic-bezier(0,0,0.2,1);
}
.reveal-right {
  opacity: 0;
  transform: translateX(24px);
  transition: opacity 0.65s cubic-bezier(0,0,0.2,1), transform 0.65s cubic-bezier(0,0,0.2,1);
}
.reveal-left.visible,
.reveal-right.visible {
  opacity: 1;
  transform: translateX(0);
}

/* ── App mockup shared styles (used inside .fp-pair-visual and .fp-mockup-frame) ── */
.app-mockup {
  background: var(--card-light);
  border-radius: var(--r-card);
  border: 1px solid var(--border-light);
  padding: 20px;
  font-family: var(--font-body);
}

.app-mockup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.app-mockup-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dark);
}

.app-mockup-sub {
  font-size: 12px;
  color: var(--text-sub);
}

.app-card {
  background: #fff;
  border-radius: var(--r-card);
  border: 1px solid var(--border-light);
  padding: 16px;
  margin-bottom: 10px;
}
.app-card:last-child { margin-bottom: 0; }

.app-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-card-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-dark);
}

.app-card-sub {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 2px;
}

.app-card-amount {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-dark);
  white-space: nowrap;
}

.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 500;
}
.app-badge--verified {
  background: rgba(0,149,156,0.10);
  color: var(--teal);
  border: 1px solid rgba(0,149,156,0.25);
}
.app-badge--pending {
  background: rgba(230,178,34,0.12);
  color: var(--gold-dark);
  border: 1px solid rgba(230,178,34,0.3);
}
.app-badge--done {
  background: rgba(0,149,156,0.08);
  color: var(--teal);
}

.app-hash {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-sub);
  letter-spacing: 0.02em;
}

.app-btn-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.app-btn {
  flex: 1;
  padding: 8px 0;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  cursor: default;
}
.app-btn--primary {
  background: var(--teal);
  color: #fff;
}
.app-btn--ghost {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-sub);
}

.app-progress-ring-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
}
.app-progress-label {
  font-size: 12px;
  color: var(--text-sub);
  text-align: center;
}
.app-progress-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-dark);
}

/* Payment bridge tiles */
.app-bridge-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.app-bridge-tile {
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dark);
  background: #fff;
}
.app-bridge-tile--active {
  border-color: var(--teal);
  background: rgba(0,149,156,0.06);
}
.app-bridge-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

/* Module grid */
.app-module-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.app-module-card {
  background: #fff;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-light);
  padding: 12px;
}
.app-module-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 10px;
  font-weight: 500;
  margin-bottom: 6px;
}
.app-module-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dark);
  line-height: 1.3;
}

/* KPI gauges */
.app-kpi-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.app-kpi {
  flex: 1;
  background: #fff;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-light);
  padding: 12px 10px;
  text-align: center;
}
.app-kpi-val {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-dark);
  line-height: 1;
}
.app-kpi-label {
  font-size: 10px;
  color: var(--text-sub);
  margin-top: 4px;
}
.app-kpi-trend {
  font-size: 11px;
  font-weight: 500;
  margin-top: 4px;
}
.app-kpi-trend--up { color: var(--teal); }
.app-kpi-trend--flat { color: var(--text-sub); }

/* Typewriter animation */
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.app-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--teal);
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
}

/* ── Showcase section ── */
.fp-showcase {
  padding: 80px var(--pad-x);
  background: var(--card-light);
}
.fp-showcase-inner {
  max-width: 1000px;
  margin: 0 auto;
}
.fp-showcase h2 {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.5vw, 36px);
  font-weight: 500;
  color: var(--text-dark);
  text-align: center;
  margin-bottom: 8px;
}
.fp-showcase-sub {
  font-size: 16px;
  color: var(--text-sub);
  text-align: center;
  margin-bottom: 40px;
}
.fp-showcase-frame {
  border-radius: 20px;
  overflow: hidden;
  background: var(--bg-cream);
  border: 1px solid var(--border-light);
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fp-showcase-frame video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* Video placeholder (shown until real video drops in) */
.fp-video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-cream);
  color: var(--text-sub);
}
.fp-video-placeholder svg {
  color: var(--teal);
  opacity: 0.5;
}
.fp-video-placeholder p {
  font-size: 13px;
  text-align: center;
  max-width: 280px;
  line-height: 1.5;
}

/* Phone shell (for portrait video) */
.fp-phone-shell {
  max-width: 280px;
  margin: 0 auto;
  background: var(--text-dark);
  border-radius: 40px;
  padding: 12px;
  box-shadow: 0 32px 80px rgba(27,45,46,0.18);
}
.fp-phone-screen {
  border-radius: 30px;
  overflow: hidden;
  background: var(--bg-cream);
  aspect-ratio: 9/19.5;
}
.fp-phone-screen video,
.fp-phone-screen .fp-video-placeholder {
  border-radius: 30px;
}

/* ── Checklist ── */
.fp-checklist {
  padding: 88px var(--pad-x);
}
.fp-checklist-inner {
  max-width: 900px;
  margin: 0 auto;
}
.fp-checklist h2 {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.5vw, 36px);
  font-weight: 500;
  color: var(--text-dark);
  text-align: center;
  margin-bottom: 8px;
}
.fp-checklist-sub {
  font-size: 16px;
  color: var(--text-sub);
  text-align: center;
  margin-bottom: 48px;
}
.fp-checklist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 40px;
}
.fp-check-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
}
.fp-check-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--teal);
}
.fp-check-name {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 500;
  color: var(--text-dark);
  line-height: 1.4;
}
.fp-check-desc {
  font-size: 13px;
  color: var(--text-sub);
  margin-top: 2px;
  line-height: 1.4;
}

/* ── CTA strip ── */
.fp-cta {
  background: var(--bg-dark);
  padding: 88px var(--pad-x);
  text-align: center;
}
.fp-cta h2 {
  font-family: var(--font-display);
  font-size: clamp(26px, 4vw, 42px);
  font-weight: 500;
  color: var(--text-light);
  margin-bottom: 14px;
  line-height: 1.15;
}
.fp-cta p {
  font-size: 17px;
  color: var(--text-light-sub);
  margin-bottom: 32px;
}
.fp-cta .fp-cta-note {
  font-size: 13px;
  color: var(--text-light-sub);
  margin-top: 14px;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .fp-pair {
    grid-template-columns: 1fr;
    gap: 40px;
    padding: 56px 0;
  }
  .fp-pair:nth-child(even) .fp-pair-text { order: 0; }
  .fp-pair:nth-child(even) .fp-pair-visual { order: 0; }
  .fp-checklist-grid { grid-template-columns: 1fr; }
  .app-bridge-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .fp-hero { padding: 60px 20px 0; }
  .fp-pitch, .fp-checklist, .fp-showcase, .fp-cta, .fp-pairs { padding-left: 20px; padding-right: 20px; }
  .app-module-grid { grid-template-columns: 1fr; }
  .app-kpi-row { gap: 8px; }
}
```

- [ ] Run build and verify CSS is copied to `dist/css/page-features.css`:
```
node build.js
```
Check `marketing/dist/css/page-features.css` exists.

- [ ] Commit:
```
git add marketing/css/page-features.css
git commit -m "feat(marketing): add page-features.css layout and mockup styles"
```

---

## Task 3: Update nav Features dropdown items

**Files:**
- Modify: `marketing/_partials/_nav.html`

The nav already has the Features group with old placeholder items. Replace the contents of the `<ul class="nav-panel">` inside `data-group="features"` only. Do NOT remove `hidden` from the outer `<li>` yet.

- [ ] In `marketing/_partials/_nav.html`, find this block:
```html
        <ul class="nav-panel" role="menu">
          <li><a href="/features/chore-tracker" role="menuitem">Chore Tracker</a></li>
          <li><a href="/features/learning-lab" role="menuitem">Learning Lab</a></li>
          <li><a href="/features/ai-mentor" role="menuitem">AI Mentor</a></li>
          <li><a href="/features/cryptographic-reports" role="menuitem">Cryptographic Reports</a></li>
        </ul>
```

Replace with:
```html
        <ul class="nav-panel" role="menu">
          <li>
            <a href="/features/earn-save-spend" role="menuitem">
              <span class="nav-item-title">Earn / Save / Spend</span>
              <span class="nav-item-desc">Chores, goals, and instant payouts</span>
            </a>
          </li>
          <li>
            <a href="/features/financial-literacy" role="menuitem">
              <span class="nav-item-title">Financial Literacy</span>
              <span class="nav-item-desc">AI coaching and 20-module curriculum</span>
            </a>
          </li>
          <li>
            <a href="/features/trust-and-peace-of-mind" role="menuitem">
              <span class="nav-item-title">Trust &amp; Peace of Mind</span>
              <span class="nav-item-desc">Cryptographic ledger and court-ready exports</span>
            </a>
          </li>
        </ul>
```

- [ ] Add nav panel item styles to `marketing/css/base.css`. Find the nav section and append:
```css
/* Nav panel items with title + description */
.nav-panel a {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item-title {
  font-weight: 500;
  color: var(--text-dark);
}
.nav-item-desc {
  font-size: 12px;
  color: var(--text-sub);
  font-weight: 400;
}
```

- [ ] Run build, verify nav partial is included in all output pages:
```
node build.js
```

- [ ] Commit:
```
git add marketing/_partials/_nav.html marketing/css/base.css
git commit -m "feat(marketing): update Features nav items with descriptions"
```

---

## Task 4: Build earn-save-spend.html

**Files:**
- Create: `marketing/src/features/earn-save-spend.html`

- [ ] Create `marketing/src/features/earn-save-spend.html`:

```html
<!--
  TITLE: Earn, Save & Spend | Morechard
  DESCRIPTION: Assign chores, approve completions, set savings goals, and pay out instantly. The chore tracker that actually pays off — works for any family on day one.
  CANONICAL: https://morechard.com/features/earn-save-spend
  PAGE_CSS: page-features.css
-->

<!-- BODY_START -->
<main class="feature-page">

  <!-- ── Hero ── -->
  <section class="fp-hero">
    <div class="fp-hero-inner">
      <div class="fp-chip reveal">Earn / Save / Spend</div>
      <h1 class="reveal d1">The chore tracker that actually pays off.</h1>
      <p class="fp-sub reveal d2">Assign chores, approve completions, and pay out — with a savings goal waiting at the end. Works for any family on day one.</p>
      <div class="fp-hero-cta reveal d3">
        <a href="/#signup" class="btn-primary">
          Start free trial
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>

      <!-- Hero mockup: parent approval card -->
      <div class="fp-mockup-frame reveal d4" id="hero-mockup">
        <div class="app-mockup" style="padding:28px 32px;">
          <div class="app-mockup-header">
            <div>
              <div class="app-mockup-title">Pending Approvals</div>
              <div class="app-mockup-sub">1 chore awaiting your review</div>
            </div>
            <span class="app-badge app-badge--pending">1 pending</span>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Take out the bins</div>
                <div class="app-card-sub">Ellie · Due today</div>
              </div>
              <div class="app-card-amount">£2.00</div>
            </div>
            <div class="app-btn-row">
              <div class="app-btn app-btn--primary">Approve</div>
              <div class="app-btn app-btn--ghost">Review</div>
            </div>
          </div>
          <div class="app-card" style="opacity:0.45;">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Tidy bedroom</div>
                <div class="app-card-sub">Ellie · Due tomorrow</div>
              </div>
              <div class="app-card-amount">£3.00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Pitch strip ── -->
  <section class="fp-pitch">
    <div class="fp-pitch-inner reveal">
      <p>Every family has a version of this: the chore was done, the money was promised, and somehow neither happened cleanly. Morechard closes that loop. Assign, approve, done — with a pocket money balance that updates the moment you tap approve.</p>
      <p>Goals give children something to save toward. Payment Bridge means the money moves with two taps, straight from your banking app. No cash hunts, no IOUs.</p>
    </div>
  </section>

  <!-- ── Feature pairs ── -->
  <div class="fp-pairs">

    <!-- Pair 1: Chore Tracker -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">The daily loop</span>
        <h3>Assign, complete, approve. Balance updates automatically.</h3>
        <p>Parents create chores with a rate and a due date. Children mark them done — optionally with a photo. One tap approves and the ledger records it instantly.</p>
        <ul class="fp-pair-bullets">
          <li>Rate Guide with market benchmarks</li>
          <li>Photo proof upload</li>
          <li>Sibling leaderboard</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="app-mockup">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Ellie's chores</div>
            <span class="app-badge app-badge--done">2 done this week</span>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Take out the bins</div>
                <div class="app-card-sub">Done · Photo attached</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:36px;height:36px;border-radius:6px;background:var(--border-light);display:flex;align-items:center;justify-content:center;">
                  <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="2" stroke="var(--text-sub)" stroke-width="1.2"/><path d="M5 8l2 2 4-4" stroke="var(--teal)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="app-card-amount">£2.00</div>
              </div>
            </div>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Tidy bedroom</div>
                <div class="app-card-sub">Due tomorrow</div>
              </div>
              <div class="app-card-amount" style="color:var(--text-sub);">£3.00</div>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;color:var(--text-sub);">Total earned this week</span>
            <span style="font-size:18px;font-weight:600;color:var(--teal);">£5.00</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pair 2: Goals & Savings (video placeholder) -->
    <div class="fp-pair">
      <div class="fp-pair-visual reveal-left reveal d1">
        <div class="fp-showcase-frame" style="aspect-ratio:4/3;border-radius:var(--r-card);">
          <div class="fp-video-placeholder">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><path d="M12 3C8 3 5 6 5 10c0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/></svg>
            <p>Animation: savings goal seed sprouting as progress ring fills — teal &amp; gold on parchment<br><em>File: marketing/video/goals-grow.mp4</em></p>
          </div>
        </div>
      </div>
      <div class="fp-pair-text reveal d1">
        <span class="fp-pair-label">Something to save for</span>
        <h3>Give every pound a destination before it's earned.</h3>
        <p>Children set savings goals — a name, a target amount, a picture. The Mentor shows them how many chores stand between now and getting there. Parents can boost a goal any time.</p>
        <ul class="fp-pair-bullets">
          <li>Effort-to-earn calculator</li>
          <li>Parent boosts</li>
          <li>24-hour cooling-off on big purchases</li>
        </ul>
      </div>
    </div>

    <!-- Pair 3: Payment Bridge -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">Pay in seconds</span>
        <h3>Open Monzo. Paste. Done.</h3>
        <p>When you approve, Morechard hands you the exact amount and opens your banking app. Monzo, Revolut, PayPal — or Smart Copy for traditional bank transfers. No card numbers stored, ever.</p>
        <ul class="fp-pair-bullets">
          <li>Deep-links to Monzo, Revolut, PayPal</li>
          <li>Smart Copy for bank transfers</li>
          <li>Paid-out timestamp logged</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="app-mockup">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Pay Ellie</div>
            <div class="app-mockup-sub">£2.00 approved</div>
          </div>
          <div class="app-bridge-grid">
            <div class="app-bridge-tile app-bridge-tile--active">
              <div class="app-bridge-dot" style="background:#ff4d4d;"></div>
              <span>Monzo</span>
            </div>
            <div class="app-bridge-tile">
              <div class="app-bridge-dot" style="background:#1a1a2e;"></div>
              <span>Revolut</span>
            </div>
            <div class="app-bridge-tile">
              <div class="app-bridge-dot" style="background:#003087;"></div>
              <span>PayPal</span>
            </div>
            <div class="app-bridge-tile">
              <div class="app-bridge-dot" style="background:var(--card-light);border:1px solid var(--border-light);"></div>
              <span>Copy</span>
            </div>
          </div>
          <div class="app-btn-row" style="margin-top:0;">
            <div class="app-btn app-btn--primary" style="font-size:14px;padding:10px 0;">Open Monzo → £2.00</div>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /fp-pairs -->

  <!-- ── Showcase ── -->
  <section class="fp-showcase reveal">
    <div class="fp-showcase-inner">
      <h2>The whole loop in one moment.</h2>
      <p class="fp-showcase-sub">Chore done. Parent approves. Money moves. No spreadsheet. No argument.</p>
      <div class="fp-showcase-frame">
        <div class="fp-video-placeholder">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M10 8.5l5 3.5-5 3.5V8.5z" fill="currentColor"/></svg>
          <p>Lifestyle video: two phones on a kitchen table — parent approves, child's balance ticks up, Monzo notification appears<br><em>File: marketing/video/earn-save-spend-showcase.mp4</em></p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Checklist ── -->
  <section class="fp-checklist">
    <div class="fp-checklist-inner">
      <h2 class="reveal">Everything in Earn / Save / Spend.</h2>
      <p class="fp-checklist-sub reveal d1">Every feature included in this pillar — across all plans.</p>
      <div class="fp-checklist-grid">
        <!-- items injected by JS below for stagger; or static for no-JS -->
      </div>
    </div>
  </section>

  <!-- ── CTA strip ── -->
  <section class="fp-cta">
    <h2 class="reveal">Start your 14-day free trial.</h2>
    <p class="reveal d1">Full access to every feature. No card required.</p>
    <a href="/#signup" class="btn-primary reveal d2">
      Get started free
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
    <p class="fp-cta-note reveal d3">14-day free trial &middot; No card required</p>
  </section>

</main>
<!-- BODY_END -->

<!-- SCRIPTS_START -->
<script>
(function () {
  // Hero mockup load animation
  var frame = document.getElementById('hero-mockup');
  if (frame) requestAnimationFrame(function () { frame.classList.add('loaded'); });

  // Scroll reveal (extends base.css .reveal system with .reveal-left/.reveal-right)
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function (el) {
    io.observe(el);
  });

  // Checklist data
  var items = [
    { name: 'Chore assignment with rate and due date', desc: '' },
    { name: 'Child completion marking with optional photo proof', desc: '' },
    { name: 'One-tap parent approval', desc: '' },
    { name: 'Rate Guide — market rate benchmarks', desc: 'Fuzzy search across 30+ common chores' },
    { name: 'Sibling leaderboard', desc: '' },
    { name: 'Recurring chore schedules', desc: '' },
    { name: 'Savings goal creation', desc: 'Target, name, progress ring' },
    { name: 'Effort-to-earn calculator', desc: '"3 more bin nights to get there"' },
    { name: 'Parent goal boosts', desc: '' },
    { name: 'Purchase flow', desc: 'Log a completed goal spend' },
    { name: '24-hour Holding Soil', desc: 'Cooling-off on purchases over 50% of balance' },
    { name: 'Pocket Money Day', desc: 'Scheduled weekly or monthly payouts' },
    { name: 'Overdraft policy settings', desc: '' },
    { name: 'Payment Bridge', desc: 'Monzo, Revolut, PayPal deep-links' },
    { name: 'Smart Copy', desc: 'Pre-formatted UK bank transfer text' },
    { name: 'Paid-out delivery timestamp', desc: '' },
    { name: 'Unpaid aggregate indicator per child', desc: '' },
  ];

  var CHECK = '<svg class="fp-check-icon" width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var grid = document.querySelector('.fp-checklist-grid');
  if (grid) {
    grid.innerHTML = items.map(function (it, i) {
      return '<div class="fp-check-item reveal ' + (['','d1','d2','d3'])[i % 4] + '">'
        + CHECK
        + '<div><div class="fp-check-name">' + it.name + '</div>'
        + (it.desc ? '<div class="fp-check-desc">' + it.desc + '</div>' : '')
        + '</div></div>';
    }).join('');
    // re-observe new elements
    grid.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }
})();
</script>
<!-- SCRIPTS_END -->
```

- [ ] Run build and verify `dist/features/earn-save-spend.html` is created:
```
node build.js
```
Expected: `[build] ✓ features/earn-save-spend.html`

- [ ] Open `dist/features/earn-save-spend.html` in a browser. Check:
  - Hero gradient visible (faint teal wash at top)
  - Mockup frame animates in on load
  - Feature pairs alternate layout (text-left/visual-right, visual-left/text-right, text-left/visual-right)
  - Video placeholders show descriptive text with teal icon
  - Checklist renders all 17 items in 2 columns
  - CTA strip is dark

- [ ] Commit:
```
git add marketing/src/features/earn-save-spend.html
git commit -m "feat(marketing): add earn-save-spend feature page"
```

---

## Task 5: Build financial-literacy.html

**Files:**
- Create: `marketing/src/features/financial-literacy.html`

- [ ] Create `marketing/src/features/financial-literacy.html`:

```html
<!--
  TITLE: Financial Literacy | Morechard
  DESCRIPTION: An AI-powered financial education built from your child's real earning and spending. 20 modules, 6 pillars, triggered by behaviour — not a timetable.
  CANONICAL: https://morechard.com/features/financial-literacy
  PAGE_CSS: page-features.css
-->

<!-- BODY_START -->
<main class="feature-page">

  <!-- ── Hero ── -->
  <section class="fp-hero">
    <div class="fp-hero-inner">
      <div class="fp-chip reveal">Financial Literacy</div>
      <h1 class="reveal d1">A financial education built from your child's real life.</h1>
      <p class="fp-sub reveal d2">Not generic slides. Every lesson is triggered by what your child actually earns, saves, and spends — so it lands at exactly the right moment.</p>
      <div class="fp-hero-cta reveal d3">
        <a href="/#signup" class="btn-primary">
          Start free trial
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>

      <!-- Hero mockup: Learning Lab module card -->
      <div class="fp-mockup-frame reveal d4" id="hero-mockup">
        <div class="app-mockup" style="padding:28px 32px;">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Learning Lab</div>
            <span class="app-badge app-badge--verified">Level 2 · Sapling</span>
          </div>
          <div class="app-card" style="border-left:3px solid var(--teal);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:44px;height:44px;border-radius:10px;background:rgba(0,149,156,0.10);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--teal)" stroke-width="1.5"/><path d="M9 22V12h6v10" stroke="var(--teal)" stroke-width="1.5"/></svg>
              </div>
              <div>
                <div class="app-card-label">Banking 101</div>
                <div class="app-card-sub">Pillar 3 · Saving &amp; Growth</div>
              </div>
            </div>
            <div style="margin-top:12px;">
              <div style="height:4px;background:var(--border-light);border-radius:2px;overflow:hidden;">
                <div style="width:35%;height:100%;background:var(--teal);border-radius:2px;"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px;">
                <span style="font-size:11px;color:var(--text-sub);">Act 2 of 4</span>
                <span style="font-size:11px;color:var(--teal);">35%</span>
              </div>
            </div>
            <div class="app-btn-row">
              <div class="app-btn app-btn--primary">Continue</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Pitch strip ── -->
  <section class="fp-pitch">
    <div class="fp-pitch-inner reveal">
      <p>Most financial education is a worksheet. Morechard's is a mirror. When your child spends their whole balance in a day, the Mentor doesn't lecture — it asks a question about needs and wants, using the exact numbers they just lived through.</p>
      <p>Twenty modules. Six pillars. Four age tiers. All triggered by behaviour, never by a parent manually scheduling a lesson. The curriculum grows with the child from age 10 through to 16 and beyond.</p>
    </div>
  </section>

  <!-- ── Feature pairs ── -->
  <div class="fp-pairs">

    <!-- Pair 1: AI Mentor (video placeholder) -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">Coaching that shows up</span>
        <h3>The right lesson, exactly when it matters.</h3>
        <p>Eight behavioural triggers watch for real moments — the child who spends everything at once, the one who stops doing chores for a fortnight, the one who asks about crypto. Each trigger surfaces the lesson that fits.</p>
        <ul class="fp-pair-bullets">
          <li>8 data-signal triggers</li>
          <li>Orchard (warm) and Clean (data-driven) personas</li>
          <li>Never lectures — always asks</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="fp-showcase-frame" style="aspect-ratio:4/3;border-radius:var(--r-card);">
          <div class="fp-video-placeholder">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5"/></svg>
            <p>Animation: AI chat bubble typewriter — "You spent £18 in two hours. Is that what you planned?" — then a module card slides up<br><em>File: marketing/video/ai-mentor-nudge.mp4</em></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Pair 2: Learning Lab curriculum (CSS module grid) -->
    <div class="fp-pair">
      <div class="fp-pair-visual reveal-left reveal d1">
        <div class="app-mockup">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Your modules</div>
            <div class="app-mockup-sub">6 pillars · 20 modules</div>
          </div>
          <div class="app-module-grid" id="module-grid">
            <!-- populated by JS below -->
          </div>
        </div>
      </div>
      <div class="fp-pair-text reveal d1">
        <span class="fp-pair-label">20 modules · 6 pillars</span>
        <h3>Real financial literacy, from pocket money to compound interest.</h3>
        <p>The curriculum spans six pillars — earning, spending, saving, debt, investing, and wellbeing — across four age tiers. Modules unlock based on what the child does in the app, not a timetable.</p>
        <ul class="fp-pair-bullets">
          <li>Aligned with UK MaPS financial education standards</li>
          <li>Age-adaptive: Sapling / Oak / Canopy</li>
          <li>Unlocks from real behaviour, not a schedule</li>
        </ul>
      </div>
    </div>

    <!-- Pair 3: Parent Insights (CSS mockup) -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">For parents</span>
        <h3>A weekly briefing on how your child is growing.</h3>
        <p>Every week the AI produces a Scouting Report — consistency score, responsibility trend, planning horizon — with a plain-English summary. One tap generates copy you can share with your child.</p>
        <ul class="fp-pair-bullets">
          <li>Trend indicators vs prior week</li>
          <li>"Copy for Child" — Seedling or Professional tone</li>
          <li>Cached — loads instantly, runs once per week</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="app-mockup">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Ellie's Scouting Report</div>
            <div class="app-mockup-sub">Week of 12 May</div>
          </div>
          <div class="app-kpi-row">
            <div class="app-kpi">
              <div class="app-kpi-val">84</div>
              <div class="app-kpi-label">Consistency</div>
              <div class="app-kpi-trend app-kpi-trend--up">↑ +6</div>
            </div>
            <div class="app-kpi">
              <div class="app-kpi-val">71</div>
              <div class="app-kpi-label">Responsibility</div>
              <div class="app-kpi-trend app-kpi-trend--flat">→ flat</div>
            </div>
            <div class="app-kpi">
              <div class="app-kpi-val">63</div>
              <div class="app-kpi-label">Planning</div>
              <div class="app-kpi-trend app-kpi-trend--up">↑ +12</div>
            </div>
          </div>
          <div class="app-card" style="font-size:13px;line-height:1.6;color:var(--text-dark);">
            <span id="briefing-text"></span><span class="app-cursor" id="briefing-cursor"></span>
          </div>
          <div class="app-btn-row" style="margin-top:12px;">
            <div class="app-btn app-btn--ghost" style="font-size:13px;">Copy for Ellie</div>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /fp-pairs -->

  <!-- ── Showcase (phone frame, live footage slot) ── -->
  <section class="fp-showcase reveal">
    <div class="fp-showcase-inner">
      <h2>See a module in action.</h2>
      <p class="fp-showcase-sub">Banking 101 — four acts, real questions, real data.</p>
      <div class="fp-phone-shell" style="max-width:320px;">
        <div class="fp-phone-screen">
          <div class="fp-video-placeholder" style="aspect-ratio:9/19.5;">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M10 8.5l5 3.5-5 3.5V8.5z" fill="currentColor"/></svg>
            <p>Screen recording: Learning Lab → Banking 101 → Act 1 → Act 2 → quiz → celebration<br><em>File: marketing/video/learning-lab-demo.mp4</em></p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Checklist ── -->
  <section class="fp-checklist">
    <div class="fp-checklist-inner">
      <h2 class="reveal">Everything in Financial Literacy.</h2>
      <p class="fp-checklist-sub reveal d1">Every feature in this pillar — active during your 14-day trial.</p>
      <div class="fp-checklist-grid"></div>
    </div>
  </section>

  <!-- ── CTA strip ── -->
  <section class="fp-cta">
    <h2 class="reveal">Start your 14-day free trial.</h2>
    <p class="reveal d1">Full access to every feature. No card required.</p>
    <a href="/#signup" class="btn-primary reveal d2">
      Get started free
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
    <p class="fp-cta-note reveal d3">14-day free trial &middot; No card required</p>
  </section>

</main>
<!-- BODY_END -->

<!-- SCRIPTS_START -->
<script>
(function () {
  var frame = document.getElementById('hero-mockup');
  if (frame) requestAnimationFrame(function () { frame.classList.add('loaded'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function (el) { io.observe(el); });

  // Module grid — deal cards in on scroll
  var modules = [
    { name: 'Taxes & Net Pay', pillar: 'Earning', color: '#00959c', tier: 'Sapling' },
    { name: 'Scams & Safety', pillar: 'Spending', color: '#e6b222', tier: 'Sapling' },
    { name: 'Banking 101', pillar: 'Saving', color: '#5a7475', tier: 'Sapling' },
    { name: 'The Snowball', pillar: 'Saving', color: '#5a7475', tier: 'Sapling' },
    { name: 'The Interest Trap', pillar: 'Debt', color: '#c0392b', tier: 'Sapling' },
    { name: 'Inflation', pillar: 'Investing', color: '#8e44ad', tier: 'Sapling' },
  ];
  var grid = document.getElementById('module-grid');
  if (grid) {
    grid.innerHTML = modules.map(function (m, i) {
      return '<div class="app-module-card reveal ' + (['','d1','d2','d3','d1','d2'])[i] + '" style="--delay:' + (i * 0.06) + 's">'
        + '<span class="app-module-pill" style="background:' + m.color + '22;color:' + m.color + '">' + m.pillar + '</span>'
        + '<div class="app-module-name">' + m.name + '</div>'
        + '<div style="font-size:10px;color:var(--text-sub);margin-top:4px;">' + m.tier + '</div>'
        + '</div>';
    }).join('');
    grid.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  // Typewriter for scouting report briefing
  var briefingEl = document.getElementById('briefing-text');
  var cursorEl   = document.getElementById('briefing-cursor');
  var text = 'Ellie completed 4 of 5 chores this week — her best streak in a month. Planning horizon is up: she extended her headphones goal by 2 weeks to avoid spending her buffer.';
  var i = 0;
  function tick() {
    if (!briefingEl) return;
    if (i < text.length) {
      briefingEl.textContent += text[i++];
      setTimeout(tick, 28);
    } else if (cursorEl) {
      cursorEl.style.display = 'none';
    }
  }
  // Start typewriter when the card scrolls into view
  var briefingCard = briefingEl && briefingEl.closest('.app-card');
  if (briefingCard) {
    var started = false;
    var tio = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !started) { started = true; tick(); }
    }, { threshold: 0.5 });
    tio.observe(briefingCard);
  }

  // Checklist data
  var items = [
    { name: '8 behavioural data-signal triggers', desc: 'The Burner, Stagnant Earner, Inflation Nudge, and 5 more' },
    { name: 'EXIF integrity trigger', desc: 'Low-confidence proof uploads → Hard Work vs Shortcuts lesson' },
    { name: 'EXIF batching trigger', desc: 'Cramming chores → Power of Small Steps lesson' },
    { name: 'Two AI personas', desc: 'Orchard (warm/metaphorical) and Clean (data-driven)' },
    { name: 'Independence score', desc: 'Tracks child-initiated vs parent-initiated actions' },
    { name: '20-module curriculum across 6 pillars', desc: '' },
    { name: 'Four age tiers', desc: 'Sapling (10–12), Oak (13–15), Canopy (16+)' },
    { name: 'Module unlocks from real behaviour', desc: 'Not a fixed timetable' },
    { name: 'UK MaPS curriculum alignment', desc: '' },
    { name: 'Weekly parent Scouting Report', desc: '' },
    { name: 'KPI gauges', desc: 'Consistency, Responsibility, Planning Horizon' },
    { name: 'Trend indicators vs prior week', desc: 'Up / down / flat' },
    { name: '"Copy for Child" modal', desc: 'Seedling (orchard) or Professional tone' },
    { name: 'Pillar 5 surplus trigger', desc: 'Fires when balance exceeds £100 or all goals are funded' },
    { name: 'D1 briefing cache', desc: 'Runs once per week — instant on subsequent loads' },
  ];
  var CHECK = '<svg class="fp-check-icon" width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var cg = document.querySelector('.fp-checklist-grid');
  if (cg) {
    cg.innerHTML = items.map(function (it, i) {
      return '<div class="fp-check-item reveal ' + (['','d1','d2','d3'])[i % 4] + '">'
        + CHECK + '<div><div class="fp-check-name">' + it.name + '</div>'
        + (it.desc ? '<div class="fp-check-desc">' + it.desc + '</div>' : '')
        + '</div></div>';
    }).join('');
    cg.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }
})();
</script>
<!-- SCRIPTS_END -->
```

- [ ] Run build, verify `dist/features/financial-literacy.html` created. Open in browser and check:
  - Module grid deals cards in on scroll
  - Typewriter starts when scouting report scrolls into view
  - Video placeholders render with descriptive text
  - Phone shell renders for showcase section

- [ ] Commit:
```
git add marketing/src/features/financial-literacy.html
git commit -m "feat(marketing): add financial-literacy feature page"
```

---

## Task 6: Build trust-and-peace-of-mind.html

**Files:**
- Create: `marketing/src/features/trust-and-peace-of-mind.html`

- [ ] Create `marketing/src/features/trust-and-peace-of-mind.html`:

```html
<!--
  TITLE: Trust & Peace of Mind | Morechard
  DESCRIPTION: A cryptographically sealed ledger that both households can trust — and that courts can read. SHA-256 hash chain, court-ready PDF export, and biometric security.
  CANONICAL: https://morechard.com/features/trust-and-peace-of-mind
  PAGE_CSS: page-features.css
-->

<!-- BODY_START -->
<main class="feature-page">

  <!-- ── Hero ── -->
  <section class="fp-hero">
    <div class="fp-hero-inner">
      <div class="fp-chip reveal">Trust &amp; Peace of Mind</div>
      <h1 class="reveal d1">Every penny. Every approval. Permanently on record.</h1>
      <p class="fp-sub reveal d2">A cryptographically sealed ledger that both households can trust — and that courts can read, if it ever comes to that.</p>
      <div class="fp-hero-cta reveal d3">
        <a href="/#signup" class="btn-primary">
          Start free trial
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>

      <!-- Hero mockup: ledger rows with hashes -->
      <div class="fp-mockup-frame reveal d4" id="hero-mockup">
        <div class="app-mockup" style="padding:28px 32px;">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Transaction Ledger</div>
            <span class="app-badge app-badge--verified">All verified</span>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Take out the bins</div>
                <div class="app-card-sub">Approved by Sarah · 12 May 09:41</div>
              </div>
              <div style="text-align:right;">
                <div class="app-card-amount">+£2.00</div>
                <span class="app-badge app-badge--verified" style="font-size:10px;">Verified</span>
              </div>
            </div>
            <div class="app-hash" style="margin-top:8px;">a3f9c12b…e847d1</div>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">School uniform — M&amp;S</div>
                <div class="app-card-sub">Logged by David · 11 May 14:22</div>
              </div>
              <div style="text-align:right;">
                <div class="app-card-amount" style="color:var(--text-sub);">−£34.00</div>
                <span class="app-badge app-badge--verified" style="font-size:10px;">Verified</span>
              </div>
            </div>
            <div class="app-hash" style="margin-top:8px;">7b2e91f4…c30a88</div>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">Tidy bedroom</div>
                <div class="app-card-sub">Approved by Sarah · 10 May 18:05</div>
              </div>
              <div style="text-align:right;">
                <div class="app-card-amount">+£3.00</div>
                <span class="app-badge app-badge--verified" style="font-size:10px;">Verified</span>
              </div>
            </div>
            <div class="app-hash" style="margin-top:8px;">d91c4e7a…1f6b23</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Pitch strip ── -->
  <section class="fp-pitch">
    <div class="fp-pitch-inner reveal">
      <p>The argument isn't about the £15. It's about the doubt. Who approved it, when, from which phone. Morechard removes the doubt by making every approval a permanent, cryptographically signed record that neither parent can alter.</p>
      <p>For most families this is quiet background infrastructure — the truth is just always there. For separated households facing a disagreement, it's the document that makes the meeting unnecessary.</p>
    </div>
  </section>

  <!-- ── Feature pairs ── -->
  <div class="fp-pairs">

    <!-- Pair 1: Sovereign Ledger (video placeholder) -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">The truth engine</span>
        <h3>Tamper-proof by design. Not by policy.</h3>
        <p>Every ledger entry is hashed with SHA-256 and chained to the entry before it. Alter one byte — anywhere in the history — and every subsequent hash breaks. There is no admin override, no delete button, no "edit."</p>
        <ul class="fp-pair-bullets">
          <li>SHA-256 chain — every entry linked to the previous</li>
          <li>No deletions — errors require reversal entries</li>
          <li><code style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--border-light);padding:1px 5px;border-radius:4px;">server_timestamp</code> + IP logged on every row</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="fp-showcase-frame" style="aspect-ratio:4/3;border-radius:var(--r-card);">
          <div class="fp-video-placeholder">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.5"/></svg>
            <p>Animation: hash chain — three blocks with padlock icons and hash strings connected by teal lines, fourth block appends and chain glows<br><em>File: marketing/video/hash-chain.mp4</em></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Pair 2: Co-Parent Shield (CSS mockup) -->
    <div class="fp-pair">
      <div class="fp-pair-visual reveal-left reveal d1">
        <div class="app-mockup">
          <div class="app-mockup-header">
            <div class="app-mockup-title">Shared Expenses</div>
            <div class="app-btn-row" style="margin:0;">
              <div class="app-btn app-btn--primary" style="font-size:12px;padding:6px 14px;flex:none;">Export PDF</div>
            </div>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">School trip — PGL</div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  <span class="app-badge app-badge--verified" style="font-size:10px;">Education</span>
                </div>
              </div>
              <div style="text-align:right;">
                <div class="app-card-amount">£85.00</div>
                <div style="font-size:11px;color:var(--text-sub);">11 May</div>
              </div>
            </div>
          </div>
          <div class="app-card">
            <div class="app-card-row">
              <div>
                <div class="app-card-label">School uniform — M&amp;S</div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                  <span class="app-badge app-badge--pending" style="font-size:10px;">Clothing</span>
                  <span style="font-size:10px;color:var(--text-sub);display:flex;align-items:center;gap:3px;">
                    <svg width="10" height="10" fill="none" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1"/></svg>
                    Receipt
                  </span>
                </div>
              </div>
              <div style="text-align:right;">
                <div class="app-card-amount">£34.00</div>
                <div style="font-size:11px;color:var(--text-sub);">10 May</div>
              </div>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-light);font-size:12px;color:var(--text-sub);">
            2 expenses · £119.00 total · 1 receipt attached
          </div>
        </div>
      </div>
      <div class="fp-pair-text reveal d1">
        <span class="fp-pair-label">For two households</span>
        <h3>A shared record that belongs to both of you equally.</h3>
        <p>Each household has private chore lists. Shared expenses — school trips, uniforms, medical — can be logged with receipts attached. Any parent can generate a court-ready PDF at any time, with receipts embedded as numbered exhibits.</p>
        <ul class="fp-pair-bullets">
          <li>Private household chore silos</li>
          <li>64 shared expense presets + receipt upload</li>
          <li>Court-ready PDF/A export with embedded exhibits</li>
          <li>Governance mode: Amicable or Standard approval</li>
        </ul>
      </div>
    </div>

    <!-- Pair 3: Security (video placeholder) -->
    <div class="fp-pair">
      <div class="fp-pair-text reveal">
        <span class="fp-pair-label">Safe by default</span>
        <h3>Face ID on the door. No legal names inside.</h3>
        <p>Biometric authentication (Face ID / Touch ID) protects every session. Children join with a 6-digit code — no email, no legal name required anywhere in the app. Account deletion is permanent and self-serve.</p>
        <ul class="fp-pair-bullets">
          <li>WebAuthn biometrics — Face ID / Touch ID</li>
          <li>Children identified by nickname only</li>
          <li>6-digit family code — no child email</li>
          <li>Uproot: full account deletion with PII anonymisation</li>
        </ul>
      </div>
      <div class="fp-pair-visual reveal-right reveal d1">
        <div class="fp-showcase-frame" style="aspect-ratio:4/3;border-radius:var(--r-card);">
          <div class="fp-video-placeholder">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M6 20v-1a6 6 0 0112 0v1" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>
            <p>Animation: Face ID ring glows teal as it reads, gentle unlock — phone on parchment background with teal shield icon<br><em>File: marketing/video/biometric-lock.mp4</em></p>
          </div>
        </div>
      </div>
    </div>

  </div><!-- /fp-pairs -->

  <!-- ── Showcase (desktop frame, live footage slot) ── -->
  <section class="fp-showcase reveal">
    <div class="fp-showcase-inner">
      <h2>One tap. Court-ready PDF.</h2>
      <p class="fp-showcase-sub">The full export flow — ledger table, hash chain, governance log, receipt exhibits.</p>
      <div class="fp-showcase-frame">
        <div class="fp-video-placeholder">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <p>Screen recording: Settings → Data &amp; Exports → Forensic Report → PDF scrolls through cover, ledger hashes, governance log, receipt exhibits<br><em>File: marketing/video/pdf-export-demo.mp4</em></p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Checklist ── -->
  <section class="fp-checklist">
    <div class="fp-checklist-inner">
      <h2 class="reveal">Everything in Trust &amp; Peace of Mind.</h2>
      <p class="fp-checklist-sub reveal d1">Every feature in this pillar — included from day one.</p>
      <div class="fp-checklist-grid"></div>
    </div>
  </section>

  <!-- ── CTA strip ── -->
  <section class="fp-cta">
    <h2 class="reveal">Start your 14-day free trial.</h2>
    <p class="reveal d1">Full access to every feature. No card required.</p>
    <a href="/#signup" class="btn-primary reveal d2">
      Get started free
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
    <p class="fp-cta-note reveal d3">14-day free trial &middot; No card required</p>
  </section>

</main>
<!-- BODY_END -->

<!-- SCRIPTS_START -->
<script>
(function () {
  var frame = document.getElementById('hero-mockup');
  if (frame) requestAnimationFrame(function () { frame.classList.add('loaded'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function (el) { io.observe(el); });

  // Checklist data
  var items = [
    { name: 'SHA-256 hash chain', desc: 'Every entry linked cryptographically to the previous' },
    { name: 'Append-only ledger', desc: 'No deletions, no edits — errors require reversal entries' },
    { name: 'server_timestamp + IP on every row', desc: '' },
    { name: 'Governance mode: Amicable or Standard', desc: 'Amicable = auto-approve; Standard = both parents sign off' },
    { name: 'Mutual consent handshake', desc: 'Required to change governance mode' },
    { name: 'Verified / Action Needed visual states', desc: 'Teal for verified, gold for pending' },
    { name: 'Private household chore silos', desc: 'No cross-visibility between parents' },
    { name: 'Shared expense logging', desc: '10 categories, 64 presets' },
    { name: 'Receipt upload', desc: 'Client-compressed, R2-stored, hash-chained' },
    { name: '48-hour receipt edit window', desc: 'After that, Void-and-Re-log only' },
    { name: 'Court-ready PDF/A export', desc: 'Receipts embedded as numbered exhibits' },
    { name: 'Basic family summary export', desc: 'Included in all plans' },
    { name: 'Data pruning', desc: 'Double-confirm with archive trail' },
    { name: 'WebAuthn biometrics', desc: 'Face ID / Touch ID' },
    { name: 'PIN fallback', desc: 'For devices without biometrics' },
    { name: 'Child nickname-only', desc: 'No legal name required anywhere' },
    { name: '6-digit family invite code', desc: 'No child email required' },
    { name: 'Child invite code regeneration', desc: '' },
    { name: '4-stage high-integrity registration', desc: '' },
    { name: 'Uproot account deletion', desc: 'PII anonymised, ledger retained for hash integrity' },
  ];
  var CHECK = '<svg class="fp-check-icon" width="16" height="16" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var cg = document.querySelector('.fp-checklist-grid');
  if (cg) {
    cg.innerHTML = items.map(function (it, i) {
      return '<div class="fp-check-item reveal ' + (['','d1','d2','d3'])[i % 4] + '">'
        + CHECK + '<div><div class="fp-check-name">' + it.name + '</div>'
        + (it.desc ? '<div class="fp-check-desc">' + it.desc + '</div>' : '')
        + '</div></div>';
    }).join('');
    cg.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }
})();
</script>
<!-- SCRIPTS_END -->
```

- [ ] Run build, verify `dist/features/trust-and-peace-of-mind.html` created. Open in browser and check:
  - Ledger hero mockup shows hash strings in JetBrains Mono
  - Shared expenses CSS mockup renders cleanly
  - Showcase is desktop-wide aspect ratio (16:9)
  - All 20 checklist items render

- [ ] Commit:
```
git add marketing/src/features/trust-and-peace-of-mind.html
git commit -m "feat(marketing): add trust-and-peace-of-mind feature page"
```

---

## Task 7: Cross-browser review and polish

**Files:** No new files — review and fix only.

- [ ] Open all three pages in browser at desktop width (1280px+). Check each for:
  - Hero mockup animates in on load (scale + fade)
  - `.reveal` / `.reveal-left` / `.reveal-right` all fire on scroll
  - Feature pairs alternate correctly (text-left on odd, visual-left on even)
  - No horizontal scroll at any width
  - CTA strip is `--bg-dark` on all three pages

- [ ] Resize to 860px (tablet breakpoint). Check:
  - Feature pairs stack to single column
  - Checklist collapses to single column
  - No layout breaks

- [ ] Resize to 375px (mobile). Check:
  - Hero headline doesn't overflow
  - `fp-chip` pill wraps gracefully
  - Bridge tiles collapse to 2-col grid
  - Phone shell on financial-literacy page is centred

- [ ] If any visual issues found, fix in `marketing/css/page-features.css` or the relevant HTML file.

- [ ] Commit any fixes:
```
git add marketing/css/page-features.css marketing/src/features/
git commit -m "fix(marketing): feature page responsive polish"
```

---

## Task 8: Activate the Features nav dropdown (FINAL STEP)

**Files:**
- Modify: `marketing/_partials/_nav.html`

Only do this task after all three pages are verified working.

- [ ] In `marketing/_partials/_nav.html`, find:
```html
      <li class="nav-group" data-group="features" hidden>
```

Remove the `hidden` attribute:
```html
      <li class="nav-group" data-group="features">
```

- [ ] Run build:
```
node build.js
```

- [ ] Open any page in browser. Verify the Features dropdown is visible in the nav and all three links work.

- [ ] Commit:
```
git add marketing/_partials/_nav.html
git commit -m "feat(marketing): activate Features nav dropdown — all three pages live"
```

---

## Self-Review

**Spec coverage check:**
- ✓ Three pages built: §5, §6, §7
- ✓ Shared anatomy (hero/pitch/pairs/showcase/checklist/CTA): §3
- ✓ Hero gradient wash: Task 2 CSS
- ✓ CSS app mockups for each page: Tasks 4–6
- ✓ Video placeholders with file slots and descriptions: Tasks 4–6
- ✓ `.reveal-left` / `.reveal-right` slide-in for visual columns: Task 2 CSS
- ✓ Checklist JS renders all items with stagger: Tasks 4–6
- ✓ `page-features.css` added as `PAGE_CSS` meta token: Tasks 4–6
- ✓ Build.js extended for subdirectories: Task 1
- ✓ Nav items updated (not yet activated): Task 3
- ✓ Nav `hidden` removed as final step: Task 8
- ✓ JetBrains Mono hash strings on Trust page: Task 6

**No placeholders:** All checklist items, CSS values, JS code, and HTML structures are complete. Video placeholders show descriptive text and file paths. No "TBD" or "TODO" anywhere.

**Type consistency:** `fp-mockup-frame` class used consistently in CSS (Task 2) and HTML (Tasks 4–6). `fp-pair-visual` / `fp-pair-text` used consistently across all three pages. `reveal-left` / `reveal-right` modifier classes match CSS definitions exactly.