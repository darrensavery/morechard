# MORECHARD DEVELOPER BIBLE (V4.2)

## 1) System Overview & Core Identity
* **What the app does:** Morechard is a high-integrity "Truth Engine" and pocket money tracker for separated families. It provides legal-grade, immutable financial records and an AI Virtual Coach to educate children through real-world usage, reducing conflict by delegating "coaching" and "friction management" to a neutral third party.
* **Core user roles:** Parent (Custodian/Observer), Child (Learner, Ages 10–16), and AI Mentor (Performance Coach/Neutral Arbiter).
* **Core flows:**
    * Immutable transaction logging with cryptographic SHA-256 verification.
    * Mutual-consent governance changes (Amicable vs. Standard mode).
    * AI-powered child mentorship based on real-time spending/saving habits.
    * One-click generation of court-admissible PDF financial audit reports.

---

## 2) Tech Stack & Services
* **Frontend:** High-performance PWA using Tailwind CSS and Shadcn UI.
* **Backend/services:** Cloudflare Workers (Serverless).
* **Auth:** Cloudflare Access or Auth.js (Integrated with authorized ID logging).
* **Database:** Cloudflare D1 (Relational SQL).
* **Hosting:** Cloudflare.
* **Build tools:** Vite / Cloudflare Wrangler.
* **Payments:** Stripe (£34.99 Lifetime License / £19.99/year AI Subscription).
* **AI Engine:** Gemini or GPT-4o-mini (Focus: Contextual nudges, not static courses).

---

## 3) Data Model (Relational SQL)
* **Entity: Transaction Ledger**
    * `record_hash` (SHA-256 chain), `amount` (Integer - Pence/Groszy), `family_id` (FK), `parent_id` (FK), `server_timestamp`, `ip_address`, `verification_status` (Enum).
    * **Constraint:** No deletion; errors require "Reversal" entries referencing the original record.
* **Entity: Family / Governance (single `families` table)**
    * `family_id`, `governance_mode` (Enum: `AMICABLE` | `STANDARD`), `authorised_ids`, `timestamp`, `ip_address`.
    * `trial_start_date`, `is_activated`, `has_lifetime_license`, `ai_subscription_expiry`, `base_currency` (GBP|PLN).
    * **Requirement:** Handshake logic (mutual consent) for all governance changes.
    * **Schema rule:** `families` is the single source of truth for governance, trial, and licensing state.
* **Entity: Children (Linked to `families`)**
    * `child_id`, `display_name` (Mandatory - Nicknames encouraged), `family_invite_code` (6-digit String).
* **Entity: Chore Ledger**
    * `household_id` (Private Silo), `task_description`, `status`, `child_id`.
    * **Partitioning:** Private household silos prevent interference from the other parent.

---

## 4) Key User Journeys & Registration
* **The 4-Stage "High-Integrity" Registration:**
    1. **Identity:** Lead Parent sign-up. Toggle: "Single Parent" vs. "Co-Parenting Team."
    2. **Constitution:** Select Currency (GBP/PLN) and Governance Mode (`AMICABLE` vs. `STANDARD`).
    3. **Child Setup:** Input `display_name`. System triggers existing **6-digit invite code** for device linking.
    4. **Co-Parent Bridge:** Option to invite via email or share the 6-digit family code manually.
* **The 14-Day "Active-Usage" Trial:**
    * **Trigger:** Countdown is NULL until the `ledger_entry_count >= 1`. 
    * **Activation Events:** The clock starts only when the first 'Value Event' occurs (Chore Logged, Allowance Set, or Purchase Recorded).
    * **UI Element:** A 'Trial Progress Bar' on the Dashboard labeled "Coaching Evaluation."
    * **Hard Lock:** On Day 15 post-activation, redirect to `/paywall`. No read-only mode (except data export).
* **Governance Modes:**
    * `AMICABLE`: Transaction -> Notification to other parent.
    * `STANDARD`: Transaction -> Pending State -> Required Second Parent Approval -> Immutable Ledger Write.
* **The AI Mentor (Child Service):** **Trigger-based coaching only.**
    * **Spending Velocity:** Nudge on "Delayed Gratification."
    * **Value Audit:** Challenge high-frequency digital purchases (Loot boxes/Scams).
    * **Independence Score:** Tracks "Autonomy" (Child-initiated vs. Parent-initiated actions).
* **The AI Advisor (Parent Service):** Delivers "Scouting Reports" on consistency and discipline.

---

## 5) Security, Privacy & Constraints
* **Auth constraints:** Changing governance modes requires a "Mutual Consent Handshake."
* **5.3 Data Minimization (Child Protection):** * **Identity:** Never mandate legal names. Use `display_name` for all UI/AI interactions.
    * **Authentication:** Access managed via 6-digit `family_invite_code`. No child email required.
* **Messaging Constraint:** **STRICT BAN** on human-to-human chat functionality between parents.
* **Trial State Persistence:** `trial_start_date` must be stored in D1. /paywall redirect handled via Worker Middleware.

---

## 6) Internationalisation & Performance
* **Bilingual UI:** Full support for English and Polish. 
* **Linguistic Freedom:** Users may toggle UI/AI language (EN/PL) regardless of payment currency.
* **Currency Rebase Hook:** SQL function to batch-convert ledger units for families moving regions, creating a "Rebase" ledger entry to preserve the SHA-256 chain.
* **Regional AI Personas:** * **UK:** Collaborative tone. 
    * **Poland:** Direct/Formal tone ("Neutralny Arbiter"). AI uses local cost-of-living benchmarks (Groszy/PLN).

---

## 7) Repo & Code Conventions
* **Patterns to follow:**
    * Financial models must use LaTeX.
    * AI must use "Process Language" (growth mindset).
    * All currency must be stored as Integers.
* **Patterns to avoid:**
    * **NO** human-to-human chat.
    * **NO** deletion of ledger entries.
    * **NO** "Small Talk" in the Polish AI persona.

---

## 8) Payment & Licensing Schema 
* **Columns added to `families`:** `trial_start_date`, `is_activated`, `has_lifetime_license`, `ai_subscription_expiry`.
* **New table:** `payment_audit_log` — immutable Stripe transaction record.
* **Indices:** `idx_family_trial`, `idx_family_licenses`.

---

## 9) Known Issues / Technical Debt
* **Migration Debt:** Requires batch-insert scripts for Firebase-to-D1.
* **UI Bloat:** Explicit directive to focus strictly on the Ledger and the AI Coach.

---

## 10) Regional Pricing & Anti-Arbitrage (PPP Optimized)
* **UK (GBP):** * Essential (Lifetime): **£34.99**
    * Pro Coach Bundle (Yr 1): **£44.98** (£19.99/yr thereafter)
* **Poland (PLN) - Introductory Launch Price:** * Essential (Lifetime): **99.00 PLN** (Regular: 129 PLN)
    * Pro Coach Bundle (Yr 1): **139.00 PLN** (Regular: 159 PLN)
* **The Guardrail:** * **Currency Lock:** Fixed at registration/payment.
    * **Anti-Arbitrage:** Worker-side validation of Card Issuing Country vs. Price ID. UK cards blocked from PLN prices.

---

## 11) Implementation Backlog (STRICT SCOPE)
1. **D1 Schema Update:** Transition legacy data to V4.2 schema (Nicknames, Governance modes).
2. **Registration UI:** 4-stage Shadcn flow (Identity -> Constitution -> Child -> Bridge).
3. **Double-Lock Logic:** Implementation of "Pending" status for Standard Governance mode.
4. **Stripe PPP Guard:** Worker-side check for Card Country vs. Currency.
5. **The 14-Day Lock:** Middleware for trial countdown and `/paywall` redirect.
6. **The Migration Hook:** SQL utility for historical currency rebasing.

# MORECHARD DEVELOPER BIBLE (V4.3) - ADAPTIVE UX UPDATE

## 12) Adaptive Onboarding & Tone-Switch Logic
* **Objective:** Contextualize "Friction Points" (like Email Auth) based on the chosen Governance Mode to maximize conversion and trust.

### 12.1 Messaging Matrix (Co-Parent Invitation)
* **`governance_mode == 'AMICABLE'`**
    * **Header:** "Secure Your Family Record"
    * **Value Prop:** Focus on "Privacy," "Device Sync," and "Shared Goals."
    * **Email Auth Reason:** "To keep your child's data secure and synchronized across all devices."
* **`governance_mode == 'STANDARD'`**
    * **Header:** "Establish Verified Accountability"
    * **Value Prop:** Focus on "Integrity," "Audit Trails," and "Verification."
    * **Email Auth Reason:** "To ensure every approval is tied to a unique Digital Signature for a high-integrity audit trail."

### 12.2 Technical Hook
* **Component:** `InviteCoParentCard.tsx` (Shadcn Alert/Info).
* **Logic:** Conditional rendering of the `headerText` and `descriptionText` based on the `family.governance_mode` state stored in D1.
* **Child Onboarding (Global):** Regardless of mode, child access remains "Privacy-First" using the 6-digit `family_invite_code` only (No Email Required).

---

## 13) The "Neutrality" Clause
* **Instruction for AI:** The AI Mentor must never use "Legal" or "Court" terminology unless explicitly asked by the parent. 
* **The "Peace-Pipe" Reframe:** Refer to the ledger as the "Shared Truth" for Amicable families and the "Verification Vault" for Standard families.

## 14) Global Region & Locale Logic
* **Region Trigger:** In Stage 2 (Constitution), user must select a Region: `UK`, `PL`, or `US`.
* **The "Allowance" Toggle:** - If `Region == US`: Swap all "Pocket Money" strings for "Allowance."
    - If `Region == US`: Swap "Chore" for "Job/Task" (Optional, based on user preference).
* **Currency Anchor:** - `US` -> USD ($).
    - `UK` -> GBP (£).
    - `PL` -> PLN (zł).
* **2026 Compliance (COPPA/GDPR):** - US Region triggers a "COPPA-Compliant Notice" during child onboarding (already supported by our Nickname-only strategy).
    - UK/PL Regions trigger GDPR-K compliance paths.

## 15) Regional Pricing IDs (USD)
* **US Market (USD):**
    - Essential (Lifetime): **$49.99**
    - Pro Coach Bundle (Yr 1): **$69.99** ($24.99/yr thereafter)
* **Logic:** Stripe Worker must verify `PaymentMethod.card.country == 'US'` to unlock USD pricing IDs.

## 16) The "Sovereign Ledger" Philosophy
* **Core Rule:** Morechard is a **Record of Ownership**, not a **Transfer of Funds**.
* **AI Instruction:** The Mentor must refer to the balance as "Your Total Equity" or "Available Funds." It should never imply the app *is* a bank account.
* **The "Settlement" Nudge:** When a large purchase is logged, the AI should nudge the child: *"You've logged this spend. Make sure you've settled the physical payment with your Parent Custodian."*
* **The "Audit" Value:** For co-parents, the value isn't "Moving Money"—it's "Knowing the Balance." No more "How much do I owe him for the grass cutting?" texts.

---

## 17) Brand Identity — The Orchard Layer

### 17.1) Brand Name
**Morechard** (formerly MoneySteps). The name evokes an orchard — growth, nature, seasons, harvest.

### 17.2) The Core Rule
Functional UI (buttons, headers, navigation, form labels) must remain plain English.
Orchard metaphors appear **only** in: Empty States, Loading Screens, Notifications, Success Celebrations, and AI tip introductions.
They are a charming coat of paint — never a replacement for clarity.

**Never replace** the words "Money", "Pounds", "Zloty", "£", "zł", "$" with a metaphor.

---

### 17.3) Empty State Copy

**Empty Tasks screen**
- Headline: `Your plot is ready.`
- Body: `No chores have been planted yet. Add the first one and watch things grow.`

**Zero Savings screen**
- Headline: `The grove is quiet for now.`
- Body: `Every big harvest starts with a single seed. Set a savings goal to get growing.`

---

### 17.4) Loading Messages (rotate randomly, max 40 chars)
1. `Checking the soil…`
2. `Letting the roots settle…`
3. `Sunlight reaching the grove…`
4. `Counting what's in the ground…`
5. `Your orchard is waking up…`

---

### 17.5) Success & Celebration

**Big savings goal reached ("Harvest" moment)**
- Headline: `Harvest time. 🌿`
- Body: `You saved every penny and reached your goal — that's £[X] grown from nothing. Well done.`

**Task completion animation**
- A single SVG leaf (~20px) rises from the ticked checkbox, drifts upward ~40px with a gentle arc, fades out over ~600ms.
- Runs once only. No sound. No bounce. Invisible unless you're watching for it.

---

### 17.6) AI "Head Gardener" Tip Template

```
The Head Gardener has a suggestion.
[Tip in plain language — always numbers-first. E.g., "Setting aside £2 a week means you'd reach your goal 3 weeks earlier."]
Want to give it a try?
```

**Rules:**
- Intro line is always identical — it becomes a recognisable signal.
- Tip body is always plain English, numbers first. No metaphor inside the tip.
- CTA is always a soft question. Never "Tap here."

---

### 17.7) Allowance Day Push Notification

```
🌧 Your allowance has arrived.
£[X] landed in your account — a fresh start for the week. Open the app to see it grow.
```

---

### 17.8) Orchard Language Usage Table

| Context               | Orchard language       | Plain language                        |
|-----------------------|------------------------|---------------------------------------|
| Empty states          | ✅ One metaphor line   | ✅ Functional subtext always follows  |
| Loading screens       | ✅ Full metaphor       | —                                     |
| Success/celebrations  | ✅ Headline word only  | ✅ Numbers and facts in body          |
| Buttons & nav         | ❌ Never               | ✅ Always                             |
| AI tips               | ✅ Intro line only     | ✅ Tip content always plain           |
| Push notifications    | ✅ One word/phrase     | ✅ Amount in first sentence           |

