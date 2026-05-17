# Gamification System — Design Spec
**Date:** 2026-05-17  
**Status:** Approved — ready for implementation planning

---

## Overview

A Duolingo-inspired gamification system that motivates children to consistently use the chore tracker, and by extension engage with Morechard's financial literacy curriculum. The system uses proven engagement mechanics (streaks, badges, celebration screens) reskinned in Morechard's brand voice and split across two age-appropriate modes.

**Core decisions:**
- Intensity: balanced — Duolingo mechanics in Morechard's voice, no casino feel or anxiety patterns
- Social: self-progress only — no leaderboards, no sibling ranking (Household Neutrality)
- Mode-aware: Seedling view (ages ~10–13) and Professional view (ages ~14–16) have distinct tone and visual treatment for the same underlying data
- Re-engagement: in-app only for v1; parent nudge lever as interim; push-ready architecture throughout

---

## Section 1 — Streak Mechanic

### Core rule
A streak counts **consecutive kept days**. A kept day is any calendar day on which:
1. The child had at least one chore with a **due/scheduled date**, AND
2. Every chore due that day was **parent-approved** before the day ended.

### What is excluded
- Chores with **no due date** ("anytime" chores — `unplannedChores` in the codebase) are excluded from streak gating entirely. Missing them never breaks a streak. They can still earn badges but do not gate the streak.
- Days with no scheduled chores are **neutral** — they neither extend nor break the streak.

### What constitutes a miss
A miss occurs when a chore's due date passes without parent-approved completion. Rejection counts as a miss. Late completion pays out in the ledger but does not retroactively save the streak.

### Approval lag rule
Streak credit attributes to the **chore's due date**, not the parent's approval timestamp. A child is never penalised for a parent's approval delay.

### Streak display
- **Seedling view:** rendered as a living growth visual — a tree/plant that advances through growth stages driven by streak length and current season.
- **Professional view:** an explicit "N-day streak" with a teal progress ring + rolling **Consistency Score %** (trailing-30-day kept ratio, aligned to the existing `consistency` KPI in the Insights engine — not a new metric).

### Consistency Score formula
`kept_days ÷ scheduled_chore_days (last 30 calendar days) × 100`  
A "scheduled chore day" is any day that had at least one chore with a due date. Days with no scheduled chores are excluded from both numerator and denominator.

---

## Section 2 — Grace Days ("Rain Days" in Seedling view)

Grace Days are the anxiety-cap — they prevent a single missed day from resetting a meaningful streak to zero. They are **earned, never bought** (no monetisation, no casino mechanic).

### Earning
- **+1 Grace Day** for every **7 consecutive kept days**.
- **Hard cap: 2 Grace Days** at any time. Once at 2, the counter stays full and shows a "full" state in the UI.

### Using
- Auto-applied silently when a miss would break the streak (no child action needed).
- Triggers the `GRACE_DAY_USED` celebration ("A rain day saved your streak!" in Seedling / "Grace day applied." in Professional) — Standard tier.

### Replenishing
Grace Days are renewable. Using one does not permanently reduce capacity. After spending a Grace Day, the child earns it back by keeping the next 7-day run.

### Child-facing explanation (Seedling)
> "Every week you keep your streak going, you earn a Rain Day. If you miss a day, a Rain Day saves you automatically — you keep your streak. You can save up to 2 at a time and earn them back by keeping going."

---

## Section 3 — Badge System ("Almanac")

### Structure
Badges are organised into **five tracks**, each with three tiers:
- **Seedling view tiers:** Seed → Sapling → Oak
- **Professional view tiers:** Tier I → Tier II → Tier III

Every badge is tagged to a **Literacy Pillar** (1–5), which surfaces a one-line "why this matters" explanation and feeds the Insights/Mentor system.

### Tracks

| Track | Trigger data source | Literacy Pillar |
|---|---|---|
| Consistency | `child_streaks.current_streak` | Habit / discipline |
| Effort | Approved chore count from ledger | Work ethic / effort–reward |
| Saver | Goal events from goals table | Delayed gratification |
| Scholar | Learning Lab module completions | Financial literacy |
| Landmark | One-off life events | All pillars |

### Badge library (v1)

**Consistency track**
| Badge key | Trigger | Tier |
|---|---|---|
| `CONSISTENCY_3` | 3-day streak | Seed / Tier I |
| `CONSISTENCY_7` | 7-day streak | Seed / Tier I |
| `CONSISTENCY_14` | 14-day streak | Sapling / Tier II |
| `CONSISTENCY_30` | 30-day streak | Oak / Tier III |
| `CONSISTENCY_60` | 60-day streak | Oak / Tier III |
| `CONSISTENCY_100` | 100-day streak | Oak / Tier III |

**Effort track**
| Badge key | Trigger | Tier |
|---|---|---|
| `EFFORT_10` | 10 approved chores | Seed / Tier I |
| `EFFORT_25` | 25 approved chores | Seed / Tier I |
| `EFFORT_50` | 50 approved chores | Sapling / Tier II |
| `EFFORT_100` | 100 approved chores | Oak / Tier III |
| `EFFORT_250` | 250 approved chores | Oak / Tier III |

**Saver track**
| Badge key | Trigger | Tier |
|---|---|---|
| `SAVER_FIRST_GOAL` | First savings goal created | Seed / Tier I |
| `SAVER_GOAL_FUNDED` | First goal fully funded | Sapling / Tier II |
| `SAVER_NO_RAID` | Goal completed without early withdrawal | Sapling / Tier II |
| `SAVER_GOALS_3` | 3 goals completed | Oak / Tier III |

**Scholar track**
| Badge key | Trigger | Tier |
|---|---|---|
| `SCHOLAR_FIRST_MODULE` | First Learning Lab module completed | Seed / Tier I |
| `SCHOLAR_PILLAR_CLEAR` | All modules in one Literacy Pillar completed | Sapling / Tier II |
| `SCHOLAR_CURRICULUM` | Full curriculum completed | Oak / Tier III |

**Landmark track**
| Badge key | Trigger | Tier |
|---|---|---|
| `LANDMARK_FIRST_SPROUT` | First ever approved chore | Seed / Tier I |
| `LANDMARK_FIRST_PAYDAY` | First payday | Seed / Tier I |
| `LANDMARK_PERFECT_MONTH` | Every scheduled-chore day kept in a calendar month | Oak / Tier III |
| `LANDMARK_ONE_YEAR` | Account anniversary (1 year since first approved chore) | Oak / Tier III |
| `LANDMARK_GRADUATION` | App-view graduation (existing) | Oak / Tier III |

### Almanac browse screen
The collection surface where all earned and locked badges are displayed.

- **Seedling view:** botanical field guide aesthetic — warm parchment, illustrated badge marks
- **Professional view:** achievements ledger-grid — clean, tabular, fintech-precise

**Locked badges** are visible as silhouettes with:
- Their unlock requirement shown in plain text (e.g., "Complete 25 chores")
- A progress indicator (e.g., "17 / 25") sourced from live data — no stored progress column

### Pillar tie-in
Each badge definition includes a one-line `pillar_note` in both Seedling and Professional voice, surfaced below the badge detail on earn and in the Almanac. Example for `EFFORT_50`:
- Seedling: "Doing the work, even when you don't feel like it, is how you build something real."
- Professional: "Labour input is the foundation of every earned outcome. 50 reps recorded."

### Language rule
All child-facing badge names, copy, and Almanac UI must use vocabulary reliably understood by children under 12. Do not use "grove" in any child-facing string (internal identifiers are unaffected). See also: copy constraints in Section 5.

---

## Section 4 — Celebration Library

### Architecture
The celebration library **extends the existing `CelebrationEngine`** (`MilestoneOverlay` / `MilestoneConfig`) — no parallel system. Each celebration is a `MilestoneConfig` in the `achievements/` registry, referenced by key in the `MilestoneEventType` union.

Existing infrastructure reused without modification:
- `MilestoneOverlay` renderer
- `setPendingMilestone` / `consumeMilestonePending` localStorage flag pattern
- `orchard[]` / `clean[]` stage config split — new configs use these existing keys to conform to the `MilestoneConfig` TypeScript type. "Seedling/Professional" is conceptual naming only; no type change required unless a future refactor renames the union.

### Three intensity tiers

| Tier | Presentation | Frequency | Examples |
|---|---|---|---|
| Micro | Inline pill (~1s, no takeover) | Routine | Single chore approved, streak +1 tick |
| Standard | Full-screen overlay, 2 stages, ~5–7s | Meaningful milestones | Streak milestone, badge earned, goal funded, Grace Day used |
| Landmark | Full-screen overlay, multi-stage, richer | Rare, significant | First Sprout, Perfect Month, 1-Year, Full Curriculum, Graduation |

**Anti-fatigue principle:** Micro tier handles routine wins. Standard and Landmark are reserved so they remain meaningful.

**Priority & queuing rule:** A single approval may trigger multiple celebrations (e.g. streak milestone + badge earned simultaneously). Resolution:
- If events are different tiers: queue only the highest-tier event.
- If events are the same tier: queue all of them FIFO — they show on consecutive dashboard mounts, one per open. Never discard an earned celebration.

### Celebration animation spec

**All Standard and Landmark screens:**
1. Screen mounts; flash fires — a radial white/gold burst from centre that scales up and fades within ~250ms (party-popper feel).
2. Leaf-shaped confetti spawns near top-centre and falls once with horizontal drift and rotation, staggered over ~2.6–4s. Non-looping (`animation-iteration-count: 1`, `fill-mode: forwards`).
3. Leaf colours: Grove Teal `#00959c`, teal-light `#3fcf9b`, Harvest Gold `#e6b222`, gold-light `#ffe39a`, deep teal `#1d8f6f`.
4. Animation is CSS/transform-only. No new library dependency.

**Professional view streak milestone screens — ring choreography (Duolingo-style):**
1. Screen mounts; ring is empty; number shows the **previous** streak value; copy is hidden.
2. After 150ms: teal SVG arc sweeps from 0°→360° over 1.3s (`stroke-dashoffset` transition, `cubic-bezier(.45,.05,.3,.1)` ease).
3. On arc close (~1.45s): flash burst fires, number rolls from previous→new value via rAF count-up tween (480ms, ease-out), a green "+1" floats upward and fades, leaf confetti falls.
4. Copy and Consistency Score fade in 180ms after the number lands.

**Seedling view streak milestone screens:**
- Growth medallion (custom SVG: gradient leaf-form tree, gold fruit detail, sparkle star, teal/gold ring frame) replaces the text-only ring.
- "N days in a row" pill counts up on the same beat as the Professional number roll (simpler pill — no ring sweep, just the confetti entrance and number tick).

### Persona and copy rules

| View | Persona attribution | Tone |
|---|---|---|
| Seedling | "— Your Friendly Guide 🍎" | Encouraging, simple, concrete. Nature emojis (🌱🍎⭐). One idea per stage. |
| Professional | No attribution | Precise, direct, respectful. No persona sign-off — copy stands alone. |

Copy must use **Process Language** throughout ("You showed up"; "Every task cleared") — never Outcome Language that induces anxiety.

Child-facing copy must avoid: "grove", "orchardist", any word not reliably understood by a child under 12. Internal code identifiers (grovePlans, SavingsGrove) are unaffected.

### v1 celebration event library

| Key | Tier | Trigger |
|---|---|---|
| `FIRST_SPROUT` | Landmark | First ever approved chore |
| `STREAK_3` | Standard | 3-day streak |
| `STREAK_7` | Standard | 7-day streak |
| `STREAK_14` | Standard | 14-day streak |
| `STREAK_30` | Landmark | 30-day streak |
| `STREAK_60` | Landmark | 60-day streak |
| `STREAK_100` | Landmark | 100-day streak |
| `GRACE_DAY_USED` | Standard | Auto-applied Rain Day absorbed a miss |
| `PAYDAY_REACHED` | Standard | First payday (declared in types.ts, not yet built) |
| `GOAL_COMPLETED` | Standard | Goal purchased (declared in types.ts, not yet built) |
| `SAVER_FIRST_GOAL` | Standard | First savings goal created |
| `SAVER_GOAL_FUNDED` | Standard | First goal fully funded |
| `EFFORT_25` | Standard | 25 approved chores |
| `EFFORT_50` | Standard | 50 approved chores |
| `EFFORT_100` | Landmark | 100 approved chores |
| `SCHOLAR_FIRST_MODULE` | Standard | First Learning Lab module completed |
| `SCHOLAR_PILLAR_CLEAR` | Landmark | Full Literacy Pillar cleared |
| `SCHOLAR_CURRICULUM` | Landmark | Full curriculum completed |
| `PERFECT_MONTH` | Landmark | Every scheduled-chore day kept in a calendar month |
| `ONE_YEAR` | Landmark | 1-year anniversary of first approved chore |
| `GRADUATION` | Landmark | App-view graduation (existing — already built) |

**Queuing:** See priority & queuing rule above. All queued events dequeue one-per-dashboard-mount via `consumeMilestonePending`.

---

## Section 5 — Data Model (D1)

Two new tables added via a single D1 migration. No other storage backend.

### `child_streaks` (one row per child)

```sql
CREATE TABLE child_streaks (
  child_id              TEXT PRIMARY KEY REFERENCES kids(id),
  current_streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak        INTEGER NOT NULL DEFAULT 0,
  last_kept_date        TEXT,            -- ISO date (YYYY-MM-DD)
  grace_days_available  INTEGER NOT NULL DEFAULT 0 CHECK (grace_days_available <= 2),
  grace_days_used_total INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL
);
```

### `child_badges` (one row per earned badge)

```sql
CREATE TABLE child_badges (
  id         TEXT PRIMARY KEY,
  child_id   TEXT NOT NULL REFERENCES kids(id),
  badge_key  TEXT NOT NULL,
  tier       TEXT NOT NULL,  -- SEED | SAPLING | OAK
  earned_at  TEXT NOT NULL,
  UNIQUE (child_id, badge_key)
);

CREATE INDEX idx_child_badges_child ON child_badges(child_id);
```

### Progress derivation
Badge progress is computed on-demand from existing tables (approved chore count from ledger, goal count from goals, module count from curriculum progress). No stored progress column — avoids sync drift.

### Streak evaluation — two triggers

**Trigger 1: Parent approval** (`POST /api/jobs/:id/approve`)  
After writing the ledger entry:
1. Check if every chore due on this chore's due date is now approved.
2. If yes → kept day:
   - Increment `current_streak`, update `longest_streak` if exceeded, set `last_kept_date`.
   - Grace Day earning: if `current_streak % 7 === 0` and `grace_days_available < 2` → increment `grace_days_available`.
   - Badge check: query all badge trigger conditions for this child; write any newly earned badges to `child_badges`.
   - Celebration queue: call `setPendingMilestone(type)` for the highest-priority earned event.
3. Write `child_streaks`.

**Trigger 2: Child dashboard load** (`GET /api/dashboard`)  
After fetching child data:
1. Identify any scheduled-chore days between `last_kept_date` and today that have passed without full completion.
2. If missed days found:
   - If `grace_days_available > 0`: decrement, queue `GRACE_DAY_USED` celebration, do not reset streak.
   - If `grace_days_available === 0`: reset `current_streak` to 0.
3. Write `child_streaks` if changed.

**Architecture note:** This lazy evaluation (on open) is correct for v1 in-app. When Phase 8 push arrives, a Cloudflare Cron supplements it so the streak-at-risk notification fires proactively. Schema and logic are identical — only the trigger changes.

### Celebration pending flags
`localStorage` flags (`mc_milestone_*`) for v1, consistent with the existing `setPendingMilestone`/`consumeMilestonePending` pattern. Move to a D1 column when push is added (server must know what to push).

---

## Section 6 — Parent-Side Visibility & Nudge Lever

### Streak chip (parent dashboard)
Added to the existing child name/balance card in the parent view. Shows:
- Current streak length
- State indicator: **green** (active + recent) / **amber** (a scheduled-chore day is ending today, nothing approved yet) / **grey** (streak broken)
- Grace Days remaining: `2 rain days saved` / `1 rain day left` / `No rain days left`

### Nudge lever
When the amber state is active, a **"Remind [Child's name]"** button appears. Tapping opens a **Smart Copy sheet** (reusing the Payment Bridge sheet pattern) with a pre-written message the parent pastes into WhatsApp/SMS:

**Seedling voice:**
> "Hey — you've got jobs to do today! Your [N]-day streak is on the line. Don't lose it 🍎"

**Professional voice:**
> "Chores due today. [N]-day streak at risk — don't let it drop."

No automation, no push, no new infrastructure. The parent sends via their own channel. This becomes redundant once Phase 8 push is live.

### Co-parent consistency
Both parents in a co-parenting household see identical streak data — derived from the shared immutable ledger. No extra work required.

---

## Section 7 — Scope

### v1 (all of the above, ships together)
- D1 migration: `child_streaks` + `child_badges`
- Streak evaluation on parent approval + dashboard load
- Grace Day mechanic
- Full celebration library (21 event types, 3 tiers)
- Ring sweep + number roll animation (Professional streak screens)
- One-shot flash + leaf-confetti entrance (all Standard + Landmark screens)
- Seedling growth medallion (custom SVG)
- Micro toast for routine chore approvals
- Badge Almanac browse screen (Seedling botanical / Professional ledger-grid)
- All five badge tracks including Scholar and Landmark (Perfect Month, 1-Year)
- Pillar-tagged "why this matters" copy on every badge
- Parent streak chip (green/amber/grey) + "Remind" Smart Copy nudge

### Deferred
- **Push notifications** — Phase 8 per roadmap. Architecture is push-ready (schema + logic unchanged; only trigger shifts from lazy/on-open to Cloudflare Cron).

---

## Open items for implementation planning
- Confirm `kids` table primary key column name (needed for FK in `child_streaks`).
- Confirm existing `POST /api/jobs/:id/approve` route location in worker source.
- Confirm Learning Lab module completion event hook location (for Scholar badge triggers).
- Perfect Month badge: define whether "calendar month" means the month just ended (evaluated on the 1st of the following month) or a rolling 30-day window — recommend calendar month for clarity.
