# Audience Pages & Shared Nav — Design

**Date:** 2026-05-13
**Status:** Draft — awaiting user approval

---

## Goal

Add three standalone marketing pages — each targeting a distinct audience — plus a forward-looking shared main nav. The pages serve a dual purpose: rank in search (SEO) and AI Overviews / ChatGPT citations (AEO), and convert qualified visitors to the existing "Register interest" waitlist.

Audiences:

1. **Single households / nuclear families** — direct-to-consumer
2. **Separated / co-parenting families** — direct-to-consumer
3. **Family lawyers & mediators** — B2B referral partners (not direct-consumer; nav-only)

Visual differentiation across the three pages comes from one signature component per page (same palette, distinctive layout). Copy translates Morechard features into tangible benefits for each audience, framed through four decision-making lenses (logical, competitive, spontaneous, humanistic) to cover all user types.

---

## Constraints

- Static HTML only — no framework, no runtime templating
- Uses the existing `marketing/build.js` boilerplate (per `2026-05-11-marketing-boilerplate-component-library-design.md`)
- All audience-page body sections are **inline in each `src/*.html` file** — copy is edited directly in the page file, not through component includes. Reference copies of each new block are saved to `_components/` as a documented pattern library for future pages.
- Shared infrastructure (nav, footer, head, register-interest form) stays as partials / `{{component:...}}` includes — these update everywhere from one place
- Brand-book compliant: Grove Teal `#00959c`, Harvest Gold `#e6b222`, Deep Canopy `#1b2d2e`, Parchment `#f9f7f2`, 12px radii, Inter + JetBrains Mono
- Same `Register interest` CTA as the homepage on all three pages
- Cloudflare Pages SPA-safe: pages are real `dist/*.html` files, no client-side routing
- No new runtime dependencies

---

## File Structure

```
marketing/
  build.js                                ← extended for HERO_IMAGE / HERO_IMAGE_MOBILE
  _partials/
    _nav.html                             ← replaced (multi-tier nav, hidden future items)
  _components/
    audience-hero.html                    ← NEW reference snippet
    audience-benefits-grid.html           ← NEW reference snippet
    signature-day-in-the-life.html        ← NEW reference snippet
    signature-split-screen-ledger.html    ← NEW reference snippet
    signature-forensic-spec.html          ← NEW reference snippet
    audience-faq.html                     ← NEW reference snippet
    who-its-for.html                      ← updated: links to new pages
  src/
    for-single-households.html            ← NEW page
    for-separated-families.html           ← NEW page
    for-professionals.html                ← NEW page
  css/
    base.css                              ← extended: nav dropdowns + mobile drawer
    page-audience.css                     ← NEW: audience-page layout + signature modules
  sitemap.xml                             ← updated: three new URLs
```

---

## Shared Nav — `_partials/_nav.html`

Built once. Picked up by every existing and new page on next build.

### Desktop (≥920px)

```
[Morechard logo]  Features ▾  Who it's for ▾  Resources ▾  Pricing  For Professionals  [Register interest →]
```

### Mobile (<920px)

Logo + hamburger button. Hamburger opens a full-height drawer with the same groups stacked vertically (accordion-style — tap "Who it's for" to expand the sub-items). CTA pinned at the bottom of the drawer.

### Group taxonomy (full markup written today, unbuilt items hidden)

| Group | Items live today | Items hidden (`hidden` attribute) until built |
|---|---|---|
| **Features ▾** | *(none — group hidden today)* | Chore Tracker · Learning Lab · AI Mentor · Cryptographic Reports |
| **Who it's for ▾** | One home (`/for-single-households`) · Separated families (`/for-separated-families`) | — |
| **Resources ▾** | *(none — group hidden today)* | Knowledge base · Blog · Press |
| **Pricing** | *(hidden today)* | — |
| **For Professionals** | `/for-professionals` (live) | — |

Hidden items use the HTML `hidden` attribute on the `<li>`. Activating a future page is a one-line edit: remove `hidden`. The full markup is already there, fully styled, so future activation does not require nav redesign.

### Behaviour

- Dropdowns open on hover (desktop) and on click / Enter / Space (keyboard). `aria-expanded` toggled accordingly.
- Current page's nav item gets `aria-current="page"` and a Grove Teal underline.
- Mobile drawer:
  - Toggled with `.is-open` class on `<nav>`
  - Traps focus inside the drawer when open
  - Closes on Escape, on outside tap, and on any link click
  - Background body gets `overflow: hidden` while open
- Pure CSS + ~25 lines of inline JS at the bottom of `_nav.html`. No framework.

### Styling

- Extends existing `#nav` styles in `base.css`
- Dropdown panels: soft-shadow Parchment cards, 12px radius, 1px Grove Teal hairline border
- Items: `arcadia`-equivalent (Inter) 14px, weight 500, 0.07px letter-spacing
- Hover: Grove Teal underline 1px, animated 200ms
- Active page: persistent Grove Teal underline, weight 600

---

## Build script extension — `HERO_IMAGE` metadata tokens

Today `buildHomepageHeadExtras` (build.js line 121–122) hardcodes preload tags for the homepage hero only. To give audience pages the same LCP benefit, extend the metadata header parser to honour two new tokens:

```html
<!--
  TITLE: ...
  DESCRIPTION: ...
  PAGE_CSS: page-audience.css
  HERO_IMAGE: /Images/single-household_16_9.png
  HERO_IMAGE_MOBILE: /Images/single-household_3_4.png
-->
```

When either is present, the build script emits into `<head>`:

```html
<link rel="preload" as="image" href="<HERO_IMAGE_MOBILE>" media="(max-width: 720px)" />
<link rel="preload" as="image" href="<HERO_IMAGE>" media="(min-width: 721px)" />
```

The visible `<picture>` / `<img>` markup remains **inline in each page's body** — only the head preload tags are emitted by the build script. Mirrors how `PAGE_CSS` already works. Hard-error if `HERO_IMAGE` is set but the referenced file does not exist on disk.

`type` attribute omitted from preload tags (works for both `.png` and `.webp` — if the page references a `.webp`, the build script appends `type="image/webp"`).

---

## Page 1 — `for-single-households.html`

### Audience

Nuclear / single-parent / one-home families. Direct-to-consumer.

### SEO / AEO

| Field | Value |
|---|---|
| Title | Chore & Pocket Money App for Families \| Morechard |
| Description | The chore tracker that turns daily responsibilities into real financial literacy. No debit card. No subscription. Built for any family, from day one. |
| Canonical | `https://morechard.com/for-single-households` |
| H1 | The chore tracker that turns daily life into a lifetime of financial confidence. |
| Primary queries | "chore app for kids", "pocket money app for families", "best chore tracker for kids" |
| AEO query patterns | "what's the best chore app that doesn't need a debit card?", "how do I teach my child financial literacy at home?", "what age can a child start using a chore app?" |
| OG type | `article` |
| OG image | Reuses homepage `og-image.jpg` (future: per-page OG) |
| FAQ schema | Yes — emitted via existing `SCHEMA_START`/`SCHEMA_END` block |

### Hero images

- 16/9: `single-household_16_9.png`
- 3/4 mobile: `single-household_3_4.png`

### Page composition (top to bottom — all sections inline in `src/for-single-households.html`)

1. **Hero** — full-bleed image (`<picture>` block with mobile/desktop swap), Coming Soon badge, H1, sub, primary CTA `Register my interest` (anchors to `#signup` on this page), scroll cue.
2. **Editorial intro** — two short paragraphs framing the "did you do your chores?" chaos. Humanistic anchor.
3. **Benefits grid — 6 cards** (3×2 desktop, 1-column mobile). See table below.
4. **Signature module: "A day with Morechard"** — 4 timeline cards across desktop, vertical stack with left-side time rail on mobile. See spec below.
5. **"How it works in 3 steps"** — Plant → Tend → Harvest (brand-book Orchard lexicon). Three numbered steps with thin SVG illustrations.
6. **Image placeholder block** — wide 16/9 lifestyle photo placeholder. Alt text spec included as HTML comment for image generation.
7. **Why Morechard** — differentiator strip: No debit card · No subscription · Real-data literacy · Bank-grade integrity. Four small cards.
8. **FAQ** — 6 questions in CSS-only `<details>` accordions. Mirrored in JSON-LD FAQ schema. See questions below.
9. **Register interest** — `{{component:register-interest}}` (shared component).

### Benefits grid — 6 cards (single household)

| # | Lens | Feature | Benefit headline | Body copy |
|---|---|---|---|---|
| 1 | Logical | Immutable ledger | Never argue about chores again. | Every approved job is timestamped and locked. No more "but I did it yesterday" or "I never agreed to that rate." |
| 2 | Competitive | Streaks & velocity | Build the habits that compound for life. | Children see their streak grow with every approved task — the same dopamine loop that builds lifelong financial discipline. |
| 3 | Spontaneous | Goal planning (Savings Grove) | Turn "I want it now" into "I earned it." | The Savings Grove transforms impulse wants into achievable goals — your child plans the route from chore to checkout. |
| 4 | Humanistic | AI Mentor briefings | A weekly financial literacy lesson, written for your child. | Every Sunday, the Orchard Lead reviews your child's week and surfaces one teachable moment — grounded in their real earnings, not generic content. |
| 5 | Logical | No debit card | Pocket money that works without a bank account. | Skip the card fees, the upsells, and the parental anxiety. Morechard works for any child, of any age, from day one. |
| 6 | Humanistic | Choice Architect parent role | You stay in charge — the app does the policing. | Set the rules, set the rates, approve the work. Morechard removes the nagging and gives you back the relationship. |

### Signature module spec — "A day with Morechard"

Four cards displayed horizontally on desktop, vertical stack with time rail on mobile.

| Card | Time | Parent moment | Child moment |
|---|---|---|---|
| 1 | 7:30am | Set today's chores in 20 seconds | Sees the list — and the rate |
| 2 | After school | (waits) | Marks bed + rubbish done — gets live confirmation |
| 3 | 6pm | Approves from phone | Watches balance tick up |
| 4 | Sunday | Reads the AI Mentor's briefing | Plans next week's goal together |

Footer caption: *"No nagging. No spreadsheets. No 'did you?' conversations."*

Visual: Parchment-tinted surface, 12px radius, 🌱 icon precedes Parent line, 🍎 icon precedes Child line. Time label small caps, weight 600, 12px. Body copy 14px, weight 400.

### FAQ — Page 1 (6 questions)

1. What age is Morechard for?
2. Do we need a bank account or debit card?
3. How does pocket money actually get paid?
4. What happens if my child loses interest after a week?
5. How is this different from a sticker chart or a spreadsheet?
6. Is my child's data safe?

Each answer is 2–3 sentences. Schema mirrors visible accordion answers.

---

## Page 2 — `for-separated-families.html`

### Audience

Separated, divorced, blended, or co-parenting households. Direct-to-consumer.

### SEO / AEO

| Field | Value |
|---|---|
| Title | Chore & Pocket Money App for Separated & Co-Parenting Families \| Morechard |
| Description | Two households. One source of truth. A tamper-proof shared record of every chore, every payment, every milestone — with court-ready PDF exports when families need them. |
| Canonical | `https://morechard.com/for-separated-families` |
| H1 | One source of truth for two households. |
| Primary queries | "chore app for separated parents", "co-parenting pocket money tracker", "shared chore app for two homes" |
| AEO query patterns | "how do co-parents share chores between two houses?", "can you get a court-ready record of child finances?", "is there a chore app for divorced parents?" |
| OG type | `article` |
| FAQ schema | Yes |

### Hero images

- 16/9: `split-household_16_9.png`
- 3/4 mobile: `split-household_3_4.png`

### Page composition (top to bottom — all inline)

1. **Hero** — full-bleed image, slightly more sober tone copy than Page 1, primary CTA.
2. **Editorial intro: "The Truth Engine"** — two paragraphs anchoring on consistency as the hardest part of co-parenting.
3. **Benefits grid — 6 cards.** See table below.
4. **Signature module: "The Split-Screen Ledger"** — three-column layout (Parent A · Shared Ledger · Parent B). See spec below.
5. **"How separated families use Morechard"** — three case cards: *Weekend swap · Birthday boost from a distance · The court-ready audit.*
6. **Image placeholder block** — 16/9 lifestyle: parent reviewing PDF audit on tablet. Alt text spec included.
7. **Shield AI callout** — standalone teal-bordered card. Promotes the £149.99 Legal Integrity bundle. Price pulled from `pricing.json` via `{{data:pricing.shield_ai.price_whole}}.{{data:pricing.shield_ai.price_dec}}`.
8. **Why Morechard** (separated-focused) — differentiator strip: SHA-256 hash chain · Court-admissible exports · Both parents owned · Tamper-proof timeline.
9. **FAQ** — 6 questions in `<details>` accordions + FAQ schema.
10. **Register interest** — shared component.

### Benefits grid — 6 cards (separated families)

| # | Lens | Feature | Benefit headline | Body copy |
|---|---|---|---|---|
| 1 | Logical | SHA-256 hash chain | Every entry locked, forever. | Every chore, every payment, every approval is cryptographically sealed the moment it's recorded. No edits. No deletions. No disputes. |
| 2 | Competitive | Court-ready PDF export | A solicitor would charge hundreds for what this exports in one click. | One-tap audit log of every contribution, payment, and milestone — formatted for legal review and stamped with a verification seal. |
| 3 | Humanistic | Household-neutral language | Built to keep the focus on your child, not on the conflict. | Morechard uses business-neutral phrasing throughout — no "primary parent," no scoring, no rankings. Both households see the same view. |
| 4 | Logical | Shared expense pool | Split costs without splitting hairs. | Birthdays, school trips, new shoes — log shared expenses, agree the split, and let the ledger keep a clean record of who paid what. |
| 5 | Spontaneous | Parental Boost | Reward great effort even from the other house. | See your child smashed it this week? Send a boost to their balance from your phone — visible to the other parent, recorded forever. |
| 6 | Humanistic | The child sees one home | To your child, it's just their pocket money app. | Children get a single, calm, consistent view across both houses. The integrity layer runs underneath — they never see the friction. |

### Signature module spec — "The Split-Screen Ledger"

Three columns on desktop (Parent A · Shared Ledger · Parent B). On mobile, stack vertically with the central ledger card visually prominent.

**Parent A column (left):** Parchment background, Grove Teal left-border, 12px radius. Header label "Parent A". Three example entries (chore name, day, ✓ approved). Footer total "Total contributed £6.50".

**Shared Ledger column (centre):** Deep Canopy `#1b2d2e` background, Parchment text, **Harvest Gold for hash fingerprints**. JetBrains Mono typeface. Five monospace entries showing `#xxxx · £x.xx ✓`. Footer total "Total this month £16.00".

**Parent B column (right):** Parchment background, Harvest Gold left-border, 12px radius. Header label "Parent B". Three example entries. Footer total "Total contributed £9.50".

**Connecting arrows:** Subtle `─→` glyphs between Parent columns and the central ledger.

**Caption beneath:** *"Each ledger entry carries a unique cryptographic fingerprint (#xxxx) — proving when it happened, who recorded it, and that it has never been altered. Either parent can export the full chain at any time."*

### FAQ — Page 2 (6 questions)

1. Does Morechard work if we don't speak much?
2. Can both parents see and approve chores?
3. Is the audit log actually accepted by courts?
4. What happens if one parent withdraws from the app?
5. Can step-parents or grandparents be added?
6. Who owns the data?

---

## Page 3 — `for-professionals.html`

### Audience

Family lawyers and mediators. **B2B referral partner page** — not direct-to-consumer. The page lives in the nav only; it is **not** linked from the homepage `who-its-for` section.

### Tone

More editorial and reserved than Pages 1–2. Closer to Mercury's "darkNeutral" feel in restraint, though we keep the Morechard palette. Less Orchard lexicon (no 🌱 / 🍎 here), more "Truth Engine / Immutable Ledger / cryptographic seal." No emojis. Reader is a professional and the copy treats them as one.

### SEO / AEO

| Field | Value |
|---|---|
| Title | For Family Lawyers & Mediators \| Morechard |
| Description | A neutral, tamper-proof record of pocket money, chores, and shared child expenses across two households — built for the clients you advise. |
| Canonical | `https://morechard.com/for-professionals` |
| H1 | A neutral source of truth for the families you advise. |
| Primary queries | "chore tracker for family law clients", "co-parenting app recommended by mediators", "financial record-keeping for separated parents UK" |
| AEO query patterns | "what apps do family mediators recommend for co-parenting expenses?", "is there a court-admissible record of child financial contributions?", "how do separated parents share an audit trail of pocket money?" |
| OG type | `article` |
| FAQ schema | Yes |

### Hero images

- 16/9: `professional_16_9.png`
- 3/4 mobile: `professional_3_4.png`

### Page composition (top to bottom — all inline)

1. **Hero** — full-bleed image, headline + sub, primary CTA. Above the CTA, a contextual line: *"We're building a partner network. Add your name and we'll be in touch ahead of launch."*
2. **Opening positioning paragraph** — short editorial framing the practitioner-level problem.
3. **"What Morechard is (and isn't)"** — two-column compact spec table. Disarms misconceptions immediately. See content below.
4. **Benefits grid — 6 cards.** Practitioner-grade language. See table below.
5. **Signature module: "The Forensic Spec"** — monospace technical datasheet block. See spec below.
6. **Image placeholder block** — 16/9 lifestyle: solicitor reviewing verification page on laptop. Alt text spec included.
7. **Sample audit export** — mock PDF preview card showing first page of court-ready export with hash fingerprint, signature line, verification URL.
8. **"How to recommend Morechard"** — three short panels: *Mention it · Share it · Vouch for it.* The lightest possible partner ladder. No contracts, no commission.
9. **FAQ** — 7 questions in `<details>` accordions + FAQ schema.
10. **Register interest** — shared component, with the partner-network contextual line above it.

### "What Morechard is (and isn't)" content

| Morechard is... | Morechard is not... |
|---|---|
| A tamper-proof shared ledger | A debit card or banking product |
| A neutral record of effort and reward | A children's bank account |
| A one-click PDF audit export | A parental control or surveillance app |
| A tool that respects both households equally | A substitute for legal or financial advice |

### Benefits grid — 6 cards (professionals)

| # | Lens | Feature | Benefit headline | Body copy |
|---|---|---|---|---|
| 1 | Logical | SHA-256 hash chain | Evidentiary integrity, not stored — proved. | Every ledger entry is cryptographically chained to the previous one. A single altered byte breaks the whole chain. The proof is in the maths, not in our word. |
| 2 | Logical | One-click PDF audit export | A complete record, in the form you already use. | PDF/A export with embedded hash, signature line, and a public verification URL. Drop it straight into a bundle. |
| 3 | Humanistic | Household-neutral framing | A tool that doesn't take sides. | No "primary" parent. No scoring. No rankings. Both parties see the same data through the same lens — which is often what mediation needs first. |
| 4 | Competitive | Cost-of-conflict reduction | Resolves the small disputes before they become your problem. | Most "who paid what" arguments never reach your desk because they no longer have anywhere to go. The ledger is the answer. |
| 5 | Logical | Client-owned data | Your client's evidence belongs to your client. | Morechard does not sell, monetise, or use the underlying data. The family's audit chain is theirs — exportable, portable, and verifiable independently. |
| 6 | Spontaneous | Zero onboarding friction | Recommend it on a Tuesday. They're using it by Wednesday. | No bank account, no debit card, no credit check. A family can be on the ledger in under five minutes. |

### Signature module spec — "The Forensic Spec"

A bordered, monospace-typography spec block. Looks like a technical datasheet rather than a marketing block.

| Field label | Value |
|---|---|
| Ledger model | Append-only, cryptographically chained |
| Hash function | SHA-256 (FIPS 180-4) |
| Chain integrity | Each entry hashes prior entry + payload |
| Mutability | None. No edit. No delete. No backdate. |
| Export format | PDF/A-2b with embedded XMP metadata |
| Export signing | Final-page seal: chain head hash + timestamp |
| Public verification | `https://morechard.com/verify/<hash>` |
| Data jurisdiction | Cloudflare D1 · UK / EU regions |
| Standards alignment | UK GDPR · COPPA · GDPR-K · NSFE (PL) |
| Retention | Family-controlled · ledger persists post-account |
| Data ownership | The family. Always. |
| Languages | English (UK) · English (US) · Polish |
| Currencies | GBP · USD · PLN |

Footer disclaimer (italic, subdued grey, smaller size): *"This block is not legal advice. Morechard is a record-keeping tool."*

Visual: Deep Canopy `#1b2d2e` background, Parchment `#f9f7f2` body text, Harvest Gold `#e6b222` for the field labels and hash values. 12px corner radius. JetBrains Mono for spec values, Inter for label column.

### "How to recommend Morechard" panels

| Panel | Headline | Body |
|---|---|---|
| Mention it | A name to drop in a difficult meeting. | When clients ask "how do we keep track between two homes?", you have a one-line answer. |
| Share it | A page you can send. | Forward this URL or share the partner pack we'll send to everyone on the waitlist. |
| Vouch for it | Lend your name if you like the tool. | Optional. Practitioners who'd be happy to be named as a referrer can opt in after they've used it. No commission, no obligation. |

### FAQ — Page 3 (7 questions)

1. Is the export admissible as evidence?
2. What jurisdiction does Morechard's data sit in?
3. How is the ledger's tamper-evidence demonstrated?
4. Do both parents need accounts for the record to be useful?
5. Is there a referral or commission scheme?
6. Can a mediator be added as a neutral observer?
7. What if a client asks Morechard to delete their records?

---

## Image placeholders (new assets requested)

Each placeholder is rendered as a `<picture>` block with a `data-placeholder` attribute. If the file does not exist on disk at build time, the build script substitutes a temporary inline SVG grey block (so the page never breaks). Each placeholder includes an HTML comment with the alt text spec for image generation.

| Page | Position | Target filename | Alt text spec |
|---|---|---|---|
| 1 | Mid-page (after step-by-step) | `/marketing/src/Images/single-household-kitchen_16_9.png` (+ `_3_4.png` mobile) | A parent and child in a sunlit kitchen, the child holding a phone showing the Morechard app, the parent approving a chore — warm, candid, naturalistic. |
| 2 | Mid-page (after case cards) | `/marketing/src/Images/separated-tablet-audit_16_9.png` (+ `_3_4.png`) | A parent at a dining table reviewing a Morechard audit PDF on a tablet, calm and considered, soft daylight. |
| 3 | Mid-page (after Forensic Spec) | `/marketing/src/Images/professional-laptop_16_9.png` (+ `_3_4.png`) | A family solicitor at a tidy desk reviewing a Morechard verification page on a laptop — neutral office tones, no faces required. |
| 3 | Sample-export section | `/marketing/src/Images/sample-audit-pdf_preview.png` | A mock first-page preview of a Morechard court-ready PDF audit export, showing transaction lines, hash fingerprint, and verification URL. |

---

## CSS — `page-audience.css`

New file. Loaded only on the three audience pages via `PAGE_CSS: page-audience.css` metadata token. Carries:

| Block | Purpose |
|---|---|
| `.audience-page` wrapper | Section spacing scale (slightly more editorial than home — 88px between major sections on desktop, 56px on mobile) |
| `.audience-hero` | Full-bleed picture + scrim + centred content block |
| `.audience-intro` | Two-paragraph editorial intro with constrained max-width (640px), 18px body, line-height 1.6 |
| `.audience-benefits` | 3×2 grid (1 column <760px), 32px gap, 12px radius cards with thin teal hairline on hover |
| `.audience-spec-cols` | Two-column "is / isn't" spec table for Page 3 |
| `.signature-day` | Page 1's 4-card timeline, vertical stack on mobile with left-side time rail |
| `.signature-ledger` | Page 2's three-column split-screen ledger |
| `.signature-forensic` | Page 3's monospace datasheet block (Deep Canopy bg, Harvest Gold labels, JetBrains Mono values) |
| `.audience-faq` | CSS-only `<details>` accordion styling |
| `.audience-sample-pdf` | Page 3's PDF preview card with subtle paper shadow |
| `.audience-callout` | Page 2's Shield AI teal-bordered callout |

The file stays focused and small (~400–500 lines). The homepage and inner-page CSS are unaffected.

---

## Homepage updates

### `_components/who-its-for.html`

The existing homepage `who-its-for` component already has two audience cards but no destination links. Update them:

- Card 1 ("Any family, from day one") — wrap card content in a link to `/for-single-households` and add a small "Read more →" chevron at the bottom.
- Card 2 ("Two Households. One Source of Truth.") — wrap card content in a link to `/for-separated-families` and add the same chevron.

Professionals is **not** added to this homepage section — it lives in the nav only, per the audience definition.

### `sitemap.xml`

Add three new entries:
- `https://morechard.com/for-single-households`
- `https://morechard.com/for-separated-families`
- `https://morechard.com/for-professionals`

`<lastmod>` set to the build date, `<changefreq>monthly</changefreq>`, `<priority>0.8</priority>`.

---

## Build script changes (summary)

Two small additions to `marketing/build.js`:

1. **`HERO_IMAGE` / `HERO_IMAGE_MOBILE` metadata token parsing** — extends the existing metadata header parser (already handles `TITLE`, `DESCRIPTION`, `PAGE_CSS`). When present, emits two `<link rel="preload">` tags into `<head>` with appropriate `media` queries and `type` attribute (`image/webp` if the path ends in `.webp`). Hard-error if the file does not exist on disk.

2. **Placeholder image fallback** — when the build script encounters an `<img>` whose `src` does not resolve to a file on disk, it substitutes a tiny inline SVG grey block (1600×900 or 4×3 depending on the picture source) instead of breaking the build. Logged to console as `[build] ! placeholder: <path>` so missing assets are visible.

No other build script changes.

---

## Reference snippet library (`_components/`)

Per user clarification: audience-page bodies are **inline**. The `_components/` folder gets **reference copies** of each new block as a documented pattern library — useful when authoring future pages.

| File | Source for |
|---|---|
| `audience-hero.html` | The hero block shape used by all three pages (page-specific copy stripped to placeholders) |
| `audience-benefits-grid.html` | The 6-card benefits grid |
| `signature-day-in-the-life.html` | Page 1's timeline module |
| `signature-split-screen-ledger.html` | Page 2's three-column ledger |
| `signature-forensic-spec.html` | Page 3's monospace datasheet |
| `audience-faq.html` | The FAQ accordion block + FAQ schema template |

Each file has a header comment listing the page it was first used on, the CSS file it depends on, and any data-driven tokens it expects. These files are **not** referenced via `{{component:...}}` tokens by the three new pages — they exist as documentation only.

---

## Decision-making lens coverage (cross-cutting)

Each audience page's benefits grid is engineered to cover all four lenses, ensuring the page resonates with every visitor profile:

| Lens | Definition | Single household card | Separated families card | Professionals card |
|---|---|---|---|---|
| Logical | Evidence-driven, wants proof | Immutable ledger, No debit card | SHA-256 hash chain, Shared expense pool | Hash chain, PDF export, Client-owned data |
| Competitive | Comparative, wants the edge | Streaks & velocity | Court-ready export (cost vs solicitor) | Cost-of-conflict reduction |
| Spontaneous | Acts on impulse, wants the gesture | Goal planning | Parental Boost | Zero onboarding friction |
| Humanistic | Relational, wants connection | AI Mentor, Choice Architect role | Household-neutral language, Child sees one home | Household-neutral framing |

---

## Success Criteria

- `node marketing/build.js` produces three new pages in `dist/`: `for-single-households.html`, `for-separated-families.html`, `for-professionals.html`
- Each new page has the new shared nav at the top, the existing footer at the bottom, and the existing `register-interest` form before the footer
- The homepage and existing privacy/terms pages render identically except for the new shared nav
- Each new page hero LCP is preloaded via `HERO_IMAGE` metadata tokens
- Each new page emits FAQ schema JSON-LD
- Each new page is unique enough to feel like a different page (one signature component) while clearly belonging to the same site (shared palette + nav + footer + body type scale)
- Lighthouse mobile score ≥90 on all three pages (assuming hero images are reasonably compressed)
- All copy is brand-book compliant (Grove Teal palette, Inter + JetBrains Mono, no `bailout` / `custodian` / `governance` / `maker` language)
- The Professionals page is not linked from the homepage "Who it's for" cards — only from the nav

---

## Open Questions (none — all resolved during brainstorm)

All design questions resolved with the user:

- Page purpose: SEO + conversion (both)
- Professionals = family lawyers & mediators (B2B referral, nav-only)
- Nav: full taxonomy in markup, hidden until built
- Differentiation: signature components per page, same palette
- CTA: same Register interest as homepage
- Page bodies: inline (not component includes); reference copies in `_components/`
- Hero preload: build.js extension via `HERO_IMAGE` metadata tokens
- Homepage "Who it's for" cards: link to Pages 1 & 2 (not Page 3)