# Time-Trigger Testing Guide

Morechard has features that require days, weeks, or months of real data to trigger —
Learning Lab module unlocks, streak milestones, AI nudges, and passive sweeps. This guide
explains how to test them without waiting.

---

## Two tools

| Tool | What it does | When to use |
|------|-------------|-------------|
| **SQL Seed Library** | Loads backdated DB data for a test child | Testing that triggers evaluate correctly |
| **Dev Trigger Panel** | In-browser panel to fire overlays instantly | Testing that the UI/overlay looks right |

These are independent — use either or both.

---

## SQL Seed Library

Seeds live in `worker/dev/seeds/`. Each file is a complete, self-contained scenario:
it runs `_reset.sql` + `_base.sql` then inserts backdated rows.

### Prerequisites
- Seed scripts and the dev server both target the **remote** `morechard-dev` database.
  Local D1 has schema divergence from the migration history — use remote only.
- Start the dev server with `npm run dev:remote` (not `npm run dev`) so the Worker
  reads from the same remote DB that the seeds wrote to.

### Running a seed

```bash
npm run seed:m13       # puts Alex at £100+ lifetime earnings (writes to remote morechard-dev)
npm run dev:remote     # starts worker + app connected to remote morechard-dev
```

After the seed runs, you need to trigger evaluation:
- **Event triggers** (earnings, goal events): log in as the dev test child and approve
  a chore — the approval route calls `evaluateOnChoreApproval`
- **Passive triggers** (balance, inactivity, streak): use the Dev Trigger Panel →
  Status tab → "Run Passive" button, OR wait for the nightly CRON

### Dev test account credentials

The seed scripts create a family with these IDs (these only exist in your local dev DB):

| Field | Value |
|-------|-------|
| Family ID | `fDEV000000000000000001` |
| Parent ID | `uDEV_PARENT0000000001` |
| Child ID  | `uDEV_CHILD00000000001` |
| Parent email | `dev-parent@morechard.dev` |

**You cannot log in with these IDs directly via the UI** — they have no password or session.
The seeds create rows with fixed IDs for reproducibility, but no auth records. To test
event-triggered unlocks (M2, M13, M19, M3b), you have two options:

(a) Use the **Status tab** in the Dev Panel to inspect the fixed seed child's DB state,
then use **Run Passive** to trigger passive evaluations.

(b) Swap the child ID in `worker/dev/seeds/_base.sql` to match your own dev account's
user ID before running the seed. This lets you log in normally and trigger events by
approving chores.

### Seed scenarios

| Script | What it seeds | Unlocks when |
|--------|--------------|--------------|
| `seed:m2` | £20.25 lifetime earnings | `evaluateOnChoreApproval` called → M2 |
| `seed:m8` | £31.50 balance (no payments) | Run Passive → M8 |
| `seed:m11` | 13/14 completions over 8 wks | Run Passive → M11 |
| `seed:m13` | £100.01 lifetime earnings | `evaluateOnChoreApproval` → M13 (+ M2) |
| `seed:m14` | Last transaction 22 days ago | Run Passive → M14 |
| `seed:m16` | £75.01 balance | Run Passive → M16 (+ M8) |
| `seed:m19` | £150.01 lifetime earnings | `evaluateOnChoreApproval` → M19 (+ M2, M13) |
| `seed:m3b` | 4 weeks high variance earnings | `evaluateOnChoreApproval` → M3b |
| `seed:streak7` | 7-day streak set in DB | M17 already written; fire STREAK_7 via panel |
| `seed:streak30` | 30-day streak set in DB | Badges written; fire STREAK_30 via panel |
| `seed:gaming` | 2 gaming goals | M17 + M20 pre-unlocked in DB |
| `seed:goals` | 3 goals, 1 long-term | M15 pre-unlocked in DB |

### Resetting between tests

```bash
npm run seed:reset    # wipes all is_seed=1 rows for the test child
```

### Adding a new seed scenario

1. Create `worker/dev/seeds/state-<scenario>.sql`
2. Insert backdated rows using `strftime('%s', 'now', '-N days')` for timestamps (no preamble needed — reset+base are chained by the npm script)
3. Add `is_seed = 1` on every `completions` and `ledger` row
4. Add an npm script in `package.json` that chains all three files:
   ```
   "seed:<name>": "cd worker && npx wrangler d1 execute morechard-dev --remote --file=dev/seeds/_reset.sql && npx wrangler d1 execute morechard-dev --remote --file=dev/seeds/_base.sql && npx wrangler d1 execute morechard-dev --remote --file=dev/seeds/state-<scenario>.sql"
   ```

---

## Dev Trigger Panel

The panel is a floating 🔬 button in the bottom-right corner of the child dashboard.
It only renders in Vite dev mode (`import.meta.env.DEV`) and is stripped from
production builds automatically.

### Overlays tab

Shows every `MilestoneEventType` as a button. Clicking one:
1. Pushes the event to `localStorage.mc_celebration_queue`
2. Reloads the page
3. `ChildDashboard` reads the queue on mount and shows the overlay

Use the ORCHARD / CLEAN toggle to see both app-view variants of each overlay.

**All celebration events available:**
- Streak milestones: STREAK_3, STREAK_7, STREAK_14, STREAK_30, STREAK_LOST, STREAK_REVIVED
- Consistency badges: BADGE_CONSISTENCY_SEED / SAPLING / OAK
- Effort badges: BADGE_EFFORT_SEED / SAPLING / OAK
- Saver badges: BADGE_SAVER_SEED / SAPLING / OAK
- Scholar badges: BADGE_SCHOLAR_SEED / SAPLING / OAK
- Landmark badges: BADGE_LANDMARK_SEED / SAPLING / OAK
- GRADUATION

### Status tab

Fetches `/dev/trigger-status` for the currently logged-in child and shows:
- Current balance and lifetime earnings (in £)
- Current streak and longest streak
- All unlocked Learning Lab modules
- All earned badges

**Run Passive** calls `/dev/run-passive`, which executes `evaluatePassive()` for the
current child and reports which modules were newly unlocked.

### Workflow for testing a trigger end-to-end

1. `npm run seed:m8` — loads balance ≥ £30 into dev DB for the test child
2. Log in as the test child (or swap IDs in the seed to match your dev account)
3. Open Dev Panel → Status → Run Passive
4. Panel shows `Unlocked: M8`
5. Navigate to Learning Lab — M8 (Banking 101) now appears unlocked

---

## Gotchas

**Ledger immutability:** The ledger has an UPDATE immutability trigger on financial fields.
Seeds INSERT, never UPDATE, so this is not a problem. `_reset.sql` deletes only rows where
`is_seed = 1` — this is safe because the DELETE trigger from migration 0001 was not
re-created after migration 0027 dropped and recreated the ledger table.

**Hash chain:** Seed ledger rows use placeholder hash values (`seed_m2_hash_1` etc.).
These are not real SHA-256 hashes and will fail a chain-verification audit. This is
intentional — dev seeds are for UX testing, not ledger integrity testing.

**CRON vs event:** Passive triggers (M8, M11, M14, M16, M9b) only fire when:
(a) the child opens the Learning Lab (routes/lab.ts calls `evaluatePassive`), or
(b) the nightly CRON runs. Use "Run Passive" in the Dev Panel to simulate (a)
without waiting for (b).

**Dev panel is not a real user:** `/dev/trigger-status` and `/dev/run-passive` accept
any `child_id` query param — they don't verify the child belongs to the authenticated
family. This is fine for local dev; both endpoints return 404 in production.

**Streak seeds bypass the streak engine:** `state-streak-7.sql` and `state-streak-30.sql`
directly write to `child_streaks`. The streak ENGINE (in `worker/src/lib/streaks.ts`) is
NOT called, so the server-side event queue is not populated. Use the Dev Panel's Overlays
tab to fire the STREAK_7 or STREAK_30 overlay after seeding.

---

## Quick reference

```bash
# Load a scenario and test the passive unlock flow
npm run seed:m16
# → open Dev Panel → Status → Run Passive
# → expect: Unlocked: M16

# Fire any celebration overlay instantly
# → open Dev Panel → Overlays → click BADGE_SAVER_OAK

# Reset everything and start fresh
npm run seed:reset
```
