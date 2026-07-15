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
- **RTO (Recovery Time Objective): ~5 seconds for the restore itself,
  measured.** Drilled against `morechard-dev` on 2026-07-15: restored to a
  ~1hr-old bookmark, verified queryable, then restored forward again to
  undo — each `time-travel restore` call completed in ~5 seconds regardless
  of direction. Budget more for the surrounding process in a real incident
  (finding the right bookmark, running the post-restore checklist below,
  notifying anyone affected) — call it 10–15 minutes end-to-end for a human
  operator working through this runbook under pressure, but the database
  operation itself is not the bottleneck.

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

### 2. Correction from the 2026-07-15 drill: there is no fork-first option

This runbook originally recommended restoring into a new forked database
first to verify before committing. **That capability does not exist** —
verified by actually running the commands against `morechard-dev`, not just
reading docs. `wrangler d1 time-travel restore` (wrangler 4.79.0) takes no
`--name`/fork flag, and `wrangler d1 export` has no bookmark/timestamp
option either — there is no way to materialise a past point-in-time into a
*separate* database via the CLI. **`time-travel restore` always restores
the named database in place.** Treat this as a hard fact about the tool,
not a missing flag to work around.

Given that, take a safety export of the *current* (pre-restore) state first
— not point-in-time, just "now" — so a bad restore decision can at least be
partially recovered by re-importing this dump, even though you'd lose
further Time Travel reach on the timeline you're stepping away from:

```bash
npx wrangler d1 export morechard --env production --remote \
  --output="./pre-restore-safety-$(date +%Y%m%d-%H%M%S).sql"
```

### 3. Restore in place

```bash
npx wrangler d1 time-travel restore morechard --env production \
  --bookmark=<bookmark-from-step-1>
```

This restores `morechard` itself back to that point in time immediately —
there is no preview/confirm step. Any writes between the restore bookmark
and "now" are lost. This is why step 2's safety export matters: it's the
only rollback available if the bookmark chosen turns out to be wrong.

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

- **Restore drill: done (2026-07-15), on a schedule going forward.** Ran a
  real restore-and-undo against `morechard-dev` — see RTO above. This
  should be re-run periodically (e.g. every 6 months, or after any wrangler
  major-version upgrade) since the 2026-07-15 drill is exactly what caught
  this doc's original "fork-and-verify" recommendation as wrong — the tool
  doesn't support it. A runbook nobody re-tests goes stale the same way the
  false fork-and-verify claim did.
- **Off-platform export backstop.** A scheduled `wrangler d1 export` to R2
  would survive even a deleted D1 resource, which Time Travel alone would
  not. This needs a decision on frequency/retention/storage cost before
  implementing — flagging rather than silently adding a new recurring cron
  and R2 bucket.
