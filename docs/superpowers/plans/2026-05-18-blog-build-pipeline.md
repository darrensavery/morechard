# Morechard Blog — Static Build Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `marketing/build.js` to render Markdown blog posts and pillar pages at `/blog/`, with auto-generated JSON-LD schema, internal cluster links, and sitemap entries — launching with the P4 "Money across two homes" cluster.

**Architecture:** `marketing/blog/*.md` files (YAML front-matter + Markdown body) are processed by a new `buildBlog()` function appended to the existing `build()` call. Each file renders into a full page using existing `_partials` (nav/head/footer) and a blog-specific page assembler. The `/blog/` hub index and `dist/sitemap.xml` are auto-generated from front-matter. Nav is updated to link to `/blog/` and unhide the Resources group.

**Tech Stack:** Node.js CommonJS (existing), `markdown-it` npm package (one new dependency), custom inline YAML front-matter parser (no second dependency), existing Cloudflare Pages static hosting.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `marketing/package.json` | blog build dependencies (markdown-it) |
| Create | `marketing/blog/money-across-two-homes.md` | P4 pillar page content |
| Create | `marketing/blog/pocket-money-two-homes.md` | P4 spoke: fairness across homes |
| Create | `marketing/blog/money-double-standards-two-homes.md` | P4 spoke: different rules at each home |
| Create | `marketing/blog/tracking-shared-child-expenses.md` | P4 spoke: tracking shared expenses |
| Create | `marketing/css/blog.css` | Blog prose layout, breadcrumb, cluster nav, FAQ, index grid |
| Modify | `marketing/build.js` | Add `parseFrontMatter()`, `buildBlog()`, and JSON-LD helpers; call `buildBlog()` at end of `build()` |
| Modify | `marketing/_partials/_nav.html` | Unhide Resources group; update href `/resources/blog` → `/blog/` |

`dist/` is write-only (gitignored). `marketing/sitemap.xml` is the static base; `buildBlog()` overwrites `dist/sitemap.xml` with blog entries appended.

---

## Task 1: Create `marketing/package.json` and install `markdown-it`

**Files:**
- Create: `marketing/package.json`

- [ ] **Step 1: Create `marketing/package.json`**

```json
{
  "name": "morechard-marketing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node build.js"
  },
  "dependencies": {
    "markdown-it": "^14.1.0"
  }
}
```

Save to `marketing/package.json`.

- [ ] **Step 2: Install the dependency**

Run from the `marketing/` directory:
```
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\marketing"
npm install
```

Expected: `node_modules/markdown-it/` created, `package-lock.json` created.

- [ ] **Step 3: Verify markdown-it loads from build.js context**

```
node -e "const md = require('markdown-it')(); console.log(md.render('**ok**'))"
```

Run from `marketing/`. Expected output: `<p><strong>ok</strong></p>\n`

- [ ] **Step 4: Commit**

```
git add marketing/package.json marketing/package-lock.json
git commit -m "feat(blog): add marketing/package.json with markdown-it"
```

---

## Task 2: Create `marketing/css/blog.css`

**Files:**
- Create: `marketing/css/blog.css`

- [ ] **Step 1: Create the blog stylesheet**

```css
/* ── Blog: shared layout ── */
.blog-breadcrumb {
  max-width: var(--max-w);
  margin: calc(var(--h-nav) + 24px) auto 0;
  padding: 0 var(--pad-x);
}
.blog-breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
  list-style: none;
  font-size: 0.8rem;
  color: var(--text-sub);
}
.blog-breadcrumb li + li::before {
  content: '›';
  margin-right: 6px;
}
.blog-breadcrumb a {
  color: var(--text-sub);
  text-decoration: none;
}
.blog-breadcrumb a:hover { color: var(--teal); }

/* ── Blog post ── */
.blog-post,
.blog-pillar {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px var(--pad-x) 80px;
}

.blog-header { margin-bottom: 32px; }

.blog-h1 {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-dark);
  margin-bottom: 12px;
}

.blog-meta {
  font-size: 0.85rem;
  color: var(--text-sub);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* ── Prose ── */
.blog-body {
  font-size: 1.0625rem;
  line-height: 1.75;
  color: var(--text-dark);
}
.blog-body > * + * { margin-top: 1.25em; }
.blog-body h2 {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 600;
  margin-top: 2em;
  margin-bottom: 0.5em;
}
.blog-body h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.4em;
}
.blog-body ul,
.blog-body ol {
  padding-left: 1.5em;
}
.blog-body li + li { margin-top: 0.4em; }
.blog-body strong { font-weight: 600; }
.blog-body a { color: var(--teal); text-decoration: underline; text-underline-offset: 3px; }
.blog-body a:hover { color: var(--teal-dark); }
.blog-body blockquote {
  border-left: 3px solid var(--teal);
  padding: 12px 20px;
  background: var(--teal-06);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-style: italic;
  color: var(--text-sub);
}
.blog-body table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.blog-body th,
.blog-body td {
  border: 1px solid var(--border-light);
  padding: 8px 12px;
  text-align: left;
}
.blog-body th {
  background: var(--card-light);
  font-weight: 600;
}

/* ── Cluster nav (spoke pages) ── */
.blog-cluster-nav {
  margin-top: 48px;
  padding: 24px;
  background: var(--card-light);
  border-radius: var(--r-card);
}
.blog-cluster-nav__heading {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-sub);
  margin-bottom: 12px;
}
.blog-cluster-nav ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.blog-cluster-nav a {
  color: var(--teal);
  text-decoration: none;
  font-size: 0.95rem;
}
.blog-cluster-nav a:hover { text-decoration: underline; }

/* ── FAQ section ── */
.blog-faq {
  margin-top: 48px;
  border-top: 1px solid var(--border-light);
  padding-top: 32px;
}
.blog-faq h2 {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: 24px;
}
.blog-faq dl { display: flex; flex-direction: column; gap: 20px; }
.blog-faq dt {
  font-weight: 600;
  margin-bottom: 6px;
}
.blog-faq dd {
  color: var(--text-sub);
  line-height: 1.6;
  margin-left: 0;
}

/* ── Pillar spoke list ── */
.blog-pillar-spokes {
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid var(--border-light);
}
.blog-pillar-spokes h2 {
  font-family: var(--font-display);
  font-size: 1.2rem;
  margin-bottom: 16px;
}
.blog-pillar-spokes ul { list-style: none; display: flex; flex-direction: column; gap: 12px; }
.blog-pillar-spokes a {
  color: var(--text-dark);
  text-decoration: none;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}
.blog-pillar-spokes a::before { content: '→'; color: var(--teal); }
.blog-pillar-spokes a:hover { color: var(--teal); }

/* ── Blog hub index ── */
.blog-index {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: calc(var(--h-nav) + 48px) var(--pad-x) 80px;
}
.blog-index-hero { margin-bottom: 56px; }
.blog-index-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3rem);
  margin-bottom: 12px;
}
.blog-index-hero p {
  font-size: 1.1rem;
  color: var(--text-sub);
  max-width: 540px;
  line-height: 1.6;
}
.blog-pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 56px;
}
.blog-pillar-card {
  background: var(--card-light);
  border-radius: var(--r-card);
  padding: 24px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.2s;
}
.blog-pillar-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.blog-pillar-card__title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-dark);
}
.blog-pillar-card__desc { font-size: 0.9rem; color: var(--text-sub); line-height: 1.5; }
.blog-pillar-card__cta { font-size: 0.85rem; color: var(--teal); margin-top: auto; }

@media (max-width: 600px) {
  .blog-post, .blog-pillar { padding: 16px 16px 64px; }
  .blog-index { padding-top: calc(var(--h-nav) + 32px); }
}
```

- [ ] **Step 2: Verify the file saved and the build still passes**

Run from `marketing/`:
```
node build.js
```

Expected: same output as before (blog.css is not yet linked by any page — no error).

- [ ] **Step 3: Commit**

```
git add marketing/css/blog.css
git commit -m "feat(blog): add blog.css — prose layout, breadcrumb, cluster nav, FAQ, index grid"
```

---

## Task 3: Add helper functions and `buildBlog()` to `marketing/build.js`

This is the core task. Add the blog build step entirely inside `build.js` — no new files needed beyond the CSS and content files.

**Files:**
- Modify: `marketing/build.js`

### 3a — Add helper functions before `build()`

- [ ] **Step 1: Add `formatDate()`, `parseFrontMatter()`, and JSON-LD builders before the `build()` function**

Insert the following block immediately before the `// ── Main build ──` comment line in `build.js`:

```js
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
    const kv = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (kv && kv[1]) {
      meta[kv[1]] = kv[2];
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
```

### 3b — Add `buildBlog()` function before `build()`

- [ ] **Step 2: Add the `buildBlog()` function immediately after the helpers above**

```js
function buildBlog(headCommon, navHtml, footerHtml, hash) {
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
    posts.push(Object.assign({}, meta, { bodyHtml: md.render(body) }));
  }

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
      '<div class="blog-pillar-card__title">' + escapeAttr(p.title) + '</div>' +
      '<div class="blog-pillar-card__desc">' + escapeAttr(p.description) + '</div>' +
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
        return '    <li><a href="/blog/' + s.slug + '/">' + escapeAttr(s.title) + '</a></li>';
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
      '<li aria-current="page">' + escapeAttr(pillar.title) + '</li>' +
      '</ol></nav>\n' +
      '<main class="blog-pillar">\n' +
      '  <header class="blog-header">\n' +
      '    <h1 class="blog-h1">' + escapeAttr(pillar.title) + '</h1>\n' +
      '    <div class="blog-meta">' +
      '<time datetime="' + escapeAttr(pillar.datePublished) + '">' + formatDate(pillar.datePublished) + '</time>' +
      ' <span>by ' + escapeAttr(pillar.author || 'Darren Savery') + '</span>' +
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
        ? '<li aria-current="page">' + escapeAttr(item.name) + '</li>'
        : '<li><a href="' + item.url + '">' + escapeAttr(item.name) + '</a></li>';
    }).join('');

    var clusterNav = '';
    if (siblings.length || parent) {
      clusterNav = '<aside class="blog-cluster-nav">\n' +
        '  <div class="blog-cluster-nav__heading">More in this topic</div>\n  <ul>\n' +
        siblings.map(function(s) {
          return '    <li><a href="/blog/' + s.slug + '/">' + escapeAttr(s.title) + '</a></li>';
        }).join('\n') +
        (parent ? '\n    <li><a href="/blog/' + parent.slug + '/">All articles: ' + escapeAttr(parent.title) + ' →</a></li>' : '') +
        '\n  </ul>\n</aside>';
    }

    var faqSection = '';
    if (spoke.faq && spoke.faq.length) {
      faqSection = '<section class="blog-faq">\n  <h2>Frequently asked questions</h2>\n  <dl>\n' +
        spoke.faq.map(function(f) {
          return '    <dt>' + escapeAttr(f.q) + '</dt>\n    <dd>' + escapeAttr(f.a) + '</dd>';
        }).join('\n') +
        '\n  </dl>\n</section>';
    }

    var spokeBody = '<nav class="blog-breadcrumb" aria-label="Breadcrumb"><ol>' + breadcrumbHtml + '</ol></nav>\n' +
      '<main class="blog-post">\n' +
      '  <article class="blog-article">\n' +
      '    <header class="blog-header">\n' +
      '      <h1 class="blog-h1">' + escapeAttr(spoke.title) + '</h1>\n' +
      '      <div class="blog-meta">' +
      '<time datetime="' + escapeAttr(spoke.datePublished) + '">' + formatDate(spoke.datePublished) + '</time>' +
      ' <span>by ' + escapeAttr(spoke.author || 'Darren Savery') + '</span>' +
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
    var loc = p.type === 'pillar'
      ? 'https://morechard.com/blog/' + p.slug + '/'
      : 'https://morechard.com/blog/' + p.slug + '/';
    return '  <url>\n' +
      '    <loc>' + loc + '</loc>\n' +
      '    <lastmod>' + (p.dateModified || p.datePublished) + '</lastmod>\n' +
      '    <changefreq>monthly</changefreq>\n' +
      '    <priority>' + (p.type === 'pillar' ? '0.8' : '0.7') + '</priority>\n' +
      '  </url>';
  }).join('\n');

  // Add hub /blog/ entry + blog posts
  var hubEntry = '  <url>\n    <loc>https://morechard.com/blog/</loc>\n    <lastmod>' +
    new Date().toISOString().slice(0, 10) + '</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>';

  var updatedSitemap = sitemapBase.replace('</urlset>',
    hubEntry + '\n' + blogEntries + '\n</urlset>');
  write(sitemapPath, updatedSitemap);
  console.log('[build] ✓ sitemap.xml (blog entries appended)');

  console.log('[build] ✓ blog (' + posts.length + ' pages)');
}
```

### 3c — Call `buildBlog()` from `build()`

- [ ] **Step 3: Add the `buildBlog()` call at the end of the `build()` function**

Locate the final `console.log` line in `build()`:
```js
  console.log(`\n[build] Done — ${Object.keys(components).length} components, hash=${hash}\n`);
```

Insert the `buildBlog()` call immediately before it:
```js
  // 8. Build blog
  buildBlog(headCommon, navHtml, footerHtml, hash);

  console.log(`\n[build] Done — ${Object.keys(components).length} components, hash=${hash}\n`);
```

- [ ] **Step 4: Verify the build runs without error (no blog/ directory yet = early return)**

Run from `marketing/`:
```
node build.js
```

Expected: all existing pages build successfully, plus `[build] Done —` line. No blog output yet because `marketing/blog/` does not exist.

- [ ] **Step 5: Commit**

```
git add marketing/build.js
git commit -m "feat(blog): add parseFrontMatter, buildBlog, JSON-LD helpers to build.js"
```

---

## Task 4: Create the P4 pillar content file

**Files:**
- Create: `marketing/blog/money-across-two-homes.md`

- [ ] **Step 1: Create the pillar file with complete content**

```markdown
---
title: Money across two homes: a practical guide for separated parents
slug: money-across-two-homes
type: pillar
description: How to keep pocket money, chores, and shared child expenses fair and clear when your children split time between two homes — without turning money into a battleground.
author: Darren Savery
datePublished: 2026-06-01
dateModified: 2026-06-01
targetQuery: pocket money two homes fair
schemaType: WebPage
faq:
  - q: Do both parents need to use the same pocket money system?
    a: Not necessarily, but having a shared approach prevents confusion for children. Even agreeing on a broad framework — a consistent weekly amount, whether it is linked to chores — saves significant friction later. The more you can agree, the simpler it is for your child.
  - q: What if we cannot agree on pocket money arrangements?
    a: Focus on what you control. Keep a clear, written record of what you give and what you pay for. A consistent record from one home is still valuable — both for your child's financial learning and, if things ever escalate, as a straightforward account of your contributions.
  - q: Is a written record of child expenses legally useful?
    a: Family mediators and solicitors increasingly recommend keeping a clear record of child-related financial contributions. A tamper-proof, dated record of what each home has paid for removes ambiguity and gives any future mediator or court a clear picture — without requiring a lawyers argument over memory.
---

## Managing money across two homes

When children split time between two households, money quickly becomes complicated. Who gives pocket money, and how much? Who pays for the school trip, the new trainers, the birthday party gift? And when one home has different rules from the other, how does your child make sense of it?

These are not small questions. How families handle money shapes how children think about it for decades. The good news: it does not require perfect co-parenting, or even a friendly relationship with the other parent. It requires clarity and consistency in your own home, a simple way to track contributions, and enough of a shared framework to stop money becoming a loyalty test for your child.

This guide covers everything separated parents need to know about pocket money, chores, shared expenses, and keeping a fair record across two homes.

## Why money gets complicated in separated families

A child living between two homes is, in effect, navigating two financial cultures. One home may link pocket money to chores; the other may give a flat weekly sum regardless. One may pay for extracurriculars without question; the other may ask the child to contribute from savings.

None of this is inherently wrong. **Different rules at each home are normal** — children adapt surprisingly well when those rules are explained clearly and applied consistently. What causes harm is when money becomes the mechanism for sending messages to the other parent, or when a child feels financially safer at one home than the other.

## What the research says

Child development experts are consistent on one point: **children need to feel financially secure** across both homes. A sense that "money is always tight here but not there" — or worse, that one parent is more generous as a way of scoring points — creates lasting anxiety. The goal is not equal amounts of pocket money at each home, but **equal clarity and fairness within each home**.

## The four things to get right

### 1. A consistent baseline at your home

Decide on a pocket money amount that reflects your child's age and your circumstances. Stick to it. Predictability matters more than the exact amount.

### 2. A clear link (or not) between chores and money

**Separating base pocket money from bonus earnings** is the approach most family experts recommend. A weekly baseline teaches money management; extra tasks earn extra cash. This structure works regardless of what the other home does, because it gives your child a clear, fair framework they can explain to friends — and to the other parent.

### 3. A simple way to track shared expenses

School trips, uniforms, clubs, medical costs — separated parents often disagree about who has paid what. Keeping a straightforward record of what your home contributes, with dates and amounts, prevents these disputes from escalating. It also gives any mediator or solicitor a clear picture if things ever get formal.

### 4. Protecting your child from the argument

Children should never be the messenger for financial disputes. "Tell your dad he owes me for the school shoes" puts a child in an impossible position. Handle money conversations between parents directly — or through a mediator — and keep the child's experience of money as simple and positive as possible.

## In this guide

The articles below cover each of these areas in detail.
```

Save to `marketing/blog/money-across-two-homes.md`.

- [ ] **Step 2: Run the build and verify the pillar page was generated**

```
node build.js
```

Expected console lines including:
```
[build] ✓ blog/index.html
[build] ✓ blog/money-across-two-homes/
[build] ✓ blog (1 pages)
```

- [ ] **Step 3: Spot-check the generated HTML**

```
node -e "
const fs = require('fs');
const html = fs.readFileSync('dist/blog/money-across-two-homes/index.html', 'utf8');
console.assert(html.includes('BreadcrumbList'), 'BreadcrumbList missing');
console.assert(html.includes('WebPage'), 'WebPage schema missing');
console.assert(html.includes('blog-pillar'), 'blog-pillar class missing');
console.assert(html.includes('morechard.com/blog/money-across-two-homes/'), 'canonical missing');
console.log('Pillar page checks passed');
"
```

Run from `marketing/`. Expected: `Pillar page checks passed`

- [ ] **Step 4: Commit**

```
git add marketing/blog/money-across-two-homes.md
git commit -m "content(blog/p4): add Money Across Two Homes pillar page"
```

---

## Task 5: Create the three P4 spoke files

**Files:**
- Create: `marketing/blog/pocket-money-two-homes.md`
- Create: `marketing/blog/money-double-standards-two-homes.md`
- Create: `marketing/blog/tracking-shared-child-expenses.md`

### Spoke 1: pocket-money-two-homes.md

- [ ] **Step 1: Create the file**

```markdown
---
title: Pocket money in two homes: keeping it fair and consistent
slug: pocket-money-two-homes
type: post
pillar: money-across-two-homes
description: Practical guidance for separated parents on keeping pocket money fair, consistent, and free from conflict when children split time between two homes.
author: Darren Savery
datePublished: 2026-06-01
dateModified: 2026-06-01
targetQuery: pocket money two homes fair
schemaType: BlogPosting
faq:
  - q: Do both parents need to give the same amount of pocket money?
    a: Not necessarily, but agreeing on a consistent approach prevents confusion. If amounts differ, helping your child understand there are simply different rules at each home — without framing it as unfair — is the key. Most children adapt when the rules are explained clearly and applied consistently.
  - q: What if the other parent refuses to co-ordinate?
    a: You can only control your own home. Focus on what you give, what your child learns from it, and keeping a clear record of your contributions. A straightforward record protects your child's financial story regardless of what happens at the other home.
  - q: Should pocket money be withheld as a punishment?
    a: Most child development experts advise against it. Using money as leverage creates anxiety around finances. Keeping pocket money consistent — and handling discipline separately — gives your child a healthier relationship with money long-term.
---

Pocket money in two homes: keeping it fair and consistent. When children split time between two households, **pocket money can quickly become a source of confusion or conflict**. Agreeing on a broad framework — even if amounts differ — gives children the financial consistency they need to feel secure across both homes.

## Why consistency matters more than equal amounts

Children are remarkably good at understanding that different homes have different rules. What they struggle with is **unpredictability** — not knowing from week to week what they will receive, or feeling that money at one home is used to make a point about the other.

The goal is not to match the other parent pound for pound. The goal is to give your child a reliable, predictable arrangement at your home that they can count on.

## A framework that works in any co-parenting arrangement

Whether you co-parent amicably or through a solicitor, the following structure keeps pocket money straightforward:

**Base allowance — unconditional**

A weekly or fortnightly sum that your child can count on, regardless of behaviour or what happened at the other home. This is their financial foundation: it teaches budgeting, saving, and patience without tying money to emotional outcomes.

| Age | Suggested weekly range (UK, 2026) |
|---|---|
| 5–7 | £1.50 – £3 |
| 8–10 | £3 – £5 |
| 11–13 | £5 – £8 |
| 14–16 | £8 – £15 |

These are starting points — adjust for your circumstances. What matters is consistency, not the exact figure.

**Extra earnings — for extra tasks**

Beyond the base allowance, children can earn additional money by taking on jobs above their regular responsibilities. This models real-world effort-and-reward without making basic family contributions feel transactional.

## When amounts differ between homes

If the other home gives more or less, resist the temptation to compete. Explain calmly: "In this home, we do it this way." Most children — especially younger ones — accept this quickly when the explanation is matter-of-fact rather than defensive.

If significant differences are causing genuine distress for your child, it is worth raising in mediation. A shared approach to pocket money is a reasonable thing to discuss, even if many other financial arrangements are in dispute.

## Keeping a record

A simple written record of what your child receives from your home — dates, amounts, and what it covered — protects everyone. It is not about building a legal case; it is about having a clear, honest account if questions ever arise. A straightforward digital record is enough.
```

### Spoke 2: money-double-standards-two-homes.md

- [ ] **Step 2: Create the file**

```markdown
---
title: "Different rules at each home: handling money double standards"
slug: money-double-standards-two-homes
type: post
pillar: money-across-two-homes
description: When children face different financial rules at each parent's home, the challenge is helping them adapt without turning money into a source of conflict or insecurity.
author: Darren Savery
datePublished: 2026-06-01
dateModified: 2026-06-01
targetQuery: different money rules two homes children
schemaType: BlogPosting
faq:
  - q: Is it harmful for children to have different pocket money rules at each home?
    a: Not inherently. Children adapt well to different household rules when those rules are consistent within each home and explained clearly. The difficulty arises when rules are inconsistent, unpredictable, or used to make a point about the other parent.
  - q: What if one parent is much more generous to undermine the other?
    a: This is sometimes called "Disney parent" behaviour — one home becomes the fun, generous one while the other enforces structure. The best response is to stay consistent and not compete. Children eventually recognise the difference between reliable care and being bought.
  - q: How do we handle a child demanding the same rules as the other home?
    a: Acknowledge what they are feeling, then explain your own household's approach without criticising the other parent. "I understand it works differently at Dad's — in our home, we do it this way, and here is why." Simple, calm, and non-comparative.
---

Different rules at each home: handling money double standards. When children move between two households, **different financial rules are almost inevitable** — and usually harmless. The key is making sure those differences do not become a source of insecurity, comparison, or conflict for your child.

## Different rules are normal — unpredictable rules are the problem

Most children with separated parents learn to navigate different expectations across two homes. They adapt their behaviour to different bedtimes, screen rules, and food choices without major difficulty. **Money is no different when the rules at each home are clear and consistent**.

The problems arise when:

- Rules change week to week with no explanation
- Money is used as a reward for saying something negative about the other parent
- A child is made to feel guilty for spending money given by the other home
- Differences in generosity are used to score points rather than reflect genuine means

## How to talk about financial differences without criticising the other parent

When your child says "Dad gives me £10 a week — why do you only give me £5?", it is tempting to explain at length why. Resist the urge. A simple, calm response works best:

> "We do things differently in our home. Your £5 is yours to save or spend — what would you like to do with it?"

This validates the question, explains nothing is wrong, and redirects to the positive. Avoiding any comparison of your financial situation to the other home protects your child from feeling caught in the middle.

## When one home is consistently more generous

Sometimes the gap is significant — one home gives freely, the other enforces budgets. If this is creating resentment or making your child feel that one home is better than the other, it may be worth raising at a mediation session.

A shared framework does not require identical amounts. It might simply mean both parents agree on:

- A reasonable weekly range for the child's age
- Whether pocket money is linked to any tasks
- How shared expenses (school trips, clubs) are split

Even a basic written agreement on these points — reached through mediation rather than argument — can remove significant friction.

## Protecting your child from the argument

The most important thing is ensuring your child never feels they are the messenger for financial disputes. Keep money conversations between parents, handle disagreements through mediation if needed, and let your child's experience of money at your home be as simple and positive as possible.
```

### Spoke 3: tracking-shared-child-expenses.md

- [ ] **Step 3: Create the file**

```markdown
---
title: Tracking shared child expenses without arguments
slug: tracking-shared-child-expenses
type: post
pillar: money-across-two-homes
description: A practical approach for separated parents to keep a clear, fair record of shared child expenses — school trips, clubs, uniforms, and more — without it becoming a source of conflict.
author: Darren Savery
datePublished: 2026-06-01
dateModified: 2026-06-01
targetQuery: tracking shared child expenses separated parents
schemaType: BlogPosting
faq:
  - q: What counts as a shared child expense?
    a: Typically anything beyond day-to-day living costs — school trips, uniforms, extracurricular clubs, sports equipment, medical or dental costs not covered by the NHS, and one-off items like a new school bag or birthday gifts for the child's friends. Routine costs like food, transport, and basic clothing are usually assumed within each home's everyday budget.
  - q: Do we need a formal agreement about shared expenses?
    a: A formal court order or financial consent order is the legally binding route. For many families, a written record agreed between parents — or documented through mediation — is sufficient. The key is that both parents have agreed in advance what counts as shared, what the split is, and how requests are made.
  - q: What if the other parent refuses to pay their share?
    a: Keep a clear, dated record of every request and every response. This creates an honest paper trail that a mediator or family solicitor can use. It also means your child's financial needs are documented — regardless of what the other home contributes.
---

Tracking shared child expenses without arguments. When children split time between two homes, shared costs — school trips, clubs, uniforms — quickly become a source of dispute. **A simple, clear record of what each home has paid for** removes the "I paid for that" arguments and gives both parents a fair, honest account to refer to.

## Why shared expenses cause so much friction

Individual parents have no difficulty knowing what they have paid for. The problem is that each parent only sees their own spending. Without a shared record, both parties can end up convinced they have contributed more — because they have full knowledge of their own payments and incomplete knowledge of the other home's.

A written record changes this. It makes both sides visible.

## What counts as a shared expense

Not everything needs to be split. It helps to agree in advance on categories:

**Usually shared:**
- School trips and residential activities
- Extracurricular clubs and lessons
- Sports equipment
- Uniform costs above the basic set
- Medical or dental costs not covered by NHS
- One-off significant purchases (laptop for school, instrument for lessons)

**Usually not shared:**
- Day-to-day food, transport, and clothing
- Pocket money and small treats
- Birthday presents from each parent

The clearer the categories, the fewer the arguments.

## A practical system for keeping track

You do not need specialist software. The basics are:

1. **Agree in advance** which categories are shared and what the split is (50/50, 60/40, or whatever reflects your respective incomes)
2. **Keep a record** of every shared expense — date, what it was for, amount paid, and by whom
3. **Reconcile regularly** — monthly or termly — rather than letting costs accumulate into a large, contested bill
4. **Communicate in writing** — requests for shared expense contributions should be in text or email, with a receipt attached. This creates a clear record for both parties

## When records matter most

Most of the time, a shared expense record is simply practical admin. Occasionally it becomes more important:

- If a parenting arrangement is reviewed by a court, a clear record of financial contributions is highly relevant
- If mediation is needed to resolve a dispute, a dated record is far more persuasive than memory
- If your child grows up and asks who paid for their education and activities, you have an honest answer

Keeping a clear record from the beginning costs almost nothing. Not keeping one can cost significantly more in stress, legal fees, and broken trust.

## Keeping records from your home

Even if the other parent will not co-operate with a shared system, keeping your own home's records is always worth doing. A dated account of what you have paid for — consistent and honest — protects your child's financial story and your own peace of mind.
```

- [ ] **Step 4: Run the build and verify all spoke pages generate**

```
node build.js
```

Expected console lines including:
```
[build] ✓ blog/money-across-two-homes/
[build] ✓ blog/pocket-money-two-homes/
[build] ✓ blog/money-double-standards-two-homes/
[build] ✓ blog/tracking-shared-child-expenses/
[build] ✓ blog (4 pages)
```

- [ ] **Step 5: Spot-check a spoke page**

```
node -e "
const fs = require('fs');
const html = fs.readFileSync('dist/blog/pocket-money-two-homes/index.html', 'utf8');
console.assert(html.includes('BlogPosting'), 'BlogPosting schema missing');
console.assert(html.includes('BreadcrumbList'), 'BreadcrumbList missing');
console.assert(html.includes('FAQPage'), 'FAQPage schema missing');
console.assert(html.includes('blog-cluster-nav'), 'Cluster nav missing');
console.assert(html.includes('money-across-two-homes'), 'Pillar link missing');
console.log('Spoke page checks passed');
"
```

Run from `marketing/`. Expected: `Spoke page checks passed`

- [ ] **Step 6: Verify sitemap contains blog entries**

```
node -e "
const fs = require('fs');
const xml = fs.readFileSync('dist/sitemap.xml', 'utf8');
console.assert(xml.includes('morechard.com/blog/'), 'blog hub missing from sitemap');
console.assert(xml.includes('pocket-money-two-homes'), 'spoke missing from sitemap');
console.assert(xml.includes('lastmod'), 'lastmod missing from sitemap');
console.log('Sitemap checks passed');
"
```

Expected: `Sitemap checks passed`

- [ ] **Step 7: Commit**

```
git add marketing/blog/
git commit -m "content(blog/p4): add 3 spoke pages — pocket money, double standards, shared expenses"
```

---

## Task 6: Update the nav to expose the Blog link

**Files:**
- Modify: `marketing/_partials/_nav.html`

- [ ] **Step 1: Unhide the Resources nav group and update the Blog href**

In `marketing/_partials/_nav.html`, locate the Resources group:

```html
      <li class="nav-group" data-group="resources" hidden>
        <button class="nav-trigger" type="button" aria-expanded="false" aria-haspopup="true">Resources
```

Change the opening tag to remove `hidden` and keep only the Blog link active. Replace the entire Resources group:

```html
      <li class="nav-group" data-group="resources">
        <button class="nav-trigger" type="button" aria-expanded="false" aria-haspopup="true">Resources
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <ul class="nav-panel" role="menu">
          <li><a href="/blog/" role="menuitem">Blog</a></li>
        </ul>
      </li>
```

(Remove the knowledge-base and press links — those pages do not exist yet. Add them back when they are built.)

- [ ] **Step 2: Run the build and verify the nav is present in output**

```
node build.js
```

Then:
```
node -e "
const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
console.assert(!html.includes('data-group=\"resources\" hidden'), 'Resources still hidden');
console.assert(html.includes('href=\"/blog/\"'), 'Blog link missing');
console.log('Nav checks passed');
"
```

Run from `marketing/`. Expected: `Nav checks passed`

- [ ] **Step 3: Commit**

```
git add marketing/_partials/_nav.html
git commit -m "feat(nav): unhide Resources group, add /blog/ link"
```

---

## Task 7: Full build verification

- [ ] **Step 1: Clean dist/ and do a fresh build**

```
rmdir /s /q "e:\Web-Video Design\Claude\Apps\Pocket Money\marketing\dist"
cd "e:\Web-Video Design\Claude\Apps\Pocket Money\marketing"
node build.js
```

Expected: all pages build, blog/ directory created in dist/, no errors.

- [ ] **Step 2: Run the comprehensive check script**

```
node -e "
const fs = require('fs');
const path = require('path');
const dist = 'dist';

const checks = [
  ['Blog hub exists',         'dist/blog/index.html'],
  ['P4 pillar exists',        'dist/blog/money-across-two-homes/index.html'],
  ['Spoke 1 exists',          'dist/blog/pocket-money-two-homes/index.html'],
  ['Spoke 2 exists',          'dist/blog/money-double-standards-two-homes/index.html'],
  ['Spoke 3 exists',          'dist/blog/tracking-shared-child-expenses/index.html'],
];

for (const [name, p] of checks) {
  if (!fs.existsSync(p)) { console.error('FAIL: ' + name + ' — ' + p + ' not found'); process.exit(1); }
  console.log('PASS: ' + name);
}

// Schema checks on spoke
const spoke = fs.readFileSync('dist/blog/pocket-money-two-homes/index.html', 'utf8');
const schemaChecks = ['BlogPosting', 'BreadcrumbList', 'FAQPage', 'blog-cluster-nav', '/blog/money-across-two-homes/'];
for (const token of schemaChecks) {
  if (!spoke.includes(token)) { console.error('FAIL schema: ' + token + ' missing'); process.exit(1); }
  console.log('PASS schema: ' + token);
}

// Sitemap
const sitemap = fs.readFileSync('dist/sitemap.xml', 'utf8');
if (!sitemap.includes('morechard.com/blog/pocket-money-two-homes/')) {
  console.error('FAIL: spoke missing from sitemap'); process.exit(1);
}
console.log('PASS: sitemap contains spoke URL');
console.log('All checks passed.');
"
```

Run from `marketing/`. Expected: all `PASS` lines, then `All checks passed.`

- [ ] **Step 3: Check CSS is linked on blog pages**

```
node -e "
const fs = require('fs');
const html = fs.readFileSync('dist/blog/pocket-money-two-homes/index.html', 'utf8');
console.assert(html.includes('/css/blog.css'), 'blog.css not linked');
console.assert(html.includes('/css/base.css'), 'base.css not linked');
console.log('CSS checks passed');
"
```

Expected: `CSS checks passed`

- [ ] **Step 4: Final commit**

```
git add -A
git commit -m "feat(blog): complete build pipeline — P4 cluster live, nav updated, sitemap extended"
```

---

## After this plan

**Content pipeline — ongoing** (not part of this implementation task):

The build pipeline is complete. Remaining blog content should be authored as additional `.md` files in `marketing/blog/` following the front-matter schema established above. Priority order per the spec:

1. **P1 spoke files:** pocket money by age, chores-linked debate, pocket money vs allowance
2. **P2 spoke files:** age-appropriate chores, should you pay for chores, nagging, character building
3. **P3 spoke files:** teaching money stage by stage, saving habits, needs vs wants, delayed gratification
4. **Remaining P4 spokes:** professional-facing and commercial spoke
5. **Pillar pages for P1, P2, P3**
6. **Flagship data piece** (Morechard Family Chores & Money Report)

Each new file runs through the same pipeline with `node marketing/build.js`.

**Author page** (`/blog/author/darren-savery/`) — enhances E-E-A-T signals. Add after the first cluster is published.

**OG images** — one per pillar cluster improves social sharing and AI citation thumbnails. Add `og-blog-p4.jpg` etc. and link via a front-matter `ogImage` field (extend `buildBlog()` accordingly).

**Pillar features nav** — the memory note says the Features nav group is `hidden` until all 3 feature pages are built. Blog is now live; keep Features hidden until that task is complete.