# Discovery Card AI Upgrade — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Origin:** Follow-up noted during Family Audit build — the parent Insights
tab's `DiscoveryCard` (`InsightsTab.tsx:425-492`, shown while
`is_discovery_phase`) is 100% static template text with only `{name}`
interpolated. Every family sees the identical intro paragraph and the same
hardcoded 3-step action list, even if they've already done some of it.

## Goal

Make the Discovery card genuinely AI-generated, in the same
Orchard-Mentor / Problem-Insight-Action pattern as the weekly per-child
briefing and the Family Audit — grounded in whatever *setup* signal exists
before there's enough completion data for real behavioural coaching.

## 1. What signal exists during Discovery Phase

`is_discovery_phase` = `allTimeCompleted < 3 || daysSinceFirst < 7`. At this
point there's no meaningful behavioural data, but there is real *setup*
state, all queryable today:

- Chore count assigned to the child (`chores` where `assigned_to = child_id`)
- Whether any assigned chore has `proof_required = 1` (photo check-in)
- Whether the child has an active goal (`goals` where `child_id = ? AND archived = 0`)
- Whether jars are enabled (`jar_config.enabled`)
- Family context (siblings, parenting mode) — for tone only, not gating

## 2. Data & caching

New migration `0077_discovery_briefings.sql`:

```sql
CREATE TABLE IF NOT EXISTS discovery_briefings (
  child_id         TEXT PRIMARY KEY REFERENCES users(id),
  family_id        TEXT NOT NULL REFERENCES families(id),
  setup_signature  TEXT NOT NULL,
  intro            TEXT NOT NULL,
  actions          TEXT NOT NULL,   -- JSON array, up to 3: [{ "text": "..." }]
  source           TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
```

One row per child. `setup_signature` is a short deterministic string built
from the four setup facts above (e.g. bucketed chore count + 3 booleans),
not a cryptographic hash — just enough to detect "something relevant
changed."

On every `GET /api/insights` call while `is_discovery_phase`:
1. Query the four setup facts live (cheap, already-indexed lookups).
2. Compute `setup_signature`.
3. Read the cached `discovery_briefings` row for this child.
   - **Match** → return cached `intro`/`actions`/`source` instantly.
   - **Missing or signature differs** → regenerate (§3), `INSERT OR
     REPLACE` the row, return the new content.

This means the card updates itself the next time a parent opens Insights
after adding a goal, turning on photo check-in, or assigning more chores —
without polling or a background job.

## 3. Generation

New `worker/src/lib/discoveryBriefing.ts` (pure logic, mirrors
`familyAudit.ts` — testable without a D1 binding):

- A candidate action menu, each gated on whether it's already satisfied:
  - `ASSIGN_MORE_CHORES` — fires when chore count < 3
  - `SET_A_GOAL` — fires when no active goal exists
  - `ENABLE_PHOTO_CHECKIN` — fires when no assigned chore has `proof_required = 1`
- `buildRuleBasedDiscoveryBriefing()` — deterministic fallback: one sentence
  per outstanding candidate (up to 3), or if none are outstanding, a single
  "you're fully set up, I just need a few completions" message. This is also
  what renders for a brand-new child with zero chores assigned (single
  "assign chores" action, not padded to 3).

`insights.ts` gets `generateDiscoveryBriefing()`, called only on cache
miss/signature-change:
- `gpt-4o-mini`, same Orchard Lead persona and Literacy-Matrix grounding as
  the weekly briefing, JSON-strict response format, 10s timeout.
- Prompt is given only the *outstanding* candidates (not the satisfied
  ones) plus the family context block (reused from
  `buildInsightsFamilyBlock`) and child name — so the model can't
  accidentally suggest something already done.
- Response schema: `{ "intro": "<1-2 sentences>", "actions": ["<up to 3
  strings, one per outstanding candidate>"] }`.
- Same `captureAiGeneration` tracing as the other two AI surfaces.
- On error/timeout → `buildRuleBasedDiscoveryBriefing()`, `source: 'rule_based'`.

## 4. Frontend

`DiscoveryCard` (`InsightsTab.tsx`) reads `data.discovery_briefing.intro` and
`.actions` instead of the two hardcoded paragraphs and fixed 3-item list.

- `<AiDisclosurePill />` shown next to the "Orchard Mentor" label whenever
  `source === 'ai'` — identical placement/condition to `LiveBriefingCard`
  and the Family Audit card (EU AI Act Article 50 disclosure consistency,
  per the Family Audit spec).
- `DiscoveryAction` list renders 1–3 items from the array (today it always
  renders exactly 3).
- Progress ring (`{completed}/3`) and `ProBadge` are unchanged — they're
  reading `all_time_completed`, not the briefing.

## Edge cases

- **Zero chores assigned, brand new child:** candidate menu is
  `ASSIGN_MORE_CHORES` only → single-action card.
- **Everything already configured** (≥3 chores, a goal, photo check-in on):
  no candidates fire → intro-only message, no action list rendered.
- **AI/network failure:** falls back to deterministic text per outstanding
  candidate — never blocks the card from rendering.

## Out of scope

- Any change to the Discovery Phase *threshold* itself
  (`allTimeCompleted < 3 || daysSinceFirst < 7`).
- The progress ring / `all_time_completed` display — unchanged.
- Regenerating mid-session (e.g. via websocket) when setup changes on
  another device — the next `GET /api/insights` call picks it up, no push
  mechanism.
