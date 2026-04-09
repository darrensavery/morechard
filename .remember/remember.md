# Handoff

## State
Major UI refactor done: ParentDashboard header (avatar, Wi-Fi icon, cog), tab renames (Chores/Approvals/Activity), Settings moved to overlay, tab persistence via sessionStorage. ParentSettingsTab destructive rows restyled (red border + white-on-red icon), Uproot→Delete, metaphors moved to descriptions only. InsightsTab refactor in progress — instructions given but not yet coded.

## Next
1. Complete InsightsTab refactor: move gauges above briefing card, rename "In Goals"→"Allocated Savings" (mint green), glassmorphism on briefing card, carousel/feed for multi-card AI insights (Coach/Accountant/Analyst personas, Problem→Insight→Action loop).
2. AI Mentor is always visible (no toggle) — premium £19.99/yr, all insights must be actionable.
3. Commit and push when InsightsTab is done.

## Context
- AI Mentor toggle was explicitly rejected — always show the briefing card.
- Insight cards follow: Problem → Insight → Action loop.
- "In Goals" in BalanceBar → "Allocated Savings", mint green (#10b981).
- Carousel preferred over vertical stacking for multiple AI insight cards.
