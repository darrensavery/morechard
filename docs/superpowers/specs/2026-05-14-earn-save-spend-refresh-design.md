# Design Spec: earn-save-spend.html — 10-item Refresh
**Date:** 2026-05-14  
**Branch:** feat/audience-pages-and-nav  
**File scope:** `marketing/src/features/earn-save-spend.html`, `marketing/css/page-features.css`

---

## 1. Em dash → en dash (global)
Replace every spaced em dash ` — ` with a spaced en dash ` – ` across the entire file. Applies to all inline copy: pitch strip, pair text, checklist, CTA. This is a global rule for all marketing pages going forward.

---

## 2. Hero: crossfade carousel
Replace the single static `app-mockup` card inside `.fp-mockup-frame` with a 4-slide crossfade carousel.

### Slides
| # | Screen content | Caption |
|---|---|---|
| 1 | Chore list — 3 items with rates, "Ellie's chores" header | "Stop starting from scratch – choose from over 30 pre-defined chores, ready to assign." |
| 2 | Rate Guide — fuzzy search input + 3 result rows with community rates | "Stop guessing what a chore is worth – the community-powered rate guide tells you exactly what other families pay." |
| 3 | Savings goal — goal name, progress ring percentage, target amount | "Stop saving for nothing – give every pound a destination your child chose themselves." |
| 4 | Pending Approvals — single approval card with Approve/Reject buttons | "Stop chasing for updates – approve completions in one tap and the balance updates instantly." |

### Behaviour
- Auto-advances every 4 000 ms
- Transition: 600 ms CSS `opacity` crossfade between slides
- `prefers-reduced-motion`: instant switch, no transition
- Dot indicators below the frame (4 dots, active = teal filled)
- Caption text sits below the dots, updates with the active slide
- No external JS library — interval + classList toggling only

### Markup structure
```
.fp-carousel
  .fp-carousel-slides
    .fp-carousel-slide (×4, each contains an app-mockup)
  .fp-carousel-dots
    button.fp-carousel-dot (×4)
  .fp-carousel-caption
```

### CSS additions to page-features.css
- `.fp-carousel` — position relative, overflow hidden
- `.fp-carousel-slide` — absolute inset, opacity 0, transition 600ms; `&.active` opacity 1
- `.fp-carousel-dots` — flex row, centred, gap 8px, margin-top 16px
- `.fp-carousel-dot` — 8px circle, border 1.5px teal, background transparent; `.active` background teal
- `.fp-carousel-caption` — font-size 14px, color var(--text-sub), text-align center, max-width 560px, margin 12px auto 0, min-height 2.5em (prevents layout shift as caption length varies)

---

## 3. Pitch strip width + colour
- `.fp-pitch-inner`: change `max-width: 640px` → `max-width: 900px`
- Paragraph colour: explicitly set `color: var(--text-dark)` on `.fp-pitch p` (currently inherited, may render as muted depending on cascade)

---

## 4. Checklist heading
`"Everything in Earn / Save / Spend."` → `"All features included in the Chore Tracker."`

---

## 5. Remove sibling leaderboard
- Remove `{ name: 'Sibling leaderboard', desc: '' }` from the checklist `items` array in the script
- Remove `<li>Sibling leaderboard</li>` from Pair 1 bullet list

---

## 6. Benefit-driven descriptions on every checklist item
Every `items` entry must have a non-empty `desc`. Items that cannot be given a meaningful benefit are removed. Revised list:

| Name | Desc |
|---|---|
| Chore assignment with rate and due date | Set what needs doing, what it pays, and when — in under a minute |
| Child completion marking with optional photo proof | Kids mark chores done themselves, removing you from the chase |
| One-tap parent approval | A single tap logs the chore, updates the balance, and closes the loop |
| Rate Guide — market rate benchmarks | See what other families pay for the same chore before you set a rate |
| Chore deadline scheduling | Every chore arrives with a built-in countdown — no deadline left to chance |
| Overdue chore notifications | Parents and children are nudged before anything slips through |
| Flash bonus chores | Reward unexpected effort with a one-off bonus, instantly |
| Recurring chore schedules | Set it once — Morechard re-assigns it every week automatically |
| Savings goal creation | Children set a target, a name, and a picture — and own the journey |
| Effort-to-earn calculator | "3 more bin nights to get there" — makes abstract goals feel achievable |
| Parent goal boosts | Top up a child's goal to reward exceptional effort or mark a milestone |
| Purchase flow | Log a completed goal spend and keep the ledger honest |
| Pocket Money Day | Schedule weekly or monthly payouts so payday is predictable |
| Overdraft policy settings | Choose whether children can go into the negative — you decide the rules |
| Payment Bridge | Opens Monzo, Revolut, or PayPal with the exact amount pre-filled |
| Smart Copy | One tap copies a pre-formatted UK bank transfer message |
| Paid-out delivery timestamp | Every payment logged with a timestamp — no more "did you pay me?" |
| Unpaid aggregate indicator per child | See at a glance what you owe across all children |

---

## 7. Remove 24-hour Holding Soil
- Remove `{ name: '24-hour Holding Soil', desc: '...' }` from checklist `items`
- Remove `<li>24-hour cooling-off on big purchases</li>` from Pair 2 bullet list

---

## 8. Add three new features to checklist
Already captured in item 6 above (Chore deadline scheduling, Overdue chore notifications, Flash bonus chores).

---

## 9. "The daily loop" → three-card section
Replace Pair 1 (left text / right mockup layout) with a centred three-card section matching the homepage `#who` pattern.

### Structure
```
section.fp-loop-cards-section
  div.fp-loop-cards-inner
    span.fp-pair-label  "The daily loop"
    h2                  "Everything parents hate about chore time. Gone."
    p.fp-loop-cards-sub "Morechard handles the reminders, the records, and the rates — so you can focus on the reward."
    div.fp-loop-cards-grid
      div.fp-loop-card (×3)
        div.fp-loop-card-icon  (inline SVG)
        div.fp-loop-card-benefit  (bold, ~4 words)
        p.fp-loop-card-copy
        div.fp-loop-card-feature  (small teal label, feature name)
```

### Three cards
**Card 1 — No more nagging**  
Deadline scheduling and overdue notifications keep every chore on track — without you chasing.  
*Feature: Chore deadline scheduling + overdue notifications*

**Card 2 — Effort recognised instantly**  
Photo proof and one-tap approval means a child's work is seen and rewarded the moment it happens.  
*Feature: Photo proof upload + one-tap approval*

**Card 3 — Pay the right amount, every time**  
The community-powered Rate Guide benchmarks 30+ common chores so your rates are fair, consistent, and defensible.  
*Feature: Community Rate Guide*

### CSS additions
- `.fp-loop-cards-section` — padding 80px var(--pad-x), border-top 1px solid var(--border-light)
- `.fp-loop-cards-inner` — max-width 1100px, margin 0 auto, text-align center
- `.fp-loop-cards-inner h2` — same style as `.fp-checklist h2`
- `.fp-loop-cards-sub` — same style as `.fp-checklist-sub`, max-width 600px, margin 0 auto 48px
- `.fp-loop-cards-grid` — display grid, grid-template-columns repeat(3,1fr), gap 24px
- `.fp-loop-card` — background var(--card-light), border 1px solid var(--border-light), border-radius var(--r-card), padding 28px, text-align left, border-top 3px solid var(--teal)
- `.fp-loop-card-icon` — width 36px, height 36px, color var(--teal), margin-bottom 16px
- `.fp-loop-card-benefit` — font-size 17px, font-weight 600, color var(--text-dark), margin-bottom 8px
- `.fp-loop-card-copy` — font-size 15px, line-height 1.65, color var(--text-sub), margin-bottom 12px
- `.fp-loop-card-feature` — font-size 12px, font-weight 500, color var(--teal), letter-spacing 0.06em, text-transform uppercase
- Responsive ≤860px: grid-template-columns 1fr

---

## 10. Reading progress bar
The `#reading-progress` bar CSS lives in `home.css` which is **not** loaded on this page (`PAGE_CSS: page-features.css`). Two actions required:
1. Add `#reading-progress` CSS rule to `page-features.css`
2. Add the progress bar JS (matching homepage pattern: create div, append to body, update width on scroll via rAF) to the `<!-- SCRIPTS_START -->` block in `earn-save-spend.html`

---

## Self-review
- No TBDs or placeholders
- Carousel slide count (4) consistent throughout
- "Thousands of families" claim removed from captions
- Sibling leaderboard removed from both bullet list and checklist — no orphans
- 24-hour Holding Soil removed from both bullet list and checklist — no orphans
- Three new features appear in checklist only (not in now-removed pair bullets)
- Daily loop section replaces Pair 1 entirely — the existing mockup for Pair 1 is discarded, the CSS animation stays intact for the showcase section below
- Progress bar requires both CSS and JS changes — both noted
