# Morechard.com — SEO / GEO Action Plan
**Generated:** 24 June 2026  
**Current Health Score:** 56/100  
**Target (pre-launch):** 78/100  

Issues ranked by **expected impact × effort ratio**. Fix in order.

---

## CRITICAL — Fix before any outreach or PR (blocks indexing / AI citation)

### 1. Add canonical tag to homepage
**Impact:** HIGH | **Effort:** 15 min  
In `marketing/build.js`, inside `buildHomepageHeadExtras()`, add `<link rel="canonical" href="{{CANONICAL}}" />` before the OG tags.  
*File: `marketing/build.js` ~line 208*

### 2. Fix www/non-www duplicate
**Impact:** HIGH | **Effort:** 5 min (Cloudflare dashboard)  
Cloudflare dashboard → Rules → Redirect Rules → Bulk Redirect:  
`www.morechard.com/*` → `https://morechard.com/$1` (301, preserve path)  
*This cannot be done from the codebase — requires dashboard access.*

### 3. Create llms.txt
**Impact:** HIGH for AI engines | **Effort:** 30 min  
Create `marketing/llms.txt` as a static file (it is copied to dist by the build). Contents: see generated file in `docs/seo/llms.txt`.  
*File: `marketing/llms.txt` (new)*

### 4. Fix Organization schema — logo must be ImageObject
**Impact:** HIGH (blocks Knowledge Graph) | **Effort:** 20 min  
In `marketing/build.js` `buildHomepageHeadExtras()`:
- Change `"logo": "https://morechard.com/favicon.svg"` to a proper `ImageObject` pointing to a PNG logo file
- Change `"contactType": "customer support"` → `"customer service"`
- Add `"@id": "https://morechard.com/#organization"`
**Prerequisite:** A PNG or WebP logo file must exist. Create `marketing/logo-512.png` (512×512, just the M mark or wordmark on transparent background).  
*File: `marketing/build.js`; also `marketing/logo-512.png` (new asset)*

### 5. Fix sitemap — audience pages use .html URLs instead of canonical non-.html
**Impact:** MEDIUM | **Effort:** 5 min  
In `marketing/sitemap.xml`, change:
- `for-single-households.html` → `for-single-households`
- `for-separated-families.html` → `for-separated-families`
- `for-professionals.html` → `for-professionals`
- `for-schools.html` → `for-schools`
*File: `marketing/sitemap.xml`*

---

## HIGH — Fix within 1 week (significant ranking and citation improvement)

### 6. Add WebSite schema to homepage
**Impact:** HIGH (sitelinks eligibility) | **Effort:** 10 min  
Add to `buildHomepageHeadExtras()` in build.js:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://morechard.com/#website",
  "name": "Morechard",
  "url": "https://morechard.com",
  "inLanguage": "en-GB",
  "publisher": { "@id": "https://morechard.com/#organization" }
}
```

### 7. Fix SoftwareApplication schema — add url and availability
**Impact:** HIGH | **Effort:** 15 min  
Add `"url": "https://morechard.com"` and change each Offer to include `"availability": "https://schema.org/PreOrder"` (change to InStock at launch).

### 8. Fix blog publisher logo across all BlogPosting schemas
**Impact:** HIGH (Google Article rich results) | **Effort:** 10 min  
In `marketing/build.js` ~line 655, change:
```js
logo: { '@type': 'ImageObject', url: 'https://morechard.com/favicon.svg' }
```
to:
```js
logo: { '@type': 'ImageObject', url: 'https://morechard.com/logo-512.png', width: 512, height: 512 }
```
*Requires logo-512.png to exist (see item 4)*

### 9. Add BreadcrumbList to audience and feature pages
**Impact:** HIGH | **Effort:** 2 hr  
Each audience page (`for-*.html`) and feature page (`features/*.html`) needs a `BreadcrumbList` schema. See `docs/seo/FULL-AUDIT-REPORT.md` for generated JSON-LD blocks.

### 10. Fix for-schools meta description (202 chars → 152)
**Impact:** HIGH (the pilot CTA is being cut) | **Effort:** 2 min  
In `marketing/src/for-schools.html`, change the DESCRIPTION comment to:  
"25 financial literacy modules mapped to PSHE, CfE, and Curriculum for Wales — each triggered by a child's real money. No cost to pilot with your school."

### 11. Expand "Money Across Two Homes" blog post to 1,800+ words with author
**Impact:** HIGH (co-parenting query cluster) | **Effort:** 4 hr writing  
- Expand body to 1,800–2,200 words
- Add named, linked sources (ONS co-parenting statistics, Relate/OnePlusOne guidance)
- Add author byline (Darren Savery) in HTML and change schema type from WebPage to BlogPosting
- Fix meta description to 145 chars (see FULL-AUDIT-REPORT.md)

### 12. Add author bylines and visible dates to all blog posts
**Impact:** HIGH (E-E-A-T, AI citation) | **Effort:** 2 hr  
Currently only the scams article has a visible author and date. Add to all posts.

### 13. Add hreflang tags for en-GB / en-US / x-default
**Impact:** MEDIUM-HIGH | **Effort:** 1 hr  
Add to head template in build.js for all pages.

---

## MEDIUM — Fix within 1 month

### 14. Create an About / Company page
**Impact:** HIGH E-E-A-T | **Effort:** 4 hr  
Minimum: registered company name + number, founder background, contact details. Link from footer. Name the child psychologist consultant.

### 15. Name the child psychologist on the Financial Literacy page
**Impact:** HIGH E-E-A-T | **Effort:** 30 min (pending consent)  
Adds a named, credentialled professional to the strongest-performing page on the site.

### 16. Set HSTS via Cloudflare dashboard
**Impact:** MEDIUM | **Effort:** 5 min  
SSL/TLS → Edge Certificates → HSTS → max-age=31536000

### 17. Fix api.morechard.com custom domain (CSP cleanup)
**Impact:** Trust/brand | **Effort:** 1 hr  
Per CLAUDE.md — custom domain for API worker. Removes personal `.workers.dev` subdomain from CSP header.

### 18. Add descriptive alt text to blog thumbnail images
**Impact:** MEDIUM (image search, accessibility) | **Effort:** 2 hr  
Change `alt=""` to article title text on all blog-article-item thumbnails.

### 19. Fix blog index title — remove duplicate "Blog"
**Impact:** LOW-MEDIUM | **Effort:** 2 min  
Change "Blog | Morechard Blog" → "Morechard Blog – Pocket Money, Chores & Financial Literacy for Families"

### 20. Add IndexNow implementation
**Impact:** MEDIUM (Bing/Copilot indexing) | **Effort:** 2 hr  
Generate key at bing.com/indexnow, place key file at root, add IndexNow POST to deployment pipeline.

---

## LOW — Nice to have / Post-launch

### 21. Add hero img width/height attributes
Fix CLS risk. Add `width="1600" height="900"` to hero `<img>` elements.

### 22. Add `display=swap` to Google Fonts URL
Reduces FCP impact of render-blocking font load.

### 23. Convert for-schools hero from PNG to WebP
Resolves LCP regression on the schools page.

### 24. Add explicit AI crawler Allow directives to robots.txt
Add named `Allow` for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot.

---

## STRATEGIC CONTENT GAPS (Medium-term, highest long-term impact)

### A. "How much pocket money should I give my child UK 2026?" guide
The Pocket Money Index (already approved per MEMORY.md) is the correct destination for this query. It is currently the highest-traffic unanswered query in the target set. Building it before launch would be the single highest-ROI SEO investment.

### B. "Best pocket money app UK" comparison page
A fair, Morechard-authored comparison anchored on differentiators (no debit card, MaPS-aligned, one-time payment, SHA-256 ledger). Positions Morechard in comparison queries where it currently does not appear.

### C. Financial literacy curriculum reference page
Take the 6-pillar 25-module taxonomy and publish it as an educational reference (not a product page). This becomes the most-cited asset on the domain for curriculum queries.

### D. Children's data / GDPR transparency page
A page explaining Morechard's data practices for families — COPPA/GDPR-K compliance, nickname-only child data, no AI training on child data, SHA-256 audit trail. Unique in the competitor set and AI-citable.

---

## Scoring Impact Estimate

| Action | Score gain |
|---|---|
| Items 1–5 (Critical) | +6 pts |
| Items 6–13 (High) | +10 pts |
| Items 14–20 (Medium) | +6 pts |
| Strategic content A–D | +10 pts over 3 months |
| **Total potential** | **~32 pts → 88/100** |
