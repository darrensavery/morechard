# Morechard — Legitimate Interests Assessments (LIA)

**Document type:** Internal accountability record. Not published. Held by the controller; produced to the ICO on request.

**Status:** Working draft. Not legal advice. Should be reviewed by a data-protection specialist before being relied upon. Update if the nature, scope or context of either processing activity changes.

| Field | Value |
|---|---|
| Controller | Darren Savery, trading as Morechard (sole trader) |
| Author | Darren Savery |
| Version | 0.1 (draft) |
| Date | [DATE] |
| Covers | LIA-1: 30-day soft-delete / co-parent intervention window |
| | LIA-2: Sentry crash and error reporting |
| Review trigger | Any change to either processing activity; otherwise 12 months |

---

## How to read this document

A Legitimate Interests Assessment has three mandatory parts:

**Part A — Purpose test:** Is the interest legitimate?
**Part B — Necessity test:** Is processing necessary to achieve it, or could a less intrusive means work?
**Part C — Balancing test:** Do the interests of the controller/third parties override the rights and reasonable expectations of the data subjects?

All three parts must be satisfied. If any fails, Art. 6(1)(f) cannot be used and an alternative lawful basis is required.

---

---

## LIA-1: 30-Day Soft-Delete / Co-Parent Intervention Window

### Context

When a Morechard account holder initiates account deletion, personal data is hidden immediately but retained for 30 days before permanent purging. The stated purpose is to allow co-parents using the same family ledger to intervene if a deletion was unauthorised or accidental, and to prevent irreversible loss of shared family financial records that belong to both parties.

This processing is non-optional — it applies to all account deletions. It is a precautionary design decision made before launch; no real contested-deletion cases have occurred yet.

---

### Part A — Purpose Test

**What is the legitimate interest?**

The legitimate interest is protecting co-parents (and indirectly, children) from the irreversible destruction of shared family financial records held in the Morechard ledger. In a separated-family context, one co-parent may attempt to delete an account and its associated ledger records unilaterally — whether by error, under pressure, or deliberately to suppress financial records relevant to a family-law matter. The other co-parent has a reasonable claim to the continuity of those shared records.

**Is the interest legitimate?**

Yes. The interest is:
- **Real:** The ledger is explicitly designed as a shared multi-party record. Unilateral, irreversible deletion of shared data is a foreseeable and material harm in the co-parenting context this service targets.
- **Not trivial:** Suppression of a family financial ledger relevant to chore payments, pocket money, and shared financial commitments could cause material harm — financial, relational, and potentially evidential — to the co-parent and to any children involved.
- **Lawful:** Preserving data to protect a third party's legitimate interest in shared records is a recognised legitimate interest under UK GDPR Recital 47.
- **Not purely commercial:** The controller derives no financial benefit from the 30-day window. It exists solely for data-subject and third-party protection.

**Is this the controller's own interest or a third party's?**

Primarily a **third party's interest** — the co-parent who did not initiate the deletion request. Secondarily, it protects children whose chore and reward records form part of the ledger. The controller's interest is ancillary (service integrity).

**Conclusion — Part A:** The interest is legitimate. ✓

---

### Part B — Necessity Test

**Is processing necessary to achieve the purpose?**

Yes. The purpose is preventing irreversible loss of shared data; once data is permanently purged it cannot be recovered. Retention for a defined window is the only means of achieving this.

**Could a less intrusive means achieve the same result?**

The following alternatives were considered:

| Alternative | Assessment |
|---|---|
| Instant deletion with no window | Eliminates the risk of intervention entirely — does not meet the purpose |
| Notification only (alert co-parent, delete immediately) | Reduces but does not eliminate irreversible loss; a 30-day window gives meaningful time to act, notification alone does not |
| Shorter window (e.g. 7 days) | Could be proportionate; **[JUDGMENT: state why 30 days was chosen over a shorter period — e.g. legal advice, industry norm, the time co-parents may need to engage a solicitor in a family-law context]** |
| Export-only approach (provide CSV before deletion) | Does not protect the ledger's cryptographic integrity; a CSV export is not the same as a verified hash-chain record |

**Is 30 days proportionate?**

30 days is the standard period used by major platforms (Google, Apple) for account-deletion cooling-off. In a family-law context, 30 days represents a reasonable minimum for a co-parent to become aware of the deletion, seek advice, and take action. **[Confirm this reasoning is documented and defensible; if a shorter period would equally meet the purpose, the shorter period should be used — state reasoning here.]**

**Conclusion — Part B:** Processing is necessary. The 30-day window is the minimum required to meet the purpose. ✓

---

### Part C — Balancing Test

**Who are the data subjects?**

- The account holder who initiated deletion (primary data subject whose data is retained)
- Co-parents (third parties whose interest in the data the window protects)
- Children (whose chore/reward records form part of the retained data)

**What are their reasonable expectations?**

- The account holder who requests deletion reasonably expects their data to be deleted. The 30-day delay partially frustrates this expectation. However, Morechard's service is explicitly designed as a shared co-parenting tool; users signing up understand the ledger is a multi-party record. The privacy notice (Section 5/6) discloses the soft-delete mechanism clearly and states the lawful basis. The expectation of instant deletion is therefore partially displaced by the disclosed, co-parenting nature of the service.
- Co-parents reasonably expect that shared records they contribute to cannot be unilaterally and immediately destroyed without any recourse.
- Children have an interest in continuity of their financial records and in not having those records deleted in ways that may harm their interests (e.g. in a parental dispute).

**What is the impact on the account holder who initiated deletion?**

- Data is **hidden immediately** — the account holder cannot use the service, and their data is not visible or accessible to Morechard or the co-parent during the window for ordinary purposes.
- Retention is for **30 days only**, after which permanent purging occurs.
- The only harm is that permanent deletion is delayed, not denied.
- No new processing occurs during the window — data is held, not used.
- The account holder is **informed in advance** via the privacy notice.

**Are there children involved? What is their interest?**

Yes. Children's chore and reward records form part of the retained data. Children's interest in this context aligns with the co-parent's: continuity of records that document their financial activity is a protective factor, not a harmful one, in a family-law context.

**Does the balance favour the legitimate interest?**

Yes, for the following reasons:
1. The impact on the account holder is **time-limited** (30 days), **disclosed in advance**, and the most intrusive outcome (full immediate deletion) is only delayed, not prevented.
2. The harm being protected against — irreversible suppression of shared records in a co-parenting or family-law context — is **significant and non-recoverable**.
3. The service is **explicitly designed and marketed** as a co-parenting tool. Users have a **reduced reasonable expectation** of treating shared ledger records as purely personal data they can unilaterally destroy.
4. Children's interests are a material factor under the Children's Code, and their interests favour retention.

**Safeguards in place:**

- Data hidden immediately on deletion request (minimises active exposure).
- Retention period capped at 30 days with automatic purging.
- No use of retained data for any purpose other than restoration within the window.
- Mechanism disclosed in the privacy notice prior to any processing.
- Account holder retains the ability to contact Morechard and request earlier purging at support@morechard.com — **[CONFIRM: is this actually available? If not, add it as a safeguard and implement it.]**

**Conclusion — Part C:** The balance favours the legitimate interest. The impact on the account holder is proportionate to the protection afforded to co-parents and children. ✓

---

### LIA-1 Outcome

All three tests pass. **Art. 6(1)(f) — legitimate interests — is the appropriate lawful basis for the 30-day soft-delete window.**

| Part | Outcome |
|---|---|
| A — Purpose | ✓ Legitimate |
| B — Necessity | ✓ Necessary and proportionate |
| C — Balancing | ✓ Balance favours legitimate interest |

**Outstanding action:** Confirm whether earlier-than-30-day deletion can be requested by the account holder (safeguard). If not currently available, implement and document.

---

---

## LIA-2: Sentry Crash and Error Reporting

### Context

Morechard uses Sentry to capture crash reports and diagnostic data when the application errors. Sentry receives purely technical and environmental data — stack traces, error messages, device/OS type, app version. **No personal data is transmitted to Sentry** (no user IDs, email addresses, session identifiers, or user-generated content). This processing is non-optional and applies to all users.

---

### Part A — Purpose Test

**What is the legitimate interest?**

The legitimate interest is maintaining the security, stability, and correct operation of the Morechard service for all users. Undetected application errors degrade the service for all users and, in a service processing children's financial records, may create security risks or data-integrity failures.

**Is the interest legitimate?**

Yes. The interest is:
- **Real and operational:** Without crash reporting, errors go undetected and unresolved, directly harming service quality and potentially data integrity.
- **Not purely commercial:** While a working service benefits the controller commercially, the primary interest served is reliable, secure service delivery to users — a benefit that runs directly to data subjects.
- **Widely recognised:** Crash and error reporting is standard industry practice for maintaining the security and reliability of software services. UK GDPR Recital 49 explicitly recognises network/information security as a legitimate interest.
- **Not disproportionate to the sensitivity:** Sentry receives no personal data. The processing that occurs is entirely within the technical layer.

**Conclusion — Part A:** The interest is legitimate. ✓

---

### Part B — Necessity Test

**Is processing necessary?**

Yes. Real-time crash reporting is the standard and most effective means of identifying and resolving application errors promptly. Manual monitoring or user-submitted bug reports are materially less effective — errors affecting all users may go unreported for extended periods, and stack traces required to diagnose errors are not available through other means.

**Could a less intrusive means achieve the same result?**

| Alternative | Assessment |
|---|---|
| No crash reporting | Errors undetected; service quality and security degraded — does not meet the purpose |
| User-submitted bug reports only | Highly incomplete; many errors not reported by users; no stack traces |
| Self-hosted error logging (no third-party processor) | Would eliminate the international transfer to Sentry (US); operationally feasible for a solo developer though significantly more burdensome. Not required given no personal data is transmitted — but worth noting as an option if Sentry's scope ever expands to include personal data |
| Sentry with personal data scrubbing | This is the current approach — Sentry is configured to receive no personal data. This is already the least-intrusive version of third-party crash reporting |

**Conclusion — Part B:** Processing is necessary. The configuration (no personal data transmitted) is already the minimum required. ✓

---

### Part C — Balancing Test

**Who are the data subjects?**

All Morechard users — parents and (indirectly) children whose accounts are affected by application errors.

**What are their reasonable expectations?**

Users of a software service reasonably expect that the service uses standard technical tools to maintain stability and security. Crash reporting is an invisible background process with no user-facing dimension. Users would not reasonably expect that application errors go unmonitored.

**What is the impact on data subjects?**

Minimal to none. No personal data is transmitted to Sentry. The data processed consists entirely of technical diagnostic information (stack traces, error type, device/OS, app version). Data subjects cannot be identified from this data. There is no impact on their privacy in any meaningful sense.

**Does the balance favour the legitimate interest?**

Yes, decisively:
1. **No personal data is involved** — the privacy impact on data subjects is effectively zero.
2. The benefit (service stability and security) runs directly to the same data subjects whose technical data is processed.
3. Users have a reasonable expectation that software services use crash monitoring.
4. There is no realistic competing interest for data subjects to weigh against the controller's.

**Safeguards in place:**

- Sentry configured to transmit no personal data (no user IDs, emails, session tokens, or user-generated content).
- Transfer to Sentry (US) protected by EU SCCs with UK Addendum — documented in the privacy notice (Section 4).
- Sentry's own DPA is in place (accepted as processor).
- **[CONFIRM: verify Sentry configuration regularly to ensure no personal data scope creep — e.g. that error messages do not inadvertently capture user input. Add to periodic review checklist.]**

**Conclusion — Part C:** Balance decisively favours the legitimate interest; privacy impact on data subjects is negligible. ✓

---

### LIA-2 Outcome

All three tests pass. **Art. 6(1)(f) — legitimate interests — is the appropriate lawful basis for Sentry crash and error reporting.**

| Part | Outcome |
|---|---|
| A — Purpose | ✓ Legitimate |
| B — Necessity | ✓ Necessary; minimum-data configuration already in place |
| C — Balancing | ✓ Balance decisively favours legitimate interest; negligible privacy impact |

**Outstanding action:** Add a periodic check (suggest: quarterly, or on any Sentry SDK update) to verify no personal data scope creep in crash payloads.

---

---

---

## LIA-3: Pseudonymised Ledger Retention After Account Deletion

### Context

When a Morechard account is permanently deleted (after the 30-day soft-delete window), the controller removes all direct identifiers — name, email, family ID foreign key — but retains the cryptographic hash chain that formed the immutable ledger. What remains is:

- Transaction amounts (e.g. £2.50, £5.00)
- Timestamps (date and time of each chore or reward event)
- Chore and reward labels
- Cryptographic hashes linking each record to the previous one (the hash chain)
- A pseudonymous token replacing the deleted `family_id`

This retention is non-optional: the ledger's hash-chain integrity depends on an unbroken sequence of records. Removing any record after the fact would break the chain and defeat the evidential and audit purpose of the Sovereign Ledger.

**Legal position on this data:** Legal review (June 2026) confirmed that these retained records are **pseudonymous personal data** under UK GDPR, not anonymous data. The Breyer standard ("reasonably impossible by any means") is not met, because (1) the specific combination of amounts, timestamps, and chore labels can single out a household even without a name; and (2) the hash chain itself is a unique, persistent identifier for the family's ledger history. This assessment is documented in full in the DPIA at Step 5a (R10).

**Art. 17(3) — erasure refusal:** The controller invokes Art. 17(3)(b) (establishment, exercise, or defence of legal claims) and Art. 17(3)(e) (archiving/statistical purposes with appropriate safeguards) to refuse full erasure of the hash chain. This LIA documents the legitimate-interests basis under Art. 6(1)(f) for the retention itself, separate from the erasure-refusal.

---

### Part A — Purpose Test

**What is the legitimate interest?**

The legitimate interest is maintaining the cryptographic integrity of the Morechard Sovereign Ledger for audit, accountability, and legal-claims purposes. The Sovereign Ledger is explicitly marketed as a tamper-evident, court-admissible record of a child's earnings, chore completions, and reward payments. Its evidential value depends entirely on an unbroken, verifiable hash chain. Removing records after account deletion would permanently break the chain for all prior entries, destroying the integrity of the ledger not just for the deleted family but for the system's overall audit credibility.

**Is the interest legitimate?**

Yes. The interest is:
- **Real:** The hash chain cannot be maintained without retaining the link records. Any gap in the sequence renders the chain unverifiable.
- **Not purely commercial:** While the Sovereign Ledger is a differentiating product feature, the retention also protects third parties — co-parents, children, and courts — who may have a legitimate future interest in the integrity of those records (e.g. in a family-law dispute where the deleted party's records form part of the evidence).
- **Lawful:** Art. 6(1)(f) explicitly contemplates processing necessary for legal claims. UK GDPR Recital 47 and ICO guidance confirm that maintaining records for accountability and legal-claims purposes is a recognised legitimate interest.
- **Not disproportionate in principle:** Only the minimum required to maintain chain continuity is retained; direct identifiers are removed.

**Is this the controller's own interest or a third party's?**

Both. The controller's interest is maintaining a functioning, verifiable product. Third-party interests — co-parents, children, courts — are in the continued integrity of records that may be relevant to their rights and claims. Both carry weight in the balancing test.

**Conclusion — Part A:** The interest is legitimate. ✓

---

### Part B — Necessity Test

**Is processing necessary to achieve the purpose?**

Yes. The hash chain is a sequence: each record's hash is derived from its content and the previous record's hash. Remove a record and the chain breaks — permanently and irrecoverably. There is no technical means of maintaining verifiability without the link records.

**Could a less intrusive means achieve the same result?**

| Alternative | Assessment |
|---|---|
| Hard-delete all records on account deletion | Breaks the hash chain entirely; destroys audit integrity for the entire ledger history — does not meet the purpose |
| Retain only hashes, not amounts/timestamps/labels | The hash of a record is derived from its content. Without the content, the hash cannot be independently verified — the chain cannot be proved. Does not meet the purpose |
| Replace content with synthetic data | Breaks the mathematical relationship between content and hash. Cannot substitute. Does not meet the purpose |
| Truncate the chain at the point of deletion (mark final record as terminal) | Preserves chain integrity up to that point; subsequent records for remaining family members would start a new chain. **This is worth considering for post-deletion records**, but cannot retroactively remove prior entries without breaking the chain |
| Full pseudonymisation with no retained content | This is the current approach — direct identifiers removed, pseudonymous token substituted. Already the least intrusive version of retention consistent with chain integrity |

**Is the scope of retention proportionate?**

The retained fields (amounts, timestamps, labels, hashes, pseudonymous token) are the minimum required to maintain the chain. No additional fields are retained from the deleted account.

**Retention period:**

A defined retention period is required to satisfy storage limitation (Art. 5(1)(e)). The period must be the minimum necessary for the legitimate interest:

- **Legal claims (Art. 17(3)(b)):** The Limitation Act 1980 (UK) sets a 6-year limitation period for most civil claims. A 7-year retention period (consistent with HMRC financial-record requirements) would cover the longest plausible legal-claims window.
- **[JUDGMENT — YOU COMPLETE]:** Confirm the retention period and document the rationale. Recommended: 7 years from the date of account deletion, after which pseudonymised chain records are hard-deleted. Record this decision and implement a scheduled purge.

**Conclusion — Part B:** Processing is necessary. The current approach (direct identifiers removed, pseudonymous token substituted, all other fields retained for chain integrity) is the minimum required. Time-bounding is outstanding and must be decided and implemented. ✓ (with outstanding action)

---

### Part C — Balancing Test

**Who are the data subjects?**

- The account holder who deleted the account (whose pseudonymised records are retained)
- Children whose chore and reward records form part of the retained chain
- Co-parents (their records may overlap — they are data subjects of the same ledger entries)

**What are their reasonable expectations?**

- The account holder who requests deletion reasonably expects their data to be deleted. The privacy notice (v1.4, Sections 6 and 8) discloses that the hash chain is retained as pseudonymised data, cites Art. 17(3), and names legitimate interests as the basis. The expectation of complete erasure is therefore partially displaced by this prior disclosure.
- The account holder also signed up for a service explicitly described as a tamper-evident, court-admissible ledger. The marketing of immutability reduces the reasonable expectation that records can be fully erased on demand.
- Children and co-parents did not themselves initiate the deletion and may have their own interest in the continued integrity of shared records.

**What is the impact on the account holder who deleted the account?**

- Direct identifiers are removed. The retained pseudonymous records cannot be queried or accessed by the controller through a user-facing interface — they exist only within the hash chain structure.
- No index is maintained on behavioural fields (amounts, labels, timestamps); no human-readable admin query path exists to pseudonymised records.
- The residual risk (re-identification by a co-parent with household knowledge, or by a third party with an external dataset) is assessed at **Medium** in the DPIA (Step 5a, R10). This is non-trivial and is the primary weight against the controller's interest.
- The impact on the deleted account holder is ongoing (the data persists), but passive (no active use or processing occurs).

**Are there children involved? What is their interest?**

Yes. Children's chore and reward records are the core content of the chain. Children have a dual interest: (1) they are data subjects whose records persist; (2) they may have a protective interest in the integrity of records that document their financial activity — particularly in a family-law context where those records could vindicate their entitlements.

**Does the balance favour the legitimate interest?**

Yes, for the following reasons:

1. **The purpose is narrow and non-commercial.** The retained data is not used for any new processing — it exists solely to preserve chain integrity. The controller derives no analytical, marketing, or commercial benefit from the pseudonymised records of deleted accounts.
2. **The impact is time-limited.** Once a retention period is defined and implemented (see Part B), the pseudonymised records will be hard-deleted after the legal-claims window closes. The ongoing nature of the retention is a weakness — resolved by implementing a defined period.
3. **The disclosure is in place.** The privacy notice (v1.4) explicitly discloses the retention, names the basis (legitimate interests, Art. 17(3)), and explains why full erasure is refused. Data subjects are informed before they delete.
4. **The product is an immutable ledger.** Users choosing Morechard's Sovereign Ledger feature have a reduced reasonable expectation of unconditional erasure compared with a standard data controller.
5. **The re-identification risk is Medium, not High.** Re-identification requires an adversary with both access to the retained dataset and independent knowledge of the household's specific financial patterns. Morechard does not retain the linkage key; the controller cannot re-link without out-of-system data.
6. **Children's interests weigh in favour of retention**, not against it — continuity of records protects children in family-law contexts.

The residual concern is the Medium re-identification risk and the absence of a defined retention period. Both are addressed by the mitigations below.

**Safeguards in place:**

- Direct identifiers (name, email, `family_id`) removed on account deletion; pseudonymous token substituted.
- No index maintained on behavioural fields (amounts, chore labels, timestamps) of retained records.
- No secondary dataset retained that would enable re-linkage to the deleted identity.
- Access to retained records restricted to automated integrity checks; no human-readable admin query path to pseudonymised records.
- Privacy notice v1.4 discloses the retention in advance; data subjects informed before any deletion request.
- **[Outstanding]** Implement a defined retention period (recommended: 7 years from deletion date) with automated purge. Until this is in place, the time-limitation safeguard is absent and the proportionality argument is weaker.

**Conclusion — Part C:** The balance favours the legitimate interest. The medium re-identification risk is the primary countervailing factor; the mitigations in place reduce but do not eliminate it. The outstanding action (retention period) must be completed for this assessment to be fully defensible. ✓ (with outstanding action)

---

### LIA-3 Outcome

All three tests pass, with one outstanding action (retention period) that must be completed before the assessment is fully defensible.

| Part | Outcome |
|---|---|
| A — Purpose | ✓ Legitimate |
| B — Necessity | ✓ Necessary; minimum-data approach already in place. Outstanding: define and implement retention period. |
| C — Balancing | ✓ Balance favours legitimate interest. Outstanding: retention period required to satisfy time-limitation safeguard. |

**Outstanding action:** Decide and document the retention period for pseudonymised chain records (recommended: 7 years from account deletion date, aligned with UK Limitation Act 1980 civil-claims period). Implement a scheduled purge in the worker. Record the decision and rationale in this document and in the DPIA (Step 5a, Step 6 R10 row).

---

---

## Summary

| LIA | Processing activity | Basis | Outcome |
|---|---|---|---|
| LIA-1 | 30-day soft-delete / co-parent intervention window | Art. 6(1)(f) | ✓ Passes all three tests |
| LIA-2 | Sentry crash and error reporting | Art. 6(1)(f) | ✓ Passes all three tests |
| LIA-3 | Pseudonymised ledger retention after account deletion | Art. 6(1)(f) + Art. 17(3)(b) | ✓ Passes all three tests — one outstanding action |

**Open items across all LIAs:**

1. **LIA-1:** Confirm whether account holders can request earlier-than-30-day deletion. If not, implement this safeguard and document it.
2. **LIA-1:** State the explicit reasoning for 30 days vs. a shorter period (e.g. 7 or 14 days). The shorter the period, the stronger the proportionality argument.
3. **LIA-2:** Add periodic Sentry-payload review to the operational checklist to prevent personal-data scope creep.
4. **LIA-3:** Decide the retention period for pseudonymised chain records (recommended: 7 years from deletion date). Implement scheduled purge in the worker. Record here and in DPIA Step 5a/Step 6.
5. **All:** Review if the nature, scope, or context of any processing activity changes.
6. **All:** Specialist legal review recommended given children's data context and the novel pseudonymous-ledger retention position.