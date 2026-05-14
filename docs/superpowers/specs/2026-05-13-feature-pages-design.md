# Feature Pages — Design Spec

**Date:** 2026-05-13
**Status:** Awaiting user approval before implementation plan
**Branch target:** feat/feature-pages

---

## 1. Overview

Three new marketing pages accessible from a `Features ▾` dropdown in the main nav. Each page showcases one pillar of the Morechard product using a light, clean, Apple/Mercury-style layout — all parchment base, no dark sections mid-page, the software itself as the centrepiece.

### URL structure

| URL | Nav label | Product area |
|---|---|---|
| `/features/earn-save-spend` | Earn / Save / Spend | Chore Tracker + Payment Bridge + Goals |
| `/features/financial-literacy` | Financial Literacy | AI Mentor + Learning Lab + Parent Insights |
| `/features/trust-and-peace-of-mind` | Trust & Peace of Mind | Sovereign Ledger + Co-Parent Shield + Security |

Pricing remains a top-level nav item, not under Features.

---

## 2. Visual Language

### Palette (Morechard only — no Mercury colours)

| Role | Token | Hex | Usage |
|---|---|---|---|
| Page base | `--bg-cream` / Parchment | `#f9f7f2` | All page backgrounds |
| Card surfaces | `--card-light` | `#f0ece0` | Feature cards, mockup shells |
| Primary brand | `--teal` | `#00959c` | CTAs, icons, teal accents |
| Warm accent | `--gold` | `#e6b222` | Badges, highlights, step numbers |
| Dark text | `--text-dark` / Deep Canopy | `#1b2d2e` | All headings and body |
| Subdued text | `--text-sub` | `#5a7475` | Subheads, captions |
| Hero gradient | teal wash | `rgba(0,149,156,0.06)` radial → transparent | Hero background only |
| CTA strip | `--bg-dark` | `#1b2d2e` | Bottom CTA section only |
| Border | `--border-light` | `rgba(27,45,46,0.09)` | Card edges, dividers |

### Typography (existing tokens)

| Role | Font | Weight | Notes |
|---|---|---|---|
| Page headline (h1) | `--font-display` Lora | 600 | 48–56px, editorial |
| Section headline (h2) | `--font-display` Lora | 500 | 36–42px |
| Feature headline (h3) | `--font-body` DM Sans | 600 | 20px |
| Body / editorial | `--font-body` DM Sans | 400 | 17–18px, line-height 1.65 |
| Label / caption | `--font-body` DM Sans | 500 | 13px, letter-spacing 0.06em, uppercase |
| Data / hash | JetBrains Mono | 400 | Trust & Peace of Mind page only |

### Scroll behaviour

Adopt Mercury's per-section fade-in: every section element (not just individual cards) fades up as it enters the viewport. Use the existing `.reveal` / `.visible` system already in `base.css` — no new JS needed. Section wrappers get `.reveal`; child elements stagger with `.d1`–`.d4` delay classes.

### Elevation

Flat throughout — matches existing site and Mercury. No `box-shadow`. Depth via background colour contrast only (parchment card on parchment page = subtle border; teal/gold accents do the heavy lifting).

---

## 3. Shared Page Anatomy

Every feature page follows this exact section order:

```
1. Hero          — gradient wash + headline + CSS app mockup
2. Pitch strip   — 2–3 editorial paragraphs (no bullets)
3. Feature pairs — 2–3 left/right alternating blocks, one per feature cluster
4. Showcase      — full-width animated demo or video placeholder
5. Checklist     — complete feature list, 2-column teal ticks
6. CTA strip     — dark, trial prompt
```

### 3.1 Hero section

**Layout:** Full-width. Max content width 1100px centred. Two rows:
- Row 1: label chip + h1 + subtext + pill CTA — centred, max-width 680px
- Row 2: CSS app mockup — centred, max-width 900px, `margin-top: 56px`, slight drop shadow via a `box-shadow: 0 24px 80px rgba(0,149,156,0.10)` on the mockup frame only (not the page)

**Background:** Parchment (`#f9f7f2`) with a radial gradient overlay:
```css
background:
  radial-gradient(ellipse 80% 60% at 50% -10%,
    rgba(0,149,156,0.07) 0%,
    transparent 70%),
  var(--bg-cream);
```

**Label chip:** Small pill above the h1. Teal border, teal text, parchment fill.
Example: `Earn / Save / Spend`

**CTA:** `Start free trial →` pill button in `--teal`. Links to `/#signup`.

**Mockup frame:** A rounded rectangle (`border-radius: 16px`) in `--card-light` (`#f0ece0`) with a 1px `--border-light` border. Inside: a CSS-rendered representation of the relevant app screen. Animates on load (fade-in + subtle scale from 0.97 → 1.0 over 0.8s). Specific mockup content per page — see §5, §6, §7.

---

### 3.2 Pitch strip

**Layout:** Max-width 640px, centred. No heading — pure editorial body copy. 2–3 paragraphs.
**Style:** `--font-body`, 18px, weight 400, line-height 1.7, `--text-dark`.
**Purpose:** Translate the feature category into the human problem it solves. Conversational, not bullet-pointed.
**Reveal:** Single `.reveal` on the container — whole block fades in together.

---

### 3.3 Feature pairs

2–3 alternating blocks. Each block:

**Layout:** 2-column at desktop (`1fr 1fr` gap 80px), stacked at mobile. Alternates: text left / mockup right, then mockup left / text right.

**Text column:**
- Section label (uppercase, 13px, `--teal`, `--font-body` 500)
- h3 feature headline — benefit-led, max 10 words
- 2–3 sentence body paragraph
- Optional: 2–3 bullet points with teal `›` markers (for scannable sub-features)

**Visual column:**
- CSS-rendered app panel OR Adobe Firefly video placeholder (see §5–7 per page)
- Subtle entrance animation: slides in from the outside edge (left panel slides from left, right panel from right) using `transform: translateX(±24px)` → `0` on `.reveal.visible`

**Reveal:** Each block's text and visual column get `.reveal` with stagger `.d1`/`.d2`.

---

### 3.4 Showcase section

One per page. Full-width, parchment background with a slightly deeper tint (`#f0ece0`). Contains either:
- An auto-playing looping video (Adobe Firefly — see placeholders in §5–7)
- Or a CSS interactive demo panel (where live app footage is more appropriate)

**Frame:** Centred, max-width 1000px, `border-radius: 20px`, `overflow: hidden`. The video/demo fills the frame edge-to-edge.

---

### 3.5 Checklist section

**Layout:** 2-column grid at desktop, 1-column at mobile. Max-width 900px centred.
**Section heading:** h2, centred above the grid.
**Each item:** Teal `✓` icon (SVG, 16px) + feature name (DM Sans 500, 16px) + optional 1-line description in `--text-sub`.
**Reveal:** Grid items stagger with `.d1`–`.d4` per row.

---

### 3.6 CTA strip

Same treatment as existing audience pages:
- `--bg-dark` (`#1b2d2e`) background
- Centred h2 in `--text-light`
- Subtext in `--text-light-sub`
- Teal pill CTA
- Note: "14-day free trial · No card required"

---

## 4. Nav update

Update `marketing/_partials/_nav.html`. The `Features` group already exists (`data-group="features"`) but has placeholder items and `hidden` on the group. Changes:

1. Remove `hidden` from the `data-group="features"` `<li>` (it was hidden, making it invisible)
2. Replace the four placeholder `<li>` items with:
   ```html
   <li><a href="/features/earn-save-spend" role="menuitem">Earn / Save / Spend</a></li>
   <li><a href="/features/financial-literacy" role="menuitem">Financial Literacy</a></li>
   <li><a href="/features/trust-and-peace-of-mind" role="menuitem">Trust & Peace of Mind</a></li>
   ```
3. Add descriptive subtext to each menu item (Mercury-style nav panel with label + 1-line description):
   ```
   Earn / Save / Spend     — Chores, goals, and instant payouts
   Financial Literacy      — AI coaching and 20-module curriculum
   Trust & Peace of Mind   — Cryptographic ledger and court-ready exports
   ```

No CSS changes needed — the existing `.nav-panel` / `.nav-group` / `.nav-trigger` system handles the dropdown.

---

## 5. Page 1 — Earn / Save / Spend

**Hero headline:** "The chore tracker that actually pays off."
**Hero subtext:** "Assign chores, approve completions, and pay out — with a savings goal waiting at the end. Works for any family on day one."
**Hero mockup:** CSS render of the parent dashboard — chore card in "Pending Approval" state with child name, chore name, reward amount, and two action buttons (Approve / Review). Static but polished.

### Pitch strip copy
> Every family has a version of this: the chore was done, the money was promised, and somehow neither happened cleanly. Morechard closes that loop. Assign, approve, done — with a pocket money balance that updates the moment you tap approve.
>
> Goals give children something to save toward. Payment Bridge means the money moves with two taps, straight from your banking app. No cash hunts, no IOUs.

### Feature pair 1 — Chore Tracker
- **Label:** The daily loop
- **Headline:** Assign, complete, approve. Balance updates automatically.
- **Body:** Parents create chores with a rate and a due date. Children mark them done — optionally with a photo. One tap approves and the ledger records it instantly.
- **Bullets:** Rate Guide with market benchmarks · Photo proof upload · Sibling leaderboard
- **Visual:** CSS mockup — chore list view, one card in "Done — awaiting approval" state with a proof thumbnail. On hover/scroll-in: approval tick animates in, balance counter ticks up.

### Feature pair 2 — Goals & Savings
- **Label:** Something to save for
- **Headline:** Give every pound a destination before it's earned.
- **Body:** Children set savings goals — a name, a target amount, a picture. The Mentor shows them how many chores stand between now and getting there. Parents can boost a goal any time.
- **Bullets:** Effort-to-earn calculator · Parent boosts · 24-hour cooling-off on big purchases
- **Visual:**

  > **[ADOBE FIREFLY PLACEHOLDER — Feature pair 2 visual]**
  > **Type:** Short looping animation (~6s, no audio)
  > **Concept:** A savings goal "seed" sprouting in an orchard setting — starts as a small acorn/seed with a progress ring around it, petals/leaves unfurl as the ring fills. Warm, nature-forward. Colour palette: Morechard teal and gold on a soft parchment/cream background. No text needed — purely visual metaphor for growth and patience.
  > **Mood reference:** Gentle, premium, reminiscent of Apple's health app animations but with an organic/botanical aesthetic.
  > **File slot:** `marketing/video/goals-grow.mp4` (loop, autoplay, muted, `playsinline`)

### Feature pair 3 — Payment Bridge
- **Label:** Pay in seconds
- **Headline:** Open Monzo. Paste. Done.
- **Body:** When you approve, Morechard hands you the exact amount and opens your banking app. Monzo, Revolut, PayPal — or Smart Copy for traditional bank transfers. No card numbers stored, ever.
- **Bullets:** Deep-links to Monzo, Revolut, PayPal · Smart Copy for bank transfers · Paid-out timestamp logged
- **Visual:** CSS mockup — the Payment Bridge bottom sheet: tile grid of bank logos (Monzo coral, Revolut navy, PayPal blue, Smart Copy), amount displayed prominently, one tile highlighted. Clean, minimal.

### Showcase section
> **[ADOBE FIREFLY PLACEHOLDER — Earn/Save/Spend showcase]**
> **Type:** ~15s looping screen-capture style animation (stylised, not raw footage)
> **Concept:** A top-down view of a kitchen table. A parent's phone on the left shows Morechard's approval screen. A child's phone on the right shows their balance ticking up after approval. Then the parent taps "Pay Now" and a Monzo notification appears on their phone. Warm, domestic, unhurried. No faces needed — hands only or no people at all.
> **Mood:** Sunday morning, calm household. Morechard teal accent colour ties both phones together.
> **File slot:** `marketing/video/earn-save-spend-showcase.mp4`

### Checklist (all features)
- Chore assignment with rate and due date
- Child completion marking with optional photo proof
- One-tap parent approval
- Rate Guide — market rate benchmarks with fuzzy search
- Sibling leaderboard
- Recurring chore schedules
- Savings goal creation — target, name, progress ring
- Effort-to-earn calculator ("3 more bin nights")
- Parent goal boosts
- Purchase flow — log a completed goal spend
- 24-hour Holding Soil on large purchases
- Pocket Money Day — scheduled weekly/monthly payouts
- Overdraft policy settings
- Payment Bridge — Monzo, Revolut, PayPal deep-links
- Smart Copy for traditional UK bank transfers
- Paid-out delivery timestamp
- Unpaid aggregate indicator per child

---

## 6. Page 2 — Financial Literacy

**Hero headline:** "A financial education built from your child's real life."
**Hero subtext:** "Not generic slides. Every lesson is triggered by what your child actually earns, saves, and spends — so it lands at exactly the right moment."
**Hero mockup:** CSS render of the child's Learning Lab screen — a module card ("Banking 101 · Level 2 · Sapling") with a progress indicator and a "Continue" button. Subtle teal glow behind the card.

### Pitch strip copy
> Most financial education is a worksheet. Morechard's is a mirror. When your child spends their whole balance in a day, the Mentor doesn't lecture — it asks a question about needs and wants, using the exact numbers they just lived through.
>
> Twenty modules. Six pillars. Four age tiers. All triggered by behaviour, never by a parent manually scheduling a lesson. The curriculum grows with the child from age 10 through to 16 and beyond.

### Feature pair 1 — AI Mentor (child coaching)
- **Label:** Coaching that shows up
- **Headline:** The right lesson, exactly when it matters.
- **Body:** Eight behavioural triggers watch for real moments — the child who spends everything at once, the one who stops doing chores for a fortnight, the one who asks about crypto. Each trigger surfaces the lesson that fits.
- **Bullets:** 8 data-signal triggers · Orchard (warm) and Clean (data-driven) personas · Never lectures — always asks
- **Visual:**

  > **[ADOBE FIREFLY PLACEHOLDER — AI Mentor visual]**
  > **Type:** Short looping animation (~8s, no audio)
  > **Concept:** A phone screen showing a chat bubble appearing with a gentle typewriter effect. The message reads something like: *"You just spent £18 in two hours. Is that what you planned, or did it feel different afterwards?"* Below it, a module card slides up: "Needs vs Wants — tap to explore." Teal bubble on parchment background. Feels thoughtful, not gamified.
  > **Mood:** Quiet, intelligent. Like a wise older sibling, not a mascot.
  > **File slot:** `marketing/video/ai-mentor-nudge.mp4`

### Feature pair 2 — Learning Lab curriculum
- **Label:** 20 modules · 6 pillars
- **Headline:** Real financial literacy, from pocket money to compound interest.
- **Body:** The curriculum spans six pillars — earning, spending, saving, debt, investing, and wellbeing — across four age tiers. Modules unlock based on what the child does in the app, not a timetable.
- **Bullets:** Aligned with UK MaPS financial education standards · Age-adaptive (Sapling / Oak / Canopy) · Unlocks from real behaviour, not a schedule
- **Visual:** CSS render — a 2×3 grid of module cards. Each shows pillar colour, module name, and age tier badge. On scroll-in: cards deal in one by one with a stagger animation (like playing cards being laid on a table).

### Feature pair 3 — Parent Insights
- **Label:** For parents
- **Headline:** A weekly briefing on how your child is growing.
- **Body:** Every week the AI produces a Scouting Report — consistency score, responsibility trend, planning horizon — with a plain-English summary. One tap generates copy you can share with your child.
- **Bullets:** Trend indicators (up/down/flat vs prior week) · "Copy for Child" — Seedling or Professional tone · Cached — loads instantly, runs once per week
- **Visual:** CSS mockup — the InsightsTab parent view. A parchment card with three KPI gauges (Consistency, Responsibility, Planning) and a typewriter-animated briefing paragraph below. Teal trend arrow on Consistency.

### Showcase section

> **[USE LIVE APP FOOTAGE — Financial Literacy showcase]**
> **Rationale:** The Learning Lab module experience is already built and polished. A screen recording of a real module (e.g. Module 8 — Banking 101) progressing through its four acts will be more convincing than an animation. The content is the product.
> **Instructions:** Record a 20–30s screen capture of:
> 1. The Learning Lab module list → tap "Banking 101"
> 2. Act 1 intro card → swipe through to Act 2 (the scenario)
> 3. Quiz answer → correct result celebration
> Export as MP4, crop to phone frame (portrait). Place in `marketing/video/learning-lab-demo.mp4`.
> **Frame treatment:** Display inside a CSS phone shell (rounded rectangle, `border-radius: 40px`, thin bezel in `--text-dark`). Autoplay, loop, muted.

### Checklist
- 8 behavioural data-signal triggers (The Burner, Stagnant Earner, Inflation Nudge, Crypto Curious, Device Swapper, The Default, The Hoarder, Social Pinger)
- EXIF integrity trigger (low-confidence proof uploads)
- EXIF batching trigger (cramming chores)
- Two AI personas: Orchard (warm/metaphorical) and Clean (data-driven/clinical)
- Independence score — tracks child-initiated vs parent-initiated actions
- 20-module curriculum across 6 financial pillars
- Four age tiers: Sapling (10–12), Oak (13–15), Canopy (16+)
- Module unlocks from real behaviour — not a fixed timetable
- UK MaPS and Polish NSFE curriculum alignment
- Weekly parent Scouting Report
- KPI gauges: Consistency, Responsibility, Planning Horizon
- Trend indicators vs prior week
- "Copy for Child" modal — Seedling or Professional tone
- Pillar 5 surplus trigger — fires when balance exceeds £100 or all goals are funded
- D1 briefing cache — runs once per week, instant on subsequent loads

---

## 7. Page 3 — Trust & Peace of Mind

**Hero headline:** "Every penny. Every approval. Permanently on record."
**Hero subtext:** "A cryptographically sealed ledger that both households can trust — and that courts can read, if it ever comes to that."
**Hero mockup:** CSS render of the ledger view — a table of 3–4 transaction rows, each with a teal "Verified" badge and a truncated hash string in JetBrains Mono. Conveys precision and permanence immediately.

### Pitch strip copy
> The argument isn't about the £15. It's about the doubt. Who approved it, when, from which phone. Morechard removes the doubt by making every approval a permanent, cryptographically signed record that neither parent can alter.
>
> For most families this is quiet background infrastructure — the truth is just always there. For separated households facing a disagreement, it's the document that makes the meeting unnecessary.

### Feature pair 1 — Sovereign Ledger
- **Label:** The truth engine
- **Headline:** Tamper-proof by design. Not by policy.
- **Body:** Every ledger entry is hashed with SHA-256 and chained to the entry before it. Alter one byte — anywhere in the history — and every subsequent hash breaks. There is no admin override, no delete button, no "edit."
- **Bullets:** SHA-256 chain — every entry linked to the previous · No deletions — errors require reversal entries · `server_timestamp` + IP logged on every row
- **Visual:**

  > **[ADOBE FIREFLY PLACEHOLDER — Ledger visual]**
  > **Type:** Short looping animation (~10s, no audio)
  > **Concept:** An abstract visualisation of a hash chain — three or four "blocks" connected by glowing teal lines. Each block shows a small padlock icon and a partial hash string (JetBrains Mono, partial: `a3f9…c12b`). A fourth block "appends" — slides in from the right, the chain glows briefly as it connects. Clean, dark-on-parchment. No blockchain clichés (no coins, no "crypto" iconography).
  > **Mood:** Precise. Forensic. The visual language of a bank vault, not a tech startup.
  > **File slot:** `marketing/video/hash-chain.mp4`

### Feature pair 2 — Co-Parent & Shield Tools
- **Label:** For two households
- **Headline:** A shared record that belongs to both of you equally.
- **Body:** Each household has private chore lists. Shared expenses — school trips, uniforms, medical — can be logged with receipts attached. Any parent can generate a court-ready PDF at any time, with receipts embedded as numbered exhibits.
- **Bullets:** Private household chore silos · 64 shared expense presets + receipt upload · Court-ready PDF/A export with embedded exhibits · Governance mode: Amicable or Standard approval
- **Visual:** CSS mockup — the shared expenses view. Two expense rows with category chips (Education, Clothing), amounts, and a small receipt thumbnail on one row. A teal "Export PDF" button at the bottom. Clean, professional.

### Feature pair 3 — Security & Identity
- **Label:** Safe by default
- **Headline:** Face ID on the door. No legal names inside.
- **Body:** Biometric authentication (Face ID / Touch ID) protects every session. Children join with a 6-digit code — no email, no legal name required anywhere in the app. Account deletion is permanent and self-serve.
- **Bullets:** WebAuthn biometrics (Face ID / Touch ID) · Children identified by nickname only · 6-digit family code — no child email · Uproot: full account deletion with PII anonymisation
- **Visual:**

  > **[ADOBE FIREFLY PLACEHOLDER — Security visual]**
  > **Type:** Still image or very short loop (~4s)
  > **Concept:** A phone lock screen with a clean Face ID ring animation — the ring glows teal as it "reads", then a gentle unlock. Below the phone, soft parchment background with a subtle shield icon in teal. Minimal, reassuring. Not surveillance-y — feels like a front door with a good lock, not a prison.
  > **Mood:** Calm confidence. The visual equivalent of "we've thought about this so you don't have to."
  > **File slot:** `marketing/video/biometric-lock.mp4`

### Showcase section

> **[USE LIVE APP FOOTAGE — Trust & Peace of Mind showcase]**
> **Rationale:** The PDF export is a real, working feature with genuine forensic value. Showing the actual export flow — tapping "Export", seeing the PDF render with hash chain, exhibits, governance log — is more credible than any animation.
> **Instructions:** Record a 20–30s screen capture of:
> 1. Parent settings → Data & Exports
> 2. Tap "Forensic Report"
> 3. PDF loads — scroll through: cover page, ledger table with hashes, governance log, receipt exhibit
> Export as MP4, crop to phone/desktop frame. Place in `marketing/video/pdf-export-demo.mp4`.
> **Frame treatment:** Desktop browser mockup (wider aspect ratio). Autoplay, loop, muted.

### Checklist
- SHA-256 hash chain — every entry linked cryptographically to the previous
- Append-only ledger — no deletions, no edits; errors require reversal entries
- `server_timestamp` and IP address logged on every row
- Governance mode: Amicable (auto-approve) or Standard (both parents must sign off)
- Mutual consent handshake required to change governance mode
- Verified (teal) / Action Needed (gold) visual states on every entry
- Private household chore silos — no cross-visibility between parents
- Shared expense logging — 10 categories, 64 presets
- Receipt upload — client-compressed, R2-stored, hash-chained
- 48-hour receipt edit window; after that, Void-and-Re-log only
- Court-ready PDF/A export with receipts as numbered exhibits
- Basic family summary export (included in all plans)
- Data pruning with double-confirm and archive trail
- WebAuthn biometrics — Face ID / Touch ID
- PIN fallback for devices without biometrics
- Child nickname-only — no legal name required anywhere
- 6-digit family invite code — no child email required
- Child invite code regeneration
- 4-stage high-integrity registration
- Uproot account deletion — PII anonymised, ledger retained for hash integrity

---

## 8. Implementation notes

### Files to create
```
marketing/src/features/earn-save-spend.html
marketing/src/features/financial-literacy.html
marketing/src/features/trust-and-peace-of-mind.html
marketing/css/page-features.css        ← new stylesheet for feature page layout
marketing/video/                       ← new folder (gitignored until assets exist)
```

### Files to modify
```
marketing/_partials/_nav.html          ← update Features dropdown items
marketing/css/base.css                 ← no changes needed; existing tokens cover everything
```

### CSS approach
- New `page-features.css` handles: hero gradient, feature pair alternating layout, mockup frame styles, checklist grid, showcase frame
- Reuses all existing tokens from `base.css` — no new variables needed
- `.reveal` scroll animation is already in `base.css` — no JS changes needed
- Feature pair slide-in (translateX) adds to existing `.reveal` system via an additional `.reveal-side-left` / `.reveal-side-right` modifier class

### CSS mockup convention
Each CSS mockup is a `<div class="app-mockup">` with:
- `background: var(--card-light)` shell
- `border-radius: 16px`
- `border: 1px solid var(--border-light)`
- `box-shadow: 0 24px 80px rgba(0,149,156,0.10)` (only on mockup, not the page)
- Inner elements built from existing app component patterns — same border-radius, colour tokens, and typography as the real app

### Video placeholders
Until Adobe Firefly assets are delivered, each `<video>` element shows a styled placeholder `<div>` with:
- Parchment background
- Centred teal icon relevant to the content
- Caption text describing what the video will show
- Same frame/border-radius as the final video

### Build
No build changes required. These are static HTML pages assembled by the existing template pipeline.

---

## 9. Adobe Firefly asset brief summary

| # | File slot | Type | Duration | Priority |
|---|---|---|---|---|
| 1 | `goals-grow.mp4` | Animation | ~6s loop | Medium — replaceable with CSS |
| 2 | `ai-mentor-nudge.mp4` | Animation | ~8s loop | High — hero of the Literacy page |
| 3 | `hash-chain.mp4` | Animation | ~10s loop | High — hero of Trust page |
| 4 | `biometric-lock.mp4` | Still or ~4s loop | ~4s loop | Low — CSS mockup works fine |
| 5 | `earn-save-spend-showcase.mp4` | Lifestyle video | ~15s loop | High — centrepiece of page 1 |

Live app footage (recorded by developer, not Firefly):
| # | File slot | Source | Notes |
|---|---|---|---|
| 6 | `learning-lab-demo.mp4` | Screen recording | Module 8 — Banking 101, four acts |
| 7 | `pdf-export-demo.mp4` | Screen recording | Data & Exports → Forensic Report |

---

## 10. Spec self-review

- **Placeholders:** All video slots named with explicit file paths. All CSS mockup content described precisely enough to build without additional decisions.
- **Consistency:** All three pages follow identical anatomy (§3). Token usage is consistent throughout — no one-off colour values introduced.
- **Scope:** Nav change is minimal and surgical (existing system, just updating content). No new JS framework. No new build step.
- **Ambiguity:** "Pitch strip copy" in §5–7 is draft copy, not final — copywriting pass needed before implementation but not a blocker for HTML structure.
- **One interpretation:** Each feature pair has one CSS mockup or one video — not both. Decision is explicit per section.