# Marketing Consent & Email Re-engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GDPR-compliant marketing consent to registration and build the full infrastructure (DB, API, EmailService stub, daily cron) to send trial-expiry and re-engagement emails once a provider is chosen.

**Architecture:** A `marketing_consents` table (audit trail per user) and `email_sends` table (GDPR log + cron deduplication) are added via a D1 migration. Two API endpoints record and retrieve consent. An `EmailService` class in the worker stubs sending and logs every attempt. A daily Cloudflare Cron queries cohorts of unconverted trial families and calls `EmailService`. The registration UI adds a mandatory radio question in Stage 1 (forced choice, no default); the actual consent POST fires at Step 2 when the family record exists and a JWT is available.

**Tech Stack:** Cloudflare D1 (SQL), Cloudflare Workers (TypeScript), React (TypeScript), Tailwind CSS, Vite

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `worker/migrations/0047_marketing_consent.sql` | Create | DB tables: `marketing_consents`, `email_sends` |
| `worker/src/lib/consent-versions.ts` | Create | Consent wording constants, version map |
| `worker/src/lib/email.ts` | Create | `EmailService` class, `TEMPLATES` constants |
| `worker/src/routes/consent.ts` | Create | `POST /api/consent/marketing`, `GET /api/consent/marketing` |
| `worker/src/cron/marketing-emails.ts` | Create | Daily cron: 6 cohort queries → `EmailService.sendEmail()` |
| `worker/src/index.ts` | Modify | Import + register consent routes; add cron step 5 |
| `worker/wrangler.toml` | Modify | Add `"0 6 * * *"` to crons array |
| `app/src/components/registration/Stage1ParentIdentity.tsx` | Modify | Add `marketingConsent` radio state + validation |
| `app/src/components/registration/RegistrationShell.tsx` | Modify | Pass `marketing_consent` in state; POST consent after `createFamily` |
| `app/src/lib/api.ts` | Modify | Add `postMarketingConsent()` and `getMarketingConsent()` functions |

---

## Task 1: DB Migration

**Files:**
- Create: `worker/migrations/0047_marketing_consent.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 0047: marketing consent + email send log

CREATE TABLE IF NOT EXISTS marketing_consents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL REFERENCES users(id),
  consented       INTEGER NOT NULL CHECK (consented IN (0, 1)),
  consent_version TEXT    NOT NULL,
  ip_address      TEXT    NOT NULL,
  consented_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_marketing_consents_user
  ON marketing_consents (user_id, consented_at DESC);

CREATE TABLE IF NOT EXISTS email_sends (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             TEXT    NOT NULL REFERENCES users(id),
  family_id           TEXT    NOT NULL REFERENCES families(id),
  template_id         TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at             INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_sends_family_template
  ON email_sends (family_id, template_id);
```

- [ ] **Step 2: Apply the migration locally**

Run from the `worker/` directory:
```bash
npx wrangler d1 execute morechard-db --local --file=migrations/0047_marketing_consent.sql
```

Expected output:
```
🌀 Executing on local database morechard-db...
✅ Applied 0047_marketing_consent.sql
```

- [ ] **Step 3: Commit**

```bash
git add worker/migrations/0047_marketing_consent.sql
git commit -m "feat(db): add marketing_consents and email_sends tables"
```

---

## Task 2: Consent Wording Constants

**Files:**
- Create: `worker/src/lib/consent-versions.ts`

- [ ] **Step 1: Create the constants file**

```typescript
export const CONSENT_VERSIONS: Record<string, string> = {
  v1: 'Can Morechard send you tips, updates, and offers by email?',
}

export const CURRENT_CONSENT_VERSION = 'v1'
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/lib/consent-versions.ts
git commit -m "feat(consent): add consent version wording constants"
```

---

## Task 3: EmailService Stub

**Files:**
- Create: `worker/src/lib/email.ts`

- [ ] **Step 1: Create the EmailService file**

```typescript
import { Env } from '../types.js'

export const TEMPLATES = {
  TRIAL_EXPIRING_SOON:  'trial_expiring_soon',
  TRIAL_EXPIRED:        'trial_expired',
  RE_ENGAGEMENT_W1:     're_engagement_w1',
  RE_ENGAGEMENT_W4:     're_engagement_w4',
  RE_ENGAGEMENT_W12:    're_engagement_w12',
  RE_ENGAGEMENT_W12_AI: 're_engagement_w12_ai',
  FEATURE_ANNOUNCE:     'feature_announce',
} as const

export type TemplateId = typeof TEMPLATES[keyof typeof TEMPLATES]

export class EmailNotConfiguredError extends Error {
  constructor() { super('Email provider not configured') }
}

export class EmailService {
  constructor(private env: Env) {}

  async sendEmail(
    to: string,
    templateId: TemplateId,
    userId: string,
    familyId: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const sendId = await this.logSend(userId, familyId, templateId)
    try {
      await this.dispatchEmail(to, templateId, data)
      await this.updateSendStatus(sendId, 'sent')
    } catch {
      await this.updateSendStatus(sendId, 'failed')
    }
  }

  private async dispatchEmail(
    to: string,
    templateId: TemplateId,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (this.env.ENVIRONMENT === 'development') {
      console.log('[EmailService] stub send', { to, templateId, data })
      return
    }
    throw new EmailNotConfiguredError()
  }

  private async logSend(userId: string, familyId: string, templateId: string): Promise<number> {
    const result = await this.env.DB
      .prepare(`INSERT INTO email_sends (user_id, family_id, template_id, status)
                VALUES (?, ?, ?, 'pending')`)
      .bind(userId, familyId, templateId)
      .run()
    return result.meta.last_row_id as number
  }

  private async updateSendStatus(
    id: number,
    status: 'sent' | 'failed',
    providerMessageId?: string,
  ): Promise<void> {
    await this.env.DB
      .prepare(`UPDATE email_sends
                SET status = ?, provider_message_id = ?, sent_at = CASE WHEN ? = 'sent' THEN unixepoch() ELSE NULL END
                WHERE id = ?`)
      .bind(status, providerMessageId ?? null, status, id)
      .run()
  }
}
```

- [ ] **Step 2: Verify `Env` has `ENVIRONMENT` binding**

Check `worker/src/types.ts` for the `Env` interface. If `ENVIRONMENT` is missing, add it:

```typescript
// In worker/src/types.ts, inside the Env interface:
ENVIRONMENT?: string
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/email.ts worker/src/types.ts
git commit -m "feat(email): add EmailService stub with TEMPLATES constants"
```

---

## Task 4: Consent API Routes

**Files:**
- Create: `worker/src/routes/consent.ts`

- [ ] **Step 1: Create the consent route file**

```typescript
import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { CURRENT_CONSENT_VERSION } from '../lib/consent-versions.js'

type AuthedRequest = Request & { auth: JwtPayload }

// POST /api/consent/marketing
export async function handleConsentPost(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  let body: { consented?: unknown }
  try { body = await request.json() } catch { return error('Invalid JSON', 400) }

  if (typeof body.consented !== 'boolean') {
    return error('consented must be a boolean', 400)
  }

  const ip = request.headers.get('CF-Connecting-IP')
           ?? request.headers.get('X-Forwarded-For')
           ?? 'unknown'

  await env.DB
    .prepare(`INSERT INTO marketing_consents (user_id, consented, consent_version, ip_address)
              VALUES (?, ?, ?, ?)`)
    .bind(auth.sub, body.consented ? 1 : 0, CURRENT_CONSENT_VERSION, ip)
    .run()

  return json({ ok: true })
}

// GET /api/consent/marketing
export async function handleConsentGet(request: Request, env: Env): Promise<Response> {
  const auth = (request as AuthedRequest).auth
  if (auth.role !== 'parent') return error('Parents only', 403)

  const row = await env.DB
    .prepare(`SELECT consented, consent_version FROM marketing_consents
              WHERE user_id = ? ORDER BY consented_at DESC LIMIT 1`)
    .bind(auth.sub)
    .first<{ consented: number; consent_version: string }>()

  if (!row) return json({ consented: null, consent_version: null })

  return json({ consented: row.consented === 1, consent_version: row.consent_version })
}
```

- [ ] **Step 2: Register routes in `worker/src/index.ts`**

Add the import near the top with other route imports:
```typescript
import { handleConsentPost, handleConsentGet } from './routes/consent.js'
```

Add to the route comment block at the top of the file (inside the JSDoc):
```
 *   POST   /api/consent/marketing     Record marketing consent decision
 *   GET    /api/consent/marketing     Get current consent record
```

Add the route handlers inside the authenticated parent-only section (near `/api/settings`):
```typescript
  if (path === '/api/consent/marketing' && method === 'POST') return withAuth(request, auth, env, handleConsentPost)
  if (path === '/api/consent/marketing' && method === 'GET')  return withAuth(request, auth, env, handleConsentGet)
```

- [ ] **Step 3: Test the routes manually**

Start the dev worker:
```bash
cd worker && npm run dev
```

Test POST (replace TOKEN with a real parent JWT from local dev login):
```bash
curl -X POST http://localhost:8787/api/consent/marketing \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"consented": true}'
```
Expected: `{"ok":true}`

Test GET:
```bash
curl http://localhost:8787/api/consent/marketing \
  -H "Authorization: Bearer TOKEN"
```
Expected: `{"consented":true,"consent_version":"v1"}`

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/consent.ts worker/src/index.ts
git commit -m "feat(api): add POST/GET /api/consent/marketing endpoints"
```

---

## Task 5: Cron Trigger

**Files:**
- Create: `worker/src/cron/marketing-emails.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Create `worker/src/cron/` directory and the cron file**

```typescript
import { Env } from '../types.js'
import { EmailService, TEMPLATES, TemplateId } from '../lib/email.js'

interface CohortRow {
  user_id:   string
  family_id: string
  email:     string
  has_ai_mentor: number
}

export async function runMarketingEmails(env: Env): Promise<void> {
  const emailService = new EmailService(env)

  await sendCohort(env, emailService, 12, TEMPLATES.TRIAL_EXPIRING_SOON)
  await sendCohort(env, emailService, 15, TEMPLATES.TRIAL_EXPIRED)
  await sendCohort(env, emailService, 21, TEMPLATES.RE_ENGAGEMENT_W1)
  await sendCohort(env, emailService, 42, TEMPLATES.RE_ENGAGEMENT_W4)
  await sendWeek12Cohort(env, emailService)
}

async function sendCohort(
  env: Env,
  emailService: EmailService,
  offsetDays: number,
  templateId: TemplateId,
): Promise<void> {
  const rows = await env.DB
    .prepare(`
      SELECT u.id AS user_id, f.id AS family_id, u.email, f.has_ai_mentor
      FROM families f
      INNER JOIN users u ON u.family_id = f.id AND u.granted_by IS NULL
      INNER JOIN (
        SELECT user_id, consented
        FROM marketing_consents
        WHERE (user_id, consented_at) IN (
          SELECT user_id, MAX(consented_at) FROM marketing_consents GROUP BY user_id
        )
      ) mc ON mc.user_id = u.id AND mc.consented = 1
      LEFT JOIN email_sends es ON es.family_id = f.id AND es.template_id = ?
      WHERE f.has_lifetime_license = 0
        AND f.deleted_at IS NULL
        AND f.trial_start_date IS NOT NULL
        AND date(f.trial_start_date, '+' || ? || ' days') = date('now')
        AND es.id IS NULL
    `)
    .bind(templateId, offsetDays)
    .all<CohortRow>()

  for (const row of rows.results) {
    if (!row.email) continue
    await emailService.sendEmail(row.email, templateId, row.user_id, row.family_id, {})
  }
}

async function sendWeek12Cohort(env: Env, emailService: EmailService): Promise<void> {
  const rows = await env.DB
    .prepare(`
      SELECT u.id AS user_id, f.id AS family_id, u.email, f.has_ai_mentor
      FROM families f
      INNER JOIN users u ON u.family_id = f.id AND u.granted_by IS NULL
      INNER JOIN (
        SELECT user_id, consented
        FROM marketing_consents
        WHERE (user_id, consented_at) IN (
          SELECT user_id, MAX(consented_at) FROM marketing_consents GROUP BY user_id
        )
      ) mc ON mc.user_id = u.id AND mc.consented = 1
      LEFT JOIN email_sends es_base ON es_base.family_id = f.id AND es_base.template_id = ?
      LEFT JOIN email_sends es_ai   ON es_ai.family_id   = f.id AND es_ai.template_id   = ?
      WHERE f.has_lifetime_license = 0
        AND f.deleted_at IS NULL
        AND f.trial_start_date IS NOT NULL
        AND date(f.trial_start_date, '+98 days') = date('now')
        AND es_base.id IS NULL
        AND es_ai.id   IS NULL
    `)
    .bind(TEMPLATES.RE_ENGAGEMENT_W12, TEMPLATES.RE_ENGAGEMENT_W12_AI)
    .all<CohortRow>()

  for (const row of rows.results) {
    if (!row.email) continue
    const templateId = row.has_ai_mentor === 0
      ? TEMPLATES.RE_ENGAGEMENT_W12_AI
      : TEMPLATES.RE_ENGAGEMENT_W12
    await emailService.sendEmail(row.email, templateId, row.user_id, row.family_id, {})
  }
}
```

- [ ] **Step 2: Register the cron in `worker/src/index.ts`**

Add the import near the top:
```typescript
import { runMarketingEmails } from './cron/marketing-emails.js'
```

Add as step 5 inside the `scheduled()` handler, after the existing step 4:
```typescript
    // ── 5. Marketing re-engagement emails ──────────────────────
    await runMarketingEmails(env);
```

- [ ] **Step 3: Add the cron schedule to `worker/wrangler.toml`**

Find the existing `[triggers]` section:
```toml
[triggers]
crons = ["0 8 * * 6", "0 3 * * 1"]
```

Add the new daily 06:00 UTC trigger:
```toml
[triggers]
crons = ["0 8 * * 6", "0 3 * * 1", "0 6 * * *"]
```

- [ ] **Step 4: Verify the cron compiles**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/cron/marketing-emails.ts worker/src/index.ts worker/wrangler.toml
git commit -m "feat(cron): add daily marketing email cron trigger with 6 cohorts"
```

---

## Task 6: Frontend — Stage 1 Radio Question

**Files:**
- Modify: `app/src/components/registration/Stage1ParentIdentity.tsx`

- [ ] **Step 1: Add `marketingConsent` state and validation to Stage1ParentIdentity**

In the component, add the new state variable after the existing `useState` declarations (around line 57):
```typescript
  const [marketingConsent, setMarketingConsent] = useState<boolean | null>(
    data.marketing_consent ?? null
  )
```

Update `canContinue` (line 61) to require a consent choice:
```typescript
  const canContinue = !!displayName.trim() && isValidEmail(email) && password.length >= 8 && marketingConsent !== null
```

Add `marketing_consent` to the errors object (inside the `errors` declaration):
```typescript
  const errors = {
    displayName:      !displayName.trim()      ? 'Your name is required' : '',
    email:            !isValidEmail(email)     ? 'Enter a valid email address' : '',
    password:         password.length < 8     ? 'Minimum 8 characters' : '',
    marketingConsent: marketingConsent === null ? 'Please make a selection' : '',
  }
```

Update `handleNext` to include `marketing_consent` in the patch:
```typescript
  function handleNext() {
    setSubmitted(true)
    if (errors.displayName || errors.email || errors.password || errors.marketingConsent) return
    vibrate()
    onNext({
      display_name:       displayName.trim(),
      email:              email.toLowerCase().trim(),
      password,
      parenting_mode:     parentingMode,
      governance_mode:    parentingMode === 'co-parenting' ? 'standard' : 'amicable',
      marketing_consent:  marketingConsent!,
    })
  }
```

- [ ] **Step 2: Add the radio group JSX**

Insert the following block **after** the closing `</div>` of the Password + strength section (after line 233) and **before** the CTA button:

```tsx
      {/* ── Marketing consent ────────────────────────────────────── */}
      <fieldset>
        <legend className={cn(
          'text-sm font-semibold mb-3',
          (submitted && errors.marketingConsent) ? 'text-red-500' : 'text-gray-700',
        )}>
          Can Morechard send you tips, updates, and offers by email?
        </legend>
        <div className="flex flex-col gap-2">
          {([
            { value: true,  label: 'Yes, that\'s fine' },
            { value: false, label: 'No thanks' },
          ] as const).map(({ value, label }) => (
            <label
              key={String(value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all duration-150',
                marketingConsent === value
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 bg-white hover:border-teal-300',
              )}
            >
              <input
                type="radio"
                name="marketing_consent"
                value={String(value)}
                checked={marketingConsent === value}
                onChange={() => setMarketingConsent(value)}
                className="accent-teal-600 w-4 h-4 shrink-0"
              />
              <span className={cn(
                'text-sm font-medium',
                marketingConsent === value ? 'text-teal-700' : 'text-gray-700',
              )}>
                {label}
              </span>
            </label>
          ))}
        </div>
        {submitted && errors.marketingConsent && (
          <p className="text-xs text-red-500 font-medium pl-1 mt-1.5">
            {errors.marketingConsent}
          </p>
        )}
      </fieldset>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/registration/Stage1ParentIdentity.tsx
git commit -m "feat(ui): add mandatory marketing consent radio to Stage 1 registration"
```

---

## Task 7: Frontend — RegistrationState + API + Consent POST

**Files:**
- Modify: `app/src/components/registration/RegistrationShell.tsx`
- Modify: `app/src/lib/api.ts`

- [ ] **Step 1: Add `marketing_consent` to `RegistrationState`**

In `RegistrationShell.tsx`, find the `RegistrationState` interface and add the new field after `governance_mode?`:
```typescript
  marketing_consent?: boolean
```

- [ ] **Step 2: Add API functions to `app/src/lib/api.ts`**

Add these two functions to `api.ts` after the existing helper functions:
```typescript
export async function postMarketingConsent(consented: boolean): Promise<void> {
  await request<{ ok: boolean }>('/api/consent/marketing', {
    method: 'POST',
    body: JSON.stringify({ consented }),
  })
}

export async function getMarketingConsent(): Promise<{ consented: boolean | null; consent_version: string | null }> {
  return request<{ consented: boolean | null; consent_version: string | null }>(
    '/api/consent/marketing',
  )
}
```

- [ ] **Step 3: Post consent after `createFamily` in `RegistrationShell.tsx`**

Find the import line at the top that imports from `@/lib/api` and add the new functions:
```typescript
import { createFamily, requestMagicLink, saveRegistrationStep, postMarketingConsent } from '@/lib/api'
```

In `advanceStep`, find the `if (step === 2)` block. After `setState(merged)` and before `await requestMagicLink(merged.email!)`, add the consent POST (silent failure — never blocks registration):

```typescript
          // Post marketing consent — silent failure never blocks registration
          if (typeof merged.marketing_consent === 'boolean') {
            postMarketingConsent(merged.marketing_consent).catch(err => {
              console.error('[consent] failed to record marketing consent:', err)
            })
          }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/registration/RegistrationShell.tsx app/src/lib/api.ts
git commit -m "feat(registration): post marketing consent after family creation"
```

---

## Task 8: Smoke Test End-to-End

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Complete a fresh registration flow**

Navigate to the registration screen. Confirm:
- Stage 1 shows the radio question below the password field
- The "Continue" button stays disabled until a radio option is selected
- Selecting "Yes, that's fine" or "No thanks" enables Continue
- An error message appears if you tap Continue before selecting

- [ ] **Step 3: Verify consent was recorded**

After completing registration through to the parent dashboard, check the local D1 database:

```bash
cd worker && npx wrangler d1 execute morechard-db --local \
  --command="SELECT * FROM marketing_consents ORDER BY consented_at DESC LIMIT 5"
```

Expected: one row for the newly registered user with `consented = 1` (or `0`), `consent_version = 'v1'`.

- [ ] **Step 4: Verify GET endpoint returns the record**

```bash
curl http://localhost:8787/api/consent/marketing \
  -H "Authorization: Bearer <JWT from login>"
```

Expected: `{"consented":true,"consent_version":"v1"}`

- [ ] **Step 5: Commit smoke test confirmation**

If any fixes were needed, commit them. Otherwise:
```bash
git commit --allow-empty -m "chore: smoke test marketing consent flow verified"
```

---

## Task 9: Deploy to Production

- [ ] **Step 1: Apply migration to production D1**

```bash
cd worker && npx wrangler d1 execute morechard-db --remote --file=migrations/0047_marketing_consent.sql
```

Expected: `✅ Applied 0047_marketing_consent.sql`

- [ ] **Step 2: Deploy the worker**

```bash
cd worker && npx wrangler deploy
```

- [ ] **Step 3: Deploy the frontend**

```bash
git push
```

Cloudflare Pages will auto-build and deploy from the push.

- [ ] **Step 4: Verify production**

Register a test account on production and confirm the consent radio appears. Check the production D1 via Cloudflare dashboard → D1 → morechard-db → Console:
```sql
SELECT * FROM marketing_consents ORDER BY consented_at DESC LIMIT 3;
```

---

## Notes for Provider Wiring (Future)

When you choose an email provider (Resend recommended), the only file to change is `worker/src/lib/email.ts`. Replace the `dispatchEmail` method body with:

```typescript
// Example for Resend:
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'Morechard <hello@morechard.com>',
    to,
    subject: TEMPLATE_SUBJECTS[templateId],
    html: TEMPLATE_HTML[templateId](data),
  }),
})
const json = await res.json<{ id?: string }>()
return json.id  // becomes providerMessageId
```

Add `RESEND_API_KEY` to `wrangler.toml` secrets and the `Env` interface. Everything else — logging, deduplication, cron — works immediately.
