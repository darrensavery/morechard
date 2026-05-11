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

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
  const cssDir = path.join(ROOT, 'css');
  const allCss = fs.readdirSync(cssDir)
    .sort()
    .map(f => {
      const full = path.join(cssDir, f);
      return fs.statSync(full).isDirectory() ? '' : fs.readFileSync(full, 'utf8');
    })
    .join('');
  return crypto.createHash('sha256').update(allCss).digest('hex').slice(0, 8);
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
    `      { "@type": "Offer", "name": ${JSON.stringify(p.name)}, "price": ${JSON.stringify(p.price_whole + p.price_dec)}, "priceCurrency": "GBP" }`
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
    const full = path.join(componentsDir, file);
    if (fs.statSync(full).isDirectory()) continue;
    const name = file.replace('.html', '');
    components[name] = read(full);
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
        .replace(/\{\{CANONICAL\}\}/g, escapeAttr(meta.CANONICAL || ''))
        .replace(/\{\{OG_TITLE\}\}/g, escapeAttr(meta.OG_TITLE || ''))
        .replace(/\{\{OG_DESCRIPTION\}\}/g, escapeAttr(meta.OG_DESCRIPTION || ''))
        .replace(/\{\{OG_IMAGE\}\}/g, escapeAttr(meta.OG_IMAGE || ''));
    } else if (meta.CANONICAL) {
      extraHead = `\n  <link rel="canonical" href="${meta.CANONICAL}" />`;
    }

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
    const full = path.join(cssDir, f);
    if (fs.statSync(full).isDirectory()) continue;
    fs.copyFileSync(full, path.join(distCssDir, f));
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
