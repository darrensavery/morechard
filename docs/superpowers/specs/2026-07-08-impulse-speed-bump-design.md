# Impulse Speed Bump — Design

**Date:** 2026-07-08
**Status:** Approved, pending implementation plan
**Roadmap ref:** Phase 5, "Implement AI 'Nudges' based on spending patterns" (`CLAUDE.md`)
**Source doc:** `docs/notebooklm/02-ai-personality.md` §9, "Mechanical Triggers (Subscription-Grade Interventions)" — *"The Impulse Speed Bump (Spending > 15% of Balance)"*

## Background

The child-facing AI Mentor nudge system (`worker/src/routes/child-nudges.ts`) already covers most of Phase 5's spending-pattern nudges via a weekly CRON sweep (`spend_heavy`, `repeat_spend_category`, `idle_balance`, etc.) plus event-driven milestones. The one trigger spec'd in `ai-personality.md` §9 that has no implementation is the **Impulse Speed Bump** — a real-time reflection prompt shown *at the moment* a child logs an unusually large spend, not on a weekly delay. This is the gap this spec closes.

The other two §9 triggers (Velocity Alert, Parental Loan Modeller) are out of scope — separate features, separate specs.

## Trigger condition

Evaluated client-side, synchronously, when a child taps "Save spend →" in `SpendGuideSheet.tsx` — **after** the existing form validation (`title` non-empty, `pence > 0`) already run by `handleSave()` today. A mistyped amount that fails that validation shows the existing inline error and never reaches the threshold check at all.

```
availableBalancePence >= 500        // £5 floor — skip the check entirely below this
  AND
spendAmountPence > 0.15 * availableBalancePence
```

The £5 floor is a new guardrail (not in the source doc, which just says ">15% of balance"): without it, a child with a £2 balance would get interrupted on every £0.31 spend, which is noise, not coaching.

`availableBalancePence` is `BalanceSummary.available`, already fetched by `ChildMoneyTab` via `getBalance()`. `ChildMoneyTab` will pass it down to `SpendGuideSheet` as a new required prop (`availableBalancePence: number`), alongside the existing `appView` prop it already holds but doesn't currently forward to this component.

## UX flow

On threshold trip, `handleSave()` does **not** call `logSpend` immediately. Instead the amount sub-sheet is replaced by a new interstitial view within the same sheet (no extra route/screen):

- **Orchard tone:** "We've noticed this harvest is very large! If you keep these seeds instead, your grove keeps growing. Are you sure?"
- **Clean tone:** "This is 15% of your available balance. Our data shows that delaying big spends by 48 hours usually feels better later. Shall we pause?"
- Two actions:
  - **"Wait a bit"** — closes the sheet without saving. The child can return and log it later (or not). This is the whole mechanism for the "48-hour cooldown" — there is no timer or re-prompt; it relies on friction, not enforcement, per the guardrail against outcome-pressuring language.
  - **"I'm sure, log it"** — proceeds to call `logSpend` exactly as today.
- No specific goal is referenced (the source doc's Orchard example name-checks "your Great Tree goal"). `SpendGuideSheet` doesn't currently load goal data and adding that fetch for a single copy line isn't worth the coupling — the generic "your grove keeps growing" phrasing carries the same idea.
- Both interstitial copy strings must be short enough to sit comfortably above the two action buttons without pushing them off-screen on small devices (this sheet is capped at `max-h-[88%]` like the amount sub-sheet it replaces) — implementation should sanity-check both on a small viewport (e.g. iPhone SE / 375×667) before merging, not just the two happy-path devices.

## Audit trail

Fire-and-forget a `child_nudges` row via the existing `generateChildNudge(db, child_id, family_id, 'impulse_speed_bump', meta)` helper — same helper every other trigger in `child-nudges.ts` uses, just called from a new code path (a new endpoint) instead of `checkPatterns()`.

The row is written once the child **acts on** the interstitial — taps either "Wait a bit" or "I'm sure, log it" — not when the interstitial merely appears. This means one call carries the outcome directly, instead of a "shown" event that can never learn what happened next (an earlier draft of this spec logged on-shown and considered a follow-up patch call for the outcome; recording on-action instead gets the same data in one round trip). If the child abandons the sheet without tapping either button, no row is written — an acceptable gap, not worth a `beforeunload`/visibility hook to close.

New `NUDGES['impulse_speed_bump']` entry:
```ts
impulse_speed_bump: {
  screen: 'money', pillar: 'OPPORTUNITY_COST', tone: 'honest',
  parent_summary: 'Large spend flagged — impulse cooldown shown',
  orchard: "We've noticed this harvest is very large! If you keep these seeds instead, your grove keeps growing. Are you sure?",
  clean:   'This is 15% of your available balance. Delaying big spends by 48 hours usually feels better later. Shall we pause?',
},
```

This is screen-throttle-exempt (uses `generateChildNudge`, not `maybeGenerateChildNudge`) — matching how event-driven triggers like `jar_raid` already behave, since this is a per-event trigger, not a background pattern.

`meta` carries `{ amount_pence: spendAmountPence, balance_pence: availableBalancePence, outcome: 'waited' | 'proceeded' }`. The `outcome` field is what makes this row useful for product analytics later (conversion rate of the friction point — did it actually change behaviour) and for a future parent-facing audit view; no UI reads it yet, but the `trigger_meta` column already exists and every other trigger populates it where relevant.

## Endpoint change

The trigger condition itself is computed entirely client-side (`availableBalancePence` from `getBalance`, spend amount from the form) — no endpoint needed for that. The only new server-side work:

1. Add `impulse_speed_bump` to the `NUDGES` dict in `child-nudges.ts`.
2. New endpoint `POST /api/child-nudges/impulse-outcome`, body `{ child_id, family_id, amount_pence, balance_pence, outcome: 'waited' | 'proceeded' }`, calling the already-exported `generateChildNudge(..., 'impulse_speed_bump', meta)`. This is a thin wrapper, not a reimplementation — it keeps the `NUDGES` content library and D1 writes server-side rather than exposing them to the client.
3. `SpendGuideSheet` calls this endpoint (fire-and-forget) when either interstitial button is tapped, then either closes (`Wait a bit`) or proceeds to `logSpend` (`I'm sure, log it`) as already described above.

## Non-goals

- No subscription/tier gating — matches existing precedent (no child nudge in the current system checks AI Mentor subscription status).
- No goal-specific copy personalization.
- No literal 48-hour re-prompt/timer — "Wait a bit" just closes the sheet.
- No changes to `LogSpendSheet.tsx` — that component appears to be dead code (not imported anywhere); `SpendGuideSheet.tsx` is the live spend-logging surface.
