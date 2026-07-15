# D1 Backup & Disaster Recovery Runbook

Written after a production security audit found there was no documented
backup strategy, no RTO/RPO, and no tested restore procedure for either D1
database. This closes that gap using Cloudflare D1's built-in **Time
Travel** feature — confirmed live on both databases (see verification below)
— plus a written, repeatable restore procedure.

## What we actually have (verified 2026-07-15)

Cloudflare D1 has point-in-time recovery ("Time Travel") **enabled
automatically for every D1 database** — no setup step was missing, it was
just never documented or exercised. Confirmed on production:

```bash
cd worker
npx wrangler d1 time-travel info morechard --env production
```

This returns the current restore bookmark with no configuration required.
Retention window is plan-dependent (Workers Paid plan typically retains 30
days of point-in-time bookmarks) — **confirm the exact retention on your
account** via Cloudflare dashboard → D1 → `morechard` → Settings, since the
CLI doesn't surface the retention window directly.

## RPO / RTO

- **RPO (Recovery Point Objective): ~0.** Time Travel bookmarks are
  continuous (per-write), not snapshot-interval based — you can restore to
  any point in time within the retention window, not just to a daily/hourly
  snapshot boundary.
- **RTO (Recovery Time Objective): untested, budget 15–30 minutes.** The
  restore command itself runs in seconds to low minutes depending on
  database size, but this has never been exercised end-to-end in this
  project. Treat the estimate below as unverified until a real drill is run
  (see "Open item" at the bottom).

## Restore procedure

**Never run a restore against `morechard` (production) without first
confirming with Darren** — this is a destructive, hard-to-reverse action
against the live database backing real families' financial ledgers.

### 1. Find the bookmark to restore to

If you know the approximate time of the incident:

```bash
cd worker
npx wrangler d1 time-travel info morechard --env production --timestamp="2026-07-15T14:30:00Z"
```

This returns the bookmark closest to (but not after) that timestamp. Omit
`--timestamp` to get the current bookmark (useful before making a risky
change, as a rollback point).

### 2. (Recommended) Fork to a new database first, don't restore in place

Time Travel can restore into a **brand new database** instead of overwriting
the existing one — this lets you inspect the restored data before deciding
to cut traffic over, and never destroys the current (possibly-corrupted but
possibly-still-partially-good) state:

```bash
npx wrangler d1 time-travel restore morechard --env production \
  --bookmark=<bookmark-from-step-1> \
  --name morechard-restore-check
```

Query `morechard-restore-check` to verify it looks right before doing
anything else.

### 3. Restore in place (only once verified via step 2, or in a true emergency)

```bash
npx wrangler d1 time-travel restore morechard --env production \
  --bookmark=<bookmark-from-step-1>
```

This restores `morechard` itself back to that point in time. Any writes
between the restore bookmark and "now" are lost — this is why step 2's
fork-and-verify is the safer default when there's any time to spare.

### 4. Post-restore checklist

- [ ] Confirm the Worker's `scheduled()` cron didn't fire mid-restore (would
      interleave writes with an inconsistent DB state) — check Sentry Cron
      Monitor for the window.
- [ ] Spot-check the ledger hash chain integrity on a few recently-active
      families (`GET /api/verify/:hash` / the forensic export) — a restore
      to a bookmark before a ledger write is expected and safe (hash chain
      just continues from an earlier valid point); a restore that clips a
      chain mid-write would not be.
- [ ] Notify affected families if the incident window is large enough that
      they'd notice missing recent chore/ledger activity.

## Full database loss (D1 database itself deleted)

Time Travel restores a specific *existing* database — if the `morechard` D1
database resource itself were deleted (not just corrupted data), Time
Travel bookmarks are lost with it. Cloudflare does **not** currently offer a
way to recover a deleted D1 database from outside its own Time Travel
window. Mitigations:

- D1 databases can only be deleted via an explicit, confirmed dashboard or
  `wrangler d1 delete` action — there is no automated process in this repo
  that could do this accidentally.
- Consider a periodic `wrangler d1 export` to an out-of-band location (R2
  bucket or local) as a true off-platform backup, independent of the D1
  resource existing at all. **Not yet implemented** — see open item below.

## Open items (deliberately out of scope for this pass)

- **Untested restore drill.** This runbook has not been exercised against
  `morechard-dev`. Recommended next step: pick a low-traffic window, restore
  `morechard-dev` to an hour-old bookmark into a forked database, and time
  the actual process to replace the "budget 15–30 minutes" RTO estimate
  above with a measured one.
- **Off-platform export backstop.** A scheduled `wrangler d1 export` to R2
  would survive even a deleted D1 resource, which Time Travel alone would
  not. This needs a decision on frequency/retention/storage cost before
  implementing — flagging rather than silently adding a new recurring cron
  and R2 bucket.
