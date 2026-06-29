# Morechard — Data Protection Impact Assessment (DPIA)

**Document type:** Internal accountability record (UK GDPR Article 35 + ICO Age Appropriate Design Code, Standard 2). **Not published.** Held by the controller; produced to the ICO, a data-protection adviser, or a court on request.

**Status of this draft:** Working template. Pre-populated sections are drawn from the Morechard marketing site and privacy notice and **must be verified against the live codebase**. Sections marked **[JUDGMENT — YOU COMPLETE]** require your decisions and cannot be auto-filled. This is a drafting aid, **not legal advice**; given children's financial data plus a court-export ledger, this DPIA should be reviewed by a data-protection specialist before it is relied upon.

| Field | Value |
|---|---|
| Service | Morechard (family chore / financial-literacy PWA) |
| DPIA version | 0.1 (draft) |
| Date started | [DATE] |
| Author | [YOUR NAME] |
| Controller | Darren Savery, trading as Morechard (sole trader) |
| DPO | None appointed — not required (not a public authority; core activities do not require large-scale systematic monitoring). Record this reasoning annually. |
| Last review date | 2026-06-28 |
| Next review trigger | Any change to nature, scope, context or purpose of processing; otherwise 12 months (2027-06-28) |
| Sign-off | [NAME / DATE] |

---

## Step 1 — Identify the need for a DPIA

Morechard is an Information Society Service likely to be accessed by children (under 18) in the UK. It processes children's personal data and offers an online service directly involving children, which is a specified high-risk processing type under Article 35 and triggers a mandatory DPIA under the Children's Code. The service also involves: profiling/AI-driven coaching aimed at children; novel use of children's financial-behaviour data in a cross-household ("separated families") context; and an immutable cryptographic ledger marketed for evidential/court use.

This DPIA was [started before processing began / started as remediation for an existing service — STATE WHICH]. If any real-user processing is already live, record the date it began and the controls that were in place at that point.

---

## Step 2 — Describe the processing

### 2.1 Nature of the processing (data collected)

| Data | Subject | Source | Notes |
|---|---|---|---|
| Name, email | Parent | Google one-tap auth | Identity + billing |
| Nickname (no legal name / no DOB) | Child | Entered by parent | "Nicknames only" minimisation |
| Chore / reward / goal records, ledger entries | Child + household | In-app activity | Core processing; financial-behaviour data |
| AI coaching interactions | Child / parent | 25-module curriculum feature | **Profiling? Automated decisions? — clarify in 2.4** |
| Analytics events | Parent (app, post-login) | PostHog | Session replay; **off on child profiles** |
| Crash diagnostics | All | Sentry | |
| Payment data | Parent | Paddle (Merchant of Record) | Full card details not stored by Morechard |
| Transactional email | Parent | Resend | |
| Cryptographic hashes / ledger seal | Household | App | "Sovereign Ledger"; immutability. Post-deletion: direct identifiers removed, hash chain + amounts + timestamps + chore labels retained. **Assessed as pseudonymous personal data, not anonymous** — see Step 5a. |
| Court-export / CSV output | Household | App | Evidential claim — see Step 5 |

### 2.2 Scope
- Volume / number of users: **[PRE-LAUNCH or CURRENT COUNT]**
- Geographic scope: UK, US, PL (per notice)
- Children's age range in scope: **under 18** (Code scope), with consent age **13 (UK)** — see correction note below.
- Retention: 30-day soft-delete on account deletion; **[STATE active-data + ledger + backup + court-export retention — gap in current notice]**

### 2.3 Context — processors & data flows
Controllers/processors and flows: Google (auth) → Cloudflare (host + D1/R2 database) → PostHog (analytics) / Sentry (crash) → Paddle (payments) → Resend (email); GitHub (source/deploy). International transfers: several processors process data in the **US** — **[STATE transfer mechanism per processor: UK IDTA / EU SCCs + UK addendum / adequacy]**. Confirm each processor's DPA is in place (you accept these; you don't draft them).

> **Correction carried from privacy-notice review:** UK age of consent for ISS is **13**, not 16. The live notice (v1.3) still says "under 16 (UK)". This DPIA assumes the correct position; the notice must be brought into line.

### 2.4 Purposes
- Provide the core service (ledger, chore/reward sync, auth) — lawful basis: **[contract?]**
- Analytics — lawful basis: **[consent]**
- Soft-delete / co-parent intervention window — lawful basis: **[legitimate interests? document the LIA]**
- AI coaching — **[describe what it does; state whether it profiles children or makes automated decisions with significant effect → Art. 22 / Children's Code Standard on profiling]**

---

## Step 3 — Consultation **[JUDGMENT — YOU COMPLETE]**

The Children's Code expects you to seek the views of children and parents, or record and justify consulting less. Proportionate options for a solo developer:
- [ ] Parent/user feedback or market research (lightweight is acceptable — document it)
- [ ] User testing focused on whether a child can understand how their data is used
- [ ] Independent advice from a children's-rights / child-development expert — **especially expected here** because the separated-families ledger is a novel/unanticipated use of children's data
- [ ] If you consult less than the above: **record the decision and the justification** here.

Record what you did, when, with whom, and what you learned: **[YOUR NOTES]**

---

## Step 4 — Assess necessity and proportionality

For each purpose, confirm it is necessary and proportionate, and that the service can't be delivered by less intrusive means / less data.

- **Nicknames-only design:** strong evidence of data minimisation — describe.
- **Session replay off for child profiles:** strong evidence — describe.
- **AI coaching:** **[JUDGMENT]** — is the data used proportionate to the coaching benefit? Could it work with less?
- **Immutable ledger:** **[JUDGMENT]** — is full immutability necessary, and how does it reconcile with rectification/erasure rights? (Cross-ref Step 5, Risk R4.)
- **Lawfulness, fairness, transparency; accuracy; storage limitation; security:** describe how each principle is met.

---

## Step 5 — Identify and assess risks

Score each: Likelihood (L/M/H) × Severity (L/M/H) → Overall. Assess **harm to children**, not only compliance.

| # | Risk | L | S | Overall | Notes |
|---|---|---|---|---|---|
| R1 | Children's data exposed in a breach | [ ] | [ ] | [ ] | Financial-behaviour data of minors |
| R2 | Separated-families ledger weaponised in a custody/contact dispute | [ ] | [ ] | [ ] | **Novel, high-severity, child-welfare risk — central to this service** |
| R3 | Child's financial activity visible to a co-parent the child would not wish to see it | [ ] | [ ] | [ ] | Psychological/social harm |
| R4 | Immutable ledger conflicts with erasure/rectification rights | [ ] | [ ] | [ ] | Art. 16/17 vs. "cannot be tampered with" |
| R5 | AI coaching produces inaccurate/biased guidance to a child | [ ] | [ ] | [ ] | Code: explain AI, ensure accuracy, avoid bias |
| R6 | Court-export overstates evidential weight | [ ] | [ ] | [ ] | Marketing/legal-review item |
| R7 | International transfer without valid safeguard | [ ] | [ ] | [ ] | US processors |
| R8 | Consent withdrawal not functional (dead cookie link) | [ ] | [ ] | [ ] | PECR |
| R9 | Age-assurance: under-13s used without valid basis | [ ] | [ ] | [ ] | Reliance on parent acting honestly |
| R10 | Post-deletion ledger re-identifies household via behavioural fingerprint | M | M | **M** | Hash chain + amounts + timestamps + chore labels = unique temporal pattern; pseudonymised not anonymised — see Step 5a |
| R+ | [ADD OTHERS] | | | | |

---

### Step 5a — Re-identification Risk Assessment: Sovereign Ledger (R10)

**Background.** Legal review of the privacy notice (June 2026) found that the "anonymisation" claim applied to post-deletion ledger records was overstated. This section documents the technical basis for that conclusion and records the corrected position.

**What is retained after account deletion:**
- Transaction amounts (e.g. £2.50, £5.00)
- Timestamps (date and time of each chore/reward event)
- Chore and reward labels
- Cryptographic hashes linking each record to the previous one (the hash chain itself)
- A pseudonymous token replacing the deleted `family_id`

**Why this is pseudonymisation, not anonymisation.**
The ICO defines anonymous data as data from which identification is "reasonably impossible by any means, taking into account all means reasonably likely to be used" (Breyer standard, applied under UK GDPR). The retained records fail this test for two reasons:

1. **Singling-out via behavioural fingerprint.** A household's specific combination of amounts, timestamps, and chore labels creates a unique temporal pattern. Within a population of Morechard users, a family that pays the same amounts on the same recurring schedule is likely the only household with that exact pattern. Even without a name, those records can single out the household.

2. **The hash chain is itself a pseudonymous identifier.** Each transaction's hash is deterministically derived from its content and the previous hash. The chain as a whole is a unique, persistent identifier for that family's ledger history. Removing the `family_id` foreign key does not break the chain's de facto identifying quality.

**Conclusion:** Post-deletion ledger records are **pseudonymous personal data** under UK GDPR. The privacy notice (v1.4) has been corrected to reflect this position.

**Re-identification risk scoring:**

| Factor | Assessment |
|---|---|
| Re-identification by Morechard | Low — no retained linkage key; controller cannot re-link without additional out-of-system data |
| Re-identification by a co-parent (household knowledge) | Medium — a co-parent who knows the amounts and chore schedule could confirm a match against retained records |
| Re-identification by a third party (law enforcement, adversary with external dataset) | Low–Medium — requires access to the retained dataset plus independent knowledge of the household's patterns |
| Overall singling-out probability | **Medium** |
| Severity if re-identification occurs | **Medium** — financial behaviour data of a child; potential use in a custody or contact dispute |
| Overall risk rating | **Medium** |

**Lawful basis for continued retention:** Legitimate interests (Art. 6(1)(f)) — maintaining cryptographic hash-chain integrity for audit and legal-claims purposes. A Legitimate Interests Assessment (LIA) must be completed and filed separately. The LIA must demonstrate that the integrity interest outweighs data subjects' residual privacy interest given the medium re-identification risk above.

**Mitigations (cross-reference Step 6 — R10):**
- No index maintained on behavioural fields (amounts, chore labels, timestamps) of retained records
- No secondary dataset retained that would enable re-linkage to the deleted identity
- Access to retained records restricted to automated integrity checks; no human-readable admin query path to pseudonymised records
- **[JUDGMENT]** Consider time-bounding retention of the pseudonymised chain (e.g. 7 years for legal-claims purposes, then hard deletion) — record the period and rationale
- **[JUDGMENT]** At scale, assess whether the growing dataset makes singling-out less likely (k-anonymity effect) or more likely (more unique patterns); document periodically in DPIA review

---

## Step 6 — Identify measures to reduce risk

For every medium/high risk in Step 5, state the mitigation, whether it eliminates or merely reduces the risk, and the residual risk after mitigation.

| Risk # | Measure | Effect (eliminate/reduce) | Residual | Owner | Done? |
|---|---|---|---|---|---|
| R10 | Remove direct identifiers on deletion; no retained linkage key; no index on behavioural fields; no admin query path to pseudonymised records | Reduce (cannot eliminate — chain remains pseudonymous) | Low–Medium | Darren Savery | [ ] Verify access controls in codebase |
| R10 | Complete LIA for legitimate-interests basis for ledger retention | Reduce (documents proportionality) | — | Darren Savery | [ ] LIA not yet drafted |
| R10 | Set and document time-bound retention period for pseudonymised chain | Reduce (limits exposure window) | — | Darren Savery | [ ] Period not yet decided |
| R4 | Privacy notice v1.4 corrects erasure claim: pseudonymisation acknowledged, Art. 17(3) cited | Reduce (compliance gap closed in notice) | Residual: LIA still needed | Darren Savery | ✓ Done (2026-06-28) |

---

## Step 7 — Children's Code: 15 Standards conformance **[YOU COMPLETE]**

For each standard, state the specific measure taken (the Code requires this explicitly):

1. Best interests of the child — **complete the ICO best-interests self-assessment and summarise here**
2. Data protection impact assessments — this document
3. Age-appropriate application — how do you recognise age? (self-declaration via parent?) Justify the certainty level.
4. Transparency — child-appropriate explanations
5. Detrimental use of data
6. Policies and community standards
7. Default settings (high privacy by default)
8. Data minimisation — nicknames-only
9. Data sharing
10. Geolocation
11. Parental controls
12. Profiling — AI coaching; default off?
13. Nudge techniques — reward mechanics: do they nudge?
14. Connected toys/devices — likely N/A
15. Online tools (to exercise rights) — accessible and prominent

---

## Step 8 — Sign-off and integration

| Item | Detail |
|---|---|
| Measures approved by | [NAME] |
| Residual risks accepted by | [NAME] |
| DPO advice | [N/A — record why] |
| Consultation with ICO needed? | Only if a high residual risk remains unmitigated (Art. 36 prior consultation) |
| Integrated into design? | [How outcomes fed back into the build] |
| Added to DPIA log w/ review date? | [ ] |

---

## Outstanding blockers (must resolve)
1. ~~**Controller entity** (sole trader vs. company)~~ — **Resolved 2026-06-28.** Controller: Darren Savery, trading as Morechard (sole trader).
2. ~~**Live privacy notice still v1.3**~~ — **Resolved 2026-06-28.** Privacy notice v1.4 deployed: age threshold corrected (UK = 13), transfers disclosed, lawful bases added, controller named, erasure/ledger position corrected to pseudonymisation.
3. **AI coaching profiling question** — determines Art. 22 / Standard 12 treatment. Interim position (v1.4 notice): AI observations are informational only, no solely-automated decisions with legal/significant effect. Needs architectural verification.
4. **Ledger pseudonymisation LIA** — the erasure/immutable-ledger conflict (R4/R10) is now correctly framed (pseudonymous, not anonymous; Art. 17(3) cited). Residual blocker: Legitimate Interests Assessment not yet drafted. Must be completed before relying on legitimate interests as the retention basis.
5. **Specialist legal review** — strongest candidate in the compliance stack for paid review. Priority: children's data + ledger pseudonymisation + co-parent weaponisation risk (R2).