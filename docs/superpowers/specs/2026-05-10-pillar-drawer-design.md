---
title: Pillar Module Drawer — Learning Lab
date: 2026-05-10
status: approved
---

## Summary

Tapping a pillar in the Life-Skills Syllabus tab of the Learning Lab reveals a drawer below the roadmap row listing that pillar's modules by name. Only one drawer is open at a time.

## Behaviour

- Each `.ll-pillar` is made clickable (button role, cursor pointer)
- Tapping opens a `.ll-pillar-drawer` inserted immediately after `.ll-roadmap`
- The drawer shows the selected pillar's modules as a vertical list
- Tapping the same pillar again closes the drawer
- Tapping a different pillar closes the current drawer and opens the new one
- Active pillar dot gets a ring (`box-shadow`) to indicate selection
- Drawer animates open with a slide-down + fade (CSS max-height transition)

## Module Data (per pillar)

| Pillar | Modules |
|--------|---------|
| 1 — Earning & Value | Effort vs. Reward *(Phase 2)*, Taxes & Net Pay, Entrepreneurship, Gig Trap vs. Salary Safety |
| 2 — Spending & Choices | Needs vs. Wants *(Phase 2)*, Scams & Digital Safety, Advertising & Influence |
| 3 — Saving & Growth | The Patience Tree *(Phase 2)*, Banking 101, Opportunity Cost, The Snowball |
| 4 — Borrowing & Debt | The Interest Trap, Credit Scores & Trust, Good vs. Bad Debt |
| 5 — Investing & Future | Stocks & Shares, Inflation, Risk & Diversification |
| 6 — Society & Wellbeing | Giving & Charity *(Phase 2)*, Digital vs. Physical Currency, Money & Mental Health, Social Comparison |

Phase 2 modules render with muted opacity and a "Coming soon" label.

## Implementation

- Module data stored as inline JS object keyed by pillar index (1–6)
- Toggle logic: ~20 lines of vanilla JS in the existing script block
- Drawer HTML injected once on first open (lazy), then shown/hidden via CSS class
- No new dependencies

## CSS classes

- `.ll-pillar` — add `cursor: pointer`, `user-select: none`
- `.ll-pillar.active` — ring on dot via `.ll-pillar-dot` box-shadow
- `.ll-pillar-drawer` — hidden by default (`max-height: 0; overflow: hidden`), `.open` class animates to full height
- `.ll-drawer-module` — single module row
- `.ll-drawer-module.phase2` — muted color + "Soon" badge
