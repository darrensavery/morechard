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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

const PLACEHOLDER_SVG_16_9 = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%23e8e3d6'/%3E%3Ctext x='800' y='460' text-anchor='middle' font-family='DM Sans,sans-serif' font-size='28' fill='%23788'%3EImage placeholder%3C/text%3E%3C/svg%3E`;
const PLACEHOLDER_SVG_3_4  = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 1200'%3E%3Crect width='900' height='1200' fill='%23e8e3d6'/%3E%3Ctext x='450' y='620' text-anchor='middle' font-family='DM Sans,sans-serif' font-size='32' fill='%23788'%3EImage placeholder%3C/text%3E%3C/svg%3E`;
const ARTICLE_CARD_PLACEHOLDER =
  '<div class="blog-article-item__thumb blog-article-item__thumb--placeholder">' +
  '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e6f7f7"/><stop offset="100%" stop-color="#f0ece4"/></linearGradient></defs>' +
  '<rect width="320" height="180" fill="url(#pg)"/>' +
  '<rect x="116" y="34" width="88" height="112" rx="7" fill="#fff" stroke="#c8eaeb" stroke-width="1.5"/>' +
  '<rect x="128" y="52" width="64" height="5" rx="2.5" fill="#00959c" opacity="0.55"/>' +
  '<rect x="128" y="65" width="52" height="4" rx="2" fill="#00959c" opacity="0.3"/>' +
  '<rect x="128" y="76" width="58" height="4" rx="2" fill="#00959c" opacity="0.22"/>' +
  '<rect x="128" y="87" width="44" height="4" rx="2" fill="#00959c" opacity="0.18"/>' +
  '<rect x="128" y="98" width="56" height="4" rx="2" fill="#00959c" opacity="0.14"/>' +
  '<rect x="128" y="109" width="38" height="4" rx="2" fill="#00959c" opacity="0.1"/>' +
  '</svg>' +
  '</div>';

function substituteMissingImages(html, srcFile) {
  // Match img src="/Images/..." or src="/foo.webp" — anything starting with /
  // Note: only `src=` is handled. `srcset=` is skipped because its value can be a
  // comma-separated list of URLs which this regex cannot safely parse.
  return html.replace(/src="(\/[^"]+\.(?:png|jpg|jpeg|webp|svg))"/g, (full, href) => {
    // Strip query string if any
    const cleanHref = href.split('?')[0];
    const relative = cleanHref.replace(/^\//, '');
    // Try root-level images (e.g. /hero-orchard_3_2.webp → marketing/hero-orchard_3_2.webp)
    const rootPath = path.join(ROOT, relative);
    // Try src/-tree images (e.g. /Images/foo.png → marketing/src/Images/foo.png)
    const srcPath = path.join(ROOT, 'src', relative);
    if (fs.existsSync(rootPath) || fs.existsSync(srcPath)) return full;
    // Pick aspect by filename hint
    const isPortrait = /_3_4|portrait|_3x4/i.test(cleanHref);
    const sub = isPortrait ? PLACEHOLDER_SVG_3_4 : PLACEHOLDER_SVG_16_9;
    console.log(`[build] ! placeholder for missing image: ${cleanHref} (in ${srcFile})`);
    return `src="${sub}"`;
  });
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

// ── Blog helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function parseFrontMatter(raw, filename) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) die('Blog file missing --- front-matter delimiters: ' + filename);
  const meta = {};
  let currentListKey = null;
  let currentItem = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (currentListKey && /^\s{2}-\s+q:\s+/.test(line)) {
      currentItem = { q: line.replace(/^\s{2}-\s+q:\s+/, '').replace(/^"|"$/g, '') };
      meta[currentListKey].push(currentItem);
      continue;
    }
    if (currentListKey && currentItem && /^\s{4}a:\s+/.test(line)) {
      currentItem.a = line.replace(/^\s{4}a:\s+/, '').replace(/^"|"$/g, '');
      continue;
    }
    if (/^\w+:\s*$/.test(line)) {
      currentListKey = line.replace(/:.*$/, '').trim();
      meta[currentListKey] = [];
      currentItem = null;
      continue;
    }
    const kvQuoted = line.match(/^(\w+):\s+"([^"]*)"\s*$/);
    if (kvQuoted && kvQuoted[1]) {
      meta[kvQuoted[1]] = kvQuoted[2];
      currentListKey = null;
      continue;
    }
    const kvPlain = line.match(/^(\w+):\s+(.+?)\s*$/);
    if (kvPlain && kvPlain[1]) {
      meta[kvPlain[1]] = kvPlain[2];
      currentListKey = null;
      continue;
    }
  }
  return { meta, body: m[2] };
}

function buildBreadcrumbJsonLd(items) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url
    }))
  });
}

function buildFaqJsonLd(faq) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(function(f) {
      return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } };
    })
  });
}

function buildBlog(headCommon, navHtml, footerHtml, hash) {
  // html: false suppresses raw HTML in Markdown — only safe because blog files are author-controlled.
  const md = require('markdown-it')({ html: false, typographer: true });
  const blogDir = path.join(ROOT, 'blog');
  if (!fs.existsSync(blogDir)) return;

  // Parse all .md files
  const posts = [];
  for (const file of fs.readdirSync(blogDir).sort()) {
    if (!file.endsWith('.md')) continue;
    if (file.startsWith('_')) continue;
    const raw = read(path.join(blogDir, file));
    const { meta, body } = parseFrontMatter(raw, file);
    if (meta.draft === 'true') { console.log('[build] ~ skipping draft: ' + file); continue; }
    if (!meta.slug) die('Blog file missing slug: ' + file);
    if (!meta.title) die('Blog file missing title: ' + file);
    if (!meta.datePublished) die('Blog file missing datePublished: ' + file);
    if (meta.faq) {
      meta.faq.forEach(function(f, idx) {
        if (!f.q) die('Blog file ' + file + ' faq[' + idx + '] missing q:');
        if (!f.a) die('Blog file ' + file + ' faq[' + idx + '] missing a:');
      });
    }
    posts.push(Object.assign({}, meta, { bodyHtml: md.render(body) }));
  }

  var slugsSeen = {};
  posts.forEach(function(p) {
    if (slugsSeen[p.slug]) die('Duplicate blog slug: ' + p.slug);
    slugsSeen[p.slug] = true;
  });

  const pillars = posts.filter(function(p) { return p.type === 'pillar'; });
  const spokes  = posts.filter(function(p) { return p.type !== 'pillar'; });

  function pageCss() {
    return '  <link rel="stylesheet" href="/css/blog.css?v=' + hash + '" />';
  }

  function fullPage(title, description, canonical, extraHead, bodyHtml) {
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      headCommon + '\n' +
      '  <title>' + escapeAttr(title) + ' | Morechard Blog</title>\n' +
      '  <meta name="description" content="' + escapeAttr(description) + '" />\n' +
      '  <link rel="canonical" href="' + escapeAttr(canonical) + '" />\n' +
      extraHead + '\n' +
      pageCss() + '\n' +
      '</head>\n<body>\n' +
      navHtml + '\n' +
      bodyHtml + '\n' +
      footerHtml + '\n' +
      '</body>\n</html>';
  }

  // ── Hub: /blog/ ──
  var hubIntroHtml = '';
  var hubMdPath = path.join(blogDir, '_hub.md');
  if (fs.existsSync(hubMdPath)) {
    hubIntroHtml = md.render(read(hubMdPath));
  }

  var latestSpokes = spokes.slice().sort(function(a, b) {
    return b.datePublished.localeCompare(a.datePublished);
  }).slice(0, 6);

  var svgListHub = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M1 4h14M1 8h14M1 12h14\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>";
  var svgGridHub = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><rect x=\"1\" y=\"1\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"9\" y=\"1\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"1\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/></svg>";
  var hubToggleJs = "(function(){\n  var s=document.getElementById('hub-latest');if(!s)return;\n  var v=localStorage.getItem('hub-view');\n  if(v==='grid')s.classList.add('is-grid');\n  s.querySelectorAll('.blog-view-btn').forEach(function(b){\n    b.classList.toggle('is-active',v?b.dataset.view===v:b.dataset.view==='list');\n    b.addEventListener('click',function(){\n      var nv=b.dataset.view;\n      s.classList.toggle('is-grid',nv==='grid');\n      s.querySelectorAll('.blog-view-btn').forEach(function(x){x.classList.toggle('is-active',x===b);});\n      localStorage.setItem('hub-view',nv);\n    });\n  });\n})();";

  var latestItems = latestSpokes.map(function(s) {
    var thumb = s.heroImage
      ? '<img class="blog-article-item__thumb" src="/images/' + s.heroImage + '_16_9.webp" alt="" loading="lazy" width="400" height="225" />'
      : ARTICLE_CARD_PLACEHOLDER;
    return '    <li class="blog-article-item"><a href="/blog/' + s.slug + '/">' +
      thumb +
      '<span class="blog-article-item__title">' + escapeHtml(s.title) + '</span>' +
      '</a></li>';
  }).join('\n');

  var latestSection = latestSpokes.length ? (
    '<section class="blog-pillar-articles blog-latest" id="hub-latest">\n' +
    '  <div class="blog-pillar-articles__header">\n' +
    '    <h2>Latest articles</h2>\n' +
    '    <div class="blog-view-toggle" role="group" aria-label="View">\n' +
    '      <button class="blog-view-btn is-active" data-view="list" title="List view">' + svgListHub + '</button>\n' +
    '      <button class="blog-view-btn" data-view="grid" title="Gallery view">' + svgGridHub + '</button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <ul class="blog-articles-list">\n' +
    latestItems + '\n  </ul>\n</section>\n' +
    '<script>\n' + hubToggleJs + '\n<\/script>'
  ) : '';

  var PILLAR_SCENES = {
    'effort-reward-connection': '<svg viewBox="0 0 280 140" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      // Task checklist left panel
      '<rect x="16" y="18" width="110" height="104" rx="8" fill="var(--bg-cream)" stroke="var(--border-light)"/>' +
      '<rect x="28" y="30" width="60" height="7" rx="3.5" fill="var(--text-sub)" opacity="0.4"/>' +
      // Row 1: done
      '<circle cx="34" cy="54" r="6" fill="var(--teal)" opacity="0.85"/>' +
      '<path d="M31 54l2 2 4-4" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="46" y="51" width="62" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.3"/>' +
      // Row 2: done
      '<circle cx="34" cy="73" r="6" fill="var(--teal)" opacity="0.7"/>' +
      '<path d="M31 73l2 2 4-4" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="46" y="70" width="52" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.25"/>' +
      // Row 3: pending
      '<circle cx="34" cy="92" r="6" fill="none" stroke="var(--border-light)" stroke-width="1.5"/>' +
      '<rect x="46" y="89" width="68" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.18"/>' +
      // Row 4: pending
      '<circle cx="34" cy="111" r="6" fill="none" stroke="var(--border-light)" stroke-width="1.5"/>' +
      '<rect x="46" y="108" width="48" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.15"/>' +
      // Arrow
      '<path d="M134 70h14" stroke="var(--teal)" stroke-width="1.4" stroke-dasharray="4 3"/>' +
      '<path d="M143 64l6 6-6 6" stroke="var(--teal)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      // Balance panel right
      '<rect x="154" y="18" width="110" height="104" rx="8" fill="var(--bg-cream)" stroke="var(--border-light)"/>' +
      '<rect x="166" y="30" width="50" height="6" rx="3" fill="var(--text-sub)" opacity="0.35"/>' +
      '<text x="209" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="22" font-weight="700" fill="var(--teal)">£6.50</text>' +
      '<rect x="166" y="80" width="86" height="6" rx="3" fill="var(--teal)" opacity="0.2"/>' +
      // Gold "earned" badge
      '<rect x="166" y="96" width="86" height="18" rx="5" fill="var(--gold-12)" stroke="var(--gold-30)"/>' +
      '<text x="209" y="108" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="var(--gold-dark)">Earned · locked in</text>' +
      '</svg>',

    'money-and-the-modern-world': '<svg viewBox="0 0 280 140" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      // Phone frame
      '<rect x="20" y="8" width="108" height="124" rx="10" fill="var(--bg-cream)" stroke="var(--border-light)"/>' +
      // Status bar
      '<rect x="32" y="18" width="40" height="4" rx="2" fill="var(--text-sub)" opacity="0.2"/>' +
      '<rect x="80" y="18" width="16" height="4" rx="2" fill="var(--text-sub)" opacity="0.15"/>' +
      // App grid: 4 subscription tiles
      '<rect x="30" y="30" width="40" height="34" rx="5" fill="var(--teal-08)" stroke="var(--border-light)"/>' +
      '<rect x="78" y="30" width="40" height="34" rx="5" fill="var(--card-light)" stroke="var(--border-light)"/>' +
      '<rect x="30" y="70" width="40" height="34" rx="5" fill="var(--card-light)" stroke="var(--border-light)"/>' +
      '<rect x="78" y="70" width="40" height="34" rx="5" fill="var(--teal-08)" stroke="var(--border-light)"/>' +
      // Notification badge — gold
      '<circle cx="70" cy="30" r="7" fill="var(--gold)"/>' +
      '<text x="70" y="34" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" font-weight="700" fill="#fff">1</text>' +
      // Notification badge — teal
      '<circle cx="118" cy="70" r="7" fill="var(--teal)"/>' +
      '<text x="118" y="74" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" font-weight="700" fill="#fff">3</text>' +
      // Tap to buy prompt
      '<rect x="28" y="112" width="92" height="14" rx="5" fill="var(--teal)"/>' +
      '<text x="74" y="122" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="#fff">Tap to buy</text>' +
      // Warning card right
      '<rect x="146" y="18" width="118" height="104" rx="8" fill="var(--gold-12)" stroke="var(--gold-30)"/>' +
      // Alert triangle
      '<path d="M205 32l12 22H193l12-22z" fill="var(--gold)" opacity="0.65"/>' +
      '<text x="205" y="52" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" font-weight="700" fill="#fff">!</text>' +
      // Spend rows
      '<rect x="158" y="66" width="58" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.28"/>' +
      '<rect x="222" y="66" width="30" height="5" rx="2.5" fill="var(--gold-dark)" opacity="0.6"/>' +
      '<rect x="158" y="76" width="46" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.22"/>' +
      '<rect x="222" y="76" width="30" height="5" rx="2.5" fill="var(--gold-dark)" opacity="0.5"/>' +
      '<rect x="158" y="86" width="54" height="5" rx="2.5" fill="var(--text-sub)" opacity="0.18"/>' +
      '<rect x="222" y="86" width="30" height="5" rx="2.5" fill="var(--gold-dark)" opacity="0.4"/>' +
      // Total line
      '<line x1="158" y1="98" x2="252" y2="98" stroke="var(--gold-30)" stroke-width="1"/>' +
      '<text x="205" y="112" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" font-weight="700" fill="var(--gold-dark)">£47.96</text>' +
      '<text x="140" y="134" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="var(--text-sub)" opacity="0.45">Invisible spending · digital traps · real cost</text>' +
      '</svg>',

    'money-across-two-homes': '<svg viewBox="0 0 280 140" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
      // House A
      '<rect x="10" y="24" width="100" height="92" rx="8" fill="var(--bg-cream)" stroke="var(--border-light)"/>' +
      '<rect x="22" y="36" width="54" height="6" rx="3" fill="var(--text-sub)" opacity="0.4"/>' +
      '<rect x="22" y="48" width="40" height="5" rx="2.5" fill="var(--teal)" opacity="0.3"/>' +
      '<rect x="22" y="58" width="52" height="5" rx="2.5" fill="var(--teal)" opacity="0.22"/>' +
      '<rect x="22" y="68" width="36" height="5" rx="2.5" fill="var(--teal)" opacity="0.18"/>' +
      // Gold entry in house A
      '<rect x="22" y="80" width="76" height="14" rx="4" fill="var(--gold-12)" stroke="var(--gold-30)"/>' +
      '<rect x="28" y="85" width="48" height="4" rx="2" fill="var(--gold-dark)" opacity="0.45"/>' +
      '<text x="60" y="107" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="7.5" fill="var(--text-sub)" opacity="0.5">Home A</text>' +
      // House B
      '<rect x="170" y="24" width="100" height="92" rx="8" fill="var(--bg-cream)" stroke="var(--border-light)"/>' +
      '<rect x="182" y="36" width="54" height="6" rx="3" fill="var(--text-sub)" opacity="0.4"/>' +
      '<rect x="182" y="48" width="40" height="5" rx="2.5" fill="var(--teal)" opacity="0.3"/>' +
      '<rect x="182" y="58" width="52" height="5" rx="2.5" fill="var(--teal)" opacity="0.22"/>' +
      '<rect x="182" y="68" width="36" height="5" rx="2.5" fill="var(--teal)" opacity="0.18"/>' +
      '<rect x="182" y="80" width="76" height="14" rx="4" fill="var(--teal-08)" stroke="var(--teal)" stroke-width="0.8"/>' +
      '<rect x="188" y="85" width="48" height="4" rx="2" fill="var(--teal)" opacity="0.4"/>' +
      '<text x="220" y="107" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="7.5" fill="var(--text-sub)" opacity="0.5">Home B</text>' +
      // Child node centre
      '<circle cx="140" cy="70" r="18" fill="var(--teal-08)" stroke="var(--teal)" stroke-width="1.2"/>' +
      '<text x="140" y="74" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="8" font-weight="600" fill="var(--teal)">Alex</text>' +
      '<line x1="110" y1="70" x2="122" y2="70" stroke="var(--teal)" stroke-width="1.2" stroke-dasharray="3 2"/>' +
      '<line x1="158" y1="70" x2="170" y2="70" stroke="var(--teal)" stroke-width="1.2" stroke-dasharray="3 2"/>' +
      '<text x="140" y="128" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="var(--text-sub)" opacity="0.45">Same record · both homes · no conflict</text>' +
      '</svg>',
  };

  var pillarCards = pillars.map(function(p) {
    var scene = PILLAR_SCENES[p.slug]
      ? '<div class="blog-pillar-card__scene">' + PILLAR_SCENES[p.slug] + '</div>'
      : '';
    return '<a class="blog-pillar-card" href="/blog/' + p.slug + '/">' +
      scene +
      '<div class="blog-pillar-card__title">' + escapeHtml(p.title) + '</div>' +
      '<div class="blog-pillar-card__desc">' + escapeHtml(p.description) + '</div>' +
      '<div class="blog-pillar-card__cta">Explore articles →</div>' +
      '</a>';
  }).join('\n    ');

  var hubBody = '<section class="blog-hub-hero">\n' +
    '  <picture>\n' +
    '    <source media="(max-width: 540px)" srcset="/Images/morechard-blog-header_9_16.webp" type="image/webp" />\n' +
    '    <source media="(max-width: 900px)" srcset="/Images/morechard-blog-header_3_4.webp" type="image/webp" />\n' +
    '    <source media="(min-width: 1800px)" srcset="/Images/morechard-blog-header_21_9.webp" type="image/webp" />\n' +
    '    <source srcset="/Images/morechard-blog-header_16_9.webp" type="image/webp" />\n' +
    '    <img class="blog-hub-hero__img" src="/Images/morechard-blog-header_16_9.webp" alt="" fetchpriority="high" />\n' +
    '  </picture>\n' +
    '  <div class="blog-hub-hero__scrim"></div>\n' +
    '  <div class="blog-hub-hero__content">\n' +
    '    <h1 class="blog-hub-hero__title">Morechard Blog</h1>\n' +
    '    <p class="blog-hub-hero__sub">Practical guides on pocket money, chores, and raising financially confident children.</p>\n' +
    '  </div>\n' +
  '</section>\n' +
  '<main class="blog-index">\n' +
    (hubIntroHtml ? '  <div class="blog-body blog-hub-intro">' + hubIntroHtml + '</div>\n' : '') +
    (pillars.length ? '  <h2 class="blog-section-heading">Topic guides</h2>\n  <div class="blog-pillars-grid">\n    ' + pillarCards + '\n  </div>\n' : '') +
    latestSection + '\n' +
    '</main>' + "\n<script>\n(function(){\n  var bar=document.createElement('div');\n  bar.id='reading-progress';\n  document.body.appendChild(bar);\n  var ticking=false;\n  function update(){\n    ticking=false;\n    var docH=document.documentElement.scrollHeight-window.innerHeight;\n    bar.style.width=(docH>0?Math.min(window.scrollY/docH,1):0)*100+'%';\n  }\n  window.addEventListener('scroll',function(){if(!ticking){requestAnimationFrame(update);ticking=true;}},{passive:true});\n})();\n</script>";

    var hubSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Morechard Blog',
    description: 'Practical guides on pocket money, chores, and raising financially confident children.',
    url: 'https://morechard.com/blog/'
  });
  var hubHead = '  <link rel="preload" as="image" href="/Images/morechard-blog-header_9_16.webp" type="image/webp" media="(max-width: 540px)" />\n' +
    '  <link rel="preload" as="image" href="/Images/morechard-blog-header_3_4.webp" type="image/webp" media="(min-width: 541px) and (max-width: 900px)" />\n' +
    '  <link rel="preload" as="image" href="/Images/morechard-blog-header_16_9.webp" type="image/webp" media="(min-width: 901px)" />\n' +
    '  <script type="application/ld+json">' + hubSchema + '<\/script>';
  write(path.join(DIST, 'blog', 'index.html'),
    fullPage('Blog', 'Practical guides on pocket money, chores, and raising financially confident children.',
      'https://morechard.com/blog/', hubHead, hubBody));
  console.log('[build] ✓ blog/index.html');

  // ── Pillar pages ──
  for (var i = 0; i < pillars.length; i++) {
    var pillar = pillars[i];
    var pillarSpokes = spokes.filter(function(s) { return s.pillar === pillar.slug; });
    var canonical = 'https://morechard.com/blog/' + pillar.slug + '/';

    var svgList = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M1 4h14M1 8h14M1 12h14\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>";
    var svgGrid = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><rect x=\"1\" y=\"1\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"9\" y=\"1\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"1\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" rx=\"1\" fill=\"currentColor\"/></svg>";
    var toggleJs = "(function(){\n  var s=document.getElementById('pillar-articles');if(!s)return;\n  var v=localStorage.getItem('pillar-view');\n  if(v!=='list')s.classList.add('is-grid');\n  s.querySelectorAll('.blog-view-btn').forEach(function(b){\n    b.classList.toggle('is-active',v?b.dataset.view===v:b.dataset.view==='grid');\n    b.addEventListener('click',function(){\n      var nv=b.dataset.view;\n      s.classList.toggle('is-grid',nv==='grid');\n      s.querySelectorAll('.blog-view-btn').forEach(function(x){x.classList.toggle('is-active',x===b);});\n      localStorage.setItem('pillar-view',nv);\n    });\n  });\n})();";
    var spokesList = pillarSpokes.length ? (
      '<section class="blog-pillar-articles" id="pillar-articles">\n' +
      '  <div class="blog-pillar-articles__header">\n' +
      '    <h2>Articles in this guide</h2>\n' +
      '    <div class="blog-view-toggle" role="group" aria-label="View">\n' +
      '      <button class="blog-view-btn" data-view="list" title="List view">' + svgList + '</button>\n' +
      '      <button class="blog-view-btn is-active" data-view="grid" title="Gallery view">' + svgGrid + '</button>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  <ul class="blog-articles-list">\n' +
      pillarSpokes.map(function(s) {
        var thumb = s.heroImage
          ? '<img class="blog-article-item__thumb" src="/images/' + s.heroImage + '_16_9.webp" alt="" loading="lazy" width="400" height="225" />'
          : ARTICLE_CARD_PLACEHOLDER;
        return '    <li class="blog-article-item"><a href="/blog/' + s.slug + '/">' +
          thumb +
          '<span class="blog-article-item__title">' + escapeHtml(s.title) + '</span>' +
          '</a></li>';
      }).join('\n') +
      '\n  </ul>\n</section>\n' +
      '<script>\n' + toggleJs + '\n<\/script>'
    ) : '';

    var pillarBreadcrumb = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://morechard.com/' },
      { name: 'Blog', url: 'https://morechard.com/blog/' },
      { name: pillar.title, url: canonical }
    ]);
    var pillarSchema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pillar.title,
      description: pillar.description,
      url: canonical,
      datePublished: pillar.datePublished,
      dateModified: pillar.dateModified || pillar.datePublished
    });
    var pillarHead = '  <script type="application/ld+json">' + pillarSchema + '<\/script>\n' +
      '  <script type="application/ld+json">' + pillarBreadcrumb + '<\/script>';

    var pillarBody = '<nav class="blog-breadcrumb" aria-label="Breadcrumb"><ol>' +
      '<li><a href="/">Home</a></li>' +
      '<li><a href="/blog/">Blog</a></li>' +
      '</ol></nav>\n' +
      '<main class="blog-pillar">\n' +
      '  <header class="blog-header">\n' +
      '    <h1 class="blog-h1">' + escapeHtml(pillar.title) + '</h1>\n' +
      '  </header>\n' +
      '  <div class="blog-body">' + pillar.bodyHtml + '</div>\n' +
      spokesList +
      '</main>' + "\n<script>\n(function(){\n  var bar=document.createElement('div');\n  bar.id='reading-progress';\n  document.body.appendChild(bar);\n  var ticking=false;\n  function update(){\n    ticking=false;\n    var docH=document.documentElement.scrollHeight-window.innerHeight;\n    bar.style.width=(docH>0?Math.min(window.scrollY/docH,1):0)*100+'%';\n  }\n  window.addEventListener('scroll',function(){if(!ticking){requestAnimationFrame(update);ticking=true;}},{passive:true});\n})();\n</script>";

    write(path.join(DIST, 'blog', pillar.slug, 'index.html'),
      fullPage(pillar.title, pillar.description, canonical, pillarHead, pillarBody));
    console.log('[build] ✓ blog/' + pillar.slug + '/');
  }

  // ── Spoke pages ──
  for (var j = 0; j < spokes.length; j++) {
    var spoke = spokes[j];
    var parent = pillars.find(function(p) { return p.slug === spoke.pillar; });
    var siblings = spokes.filter(function(s) { return s.pillar === spoke.pillar && s.slug !== spoke.slug; }).slice(0, 3);
    var spokeCanonical = 'https://morechard.com/blog/' + spoke.slug + '/';

    var spokeBcItems = [
      { name: 'Home', url: 'https://morechard.com/' },
      { name: 'Blog', url: 'https://morechard.com/blog/' }
    ];
    if (parent) spokeBcItems.push({ name: parent.title, url: 'https://morechard.com/blog/' + parent.slug + '/' });
    spokeBcItems.push({ name: spoke.title, url: spokeCanonical });

    var spokeBreadcrumb = buildBreadcrumbJsonLd(spokeBcItems);
    var spokeArticle = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': spoke.schemaType || 'BlogPosting',
      headline: spoke.title,
      description: spoke.description,
      author: { '@type': 'Person', name: spoke.author || 'Darren Savery' },
      publisher: { '@type': 'Organization', name: 'Morechard', logo: { '@type': 'ImageObject', url: 'https://morechard.com/favicon.svg' } },
      datePublished: spoke.datePublished,
      dateModified: spoke.dateModified || spoke.datePublished,
      url: spokeCanonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': spokeCanonical },
      ...(spoke.heroImage ? { image: 'https://morechard.com/images/' + spoke.heroImage + '_16_9.webp' } : {})
    });

    var heroImg16x9 = spoke.heroImage ? 'https://morechard.com/images/' + spoke.heroImage + '_16_9.webp' : '';
    var ogImageMeta = heroImg16x9
      ? '\n  <meta property="og:image" content="' + escapeAttr(heroImg16x9) + '" />'
        + '\n  <meta property="og:image:width" content="1200" />'
        + '\n  <meta property="og:image:height" content="675" />'
        + '\n  <meta name="twitter:card" content="summary_large_image" />'
        + '\n  <meta name="twitter:image" content="' + escapeAttr(heroImg16x9) + '" />'
      : '';
    var spokeHead = '  <script type="application/ld+json">' + spokeArticle + '<\/script>\n' +
      '  <script type="application/ld+json">' + spokeBreadcrumb + '<\/script>' + ogImageMeta;

    if (spoke.faq && spoke.faq.length) {
      spokeHead += '\n  <script type="application/ld+json">' + buildFaqJsonLd(spoke.faq) + '<\/script>';
    }

    var breadcrumbHtml = spokeBcItems.slice(0, -1).map(function(item) {
      var relUrl = item.url.replace('https://morechard.com', '');
      return '<li><a href="' + relUrl + '">' + escapeHtml(item.name) + '</a></li>';
    }).join('');

    var clusterNav = '';
    if (siblings.length || parent) {
      clusterNav = '<aside class="blog-cluster-nav">\n' +
        '  <div class="blog-cluster-nav__heading">More in this topic</div>\n  <ul>\n' +
        siblings.map(function(s) {
          return '    <li><a href="/blog/' + s.slug + '/">' + escapeHtml(s.title) + '</a></li>';
        }).join('\n') +
        (parent ? '\n    <li><a href="/blog/' + parent.slug + '/">All articles: ' + escapeHtml(parent.title) + ' →</a></li>' : '') +
        '\n  </ul>\n</aside>';
    }

    var faqSection = '';
    if (spoke.faq && spoke.faq.length) {
      faqSection = '<section class="blog-faq">\n  <h2>Frequently asked questions</h2>\n  <dl>\n' +
        spoke.faq.map(function(f) {
          return '    <dt>' + escapeHtml(f.q) + '</dt>\n    <dd>' + escapeHtml(f.a) + '</dd>';
        }).join('\n') +
        '\n  </dl>\n</section>';
    }

    var spokeBody = '<nav class="blog-breadcrumb" aria-label="Breadcrumb"><ol>' + breadcrumbHtml + '</ol></nav>\n' +
      '<main class="blog-post">\n' +
      '  <article class="blog-article">\n' +
      '    <header class="blog-header">\n' +
      '      <h1 class="blog-h1">' + escapeHtml(spoke.title) + '</h1>\n' +
      '      <div class="blog-meta">' +
      '<time datetime="' + escapeAttr(spoke.datePublished) + '">' + formatDate(spoke.datePublished) + '</time>' +
      ' <span class="blog-meta-sep" aria-hidden="true">·</span> ' +
      '<span>' + escapeHtml(spoke.author || 'Darren Savery') + '</span>' +
      '</div>\n    </header>\n' +
      (spoke.heroImage
        ? '<img class="blog-hero-img" src="/images/' + spoke.heroImage + '_16_9.webp" alt="' + escapeAttr(spoke.title) + '" loading="eager" width="1200" height="675" />\n'
        : '') +
      '    <div class="blog-body">' + spoke.bodyHtml + '</div>\n' +
      '  </article>\n' +
      clusterNav + '\n' +
      faqSection + '\n' +
      '</main>' + "\n<script>\n(function(){\n  var bar=document.createElement('div');\n  bar.id='reading-progress';\n  document.body.appendChild(bar);\n  var ticking=false;\n  function update(){\n    ticking=false;\n    var docH=document.documentElement.scrollHeight-window.innerHeight;\n    bar.style.width=(docH>0?Math.min(window.scrollY/docH,1):0)*100+'%';\n  }\n  window.addEventListener('scroll',function(){if(!ticking){requestAnimationFrame(update);ticking=true;}},{passive:true});\n})();\n</script>";

    write(path.join(DIST, 'blog', spoke.slug, 'index.html'),
      fullPage(spoke.title, spoke.description, spokeCanonical, spokeHead, spokeBody));
    console.log('[build] ✓ blog/' + spoke.slug + '/');
  }

  // ── Sitemap: append blog entries to existing dist/sitemap.xml ──
  var sitemapPath = path.join(DIST, 'sitemap.xml');
  var sitemapBase = fs.existsSync(sitemapPath) ? read(sitemapPath) : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>';
  var blogEntries = posts.map(function(p) {
    var loc = 'https://morechard.com/blog/' + p.slug + '/';
    return '  <url>\n' +
      '    <loc>' + loc + '</loc>\n' +
      '    <lastmod>' + (p.dateModified || p.datePublished) + '</lastmod>\n' +
      '    <changefreq>monthly</changefreq>\n' +
      '    <priority>' + (p.type === 'pillar' ? '0.8' : '0.7') + '</priority>\n' +
      '  </url>';
  }).join('\n');

  var hubEntry = '  <url>\n    <loc>https://morechard.com/blog/</loc>\n    <lastmod>' +
    new Date().toISOString().slice(0, 10) + '</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>';

  var updatedSitemap = sitemapBase.replace('</urlset>',
    hubEntry + '\n' + blogEntries + '\n</urlset>');
  write(sitemapPath, updatedSitemap);
  console.log('[build] ✓ sitemap.xml (blog entries appended)');

  console.log('[build] ✓ blog (' + posts.length + ' pages)');
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

  // 6. Process each src/**/*.html (flat + one subdir level)
  const srcDir = path.join(ROOT, 'src');

  function collectSrcFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        // one level deep only
        for (const sub of fs.readdirSync(full)) {
          if (sub.endsWith('.html')) {
            results.push({ file: sub, subdir: entry, full: path.join(full, sub), rel: entry + '/' + sub });
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

  // 7. Copy static assets
  const COPY_FILES = ['_headers', '_redirects', 'sitemap.xml', 'robots.txt'];
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

  // Copy src/Images/ → dist/Images/ (audience-page imagery referenced as /Images/...)
  const srcImagesDir = path.join(ROOT, 'src', 'Images');
  if (fs.existsSync(srcImagesDir)) {
    const distImagesDir = path.join(DIST, 'Images');
    fs.mkdirSync(distImagesDir, { recursive: true });
    for (const f of fs.readdirSync(srcImagesDir)) {
      const full = path.join(srcImagesDir, f);
      if (fs.statSync(full).isDirectory()) continue;
      if (IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
        fs.copyFileSync(full, path.join(distImagesDir, f));
      }
    }
    console.log('[build] ✓ Images/ (copied)');
  }

  // Copy src/images/ → dist/images/ (blog hero images)
  const srcBlogImagesDir = path.join(ROOT, 'src', 'images');
  if (fs.existsSync(srcBlogImagesDir)) {
    const distBlogImagesDir = path.join(DIST, 'images');
    fs.mkdirSync(distBlogImagesDir, { recursive: true });
    for (const f of fs.readdirSync(srcBlogImagesDir)) {
      const full = path.join(srcBlogImagesDir, f);
      if (fs.statSync(full).isDirectory()) continue;
      if (IMAGE_EXTS.includes(path.extname(f).toLowerCase())) {
        fs.copyFileSync(full, path.join(distBlogImagesDir, f));
      }
    }
    console.log('[build] ✓ images/ (blog hero images copied)');
  }

  // Copy video/ → dist/video/
  const srcVideoDir  = path.join(ROOT, 'video');
  const distVideoDir = path.join(DIST, 'video');
  const VIDEO_EXTS   = ['.mp4', '.webm', '.mov', '.ogg'];
  if (fs.existsSync(srcVideoDir)) {
    fs.mkdirSync(distVideoDir, { recursive: true });
    for (const f of fs.readdirSync(srcVideoDir)) {
      if (VIDEO_EXTS.includes(path.extname(f).toLowerCase())) {
        fs.copyFileSync(path.join(srcVideoDir, f), path.join(distVideoDir, f));
      }
    }
    console.log('[build] ✓ video/ (copied)');
  }

  // Copy favicon.svg — prefer marketing/favicon.svg, fall back to project root
  const localFavicon = path.join(ROOT, 'favicon.svg');
  const rootFavicon  = path.join(ROOT, '..', 'favicon.svg');
  const faviconSrc   = fs.existsSync(localFavicon) ? localFavicon : rootFavicon;
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, path.join(DIST, 'favicon.svg'));
    console.log('[build] ✓ favicon.svg (copied)');
  }

  // 8. Build blog
  buildBlog(headCommon, navHtml, footerHtml, hash);
  console.log(`\n[build] Done — ${Object.keys(components).length} components, hash=${hash}\n`);
}

build();
