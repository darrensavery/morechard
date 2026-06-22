# Spend / Save / Give Jars — Design Spec
**Date:** 2026-06-22  
**Status:** Approved for implementation planning

---

## Overview

Children accumulate earnings in a single available balance today. This feature introduces an optional **three-jar allocation layer** (Spend / Save / Give) that sits above the immutable ledger, teaching the 70/20/10 split principle from the AI Literacy Matrix (Level 2 · Sapling).

Jars are a derived view over the existing balance — the ledger is never touched. The feature is opt-in per child, off by default, child-configured, with parent visibility via the AI Insights engine.

---

## Design Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | How does money enter jars? | Auto-split on earning (child-toggleable, percentage-set by child) |
| 2 | How does Save relate to Goals? | Save jar is the funding pool; Goals draw from it |
| 3 | Can money move between jars? | Yes — forward-only percentages, freely movable existing balances |
| 4 | How does Give work? | Parent-mediated (mirrors payout-bridge pattern); no payment rails v1 |
| 5 | Who gets jars? | Opt-in, available to all children, off by default — no age field required |
| 6 | Parent approval for % changes? | No — visibility not permission; deviation surfaced in AI Insights |
| 7 | Jar icons | Bespoke premium SVGs (not emojis) matching the premium shell aesthetic |

---

## Data Model

### New D1 Tables

#### `jar_config`
One row per child. Mutable.

```sql
CREATE TABLE jar_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT NOT NULL,
  child_id    TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,        -- 0=off, 1=on
  spend_pct   INTEGER NOT NULL DEFAULT 70,       -- must sum to 100 with save+give
  save_pct    INTEGER NOT NULL DEFAULT 20,
  give_pct    INTEGER NOT NULL DEFAULT 10,
  updated_at  INTEGER NOT NULL,                  -- Unix epoch
  UNIQUE(family_id, child_id)
);
```

#### `jar_movements`
Append-only event log. **`jar_movements` is the single source of truth for all jar balances** — including goal-earmarked amounts within Save. A jar's balance = `SUM(delta)` for that jar. Never updated or deleted.

`goal_id` links goal-related movements so the Save jar's unallocated vs. goal-earmarked breakdown is derivable from this table alone — the `goals` table is no longer involved in balance computation.

```sql
CREATE TABLE jar_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   TEXT NOT NULL REFERENCES families(id),
  child_id    TEXT NOT NULL REFERENCES users(id),
  jar         TEXT NOT NULL CHECK(jar IN ('spend','save','give')),
  delta       INTEGER NOT NULL,                  -- signed pence; negative = outflow
  kind        TEXT NOT NULL CHECK(kind IN (
                'allocation',      -- auto-split on chore approval
                'enable_seed',     -- one-off initial split wizard on first enable
                'manual_move',     -- child moves money between jars
                'spend',           -- purchase draws from Spend jar
                'give_request',    -- child requests a gift (reserves Give balance)
                'give_fulfilled',  -- parent confirms donation (finalises)
                'give_declined',   -- parent declines (balance restored)
                'goal_allocate',   -- child earmarks Save balance toward a specific goal
                'goal_deallocate', -- goal archived/deleted; earmarked amount returns to unallocated Save
                'goal_purchase'    -- goal purchased; draws from Save (replaces goal_allocate movements)
              )),
  ref_id      TEXT,               -- FK to ledger row / spending / give_request as applicable
  goal_id     INTEGER REFERENCES goals(id),  -- set for goal_allocate / goal_deallocate / goal_purchase
  note        TEXT,               -- optional (parent fulfillment message, etc.)
  created_at  INTEGER NOT NULL
);

-- Performance index — balance computation requires SUM(delta) per jar on every read
CREATE INDEX idx_jar_movements_child_jar ON jar_movements(family_id, child_id, jar);

-- Immutability triggers (mirrors ledger pattern)
CREATE TRIGGER jar_movements_no_update BEFORE UPDATE ON jar_movements
BEGIN SELECT RAISE(ABORT, 'jar_movements rows are immutable.'); END;

CREATE TRIGGER jar_movements_no_delete BEFORE DELETE ON jar_movements
BEGIN SELECT RAISE(ABORT, 'jar_movements rows are immutable.'); END;
```

#### `give_requests`
Tracks parent-mediated giving. Mirrors `payouts` pattern.

```sql
CREATE TABLE give_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     TEXT NOT NULL,
  child_id      TEXT NOT NULL,
  cause         TEXT NOT NULL,    -- free text, max 60 chars
  amount        INTEGER NOT NULL, -- pence
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK(status IN ('requested','fulfilled','declined')),
  requested_at  INTEGER NOT NULL,
  fulfilled_at  INTEGER,
  parent_note   TEXT             -- optional note on fulfilment/decline
);
```

### Schema Invariant

**SUM of all three jar balances for a child = `available` from `GET /api/balance`.** Jars partition the available balance; they never create or destroy money. The balance API remains authoritative.

`jar_movements` is the single source of truth for jar balances — including which portion of Save is earmarked for which goal. The `goals` table records goal metadata and target amounts; it is not used in balance computation.

### `insight_snapshots` Extension

Add a `jar_snapshot` JSON column to the existing `insight_snapshots` table (migration):

```json
{
  "enabled": true,
  "spend_pct": 70,
  "save_pct": 20,
  "give_pct": 10,
  "manual_move_count": 2,
  "save_raids": 0,
  "give_balance_age_days": 14,
  "auto_off_weeks": 0,
  "deviation_score": 8,
  "weeks_at_current_deviation": 1,
  "positive_streak_weeks": 3
}
```

`deviation_score`: weighted distance from 70/20/10 (0 = perfect, 100 = maximally off).  
`weeks_at_current_deviation`: consecutive-week streak at current deviation — key signal for "persistent" flagging.

---

## Mechanics

### Auto-allocation (forward-only)
- When a chore approval writes a ledger credit, the worker emits 3 `allocation` `jar_movements` splitting the credit by `spend_pct / save_pct / give_pct`.
- Rounding remainder (penny) always goes to **Spend**.
- Only fires when `jar_config.enabled = 1`.
- When jars are off, earnings remain as a single available balance (existing behaviour).

### First enable — onboarding wizard
- On toggle-on, the app presents a one-off **initial split wizard** rather than silently seeding 100% into Spend.
- The wizard shows the child's current available balance and three steppers (pre-filled at 70/20/10). The child adjusts and confirms.
- The worker validates the split sums to 100%, then writes three `enable_seed` `jar_movements` rows (one per jar) reflecting the chosen initial allocation.
- This turns the first-enable moment into an active, exciting habit-forming step rather than a silent system action — and avoids disappointing a child who has been mentally treating their balance as savings.

### Percentage changes
- Must sum to 100; any jar may be 0.
- Change is forward-only — existing jar balances are not rebalanced.
- No parent approval required.
- Mentor soft-warning displayed inline when Save < 20% or Give = 0% (not a block).

### Manual moves
- Child moves money freely between jars via the Jar Detail sheet.
- Each move writes a pair of `manual_move` jar_movements (−from, +to).
- No minimum amount; no parent gate.
- Heavy churn (≥4 moves/week) feeds the AI deviation signal.

### Spending
- A spend (existing `spending` table) draws from the **Spend jar** by default (appends a `spend` jar_movement).
- If the Spend jar balance would go negative, the child is prompted in the UI: "Your Spend jar is short — move money from Save or Give first?" They must explicitly move before the spend is submitted.
- **The backend enforces this independently:** the worker recomputes `SUM(jar_movements.delta WHERE jar='spend')` at spend time and rejects the transaction with a 400 if it would result in a negative balance. Frontend prompting is UX; backend validation is the integrity guarantee. This eliminates the race condition between balance check, UI prompt, and concurrent ledger adjustments.

### Save → Goals relationship
`jar_movements` is the sole source of truth — the `goals` table records metadata only.

- **Earmarking toward a goal:** child allocates Save balance to a specific goal → worker writes a `goal_allocate` movement (negative delta on Save for the earmarked amount is **not** how this works — earmarking is a tagging, not a debit). Actually: `goal_allocate` writes a `delta = 0` tagging row (it's a label, not a movement of funds). Save jar total is unchanged; the breakdown "unallocated vs. per-goal" is derived by grouping `goal_allocate` rows by `goal_id`.

  > **Simpler model:** track goal-earmarked amounts via `goal_id`-tagged rows rather than net deltas. The unallocated Save balance = `SUM(delta WHERE jar='save')` − `SUM(goal_allocate.amount WHERE goal active)`. Implementation to confirm exact approach during plan phase — the key constraint is that `jar_movements` alone must be sufficient to derive all figures.

- **Goal archived/deleted:** worker writes a `goal_deallocate` movement, releasing the earmarked amount back to unallocated Save.
- **Purchasing a goal:** worker writes a `goal_purchase` movement (negative delta on Save equal to the purchase amount). The Save jar balance decreases; the goal is marked REACHED.
- `goals.current_saved_pence` is retained for display purposes (progress bars, effort preview) but is not used in balance computation.

### Give flow
1. Child taps "Make a gift" in Give Jar Detail.
2. Enters cause (free text, ≤60 chars) + amount (≤Give jar balance).
3. Worker writes `give_request` jar_movement (reserves balance) + inserts `give_requests` row.
4. Parent receives notification (same channel as chore approvals).
5. Parent taps "Done — donated" → `give_fulfilled` movement, `give_requests.status = 'fulfilled'`, optional note.
   - Or "Decline" → `give_declined` movement restores balance, `status = 'declined'`.
6. Child sees fulfilment confirmation with parent's note.

---

## API Routes

All routes require JWT. Family/child scoping enforced server-side.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/jars?family_id=&child_id=` | Parent or own child | Current balances + config |
| `PUT` | `/api/jars/config` | Own child | Update enable toggle + percentages |
| `POST` | `/api/jars/move` | Own child | Manual move between jars |
| `GET` | `/api/jars/movements?family_id=&child_id=` | Parent or own child | Movement history |
| `POST` | `/api/give-requests` | Own child | Create give request |
| `GET` | `/api/give-requests?family_id=` | Parent | List pending give requests |
| `PATCH` | `/api/give-requests/:id` | Parent | Fulfil or decline |

`GET /api/balance` gains a `jars` key when enabled:
```json
{
  "available": 2300,
  "jars": {
    "enabled": true,
    "spend": 1610,
    "save": 460,
    "give": 230
  }
}
```

---

## Child UI

### Money Tab (`ChildMoneyTab.tsx`)

**Jars off (default):** tab looks exactly as today.

**Jars on:** the hero "Available to spend" becomes three jar cards in a row (stacked on small screens):

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  [SpendSVG] │ │  [SaveSVG]  │ │  [GiveSVG]  │
│    Spend    │ │    Save     │ │    Give     │
│   £16.10    │ │    £4.60    │ │    £2.30    │
└─────────────┘ └─────────────┘ └─────────────┘
```

Tap a card → **Jar Detail sheet** (bottom sheet):
- Balance + label
- Recent 5 movements with kind labels ("Earned", "Moved", "Spent", etc.)
- "Move money" button → from/to/amount form
- **Save jar only:** "My Goals" link → scrolls to Goals tab
- **Give jar only:** "Make a gift" button → give request flow

### Jar Settings Sheet

Accessible via cog icon on Money tab header.

- Toggle: "Split my earnings automatically"
- Three % steppers (Spend / Save / Give) — live sum display, error if ≠ 100
- Inline mentor soft-warning: shown when Save < 20% or Give = 0%
- "Save" button — immediate effect, no approval

### Jar Icons

Three bespoke SVG components in `app/src/components/icons/`:

- **`SpendJarIcon`** — open hand, palm up; teal accent on wrist line. Clean linework, no fill except subtle gradient.
- **`SaveJarIcon`** — stylised acorn or seedling in a vessel (Savings Grove nod without using the word on-screen). Teal base, gold highlight on seed/shoot.
- **`GiveJarIcon`** — two hands cupped together, open upward. Gold stroke, teal shadow.

All three: consistent 1.5px stroke weight, same `40×40` viewBox, accept `colour` / `size` / `className` props, support active-state animation. Designed as a matched premium set against the #0f1a14 surface.

### Parent UI

**Give Requests** section added to existing Parent approvals area:
- Pending requests listed with child name, cause, amount, date
- "Done — donated" (with optional note field) / "Decline" actions
- Completed requests visible in history

**Jar visibility** — parent can view any child's jar balances and movement history from the child detail screen (read-only).

---

## AI Mentor Signals

Jar behaviour feeds the existing weekly `insight_snapshots` engine. Signals are computed as weekly deltas (this week vs last snapshot), then passed into the Orchard Lead / Mistrz Sadu briefing prompt as a structured paragraph.

### Signal Catalogue

Ordered by priority in the briefing prompt (most actionable first):

| Priority | Signal | Threshold | Tone |
|----------|--------|-----------|------|
| 1 | **Save-jar raiding** | ≥2 Save→Spend moves in a week | Concern — goal at risk |
| 2 | **Give-jar stagnation** | Give balance > 0, no request for ≥3 weeks | Prompt to follow through |
| 3 | **Persistent allocation deviation** | `deviation_score` > 25 for ≥3 consecutive weeks | Trend conversation |
| 4 | **Auto-allocation dormancy** | `auto_off_weeks` ≥ 2 | Re-engage habit |
| 5 | **Jar-hopping churn** | `manual_move_count` ≥ 4 in a week | Indecision/gaming |
| 6 | **Give = 0% for ≥4 weeks** | `give_pct = 0` sustained | Gentle (autonomy respected) |
| 7 | **Spend impulse / hoarding** | Spend jar drained within 48h of every payout (impulse); OR Spend jar untouched for 4 weeks **and** earning was active in the same period — suppressed during school holidays or zero-earning weeks (hoarding) | Pattern observation |
| 8 | **Auto-allocation disengagement** | Turned off and not re-enabled for ≥3 weeks (distinct from never turned on) | Re-engage |
| 9 | **Readiness nudge** (jars off) | Jars never enabled + `available` > 500p for ≥3 weeks + no give requests ever | Suggest enabling |
| 10 | **Positive reinforcement** | On-target split ≥3 weeks, first gift fulfilled, goal funded from Save, positive streak | Celebrate — essential |

Each signal maps to a **Problem→Insight→Action** triplet in the briefing prompt. Only the top 2–3 signals appear in any given weekly briefing to avoid overwhelming the parent.

Signals 1–8 and 10 only fire when jars are enabled. Signal 9 fires when jars are off.

The readiness nudge (9) surfaces in the **parent** Insights briefing — the parent starts the conversation with the child, not Morechard pushing it directly to the child.

---

## Scope Boundaries (v1)

**In scope:**
- Virtual jar allocation layer
- Auto-split on earning, child-toggleable
- Child-set percentages (any split, 0 allowed)
- Manual moves between jars
- Save jar as funding pool for existing Goals
- Parent-mediated Give (no payment rails)
- AI Insights signal catalogue (all 10 signals)
- Premium SVG jar icons (matched set)
- Parent read-only jar visibility

**Explicitly out of scope (v1):**
- Real charity payment integration
- Parent approval gate on % changes
- Per-transaction jar override (allocation is by %, not per chore)
- Age-gating (family decides readiness)
- Retroactive rebalancing of pre-jar earnings

---

## Migration Plan

1. `NNNN_jar_config.sql` — `jar_config` table
2. `NNNN+1_jar_movements.sql` — `jar_movements` table + immutability triggers
3. `NNNN+2_give_requests.sql` — `give_requests` table
4. `NNNN+3_insight_snapshot_jars.sql` — add `jar_snapshot` JSON column to `insight_snapshots`

Migration numbers to be assigned at implementation time following the existing `NNNN_description.sql` convention (latest observed: 0060).
