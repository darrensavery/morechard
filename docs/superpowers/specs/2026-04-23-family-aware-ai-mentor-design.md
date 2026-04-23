# Family-Aware AI Mentor — Design Spec
**Date:** 2026-04-23  
**Branch:** feat/plan-management-redesign  
**Status:** Approved for implementation

---

## Problem

Every AI-generated string in the Morechard mentor surfaces assumes a generic family: "The kids are all caught up!", "both parents", sibling-agnostic copy. A family with one child and a single parent sees the same phrasing as a co-parenting household with three children. This breaks the "bespoke household member" positioning that justifies the £19.99/year AI Mentor add-on.

---

## Goal

Make every AI-generated and fallback string dynamically adjust to actual family composition — queried from the DB at call time — with no hardcoded assumptions about child count, parent count, or parenting mode.

---

## Scope

Three surfaces:

1. **`worker/src/lib/intelligence.ts`** — new `getFamilyContext()` export
2. **`worker/src/routes/chat.ts`** — child chat system prompt
3. **`worker/src/routes/insights.ts`** — parent briefing (AI + rule-based fallback)
4. **`app/src/components/dashboard/HistoryTab.tsx`** — empty-state `MentorEmptyCard` (client-side only, no AI call)

---

## The `FamilyContext` Object

```typescript
interface FamilyContext {
  parenting_mode:   'single' | 'co-parenting'
  child_count:      number
  child_names:      string[]     // first names of all children in the family
  parent_names:     string[]     // first names of lead + all co-parents
  family_name:      string       // families.name, e.g. "The Savery Family"
  co_parent_active: boolean      // both parents approved ≥1 chore in last 30d
  approval_skew:    number | null // % of approvals by most-active parent (last 30d)
                                  // null when single parent or <5 total approvals
}
```

Built by `getFamilyContext(db: D1Database, familyId: string): Promise<FamilyContext>` in `intelligence.ts`. Three parallel D1 queries:

1. `families` — `parenting_mode`, `name`
2. `family_roles JOIN users` — parent display names (lead + co_parent roles)
3. `users WHERE family_id = ? AND role = 'child'` — child display names

**Fallback values when data is missing:**

| Missing data | Fallback string |
|---|---|
| Child name | `"your child"` |
| Co-parent name | `"your partner"` |
| `family_name` empty | `"the family"` |
| `child_count = 0` | treat as 1, suppress sibling logic |

---

## System Prompt Injection Rules

`FamilyContext` is serialised as a `FAMILY CONTEXT` block injected at the top of every AI system prompt, before child behavioural data.

### Hard rules — all locales, all surfaces

- **Never say "the kids"** — use child's name or "your child"
- **Never say "both parents"** when `parenting_mode = 'single'`
- **No sibling comparisons** — never use one child's progress to benchmark another
- **No goal specifics across siblings** — reference completion events only ("finished their goal"), never goal names or amounts from another child's record
- **No age comparisons** — age is not stored; never infer or reference it

### Co-parenting rules (`parenting_mode = 'co-parenting'`)

- Address "both of you" or name both parents when contextually relevant
- **Collaboration nudge:** if `approval_skew > 80` AND `co_parent_active = true`, surface one soft suggestion per briefing — observation framing only ("We've noticed most approvals have come from one parent recently — your co-parent might enjoy being more involved this week"). Never a directive.
- **No nudge** when `co_parent_active = false` — avoid implying the absent parent is slacking
- **Shield plan:** when `has_shield = true`, co-parent names are used consistently and deterministically (feeds audit PDF). Collaboration nudges are suppressed on Shield — audit impartiality requires strictly neutral language.

### Sibling rules — child chat only (`child_count > 1`)

- May reference siblings **only** for shared/team milestones ("great week for the Orchard")
- Positive-only: celebrate together, never compare
- Never disclose another child's goal name, target amount, or progress percentage
- When `child_count = 1`: sibling block omitted from prompt entirely

---

## Surface Changes

### 1. `intelligence.ts` — `getFamilyContext()`

New exported async function. Takes `db` and `familyId`. Runs three parallel queries, returns `FamilyContext`. Called at the top of `handleChildChat` and `handleInsights` alongside existing intelligence queries.

`getChildIntelligence()` signature unchanged — `FamilyContext` is a separate concern and passed independently to prompt builders.

### 2. `chat.ts` — Child Chat

- `handleChildChat` calls `getFamilyContext(env.DB, auth.family_id)` in parallel with `getChildIntelligence`
- `buildSystemPrompt(intel, pillar)` gains a third parameter: `familyCtx: FamilyContext`
- Each locale prompt (`buildUKPrompt`, `buildUSPrompt`, `buildPLPrompt`) receives the `FAMILY CONTEXT` block and sibling rules when `child_count > 1`
- Sibling block is suppressed entirely when `child_count = 1`

### 3. `insights.ts` — Parent Briefing

- `handleInsights` calls `getFamilyContext` in parallel with existing queries
- `generateBriefing()` and `buildRuleBasedBriefing()` both receive `FamilyContext`
- `buildSystemPrompt` in insights gains the `FAMILY CONTEXT` block + co-parent phrasing rules
- All eight `buildRuleBasedBriefing` branches updated: child name substituted, co-parent references added where applicable, Pillar 5 (Social Responsibility) gains a sibling team-line when `child_count > 1` ("The whole Orchard is thriving")
- Collaboration nudge logic added as a post-processing step on the rule-based fallback (not inside individual branches)

### 4. `HistoryTab.tsx` — `MentorEmptyCard`

Client-side only. No AI call. Already receives `childCount` prop (added in previous session).

- Single child: `"[Name] is all caught up! 🎉"` + personal body copy
- Multiple children: `"[Name] is all caught up! 🎉"` + team-flavoured body copy referencing the other tabs
- Body copy when `childCount > 1` and no `goalProgress`: `"No pending tasks for [Name] right now. Check the other children's tabs for any outstanding approvals."`

---

## What Is Not Changed

- `ChildIntelligence` interface — no new fields
- D1 schema — no new tables or columns
- The `insight_snapshots` caching logic — `FamilyContext` is not cached (it's lightweight and changes infrequently, but must be fresh)
- Shield PDF export route — co-parent names already flow from the DB; this spec ensures the AI briefing language matches

---

## Fallback Chain

Every surface has two layers of fallback:

1. **AI call fails → rule-based briefing** — `buildRuleBasedBriefing()` uses `FamilyContext` directly, so it is family-aware by construction
2. **DB query for `FamilyContext` fails** — defaults kick in (see fallback table above); the call proceeds with safe generic strings rather than crashing

---

## Testing Notes

- Single parent, one child: verify no "the kids", no "both parents", no sibling block
- Co-parent, one child: verify co-parent name appears, no sibling block
- Single parent, two children: verify sibling celebration fires in child chat, no co-parent language
- Co-parent, two children, high `approval_skew`, both active: verify collaboration nudge appears once in briefing
- Co-parent, two children, one parent inactive: verify nudge is suppressed
- Shield plan, co-parenting: verify nudge suppressed, co-parent names consistent
- Missing name in DB: verify fallback string used, no crash
