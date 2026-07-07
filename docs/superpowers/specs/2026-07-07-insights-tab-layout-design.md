# Insights Tab Layout Adjustments — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Context:** Follow-up to the Family Audit feature (see
`2026-07-07-family-audit-design.md`). After manually verifying the new
`FamilyAuditCard` in the browser, the user requested three layout
adjustments to `app/src/components/dashboard/InsightsTab.tsx` before
production deploy.

## 1. Move the period toggle into the thumb zone

**Problem:** The "This week / This month / All time" toggle currently sits
at the top of the scrollable Insights content, above `FamilyAuditCard`. The
app is mobile-first; frequently-tapped controls should sit at the bottom of
the screen, reachable by thumb, matching every other primary action in the
app.

**Solution:** Reuse the exact fixed-positioning pattern already established
by `JobsTab.tsx`'s "+ Add chore" button (`worker`-adjacent file
`app/src/components/dashboard/JobsTab.tsx:391-401`):

```tsx
<div className="fixed bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none">
  <div
    className="pointer-events-auto w-full max-w-[520px] mx-3"
    style={{ marginBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 68px)' }}
  >
    {/* toggle content */}
  </div>
</div>
```

The period toggle's existing button markup (`InsightsTab.tsx:78-93`) moves
inside this wrapper, replacing its current `<div className="flex gap-1.5 ...">`
container. No new visibility logic is needed: this JSX stays inside
`InsightsTab`, which is itself wrapped in a `tab-panel` div that becomes
`display: none` when another bottom-nav tab is active (`index.css:289`) —
a `display: none` ancestor hides `fixed` descendants too, so the toggle
correctly disappears on other tabs without extra code.

`z-20` matches `JobsTab`'s CTA (below the nav's own `z-30`), so if a future
screen ever needs both patterns simultaneously they layer correctly.

## 2. Group the two AI-generated cards together

**Problem:** `FamilyAuditCard` (family-wide, monthly) sits at the very top
of the tab. The per-child `MentorSection` card (weekly) currently renders
after `BalanceBar` and the three `SparklineCard`s inside
`InsightsDashboard` — separated from `FamilyAuditCard` by a full row of
KPI cards.

**Solution:** Reorder `InsightsDashboard`'s JSX
(`InsightsTab.tsx:125-268`) so `MentorSection` renders immediately after
the demo-account banner, ahead of `BalanceBar`. New order:

1. Demo account banner (unchanged, conditional)
2. `MentorSection` (moved up — was step 4)
3. `BalanceBar` (was step 1)
4. Sparkline cards grid (was step 2)
5. Effort preference tag (was step 3)
6. Child nudge summary (unchanged position, step 5)
7. Learning Lab section (unchanged, step 6)
8. Supporting stats (unchanged, step 7)

`FamilyAuditCard` itself stays where it is, outside `InsightsDashboard`
(rendered directly in `InsightsTab`'s return, above the loading/error/data
branch) — it already sits immediately above where `InsightsDashboard`
begins rendering, so this reorder is sufficient to put both AI cards
back-to-back with nothing between them.

## 3. Card dismissal

Out of scope for this pass. Both cards already disappear on their own when
there's no data (`FamilyAuditCard` returns `null` on `is_empty`;
`MentorSection` shows a `DiscoveryCard` instead during the discovery
phase, not a stale card) — there's no demonstrated staleness problem to
solve yet. Revisit if real usage surfaces one.

## Testing

- `FamilyAuditCard.test.tsx` and any `InsightsTab` snapshot/render tests
  are unaffected by content reordering (no test currently asserts DOM
  order between `MentorSection` and `BalanceBar`) — confirm this remains
  true after the change; add an order-assertion test only if one doesn't
  already implicitly cover it.
- No new component is introduced — this is a pure JSX reorder plus moving
  existing markup into a differently-positioned wrapper `div`. No new
  props, no new state.

## Out of scope

- Any change to `FamilyAuditCard`'s or `MentorSection`'s internal content
  or styling.
- Per-card dismiss UX (see §3).
- Changes to `ParentBottomNav.tsx` itself — the nav bar is untouched; the
  toggle is a sibling fixed element, not an addition to the nav component.
