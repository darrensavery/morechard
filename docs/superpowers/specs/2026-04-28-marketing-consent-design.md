# Marketing Consent & Email Re-engagement — Design Spec
Date: 2026-04-28

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

This table serves two purposes: GDPR accountability (what was sent to whom and when) and cron deduplication (prevents re-sending the same template to the same user).

Index: `(user_id, template_id)` for fast duplicate checks.

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

### `GET /api/consent/marketing`

Returns the user's current consent record.

**Auth:** Requires valid session JWT (parent role).

**Response:**
```json
{ "consented": true | false | null, "consent_version": "v1" | null }
```
`null` means no consent record exists yet. Used to pre-populate the radio if the user re-enters registration or for a future communication preferences page.

---

## 3. EmailService Stub

**File:** `worker/src/lib/email.ts`

### Template constants

```typescript
export const TEMPLATES = {
  TRIAL_EXPIRING_SOON: 'trial_expiring_soon',  // day 12
  TRIAL_EXPIRED:       'trial_expired',          // day 15
  RE_ENGAGEMENT_W1:    're_engagement_w1',        // 7 days post-expiry
  RE_ENGAGEMENT_W4:    're_engagement_w4',        // 28 days post-expiry
  RE_ENGAGEMENT_W12:   're_engagement_w12',       // 84 days post-expiry
  FEATURE_ANNOUNCE:    'feature_announce',        // ad-hoc
}
```

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

The registration UI imports `CURRENT_CONSENT_VERSION` to display the question. The API imports it to write `consent_version` into the DB. The two can never drift apart.

---

## 4. Cron Trigger

**File:** `worker/src/cron/marketing-emails.ts`

**Schedule:** `0 6 * * *` (daily at 06:00 UTC) — registered in `wrangler.toml` alongside the existing market-rates cron.

### Cohort queries

Each cohort:
1. Queries `families` filtered by `trial_start_date` offset and `has_lifetime_license = 0`.
2. Joins `users` to get `email`.
3. Joins `marketing_consents` (latest row per user) to filter `consented = 1` only.
4. Left joins `email_sends` to exclude families already sent this `template_id`.
5. Calls `EmailService.sendEmail()` for each match.

| Cohort | Offset from `trial_start_date` | Template |
|---|---|---|
| Trial expiring soon | +12 days | `TRIAL_EXPIRING_SOON` |
| Trial just expired | +15 days | `TRIAL_EXPIRED` |
| Re-engagement week 1 | +21 days | `RE_ENGAGEMENT_W1` |
| Re-engagement week 4 | +42 days | `RE_ENGAGEMENT_W4` |
| Re-engagement week 12 | +98 days | `RE_ENGAGEMENT_W12` |

**Deduplication:** the `email_sends` left join is the sole guard against duplicate sends. No flags are added to `families`.

**Consent enforcement:** the `marketing_consents` join means users who answered "No" are permanently excluded with no extra logic required.

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
