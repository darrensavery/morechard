# Scroll-Driven Phone Demo — Marketing Page

**Date:** 2026-05-10  
**Status:** Draft

---

## Overview

Replace the static phone mockup image in the `#app-promo` section with a sticky scroll-driven demo. As the user scrolls through the three feature callouts on the left, the phone frame on the right stays pinned and crossfades between three hand-crafted app screens.

---

## Layout

The existing `.promo-grid` (2-col: feature list left, phone right) is restructured as a scroll-pinning container:

- **Left column** — the existing three `.promo-feature` items, spaced vertically so each occupies roughly one viewport height of scroll distance
- **Right column** — a CSS `position: sticky; top: calc(50vh - 300px)` phone frame that stays centred in the viewport while the left column scrolls past it

The static `<img src="phone-mockup.webp">` is removed. The phone frame is rendered in HTML/CSS (rounded rect + notch + status bar) with three screen panels inside it. Only one panel is visible at a time via opacity crossfade.

On mobile (< 768 px) the sticky layout collapses: phone frame stacks above the feature list, screens auto-advance on a 3-second timer rather than scroll-driven.

---

## Three App Screens (HTML/CSS — no images)

Each screen is a self-contained `<div class="demo-screen">` absolutely positioned inside the phone frame. Transitions: `opacity 0.5s ease, transform 0.5s ease` (slide-up 12px on enter).

### Screen 1 — Chore List (maps to "Chore Tracker" feature)

Parent view. Shows:
- App header: "Good morning, Darren" + avatar placeholder
- Three chore rows with icon, title, assigned child name, and reward amount (e.g. £1.50)
- One row highlighted with a teal "Needs approval" badge and a pulsing dot
- Bottom tab bar: Jobs | Insights | Goals (Jobs active)

### Screen 2 — Approve Chore (maps to "Real-Data Literacy" feature)

Triggered when Screen 1 is active and the scroll advances. Shows an approval card:
- Chore name: "Tidied bedroom"
- Child: "Ella · £1.50"
- Two buttons: Decline (ghost) | Approve (teal filled)
- On entering this screen, after a 600ms delay the Approve button animates a green tick, and a "Balance: £12.50 → £14.00" counter ticks up over 800ms using a CSS counter animation

### Screen 3 — Insights Tab (maps to "AI Mentor" feature)

Parent Insights view:
- Tab bar with "Insights" active
- Weekly summary card: consistency gauge (e.g. 80%), responsibility gauge (70%)
- Briefing card with parchment tint: 2–3 lines of dummy AI text ("Ella completed 4 of 5 jobs this week…")
- "Drafted by your Orchard Mentor" attribution line in small caps

---

## Scroll Logic (JavaScript)

An `IntersectionObserver` watches each `.promo-feature` list item with a threshold of `0.5`. When feature N becomes intersecting, `setScreen(N)` is called:

```
setScreen(n):
  - remove .active from all .demo-screen elements
  - add .active to screen[n]
  - update progress dots (optional — see below)
  - if n === 1 (approve screen): trigger approve animation after 600ms
```

No scroll event listeners. IntersectionObserver only — performant and battery-friendly.

---

## Progress Dots

Three small dots below the phone frame indicate the current screen. Active dot is teal, others are grey. Purely decorative — no click interaction needed.

---

## Styling Constraints

- Phone frame uses existing CSS variables (`--teal`, `--gold`, `--r-card`, dark mode vars)
- Screen backgrounds: light mode `#f5f4f0` (matches existing card background), dark mode `#1a2a1f`
- Fonts: Manrope (already loaded) — no new font imports
- No external libraries — pure HTML/CSS/JS
- All three screens are in the DOM at page load (no lazy loading needed — they're tiny)

---

## What Is NOT in Scope

- Real app data — all content is hardcoded dummy data
- Tap/click interactivity on the phone screens themselves
- Video or GIF assets
- Any changes outside the `#app-promo` section

---

## Files Changed

- `marketing/index.html` — only file modified (CSS + HTML + JS all inline)
