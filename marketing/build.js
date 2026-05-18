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
    const raw = read(path.join(blogDir, file));
    const { meta, body } = parseFrontMatter(raw, file);
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
  var pillarCards = pillars.map(function(p) {
    return '<a class="blog-pillar-card" href="/blog/' + p.slug + '/">' +
      '<div class="blog-pillar-card__title">' + escapeHtml(p.title) + '</div>' +
      '<div class="blog-pillar-card__desc">' + escapeHtml(p.description) + '</div>' +
      '<div class="blog-pillar-card__cta">Read the guide →</div>' +
      '</a>';
  }).join('\n    ');

  var hubBody = '<main class="blog-index">\n' +
    '  <div class="blog-index-hero">\n' +
    '    <h1>Morechard Blog</h1>\n' +
    '    <p>Practical guides on pocket money, chores, and raising financially confident children.</p>\n' +
    '  </div>\n' +
    '  <div class="blog-pillars-grid">\n    ' + pillarCards + '\n  </div>\n' +
    '</main>';

  var hubSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Morechard Blog',
    description: 'Practical guides on pocket money, chores, and raising financially confident children.',
    url: 'https://morechard.com/blog/'
  });
  var hubHead = '  <script type="application/ld+json">' + hubSchema + '<\/script>';
  write(path.join(DIST, 'blog', 'index.html'),
    fullPage('Blog', 'Practical guides on pocket money, chores, and raising financially confident children.',
      'https://morechard.com/blog/', hubHead, hubBody));
  console.log('[build] ✓ blog/index.html');

  // ── Pillar pages ──
  for (var i = 0; i < pillars.length; i++) {
    var pillar = pillars[i];
    var pillarSpokes = spokes.filter(function(s) { return s.pillar === pillar.slug; });
    var canonical = 'https://morechard.com/blog/' + pillar.slug + '/';

    var spokesList = pillarSpokes.length ? (
      '<section class="blog-pillar-spokes">\n' +
      '  <h2>Articles in this guide</h2>\n  <ul>\n' +
      pillarSpokes.map(function(s) {
        return '    <li><a href="/blog/' + s.slug + '/">' + escapeHtml(s.title) + '</a></li>';
      }).join('\n') +
      '\n  </ul>\n</section>'
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
      '<li aria-current="page">' + escapeHtml(pillar.title) + '</li>' +
      '</ol></nav>\n' +
      '<main class="blog-pillar">\n' +
      '  <header class="blog-header">\n' +
      '    <h1 class="blog-h1">' + escapeHtml(pillar.title) + '</h1>\n' +
      '    <div class="blog-meta">' +
      '<time datetime="' + escapeAttr(pillar.datePublished) + '">' + formatDate(pillar.datePublished) + '</time>' +
      ' <span>by ' + escapeHtml(pillar.author || 'Darren Savery') + '</span>' +
      '</div>\n  </header>\n' +
      '  <div class="blog-body">' + pillar.bodyHtml + '</div>\n' +
      spokesList +
      '</main>';

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
      mainEntityOfPage: { '@type': 'WebPage', '@id': spokeCanonical }
    });

    var spokeHead = '  <script type="application/ld+json">' + spokeArticle + '<\/script>\n' +
      '  <script type="application/ld+json">' + spokeBreadcrumb + '<\/script>';

    if (spoke.faq && spoke.faq.length) {
      spokeHead += '\n  <script type="application/ld+json">' + buildFaqJsonLd(spoke.faq) + '<\/script>';
    }

    var breadcrumbHtml = spokeBcItems.map(function(item, idx) {
      return idx === spokeBcItems.length - 1
        ? '<li aria-current="page">' + escapeHtml(item.name) + '</li>'
        : '<li><a href="' + item.url + '">' + escapeHtml(item.name) + '</a></li>';
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
      ' <span>by ' + escapeHtml(spoke.author || 'Darren Savery') + '</span>' +
      '</div>\n    </header>\n' +
      '    <div class="blog-body">' + spoke.bodyHtml + '</div>\n' +
      '  </article>\n' +
      clusterNav + '\n' +
      faqSection + '\n' +
      '</main>';

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
