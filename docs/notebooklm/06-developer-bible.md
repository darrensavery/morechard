# MONEYSTEPS DEVELOPER BIBLE (V3.2)

## 1) System Overview & Core Identity
* **What the app does:** MoneySteps is a high-integrity "Truth Engine" and pocket money tracker for separated families. It provides legal-grade, immutable financial records and an AI Virtual Coach to educate children through real-world usage, reducing conflict by delegating "coaching" and "nagging" to a neutral third party.
* **Core user roles:** Parent (Sponsor/Observer), Child (Ages 10–16), and AI Mentor (Performance Coach).
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
    * `family_id`, `verification_mode` (Auto-Verify vs. Manual-Approval), `authorised_ids`, `timestamp`, `ip_address`.
    * `trial_start_date`, `is_activated`, `has_lifetime_license`, `ai_subscription_expiry` — all live here.
    * **Requirement:** Handshake logic (mutual consent) for all changes.
    * **Schema rule:** There is NO separate `family_governance` table. `families` is the single source of truth for both governance state and trial/licensing state.
* **Entity: Chore Ledger**
    * `household_id` (Private Silo), `task_description`, `status`, `child_id`.
    * **Partitioning:** Private household silos prevent interference from the other parent.

---

## 4) Key User Journeys (REFINED CORE)
* **The 14-Day "Active-Usage" Trial:**
    * **Trigger:** The 14-day countdown is NULL until the `ledger_entry_count >= 1`. 
    * **Activation Events:** The clock starts ticking only when the first 'Value Event' occurs (Chore Logged, Allowance Set, or Purchase Recorded).
    * **The "Setup Nudge":** If `active_trial = false` after 72 hours of registration, the AI Coach sends a prompt: *"I'm ready to start coaching! Log your first chore or set an allowance to begin your 14-day performance evaluation."*
    * **UI Element:** A 'Trial Progress Bar' on the Dashboard labeled "Coaching Evaluation."
    * **Hard Lock:** On Day 15 post-activation, redirect to `/paywall`. No read-only mode (except data export).
* **Allowance Tracker:** Child logs chores/spending; Parent verifies. The AI monitors the *behavioral delta* between these actions.
* **The AI Mentor (Child Service):** **Trigger-based coaching only.** No static modules. It identifies "Teachable Moments" based on 2026 financial literacy standards (UK/Poland). 
    * **Spending Velocity:** Nudge on "Delayed Gratification" if spend > 50% of balance.
    * **Inactivity:** Nudge on "Opportunity Cost" if idle > 72 hours.
    * **Value Audit:** Challenge high-frequency, low-value digital purchases (Loot boxes/Scams).
    * **Independence Score:** Tracks "Autonomy" (Did the child log the chore themselves, or did the parent initiate?).
* **The AI Advisor (Parent Service):** Delivers "Scouting Reports" on the child's **Consistency** (chore completion) and **Discipline** (saving vs. spending ratios).
* **The Audit Trail:** The ledger acts as the "Neutral Witness" for both parents, providing court-ready proof of activity without needing parent-to-parent chat.

---

## 5) Security, Privacy & Constraints
* **Auth constraints:** Changing governance modes requires a "Mutual Consent Handshake" sign-off from both parents.
* **Data access rules:** Transactions are immutable. Cryptographic fingerprints ensure court-admissibility.
* **Child safety:** AI flags risks like "loot boxes," online fraud, and BNPL debt spirals.
* **Messaging Constraint:** **STRICT BAN** on human-to-human chat functionality between parents.
* **Trial State Persistence:** The `trial_start_date` and `activation_status` must be stored in the Cloudflare D1 `families` table, not in client-side localStorage. The /paywall redirect must be handled via a Cloudflare Worker Middleware check on every authenticated request to prevent "UI-only" bypasses.

---

## 6) Internationalisation & Performance
* **Bilingual UI:** Full support for English and Polish.
* **Currency:** Stored exclusively as integers. Exchange rate snapshots (GBP/PLN) captured at the moment of verification.
* **Regional AI Personas:** * **UK:** Collaborative/Egalitarian tone.
    * **Poland:** Direct/Formal tone (including "Pan/Pani" addresses for 16+).
* **Performance:** Optimized PWA to bypass App Store taxes.

---

## 7) Repo & Code Conventions
* **Patterns to follow:**
    * Financial models (Interest/Purchasing Power) must use LaTeX.
    * AI must use "Process Language" (growth mindset) instead of "Outcome Language."
    * All currency must be stored as Integers.
* **Patterns to avoid:**
    * **NO** human-to-human chat/messaging.
    * **NO** deletion of ledger entries.
    * **NO** "Small Talk" in the Polish AI persona.

---

## 8) Payment & Licensing Schema (Added V3.2)
* **Migration:** `migrations/0002_trial_and_payments.sql`
* **Columns added to `families`:** `trial_start_date`, `is_activated`, `has_lifetime_license`, `ai_subscription_expiry`
* **New table:** `payment_audit_log` — immutable Stripe transaction record keyed on `stripe_session_id UNIQUE`
* **Indices:** `idx_family_trial`, `idx_family_licenses` — support low-latency Worker middleware paywall checks
* **Wrangler command:** `npx wrangler d1 execute <DATABASE_NAME> --file=./migrations/0002_trial_and_payments.sql`
* **Caveat:** D1 does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS` — migration is one-shot; guard against re-running on a live DB.

---

## 9) Known Issues / Technical Debt
* **Migration Debt:** Requires batch-insert scripts for Firebase-to-D1 migration.
* **UI Bloat:** Explicit directive to focus strictly on the Ledger and the AI Coach; avoid adding social features or complex libraries.

---



## 9) Implementation Backlog (STRICT SCOPE)

3. **The 14-Day Lock:** Middleware for the trial countdown and the `/paywall` hard-lock.
4. **The Coach Triggers:** Background logic to trigger AI nudges based on ledger inactivity or spending velocity.
5. **Audit PDF Engine:** Generation of cryptographic "Financial & Developmental Health" reports.
6. **Trial Logic & UI:** Middleware for the 'Active-Usage' 14-day countdown + Shadcn Progress Bar component on the Dashboard.