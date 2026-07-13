# 02 · Onboarding, Invites & Family Setup

Covers the 4-stage registration, creating a family, 6-character invite codes, adding children, linking child devices, and the co-parent bridge.

**Key facts:**
- Registration is a **4-stage** flow: Identity → Constitution (region + governance mode) → Child setup → Co-parent bridge.
- A **family** is created up front (`POST /auth/create-family`). The first parent is the **lead**.
- **Invite codes** are **6 uppercase characters**, exclude ambiguous characters (no `0/O`, `1/I`), are **single-use**, and expire after **72 hours**.
- **Children** join with `display_name` only — no email, no password.
- **Co-parents** join with `display_name + email + password (≥8 chars)`. Only the **lead** can invite a co-parent.

---

## Registration

### Symptom: "I started signing up, got interrupted, and now it won't let me register — says email already registered"
**Diagnose:** Registration progress is saved per stage. Two cases:
- **Unverified orphan:** If a previous attempt created the account but the email was never verified (`email_verified = 0`), re-running create-family **auto-deletes the orphaned record** and starts fresh cleanly. This should "just work" on retry.
- **Verified account exists:** If the email is already verified, they *have* an account — the system silently sends a magic link so they can just sign in. Tell them to check their inbox and log in rather than re-register.

**Resolve:** Ask them to attempt sign-**in** (magic link) with that email. If they genuinely can't, confirm the account state via the Toolkit query and escalate if it's stuck.

### Symptom: "It says a lead parent is already registered for this family" (409)
**Diagnose:** Someone already registered as the lead on that `family_id`. This happens if two people both try to be the lead, or a co-parent used the wrong flow.

**Resolve:** There is exactly one lead per family. The second person should join as a **co-parent** using an invite code from the lead, not register a new lead.

### Symptom: "I selected the wrong region / currency during signup"
**Fact:** `base_currency` and `region` are set at registration and the currency is **locked** (anti-arbitrage — see [09-technical-pwa-devices.md](09-technical-pwa-devices.md)). There's no self-serve region switch.
**Resolve:** For a brand-new account with little data, easiest is to delete and re-register with the correct region (see [08](08-privacy-data-export-deletion.md)). For an established account, a currency **rebase** is an engineering operation — escalate with the family_id and the target region.

---

## Invite codes (the 6-character codes)

### Symptom: "My invite code doesn't work"
The redeem/peek endpoints return a specific status:

| Response | Meaning | Resolution |
|----------|---------|------------|
| `404 Invalid invite code` | Code doesn't exist / typo | Check for typos. Codes never contain `0`, `O`, `1`, or `I` — those are usually mis-read `Q/8`, etc. Confirm they're entering all 6 chars, uppercase |
| `409 Invite code already used` | Single-use code already redeemed (or a double-tap/two-device race redeemed it) | Parent regenerates a fresh code |
| `410 Invite code has expired` | >72h old | Parent regenerates a fresh code |

**Resolve (regenerate):** Parent opens the child's profile (or co-parent invite) and taps **regenerate invite code**. This invalidates the old code and issues a new 72h one. Give the fresh code to the joiner.

### Symptom: "I generated a child invite but there's no email option"
**Fact:** Correct — children join by **code only**, entered on the child's device. There is no child email by design (COPPA/GDPR-K). The parent reads the 6-char code to the child (or shows the device), and the child enters it in the "Join a family" screen.

### Symptom: "Only I can add a co-parent but the button is missing"
**Diagnose:** Only the **lead** parent can invite a co-parent (`role: 'co-parent'` invites are lead-gated → `403 Only the lead parent can invite co-parents`). A co-parent trying to invite another co-parent won't have the option.

**Resolve:** The **lead** generates the co-parent invite. Confirm who the lead is via the family members query (Toolkit — look for `parent_role = 'lead'`).

---

## Adding & linking children

### Symptom: "I added my child but they can't get in on their device"
**Facts:** `POST /auth/child/add` creates the child user + a 72h invite code in one step. The child then redeems that code on their own device. The child record exists in the family from the moment of creation, even before the device is linked.

**Diagnose:**
1. Confirm the child exists (family members query).
2. Check whether they have a live invite code (expires after 72h).

**Resolve:** If the code expired or was used, regenerate it (Manage child → new invite code) and have the child redeem it on their device. Once redeemed, the child sets/uses their PIN (see [01](01-accounts-login-sessions.md)).

### Symptom: "I set an opening balance for my child and it's wrong / didn't show"
**Fact:** A non-zero opening balance provided at child creation is written as an **immutable ledger credit** ("Opening balance"). It cannot be edited — like any ledger entry, a correction is a **reversal entry**, not an edit.
**Resolve:** If the opening balance was wrong, the parent adjusts via a normal ledger correction (a reversal / offsetting entry), not by editing. See [04-ledger-disputes-verification.md](04-ledger-disputes-verification.md).

### Symptom: "The child chose a different name than I typed"
**Fact:** Expected. When a parent pre-creates a child, the parent's name is a placeholder; when the child redeems the invite, **the name the child enters wins** and overwrites the placeholder. This is by design.

---

## Co-parent bridge

### Symptom: "My co-parent's invite says email already registered" (409)
**Diagnose:** The email the co-parent is trying to join with already belongs to another account (possibly their own separate family, or a prior signup).
**Resolve:** They must use an email not already in Morechard. We don't merge accounts. If the email is an abandoned/unverified account of their own, escalate to clean it up.

### Symptom: "We're separated — will my co-parent see my household's chores?"
**Fact:** No. Households are **private silos** — chores assigned in one parent's household are not cross-visible to the other parent. The **ledger** (the shared earned-record) is the shared surface; day-to-day chore assignment is not. Reassure them this separation is a core design guarantee, and there is **no parent-to-parent messaging** in the app at all.

### Symptom: "How do I switch from single-parent to co-parenting (or back)?"
**Facts:** `parenting_mode` flips to `co-parenting` when a co-parent joins, and reverts to `single` automatically when the last co-parent is removed. There's no manual toggle needed for the common path.
**Resolve:** To add a co-parent: lead generates a co-parent invite. To go back to single: lead removes the co-parent (see [08](08-privacy-data-export-deletion.md)); mode reverts automatically.

---

## Escalation triggers for this domain
- Account stuck mid-registration that retry doesn't clear (neither orphan-cleanup nor magic-link sign-in works) → engineering with family_id/email.
- Region/currency change on an established (data-bearing) account → engineering (rebase operation).
- Duplicate/abandoned account blocking a legitimate email → engineering to clean up.
