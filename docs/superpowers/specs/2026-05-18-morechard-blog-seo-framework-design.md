# Morechard Blog — SEO/AEO Content Framework

**Date:** 2026-05-18
**Status:** Approved design (pre-implementation)
**Owner:** Darren Savery (solo dev / founder)

---

## 1. Goal

Drive maximum organic traffic and AI-answer visibility to the Morechard blog,
serving two audiences (parents; family-law & mediation professionals) across
three topic categories:

1. Child chores / pocket money / allowance
2. Financial literacy in children
3. Child development (autonomy / responsibility / growth) via chores and money

## 2. Decisions locked

| Decision | Choice | Rationale |
|---|---|---|
| Professional audience | Family-law & mediation (solicitors, mediators, McKenzie friends, co-parenting coaches) | Aligns with the notebooklm "DIY legal forums" acquisition channel and the court-ready ledger differentiator |
| Primary goal | Balanced — top-funnel authority + a deliberate commercial/comparison layer that converts | Niche paid product (£34.99 lifetime); raw volume alone does not pay |
| Geo / language | UK-first now; structured so US ("allowance") and Polish (expat corridor) layer in later without rework | Lower maintenance; avoids splitting early authority |
| Framework | A (hub-and-spoke clusters, whitespace-led) + one B element (flagship data/opinion piece). Programmatic (C) explicitly rejected | Compounding authority, defensible wedge, fits solo-dev minimal-maintenance and trust-led brand |
| Scale | Lean evergreen foundation: ~4 pillars + ~12–16 spokes (~16–20 URLs) over ~90 days, then 1–2 seasonal/newsjack posts/month | Compounds without becoming a content treadmill; matches the £50k/yr minimal-maintenance model |
| Platform | Self-host on existing Cloudflare Pages + `build.js` static pipeline, extended with a Markdown content model | Best for SEO/AEO (edge speed, full markup/schema control, same-domain authority), £0 cost, no CMS/DB to maintain |

## 3. Competitive landscape (why incumbents rank, and the gap)

**Category leaders & their moats**

- **GoHenry money hub** — owns commercial-adjacent informational queries via domain authority, age-banded evergreen pages, and product-search demand.
- **RoosterMoney (NatWest) "Pocket Money Index"** — annual proprietary data report; earns press links and featured snippets yearly. Data-led PR is the moat.
- **MoneyHelper (MaPS), The Money Charity, Which?, NimbleFins, MoneySavingExpert** — institutional E-E-A-T and government trust; disproportionately cited by AI engines for "teaching kids about money". This is the AEO incumbency to beat.
- **Mumsnet, Reddit, BBC Bitesize, Verywell Family** — own long-tail debate queries and are heavily quoted by ChatGPT/Perplexity.
- **US spillover (Greenlight, BusyKid, Ramsey, Investopedia)** — dominate "allowance" and "financial literacy for kids" with highly structured, definitional, AEO-friendly content.

**Ranking patterns that matter:** topical depth + age-banding; original data; institutional trust signals; question-shaped content; forum long-tail capture.

**The whitespace (Morechard's defensible wedge):** almost nobody connects
children's chores/money with separated-family fairness and financial
transparency between two homes. OurFamilyWizard/AppClose cover parent logistics
but exclude child money/literacy; MoneyHelper/GoHenry ignore the two-homes
reality. The 20-module Literacy Matrix gives genuine expert depth competitors
cannot quickly replicate. Strategy: do not chase head terms owned by
high-DA incumbents; own the intersection and build literacy authority through
demonstrable expertise.

## 4. Information architecture

- **Hub:** `/blog/` (replaces the nav's placeholder `/resources/blog`; nav link redirected).
- **Pillars:** `/blog/<pillar-slug>/` — comprehensive evergreen hub pages.
- **Spokes:** flat `/blog/<post-slug>` — cluster formed by internal links + breadcrumb, not deep URL nesting (simpler static build, no orphan/crawl-depth risk).
- Linking rule: every spoke links up to its pillar + 2–3 sibling spokes; every pillar links down to all its spokes; pillars cross-link at topic bridges (chores → responsibility → literacy).

## 5. Cluster map

Target queries below are intent/structure only; live volume and difficulty are
validated with the `seo-dataforseo` skill at implementation. No volume numbers
are asserted in this spec.

### P1 · Pocket money & allowance (UK)
- "How much pocket money for a 7/10/13-year-old in the UK?" (single age-table page — **not** programmatic per-age pages)
- "Should pocket money be linked to chores?" (AEO debate)
- "Pocket money vs allowance: what's the difference?" (definitional, AEO, captures US-term spillover)
- "When should you start giving pocket money?"
- *Commercial:* "Pocket-money apps without a debit card — and when a card is the wrong tool"

### P2 · Chores & responsibility by age
- "Age-appropriate chores: a UK guide + printable chart" (printable = link magnet)
- "Should you pay children for chores? An honest answer" (AEO debate)
- "Getting kids to do chores without nagging" (parent pain point)
- "Responsibility, not bribery: chores that build character" (bridges to P3)
- *Commercial:* "Chore charts vs chore apps: what actually sticks"

### P3 · Financial literacy for children
*E-E-A-T strength — grounded in the Literacy Matrix / 20-module curriculum.*
- "Teaching children about money, stage by stage (ages 5–16)"
- "How to teach kids to save (that actually works)"
- "Needs vs wants: teaching children to think before they spend" (Module 4)
- "Delayed gratification & money: the patience that builds wealth" (Module 7, proprietary framing)
- "Talking to kids about money when money is tight"

### P4 · Money across two homes ★ the moat
*Serves both separated parents and family-law/mediation professionals.*

Parent-facing:
- "Pocket money in two homes: keeping it fair and consistent"
- "Different rules at each home: handling money double standards"
- "Tracking shared child expenses without arguments"

Professional-facing (formal voice; backlink targets for legal forums / Resolution-type sites):
- "Keeping child-expense records that hold up"
- "What family mediators recommend for child-money disputes" (expert-collaboration content)
- *Commercial:* "A co-parenting money tracker with no shared bank account"

### Flagship (the B element)
**"The Morechard Family Chores & Money Report"** — small original UK survey
(200–500 respondents via low-cost panel); if no survey budget for v1, ship as
an expert-led landscape synthesis grounded in the Literacy Matrix. Stable URL,
downloadable, stat-blocks formatted for AI citation. Refreshed annually. This
is the deliberate counter-move to RoosterMoney's index and the strongest
backlink/AEO lever.

## 6. Content model & build pipeline

- Posts authored as **Markdown + YAML front-matter** in `marketing/blog/*.md`
  (fields: `title`, `slug`, `pillar`, `description`, `author`, `datePublished`,
  `dateModified`, `targetQuery`, `schemaType`, `faq[]`).
- `build.js` extended with a `blog` step: render each `.md` → templated HTML
  using existing `_partials` (nav/head/footer) plus new
  `_components/blog-post.html` and `_components/blog-pillar.html` shells.
- Auto-generated from front-matter: breadcrumb, pillar↔spoke internal links,
  `/blog/` index, JSON-LD, and **sitemap entries with real `lastmod`**
  (current sitemap has none — a quick crawl/AEO win).
- One dependency: a Markdown library (e.g. `markdown-it`). No CMS, no DB —
  consistent with the Cloudflare-native, D1-only constraint (this is static
  marketing content, not app data).

## 7. On-page SEO + AEO template (every post)

- One `<h1>` = primary query intent; semantic `<h2>/<h3>` shaped as the
  questions people actually ask.
- **Answer-first block:** a 40–60-word direct answer within the first 100
  words (lifted verbatim by AI Overviews / Perplexity).
- **Key-takeaways list** + at least one **table or definition list**
  (citation-friendly formats).
- **FAQ section** from front-matter → `FAQPage` JSON-LD.
- JSON-LD per type: `Article`/`BlogPosting`, `BreadcrumbList`, `FAQPage`,
  `Organization`/author; pillars also `WebPage`.
- Internal links with descriptive anchors (no "click here").
- Meta title/description templated from front-matter; OG image per pillar.

## 8. E-E-A-T & author strategy

- Named, real **author identity** with credible bio + `/blog/author/...` page
  (founder / financial-literacy practitioner framing) — AI engines weight
  identifiable expertise heavily.
- P4 professional posts cite/quote a **named family mediator or solicitor**
  where possible — borrowed authority + natural backlink outreach.
- Sourcing rule: every statistic links to a primary source (MoneyHelper, ONS,
  charities). No unverifiable claims; no fabricated user counts.
- Voice per brand book ("Mediator & Mentor"): parent posts collaborative;
  professional posts firm, precise, neutral. En dashes, not em dashes.

## 9. Measurement & governance

- Google Search Console + privacy-light analytics; track per-cluster
  impressions/clicks and AI-referral traffic.
- **Quarterly refresh ritual:** update the 4 pillars + flagship, refresh
  `lastmod`, prune/merge any spoke not gaining traction after 6 months.
- Cadence: ~4 pillars + ~12–16 spokes over ~90 days, then 1–2
  seasonal/newsjack posts/month (Christmas pocket money, back-to-school,
  new-year habits, reactive RoosterMoney-index response).

## 10. Out of scope (explicit)

- Programmatic/templated long-tail pages (framework C) — rejected: thin-content
  and index-bloat risk; undermines trust-led E-E-A-T positioning and the
  solo-dev maintenance constraint.
- US ("allowance") and Polish-language tracks — deferred; IA designed so they
  layer in later without rework.
- Headless CMS / WordPress / Medium / Substack — rejected (maintenance burden,
  speed, or authority leakage).
- Paid survey for the flagship — optional for v1 (expert-synthesis fallback).
- Pricing/feature page changes — not part of this framework.

## 11. Success criteria

- Blog live at `morechard.com/blog/` on the existing static pipeline.
- 4 pillars + ≥12 spokes + flagship published within ~90 days.
- Every page passes the on-page/AEO template checklist (§7) and validates
  in Google Rich Results Test for declared schema types.
- Sitemap auto-includes blog URLs with accurate `lastmod`; GSC coverage clean.
- At least the P4 cluster ranking/being cited for two-homes money queries
  within 2 quarters (the defensible wedge is the primary KPI).