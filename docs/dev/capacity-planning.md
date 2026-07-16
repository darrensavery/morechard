# Capacity Planning & Load Testing

No load-testing or capacity-planning work had been done before this — this
document is a starting baseline, not a mature answer. It's honest about
what's unknown.

## What we don't know yet

There is no real production traffic data referenced in this repo to size
against. This doc can describe platform ceilings and known risk areas in
the code, but cannot tell you "how many families Morechard can support"
with any confidence — that needs either real usage metrics (PostHog is
wired up per `CLAUDE.md` roadmap Phase 8) or a synthetic load test against
realistic authenticated traffic, neither of which has been run yet.

## Platform ceilings (Cloudflare, not app-specific)

These are Cloudflare platform limits, not something this codebase controls
directly — listed here so a capacity conversation starts from the right
constraints. **Verify current values against Cloudflare's own docs before
relying on a specific number** — plan limits change over time and vary by
plan tier (Workers Paid vs. Free).

- **Worker CPU time per request**: default 30 seconds on Workers Paid, can be raised via `limits.cpu_ms` in `wrangler.toml` (not currently set — using the default).
- **D1 database size**: has a per-database size ceiling on the current plan tier — not verified against the actual Cloudflare account here.
- **D1 query limits**: rows-read-per-query and similar ceilings exist; not hit in current usage as far as any code in this repo indicates, but not proactively tested against either.
- **Queues**: the one queue in use (`support-agent-incidents`, `worker/wrangler.toml`) is configured with `max_batch_size = 5, max_retries = 3` — deliberately small since it's OpenAI-diagnosis work, not high-throughput.

## Known risk areas in the code (found during the 2026-07-15 security audit)

The support-agent queue is the *only* place in this codebase using
Cloudflare Queues for backpressure. Everything else that could be
expensive per-invocation runs inline, synchronously, with no batching:

- **AI Mentor chat** (`chat.ts`) — already has a real guard: 20 messages/hour per child (`chat_rate_limits` table), so this one is bounded regardless of family count.
- **Weekly Insights briefings + Family Audit** (`insights.ts`, `family-audit.ts`) — OpenAI calls, cached per-week per-child/family (D1 cache tables), so repeat views don't re-trigger the LLM call. The *generation* sweep itself (however it's triggered — check `scheduled()` in `index.ts`) has no visible per-batch throttling if it processes every family/child inline in one cron tick.
- **PDF/forensic report export** (`export.ts`) — uses `@cloudflare/puppeteer`, which is CPU/memory-heavy per invocation. Triggered on-demand per user request today (bounded by how often a user clicks export), not a batch job — lower risk than the cron-triggered items, but worth watching if export volume grows.
- **Payday sweep, market-rate cron** (`scheduled()` in `index.ts`) — run inline across (presumably) every family/child in a single invocation. This is the one most likely to hit the Worker CPU-time ceiling first as the number of schools/families grows, since it's the only unbounded-by-design loop running on a fixed schedule regardless of data volume.

**None of the above have been observed failing** — this is a forward-looking risk list based on reading the code, not a report of an actual incident. Cross-reference against Sentry's Cron Monitor (`worker-scheduled-heartbeat`) — if that monitor ever starts reporting slow/timing-out ticks, this list is where to look first.

## Load testing — what exists now

A baseline script (`worker/scripts/load-test.mjs`, `npm run load-test -- <preview-url>`) using `autocannon` against the unauthenticated `/api/health` endpoint. Deliberately minimal — never targets `api.morechard.com` directly (refuses to run against the production hostname; point it at a Worker Versions preview URL instead, which runs against the real production D1 without touching live traffic).

A second script, `worker/scripts/load-test-authenticated.mjs` (`npm run load-test:auth -- <preview-url>`), covers real authenticated traffic. It authenticates via `POST /auth/demo/register` (the shared Thomson demo family — no seeded test family needed) and load-tests:
- `GET /api/insights` (after a single priming request so the measured run hits the D1-cached weekly briefing, not OpenAI)
- `GET /api/export/pdf?tier=basic` (the Puppeteer-based report generator)

**Deliberately excludes `/api/chat`** — the demo family only has 2 children, and chat is rate-limited to 20 messages/hour *per child* (`chat_rate_limits`). Real load-testing it would either 429 almost immediately (not a real capacity signal) or lock the shared demo account's chat out for genuine visitors for up to an hour afterward. See `docs/security/audits/2026-07-15-production-security-audit.md`, Open item #10, for why chat wasn't exercised here — a separate content-safety question surfaced during this pass that's independent of load/capacity.

### Results — 2026-07-16, preview URL, 10 connections × 30s each

| Endpoint | Requests | Avg latency | p50 | p90 | p99 | Errors/non-2xx |
|---|---|---|---|---|---|---|
| `GET /api/insights` (D1-cached) | 198 | 1516ms | 1485ms | 1671ms | 2021ms | 0 |
| `GET /api/export/pdf?tier=basic` | 1116 | 268ms | 245ms | 332ms | 670ms | 0 |

Zero errors, timeouts, or non-2xx responses across ~1,300 combined requests on both paths — no capacity red flags at this load level. One thing worth a closer look later: `/api/insights` averaging ~1.5s even on the documented "cached" path is notably slower than PDF export's Puppeteer-driven render at ~268ms — suggests the *briefing text* is cached but other per-request work in that handler (KPI/velocity recalculation?) may not be. Not investigated further in this pass since nothing failed or timed out; flagged here as a possible future optimization target, not a capacity risk.

## Next steps (not done in this pass)

1. ~~Extend `load-test.mjs` to mint a test JWT and hit 2-3 expensive authenticated routes.~~ **Done 2026-07-16** — see `load-test-authenticated.mjs` and results above.
2. ~~Run a real load test against a preview URL and record actual numbers here.~~ **Done 2026-07-16** — see table above.
3. Load-test `/api/chat` separately and carefully — needs its own seeded test family (not the shared demo account) so a real burst doesn't lock out genuine demo visitors, and ideally resolved alongside the content-safety gap in Open item #10 rather than before it.
4. Investigate why `/api/insights` averages ~1.5s on the "cached" path — profile `insights.ts` to confirm what's actually cached vs. recomputed per request.
5. Add explicit batching/queueing to the payday/market-rate cron sweep if a real drill shows it's the bottleneck — don't build this speculatively without a number showing it's needed.
6. Once PostHog is live (Phase 8 roadmap item), use real usage data instead of synthetic load as the primary capacity signal.
