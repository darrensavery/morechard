# Infrastructure Incident Response Runbook

Scope: production infrastructure incidents — the Worker, D1, or a payment
processor failing or misbehaving. This is **not** the customer-support
process (`docs/dev/support-agent-runbook.md` covers that — individual
customer issues, not systemic infra failure) and not the D1-specific
restore procedure (`docs/dev/d1-backup-recovery-runbook.md` — link out to
it from here when the incident is database-shaped).

Written for a solo-operator setup — there is no on-call rotation, no
second engineer to page. Every step below assumes Darren is the sole
responder. The point of this doc is to remove decision-making load during
an actual incident, not to describe a team process that doesn't exist yet.

## Detection — what actually pages you today

| Signal | Source | Fires on |
|---|---|---|
| Worker `scheduled()` cron silently failing | Sentry Cron Monitor (`worker-scheduled-heartbeat`) | First missed check-in |
| API/D1 down | Sentry Uptime Monitor on `/api/health` | First failed check (5-min interval) |
| Unhandled exceptions | Sentry error capture (`Sentry.captureException` in `index.ts`'s top-level catch) | Every occurrence, rate-limited by Sentry's own noise controls |
| Stripe payment failures | Sentry, fingerprint `stripe-payment-failure` (`stripe.ts`) | Every `payment_intent.payment_failed`/`charge.failed`/etc. — **alert rule not yet created in the Sentry dashboard, so this currently logs but doesn't notify** (tracked in `docs/security/audits/2026-07-15-production-security-audit.md`) |
| GitHub Actions deploy failure | GitHub's own notification (email/GitHub app) | Any `test`/`deploy` job failure in `worker-deploy.yml` |

**Known gap:** nothing pages on elevated error *rate* specifically (vs. a
single Sentry exception) or on Stripe webhook delivery failures at the
Stripe-account level (Stripe's own dashboard has this — not wired to
Sentry). Treat Sentry's inbox and the Stripe dashboard as two places worth
a manual glance if something feels wrong and nothing paged.

## Triage — first 5 minutes

1. **Check `/api/health`** directly (`curl https://api.morechard.com/api/health`) — confirms whether the Worker is up and D1 is reachable right now, independent of what alerted you.
2. **Check Sentry** (Issues, filtered to the last hour) — is this one exception or a pattern? A single Sentry capture is not automatically an incident; a spike is.
3. **Check the last deploy** (`gh run list --workflow=worker-deploy.yml --branch main --limit 5`) — did this start right after a promotion? If yes, that's your prime suspect before anything else.
4. **Classify**: Worker-code issue (bad deploy) / D1 issue (data or availability) / Stripe issue (payment processing) / Cloudflare platform issue (rare, check https://www.cloudflarestatus.com/ first if nothing above points anywhere).

## Response by category

### Bad deploy (Worker code issue, started right after a promotion)

Blue/green rollback — see `docs/dev/blue-green-deploys.md` for the full mechanism. Short version:

```bash
cd worker
npx wrangler versions list --env production   # find the prior good version ID
npx wrangler versions deploy <prior-version-id>@100 --env production --yes
```

This is fast (seconds) and doesn't touch D1 — the old and new Worker versions share the same live database, so a rollback never causes a "which version has the real data" split.

### D1 issue (corruption, bad migration, unexpected data state)

Go to `docs/dev/d1-backup-recovery-runbook.md`. Summary of the decision tree:
- **Data looks wrong but the database is reachable** → Time Travel restore to a bookmark before the bad write. In-place only, ~5 seconds (measured), no preview — read the runbook's safety-export step first.
- **The D1 database resource itself is gone** → Time Travel can't help (it restores an *existing* database). Recover from the daily off-platform export in the `morechard-db-backups` R2 bucket (`.github/workflows/d1-backup-export.yml`, 30-day retention) — this loses up to 24h of data (the gap since the last export) versus Time Travel's near-zero RPO for in-database issues.

### Payment issue (Stripe failures spiking)

1. Check Sentry for the `stripe-payment-failure` fingerprint — the failure message (`last_payment_error` or `failure_message`) tells you if it's a Stripe-side issue (processor decline, card issues — not actionable by you) or an integration issue (wrong price ID, webhook signature failure, etc. — check `worker/src/routes/stripe.ts`).
2. Check the Stripe dashboard directly (Developers → Webhooks → delivery attempts) — confirms whether Stripe is even successfully reaching the webhook endpoint at all, which Sentry alone can't tell you if the webhook signature check itself is silently rejecting valid requests.
3. A payment failure is rarely an emergency requiring a rollback — it's usually a "diagnose and fix forward" situation, not a "roll back the Worker" one, since checkout/webhook code changes infrequently relative to everything else.

### Cloudflare platform outage

Nothing to do on the app side — confirm at https://www.cloudflarestatus.com/, and there's no self-hosted fallback (by design — this is a Cloudflare-native stack per `CLAUDE.md`'s Strategic Tech Direction). Wait it out; there's no action that speeds up a Cloudflare-side incident.

## Post-incident

- Note what happened and the fix in `docs/dev/changelog.md` under the day's entry — this repo's existing convention, and it's what let the `ledger_old` FK bug and the missing `marketing_consents` table (both silent-cron-failure incidents) get properly diagnosed months later.
- If the incident revealed a detection gap (something that should have paged but didn't), that's the highest-priority follow-up — a `docs/dev/changelog.md` search shows this has happened before (CI safety net, Cron Monitor + Uptime Monitor were both added *because* a prior incident went undetected for months, not proactively).

## Open items

- No alerting on Stripe webhook delivery failures at the Stripe-account level (would need a Stripe-side webhook-monitoring integration, not currently wired to anything).
- No paging for elevated error *rate* specifically, only per-exception capture — Sentry supports rate-based alert rules but none are configured beyond the Cron/Uptime monitors.
- This runbook itself hasn't been drilled (unlike the D1 restore procedure, which was) — the D1 drill on 2026-07-15 found the original recovery runbook had a real factual error before anyone hit it during a live incident. The same risk applies here until this is exercised at least once, even as a tabletop walkthrough.
