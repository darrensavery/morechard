# Marketing Consent & Email Re-engagement — Design Spec
Date: 2026-04-28
Revised: 2026-04-28 (v2 — incorporates business rule alignment review)

## Overview

Harvest GDPR-compliant marketing consent during parent registration and build the infrastructure to send trial reminder and re-engagement emails once a provider is chosen. Email sending is stubbed — the cron trigger and consent pipeline are fully functional from day one.

---

## 1. Database

### `marketing_consents` table (new migration)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | TEXT NOT NULL | FK → `users(id)` |
| `consented` | INTEGER NOT NULL | 1 = yes, 0 = no |
| `consent_version` | TEXT NOT NULL | e.g. `"v1"` — maps to exact wording in constants file |
| `ip_address` | TEXT NOT NULL | from request headers |
| `consented_at` | INTEGER NOT NULL DEFAULT (unixepoch()) | |

One row per consent event. If wording changes, a new row is inserted with bumped `consent_version` rather than updating in place. The latest row per `user_id` is the active consent record.

### `email_sends` table (new migration)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | TEXT NOT NULL | FK → `users(id)` |
| `family_id` | TEXT NOT NULL | FK → `families(id)` |
| `template_id` | TEXT NOT NULL | matches TEMPLATES constants |
| `status` | TEXT NOT NULL | `'pending'` \| `'sent'` \| `'failed'` |
| `provider_message_id` | TEXT | NULL until provider confirms send |
| `created_at` | INTEGER NOT NULL DEFAULT (unixepoch()) | |
| `sent_at` | INTEGER | NULL until sent |

This table serves two purposes: GDPR accountability (what was sent to whom and when) and cron deduplication (prevents re-sending the same template to the same family).

**Deduplication index:** `(family_id, template_id)` — deduplication is by household, not individual user, to prevent two parents in the same family both receiving the same "Trial Expiring" notice. Only one send per template per family is permitted.

---

## 2. API Endpoints

### `POST /api/consent/marketing`

Records the user's consent decision.

**Auth:** Requires valid session JWT (parent role).

**Request body:**
```json
{ "consented": true | false }
```

**Behaviour:**
- Inserts a row into `marketing_consents` with `user_id` from JWT, `consented`, `consent_version` from the current constant, and `ip_address` from request headers.
- Returns `200 { ok: true }` regardless of the consent value — "No" is a valid recorded decision.
- Called at the end of Stage 1's submit flow, after the auth response returns a `userId`. Failure is silent (logged, never blocks registration).

**Silent failure & GDPR safety:** if this POST fails, the user has no `marketing_consents` row. The cron uses a strict `INNER JOIN` on `marketing_consents` — a missing row is treated identically to `consented = 0`. No consent record = no emails. This is the safe default.

### `GET /api/consent/marketing`

Returns the user's current consent record.

**Auth:** Requires valid session JWT (parent role).

**Response:**
```json
{ "consented": true | false | null, "consent_version": "v1" | null }
```

`null` means no consent record exists yet — treated as unanswered, UI forces a choice.

**Pre-population behaviour:** if the user re-enters the registration flow:
- `consented: true` → pre-selects "Yes, that's fine"
- `consented: false` → pre-selects "No thanks" — their previous "No" is honoured, not overridden
- `consented: null` → no pre-selection, forced choice as normal

---

## 3. EmailService Stub

**File:** `worker/src/lib/email.ts`

### Template constants

```typescript
export const TEMPLATES = {
  TRIAL_EXPIRING_SOON:   'trial_expiring_soon',   // day 12
  TRIAL_EXPIRED:         'trial_expired',           // day 15
  RE_ENGAGEMENT_W1:      're_engagement_w1',         // 7 days post-expiry
  RE_ENGAGEMENT_W4:      're_engagement_w4',         // 28 days post-expiry
  RE_ENGAGEMENT_W12:     're_engagement_w12',        // 84 days post-expiry
  RE_ENGAGEMENT_W12_AI:  're_engagement_w12_ai',     // 84 days post-expiry, AI Mentor variant
  FEATURE_ANNOUNCE:      'feature_announce',         // ad-hoc
}
```

`RE_ENGAGEMENT_W12` and `RE_ENGAGEMENT_W12_AI` are two variants of the same send slot — the cron selects one based on whether the family holds an AI Mentor licence. See Section 4.

All template IDs use lowercase with underscores — no internal product jargon, no terms like "maker", "custodian", or plan code names that would be confusing if they leaked into provider dashboards.

### EmailService class

```typescript
class EmailService {
  sendEmail(to: string, templateId: string, data: Record<string, unknown>): Promise<void>
  private logSend(userId: string, familyId: string, templateId: string): Promise<number>
  private updateSendStatus(id: number, status: 'sent'|'failed', providerMessageId?: string): Promise<void>
}
```

**`sendEmail` flow:**
1. Calls `logSend` → inserts `pending` row into `email_sends`, returns row `id`.
2. Attempts provider send:
   - **Dev:** `console.log` with template and data, resolves immediately.
   - **Prod (stub):** throws `EmailNotConfiguredError`.
3. On success: calls `updateSendStatus(id, 'sent', providerMessageId)`.
4. On failure: calls `updateSendStatus(id, 'failed')`, swallows error (does not propagate to caller).

**To wire up a provider:** replace step 2's stub body with a single provider API call. Everything else — logging, cron, templates — remains unchanged.

### Consent wording constant

**File:** `worker/src/lib/consent-versions.ts`

```typescript
export const CONSENT_VERSIONS = {
  v1: "Can Morechard send you tips, updates, and offers by email?",
}
export const CURRENT_CONSENT_VERSION = 'v1'
```

The registration UI imports `CURRENT_CONSENT_VERSION` to display the question. The API imports it to write `consent_version` into the DB. The two can never drift apart. Wording is family-friendly — no internal terminology.

---

## 4. Cron Trigger

**File:** `worker/src/cron/marketing-emails.ts`

**Schedule:** `0 6 * * *` (daily at 06:00 UTC) — registered in `wrangler.toml` alongside the existing market-rates cron.

### Plan logic

The `families` table tracks licences via three boolean columns:
- `has_lifetime_license` — holds Complete (base tracker) or any higher plan
- `has_ai_mentor` — AI Mentor add-on (not included in any base plan by default)
- `has_shield` — Shield plan (forensic/legal bundle)

For re-engagement purposes:
- A family is a **re-engagement target** if `has_lifetime_license = 0` (trial ended, did not purchase).
- The **AI Mentor variant** of the week-12 email is sent only if `has_ai_mentor = 0` — suggesting the AI Mentor as a reason to return only makes sense if they don't already have it. Shield users who lack the AI Mentor are eligible for this variant too (Shield does not bundle AI Mentor).

### Cohort queries

Each cohort:
1. Queries `families` filtered by `trial_start_date` offset and `has_lifetime_license = 0`.
2. **INNER JOINs** `marketing_consents` (latest row per `user_id`, `consented = 1`) — strict join, families with no consent record are excluded.
3. Joins `users` (lead parent only — `role = 'parent'`, `granted_by IS NULL`) to get one email address per family.
4. Left joins `email_sends` on `(family_id, template_id)` to exclude families already sent this template.
5. Calls `EmailService.sendEmail()` for each match.

| Cohort | Offset from `trial_start_date` | Template | Condition |
|---|---|---|---|
| Trial expiring soon | +12 days | `TRIAL_EXPIRING_SOON` | `has_lifetime_license = 0` |
| Trial just expired | +15 days | `TRIAL_EXPIRED` | `has_lifetime_license = 0` |
| Re-engagement week 1 | +21 days | `RE_ENGAGEMENT_W1` | `has_lifetime_license = 0` |
| Re-engagement week 4 | +42 days | `RE_ENGAGEMENT_W4` | `has_lifetime_license = 0` |
| Re-engagement week 12 (base) | +98 days | `RE_ENGAGEMENT_W12` | `has_lifetime_license = 0` |
| Re-engagement week 12 (AI) | +98 days | `RE_ENGAGEMENT_W12_AI` | `has_lifetime_license = 0 AND has_ai_mentor = 0` |

The week-12 slot sends one of the two variants — the AI variant takes precedence if the condition is met; the base variant is the fallback. The `email_sends` deduplication check covers both template IDs so only one week-12 email is ever sent per family.

**Deduplication:** the `email_sends` left join on `(family_id, template_id)` is the sole guard against duplicate sends. One email per template per household.

**Consent enforcement:** the strict `INNER JOIN` on `marketing_consents` means families with no consent record (failed POST, or answered "No") never receive emails.

---

## 5. Registration UI

**File:** `app/src/components/registration/Stage1ParentIdentity.tsx`

A required radio group is added below the email field.

**Question (rendered from `CURRENT_CONSENT_VERSION` constant):**
> Can Morechard send you tips, updates, and offers by email?

**Options:**
- `Yes, that's fine` → `consented: true`
- `No thanks` → `consented: false`

**Behaviour:**
- `canContinue` remains `false` until a radio option is selected — forced choice, no default.
- Error state displayed if the user attempts to proceed without selecting (matches existing field validation pattern).
- Selected value is passed forward in the registration `data` object.
- After the auth response returns `userId` at the end of Stage 1's submit, `POST /api/consent/marketing` is called with the selected value.
- If the consent POST fails, it fails silently (console error only) — registration is never blocked.
- On re-entry to Stage 1 (e.g. magic link flow), `GET /api/consent/marketing` is called and the result pre-populates the radio. A previous "No thanks" is respected — the user is not forced to reconsider.

---

## 6. Files Changed / Created

| File | Action |
|---|---|
| `worker/migrations/0047_marketing_consent.sql` | New — `marketing_consents` + `email_sends` tables |
| `worker/src/lib/consent-versions.ts` | New — wording constants |
| `worker/src/lib/email.ts` | New — EmailService stub + TEMPLATES |
| `worker/src/cron/marketing-emails.ts` | New — daily cron trigger |
| `worker/src/routes/consent.ts` | New — POST + GET endpoints |
| `worker/src/index.ts` | Edit — register cron handler + consent routes |
| `wrangler.toml` | Edit — add cron schedule |
| `app/src/components/registration/Stage1ParentIdentity.tsx` | Edit — add radio group |

---

## 7. Out of Scope

- Actual email provider integration (Resend / Loops / Brevo)
- Email template HTML/content
- Communication preferences page in settings
- Re-asking consent from users who consented to an older `consent_version`
- FEATURE_ANNOUNCE sending mechanism (ad-hoc, not cron-driven)
