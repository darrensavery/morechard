# Morechard.com — Full SEO / GEO Audit Report
**Date:** 24 June 2026  
**Site:** https://morechard.com (marketing site only; app.morechard.com excluded)  
**Status:** Pre-launch — marketing site live, app in early access  

---

## Overall SEO Health Score: **56 / 100**

| Category | Weight | Raw Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 71/100 | 15.6 |
| Content Quality / E-E-A-T | 23% | 52/100 | 12.0 |
| On-Page SEO | 20% | 58/100 | 11.6 |
| Schema / Structured Data | 10% | 62/100 | 6.2 |
| Performance (CWV) | 10% | 80/100 | 8.0 |
| AI Search Readiness (GEO) | 10% | 34/100 | 3.4 |
| Images | 5% | 68/100 | 3.4 |

**Baseline is solid on performance, crawlability, and security. The gap to 80+ is entirely fixable before launch through canonical hygiene, schema quality, content depth, and GEO infrastructure.**

---

## Business Context

Morechard is a UK-focused family pocket money PWA targeting parents of children aged 6–16, including separated/co-parenting households and schools. It competes with GoHenry, Rooster Money, Greenlight, and Starling Kite on the broad market, but is uniquely positioned on:

1. **Behaviour-triggered financial education** (not worksheets)  
2. **SHA-256 tamper-proof ledger** (court-ready audit trail)  
3. **One-time payment** (no subscription)  
4. **MaPS-aligned curriculum** (statutory UK financial education body)  

None of these differentiators are currently surfaced effectively in search or AI-generated answers.

---

## Top 5 Critical Issues

1. **Homepage missing canonical tag** — every other page has one; the most important page does not  
2. **www.morechard.com serves full content with no redirect** — every URL exists at two indexable addresses, splitting PageRank  
3. **No llms.txt file** — AI engines hit a 200 redirect to homepage HTML instead of a machine-readable summary  
4. **Blog pillar page "Money Across Two Homes" is 555 words with no author** — well below minimum for a topic that Morechard should own  
5. **No About / Company identity page** — zero transparency about who runs the site, critical E-E-A-T gap for a YMYL fintech product  

---

## Top 5 Quick Wins (can be done in < 1 day)

1. **Add `<link rel="canonical">` to homepage** — single line in build.js  
2. **Create llms.txt** — paste-and-deploy static file  
3. **Fix sitemap** — change 4 audience-page .html URLs to canonical non-.html forms  
4. **Fix Organization schema** — logo needs to be ImageObject not string; contactType spelling wrong  
5. **Fix blog publisher logo** — SVG favicon in BlogPosting schema fails Google validation; swap for PNG  

---

## Technical SEO (Score: 71/100)

### CRITICAL

**C-1 — www/non-www duplicate content**  
`https://www.morechard.com/` returns HTTP 200 with full content — no redirect to `https://morechard.com/`. Every page on the site is indexed at two addresses. Google will split crawl budget and PageRank.  
*Fix: Cloudflare dashboard → Bulk Redirect rule: `www.morechard.com/*` → `https://morechard.com/$1` (301)*

**C-2 — Homepage has no canonical tag**  
The `buildHomepageHeadExtras()` function uses `{{CANONICAL}}` for the OG:url but never outputs a `<link rel="canonical">`. All other pages have it. The homepage is the highest-risk page for the www duplicate issue above.  
*Fix: Add `<link rel="canonical" href="{{CANONICAL}}" />` to `buildHomepageHeadExtras()` in build.js*

### HIGH

**H-1 — OG/Twitter Card tags missing on all pages except homepage**  
Feature pages, audience pages, and all blog posts have no OG or Twitter meta. Word-of-mouth shares render as bare links.  

**H-2 — No hreflang tags** despite targeting en-GB, en-US, and Polish markets.  

**H-3 — Blog posts use WebPage schema** instead of BlogPosting — prevents author association and Article rich results. (Note: the scams article already uses BlogPosting correctly; inconsistency across other posts.)

**H-4 — Feature pages have no structured data at all.**

### MEDIUM

**M-1 — HSTS header not set.** Cloudflare dashboard fix.  
**M-2 — CSP references `darren-savery.workers.dev`** — reputational risk for a fintech product. Pending `api.morechard.com` custom domain (noted in CLAUDE.md).  
**M-3 — For-schools hero image is PNG, not WebP** — LCP regression risk on /for-schools.  
**M-4 — Blog thumbnail images have empty alt text.**  
**M-5 — Blog index title is "Blog | Morechard Blog"** — "Blog" appears twice.  
**M-6 — Sitemap lists .html URLs for audience pages** but their canonical tags point to non-.html URLs — unnecessary redirect hop.

### LOW

**L-1 — No llms.txt** (returns site HTML on redirect, not a machine-readable file)  
**L-2 — No IndexNow implementation** (Bing/Copilot lag)  
**L-3 — Hero img lacks width/height attributes** — CLS risk  
**L-4 — Google Fonts loaded without `display=swap`**

### PASSING

- robots.txt: clean, valid, sitemap referenced ✓  
- Sitemap completeness: all 19 URLs return 200 ✓  
- HTTPS enforcement: HTTP→HTTPS 301 on both www and non-www ✓  
- Image formats: WebP throughout with responsive srcset ✓  
- Security headers: X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy all present ✓  
- JavaScript rendering: static HTML, fully crawlable ✓  
- Blog URL structure: clean /blog/slug/ format ✓  

---

## Content Quality / E-E-A-T (Score: 52/100)

### CRITICAL

**C-1 — Blog "Money Across Two Homes" has 555 words and no author**  
This is Morechard's primary pillar for the co-parenting query cluster — "how do separated parents handle pocket money?" is a query AI engines answer daily. At 555 words, no author byline, no visible date, and "child development experts" cited without names, this page fails QRG standards for a YMYL-adjacent topic. The schema type is WebPage (not BlogPosting), preventing any author association.

**C-2 — No About / Company identity page**  
No About page, no Team page, no founder biography, no company registration number, no registered address anywhere on the site. Under the September 2025 QRG, transparency about who runs the site is a primary Trustworthiness requirement for fintech and YMYL content. GoHenry, Greenlight, and Starling Kite all have company disclosure pages.

### HIGH

**H-1 — Child psychologist consultant is unnamed on every page**  
"Developed in consultation with a registered child psychologist" appears once, unnamed. An unnamed consultant carries almost no E-E-A-T weight. Name them (with consent), include HCPC/BPS registration, and link to their profile.

**H-2 — No visible publish/updated dates on any page**  
Blog posts have `datePublished` in LD+JSON but it's not rendered in HTML. No page shows "Last updated." LLMs use page dates to assess whether information is current.

**H-3 — No social media presence linked from site**  
Footer has no social links. AI engines partially assess authority by independent web presence beyond the owned domain.

**H-4 — No social proof anywhere**  
No testimonials, reviews, star ratings. Expected pre-launch, but should be the first priority post-launch.

**H-5 — For-schools meta description is 202 characters** — truncated in SERPs. The "No cost to pilot" CTA will be cut.

### META DESCRIPTIONS — Recommended replacements for pages needing improvement

| Page | Current length | Issue | Recommended |
|---|---|---|---|
| Homepage | 161 chars | 1 char over | "Morechard turns children's real chores and pocket money into financial literacy lessons. Works for any family — one-time payment, no debit card needed." (152) |
| /for-schools | 202 chars | 42 chars over | "25 financial literacy modules mapped to PSHE, CfE, and Curriculum for Wales — each triggered by a child's real money. No cost to pilot with your school." (152) |
| /blog/ | 85 chars | Too short | "Practical guides on pocket money, chores, and raising financially confident children — written for UK parents and co-parents navigating family finances." (151) |
| /blog/money-across-two-homes/ | 167 chars | 7 chars over | "How separated parents can keep pocket money fair, track shared child expenses clearly, and stop money becoming a source of conflict between homes." (145) |

All other pages have acceptable meta descriptions.

---

## Schema / Structured Data (Score: 62/100)

### What exists (live site)

| Page | Schema present |
|---|---|
| Homepage | Organization + SoftwareApplication |
| /pricing | FAQPage (8 questions) |
| Blog posts (scams article) | BlogPosting + BreadcrumbList + FAQPage |
| Audience pages (/for-separated-families, /for-schools, /for-professionals) | FAQPage |
| Feature pages | **None** |
| Blog pillar posts | WebPage (wrong type) + BreadcrumbList |

### Validation failures on existing schemas

**Organization schema:**
- `logo` is a bare string URL pointing to an SVG favicon — Google requires ImageObject with url, width, height, and a PNG/WebP file ≥112×112px
- `contactType: "customer support"` — should be `"customer service"` (Schema.org enum)
- Missing `@id` property — blocks Knowledge Graph eligibility

**SoftwareApplication schema:**
- Offers missing `availability` property — required for Google rich results
- Missing `url` property
- Pre-launch status should use `"availability": "https://schema.org/PreOrder"` (change to InStock at launch)

**Blog publisher logo across all BlogPosting blocks:**
- Same SVG favicon issue as Organization

### Missing schemas of high value

| Schema | Page | Priority | Notes |
|---|---|---|---|
| WebSite with @id | Homepage | Critical | Enables sitelinks search eligibility |
| Organization (fixed) | Homepage | Critical | Current block fails validation |
| SoftwareApplication (fixed) | Homepage | High | Add url, availability to offers |
| BreadcrumbList | All audience + feature pages | High | Currently missing entirely |
| BlogPosting (replace WebPage) | Blog pillar pages | High | Needed for authorship signals |

### Key note on FAQPage schema  
FAQPage structured data does NOT produce Google SERP accordion rich results on commercial sites (Google restricted this in August 2023). However, it remains valuable for AI/LLM answer-box citation surfaces (ChatGPT, Perplexity, Gemini). Keep all FAQPage blocks — do not remove them.

---

## GEO / AI Search Readiness (Score: 34/100)

### AI Citability by Page

| Page | Score | Verdict |
|---|---|---|
| /features/financial-literacy | 38/100 | Best on site — 3 peer-reviewed citations, named curriculum taxonomy |
| /for-separated-families | 41/100 | Best opening passage, BYU/JFEI citation is strong |
| /blog/teaching-kids-to-spot-scams | 36/100 | Only page with author + date consistently applied |
| Homepage | 22/100 | "Coming Soon" appears before value proposition; buried claims |
| /blog/money-across-two-homes | 24/100 | No named sources, no author, no date, thin content |

### Platform Citation Likelihood

| Platform | Likelihood | Key blocker |
|---|---|---|
| Google AI Overviews | Low (28/100) | No structured data on key pages, no meta descriptions on some, no E-E-A-T |
| ChatGPT (web search) | Very low (22/100) | No Wikipedia entity, inconsistent authorship, marketing-oriented framing |
| Perplexity | Moderate (35/100) | FL page with attributed statistics is their best bet |
| Bing Copilot | Low (30/100) | No IndexNow, no structured data beyond schema |

### AI Crawler Access
All AI crawlers are implicitly allowed (wildcard allow). No explicit GPTBot/ClaudeBot/PerplexityBot directives. No llms.txt. Site is fully rendered static HTML — technically accessible.

### 5 Answer-Ready Content Gaps (queries AI engines answer using competitor content)

1. **"How much pocket money should I give my child UK 2026?"** — Highest-volume query in the space. Answered using Halifax/RoosterMoney surveys. Morechard's planned Pocket Money Index directly addresses this.

2. **"What is the best pocket money app for kids UK?"** — Comparison query. Perplexity/ChatGPT list GoHenry, Rooster Money, Greenlight. Morechard absent. Needs a comparison page anchored on its differentiators (no bank account, one-time payment, MaPS-aligned).

3. **"How to teach kids about money when parents are separated"** — Morechard has a content cluster on this but no authoritative, long-form, sourced, named-author guide.

4. **"What financial literacy topics should children learn by age?"** — The 6-pillar 25-module taxonomy is the perfect answer. Needs a public-facing reference page, not just product marketing.

5. **"Is [app] GDPR-safe for children / what data does a kids pocket money app collect?"** — Zero competitor has a good answer. Morechard's GDPR-K/COPPA positioning, SHA-256 audit trail, and nickname-only child data policy make this a winnable query.

---

## Performance (Score: 80/100)

- WebP images with responsive srcset throughout ✓  
- LCP hero has `fetchpriority="high"` ✓  
- Lazy loading on all below-fold images ✓  
- Cloudflare CDN + Pages ✓  
- **Risk:** For-schools hero still PNG (not WebP) — LCP regression  
- **Risk:** Hero img lacks width/height — CLS risk  
- **Risk:** Google Fonts without display=swap — FCP impact  

---

## Images (Score: 68/100)

- Hero images: WebP with portrait/landscape/ultrawide srcset ✓  
- Blog thumbnails: WebP ✓  
- Blog thumbnail alt text: empty `alt=""` on all — minor WCAG fail  
- For-schools hero: PNG placeholder ("Image placeholder" SVG) — not yet a real image  
- Logo: no PNG/WebP logo file exists at a stable URL — blocks Organization and BlogPosting schema validation  

---
