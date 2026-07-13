# Autonomous Support Agent — Runbook (Phase 0: Shadow Mode)

Operational reference for the autonomous support agent. Architecture and
authority model: `docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md`.
Implementation plan: `docs/superpowers/plans/2026-07-13-autonomous-support-agent-phase0.md`.

## What Phase 0 actually does

Ingests incidents from four sources, runs the full diagnosis pipeline
(Haiku triage → deterministic identity resolution → Opus diagnosis using
only read-only production queries), and writes every result to the Review
Queue (`/admin` → Agent Review tab). **Nothing executes. No customer
message is ever sent.** This phase exists purely to validate diagnosis
quality before Phase 1 turns any AUTO tool live.

## New secrets (production)

Set via `wrangler secret put <NAME> --env production` from `worker/`:

| Secret | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API — triage (Haiku) + diagnosis (Opus) |
| `FRESHDESK_API_KEY` | Reserved for Phase 1 (reading ticket history, posting replies). Not required for Phase 0's webhook-only ingestion. |
| `FRESHDESK_WEBHOOK_SECRET` | Shared secret checked against the `X-Freshdesk-Webhook-Secret` header on inbound ticket webhooks |
| `STRIPE_SUPPORT_AGENT_WEBHOOK_SECRET` | Separate from `STRIPE_WEBHOOK_SECRET` (the payment-critical one) — isolates the agent's ingest surface |
| `SENTRY_WEBHOOK_SECRET` | HMAC secret configured in the Sentry alert rule's webhook action |

For local dev, add real values to `worker/.dev.vars` (gitignored — see
`.dev.vars.example` for the placeholder list).

## One-time manual setup (external dashboards)

These are dashboard configuration steps, not code — do them once per
environment.

**Freshdesk** (Admin → Automations → Ticket Create/Update rules):
Add an action "Trigger Webhook" → `POST https://api.morechard.com/api/support-agent/freshdesk-webhook`,
header `X-Freshdesk-Webhook-Secret: <FRESHDESK_WEBHOOK_SECRET value>`,
JSON body including `ticket_id`, `requester_email`, `subject`,
`description`. Configure one rule for ticket creation and one for
customer-reply updates.

**Sentry** (Alerts → Alert Rules → new/existing rule → Actions):
Add action "Send a notification via a webhook" →
`https://api.morechard.com/api/support-agent/sentry-webhook`. Sentry signs
outbound webhook payloads with `Sentry-Hook-Signature` (HMAC-SHA256 of the
raw body) using the secret configured on the internal integration — this
must match `SENTRY_WEBHOOK_SECRET`. Scope the rule to your desired
severity threshold (recommend: new issues + regressions only, to avoid
flooding the queue with routine warning-level noise).

**Stripe** (Dashboard → Developers → Webhooks): Add a **second** endpoint
(do not reuse the existing payment webhook) →
`https://api.morechard.com/api/support-agent/stripe-webhook`, subscribed
to `charge.failed`, `charge.dispute.created`,
`radar.early_fraud_warning.created`. Copy its signing secret into
`STRIPE_SUPPORT_AGENT_WEBHOOK_SECRET`.

## Keeping the playbook in sync

Workers can't read the repo filesystem at request time, so the agent reads
a concatenated `docs/support/*.md` bundle from KV. **After any edit to
`docs/support/`, re-run:**

```bash
cd worker
npm run sync:playbook          # dev
npm run sync:playbook:prod     # production
```

This is a manual step in Phase 0/1. Phase 2+ automates it via CI on every
push touching `docs/support/**` (see the design spec's rollout table).

## Local development & testing

```bash
cd worker
npm test                 # all Vitest unit tests, including every new
                          # src/lib/agent/*.test.ts and src/routes/*.test.ts
                          # file from this plan
npx wrangler dev --remote # local dev server against morechard-dev
```

Manual queue smoke test (no external webhook needed): insert a row into
`agent_incidents` directly and send `{incidentId}` to the dev queue — see
Task 15, Step 5 of the implementation plan for the exact commands.

## Phase 0 validation checklist

Before proposing Phase 1 (turning any AUTO tool live), confirm across at
least 2 weeks of shadow-mode traffic:

- [ ] Identity resolution never mis-resolves a family (spot-check a sample
      of `agent_review_items` against the incident's actual reported email)
- [ ] Diagnoses cite real `agent_action_log` READ-tool results, not
      invented facts
- [ ] `queue_bucket` sorting looks right — genuinely high-confidence,
      playbook-matched cases land in `recommended_approve`
- [ ] No Sentry-sourced `agent_review_items` row ever has a non-null
      `draft_reply` (this should be structurally impossible per
      `processIncident.ts` — verify it holds in practice too)
- [ ] Declined items (bad diagnoses) are reviewed for playbook gaps —
      candidates for new `docs/support/*.md` entries

## Known Phase 0 limitations (by design, not bugs)

- No AUTO or GATED tool has a live handler — `invokeReadTool` is the only
  dispatcher that exists.
- No customer message is ever sent, including for AUTO-eligible
  diagnoses — everything lands in the review queue.
- Playbook sync is manual.
- No Freshdesk reply-posting integration yet (`FRESHDESK_API_KEY` is
  provisioned but unused until Phase 1).
