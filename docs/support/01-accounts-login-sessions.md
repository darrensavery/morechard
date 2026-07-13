# 01 · Accounts, Login & Sessions

Covers parent login (password, magic link, Google), child login (PIN), parent PIN, biometrics, lockouts, email changes, and session management.

**Key facts about the auth model:**
- **Parents** authenticate with email + (password OR magic link OR Google). Parent JWT lasts **1 year**.
- **Children** authenticate with a **4-digit PIN** on a device already linked to the family. Child JWT lasts **90 days**. Children have **no email and no self-service recovery** — a parent fixes everything.
- **Magic links** expire in **15 minutes**, are single-use, and are rate-limited to **3 requests per 10 minutes** per email.
- **Password login** locks the account for **15 minutes** after **10 failed attempts** in a 10-minute window.
- Error messages are deliberately vague ("Invalid credentials") to prevent revealing whether an email is registered. This is intentional — reassure the user it doesn't mean their account is gone.

---

## Parent login

### Symptom: "My magic link says invalid / expired / already used"
The verify page redirects to `/auth/verify?error=<reason>`. The reason tells you exactly what happened:

| `error=` | Meaning | Resolution |
|----------|---------|------------|
| `missing` | No token in the URL (link was mangled/truncated by their email client) | Ask them to request a fresh link and click it directly, not copy-paste |
| `invalid` | Token doesn't match any issued token | Request a fresh link. Usually an old link from a previous email |
| `used` | Link already consumed (they clicked it twice, or a preview-scanner in their email opened it first) | Request a fresh link. Corporate/Outlook link-scanners are a common cause — suggest they try a personal email |
| `expired` | More than 15 minutes elapsed | Request a fresh link and click within 15 min |

**Diagnose:** Magic links are single-use and short-lived. Email security scanners (Outlook Safe Links, Mimecast) frequently "click" links to scan them, consuming the token before the user does. If a user reliably gets `used` immediately, this is almost certainly the cause.

**Resolve:** Have them request a new link from a mail client without link-scanning, or set a password instead (removes magic-link dependency).

### Symptom: "I requested a magic link and no email arrived"
**Diagnose:**
1. Confirm the email matches a registered account (Diagnostic Toolkit query). **Note:** for security the endpoint always returns "sent" even for unregistered emails, so "it said sent" doesn't prove an account exists.
2. Check rate limiting: more than 3 requests in 10 minutes silently drops further sends (still returns success). Ask them to wait 10 minutes.
3. Check spam/junk. Sender is via Resend; the subject is a Morechard verify email.

**Resolve:** Wait out the rate limit, check spam, confirm the address is correct. If the account genuinely exists and email delivery is failing across multiple attempts, escalate (possible Resend deliverability issue) — check Sentry for send failures.

### Symptom: "Wrong password / can't log in, and now it says too many attempts"
**Diagnose:** Query `login_attempts` for their email (Toolkit). After 10 failures in 10 minutes the account locks for 15 minutes (`locked_until` in the future → `429 Too many failed attempts`).

**Resolve:** The lock auto-clears after 15 minutes — no action needed, just wait. If they've forgotten the password, direct them to **magic link login** instead (email-based, bypasses password). A successful login clears the lockout row automatically.

**Escalate only if:** the lock persists beyond 15 minutes past `locked_until` (would indicate a clock/data issue).

### Symptom: "I signed up with Google and it's asking for a password"
**Diagnose:** Google-only accounts have `password_hash = NULL`. They should **never** use the password form — they log in via the Google button.

**Resolve:** Tell them to use "Continue with Google." If they want a password too, they can set one, but the primary path is Google. Note: Google-only users setting a **parent PIN** are not asked for a password (the JWT is sufficient proof) — this is expected.

### Symptom: "I verified my email but got logged out / dumped back to login"
**Diagnose:** After a magic link is verified, the flow hands off via a short-lived (5-minute) SLT token to `/auth/callback?slt=...` which exchanges it for the session. If they sat on the verify page too long or the app was backgrounded, the SLT can expire.

**Resolve:** Request a fresh magic link and complete the flow in one go. If it repeats, capture the URL they land on and escalate — historically a routing bug could verify the email but fail to establish the session; re-sending a magic link is the recovery path and the account is intact.

---

## Email address changes

### Symptom: "I changed my email but the confirmation link doesn't work / I never got it"
**Facts:** An email change is *staged* — the new address goes into `email_pending` and a **24-hour** verification token is emailed to the **new** address. The change only applies when that link is clicked (`/auth/verify-email`).

| Situation | What it means | Resolution |
|-----------|---------------|------------|
| No email at new address | Send may have failed; staging is rolled back automatically on send failure | Have them retry the change from Account & Profile settings |
| "Link expired" | >24h elapsed | Re-request the change; a new 24h token is issued (old unused tokens are invalidated) |
| "Already used" | Link clicked twice | The change already applied — have them log in with the new email |
| "That email is already registered" (409) | Another verified account holds it | They must use a different address; we don't merge accounts |

**Diagnose:** Query the user row — if `email_pending` is set, the change is staged but unconfirmed; `email` is still the old (working) address. They can still log in with the **old** email until confirmation completes.

---

## Parent PIN (the in-app quick lock)

**Facts:** 4-digit PIN, hashed (`parent_pin_hash`). Locks for **30 seconds** after **3 wrong attempts**. Setting/resetting the PIN requires the account **password** as the master key (except Google-only users, who are verified by their session).

### Symptom: "I forgot my parent PIN"
**Resolve:** Direct them to **Settings → set/reset PIN**, which requires their email password to authorise a new PIN (`POST /auth/pin/set`). There is no "recover the old PIN" — it's write-only; they simply set a new one. If they've also forgotten the password, they recover the password first via magic link, then set a new PIN.

### Symptom: "It says too many attempts on my PIN"
**Resolve:** Wait 30 seconds; the lock auto-clears. No escalation.

---

## Child login & child PIN

**Facts:** Children log in with `family_id + child_id + 4-digit PIN` on a linked device. **5 wrong attempts → 30-second lockout.** The parent sets/resets the child's PIN (`POST /auth/child/set-pin`, parent JWT required). The child cannot reset their own PIN.

### Symptom: "My child forgot their PIN" / "child is locked out"
**Resolve:**
- Locked out: wait 30 seconds.
- Forgotten: the **parent** resets it via the child's profile in the parent app (Manage child → reset PIN). Give them the reset location, then the child logs in with the new PIN.

### Symptom: "My child's app logged them out and won't let them back in"
**Diagnose:** Child JWT lasts 90 days and children have **no re-authentication email**. If the session expired or was revoked, the child needs to re-enter their PIN. If the device itself was un-linked (e.g. family deletion, co-parent removal, or app data cleared), the child must be **re-invited**.

**Resolve:**
1. First try: child re-enters their PIN on the same device.
2. If the device is no longer linked (e.g. reinstalled app, cleared storage): the parent regenerates a child invite code (Manage child → new invite code) and re-links the device. See [02-onboarding-invites-family.md](02-onboarding-invites-family.md).

---

## Biometrics (Face ID / Touch ID)

**Facts:** WebAuthn-based, optional, set up during registration (`Stage3SecureApp`) or Settings. The `LockScreen` auto-challenges biometrics on app open. Biometrics are a **convenience layer over the existing session** — they don't replace the PIN/password.

### Symptom: "Face ID / Touch ID stopped working after an update or new phone"
**Diagnose:** WebAuthn credentials are bound to the device+browser. A new phone, a browser change, or clearing site data invalidates them.

**Resolve:** Fall back to PIN/password to get in, then re-enrol biometrics in Settings on the new device. Biometrics failing never means data loss — it's a local device credential.

---

## Sessions & "someone else is logged in"

**Facts:** Parents can view active sessions (`GET /auth/sessions`) and revoke individually or "log out everywhere else" from Settings.

### Symptom: "I think someone else has access / I lost my phone"
**Resolve:** Direct them to **Settings → Sessions/Devices**, where they can revoke other sessions ("log out all other devices"). Revoking is immediate — the next request from that device gets a 401. For a lost device, revoke that session and, if a PIN/password may be compromised, have them change it.

### Symptom: "I removed a co-parent but they might still be logged in"
**Fact:** Removing a co-parent **revokes all their sessions immediately** — their next request 401s. Reassure them it's already handled. (See [08-privacy-data-export-deletion.md](08-privacy-data-export-deletion.md).)

---

## Escalation triggers for this domain
- Magic-link emails failing to send for a confirmed-registered address across multiple attempts (Resend deliverability) → engineering + Sentry check.
- A user verified their email but repeatedly cannot establish a session → engineering with the landing URL.
- Any suspected unauthorised access where session revocation doesn't stop it → P1, engineering immediately.
