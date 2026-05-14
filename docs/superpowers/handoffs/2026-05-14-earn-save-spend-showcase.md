# Handoff: Earn/Save/Spend Showcase Animation

**Date:** 2026-05-14  
**Branch:** `feat/audience-pages-and-nav`  
**Status:** Working — animation complete, photo showing, ready for review/commit

---

## What was built

The showcase section of `marketing/src/features/earn-save-spend.html` now has a **two-phone CSS animation** showing the full chore-to-payment loop:

### Animation sequence (16s loop)
1. **0–15%** — Ellie's phone shows a list of 3 chores (Take out the bins, Tidy your room, Load dishwasher)
2. **15–25%** — Tap ripple on "Take out the bins" → detail view slides in
3. **25–40%** — Detail view shown → tap ripple on camera → `chore-bins.webp` photo snaps in
4. **40–52%** — Tap ripple on "Submit for approval" → "Sent for approval" confirmation
5. **52–65%** — Mum's phone: approval card slides in with photo thumbnail, tap ripple on "Approve"
6. **65–80%** — Confirmed state on both phones, balance ticks £12.00 → £14.00, "Mum approved!" notification slides up
7. **80–92%** — Hold final state
8. **92–100%** — Reset

### Key files changed
- `marketing/src/features/earn-save-spend.html` — full showcase HTML rewritten
- `marketing/css/page-features.css` — all animation CSS (~300 lines) rewritten from 7.2s → 16s cycle
- `marketing/_components/phone-mockup-pair.html` — NEW reusable component (locked calibration values)
- `marketing/src/Images/phone-mockup.svg` — NEW iPhone-style SVG frame
- `marketing/src/Images/chore-bins.webp` — NEW chore photo (also in `marketing/Images/`)
- `marketing/Images/phone-mockup.svg` — also here for Live Server serving

### Phone mockup approach
- SVG frame (`phone-mockup.svg`) layered on top of CSS UI with `mix-blend-mode: multiply`
- White screen area in SVG becomes transparent — CSS UI shows through underneath
- **Calibrated screen position (do not change without re-testing):**
  ```css
  top: 2%; left: 3%; right: 3%; bottom: 0.5%;
  border-radius: 13% / 9%;
  padding-top: 10%; /* clears dynamic island */
  width: 290px;
  ```

---

## What still needs doing

### Immediate
- [ ] **Commit all uncommitted changes** — large diff across 10 files on `feat/audience-pages-and-nav`
- [ ] **Review animation timing** — watch the full 16s loop and check transitions feel natural

### Possible improvements discussed but not built
- [ ] The photo (`chore-bins.webp`) is currently copied in two places (`marketing/Images/` and `marketing/src/Images/`). Could consolidate if the build pipeline is updated to also copy from root `marketing/Images/`
- [ ] Could add a subtle "screen swipe" transition between list → detail view (currently fades + translates)
- [ ] Balance counter animation: currently JS-driven. Could explore pure CSS `@counter-style` in future

---

## How the build works

```bash
cd marketing/
node build.js
```

- Reads partials from `_partials/` (nav, footer)
- Reads page HTML from `src/`
- Injects CSS link from `PAGE_CSS:` comment at top of each HTML file
- Outputs to `dist/`
- Copies `src/Images/` → `dist/Images/`, `video/` → `dist/video/`
- Live Server should point at `marketing/dist/` (or the built file path)

---

## Reusable component

`marketing/_components/phone-mockup-pair.html` — drop-in template for any future page needing two side-by-side phone mockups. Contains the HTML shell + locked CSS as a `<style>` block. See file for usage notes.
