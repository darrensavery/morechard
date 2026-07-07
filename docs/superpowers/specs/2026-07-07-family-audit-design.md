# Family Audit — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Roadmap item:** Phase 5 — "An AI-driven 'Audit' of monthly spending across all children"

## Context

Phase 5 (AI Mentor / Behavioral Nudging) roadmap checkboxes for child-facing AI
personality and spending-pattern nudges were already fully implemented (see
`worker/src/routes/child-nudges.ts`, `ChildNudgeBanner.tsx`) — the roadmap was
stale. The only two items genuinely remaining were:

1. A monthly, family-wide spending "Audit" for parents.
2. Linking seasonal events (birthdays, holidays, school trips) to Mentor advice.

Item 2 is **dropped from scope**: Morechard does not collect child date of
birth, and there is no events/calendar table anywhere in the schema, so a
genuine "seasonal" feature would only ever be generic fixed-calendar nudges —
judged too weak a version of the original idea to be worth building now.

This spec covers item 1 only: the **Family Audit**.

## Goal

Give parents a once-a-month, family-wide rollup of spending/earning/saving
behaviour across all their children, in the same Problem → Insight → Action
format as the existing weekly per-child mentor briefing, surfaced in the
parent Insights tab.

## Compliance requirement (EU AI Act, effective 2026)

Every AI-generated surface in the app must carry an explicit, visible
disclosure that the content is AI-generated. This already exists as a
precedent in `InsightsTab.tsx` (an "AI-generated" pill shown when
`briefing.source !== 'fallback'`, explicitly commented as an EU AI Act
Article 50 disclosure). This spec:

- Applies the identical pill pattern to the new Family Audit card.
- Additionally upgrades `ChildNudgeBanner.tsx`, which currently only discloses
  via footer wording ("AI coaching note" vs "Personalised coaching"), to use
  the same explicit pill component — bringing child-facing disclosure up to
  the same visual standard as the parent-facing card.

## 1. Data & schema

New migration, `family_audit_snapshots` (mirrors `insight_snapshots`):

```sql
CREATE TABLE IF NOT EXISTS family_audit_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT NOT NULL REFERENCES families(id),
  month_key           TEXT NOT NULL,  -- 'YYYY-MM'
  total_earned_pence  INTEGER NOT NULL DEFAULT 0,
  total_spent_pence   INTEGER NOT NULL DEFAULT 0,
  total_saved_pence   INTEGER NOT NULL DEFAULT 0,
  total_given_pence   INTEGER NOT NULL DEFAULT 0,
  flagged_child_id    TEXT REFERENCES users(id),
  flagged_pillar      TEXT,
  observation         TEXT,   -- Problem
  behavioral_root     TEXT,   -- Insight (names the Pillar)
  the_action          TEXT,   -- Action (specific, parent-facing)
  source              TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_audit_month
  ON family_audit_snapshots (family_id, month_key);
```

One row per family per calendar month. Cache-on-read, same convention as
`insight_snapshots`.

## 2. Backend: `GET /api/family-audit?family_id=`

- Parent-only auth (403 for `role === 'child'` — matches the existing
  sibling-privacy rule already enforced in the weekly briefing's family
  context block).
- `month_key` is always the current calendar month — no query param.
- Aggregates, across every child in the family, for the month:
  - `total_earned_pence` (ledger credits)
  - `total_spent_pence` (spending table)
  - `total_saved_pence` (goal_contributions)
  - `total_given_pence` (jar_movements where jar = 'give')
  - per-child consistency score / planning horizon, reusing the same SQL
    shapes already in `insights.ts`
- Picks the **flagged child**: run the same Pillar priority ladder used in
  `buildRuleBasedBriefing` (Pillar 5 surplus → Pillar 3 opportunity cost →
  Pillar 1 labour value → Pillar 2 delayed gratification → Pillar 4 default)
  per child, independently; take whichever child matches the
  highest-priority Pillar. With one child, that child is always the subject
  — no cross-child comparison language is used in that case.
- Cache check on `(family_id, month_key)`:
  - **Hit** → return cached row instantly, `source` as stored.
  - **Miss** → call `gpt-4o-mini` with a new system prompt (same We-voice,
    same Pillar/Literacy-Matrix grounding, explicitly framed as family-wide
    not per-child, same strict JSON schema), 10s timeout, same
    `captureAiGeneration` tracing as the weekly briefing. On error/timeout,
    fall back to a new `buildRuleBasedFamilyAudit()` deterministic generator
    (same shape/tone as `buildRuleBasedBriefing`, scoped to the flagged
    child + family totals). Persist whichever result to the cache row.

## 3. Frontend

New `FamilyAuditCard` component, rendered in `InsightsTab.tsx` above the
existing per-child selector. Same `PremiumShell` / `MentorAvatar` /
`ProBadge` visual system as the weekly card. Fetched once per `InsightsTab`
mount (family-scoped, not re-fetched on child-selector change).

Contents:
- Header: "This Month, Family-Wide" + **AI-generated pill** (shown whenever
  `source !== 'fallback' /* rule_based counts as non-disclosed since it's
  deterministic template text, not model output */`).

  Note: unlike the weekly briefing (which treats `cache` as still
  AI-authored and shows the pill), this endpoint's `source` values are only
  `'ai'` or `'rule_based'` — the pill shows for `'ai'` only.
- Compact stat row: the four totals (earned/spent/saved/given) for the
  month so far.
- Problem → Insight → Action prose (`observation` / `behavioral_root` /
  `the_action`), no section headers — matches existing card style.

## 4. ChildNudgeBanner disclosure upgrade

Replace the current footer wording-based disclosure:
```
✦ Your Orchard Mentor · {nudge.source === 'ai' ? 'AI coaching note' : 'Personalised coaching'}
```
with the same explicit pill component used in `LiveBriefingCard`
(`InsightsTab.tsx`), shown in the header row next to the pillar label,
visible whenever `nudge.source === 'ai'`. Since nearly all current nudges are
`rule_based` (see `child-nudges.ts` — `generateChildNudge` always inserts
`source = 'rule_based'`), the pill will rarely show today, but the mechanism
is now in place and consistent for any future AI-authored nudge content.

## 5. Edge cases

- **Single-child family:** works unchanged — the "flagged child" is simply
  that child, narrated without comparison language.
- **No completions yet this month:** card doesn't render (same as
  `mentor_briefing` being `null` during Discovery Phase).
- **Family created mid-month:** aggregates are naturally smaller; no special
  handling needed.

## Out of scope

- Seasonal event linking (birthdays/holidays/school trips) — dropped, see
  Context above.
- Any change to the existing weekly per-child briefing logic.
- PDF/export tie-in (belongs to Phase 6 Legal Integrity Bundle).
