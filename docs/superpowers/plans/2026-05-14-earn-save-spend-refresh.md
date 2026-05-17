# Earn / Save / Spend — 10-item Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `marketing/src/features/earn-save-spend.html` and `marketing/css/page-features.css` with 10 changes: en-dash copy, hero carousel, pitch strip width fix, checklist heading, leaderboard removal, benefit-driven checklist, Holding Soil removal, three new features, daily loop → three-card section, and reading progress bar.

**Architecture:** All changes are self-contained to two files — the HTML page and its companion CSS. No build step required; the page is served statically. JS is inline in the HTML `<!-- SCRIPTS_START -->` block. CSS custom properties are defined in the base template and available on this page via `page-features.css`.

**Tech Stack:** Vanilla HTML, CSS (custom properties, keyframe animations, CSS grid), vanilla JS (IntersectionObserver, setInterval, rAF). No framework, no bundler.

---

## File Map

| File | Role |
|---|---|
| `marketing/src/features/earn-save-spend.html` | Page markup + inline JS |
| `marketing/css/page-features.css` | All feature-page styles including new carousel, loop cards, progress bar |

---

### Task 1: En dash — replace all em dashes in the HTML file

**Files:**
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Find every em dash instance in the file**

Open `marketing/src/features/earn-save-spend.html` and search for ` — ` (space + em dash + space). Expected locations:
- Line 16: hero sub `pay out — with a savings goal`
- Line 66: pitch strip `was done, the money was promised, and somehow neither happened cleanly. Morechard closes that loop. Assign, approve, done — with a pocket money balance`
- Line 67: pitch strip `Payment Bridge means the money moves with two taps, straight from your banking app. No cash hunts, no IOUs.` (no dash here — verify)
- Any other inline copy

- [ ] **Step 2: Replace each ` — ` with ` – `**

In `marketing/src/features/earn-save-spend.html`, make these replacements:

Line 16 — hero sub:
```html
<!-- BEFORE -->
<p class="fp-sub reveal d2">Assign chores, approve completions, and pay out — with a savings goal waiting at the end. Works for any family on day one.</p>
<!-- AFTER -->
<p class="fp-sub reveal d2">Assign chores, approve completions, and pay out – with a savings goal waiting at the end. Works for any family on day one.</p>
```

Line 66 — pitch strip paragraph 1:
```html
<!-- BEFORE -->
<p>Every family has a version of this: the chore was done, the money was promised, and somehow neither happened cleanly. Morechard closes that loop. Assign, approve, done — with a pocket money balance that updates the moment you tap approve.</p>
<!-- AFTER -->
<p>Every family has a version of this: the chore was done, the money was promised, and somehow neither happened cleanly. Morechard closes that loop. Assign, approve, done – with a pocket money balance that updates the moment you tap approve.</p>
```

- [ ] **Step 3: Verify no remaining em dashes**

Search the file for ` — `. Result should be zero matches.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/features/earn-save-spend.html
git commit -m "fix(marketing): replace em dashes with en dashes on earn-save-spend page"
```

---

### Task 2: Hero carousel — CSS

**Files:**
- Modify: `marketing/css/page-features.css`

- [ ] **Step 1: Add carousel styles at the end of page-features.css**

Append the following block after the last line of `marketing/css/page-features.css`:

```css
/* ── Hero carousel ── */
.fp-carousel {
  position: relative;
  width: 100%;
}

.fp-carousel-slides {
  position: relative;
  min-height: 180px; /* prevents collapse before JS runs */
}

.fp-carousel-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 600ms cubic-bezier(0, 0, 0.2, 1);
  pointer-events: none;
}

.fp-carousel-slide.active {
  opacity: 1;
  position: relative;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .fp-carousel-slide { transition: none; }
}

.fp-carousel-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.fp-carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--teal);
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: background 200ms;
}

.fp-carousel-dot.active {
  background: var(--teal);
}

.fp-carousel-caption {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-sub);
  text-align: center;
  max-width: 560px;
  margin: 12px auto 0;
  min-height: 2.8em; /* prevents layout shift between short and long captions */
}
```

- [ ] **Step 2: Verify file saved with no syntax errors**

Open the file and check the closing brace count is balanced. No unclosed rules.

- [ ] **Step 3: Commit**

```bash
git add marketing/css/page-features.css
git commit -m "feat(marketing): add hero carousel CSS — slides, dots, caption"
```

---

### Task 3: Hero carousel — markup + JS

**Files:**
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Replace the hero mockup markup**

Find the block starting `<!-- Hero mockup: parent approval card -->` (around line 27) and replace the entire `<div class="fp-mockup-frame reveal d4" id="hero-mockup">...</div>` with:

```html
<!-- Hero carousel: 4 slides, crossfade, 4s interval -->
<div class="fp-mockup-frame reveal d4" id="hero-mockup">
  <div class="fp-carousel" id="hero-carousel" style="padding: 28px 32px 20px;">

    <div class="fp-carousel-slides" id="carousel-slides">

      <!-- Slide 1: Chore list -->
      <div class="fp-carousel-slide active" data-caption="Stop starting from scratch – choose from over 30 pre-defined chores, ready to assign.">
        <div class="app-mockup-header">
          <div>
            <div class="app-mockup-title">Ellie's chores</div>
            <div class="app-mockup-sub">3 chores today</div>
          </div>
          <span class="app-badge app-badge--done">2 done this week</span>
        </div>
        <div class="app-card">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Take out the bins</div>
              <div class="app-card-sub">Due today</div>
            </div>
            <div class="app-card-amount">£2.00</div>
          </div>
        </div>
        <div class="app-card">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Tidy bedroom</div>
              <div class="app-card-sub">Due tomorrow</div>
            </div>
            <div class="app-card-amount">£3.00</div>
          </div>
        </div>
        <div class="app-card" style="opacity:0.45;">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Load dishwasher</div>
              <div class="app-card-sub">Due Friday</div>
            </div>
            <div class="app-card-amount">£1.00</div>
          </div>
        </div>
      </div>

      <!-- Slide 2: Rate Guide -->
      <div class="fp-carousel-slide" data-caption="Stop guessing what a chore is worth – the community-powered rate guide tells you exactly what other families pay.">
        <div class="app-mockup-header">
          <div>
            <div class="app-mockup-title">Rate Guide</div>
            <div class="app-mockup-sub">Community benchmarks</div>
          </div>
        </div>
        <div class="app-card" style="margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;padding:2px 0;">
            <svg width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="var(--text-sub)" stroke-width="1.2"/><path d="M10 10l3 3" stroke="var(--text-sub)" stroke-width="1.2" stroke-linecap="round"/></svg>
            <span style="font-size:13px;color:var(--text-sub);">bins</span>
          </div>
        </div>
        <div class="app-card">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Take out the bins</div>
              <div class="app-card-sub">Avg: £2.00 · 847 families</div>
            </div>
            <div class="app-card-amount" style="color:var(--teal);">£2.00</div>
          </div>
        </div>
        <div class="app-card">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Recycling bins</div>
              <div class="app-card-sub">Avg: £1.50 · 412 families</div>
            </div>
            <div class="app-card-amount" style="color:var(--teal);">£1.50</div>
          </div>
        </div>
        <div class="app-card" style="opacity:0.5;">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Empty kitchen bin</div>
              <div class="app-card-sub">Avg: £1.00 · 203 families</div>
            </div>
            <div class="app-card-amount" style="color:var(--teal);">£1.00</div>
          </div>
        </div>
      </div>

      <!-- Slide 3: Savings goal -->
      <div class="fp-carousel-slide" data-caption="Stop saving for nothing – give every pound a destination your child chose themselves.">
        <div class="app-mockup-header">
          <div>
            <div class="app-mockup-title">Ellie's goal</div>
            <div class="app-mockup-sub">Nintendo Switch</div>
          </div>
          <span class="app-badge app-badge--pending">In progress</span>
        </div>
        <div class="app-card" style="text-align:center;padding:20px 16px;">
          <div style="font-size:28px;font-weight:700;color:var(--teal);font-variant-numeric:tabular-nums;">£18.50</div>
          <div style="font-size:13px;color:var(--text-sub);margin:4px 0 14px;">saved of £279.99</div>
          <div style="background:var(--border-light);border-radius:999px;height:8px;overflow:hidden;">
            <div style="width:7%;height:100%;background:var(--teal);border-radius:999px;"></div>
          </div>
          <div style="font-size:12px;color:var(--text-sub);margin-top:10px;">About 131 more chores to go</div>
        </div>
        <div class="app-card" style="opacity:0.6;margin-top:8px;">
          <div class="app-card-row">
            <div class="app-card-label">Mum boosted your goal</div>
            <div class="app-card-amount" style="color:var(--teal);">+£5.00</div>
          </div>
        </div>
      </div>

      <!-- Slide 4: Pending approvals -->
      <div class="fp-carousel-slide" data-caption="Stop chasing for updates – approve completions in one tap and the balance updates instantly.">
        <div class="app-mockup-header">
          <div>
            <div class="app-mockup-title">Pending Approvals</div>
            <div class="app-mockup-sub">1 chore awaiting your review</div>
          </div>
          <span class="app-badge app-badge--pending">1 pending</span>
        </div>
        <div class="app-card">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Take out the bins</div>
              <div class="app-card-sub">Ellie · Due today</div>
            </div>
            <div class="app-card-amount">£2.00</div>
          </div>
          <div class="app-btn-row">
            <div class="app-btn app-btn--primary">Approve</div>
            <div class="app-btn app-btn--ghost">Reject</div>
          </div>
        </div>
        <div class="app-card" style="opacity:0.45;">
          <div class="app-card-row">
            <div>
              <div class="app-card-label">Tidy bedroom</div>
              <div class="app-card-sub">Ellie · Due tomorrow</div>
            </div>
            <div class="app-card-amount">£3.00</div>
          </div>
        </div>
      </div>

    </div><!-- /carousel-slides -->

    <div class="fp-carousel-dots" id="carousel-dots">
      <button class="fp-carousel-dot active" aria-label="Slide 1"></button>
      <button class="fp-carousel-dot" aria-label="Slide 2"></button>
      <button class="fp-carousel-dot" aria-label="Slide 3"></button>
      <button class="fp-carousel-dot" aria-label="Slide 4"></button>
    </div>

    <p class="fp-carousel-caption" id="carousel-caption">Stop starting from scratch – choose from over 30 pre-defined chores, ready to assign.</p>

  </div><!-- /fp-carousel -->
</div>
```

- [ ] **Step 2: Add carousel JS to the SCRIPTS_START block**

Inside the `(function () { ... })();` block in `<!-- SCRIPTS_START -->`, add the following **before** the closing `})();`:

```js
  // Hero carousel — 4-slide crossfade, 4s interval
  (function () {
    var slides   = Array.from(document.querySelectorAll('.fp-carousel-slide'));
    var dots     = Array.from(document.querySelectorAll('.fp-carousel-dot'));
    var caption  = document.getElementById('carousel-caption');
    if (!slides.length) return;

    var current  = 0;
    var INTERVAL = 4000;
    var prefRed  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function goTo(index) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
      if (caption) caption.textContent = slides[current].dataset.caption || '';
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); clearInterval(timer); timer = setInterval(advance, INTERVAL); });
    });

    function advance() { goTo(current + 1); }

    var timer = prefRed ? null : setInterval(advance, INTERVAL);
  }());
```

- [ ] **Step 3: Also remove the old hero-mockup load animation** from the top of the script block (it references `id="hero-mockup"` which still exists, so the frame animation still works — no change needed there).

- [ ] **Step 4: Check in browser (Live Server)**

Open `marketing/src/features/earn-save-spend.html` in Live Server. Verify:
- All 4 slides render correctly
- Auto-advances every 4s
- Dots update in sync with slide
- Caption updates with each slide
- Clicking a dot jumps to that slide and resets the timer

- [ ] **Step 5: Commit**

```bash
git add marketing/src/features/earn-save-spend.html
git commit -m "feat(marketing): hero crossfade carousel — 4 slides, dot indicators, benefit captions"
```

---

### Task 4: Pitch strip — width and colour fix

**Files:**
- Modify: `marketing/css/page-features.css`
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Widen the pitch strip in CSS**

In `marketing/css/page-features.css`, find:
```css
.fp-pitch-inner {
  max-width: 640px;
  margin: 0 auto;
}
```
Replace with:
```css
.fp-pitch-inner {
  max-width: 900px;
  margin: 0 auto;
}
```

- [ ] **Step 2: Explicitly set paragraph colour**

In `marketing/css/page-features.css`, find:
```css
.fp-pitch p {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.75;
  color: var(--text-dark);
  margin-bottom: 24px;
}
```
The colour is already `var(--text-dark)` — confirm this renders as a dark readable colour (not muted). If the pitch renders visually grey, check if the page template injects any cascade that overrides this. No change needed if colour looks correct.

- [ ] **Step 3: Replace em dashes in pitch strip copy**

In `marketing/src/features/earn-save-spend.html`, the pitch strip paragraph (line ~66) already handled in Task 1. Verify no remaining em dashes in this section.

- [ ] **Step 4: Commit**

```bash
git add marketing/css/page-features.css
git commit -m "fix(marketing): widen pitch strip to 900px to match hero frame width"
```

---

### Task 5: Checklist heading + remove sibling leaderboard + remove Holding Soil

**Files:**
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Update checklist heading**

Find:
```html
<h2 class="reveal">Everything in Earn / Save / Spend.</h2>
```
Replace with:
```html
<h2 class="reveal">All features included in the Chore Tracker.</h2>
```

- [ ] **Step 2: Remove sibling leaderboard from Pair 1 bullets**

Find in the Pair 1 `fp-pair-bullets` list:
```html
<li>Sibling leaderboard</li>
```
Delete that `<li>` entirely.

- [ ] **Step 3: Remove 24-hour cooling-off from Pair 2 bullets**

Find in the Pair 2 `fp-pair-bullets` list:
```html
<li>24-hour cooling-off on big purchases</li>
```
Delete that `<li>` entirely.

- [ ] **Step 4: Commit**

```bash
git add marketing/src/features/earn-save-spend.html
git commit -m "fix(marketing): update checklist heading, remove sibling leaderboard and Holding Soil bullets"
```

---

### Task 6: Checklist — full benefit-driven rewrite + new features

**Files:**
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Replace the entire `items` array in the inline script**

Find the block starting `var items = [` and ending `];` inside `<!-- SCRIPTS_START -->`. Replace it entirely with:

```js
  var items = [
    { name: 'Chore assignment with rate and due date',               desc: 'Set what needs doing, what it pays, and when – in under a minute' },
    { name: 'Child completion marking with optional photo proof',     desc: 'Kids mark chores done themselves, removing you from the chase' },
    { name: 'One-tap parent approval',                                desc: 'A single tap logs the chore, updates the balance, and closes the loop' },
    { name: 'Rate Guide – market rate benchmarks',                    desc: 'See what other families pay for the same chore before you set a rate' },
    { name: 'Chore deadline scheduling',                              desc: 'Every chore arrives with a built-in countdown – no deadline left to chance' },
    { name: 'Overdue chore notifications',                            desc: 'Parents and children are nudged before anything slips through' },
    { name: 'Flash bonus chores',                                     desc: 'Reward unexpected effort with a one-off bonus, instantly' },
    { name: 'Recurring chore schedules',                              desc: 'Set it once – Morechard re-assigns it every week automatically' },
    { name: 'Savings goal creation',                                  desc: 'Children set a target, a name, and a picture – and own the journey' },
    { name: 'Effort-to-earn calculator',                              desc: '"3 more bin nights to get there" – makes abstract goals feel achievable' },
    { name: 'Parent goal boosts',                                     desc: 'Top up a child\'s goal to reward exceptional effort or mark a milestone' },
    { name: 'Purchase flow',                                          desc: 'Log a completed goal spend and keep the ledger honest' },
    { name: 'Pocket Money Day',                                       desc: 'Schedule weekly or monthly payouts so payday is predictable' },
    { name: 'Overdraft policy settings',                              desc: 'Choose whether children can go into the negative – you decide the rules' },
    { name: 'Payment Bridge',                                         desc: 'Opens Monzo, Revolut, or PayPal with the exact amount pre-filled' },
    { name: 'Smart Copy',                                             desc: 'One tap copies a pre-formatted UK bank transfer message' },
    { name: 'Paid-out delivery timestamp',                            desc: 'Every payment logged with a timestamp – no more "did you pay me?"' },
    { name: 'Unpaid aggregate indicator per child',                   desc: 'See at a glance what you owe across all children' },
  ];
```

Note: all internal dashes in `desc` strings use en dashes (–).

- [ ] **Step 2: Verify the grid renders correctly in browser**

Open in Live Server. Scroll to the checklist. All 18 items should appear, each with a name and a grey sub-description. No item should be missing its `desc`.

- [ ] **Step 3: Commit**

```bash
git add marketing/src/features/earn-save-spend.html
git commit -m "feat(marketing): benefit-driven checklist — 18 items with desc, adds deadline/notification/flash-bonus features"
```

---

### Task 7: Daily loop → three-card section (CSS)

**Files:**
- Modify: `marketing/css/page-features.css`

- [ ] **Step 1: Add three-card section styles**

Append to `marketing/css/page-features.css`:

```css
/* ── Daily loop — three-card section ── */
.fp-loop-cards-section {
  padding: 80px var(--pad-x);
  border-top: 1px solid var(--border-light);
}

.fp-loop-cards-inner {
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.fp-loop-cards-inner .fp-pair-label {
  display: block;
  margin-bottom: 14px;
}

.fp-loop-cards-inner h2 {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.5vw, 36px);
  font-weight: 500;
  color: var(--text-dark);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
  line-height: 1.15;
}

.fp-loop-cards-sub {
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.7;
  color: var(--text-sub);
  max-width: 600px;
  margin: 0 auto 48px;
}

.fp-loop-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  text-align: left;
}

.fp-loop-card {
  background: var(--card-light);
  border: 1px solid var(--border-light);
  border-top: 3px solid var(--teal);
  border-radius: var(--r-card);
  padding: 28px;
}

.fp-loop-card-icon {
  width: 36px;
  height: 36px;
  color: var(--teal);
  margin-bottom: 16px;
}

.fp-loop-card-benefit {
  font-family: var(--font-body);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-dark);
  margin-bottom: 8px;
  line-height: 1.3;
}

.fp-loop-card-copy {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.65;
  color: var(--text-sub);
  margin-bottom: 16px;
}

.fp-loop-card-feature {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  color: var(--teal);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 860px) {
  .fp-loop-cards-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Commit**

```bash
git add marketing/css/page-features.css
git commit -m "feat(marketing): add daily loop three-card section CSS"
```

---

### Task 8: Daily loop → three-card section (markup)

**Files:**
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Replace Pair 1 markup entirely**

Find the block:
```html
    <!-- Pair 1: Chore Tracker -->
    <div class="fp-pair">
      ...
    </div>
```
(It runs from `<!-- Pair 1: Chore Tracker -->` to the closing `</div>` before `<!-- Pair 2: Goals & Savings`)

Replace that entire block with:

```html
    <!-- Daily loop: three-card section -->
    <section class="fp-loop-cards-section">
      <div class="fp-loop-cards-inner">
        <span class="fp-pair-label reveal">The daily loop</span>
        <h2 class="reveal d1">Everything parents hate about chore time. Gone.</h2>
        <p class="fp-loop-cards-sub reveal d2">Morechard handles the reminders, the records, and the rates – so you can focus on the reward.</p>
        <div class="fp-loop-cards-grid">

          <div class="fp-loop-card reveal d1">
            <div class="fp-loop-card-icon">
              <svg width="36" height="36" fill="none" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15" stroke="currentColor" stroke-width="1.5"/>
                <path d="M18 10v8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 26l2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="fp-loop-card-benefit">No more nagging.</div>
            <p class="fp-loop-card-copy">Deadline scheduling and overdue notifications keep every chore on track – without you chasing.</p>
            <div class="fp-loop-card-feature">Chore deadline scheduling · overdue notifications</div>
          </div>

          <div class="fp-loop-card reveal d2">
            <div class="fp-loop-card-icon">
              <svg width="36" height="36" fill="none" viewBox="0 0 36 36" aria-hidden="true">
                <rect x="6" y="8" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M12 18l4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="fp-loop-card-benefit">Effort recognised instantly.</div>
            <p class="fp-loop-card-copy">Photo proof and one-tap approval means a child's work is seen and rewarded the moment it happens.</p>
            <div class="fp-loop-card-feature">Photo proof upload · one-tap approval</div>
          </div>

          <div class="fp-loop-card reveal d3">
            <div class="fp-loop-card-icon">
              <svg width="36" height="36" fill="none" viewBox="0 0 36 36" aria-hidden="true">
                <path d="M18 6v4M18 26v4M6 18h4M26 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="18" cy="18" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M15 18l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="fp-loop-card-benefit">Pay the right amount, every time.</div>
            <p class="fp-loop-card-copy">The community-powered Rate Guide benchmarks 30+ common chores so your rates are fair, consistent, and defensible.</p>
            <div class="fp-loop-card-feature">Community Rate Guide</div>
          </div>

        </div>
      </div>
    </section>
```

Note: this section sits *inside* `<div class="fp-pairs">` before Pair 2. It will need to be moved *outside* that div, or the `.fp-pairs` padding will apply. Place it **before** `<div class="fp-pairs">` and close `</div><!-- /fp-pairs -->` after Pairs 2 and 3 only.

Specifically, restructure the wrapper so the section order is:
1. `section.fp-loop-cards-section` (outside fp-pairs)
2. `div.fp-pairs` containing only Pair 2 (Goals) and Pair 3 (Payment Bridge)

- [ ] **Step 2: Verify in browser**

Open in Live Server. Check:
- Three cards render side by side on desktop
- Stack vertically on narrow viewport (≤860px)
- Reveal animations fire on scroll
- No broken layout from the `fp-pairs` wrapper change

- [ ] **Step 3: Commit**

```bash
git add marketing/src/features/earn-save-spend.html
git commit -m "feat(marketing): replace daily loop pair with three-card benefit section"
```

---

### Task 9: Reading progress bar

**Files:**
- Modify: `marketing/css/page-features.css`
- Modify: `marketing/src/features/earn-save-spend.html`

- [ ] **Step 1: Add #reading-progress CSS to page-features.css**

The rule lives in `home.css` which is not loaded on this page. Append to `marketing/css/page-features.css`:

```css
/* ── Reading progress bar ── */
#reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 0%;
  height: 3px;
  background: var(--teal);
  z-index: 9999;
  transition: width 80ms linear;
  border-radius: 0 2px 2px 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Add progress bar JS to the SCRIPTS_START block**

Inside the `(function () { ... })();` block, add after the carousel IIFE:

```js
  // Reading progress bar
  (function () {
    var bar = document.createElement('div');
    bar.id = 'reading-progress';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (docH > 0 ? Math.min(window.scrollY / docH, 1) : 0) * 100 + '%';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }());
```

- [ ] **Step 3: Verify in browser**

Scroll the page from top to bottom. A thin teal bar should track from left to right along the very top of the viewport, behind the nav.

- [ ] **Step 4: Commit**

```bash
git add marketing/css/page-features.css marketing/src/features/earn-save-spend.html
git commit -m "feat(marketing): add reading progress bar to earn-save-spend page"
```

---

## Self-Review

**Spec coverage check:**
1. Em dashes → Task 1 ✓
2. Hero carousel → Tasks 2 + 3 ✓
3. Pitch strip width + colour → Task 4 ✓
4. Checklist heading → Task 5 ✓
5. Remove sibling leaderboard → Task 5 ✓
6. Benefit-driven checklist → Task 6 ✓
7. Remove Holding Soil → Task 5 ✓
8. Three new features in checklist → Task 6 ✓
9. Daily loop → three-card section → Tasks 7 + 8 ✓
10. Progress bar → Task 9 ✓

**Placeholder scan:** No TBDs, no "similar to Task N", all code blocks complete.

**Type consistency:** `fp-carousel-slide`, `fp-carousel-dot`, `fp-carousel-caption`, `fp-loop-card`, `fp-loop-cards-grid` — names consistent across CSS (Tasks 2, 7) and HTML (Tasks 3, 8).

**Edge case — fp-pairs wrapper:** Task 8 explicitly notes the loop-cards section must live *outside* `.fp-pairs` to avoid inheriting its padding. The restructuring is described in the step.
