# Freshdesk → Zoho Desk Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Freshdesk-based support-ticket ingestion and SSO with
Zoho Desk (free tier — 3 agents, no cost), using scheduled polling instead
of an inbound webhook, since Zoho Desk's free tier does not support
outgoing webhooks or Help Center SSO (confirmed against Zoho's official
docs/OAS — see the "Free-tier constraint" note below).

**Architecture:** A new Cloudflare Cron Trigger (`*/5 * * * *`, dispatched
through the existing `scheduled()` handler in `index.ts` by checking
`event.cron`) polls the Zoho Desk ticket-search API for tickets modified
since the last poll, using a self-client OAuth refresh-token flow cached
in KV. Matched tickets flow into the *existing* `agent_incidents` →
`INCIDENT_QUEUE` → `processIncident` pipeline unchanged — only the
ingestion source changes, not the diagnosis pipeline. The Freshdesk
webhook route, the (already-nonfunctional — `FRESHDESK_SSO_SECRET` was
never set in production) SSO route, and their env vars are deleted
outright, not deprecated in place. The in-app "Contact Support" flow
switches from an SSO-portal redirect to an in-app form that both writes
the local `agent_incidents` row (as it already does) and best-effort
creates a real Zoho Desk ticket, so a human agent has something to work
from.

**Tech Stack:** Existing stack only — Cloudflare Workers, D1, KV, Vitest,
Cloudflare Cron Triggers (new — the existing four crons in
`wrangler.toml` are the reference pattern). Zoho REST API via `fetch`, no
SDK — matches the existing fetch-based pattern in `claudeClient.ts`.

## Free-tier constraint (context for every task below)

Zoho Desk's free/Express/Standard plans do **not** support outgoing
Workflow-Rule webhooks or Help Center JWT SSO — both require the
Professional plan (confirmed against `zoho.com/desk/pricing-comparison.html`
and `help.zoho.com` SSO docs). The free plan **does** support the full
REST ticket API (search, read, create) under a 5,000-request/day credit
budget, which is what this plan uses instead of a webhook. This is a
deliberate architectural substitution, not a workaround to remove later —
do not add webhook-receiving code for Zoho in this plan.

## Global Constraints

- **No Freshdesk code survives this migration.** Delete
  `worker/src/routes/freshdesk-sso.ts`, the Freshdesk webhook handler in
  `worker/src/routes/supportAgentIngest.ts`, their route registrations in
  `worker/src/index.ts`, and their `Env` fields. Do not leave commented-out
  or "kept for reference" Freshdesk code.
- **`FRESHDESK_SSO_SECRET` was never configured in production** (confirmed
  via `wrangler secret list --env production` — absent from the list), so
  `handleFreshdeskSso` has always returned `503` in production. Its removal
  is a pure simplification, not a behavior change for real users.
- **Zoho region/data-center domains vary per account** (`.com`, `.eu`,
  `.in`, `.com.au`, `.jp`, `.ca`). This plan assumes the `.com` (US) data
  center — if the Zoho org was created under a different region, every
  `desk.zoho.com` / `accounts.zoho.com` URL in this plan must be swapped
  for that region's domain (Task 1 of the manual setup task records which
  one to use).
- **Model/pricing/tier facts this plan must not contradict:** unchanged
  from the existing support-agent design spec
  (`docs/superpowers/specs/2026-07-13-autonomous-support-agent-design.md`)
  — this migration only touches the ingestion source, not diagnosis,
  tiers, or the review queue.
- **Never invent a Zoho contactId.** Ticket creation always passes either
  a known `contactId` or a `{email, lastName}` object — never a
  model-extracted or guessed identifier. This mirrors the existing
  identity-resolution discipline in `worker/src/lib/agent/identity.ts`.

---

## Task 1: Manual Zoho Desk account setup (no code)

**Files:** None — this is an operator setup task, output feeds the secrets
in Task 3.

Do this once, before writing any code, so the values it produces
(`client_id`, `client_secret`, `refresh_token`, `orgId`, `departmentId`,
region) are available for the `.dev.vars` / `wrangler secret put` steps
later.

- [ ] **Step 1: Confirm your Zoho Desk account's data center**

  Log into `desk.zoho.com` (or whichever region you signed up under —
  check the browser URL bar; `.eu`/`.in`/etc. accounts redirect there
  automatically). Note the region for use in every URL below. This plan
  assumes `.com`; substitute your region everywhere if different.

- [ ] **Step 2: Find your Org ID**

  In Zoho Desk: **Setup (gear icon) → Developer Space → API** — the
  Organization ID is shown there. Copy it; this is `ZOHO_ORG_ID`.

- [ ] **Step 3: Find (or create) a Department ID**

  In Zoho Desk: **Setup → Departments**. Click into the department that
  should own agent-created tickets (or create one, e.g. "General
  Support"). The department's numeric ID is visible in the URL when
  editing it (e.g. `.../departments/1892000000006907/edit`). Copy it;
  this is `ZOHO_DEPARTMENT_ID`.

- [ ] **Step 4: Create a Self Client in the API Console**

  Go to `api-console.zoho.com` → **Add Client** → **Self Client**.
  Confirm creation. Note the **Client ID** and **Client Secret** shown —
  these are `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET`.

- [ ] **Step 5: Generate an authorization code and exchange it for tokens**

  In the Self Client's **Generate Code** tab, enter this scope string
  exactly:

  ```
  Desk.tickets.ALL,Desk.search.READ,Desk.basic.READ,Desk.contacts.READ
  ```

  Set expiry to the max offered, select the correct Zoho org/portal, and
  click **Create**. Copy the generated code immediately — it expires in
  minutes. Exchange it for tokens with:

  ```bash
  curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
    -d "client_id=<ZOHO_CLIENT_ID>" \
    -d "client_secret=<ZOHO_CLIENT_SECRET>" \
    -d "grant_type=authorization_code" \
    -d "code=<the generated code>"
  ```

  Expected: JSON response containing `access_token` (short-lived, ignore
  it), `refresh_token` (long-lived, does not expire), `api_domain`. Copy
  the `refresh_token` value — this is `ZOHO_REFRESH_TOKEN`. There is no
  further manual step to keep it fresh; Task 3's client refreshes the
  access token from this value on every poll.

- [ ] **Step 6: Record all six values for Task 3's secrets step**

  `ZOHO_ORG_ID`, `ZOHO_DEPARTMENT_ID`, `ZOHO_CLIENT_ID`,
  `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, and the region-specific
  `ZOHO_API_DOMAIN` (`https://desk.zoho.com` for `.com` accounts) /
  `ZOHO_ACCOUNTS_DOMAIN` (`https://accounts.zoho.com`).

---

## Task 2: D1 migration — rename `freshdesk` to `zoho_desk` in the source enum

**Files:**
- Create: `worker/migrations/0079_zoho_desk_source.sql`
- Test: manual verification via `wrangler d1 execute` (matches the
  existing convention for schema-only migrations — see `0078`'s plan
  task, no companion `.test.ts`)

**Interfaces:**
- Modifies: `agent_incidents.source` CHECK constraint — consumed by every
  ingest route and by `processIncident`'s source-based branching.

SQLite can't `ALTER TABLE ... DROP CONSTRAINT`, so this is a table
rebuild. Since Freshdesk's webhook automation rule was never actually
wired up in Freshdesk's dashboard (blocked on account access this whole
time), `agent_incidents` has zero `source = 'freshdesk'` rows in
production — confirm this before running Step 2, and stop to investigate
if the count is nonzero.

- [ ] **Step 1: Verify no existing Freshdesk-sourced rows (production)**

  ```bash
  cd worker
  npx wrangler d1 execute morechard --remote --env production \
    --command="SELECT COUNT(*) AS n FROM agent_incidents WHERE source = 'freshdesk'"
  ```

  Expected: `n` = 0. If nonzero, stop and decide how to handle those rows
  before proceeding (this plan assumes zero).

- [ ] **Step 2: Write the migration file**

  ```sql
  -- 0079_zoho_desk_source.sql
  -- Rebuilds agent_incidents to swap the 'freshdesk' source enum value for
  -- 'zoho_desk' (Freshdesk → Zoho Desk migration, see
  -- docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md).
  -- SQLite has no ALTER TABLE ... DROP CONSTRAINT, so this is a table
  -- rebuild. Confirmed zero 'freshdesk' rows exist before this migration.

  CREATE TABLE agent_incidents_new (
    id                   TEXT PRIMARY KEY,
    source               TEXT NOT NULL CHECK (source IN ('zoho_desk','sentry','in_app','stripe')),
    source_ref           TEXT NOT NULL,
    user_facing          INTEGER NOT NULL CHECK (user_facing IN (0,1)),
    family_id            TEXT,
    related_incident_id  TEXT REFERENCES agent_incidents_new(id),
    raw_payload          TEXT NOT NULL,
    occurrence_count     INTEGER NOT NULL DEFAULT 1,
    status               TEXT NOT NULL DEFAULT 'received'
                         CHECK (status IN ('received','diagnosing','resolved_auto','escalated','approved','declined','failed')),
    created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
    resolved_at          INTEGER
  );

  INSERT INTO agent_incidents_new SELECT * FROM agent_incidents;

  DROP TABLE agent_incidents;
  ALTER TABLE agent_incidents_new RENAME TO agent_incidents;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_incidents_open_source_ref
    ON agent_incidents (source, source_ref)
    WHERE status IN ('received','diagnosing','escalated');

  CREATE INDEX IF NOT EXISTS idx_agent_incidents_family
    ON agent_incidents (family_id);
  ```

- [ ] **Step 3: Apply to the dev database**

  ```bash
  cd worker
  npx wrangler d1 migrations apply morechard-dev --remote
  ```

  Expected: `0079_zoho_desk_source.sql` applied with no errors.

- [ ] **Step 4: Verify the CHECK constraint updated**

  ```bash
  npx wrangler d1 execute morechard-dev --remote \
    --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_incidents'"
  ```

  Expected: the printed `CREATE TABLE` statement's CHECK clause reads
  `source IN ('zoho_desk','sentry','in_app','stripe')`.

- [ ] **Step 5: Commit**

  ```bash
  git add worker/migrations/0079_zoho_desk_source.sql
  git commit -m "feat: rename agent_incidents source enum value freshdesk to zoho_desk"
  ```

---

## Task 3: Env, secrets & wrangler scaffolding

**Files:**
- Modify: `worker/src/types.ts` (replace Freshdesk `Env` fields with Zoho
  fields)
- Modify: `worker/wrangler.toml` (add the 5-minute cron trigger, add Zoho
  non-secret vars)
- Modify: `worker/.dev.vars.example` (replace Freshdesk placeholders with
  Zoho placeholders)

No test — configuration, verified by Task 5's smoke test.

- [ ] **Step 1: Update the `Env` interface**

  In `worker/src/types.ts`, replace lines 27, 32–33 (delete
  `FRESHDESK_SSO_SECRET`, `FRESHDESK_API_KEY`, `FRESHDESK_WEBHOOK_SECRET`)
  with:

  ```typescript
    ZOHO_CLIENT_ID: string;
    ZOHO_CLIENT_SECRET: string;
    ZOHO_REFRESH_TOKEN: string;
    ZOHO_ORG_ID: string;
    ZOHO_DEPARTMENT_ID: string;
    ZOHO_API_DOMAIN: string;       // e.g. https://desk.zoho.com — region-specific, not a secret
    ZOHO_ACCOUNTS_DOMAIN: string;  // e.g. https://accounts.zoho.com — region-specific, not a secret
  ```

  The resulting block (lines ~22–36) should read:

  ```typescript
    GOOGLE_CLIENT_ID:     string;
    GOOGLE_CLIENT_SECRET: string;
    POSTHOG_API_KEY:      string;
    POSTHOG_HOST:         string;
    OPENAI_API_KEY:        string;
    BREVO_API_KEY:         string;
    ADMIN_SECRET:          string;
    // ── Autonomous Support Agent (Phase 0) ──────────────────────────────────
    ANTHROPIC_API_KEY: string;
    ZOHO_CLIENT_ID: string;
    ZOHO_CLIENT_SECRET: string;
    ZOHO_REFRESH_TOKEN: string;
    ZOHO_ORG_ID: string;
    ZOHO_DEPARTMENT_ID: string;
    ZOHO_API_DOMAIN: string;
    ZOHO_ACCOUNTS_DOMAIN: string;
    STRIPE_SUPPORT_AGENT_WEBHOOK_SECRET: string;
    SENTRY_WEBHOOK_SECRET: string;
    INCIDENT_QUEUE: Queue<IncidentQueueMessage>;
  ```

- [ ] **Step 2: Add the polling cron trigger**

  In `worker/wrangler.toml`, update the comment block and `crons` array
  (currently lines 67–75):

  ```toml
  # ── Cron triggers ────────────────────────────────────────────────────────────
  # All run through the same scheduled() handler in index.ts:
  #   "0 8 * * 6"   — Saturday 08:00 UTC: payday sweep + governance expiry
  #   "0 3 * * 1"   — Monday  03:00 UTC: market rate aggregation
  #   "0 6 * * *"   — Daily   06:00 UTC: marketing re-engagement emails
  #   "0 0 * * *"   — Daily   00:00 UTC: demo family nightly reset (Thomson)
  #                                      + Learning Lab passive-unlock sweep (inactivity/balance/streak)
  #   "*/5 * * * *" — Every 5 minutes:  Zoho Desk ticket poll (support agent ingestion)
  [triggers]
  crons = ["0 8 * * 6", "0 3 * * 1", "0 6 * * *", "0 0 * * *", "*/5 * * * *"]
  ```

- [ ] **Step 3: Add non-secret Zoho vars to both environments**

  In `worker/wrangler.toml`, find the top-level `[vars]` (dev) block and
  the `env.production` `vars = { ... }` line. Add
  `ZOHO_API_DOMAIN = "https://desk.zoho.com"` and
  `ZOHO_ACCOUNTS_DOMAIN = "https://accounts.zoho.com"` to both — these
  are not secrets (they're fixed per-region URLs, not credentials).

  If there is no top-level `[vars]` block yet, add one directly above
  `[triggers]`:

  ```toml
  [vars]
  ZOHO_API_DOMAIN = "https://desk.zoho.com"
  ZOHO_ACCOUNTS_DOMAIN = "https://accounts.zoho.com"
  ```

  And append the same two keys into the existing
  `env.production` `vars = { ... }` object (comma-separated, matching the
  existing single-line style at line 89).

- [ ] **Step 4: Update `.dev.vars.example`**

  Remove the `FRESHDESK_API_KEY` and `FRESHDESK_WEBHOOK_SECRET` lines,
  add:

  ```
  ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ZOHO_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ZOHO_ORG_ID=xxxxxxxxx
  ZOHO_DEPARTMENT_ID=xxxxxxxxxxxxxxxxxx
  ```

  (`ZOHO_API_DOMAIN` / `ZOHO_ACCOUNTS_DOMAIN` don't need a `.dev.vars`
  line — they're plain `vars`, set in `wrangler.toml` itself, not
  secrets.)

- [ ] **Step 5: Set the production secrets**

  ```bash
  cd worker
  npx wrangler secret put ZOHO_CLIENT_ID --env production
  npx wrangler secret put ZOHO_CLIENT_SECRET --env production
  npx wrangler secret put ZOHO_REFRESH_TOKEN --env production
  npx wrangler secret put ZOHO_ORG_ID --env production
  npx wrangler secret put ZOHO_DEPARTMENT_ID --env production
  ```

  (Org ID and Department ID are numeric, not really "secret" in the
  cryptographic sense, but stored as Worker secrets rather than plain
  `vars` since they're account-identifying and not meant to be committed.)

- [ ] **Step 6: Delete the now-unused Freshdesk secret**

  ```bash
  npx wrangler secret delete FRESHDESK_WEBHOOK_SECRET --env production
  ```

  (`FRESHDESK_API_KEY` and `FRESHDESK_SSO_SECRET` were never set in
  production — confirmed via `wrangler secret list --env production` —
  so there's nothing to delete for those two.)

- [ ] **Step 7: Commit**

  ```bash
  git add worker/src/types.ts worker/wrangler.toml worker/.dev.vars.example
  git commit -m "feat: replace Freshdesk env vars with Zoho Desk credentials and add polling cron"
  ```

---

## Task 4: Zoho Desk API client (OAuth + search + create)

**Files:**
- Create: `worker/src/lib/agent/zoho.ts`
- Test: `worker/src/lib/agent/zoho.test.ts`

**Interfaces:**
- Produces: `getZohoAccessToken(env): Promise<string>`,
  `buildZohoSearchUrl(env, sinceIso, toIso, from, limit): string`,
  `parseZohoSearchResponse(body: unknown): ZohoTicketSummary[]`,
  `searchZohoTicketsModifiedBetween(env, sinceIso, toIso): Promise<ZohoTicketSummary[]>`,
  `buildZohoCreateTicketBody(env, params): object`,
  `createZohoTicket(env, params): Promise<{ id: string } | null>`,
  `interface ZohoTicketSummary { id: string; subject: string; description: string; contactEmail: string | null }`
  — consumed by Task 5 (polling) and Task 7 (in-app ticket creation).

Following the existing house convention (`claudeClient.ts`): pure
request/response-shaping functions are unit tested; the actual
`fetch`-performing wrapper functions are not (no live network in tests —
verified manually via Task 5's smoke test instead).

- [ ] **Step 1: Write the failing tests**

  ```typescript
  // worker/src/lib/agent/zoho.test.ts
  import { describe, it, expect } from 'vitest';
  import { buildZohoSearchUrl, parseZohoSearchResponse, buildZohoCreateTicketBody } from './zoho.js';

  const fakeEnv = {
    ZOHO_API_DOMAIN: 'https://desk.zoho.com',
    ZOHO_DEPARTMENT_ID: '1892000000006907',
  } as never;

  describe('buildZohoSearchUrl', () => {
    it('builds a search URL with the modifiedTimeRange, sortBy, from, and limit params', () => {
      const url = buildZohoSearchUrl(fakeEnv, '2026-07-14T00:00:00.000Z', '2026-07-14T00:05:00.000Z', 0, 100);
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://desk.zoho.com/api/v1/tickets/search');
      expect(parsed.searchParams.get('modifiedTimeRange')).toBe('2026-07-14T00:00:00.000Z,2026-07-14T00:05:00.000Z');
      expect(parsed.searchParams.get('sortBy')).toBe('modifiedTime');
      expect(parsed.searchParams.get('from')).toBe('0');
      expect(parsed.searchParams.get('limit')).toBe('100');
    });
  });

  describe('parseZohoSearchResponse', () => {
    it('extracts id, subject, description, and contact email from each ticket', () => {
      const body = {
        data: [
          {
            id: '31138000011969204',
            subject: 'Cannot log in',
            description: '<div>Locked out since yesterday</div>',
            contact: { email: 'parent@example.com' },
          },
        ],
      };
      const result = parseZohoSearchResponse(body);
      expect(result).toEqual([
        { id: '31138000011969204', subject: 'Cannot log in', description: '<div>Locked out since yesterday</div>', contactEmail: 'parent@example.com' },
      ]);
    });

    it('returns an empty array when data is missing', () => {
      expect(parseZohoSearchResponse({})).toEqual([]);
    });

    it('sets contactEmail to null when the contact object is absent', () => {
      const body = { data: [{ id: '1', subject: 'x', description: 'y' }] };
      expect(parseZohoSearchResponse(body)).toEqual([
        { id: '1', subject: 'x', description: 'y', contactEmail: null },
      ]);
    });
  });

  describe('buildZohoCreateTicketBody', () => {
    it('builds a create-ticket body using the department id from env and a contact email object', () => {
      const body = buildZohoCreateTicketBody(fakeEnv, {
        subject: 'Support request from app',
        description: 'Cannot see my goals',
        email: 'parent@example.com',
        lastName: 'Savery',
      });
      expect(body).toEqual({
        subject: 'Support request from app',
        description: 'Cannot see my goals',
        departmentId: '1892000000006907',
        status: 'Open',
        contact: { email: 'parent@example.com', lastName: 'Savery' },
      });
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  cd worker
  npx vitest run src/lib/agent/zoho.test.ts
  ```

  Expected: FAIL — `Cannot find module './zoho.js'`.

- [ ] **Step 3: Write the implementation**

  ```typescript
  // worker/src/lib/agent/zoho.ts
  /**
   * Zoho Desk API client — OAuth token refresh, ticket search (used for
   * polling, since Zoho's free tier has no outgoing webhooks — see
   * docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md),
   * and ticket creation for the in-app "Contact Support" flow. Raw fetch,
   * no SDK — matches the existing pattern in claudeClient.ts.
   */
  import { Env } from '../../types.js';

  export interface ZohoTicketSummary {
    id: string;
    subject: string;
    description: string;
    contactEmail: string | null;
  }

  const ZOHO_ACCESS_TOKEN_KV_KEY = 'agent:zoho:access_token';

  /**
   * Exchanges the long-lived refresh token for a short-lived access token,
   * caching it in KV for slightly under its 1-hour lifetime so repeated
   * polls within that window don't re-authenticate every time.
   */
  export async function getZohoAccessToken(env: Env): Promise<string> {
    const cached = await env.CACHE.get(ZOHO_ACCESS_TOKEN_KV_KEY);
    if (cached) return cached;

    const url = new URL(`${env.ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`);
    url.searchParams.set('client_id', env.ZOHO_CLIENT_ID);
    url.searchParams.set('client_secret', env.ZOHO_CLIENT_SECRET);
    url.searchParams.set('grant_type', 'refresh_token');
    url.searchParams.set('refresh_token', env.ZOHO_REFRESH_TOKEN);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Zoho token refresh failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json() as { access_token: string; expires_in: number };

    // Cache for slightly less than the token's real lifetime (default 3600s)
    // so a poll never uses a token that expires mid-request.
    await env.CACHE.put(ZOHO_ACCESS_TOKEN_KV_KEY, data.access_token, {
      expirationTtl: Math.max(60, data.expires_in - 120),
    });
    return data.access_token;
  }

  export function buildZohoSearchUrl(
    env: Env,
    sinceIso: string,
    toIso: string,
    from: number,
    limit: number,
  ): string {
    const url = new URL(`${env.ZOHO_API_DOMAIN}/api/v1/tickets/search`);
    url.searchParams.set('modifiedTimeRange', `${sinceIso},${toIso}`);
    url.searchParams.set('sortBy', 'modifiedTime');
    url.searchParams.set('from', String(from));
    url.searchParams.set('limit', String(limit));
    return url.toString();
  }

  export function parseZohoSearchResponse(body: unknown): ZohoTicketSummary[] {
    const data = (body as { data?: unknown[] })?.data;
    if (!Array.isArray(data)) return [];
    return data.map((raw) => {
      const t = raw as { id: string; subject: string; description: string; contact?: { email?: string } };
      return {
        id: t.id,
        subject: t.subject,
        description: t.description,
        contactEmail: t.contact?.email ?? null,
      };
    });
  }

  /**
   * Fetches every page of tickets modified in the given window. Zoho's
   * search endpoint caps `limit` in practice around 100/page — this loops
   * until a short page signals the end.
   */
  export async function searchZohoTicketsModifiedBetween(
    env: Env,
    sinceIso: string,
    toIso: string,
  ): Promise<ZohoTicketSummary[]> {
    const accessToken = await getZohoAccessToken(env);
    const pageSize = 100;
    const results: ZohoTicketSummary[] = [];
    let from = 0;

    for (;;) {
      const res = await fetch(buildZohoSearchUrl(env, sinceIso, toIso, from, pageSize), {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: env.ZOHO_ORG_ID,
        },
      });
      if (!res.ok) {
        throw new Error(`Zoho ticket search failed (${res.status}): ${await res.text()}`);
      }
      const page = parseZohoSearchResponse(await res.json());
      results.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    return results;
  }

  export function buildZohoCreateTicketBody(
    env: Env,
    params: { subject: string; description: string; email: string; lastName: string },
  ): object {
    return {
      subject: params.subject,
      description: params.description,
      departmentId: env.ZOHO_DEPARTMENT_ID,
      status: 'Open',
      contact: { email: params.email, lastName: params.lastName },
    };
  }

  /**
   * Best-effort ticket creation for the in-app "Contact Support" flow.
   * Returns null on failure rather than throwing — the caller (Task 7)
   * treats the local agent_incidents write as the source of truth and
   * this as a nice-to-have for human visibility.
   */
  export async function createZohoTicket(
    env: Env,
    params: { subject: string; description: string; email: string; lastName: string },
  ): Promise<{ id: string } | null> {
    try {
      const accessToken = await getZohoAccessToken(env);
      const res = await fetch(`${env.ZOHO_API_DOMAIN}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: env.ZOHO_ORG_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildZohoCreateTicketBody(env, params)),
      });
      if (!res.ok) return null;
      const data = await res.json() as { id: string };
      return { id: data.id };
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npx vitest run src/lib/agent/zoho.test.ts
  ```

  Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

  ```bash
  git add worker/src/lib/agent/zoho.ts worker/src/lib/agent/zoho.test.ts
  git commit -m "feat: add Zoho Desk API client (OAuth token refresh, ticket search, ticket create)"
  ```

---

## Task 5: Polling logic — Zoho ticket search into `agent_incidents`

**Files:**
- Create: `worker/src/lib/agent/zohoPoll.ts`
- Test: `worker/src/lib/agent/zohoPoll.test.ts`

**Interfaces:**
- Consumes: `searchZohoTicketsModifiedBetween` from Task 4.
- Produces: `computePollWindow(lastCursorIso: string | null, nowIso: string): { sinceIso: string; toIso: string }`,
  `pollZohoDeskTickets(env: Env): Promise<{ polled: number; created: number; deduplicated: number }>`
  — consumed by Task 6's `scheduled()` wiring.

Mirrors the existing Sentry dedupe pattern in `supportAgentIngest.ts`:
an already-open incident for the same `source_ref` gets its
`occurrence_count` bumped; a new `source_ref` gets a fresh row + queue
enqueue. The poll window always overlaps the previous one by 2 minutes to
tolerate clock skew and cron-scheduling jitter, relying on that same
dedupe to make the overlap harmless.

- [ ] **Step 1: Write the failing tests**

  ```typescript
  // worker/src/lib/agent/zohoPoll.test.ts
  import { describe, it, expect } from 'vitest';
  import { computePollWindow } from './zohoPoll.js';

  describe('computePollWindow', () => {
    it('starts the window 10 minutes before now when there is no prior cursor', () => {
      const { sinceIso, toIso } = computePollWindow(null, '2026-07-14T12:00:00.000Z');
      expect(sinceIso).toBe('2026-07-14T11:50:00.000Z');
      expect(toIso).toBe('2026-07-14T12:00:00.000Z');
    });

    it('starts the window 2 minutes before the prior cursor (overlap for clock skew / jitter)', () => {
      const { sinceIso, toIso } = computePollWindow('2026-07-14T11:55:00.000Z', '2026-07-14T12:00:00.000Z');
      expect(sinceIso).toBe('2026-07-14T11:53:00.000Z');
      expect(toIso).toBe('2026-07-14T12:00:00.000Z');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd worker
  npx vitest run src/lib/agent/zohoPoll.test.ts
  ```

  Expected: FAIL — `Cannot find module './zohoPoll.js'`.

- [ ] **Step 3: Write the implementation**

  ```typescript
  // worker/src/lib/agent/zohoPoll.ts
  /**
   * Polls Zoho Desk for tickets modified since the last poll and feeds them
   * into the existing agent_incidents → INCIDENT_QUEUE pipeline. Runs on
   * the */5 * * * * cron (wired in index.ts's scheduled() handler, Task 6)
   * since Zoho's free tier has no outgoing webhooks.
   */
  import { Env, IncidentQueueMessage } from '../../types.js';
  import { nanoid } from '../nanoid.js';
  import { searchZohoTicketsModifiedBetween } from './zoho.js';

  const POLL_CURSOR_KV_KEY = 'agent:zoho:last_poll_at';
  const OVERLAP_MINUTES = 2;
  const FIRST_POLL_LOOKBACK_MINUTES = 10;

  export function computePollWindow(
    lastCursorIso: string | null,
    nowIso: string,
  ): { sinceIso: string; toIso: string } {
    const now = new Date(nowIso);
    if (!lastCursorIso) {
      const since = new Date(now.getTime() - FIRST_POLL_LOOKBACK_MINUTES * 60_000);
      return { sinceIso: since.toISOString(), toIso: nowIso };
    }
    const cursor = new Date(lastCursorIso);
    const since = new Date(cursor.getTime() - OVERLAP_MINUTES * 60_000);
    return { sinceIso: since.toISOString(), toIso: nowIso };
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  export async function pollZohoDeskTickets(
    env: Env,
  ): Promise<{ polled: number; created: number; deduplicated: number }> {
    const nowIso = new Date().toISOString();
    const lastCursor = await env.CACHE.get(POLL_CURSOR_KV_KEY);
    const { sinceIso, toIso } = computePollWindow(lastCursor, nowIso);

    const tickets = await searchZohoTicketsModifiedBetween(env, sinceIso, toIso);

    let created = 0;
    let deduplicated = 0;

    for (const ticket of tickets) {
      const existing = await env.DB
        .prepare(`
          SELECT id FROM agent_incidents
          WHERE source = 'zoho_desk' AND source_ref = ? AND status IN ('received','diagnosing','escalated')
        `)
        .bind(ticket.id)
        .first<{ id: string }>();

      if (existing) {
        await env.DB
          .prepare('UPDATE agent_incidents SET occurrence_count = occurrence_count + 1 WHERE id = ?')
          .bind(existing.id)
          .run();
        deduplicated++;
        continue;
      }

      const incidentText = [
        ticket.contactEmail ? `Requester: ${ticket.contactEmail}` : '',
        `Subject: ${ticket.subject}`,
        stripHtml(ticket.description ?? ''),
      ].filter(Boolean).join('\n');

      const incidentId = nanoid();
      try {
        await env.DB
          .prepare(`
            INSERT INTO agent_incidents (id, source, source_ref, user_facing, raw_payload)
            VALUES (?, 'zoho_desk', ?, 1, ?)
          `)
          .bind(incidentId, ticket.id, incidentText)
          .run();
      } catch (err) {
        // Same-ticket race between two overlapping poll windows — the
        // partial unique index rejects the loser; treat it as a dedupe.
        const msg = err instanceof Error ? err.message : String(err);
        if (/UNIQUE constraint failed/i.test(msg)) {
          deduplicated++;
          continue;
        }
        throw err;
      }

      await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);
      created++;
    }

    await env.CACHE.put(POLL_CURSOR_KV_KEY, nowIso);

    return { polled: tickets.length, created, deduplicated };
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npx vitest run src/lib/agent/zohoPoll.test.ts
  ```

  Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

  ```bash
  git add worker/src/lib/agent/zohoPoll.ts worker/src/lib/agent/zohoPoll.test.ts
  git commit -m "feat: add Zoho Desk ticket-polling logic with cursor-based dedup"
  ```

---

## Task 6: Wire the poll into `scheduled()`; remove the Freshdesk webhook route

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/routes/supportAgentIngest.ts` (delete
  `handleFreshdeskWebhook`)
- Test: `worker/src/routes/supportAgentIngest.test.ts` (delete any
  Freshdesk-webhook-specific test cases)

**Interfaces:**
- Consumes: `pollZohoDeskTickets` from Task 5.

- [ ] **Step 1: Remove the Freshdesk webhook handler**

  In `worker/src/routes/supportAgentIngest.ts`, delete the entire
  `handleFreshdeskWebhook` function (currently lines 87–125, from the
  `// ── POST /api/support-agent/freshdesk-webhook ──` comment through
  its closing `}`).

- [ ] **Step 2: Remove its route registration and import**

  In `worker/src/index.ts`:
  - Delete line 221's `handleFreshdeskWebhook` from the
    `supportAgentIngest.js` import list (keep the other imports on that
    line/block intact).
  - Delete lines 516–517 (the `// Freshdesk webhook — public but
    signature-verified internally` comment and its route match).

- [ ] **Step 3: Remove `verifySharedSecret` if it's now unused**

  ```bash
  cd worker
  grep -rn "verifySharedSecret" src/
  ```

  If the only remaining match is its own definition in
  `src/lib/agent/signatures.ts` and its test in
  `src/lib/agent/signatures.test.ts`, delete the function and its four
  matching test cases from both files (Freshdesk's webhook secret check
  was its only caller). If anything else still calls it, leave it in
  place.

- [ ] **Step 4: Wire the Zoho poll into `scheduled()`**

  In `worker/src/index.ts`, change the `scheduled()` signature (currently
  line 283) from:

  ```typescript
      async scheduled(_event: ScheduledController, env: Env): Promise<void> {
  ```

  to:

  ```typescript
      async scheduled(event: ScheduledController, env: Env): Promise<void> {
  ```

  Add this import near the top of the file, alongside the other
  `agent/*` imports:

  ```typescript
  import { pollZohoDeskTickets } from './lib/agent/zohoPoll.js';
  ```

  Then add a new numbered step at the end of the `scheduled()` body
  (after step 10, before the closing `},`):

  ```typescript
        // ── 11. Zoho Desk ticket poll (support agent ingestion) ────
        // Runs every 5-minute tick only — the other cron entries fire on
        // this same handler at daily/weekly cadence, so gate on
        // event.cron to avoid polling on every tick.
        if (event.cron === '*/5 * * * *') {
          await pollZohoDeskTickets(env);
        }
  ```

- [ ] **Step 5: Run the full worker test suite**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass, with the Freshdesk-webhook-specific cases in
  `supportAgentIngest.test.ts` and (if applicable) `signatures.test.ts`
  gone rather than failing.

- [ ] **Step 6: Commit**

  ```bash
  git add worker/src/index.ts worker/src/routes/supportAgentIngest.ts worker/src/routes/supportAgentIngest.test.ts worker/src/lib/agent/signatures.ts worker/src/lib/agent/signatures.test.ts
  git commit -m "feat: replace Freshdesk webhook ingestion with scheduled Zoho Desk polling"
  ```

---

## Task 7: Remove Freshdesk SSO; extend in-app support request to create a Zoho ticket

**Files:**
- Delete: `worker/src/routes/freshdesk-sso.ts`
- Delete: `worker/src/routes/freshdesk-sso.test.ts` (if it exists)
- Modify: `worker/src/index.ts` (remove the SSO route + import)
- Modify: `worker/src/routes/supportAgentIngest.ts`
  (`handleSupportAgentRequest`)
- Test: `worker/src/routes/supportAgentIngest.test.ts`

**Interfaces:**
- Consumes: `createZohoTicket` from Task 4.

- [ ] **Step 1: Delete the Freshdesk SSO route file and its test**

  ```bash
  cd worker
  rm src/routes/freshdesk-sso.ts
  test -f src/routes/freshdesk-sso.test.ts && rm src/routes/freshdesk-sso.test.ts
  ```

- [ ] **Step 2: Remove its registration from `index.ts`**

  Delete line 168 (`import { handleFreshdeskSso } from
  './routes/freshdesk-sso.js';`) and lines 705–706 (the `// Freshdesk SSO
  — parent only` comment and its route match).

- [ ] **Step 3: Write the failing test for the extended in-app request handler**

  Add to `worker/src/routes/supportAgentIngest.test.ts` (create the file
  with this import block if it doesn't already exist; otherwise add
  alongside existing tests):

  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { handleSupportAgentRequest } from './supportAgentIngest.js';

  describe('handleSupportAgentRequest — Zoho ticket creation', () => {
    it('still succeeds and enqueues the local incident even when Zoho ticket creation fails', async () => {
      const dbRun = vi.fn().mockResolvedValue(undefined);
      const dbPrepare = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ run: dbRun }) });
      const queueSend = vi.fn().mockResolvedValue(undefined);

      const env = {
        DB: { prepare: dbPrepare },
        INCIDENT_QUEUE: { send: queueSend },
        ZOHO_API_DOMAIN: 'https://desk.zoho.com',
        ZOHO_ACCOUNTS_DOMAIN: 'https://accounts.zoho.com',
        ZOHO_CLIENT_ID: 'x', ZOHO_CLIENT_SECRET: 'x', ZOHO_REFRESH_TOKEN: 'x',
        ZOHO_ORG_ID: 'x', ZOHO_DEPARTMENT_ID: 'x',
      } as never;

      // No global fetch mock configured — createZohoTicket's internal
      // fetch call will reject/fail, exercising the best-effort catch path.
      const request = {
        auth: { role: 'parent', family_id: 'fam_1', sub: 'user_1' },
        json: async () => ({ description: 'Cannot see my goals', screen: 'GoalsScreen' }),
      } as never;

      const res = await handleSupportAgentRequest(request, env);
      expect(res.status).toBe(200);
      expect(queueSend).toHaveBeenCalledOnce();
      const body = await res.json() as { received: boolean };
      expect(body.received).toBe(true);
    });
  });
  ```

- [ ] **Step 4: Run test to verify it fails (or errors on the missing behavior)**

  ```bash
  cd worker
  npx vitest run src/routes/supportAgentIngest.test.ts
  ```

  Expected: this specific test either fails or throws, since
  `handleSupportAgentRequest` doesn't yet look up the user's name/email
  for Zoho ticket creation.

- [ ] **Step 5: Extend `handleSupportAgentRequest`**

  In `worker/src/routes/supportAgentIngest.ts`, replace the existing
  `handleSupportAgentRequest` function (currently lines 132–164) with:

  ```typescript
  // ── POST /api/support-agent/request ──────────────────────────────────
  // Parent-only, authenticated. family_id comes from the verified JWT, not
  // from any text the parent typed — already a deterministic identity.
  // Best-effort also creates a real Zoho Desk ticket so a human agent has
  // something to work from; failure there never blocks the local incident.
  export async function handleSupportAgentRequest(request: Request, env: Env): Promise<Response> {
    const auth = (request as AuthedRequest).auth;
    if (auth.role !== 'parent') return error('Only parents can submit a support request', 403);

    let body: { description?: string; screen?: string };
    try {
      body = await request.json();
    } catch {
      return error('Invalid JSON body', 400);
    }

    const description = body.description?.trim();
    if (!description) return error('description required', 400);

    const incidentText = [
      `Screen: ${body.screen ?? '(unknown)'}`,
      `family_id: ${auth.family_id}`,
      `Description: ${description}`,
    ].join('\n');

    const incidentId = nanoid();
    await env.DB
      .prepare(`
        INSERT INTO agent_incidents (id, source, source_ref, user_facing, family_id, raw_payload)
        VALUES (?, 'in_app', ?, 1, ?, ?)
      `)
      .bind(incidentId, incidentId, auth.family_id, incidentText)
      .run();

    await env.INCIDENT_QUEUE.send({ incidentId } satisfies IncidentQueueMessage);

    const user = await env.DB
      .prepare('SELECT display_name AS name, email FROM users WHERE id = ?')
      .bind(auth.sub)
      .first<{ name: string; email: string }>();

    if (user) {
      await createZohoTicket(env, {
        subject: `Support request from app (${body.screen ?? 'unknown screen'})`,
        description,
        email: user.email,
        lastName: user.name,
      });
    }

    return json({ received: true, incident_id: incidentId });
  }
  ```

  Add the `createZohoTicket` import to the top of the file, alongside the
  existing `signatures.js` import:

  ```typescript
  import { createZohoTicket } from '../lib/agent/zoho.js';
  ```

- [ ] **Step 6: Run test to verify it passes**

  ```bash
  npx vitest run src/routes/supportAgentIngest.test.ts
  ```

  Expected: PASS.

- [ ] **Step 7: Run the full worker test suite**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add worker/src/routes/freshdesk-sso.ts worker/src/routes/supportAgentIngest.ts worker/src/routes/supportAgentIngest.test.ts worker/src/index.ts
  git commit -m "feat: remove Freshdesk SSO, create Zoho Desk ticket from in-app support requests"
  ```

  (Note: `git add` on a deleted file stages the deletion — this is
  correct.)

---

## Task 8: Frontend — replace the Freshdesk SSO button with a Contact Support form

**Files:**
- Modify: `app/src/components/settings/sections/SupportSettings.tsx`

**Interfaces:**
- Consumes: `POST /api/support-agent/request` (existing backend route,
  extended in Task 7 — no new backend work needed here).

- [ ] **Step 1: Simplify "Search the Help Desk" to a plain external link**

  In `app/src/components/settings/sections/SupportSettings.tsx`, replace
  the `<button>` block (currently lines 205–230, from `{/* ── Search the
  help desk` through its closing `</button>`) with a `LinkRow`, matching
  the existing pattern used for Privacy Policy / Terms below it:

  ```tsx
        {/* ── Search the help desk ── */}
        <SectionCard>
          <LinkRow
            icon={<Search size={15} />}
            label="Search the Help Desk"
            description="Browse guides, FAQs, and tutorials"
            href="https://support.morechard.com"
          />
        </SectionCard>
  ```

  Remove the now-unused `apiUrl` / `authHeaders` import if nothing else
  in the file uses them (check with `grep -n "apiUrl\|authHeaders"
  app/src/components/settings/sections/SupportSettings.tsx` after this
  edit — if Step 2 below introduces a new use of `apiUrl`/`authHeaders`,
  keep the import).

- [ ] **Step 2: Add Contact Support state and modal**

  Add a `showContactModal` state near the existing `sub` state
  (currently line 186):

  ```tsx
    const [sub, setSub] = useState<SubView>('menu')
    const [showContactModal, setShowContactModal] = useState(false)
    const [contactText, setContactText] = useState('')
    const [contactSubmitting, setContactSubmitting] = useState(false)
    const [contactError, setContactError] = useState<string | null>(null)
    const [contactSent, setContactSent] = useState(false)
  ```

  Add a submit handler above the `return` statement:

  ```tsx
    async function submitContactRequest() {
      const description = contactText.trim()
      if (!description) return
      setContactSubmitting(true)
      setContactError(null)
      try {
        const res = await fetch(apiUrl('/api/support-agent/request'), {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, screen: 'SupportSettings' }),
        })
        if (!res.ok) throw new Error('Request failed')
        setContactSent(true)
      } catch {
        setContactError('Could not send your message — please try again.')
      } finally {
        setContactSubmitting(false)
      }
    }
  ```

  Add a "Contact Support" row right below the Search the Help Desk
  `SectionCard` from Step 1:

  ```tsx
        {/* ── Contact support ── */}
        <SectionCard>
          <button
            type="button"
            onClick={() => { setShowContactModal(true); setContactSent(false); setContactError(null) }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-surface-alt)] active:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
          >
            <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
              <Search size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">Contact Support</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                Send us a message — we'll get back to you by email
              </p>
            </div>
            <ChevronRight size={15} className="shrink-0 text-[var(--color-text-muted)]" />
          </button>
        </SectionCard>
  ```

  Add the modal itself just before the component's final closing `</div>`
  (after the "Version" `SectionCard`, matching the inline-modal pattern
  used in `ProfileSettings.tsx`'s `showLeaveModal` / `showUprootModal`):

  ```tsx
        {/* Contact Support Modal */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-[var(--color-text)]">Contact Support</p>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="tap-target-44 text-[var(--color-text-muted)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {contactSent ? (
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  Thanks — we've received your message and will get back to you by email.
                </p>
              ) : (
                <>
                  <textarea
                    value={contactText}
                    onChange={(e) => setContactText(e.target.value)}
                    placeholder="What's going on?"
                    rows={4}
                    className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-[13px] text-[var(--color-text)] bg-[var(--color-surface)]"
                  />
                  {contactError && (
                    <p className="text-[12px] text-red-600">{contactError}</p>
                  )}
                  <button
                    type="button"
                    disabled={contactSubmitting || !contactText.trim()}
                    onClick={submitContactRequest}
                    className="w-full py-3 rounded-xl bg-[var(--brand-primary)] text-white text-[14px] font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {contactSubmitting ? 'Sending…' : 'Send'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
  ```

- [ ] **Step 3: Manually verify in the dev server**

  ```bash
  npm run dev
  ```

  Navigate to Settings → Help & Support as a logged-in parent. Confirm:
  - "Search the Help Desk" opens `support.morechard.com` in a new tab
    (plain link, no fetch/loading state).
  - "Contact Support" opens the modal, and submitting a message shows the
    "Thanks — we've received your message" confirmation.

- [ ] **Step 4: Commit**

  ```bash
  git add app/src/components/settings/sections/SupportSettings.tsx
  git commit -m "feat: replace Freshdesk SSO button with in-app Contact Support form"
  ```

---

## Task 9: Update docs

**Files:**
- Modify: `docs/support/README.md`
- Modify: `docs/dev/support-agent-runbook.md`

- [ ] **Step 1: Update `docs/support/README.md`**

  Find and replace every reference to Freshdesk as the ticketing system
  (the `eagereverest.freshdesk.com` portal line near the top, and the
  `**Ticketing:**` bullet under "The support model") with the Zoho Desk
  equivalent — your org's actual `desk.zoho.com` portal URL, and note
  that agent SSO into the portal isn't available on the free tier (link
  out via the in-app Contact Support form instead, per Task 8). Remove
  the `GET /api/freshdesk-sso` / `FRESHDESK_SSO_SECRET` sentence entirely
  — that route no longer exists.

- [ ] **Step 2: Update `docs/dev/support-agent-runbook.md`**

  Replace the "New secrets (production)" table's Freshdesk rows with:

  | Secret | Purpose |
  |---|---|
  | `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | Zoho Desk API — self-client OAuth (Task 1 of the migration plan) |
  | `ZOHO_ORG_ID` / `ZOHO_DEPARTMENT_ID` | Zoho account/department identifiers |

  Replace the "One-time manual setup" Freshdesk bullet with a pointer to
  Task 1 of
  `docs/superpowers/plans/2026-07-14-freshdesk-to-zoho-desk-migration.md`
  for the Self Client / refresh-token generation steps.

  Update "Keeping the playbook in sync" — unaffected, leave as-is.

  Add a note under "Known Phase 0 limitations": *"Zoho Desk ingestion is
  poll-based (every 5 minutes), not webhook-push, because Zoho's free
  tier doesn't support outgoing webhooks — expect up to a ~5–10 minute
  delay between a ticket landing in Zoho and its incident appearing in
  the review queue, not the near-instant delivery Sentry/Stripe get."*

- [ ] **Step 3: Commit**

  ```bash
  git add docs/support/README.md docs/dev/support-agent-runbook.md
  git commit -m "docs: update support playbook and runbook for Zoho Desk migration"
  ```

---

## Task 10: Deploy and verify

**Files:** None — deployment/verification only.

- [ ] **Step 1: Apply the D1 migration to production** (if not already
  done as part of Task 2)

  ```bash
  cd worker
  npx wrangler d1 migrations apply morechard --remote --env production
  ```

- [ ] **Step 2: Confirm all Task 3 secrets are set**

  ```bash
  npx wrangler secret list --env production
  ```

  Expected: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`,
  `ZOHO_ORG_ID`, `ZOHO_DEPARTMENT_ID` present; `FRESHDESK_WEBHOOK_SECRET`
  absent.

- [ ] **Step 3: Deploy**

  ```bash
  npx wrangler deploy --env production
  ```

  Expected output includes the new `*/5 * * * *` schedule alongside the
  four existing ones.

- [ ] **Step 4: Confirm the poll runs and creates a real incident**

  Create a test ticket directly in the Zoho Desk UI (Setup → any
  department → New Ticket, or via the customer-facing portal). Wait up
  to 5–10 minutes, then check:

  ```bash
  npx wrangler d1 execute morechard --remote --env production \
    --command="SELECT id, source, source_ref, status, created_at FROM agent_incidents WHERE source = 'zoho_desk' ORDER BY created_at DESC LIMIT 5"
  ```

  Expected: a row for the test ticket, `status` progressing from
  `received` toward `escalated` or a review-queue bucket as
  `processIncident` runs.

- [ ] **Step 5: Confirm the in-app Contact Support flow creates a Zoho ticket**

  Submit a test message via the app's new Contact Support modal (Task
  8). Check the Zoho Desk UI for a newly created ticket in the configured
  department, and confirm a corresponding `source = 'in_app'` row also
  landed in `agent_incidents` (should be immediate, not poll-delayed,
  since `handleSupportAgentRequest` writes it directly).
