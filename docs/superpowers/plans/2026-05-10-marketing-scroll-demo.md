# Scroll-Driven Phone Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static phone mockup image in `#app-promo` with a sticky scroll-driven demo that crossfades through 3 app screens as the user scrolls through the feature list.

**Architecture:** All code lives inline in `marketing/index.html` (CSS + HTML + JS). The `.promo-grid` becomes a scroll-pinning container — left column scrolls normally, right column sticks. An `IntersectionObserver` on each `.promo-feature` item drives `setScreen(n)`. On mobile the layout stacks and screens auto-advance on a 3-second timer.

**Tech Stack:** Vanilla HTML/CSS/JS, IntersectionObserver API, CSS transitions, CSS custom properties (already defined in the file).

---

## File Map

- Modify: `marketing/index.html` — only file changed
  - CSS: replace `.promo-phone` styles, add phone frame + screen + dot styles, add dark-mode variants, add mobile media query
  - HTML: replace the `<div class="promo-phone">` block with phone frame + 3 screens + dots
  - JS: add `initScrollDemo()` function called at end of existing `<script>` block

---

### Task 1: Update CSS — layout, phone frame, screens, dots

**Files:**
- Modify: `marketing/index.html` (CSS block, lines ~350–420)

- [ ] **Step 1: Replace the `.promo-phone` and `.promo-phone img` CSS rules**

Find and replace this block (lines ~406–419):

```css
    .promo-phone {
      position: relative;
      display: flex;
      justify-content: center;
    }

    .promo-phone img {
      width: 100%;
      max-width: 360px;
      height: auto;
      display: block;
      /* subtle drop shadow to lift off background */
      filter: drop-shadow(0 24px 48px rgba(27,45,46,0.22));
    }
```

Replace with:

```css
    /* ── Scroll demo layout ── */
    .promo-grid {
      align-items: flex-start; /* override center so sticky works */
    }

    .promo-feature-list {
      gap: 0; /* remove gap — each item gets its own padding for scroll distance */
    }

    .promo-feature {
      padding: 48px 0;
      opacity: 0.35;
      transition: opacity 0.4s ease;
    }
    .promo-feature.demo-active { opacity: 1; }

    /* ── Phone frame (sticky) ── */
    .promo-phone {
      position: sticky;
      top: calc(50vh - 300px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .phone-frame {
      width: 260px;
      height: 540px;
      background: #0f1a14;
      border-radius: 38px;
      border: 6px solid #2a3d30;
      box-shadow: 0 32px 64px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
    }

    /* Notch */
    .phone-frame::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      width: 90px; height: 24px;
      background: #0f1a14;
      border-radius: 0 0 14px 14px;
      z-index: 10;
    }

    /* Status bar line */
    .phone-frame::after {
      content: '9:41';
      position: absolute;
      top: 6px; left: 20px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      z-index: 11;
      font-family: var(--font-body);
    }

    /* ── Demo screens ── */
    .demo-screen {
      position: absolute;
      inset: 0;
      background: #f5f4f0;
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.5s ease, transform 0.5s ease;
      pointer-events: none;
      display: flex;
      flex-direction: column;
    }
    body.dark .demo-screen { background: #1a2a1f; }

    .demo-screen.active {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* Screen header */
    .ds-header {
      padding: 32px 14px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .ds-greeting {
      font-size: 13px;
      font-weight: 600;
      color: #1b2d2e;
    }
    body.dark .ds-greeting { color: #ededf3; }
    .ds-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--teal);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #fff;
    }

    /* Chore rows */
    .ds-chore-list {
      flex: 1;
      padding: 6px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }
    .ds-chore {
      background: #fff;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(0,0,0,0.06);
    }
    body.dark .ds-chore { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.08); }
    .ds-chore.needs-approval {
      border-color: var(--teal);
      background: rgba(0,149,156,0.06);
    }
    .ds-chore-icon {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: rgba(0,149,156,0.12);
      display: flex; align-items: center; justify-content: center;
      color: var(--teal);
      flex-shrink: 0;
    }
    .ds-chore-title { font-size: 12px; font-weight: 500; color: #1b2d2e; flex: 1; }
    body.dark .ds-chore-title { color: #ededf3; }
    .ds-chore-amount { font-size: 12px; font-weight: 600; color: var(--teal); font-variant-numeric: tabular-nums; }
    .ds-approval-badge {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--teal);
      background: rgba(0,149,156,0.12);
      border-radius: 20px;
      padding: 2px 7px;
      display: flex; align-items: center; gap: 4px;
    }
    .ds-approval-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--teal);
      animation: pulse 2.2s ease infinite;
    }

    /* Approve card (screen 2) */
    .ds-approve-card {
      margin: 60px 14px 0;
      background: #fff;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    body.dark .ds-approve-card { background: rgba(255,255,255,0.08); }
    .ds-approve-title { font-size: 16px; font-weight: 600; color: #1b2d2e; margin-bottom: 4px; }
    body.dark .ds-approve-title { color: #ededf3; }
    .ds-approve-sub { font-size: 13px; color: #6b7b6e; margin-bottom: 20px; }
    .ds-approve-balance {
      font-size: 13px;
      font-weight: 500;
      color: #1b2d2e;
      margin-bottom: 20px;
      font-variant-numeric: tabular-nums;
    }
    body.dark .ds-approve-balance { color: #ededf3; }
    .ds-approve-balance span { color: var(--teal); font-weight: 700; }
    .ds-btn-row { display: flex; gap: 8px; }
    .ds-btn-decline {
      flex: 1; padding: 10px; border-radius: 10px;
      border: 1.5px solid rgba(0,0,0,0.15);
      background: transparent; font-size: 13px; font-weight: 500;
      color: #6b7b6e; cursor: default;
      font-family: var(--font-body);
    }
    body.dark .ds-btn-decline { border-color: rgba(255,255,255,0.2); color: rgba(237,237,243,0.6); }
    .ds-btn-approve {
      flex: 1; padding: 10px; border-radius: 10px;
      background: var(--teal); border: none;
      font-size: 13px; font-weight: 600; color: #fff;
      cursor: default; position: relative; overflow: hidden;
      font-family: var(--font-body);
      transition: background 0.3s ease;
    }
    .ds-btn-approve.approved { background: #2e7d52; }
    .ds-btn-approve .btn-tick {
      display: none;
    }
    .ds-btn-approve.approved .btn-label { display: none; }
    .ds-btn-approve.approved .btn-tick { display: inline; }

    /* Insights screen (screen 3) */
    .ds-insights-header {
      padding: 32px 14px 10px;
      font-size: 14px; font-weight: 600; color: #1b2d2e;
    }
    body.dark .ds-insights-header { color: #ededf3; }
    .ds-gauges {
      display: flex; gap: 8px; padding: 0 14px 12px;
    }
    .ds-gauge {
      flex: 1; background: #fff; border-radius: 10px;
      padding: 10px; border: 1px solid rgba(0,0,0,0.06);
      text-align: center;
    }
    body.dark .ds-gauge { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.08); }
    .ds-gauge-label { font-size: 9px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7b6e; margin-bottom: 6px; }
    .ds-gauge-bar {
      height: 4px; border-radius: 2px;
      background: rgba(0,0,0,0.08);
      margin-bottom: 4px;
    }
    body.dark .ds-gauge-bar { background: rgba(255,255,255,0.1); }
    .ds-gauge-fill {
      height: 100%; border-radius: 2px;
      background: var(--teal);
      width: 0;
      transition: width 0.8s ease 0.3s;
    }
    .demo-screen.active .ds-gauge-fill { width: var(--fill); }
    .ds-gauge-value { font-size: 13px; font-weight: 700; color: var(--teal); }
    .ds-briefing {
      margin: 0 14px;
      background: #f9f5ec;
      border-radius: 12px;
      padding: 14px;
      border: 1px solid rgba(184,152,90,0.2);
    }
    body.dark .ds-briefing { background: rgba(184,152,90,0.08); border-color: rgba(184,152,90,0.2); }
    .ds-briefing-text {
      font-size: 12px; line-height: 1.65; color: #3d4d3e; margin-bottom: 8px;
    }
    body.dark .ds-briefing-text { color: rgba(237,237,243,0.75); }
    .ds-briefing-attr {
      font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
      text-transform: uppercase; color: #b8985a;
    }

    /* Tab bar (screens 1 & 2) */
    .ds-tabbar {
      display: flex;
      border-top: 1px solid rgba(0,0,0,0.07);
      padding: 8px 0 4px;
      margin-top: auto;
      flex-shrink: 0;
    }
    body.dark .ds-tabbar { border-color: rgba(255,255,255,0.07); }
    .ds-tab {
      flex: 1; text-align: center;
      font-size: 9px; font-weight: 500; color: #9eada0;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
    }
    .ds-tab.active { color: var(--teal); }
    .ds-tab-dot {
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--teal);
    }

    /* Progress dots */
    .demo-dots {
      display: flex; gap: 8px;
    }
    .demo-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(0,0,0,0.15);
      transition: background 0.3s ease, transform 0.3s ease;
    }
    body.dark .demo-dot { background: rgba(255,255,255,0.2); }
    .demo-dot.active { background: var(--teal); transform: scale(1.3); }

    /* ── Mobile: stack layout, no sticky ── */
    @media (max-width: 767px) {
      .promo-grid {
        grid-template-columns: 1fr;
      }
      .promo-phone {
        position: static;
        order: -1;
        margin-bottom: 40px;
      }
      .promo-feature {
        opacity: 1;
      }
      .promo-feature.demo-active { opacity: 1; }
    }
```

- [ ] **Step 2: Commit CSS changes**

```bash
git add marketing/index.html
git commit -m "feat(marketing): add scroll demo CSS — phone frame, screens, dots"
```

---

### Task 2: Replace HTML — phone frame + 3 screens + dots

**Files:**
- Modify: `marketing/index.html` (HTML block, lines ~1069–1072)

- [ ] **Step 1: Replace the static phone image block**

Find:
```html
        <!-- Right: phone mockup image -->
        <div class="promo-phone reveal d2">
          <img src="phone-mockup.webp" alt="Morechard app running on a phone" loading="lazy" width="360" height="780" />
        </div>
```

Replace with:
```html
        <!-- Right: scroll-driven phone demo -->
        <div class="promo-phone">
          <div class="phone-frame">

            <!-- Screen 1: Chore list -->
            <div class="demo-screen active" id="demo-screen-0">
              <div class="ds-header">
                <div class="ds-greeting">Good morning, Darren</div>
                <div class="ds-avatar">D</div>
              </div>
              <div class="ds-chore-list">
                <div class="ds-chore">
                  <div class="ds-chore-icon">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <span class="ds-chore-title">Washed up after dinner</span>
                  <span class="ds-chore-amount">£1.00</span>
                </div>
                <div class="ds-chore needs-approval">
                  <div class="ds-chore-icon">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="4" y="3" width="12" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  </div>
                  <span class="ds-chore-title">Tidied bedroom</span>
                  <div class="ds-approval-badge">
                    <span class="ds-approval-dot"></span>
                    Review
                  </div>
                </div>
                <div class="ds-chore">
                  <div class="ds-chore-icon">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 17l4-4 3 3 7-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                  <span class="ds-chore-title">Took out recycling</span>
                  <span class="ds-chore-amount">£0.50</span>
                </div>
              </div>
              <div class="ds-tabbar">
                <div class="ds-tab active">
                  <div class="ds-tab-dot"></div>
                  Jobs
                </div>
                <div class="ds-tab">Insights</div>
                <div class="ds-tab">Goals</div>
              </div>
            </div>

            <!-- Screen 2: Approve chore -->
            <div class="demo-screen" id="demo-screen-1">
              <div class="ds-approve-card">
                <div class="ds-approve-title">Tidied bedroom</div>
                <div class="ds-approve-sub">Ella · £1.50</div>
                <div class="ds-approve-balance">
                  Balance: <span id="demo-balance">£12.50</span>
                </div>
                <div class="ds-btn-row">
                  <button class="ds-btn-decline" tabindex="-1">Decline</button>
                  <button class="ds-btn-approve" id="demo-approve-btn" tabindex="-1">
                    <span class="btn-label">Approve</span>
                    <span class="btn-tick">✓ Approved</span>
                  </button>
                </div>
              </div>
              <div class="ds-tabbar" style="margin-top:auto">
                <div class="ds-tab active">
                  <div class="ds-tab-dot"></div>
                  Jobs
                </div>
                <div class="ds-tab">Insights</div>
                <div class="ds-tab">Goals</div>
              </div>
            </div>

            <!-- Screen 3: Insights tab -->
            <div class="demo-screen" id="demo-screen-2">
              <div class="ds-insights-header">Weekly Insights — Ella</div>
              <div class="ds-gauges">
                <div class="ds-gauge">
                  <div class="ds-gauge-label">Consistency</div>
                  <div class="ds-gauge-bar"><div class="ds-gauge-fill" style="--fill:80%"></div></div>
                  <div class="ds-gauge-value">80%</div>
                </div>
                <div class="ds-gauge">
                  <div class="ds-gauge-label">Responsibility</div>
                  <div class="ds-gauge-bar"><div class="ds-gauge-fill" style="--fill:70%"></div></div>
                  <div class="ds-gauge-value">70%</div>
                </div>
              </div>
              <div class="ds-briefing">
                <div class="ds-briefing-text">Ella completed 4 of 5 jobs this week — her strongest streak yet. She's consistently choosing harder tasks, which suggests growing confidence with money.</div>
                <div class="ds-briefing-attr">Drafted by your Orchard Mentor</div>
              </div>
            </div>

          </div><!-- /phone-frame -->

          <!-- Progress dots -->
          <div class="demo-dots" aria-hidden="true">
            <div class="demo-dot active"></div>
            <div class="demo-dot"></div>
            <div class="demo-dot"></div>
          </div>
        </div>
```

- [ ] **Step 2: Trim feature list to 3 items**

The existing list has 4 `.promo-feature` items. The 4th ("AI Mentor for every milestone") maps to no screen and should be removed.

Find and delete this block (lines ~1054–1065):
```html
            <li class="promo-feature reveal d4">
              <div class="promo-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <div class="promo-feature-title">AI Mentor for every milestone</div>
                <div class="promo-feature-desc">Financial lessons triggered by your child's real earning and spending — not generic slides.</div>
              </div>
            </li>
```

Also update the 3rd feature title + desc to reflect the AI Mentor / Insights theme (replacing the "Savings goals" feature). Find:
```html
                <div class="promo-feature-title">Savings goals &amp; progress tracking</div>
                <div class="promo-feature-desc">Children set goals, watch progress bars fill, and learn what saving actually feels like.</div>
```
Replace with:
```html
                <div class="promo-feature-title">AI Mentor weekly briefing</div>
                <div class="promo-feature-desc">Every week, your Orchard Mentor analyses Ella's jobs and earnings — and sends you a plain-English briefing on her financial habits.</div>
```

- [ ] **Step 3: Commit HTML changes**

```bash
git add marketing/index.html
git commit -m "feat(marketing): replace static phone image with scroll demo HTML"
```

---

### Task 3: Add JavaScript — IntersectionObserver + approve animation + mobile timer

**Files:**
- Modify: `marketing/index.html` (JS block, line ~1511, just before `</script>`)

- [ ] **Step 1: Add `initScrollDemo()` function**

Find this line near the end of the `<script>` block:
```js
    form.addEventListener('submit', async e => {
```

Insert the following **before** that line:

```js
    /* ── Scroll-driven phone demo ── */
    function initScrollDemo() {
      const screens   = Array.from(document.querySelectorAll('.demo-screen'));
      const dots      = Array.from(document.querySelectorAll('.demo-dot'));
      const features  = Array.from(document.querySelectorAll('.promo-feature'));
      const approveBtn  = document.getElementById('demo-approve-btn');
      const balanceEl   = document.getElementById('demo-balance');

      let currentScreen = 0;
      let approveTimer  = null;

      function setScreen(n) {
        if (n === currentScreen && n !== 1) return;
        currentScreen = n;

        screens.forEach((s, i) => s.classList.toggle('active', i === n));
        dots.forEach((d, i) => d.classList.toggle('active', i === n));
        features.forEach((f, i) => f.classList.toggle('demo-active', i === n));

        // Reset approve state when leaving screen 1
        if (n !== 1) {
          clearTimeout(approveTimer);
          if (approveBtn) {
            approveBtn.classList.remove('approved');
            balanceEl.textContent = '£12.50';
          }
        }

        // Trigger approve animation when screen 1 becomes active
        if (n === 1 && approveBtn) {
          approveTimer = setTimeout(() => {
            approveBtn.classList.add('approved');
            tickBalance(1250, 1400, 800);
          }, 600);
        }
      }

      function tickBalance(from, to, duration) {
        const start = performance.now();
        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const value = from + (to - from) * progress;
          balanceEl.textContent = '£' + (value / 100).toFixed(2);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }

      // Initialise first feature as active
      setScreen(0);

      // Desktop: IntersectionObserver
      if (window.matchMedia('(min-width: 768px)').matches) {
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = features.indexOf(entry.target);
              if (idx !== -1) setScreen(idx);
            }
          });
        }, { threshold: 0.5 });

        features.forEach(f => observer.observe(f));
      } else {
        // Mobile: auto-advance every 3s
        let idx = 0;
        setInterval(() => {
          idx = (idx + 1) % screens.length;
          setScreen(idx);
        }, 3000);
      }
    }

    initScrollDemo();

```

- [ ] **Step 2: Commit JS changes**

```bash
git add marketing/index.html
git commit -m "feat(marketing): add IntersectionObserver scroll demo JS + approve animation"
```

---

### Task 4: Visual QA

**Files:** none changed — this is a verification step.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite reports) in a browser.

- [ ] **Step 2: Desktop checks**

1. Scroll into the `#app-promo` section — phone frame should be sticky on the right
2. Scroll so "Assign & approve chores" feature is centred → Screen 1 (chore list) visible, other features dimmed
3. Scroll to "Real-time pocket money balance" → Screen 2 (approve card) appears; after 600ms the button turns green and balance ticks from £12.50 to £14.00
4. Scroll to "AI Mentor weekly briefing" → Screen 3 (insights) appears; gauge bars animate in
5. Dark mode (toggle if available) — screen backgrounds should be `#1a2a1f`, cards dark

- [ ] **Step 3: Mobile checks**

Resize browser to 375px wide (DevTools device mode).

1. Phone frame stacks above the feature list
2. Screens auto-advance every 3 seconds through all 3 screens
3. No sticky behaviour on mobile

- [ ] **Step 4: Fix any issues found, then commit**

```bash
git add marketing/index.html
git commit -m "fix(marketing): scroll demo QA fixes"
```

---

### Task 5: Final commit and push

- [ ] **Step 1: Final status check**

```bash
git status
```

Expected: nothing uncommitted.

- [ ] **Step 2: Push**

```bash
git push
```

Cloudflare Pages will pick up the push and deploy automatically.
