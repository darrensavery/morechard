# 08 · Privacy, Consent, Data Export & Deletion

Covers marketing/analytics consent (including the separated-family veto model), GDPR/COPPA data handling, data export, leaving a family, removing a co-parent, and full account/family deletion ("Uproot").

**Key facts:**
- **Children never provide legal names or emails.** Only `display_name` (nickname encouraged). This is the COPPA/GDPR-K minimisation strategy — there is no `first_name`/`last_name`/`real_name` column anywhere.
- **Data export is always free and never gated** — even a locked/expired-trial account can export.
- **The ledger is never truly deleted** (SHA-256 chain integrity). Deletion anonymises PII but retains anonymised ledger rows.

---

## Consent & analytics

**Facts:**
- **Marketing consent** and **analytics consent** are recorded per parent (`marketing_consents`, `analytics_consents`), versioned and IP-stamped.
- **Child analytics uses a family veto model:** the effective child flag = **(any parent opted in) AND (no parent opted out)**. So if *either* parent opts out, child analytics is off for the whole family. Recomputed on every parent consent write.
- **Child session replay is always off**, regardless of consent. Analytics for children is events-only, never replay.

### Symptom: "I opted out of analytics but my co-parent's setting seems to override / not"
**Fact:** This is the veto model working as designed. A single opt-out from *any* parent turns child analytics **off** for the family — a co-parent cannot re-enable it over another parent's objection. Reassure the privacy-protective parent their opt-out wins.
**Resolve:** Each parent sets their own choice in Settings. The family-effective child flag follows the veto rule automatically.

### Symptom: "Is my child being session-recorded?"
**Fact:** No. Child session replay is **always disabled**. Only anonymous product events are captured, and only when the family veto permits. State this plainly.

### Symptom: "I want to withdraw consent / stop marketing emails"
**Resolve:** Point them to **Settings → privacy/consent** to toggle marketing and analytics off. Consent changes are logged (versioned + timestamped) for compliance. A withdrawal takes effect on save.

---

## Data export (GDPR / UK-GDPR portability)

**Facts:** Export is available to **all** users (including locked/expired-trial) via **Settings → Data & Exports**. It includes the full chore ledger (CSV), goals and outcomes (CSV), and child display names + transactions (JSON) — machine-readable, covering all personal data held. There's also the tiered **PDF audit export** (see [04](04-ledger-disputes-verification.md)).

### Symptom: "I can't find / access my data export"
**Resolve:** Settings → Data & Exports. It's never behind the paywall — if they're locked out at the paywall, the export route still works. If the export itself errors, retry; persistent failure on a large ledger → escalate.

### Symptom: "I want everything you hold on me (SAR / data request)"
**Resolve:** The self-serve export is the machine-readable portability package. For a formal Subject Access Request beyond that, escalate to Darren — some SAR obligations (e.g. audit logs, consent history) may need an operator to compile.

---

## Leaving a family (co-parent departs)

**Facts:** `DELETE /auth/me/leave`. Safety gates:
- **Empty Orchard Guard:** you can't "leave" a family where you're the only parent — you must **Delete Account** instead (error: `Cannot leave an empty orchard`).
- **Succession Gate:** if the departing parent is the **last lead** but co-parents remain, a co-parent is **auto-promoted to lead** before departure (the family always keeps a lead).
- On leaving: the departing parent's PII is anonymised to "Former Co-Parent", all their sessions revoked, their `family_roles` row removed, and pending shared expenses voided. A ledger audit note is written.

### Symptom: "I tried to leave but it won't let me"
**Diagnose:** If they're the only parent, the Empty Orchard Guard blocks "leave" — they need **Delete Account** (below).
**Resolve:** Route them to the correct action based on whether another parent exists (family members query, Toolkit).

---

## Removing a co-parent (lead removes someone)

**Facts:** `DELETE /auth/family/co-parent/:userId`, **lead-only**. It anonymises the removed user's PII, **revokes all their sessions immediately** (their next request 401s), removes their membership, reverts `parenting_mode` to `single` if no co-parents remain, voids pending shared expenses, and writes a ledger audit note. A lead cannot remove themselves this way (they use Leave Family).

### Symptom: "I removed my co-parent but worry they still have access"
**Resolve:** Removal revokes their sessions instantly — they're already locked out. If a PIN/password may be shared/compromised, have the remaining parent change theirs too. Reassure: their PII is anonymised and they can no longer see the family.

### Symptom (separated/high-conflict): "I need my ex removed urgently for safety"
**Resolve:** Only the **lead** can remove a co-parent. If the requester is the lead, walk them through it (Settings → co-parents → remove). If the requester is **not** the lead but has a safeguarding concern, escalate to Darren — this can be sensitive (separated-family conflict) and may need careful handling.

---

## Account / family deletion ("Uproot")

**Facts:** `DELETE /auth/family`, **lead-only**, and only callable when the lead is the **last parent** — **all co-parents must leave first** (error: `All co-parents must leave before the orchard can be uprooted`). The UI requires typing **`UPROOT`** to confirm. Effect: soft-deletes the family (`deleted_at`), anonymises all users' PII (names/emails/hashes → NULL/"Deleted User"), revokes all sessions, deletes invite codes and registration progress. **Ledger rows are retained but anonymised** to preserve hash-chain integrity.

### Symptom: "The Delete/Uproot button is greyed out / says co-parents must leave"
**Diagnose:** Co-parents still in the family block deletion.
**Resolve:** Each co-parent must **Leave Family** first (or the lead removes them). Once the lead is the sole parent, Uproot is available.

### Symptom: "I deleted my account by accident — can I get it back?"
**Fact:** Deletion is a soft-delete (`deleted_at` set) but **PII is anonymised immediately** (names/emails/password hashes nulled). Even within any grace period, the personal data is already scrubbed — recovery is *not* a simple undelete because the identifying data is gone.
**Resolve:** Escalate immediately (P2) — the sooner an operator looks, the more that might be recoverable, but set expectations that anonymisation is aggressive by design and full restoration may not be possible. There is no self-serve undelete.

### Symptom: "I deleted my account but you still have my ledger data"
**Fact + reassurance:** Ledger rows are **anonymised** (all links to you nulled/hashed) but not physically deleted — this is required to keep the SHA-256 chain intact and is disclosed in the privacy policy. No personal identifiers remain. This satisfies GDPR erasure (personal data removed) while preserving the tamper-evident record's integrity.

---

## Escalation triggers for this domain
- Accidental deletion / recovery request → P2 operator, fast (anonymisation is immediate).
- Formal SAR beyond the self-serve export → Darren.
- Safeguarding / high-conflict separated-family removal requests, especially from a non-lead → Darren.
- Any request implying a legal obligation (data-retention challenge, court order) → Darren.
