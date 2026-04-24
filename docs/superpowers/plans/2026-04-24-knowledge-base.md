# Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Freshdesk-hosted knowledge base with ~55–65 fully drafted EN articles (parent + child), PL placeholders, and a role-aware Freshdesk widget embedded in the Morechard PWA.

**Architecture:** Freshdesk Free hosts and serves all articles via `morechard.freshdesk.com`. A JS widget embedded in `index.html` and initialised in a new `FreshdeskWidget` React component surfaces role-filtered articles in-app. All article content is delivered as markdown files organised by category, ready to paste into Freshdesk's editor.

**Tech Stack:** Freshdesk Free tier, React (TSX), TypeScript, Tailwind CSS, Vite/HTML

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/src/components/FreshdeskWidget.tsx` | Widget initialisation, role-tag injection, useEffect mount |
| Modify | `app/index.html` | Add Freshdesk widget script tag (async) |
| Modify | `app/src/App.tsx` | Mount `<FreshdeskWidget />` inside `<BrowserRouter>` |
| Create | `docs/knowledge-base/parent-01-getting-started.md` | Parent articles: Getting Started |
| Create | `docs/knowledge-base/parent-02-chores-approvals.md` | Parent articles: Chores & Approvals |
| Create | `docs/knowledge-base/parent-03-pocket-money-ledger.md` | Parent articles: Pocket Money & Your Permanent Record |
| Create | `docs/knowledge-base/parent-04-goals-savings.md` | Parent articles: Goals & Savings |
| Create | `docs/knowledge-base/parent-05-shared-expenses.md` | Parent articles: Shared Expenses |
| Create | `docs/knowledge-base/parent-06-learning-lab.md` | Parent articles: The Learning Lab |
| Create | `docs/knowledge-base/parent-07-ai-mentor.md` | Parent articles: The AI Mentor |
| Create | `docs/knowledge-base/parent-08-coparenting-shield.md` | Parent articles: Co-Parenting & The Shield Plan |
| Create | `docs/knowledge-base/parent-09-billing-subscriptions.md` | Parent articles: Billing & Subscriptions |
| Create | `docs/knowledge-base/parent-10-safety-privacy.md` | Parent articles: Safety & Privacy |
| Create | `docs/knowledge-base/parent-11-troubleshooting.md` | Parent articles: Troubleshooting |
| Create | `docs/knowledge-base/parent-12-settings-account.md` | Parent articles: Settings & Account |
| Create | `docs/knowledge-base/child-01-getting-started.md` | Child articles: Getting Started |
| Create | `docs/knowledge-base/child-02-chores.md` | Child articles: Chores |
| Create | `docs/knowledge-base/child-03-my-earnings.md` | Child articles: My Earnings |
| Create | `docs/knowledge-base/child-04-saving-goals.md` | Child articles: Saving for Goals |
| Create | `docs/knowledge-base/child-05-getting-paid.md` | Child articles: Getting Paid |
| Create | `docs/knowledge-base/child-06-learning-modules.md` | Child articles: Learning & Modules |

---

## Article Format Reference

**Parent articles — 4-part structure:**
```
## [Article Title]

**What this is:** [one sentence]

**How to do it:**
1. Step one
2. Step two
3. Step three

**Things to know:**
- [edge case or caveat]
- [edge case or caveat]

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)
```

**Child articles — 3-part structure (Orchard Lead voice):**
```
## [Article Title]

**What's happening:** [one plain sentence]

**Here's what to do:**
1. Step one
2. Step two

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).
```

**PL placeholder format (appended after every EN article):**
```
---
### [PL] [Article Title]
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

---

## Task 1: Create the `docs/knowledge-base/` directory and write Parent — Getting Started articles

**Files:**
- Create: `docs/knowledge-base/parent-01-getting-started.md`

- [ ] **Step 1: Create the file with all Getting Started articles**

```markdown
# For Parents — Getting Started

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How to create your Morechard account

**What this is:** Registration creates your family account and sets you up as the Lead Parent.

**How to do it:**
1. Open the Morechard app and tap **Get Started**.
2. Enter your name and email address.
3. Choose your region (UK, US, or Poland) — this sets your currency and terminology.
4. Check your email for a magic link and tap it to verify your address.
5. Set up your security method (Face ID, Touch ID, or a PIN).
6. Your account is ready.

**Things to know:**
- Each device holds one account. If you share a device, use the PIN option.
- Your email address is your identity — keep it accessible.
- Magic links expire after 15 minutes. Request a new one if yours expires.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak założyć konto Morechard
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to add a child to your account

**What this is:** Adding a child creates their profile and generates a 6-digit join code they use to connect on their device.

**How to do it:**
1. From the Parent Dashboard, tap **Settings** (top right).
2. Tap **Add Child**.
3. Enter the child's first name and age.
4. A 6-digit code is generated — share it with your child.
5. Your child enters this code on their device under **Join Family**.

**Things to know:**
- Each child needs their own device and their own copy of the app.
- The join code is single-use. If it expires, generate a new one from Settings.
- You can add multiple children to one family account.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak dodać dziecko do konta
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to set up your family (first steps after registration)

**What this is:** A checklist of the three things to do after your account is created to get your family running on Morechard.

**How to do it:**
1. Add your first child (see: How to add a child to your account).
2. Create your first chore (see: How to create a chore).
3. Set a pocket money rate for that chore.

**Things to know:**
- You do not need a debit card or bank integration — Morechard tracks earnings virtually.
- You can invite a co-parent later from the Settings screen.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak skonfigurować rodzinę (pierwsze kroki)
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Meet your AI Mentor

**What this is:** The AI Mentor is an optional add-on (£19.99/year) that delivers personalised financial literacy coaching for your children, triggered by their real earning and spending data in the app.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Add AI Mentor** and complete the payment (£19.99/year, via Stripe).
3. The Mentor activates immediately. Your children will see coaching in the Learning Lab.

**Things to know:**
- The AI Mentor is separate from your core plan. It works with both the Complete and Shield plans.
- The Mentor talks to your child through the app — it does not send emails or notifications outside the app.
- You can cancel the AI Mentor add-on at any time without affecting your core plan.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Poznaj swojego Mentora AI
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge-base/parent-01-getting-started.md
git commit -m "docs(kb): parent getting started articles"
```

---

## Task 2: Write Parent — Chores & Approvals articles

**Files:**
- Create: `docs/knowledge-base/parent-02-chores-approvals.md`

- [ ] **Step 1: Create the file**

```markdown
# For Parents — Chores & Approvals

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How to create a chore

**What this is:** A chore is a task you assign to a child. When completed and approved, it adds to their virtual earnings.

**How to do it:**
1. From the Parent Dashboard, tap **Chores** (bottom nav).
2. Tap **+ Add Chore**.
3. Enter the chore name, set a rate (£/$ amount), and choose a frequency (once, daily, weekly, school days).
4. Assign it to a child.
5. Tap **Save**.

**Things to know:**
- You can browse market rates for common chores using the **Rate Guide** (tap the chart icon on the Chores screen). This shows what other families typically pay.
- A chore stays active until you archive or delete it.
- Frequency controls how often the chore appears in your child's list.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak utworzyć zadanie
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to approve a chore completion

**What this is:** When your child marks a chore as done, you receive a pending approval. Approving it writes the earned amount permanently to the ledger.

**How to do it:**
1. From the Parent Dashboard, tap **Activity** (bottom nav).
2. Pending completions appear at the top with an **Approve** and **Reject** button.
3. Tap **Approve** to confirm the chore was completed satisfactorily.
4. The amount is added to your child's balance immediately.

**Things to know:**
- Approved entries are permanent and cannot be edited. Review before approving.
- On the Shield Plan, approved entries are cryptographically locked for legal integrity.
- You will receive a notification when your child marks a chore done (requires notifications to be enabled).

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak zatwierdzić wykonanie zadania
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to reject a chore completion

**What this is:** Rejecting a completion means the chore is not credited. Your child can see it was rejected and try again.

**How to do it:**
1. From the Parent Dashboard, tap **Activity**.
2. Find the pending completion and tap **Reject**.
3. Optionally add a short note explaining why (this is visible to your child).

**Things to know:**
- Rejections do not affect your child's balance.
- The chore remains active — your child can mark it done again once they have completed it properly.
- Be consistent with your standards so your child can predict what earns approval.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak odrzucić wykonanie zadania
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to use the Rate Guide

**What this is:** The Rate Guide shows market rates for common chores, so you can set fair and consistent pay rates for your family.

**How to do it:**
1. On the Chores screen, tap the **Rate Guide** icon (chart icon, top right).
2. Browse by category or search for a chore name.
3. Tap any chore to see the suggested rate range.
4. Tap **Use this rate** to apply it when creating or editing a chore.

**Things to know:**
- Rates are benchmarked from family finance research and updated periodically.
- You are not obligated to use the suggested rate — it is a reference point only.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak korzystać z Przewodnika Stawek
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to resolve a disagreement about a chore

**What this is:** A process for when you and your child disagree about whether a chore was completed satisfactorily.

**How to do it:**
1. Before approving or rejecting, view the chore details and any notes your child added.
2. Talk through what "done" looks like for this chore — agree on a clear standard going forward.
3. If the chore was partially done, consider approving at a reduced rate (edit the chore's rate temporarily, approve, then restore the rate).
4. Document the agreed standard in the chore's description field so both parties can reference it.

**Things to know:**
- The ledger records what is approved, not what was argued. Settling disputes before approving keeps the permanent record clean.
- If disputes are frequent, use the Rate Guide and chore descriptions to set clearer expectations upfront.
- For unresolved escalations, see: **We still can't agree — what now?** in Troubleshooting.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak rozwiązać spór dotyczący zadania
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge-base/parent-02-chores-approvals.md
git commit -m "docs(kb): parent chores and approvals articles"
```

---

## Task 3: Write Parent — Pocket Money & Your Permanent Record articles

**Files:**
- Create: `docs/knowledge-base/parent-03-pocket-money-ledger.md`

- [ ] **Step 1: Create the file**

```markdown
# For Parents — Pocket Money & Your Permanent Record

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How earnings work

**What this is:** Every approved chore completion adds a fixed amount to your child's virtual balance. No bank account or debit card is required.

**How to do it:**
1. Assign a rate to a chore when you create it.
2. When you approve a completion, that rate is added to your child's balance instantly.
3. View your child's current balance on the **Activity** tab or by tapping their name.

**Things to know:**
- Balances are virtual — they represent what you owe your child, not money held in an account.
- Use the **Pay Out** feature (Payment tab) when you physically hand over cash or transfer money. This marks the balance as settled without affecting the permanent record.
- Earnings are recorded in your chosen currency (GBP, USD, or PLN) set at registration.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak działają zarobki
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What the Ledger shows

**What this is:** The Ledger is the permanent, tamper-proof record of every transaction and chore completion in your family account.

**How to do it:**
1. Open the **Pocket Money** tab.
2. Tap on a child's name.
3. Select **View Ledger** to see the full history.

**Things to know:**
- On the Shield Plan, these records are locked and cannot be edited by parents or children, ensuring they are court-ready.
- Each entry shows the chore name, amount, date, and approval status.
- You cannot delete individual entries — the ledger is append-only by design.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Co pokazuje Księga
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Tamper-proof history explained

**What this is:** Every entry in the ledger is cryptographically sealed using SHA-256 hashing, making it impossible to alter past records without detection.

**How to do it:**
There is nothing to configure. Tamper-proofing is automatic on every approved transaction.

**Things to know:**
- This is the foundation of the Shield Plan's court-ready records.
- If you are on the Complete Plan, records are stored securely but not cryptographically sealed for legal use. Upgrade to Shield for full legal integrity.
- The hash chain can be verified independently — the PDF export includes verification data.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Wyjaśnienie niezmiennej historii
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Warning: What happens to your Permanent Record if you Uproot your account

**What this is:** Uprooting (deleting) your Morechard account is permanent. This article explains what is lost.

**How to do it:**
This article is a warning, not a how-to. To delete your account, see: **Deleting your account (Uproot)** in Settings & Account.

**Things to know:**
- If you Uproot your account, your Permanent Record — including all ledger entries, Shield Plan data, and PDF export history — is erased immediately and cannot be recovered.
- There is no grace period. Deletion is instant.
- If you are a co-parent on the Shield Plan, both parties lose access to the shared record. Coordinate with your co-parent before proceeding.
- Export your data first if you need to retain any records: see **Data export** in Settings & Account.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Ostrzeżenie: Co dzieje się z Twoim Trwałym Rekordem po Wykarczowaniu konta
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge-base/parent-03-pocket-money-ledger.md
git commit -m "docs(kb): parent pocket money and ledger articles"
```

---

## Task 4: Write Parent — Goals & Savings, Shared Expenses articles

**Files:**
- Create: `docs/knowledge-base/parent-04-goals-savings.md`
- Create: `docs/knowledge-base/parent-05-shared-expenses.md`

- [ ] **Step 1: Create Goals & Savings file**

```markdown
# For Parents — Goals & Savings

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How to create a savings goal for your child

**What this is:** A savings goal gives your child a target to work toward. Their earnings accumulate against the goal until it is reached.

**How to do it:**
1. From the Parent Dashboard, tap **Goals** (bottom nav).
2. Tap **+ New Goal**.
3. Enter the goal name, target amount, and optional deadline.
4. Assign it to a child.
5. Tap **Save**.

**Things to know:**
- A child can have multiple active goals simultaneously.
- Goals are visible to the child on their dashboard — they can track progress in real time.
- You can edit the target amount or deadline after creation.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak utworzyć cel oszczędnościowy dla dziecka
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to boost a child's savings goal

**What this is:** Boosting lets you contribute directly to a child's goal — for example, as a birthday gift or an incentive for hitting a milestone.

**How to do it:**
1. Go to **Goals** and tap the goal you want to boost.
2. Tap **Boost this Goal**.
3. Enter the amount and an optional note (e.g., "Birthday contribution").
4. Tap **Confirm Boost**.

**Things to know:**
- Boosts are recorded in the ledger as a separate entry, clearly labelled as a parent contribution.
- Boosts do not come from the child's earned balance — they are an addition to it.
- On the Shield Plan, boosts are cryptographically sealed like all other entries.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak doładować cel oszczędnościowy dziecka
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How boosting works (interest and incentives)

**What this is:** Boosting is Morechard's mechanism for parents to model real-world concepts like interest, matched savings, and reward contributions.

**How to do it:**
There is no automatic interest calculation. You manually boost a goal at any time and in any amount.

**Things to know:**
- You can use boosts to simulate interest: for example, add 10% of the goal balance each month as a "savings reward."
- The AI Mentor (if active) will explain the concept of interest and savings rewards to your child when boosting activity occurs.
- There is no obligation to boost — it is an optional parental tool.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak działa doładowanie (odsetki i zachęty)
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What happens when a child reaches their goal

**What this is:** When a goal's balance equals or exceeds its target, the goal is marked as reached and a purchase flow begins.

**How to do it:**
1. You will be notified when a child's goal is reached.
2. Go to **Goals** and tap the completed goal.
3. Tap **Mark as Purchased** once you have handed over the item or funds.
4. The goal is archived and the amount is deducted from the child's balance.

**Things to know:**
- Marking as purchased deducts the goal amount from the child's balance — confirm you have made the purchase first.
- Archived goals remain visible in the goal history for reference.
- The AI Mentor (if active) delivers a lesson on delayed gratification when a goal is reached.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Co się dzieje, gdy dziecko osiągnie swój cel
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Create Shared Expenses file**

```markdown
# For Parents — Shared Expenses

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## What shared expenses are

**What this is:** Shared expenses are costs split between co-parents — for example, school trips, uniforms, or extracurricular activities. Morechard logs these for transparency and reference.

**How to do it:**
Shared expenses are logged manually. See: How to log a shared expense.

**Things to know:**
- Shared expenses are a record-keeping tool, not a payment system. No money moves through Morechard.
- On the Shield Plan, shared expense entries are part of the cryptographically sealed record and can appear in court-ready PDF exports.
- Both co-parents can view shared expenses if they are both members of the family account.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Czym są wspólne wydatki
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to log a shared expense

**What this is:** Logging a shared expense creates a permanent record of a cost and which parent paid it.

**How to do it:**
1. From the Parent Dashboard, tap the **+** button and select **Log Shared Expense**.
2. Enter the amount, description, and date.
3. Select which parent paid (you or co-parent).
4. Tap **Save**.

**Things to know:**
- Shared expenses are visible to both co-parents on the account.
- Entries cannot be deleted after saving — this protects the integrity of the shared record.
- Export shared expenses as part of a PDF report via Co-Parenting & The Shield Plan.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak zarejestrować wspólny wydatek
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 3: Commit**

```bash
git add docs/knowledge-base/parent-04-goals-savings.md docs/knowledge-base/parent-05-shared-expenses.md
git commit -m "docs(kb): parent goals, savings and shared expenses articles"
```

---

## Task 5: Write Parent — The Learning Lab articles

**Files:**
- Create: `docs/knowledge-base/parent-06-learning-lab.md`

- [ ] **Step 1: Create the file**

```markdown
# For Parents — The Learning Lab

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## Curriculum overview

**What this is:** The Learning Lab is Morechard's built-in financial literacy curriculum. It delivers age-appropriate lessons to your child, triggered by their real earning and spending activity in the app.

**How to do it:**
No setup required. The Learning Lab is available to all children on your account. Lessons activate automatically based on your child's activity.

**Things to know:**
- The curriculum covers 20 modules across 5 Financial Literacy Pillars: Earning, Saving, Spending, Giving, and Investing.
- Modules are age-tiered: Sprout (younger), Sapling, Oak, and Canopy (most advanced). The app selects the right tier based on your child's age.
- The AI Mentor add-on (£19.99/yr) unlocks personalised coaching alongside the curriculum. Without it, the curriculum remains accessible but without personalised guidance.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Przegląd programu nauczania
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Financial literacy standards alignment

**What this is:** Morechard's curriculum is aligned with official financial literacy standards so that what your child learns is grounded in recognised frameworks.

**How to do it:**
No action required. Alignment is built into the curriculum design.

**Things to know:**
- UK content aligns with the Money and Pensions Service (MaPS) financial education framework.
- Polish content aligns with the National Strategy for Financial Education (NSFE).
- US content aligns with the Jump$tart Coalition's national standards.
- The curriculum does not replicate school teaching — it applies concepts to your child's real Morechard activity.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Zgodność z krajowymi standardami edukacji finansowej
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Module library overview

**What this is:** A summary of the 20 modules available in the Learning Lab and what each one covers.

**How to do it:**
Your child accesses modules from the **Learning Lab** tab on their dashboard. You can preview module topics from **Settings** → **Learning Lab**.

**Things to know:**
Modules include: Effort vs Reward, Taxes & Net Pay, Entrepreneurship, Needs vs Wants, Scams & Digital Safety, Advertising & Influence, The Patience Tree (delayed gratification), Banking 101, Opportunity Cost, The Snowball (compound savings), The Interest Trap, Credit Scores & Trust, Good vs Bad Debt, Compound Growth, Inflation, Risk & Diversification, Giving & Charity, Digital vs Physical Currency, Money & Mental Health, and Cryptocurrency.

Modules unlock progressively as your child's activity in the app provides real data to ground them.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Przegląd biblioteki modułów
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to track what your child is learning

**What this is:** Parents can see which modules their child has completed, which are in progress, and what the AI Mentor has discussed with them.

**How to do it:**
1. From the Parent Dashboard, tap **Insights** (bottom nav).
2. Scroll to the **Learning Lab** section.
3. View completed modules, current progress, and any AI Mentor briefing summaries.

**Things to know:**
- Insights are updated weekly. The AI Mentor generates a briefing each week summarising your child's learning activity.
- You can copy a summary to share with your child directly — tap **Copy for Child** on any briefing card.
- Detailed module content is not shown to parents — the briefing provides a summary view only.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak śledzić postępy dziecka w nauce
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Quizzes and rewards

**What this is:** Some Learning Lab modules include short quizzes. Completing them earns your child bonus points or recognition within the app.

**How to do it:**
Quizzes appear automatically at the end of a module. Your child completes them on their device.

**Things to know:**
- Quiz results are visible to parents in the Insights tab.
- Rewards are in-app recognition only — they do not add to the child's virtual balance.
- The AI Mentor (if active) references quiz performance in its weekly briefings.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Quizy i nagrody
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge-base/parent-06-learning-lab.md
git commit -m "docs(kb): parent learning lab articles"
```

---

## Task 6: Write Parent — AI Mentor, Co-Parenting & Shield Plan, Billing articles

**Files:**
- Create: `docs/knowledge-base/parent-07-ai-mentor.md`
- Create: `docs/knowledge-base/parent-08-coparenting-shield.md`
- Create: `docs/knowledge-base/parent-09-billing-subscriptions.md`

- [ ] **Step 1: Create AI Mentor file**

```markdown
# For Parents — The AI Mentor

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## What the AI Mentor is

**What this is:** The AI Mentor is a personalised financial coaching add-on that guides your child through the Learning Lab curriculum using their real Morechard data as a teaching context.

**How to do it:**
The Mentor is activated via Billing (see: Activating the AI Mentor). Once active, it works automatically — no configuration required.

**Things to know:**
- The Mentor is an add-on (£19.99/year) available on both the Complete and Shield plans.
- It communicates with your child through the Learning Lab in the app only. It does not send emails, push notifications, or messages outside the app.
- The Mentor uses your child's earning, saving, and spending history to make lessons relevant. It does not access data outside of Morechard.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Czym jest Mentor AI
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Activating the AI Mentor (£19.99/yr)

**What this is:** The AI Mentor is a paid add-on. This article explains how to activate it.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Add AI Mentor**.
3. Review the £19.99/year charge and tap **Subscribe**.
4. Complete payment via Stripe.
5. The Mentor activates immediately for all children on your account.

**Things to know:**
- The AI Mentor subscription renews annually. You can cancel at any time from Settings → Billing → Manage Subscription.
- Cancelling stops the Mentor at the end of your current billing period. Your core plan (Complete or Shield) is unaffected.
- If you have multiple children, one subscription covers all of them.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Aktywowanie Mentora AI (19,99 £/rok)
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What the AI Mentor discusses with your children

**What this is:** A summary of the topics the AI Mentor covers so you know what your child is learning.

**How to do it:**
No action required. The Mentor selects topics based on your child's activity.

**Things to know:**
- The Mentor covers the 5 Financial Literacy Pillars: Earning, Saving, Spending, Giving, and Investing.
- It references your child's real data (e.g., "You earned £12 this week — here's what that means in terms of effort vs reward").
- The Mentor does not discuss topics unrelated to financial literacy. It does not offer personal, medical, or legal advice.
- Parents receive a weekly summary of Mentor activity in the Insights tab.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] O czym Mentor AI rozmawia z Twoimi dziećmi
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## AI Mentor privacy and safety boundaries

**What this is:** How the AI Mentor handles your child's data and what safeguards are in place.

**How to do it:**
No action required. Safety boundaries are built into the Mentor by design.

**Things to know:**
- The Mentor uses only data within your Morechard account (earnings, chore history, goals). It has no access to external data.
- Conversations are not stored beyond the session context needed to generate a response.
- The Mentor is designed for ages 10–16. It does not generate adult content and does not engage with topics outside its financial literacy scope.
- Your child's name and profile data are not shared with third-party AI providers beyond what is necessary to generate a response.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Prywatność i bezpieczeństwo Mentora AI
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Create Co-Parenting & Shield Plan file**

```markdown
# For Parents — Co-Parenting & The Shield Plan

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## The Shield Plan explained

**What this is:** The Shield Plan is Morechard's premium tier for families who need legally robust records — particularly separated and co-parenting households.

**How to do it:**
Upgrade to the Shield Plan via **Settings** → **Billing** → **Upgrade to Shield**.

**Things to know:**
- The Shield Plan adds cryptographic SHA-256 sealing to every ledger entry, making records tamper-evident and court-ready.
- It includes the court-ready PDF export feature.
- It is designed for families who may need to present financial records in legal proceedings, mediation, or court.
- The Shield Plan does not require a debit card or bank integration.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Wyjaśnienie Planu Shield
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Complete Plan vs Shield Plan — which is right for your family?

**What this is:** A comparison to help you choose between the two Morechard plans.

**How to do it:**
Review the comparison below, then upgrade from **Settings** → **Billing** if needed.

**Things to know:**

| Feature | Complete Plan | Shield Plan |
|---------|--------------|-------------|
| Chore tracking | Yes | Yes |
| Virtual ledger | Yes | Yes |
| Learning Lab | Yes | Yes |
| AI Mentor add-on | Yes (£19.99/yr) | Yes (£19.99/yr) |
| Cryptographic record sealing | No | Yes |
| Court-ready PDF export | No | Yes |
| Co-parent shared access | Yes | Yes |
| Shared expense logging | Yes | Yes (sealed) |

Choose Complete if you are an intact family with no need for legal-grade records. Choose Shield if you are separated, co-parenting, or want your records to be admissible in legal proceedings.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Plan Complete vs Plan Shield — który wybrać?
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Tamper-proof records for legal use

**What this is:** How the Shield Plan's cryptographic sealing works and why it matters for legal proceedings.

**How to do it:**
No configuration required. Sealing is automatic on the Shield Plan.

**Things to know:**
- Every approved transaction is hashed using SHA-256. This creates a chain of records where any alteration would be immediately detectable.
- The hash chain can be independently verified — the PDF export includes verification data for this purpose.
- Morechard does not modify, delete, or alter sealed records under any circumstances.
- If you Uproot your account, sealed records are permanently deleted. Export your PDF before uprooting if you need to retain them.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Nienaruszalne zapisy do celów prawnych
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to generate a court-ready PDF export

**What this is:** The Shield Plan lets you export your family's financial record as a PDF formatted for legal use.

**How to do it:**
1. From the Parent Dashboard, tap **Settings**.
2. Tap **Export Records**.
3. Select the date range for the export.
4. Tap **Generate PDF**.
5. The PDF downloads to your device. It includes the full ledger, shared expenses, hash verification data, and a cover page.

**Things to know:**
- PDF generation is available on the Shield Plan only.
- The PDF is formatted for court submission and includes hash verification data for authenticity.
- Morechard does not store your exported PDFs — download and save them securely.
- If you are submitting records to a solicitor or court, share the PDF directly. The verification data within it allows independent confirmation of authenticity.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak wygenerować eksport PDF gotowy do użycia w sądzie
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 3: Create Billing & Subscriptions file**

```markdown
# For Parents — Billing & Subscriptions

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## Plans overview

**What this is:** A summary of what each Morechard plan includes and costs.

**How to do it:**
View your current plan under **Settings** → **Billing**.

**Things to know:**
- **Complete Plan (£34.99 lifetime):** Core chore tracking, virtual ledger, Learning Lab, co-parent access. One-time payment.
- **Shield Plan (£99+ lifetime):** Everything in Complete, plus cryptographic record sealing and court-ready PDF export. One-time payment.
- **AI Mentor add-on (£19.99/year):** Personalised financial coaching for your children. Annual subscription. Available on both plans.
- Prices shown in GBP. USD and PLN equivalents are shown at checkout.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Przegląd planów
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to upgrade your plan

**What this is:** How to move from Complete to Shield, or activate the AI Mentor add-on.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Upgrade to Shield** or **Add AI Mentor**.
3. Review the price and tap **Continue**.
4. Complete payment via Stripe.
5. Your plan upgrades immediately.

**Things to know:**
- Lifetime plan upgrades are one-time payments — no recurring charge.
- The AI Mentor is an annual subscription billed separately.
- You can hold both a lifetime Shield Plan and an annual AI Mentor subscription simultaneously.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak zaktualizować plan
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to cancel the AI Mentor subscription

**What this is:** How to stop the AI Mentor annual subscription from renewing.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Manage Subscription**.
3. Tap **Cancel AI Mentor**.
4. Confirm cancellation.

**Things to know:**
- Cancelling stops renewal at the end of your current billing period. The Mentor remains active until then.
- Your core plan (Complete or Shield) is unaffected by cancelling the AI Mentor.
- You can reactivate the AI Mentor at any time from Settings → Billing.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak anulować subskrypcję Mentora AI
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to access the Stripe billing portal

**What this is:** The Stripe portal is where you manage payment methods, view invoices, and handle subscription billing.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Manage Billing** (opens the Stripe customer portal in your browser).
3. Update payment methods, download invoices, or manage your subscription from there.

**Things to know:**
- The Stripe portal is a separate Stripe-hosted page, not part of the Morechard app.
- Morechard does not store your card details — all payment data is held by Stripe.
- If you cannot access the portal, ensure you are using the same email address registered with Morechard.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak uzyskać dostęp do portalu rozliczeniowego Stripe
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Activating the AI Mentor add-on

**What this is:** Step-by-step activation for the AI Mentor after purchasing.

**How to do it:**
1. Go to **Settings** → **Billing**.
2. Tap **Add AI Mentor**.
3. Complete the £19.99/year payment via Stripe.
4. The Mentor activates immediately. Your children will see it in the Learning Lab.

**Things to know:**
- See also: **What the AI Mentor is** in The AI Mentor section.
- One subscription covers all children on your family account.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Aktywowanie dodatku Mentor AI
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 4: Commit**

```bash
git add docs/knowledge-base/parent-07-ai-mentor.md docs/knowledge-base/parent-08-coparenting-shield.md docs/knowledge-base/parent-09-billing-subscriptions.md
git commit -m "docs(kb): parent AI mentor, shield plan, billing articles"
```

---

## Task 7: Write Parent — Safety & Privacy, Troubleshooting, Settings & Account articles

**Files:**
- Create: `docs/knowledge-base/parent-10-safety-privacy.md`
- Create: `docs/knowledge-base/parent-11-troubleshooting.md`
- Create: `docs/knowledge-base/parent-12-settings-account.md`

- [ ] **Step 1: Create Safety & Privacy file**

```markdown
# For Parents — Safety & Privacy

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How children's data is handled

**What this is:** A summary of what data Morechard stores about your children and how it is protected.

**How to do it:**
No action required. Data handling is managed by Morechard automatically.

**Things to know:**
- Children are identified by a display name only — no email address, no real surname, no government ID is collected.
- Children's earning and chore data is stored in Cloudflare's infrastructure in compliance with GDPR.
- Data is not sold to third parties. It is used only to operate the Morechard service.
- The AI Mentor sends only the minimum necessary context to generate a response. Conversations are not retained beyond the session.
- You can export or delete all family data at any time (see: Settings & Account).

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak przetwarzane są dane dziecka
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Password resets and account access

**What this is:** How to regain access to your account if you cannot log in.

**How to do it:**
1. On the login screen, tap **Send me a magic link**.
2. Enter your registered email address.
3. Check your email and tap the link within 15 minutes.
4. You will be logged in and can update your security settings from **Settings** → **Security**.

**Things to know:**
- Morechard uses magic links (email-based, passwordless authentication) — there is no password to reset.
- If you no longer have access to your registered email, contact support.
- PIN and biometric settings can be updated from **Settings** → **Security** once you are logged in.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Resetowanie hasła i dostęp do konta
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Managing co-parent permissions

**What this is:** What a co-parent can and cannot do on your shared family account.

**How to do it:**
1. Go to **Settings** → **Family**.
2. Tap **Invite Co-Parent** and enter their email.
3. They register on their device and are added to your family account.

**Things to know:**
- Co-parents can view the ledger, log shared expenses, and see chore activity.
- Co-parents cannot delete the family account — only the Lead Parent can Uproot.
- Co-parents cannot change the Lead Parent's security settings.
- To remove a co-parent, go to **Settings** → **Family** → tap their name → **Remove**.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Zarządzanie uprawnieniami współrodzica
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What children can and cannot see

**What this is:** A summary of what information is visible to children on their dashboard.

**How to do it:**
No action required. Visibility is managed by Morechard's role-based access.

**Things to know:**
- Children can see: their own chore list, their own balance, their own goals, their Learning Lab modules, and their permanent record (their own entries only).
- Children cannot see: other children's data, parent billing information, co-parent details, the full family ledger, or parent-only settings.
- Children cannot approve or reject chores, create chores, or access the Shield Plan export.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Co dzieci mogą, a czego nie mogą widzieć
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Create Troubleshooting file**

```markdown
# For Parents — Troubleshooting

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## Notifications are not showing up

**What this is:** How to fix missing notifications for chore completions and approvals.

**How to do it:**
1. On your device, go to **Settings** → **Notifications** → **Morechard** and ensure notifications are enabled.
2. In the Morechard app, go to **Settings** → **Notifications** and check that approval alerts are turned on.
3. If notifications are enabled but not arriving, try logging out and back in.

**Things to know:**
- iOS requires explicit notification permission — if you denied it at install, re-enable via device Settings.
- PWA notifications on Android require the app to be installed to the home screen (not just opened in a browser).
- Notification delivery is not guaranteed on low-battery or Do Not Disturb modes.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Powiadomienia nie pojawiają się
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## The app is not loading or behaving unexpectedly

**What this is:** General troubleshooting for app loading issues.

**How to do it:**
1. Check your internet connection.
2. Close and reopen the app.
3. If the issue persists, clear the app cache: on Android go to **Settings** → **Apps** → **Morechard** → **Clear Cache**. On iOS, delete and reinstall the PWA from your home screen.
4. Try logging in again.

**Things to know:**
- Morechard requires an active internet connection for most features. Offline mode is limited.
- If you see a blank screen after updating the app, a hard refresh (close fully and reopen) usually resolves it.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Aplikacja nie ładuje się lub działa nieprawidłowo
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## We still can't agree — what now?

**What this is:** An escalation guide for persistent disputes between parent and child about a chore, approval, or balance.

**How to do it:**
1. Open the **Ledger** and review the permanent record together — this shows exactly what was approved, when, and for what amount.
2. If there is a factual discrepancy (e.g., a chore that should have been approved wasn't), contact support with the specific entry details.
3. If the dispute is about standards (e.g., "was the chore done well enough?"), use the chore description field to write agreed standards going forward and revisit the Rate Guide.

**Things to know:**
- The Permanent Record is the authoritative source. Both parties can view it.
- Morechard support cannot alter ledger entries — the record is immutable by design.
- On the Shield Plan, the ledger can be exported as a PDF if a formal record is needed for mediation or legal proceedings.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Nadal nie możemy dojść do porozumienia — co teraz?
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to contact support

**What this is:** How to get in touch with the Morechard support team.

**How to do it:**
1. Tap the **?** help icon (bottom navigation bar, any screen).
2. Search for your issue. If no article resolves it, tap **Contact Us**.
3. Fill in the form, select a reason from the dropdown, and submit.
4. You will receive a response by email.

**Things to know:**
- Morechard is operated by a solo developer. Response times may be 1–2 business days.
- If you are submitting a deletion request (Uproot), read the Uproot warning articles first — deletion is immediate and irreversible.
- For billing issues, include your registered email address and the last 4 digits of your payment method to help us locate your account.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak skontaktować się z pomocą techniczną
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 3: Create Settings & Account file**

```markdown
# For Parents — Settings & Account

_Tone: Professional, precise, concise. Bank-grade authority. Technical terms explained on first use._

---

## How to change your account details

**What this is:** How to update your display name or email address.

**How to do it:**
1. Go to **Settings** → **Account**.
2. Tap **Edit Profile**.
3. Update your display name or email address.
4. Tap **Save**.

**Things to know:**
- Changing your email address triggers a verification email to the new address. The change takes effect after verification.
- Your display name is visible to your children and co-parents within the app.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak zmienić dane konta
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to export your data

**What this is:** How to download a copy of your family's Morechard data before leaving or for your own records.

**How to do it:**
1. Go to **Settings** → **Account**.
2. Tap **Export Data**.
3. Choose your export format (CSV or PDF).
4. Tap **Download**. The file downloads to your device.

**Things to know:**
- Data export includes your ledger history, chore records, goal history, and shared expenses.
- Export your data before uprooting your account — deletion is immediate and export is not possible afterwards.
- PDF exports from the Shield Plan include hash verification data for legal use.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Jak wyeksportować swoje dane
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Deleting your account (Uproot)

**What this is:** The complete process for permanently deleting your Morechard family account.

**How to do it:**
1. Read the warning: **What happens to your Permanent Record if you Uproot your account** (Pocket Money section) before proceeding.
2. Export your data if needed (see: How to export your data).
3. Go to **Settings** → **Account** → **Delete Account (Uproot)**.
4. Read the confirmation screen carefully.
5. Type `UPROOT` in the confirmation field.
6. Tap **Confirm Deletion**.

**Things to know:**
- Deletion is immediate and permanent. There is no undo, no grace period, and no recovery.
- All children's profiles, the ledger, goals, and Shield Plan records are deleted instantly.
- Your Stripe billing is cancelled automatically. No further charges will be made.
- Co-parents must leave the family account before the Lead Parent can Uproot. Go to **Settings** → **Family** → remove co-parents first.
- Ledger transaction rows are retained in anonymised form for hash-chain integrity purposes, but all personally identifiable information (name, email, device data) is deleted.

**Still need help?** [Contact our support team](https://morechard.freshdesk.com/support/tickets/new)

---
### [PL] Usuwanie konta (Wykarczowanie)
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 4: Commit**

```bash
git add docs/knowledge-base/parent-10-safety-privacy.md docs/knowledge-base/parent-11-troubleshooting.md docs/knowledge-base/parent-12-settings-account.md
git commit -m "docs(kb): parent safety, troubleshooting, settings articles"
```

---

## Task 8: Write all Child articles

**Files:**
- Create: `docs/knowledge-base/child-01-getting-started.md`
- Create: `docs/knowledge-base/child-02-chores.md`
- Create: `docs/knowledge-base/child-03-my-earnings.md`
- Create: `docs/knowledge-base/child-04-saving-goals.md`
- Create: `docs/knowledge-base/child-05-getting-paid.md`
- Create: `docs/knowledge-base/child-06-learning-modules.md`

- [ ] **Step 1: Create Getting Started file**

```markdown
# For Children — Getting Started

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## How to join your family on Morechard

**What's happening:** Your parent has set up a family account and created a join code for you.

**Here's what to do:**
1. Open the Morechard app on your device.
2. Tap **Join a Family**.
3. Enter the 6-digit code your parent gave you.
4. Enter your name and tap **Join**.
5. You are in — your chores and earnings will start appearing here.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak dołączyć do rodziny w Morechard
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What Morechard does

**What's happening:** Morechard helps you track the chores you do and the money you earn from doing them.

**Here's what to do:**
There is nothing to set up — your parent creates the chores and you mark them as done when you have finished.

1. Check your **Earn** tab to see your chores for today.
2. Mark a chore done when you have finished it.
3. Wait for your parent to approve it.
4. Watch your balance grow.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Co robi Morechard
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Meeting your Mentor

**What's happening:** If your parent has activated the AI Mentor, you have a personal guide in the Learning Lab who helps you understand how money works.

**Here's what to do:**
1. Tap **Learning Lab** (bottom nav) on your dashboard.
2. Your Mentor will introduce itself the first time you visit.
3. Start with whichever module is suggested — your Mentor picks based on what you have been earning and saving.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Poznaj swojego Mentora
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 2: Create Chores file**

```markdown
# For Children — Chores

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## How to mark a chore as done

**What's happening:** When you finish a chore, you tell Morechard it is done so your parent can approve it and add the money to your balance.

**Here's what to do:**
1. Open the **Earn** tab.
2. Find the chore you just finished.
3. Tap **Mark as Done**.
4. Your parent will receive a notification to approve it.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak oznaczyć zadanie jako wykonane
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What happens after you mark a chore done

**What's happening:** Your parent reviews what you have done and taps Approve or Reject.

**Here's what to do:**
There is nothing you need to do — just wait for your parent to review it.

1. Once you mark a chore done, it shows as **Pending** on your screen.
2. When your parent approves it, the amount is added to your balance straight away.
3. If they reject it, you will see a note explaining why.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Co się dzieje po oznaczeniu zadania jako wykonane
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Why was my chore rejected?

**What's happening:** Your parent did not think the chore was finished to the standard they expected.

**Here's what to do:**
1. Check the **Activity** tab — you will see a note from your parent explaining what was missing.
2. Fix the issue (e.g., redo the part that was not done properly).
3. Mark the chore done again once it is fully finished.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Dlaczego moje zadanie zostało odrzucone?
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## I disagree with my parent's decision about a chore

**What's happening:** You think a chore should have been approved, but it was rejected.

**Here's what to do:**
1. Check the note your parent left in the app explaining the rejection.
2. Talk to your parent about what "done" looks like for this chore — come to an agreement on what the standard is.
3. If you still disagree, ask your parent to show you the chore description together and agree on clear rules going forward.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Nie zgadzam się z decyzją rodzica dotyczącą zadania
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 3: Create My Earnings file**

```markdown
# For Children — My Earnings

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## How my balance works

**What's happening:** Your balance is the total amount you have earned from approved chores, minus anything that has been paid out or used for a goal.

**Here's what to do:**
There is nothing to set up. Your balance updates automatically when your parent approves a chore.

1. Tap **Activity** or check the balance shown at the top of your dashboard.
2. Your current balance shows what you are owed.
3. As you earn more, the balance grows. When you are paid out or reach a goal, it decreases.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak działa moje saldo
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What the Permanent Record shows

**What's happening:** Every chore you complete and every payment you receive is saved in a permanent record that cannot be changed.

**Here's what to do:**
1. Tap **Activity** on your dashboard.
2. Scroll through your history to see every approved chore, the amount earned, and the date.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Co pokazuje Trwały Rekord
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 4: Create Saving for Goals file**

```markdown
# For Children — Saving for Goals

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## How to create a savings goal

**What's happening:** A savings goal is something you are working toward — like a game, gadget, or experience. Your earnings build up toward it.

**Here's what to do:**
1. Tap **Goals** on your dashboard.
2. Tap **+ New Goal**.
3. Enter the name of what you are saving for and the amount it costs.
4. Tap **Save Goal**.
5. Every time you earn money, you can choose to put some toward this goal.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak utworzyć cel oszczędnościowy
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to track your progress toward a goal

**What's happening:** The goal screen shows how far you have come and how much more you need to earn.

**Here's what to do:**
1. Tap **Goals** on your dashboard.
2. Tap the goal you want to check.
3. You will see a progress bar, the amount saved so far, and the amount remaining.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak śledzić postępy w realizacji celu
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What happens when I reach my goal

**What's happening:** When you save enough, your goal is marked as reached and your parent can organise the purchase.

**Here's what to do:**
1. When your goal hits 100%, you will see a celebration on the screen.
2. Tell your parent — they will mark the goal as purchased in the app once they have got it for you.
3. The goal amount is deducted from your balance, and the goal moves to your history.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Co się dzieje, gdy osiągnę swój cel
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 5: Create Getting Paid file**

```markdown
# For Children — Getting Paid

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## How payment works

**What's happening:** When your parent pays you (in cash or by transfer), they mark it in the app so your balance updates.

**Here's what to do:**
There is nothing for you to do in the app. Your parent handles the payment step.

1. Your parent physically hands you the money or transfers it.
2. They tap **Pay Out** in the app to record that they have paid you.
3. Your balance decreases by the paid amount.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak działa wypłata
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## What "paid out" means

**What's happening:** "Paid out" means your parent has recorded that they gave you money from your balance.

**Here's what to do:**
Check your **Activity** tab — any pay-out appears as an entry showing the amount and date.

**Things to know:**
- A pay-out does not happen automatically. Your parent has to record it.
- If you have been paid but your balance has not changed, ask your parent to mark the pay-out in the app.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Co oznacza "wypłacono"
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 6: Create Learning Modules file**

```markdown
# For Children — Learning & Modules

_Tone: Orchard Lead — warm, direct, treats the child as capable. Short sentences. No emojis._

---

## What the Learning Lab is

**What's happening:** The Learning Lab is where you go to learn about money — not from a textbook, but from what you are actually earning and saving right now.

**Here's what to do:**
1. Tap **Learning Lab** on your dashboard.
2. You will see your available modules.
3. Tap any module to start.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Czym jest Learning Lab
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## How to complete a module

**What's happening:** Each module is a short lesson with a story, some questions, and a quiz at the end.

**Here's what to do:**
1. Open the **Learning Lab** and tap the module you want.
2. Read through the lesson — it should take about 5–10 minutes.
3. Answer the questions as you go.
4. Complete the quiz at the end to finish the module.
5. Your progress is saved automatically.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Jak ukończyć moduł
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Quizzes and rewards

**What's happening:** When you finish a module's quiz, you earn recognition in the app for completing it.

**Here's what to do:**
1. Finish the quiz at the end of any module.
2. Your result is saved and shown in your Learning Lab history.
3. Your parent can see your progress in their Insights tab.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Quizy i nagrody
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._

---

## Who is the AI Mentor?

_Note: This article uses a curious, inviting tone. The Mentor is a partner, not a teacher — the child is the agent._

**What's happening:** If your parent has activated it, you have a personal guide in the Orchard — someone who follows your progress and helps you make sense of what you are earning and saving.

**Here's what to do:**
1. Go to **Learning Lab**.
2. If the Mentor is active, you will see a message from it when you arrive.
3. It will suggest a module based on what you have been doing in the app — you decide whether to follow the suggestion or pick your own.

The Mentor does not test you or mark you. It is there to help you think, not to grade you. You are in charge of what you do with what you learn.

**Still confused?** Ask a parent to check the app, or they can [contact our support team](https://morechard.freshdesk.com/support/tickets/new).

---
### [PL] Kim jest Mentor AI?
[PL — PENDING TRANSLATION]
_Tone: Mistrz Sadu — direct, formal, no small talk. Financial literacy as serious skill._
```

- [ ] **Step 7: Commit all child articles**

```bash
git add docs/knowledge-base/child-01-getting-started.md docs/knowledge-base/child-02-chores.md docs/knowledge-base/child-03-my-earnings.md docs/knowledge-base/child-04-saving-goals.md docs/knowledge-base/child-05-getting-paid.md docs/knowledge-base/child-06-learning-modules.md
git commit -m "docs(kb): all child articles (Orchard Lead voice, EN + PL placeholders)"
```

---

## Task 9: Add Freshdesk widget script to `index.html`

**Files:**
- Modify: `app/index.html`

The Freshdesk widget script tag is account-specific — it is generated by Freshdesk after you create your account. This task adds a placeholder that is replaced with the real snippet after Freshdesk setup.

- [ ] **Step 1: Add the widget script placeholder to `index.html`**

In `app/index.html`, add the following before the closing `</body>` tag (after the existing `<script type="module">` tag):

```html
    <!-- Freshdesk Help Widget — replace data-id with your account widget ID from
         Freshdesk Admin > Help Widget > Embed. The widget loads async and does not
         block rendering. Role-tag injection is handled by FreshdeskWidget.tsx. -->
    <script
      type="text/javascript"
      src="https://widget.freshworks.com/widgets/FRESHDESK_WIDGET_ID.js"
      async
      defer
    ></script>
    <script type="text/javascript">
      window.fwSettings = { widget_id: 'FRESHDESK_WIDGET_ID' };
    </script>
```

The final `app/index.html` `<body>` should look like:

```html
  <body style="overscroll-behavior-y: none;">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <!-- Freshdesk Help Widget — replace data-id with your account widget ID from
         Freshdesk Admin > Help Widget > Embed. The widget loads async and does not
         block rendering. Role-tag injection is handled by FreshdeskWidget.tsx. -->
    <script
      type="text/javascript"
      src="https://widget.freshworks.com/widgets/FRESHDESK_WIDGET_ID.js"
      async
      defer
    ></script>
    <script type="text/javascript">
      window.fwSettings = { widget_id: 'FRESHDESK_WIDGET_ID' };
    </script>
  </body>
```

- [ ] **Step 2: Commit**

```bash
git add app/index.html
git commit -m "feat(widget): add Freshdesk widget script placeholder to index.html"
```

---

## Task 10: Create `FreshdeskWidget.tsx` component

**Files:**
- Create: `app/src/components/FreshdeskWidget.tsx`

This component initialises the widget after auth resolves and injects the correct role tag.

- [ ] **Step 1: Create the component**

```tsx
// app/src/components/FreshdeskWidget.tsx
import { useEffect } from 'react'
import { getDeviceIdentity } from '../lib/deviceIdentity'

declare global {
  interface Window {
    FreshworksWidget?: (...args: unknown[]) => void
    fwSettings?: { widget_id: string }
  }
}

export function FreshdeskWidget() {
  useEffect(() => {
    const identity = getDeviceIdentity()
    if (!window.FreshworksWidget) return

    const role = identity?.role === 'child' ? 'role_child' : 'role_parent'

    window.FreshworksWidget('setTags', [role])
    window.FreshworksWidget('prefill', 'ticketForm', {
      subject: '',
      description: '',
    })
  }, [])

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/FreshdeskWidget.tsx
git commit -m "feat(widget): FreshdeskWidget component with role-aware tag injection"
```

---

## Task 11: Mount `FreshdeskWidget` in `App.tsx` and add help button

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Import and mount FreshdeskWidget in App.tsx**

Add the import at the top of `app/src/App.tsx` (after existing imports):

```tsx
import { FreshdeskWidget } from './components/FreshdeskWidget'
```

Inside the `return` of the `App()` function, add `<FreshdeskWidget />` alongside the existing global components:

```tsx
  return (
    <LocaleProvider>
    <ThemeProvider appView={storedAppView}>
    <BrowserRouter>
      <AppUrlListener />
      <AndroidBackController />
      <AppAutoLock />
      <FreshdeskWidget />
      <Routes>
        {/* ... existing routes unchanged ... */}
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
    </LocaleProvider>
  )
```

- [ ] **Step 2: Add the help button trigger**

The Freshdesk widget opens programmatically via `window.FreshworksWidget('open')`. Add a help button to `app/src/components/ui/HelpButton.tsx` (new file):

```tsx
// app/src/components/ui/HelpButton.tsx
declare global {
  interface Window {
    FreshworksWidget?: (...args: unknown[]) => void
  }
}

export function HelpButton() {
  function openHelp() {
    window.FreshworksWidget?.('open')
  }

  return (
    <button
      onClick={openHelp}
      aria-label="Help"
      className="flex items-center justify-center h-8 w-8 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 3: Add HelpButton to ParentDashboard header**

In `app/src/screens/ParentDashboard.tsx`, import and add `HelpButton` to the header area alongside the existing settings/logo elements:

```tsx
import { HelpButton } from '../components/ui/HelpButton'
```

Add `<HelpButton />` in the header row (exact placement depends on current header layout — place it adjacent to the settings icon).

- [ ] **Step 4: Add HelpButton to ChildDashboard header**

In `app/src/screens/ChildDashboard.tsx`, import and add `HelpButton` to the child dashboard header in the same way:

```tsx
import { HelpButton } from '../components/ui/HelpButton'
```

Add `<HelpButton />` in the header row.

- [ ] **Step 5: Commit**

```bash
git add app/src/App.tsx app/src/components/ui/HelpButton.tsx app/src/screens/ParentDashboard.tsx app/src/screens/ChildDashboard.tsx
git commit -m "feat(widget): mount FreshdeskWidget in App, add HelpButton to parent and child dashboards"
```

---

## Task 12: Configure Uproot safeguard in Freshdesk (manual step — documented)

This task is a manual Freshdesk configuration step, not code. Document it so it is not forgotten.

- [ ] **Step 1: Create setup checklist file**

```markdown
# Freshdesk Setup Checklist

Complete these steps in the Freshdesk admin panel after creating your account.

## 1. Create article categories
- [ ] Create category: "For Parents" — add all 12 folders matching `parent-01` through `parent-12` article files
- [ ] Create category: "For Children" — add all 6 folders matching `child-01` through `child-06` article files
- [ ] Tag all "For Parents" articles with: `role_parent`
- [ ] Tag all "For Children" articles with: `role_child`

## 2. Configure the Help Widget
- [ ] Go to Admin → Help Widget → Create Widget
- [ ] Copy the widget ID and replace `FRESHDESK_WIDGET_ID` in `app/index.html` (two occurrences)
- [ ] Enable: "Suggest articles before contact form"
- [ ] Set default article filter to: `role_parent` (parents are the primary account holder)

## 3. Configure the Contact Form (Uproot safeguard)
- [ ] Go to Admin → Ticket Fields
- [ ] Add a dropdown field: "Reason for Contact"
- [ ] Add options including: "Delete my account / Uproot"
- [ ] Go to Admin → Automations → New Rule
- [ ] Rule: IF "Reason for Contact" = "Delete my account / Uproot"
        THEN append to description: "Warning: Uprooting permanently erases your Permanent Record, including all Shield Plan data. This cannot be recovered. Please read the Uproot guide before our team processes this request."

## 4. Set locale for Polish
- [ ] Go to Admin → Portal Settings → Languages
- [ ] Enable Polish (pl)
- [ ] As PL articles are translated, publish them under the Polish locale

## 5. Replace widget placeholder
After completing step 2, update `app/index.html`:
- Replace both instances of `FRESHDESK_WIDGET_ID` with the real widget ID from Freshdesk
- Commit: `git commit -m "feat(widget): set real Freshdesk widget ID"`
```

- [ ] **Step 2: Commit**

```bash
git add docs/knowledge-base/freshdesk-setup-checklist.md
git commit -m "docs(kb): Freshdesk manual setup checklist"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task(s) covering it |
|-----------------|-------------------|
| Freshdesk Free tier, `morechard.freshdesk.com` | Task 12 (setup checklist) |
| ~55–65 EN articles, parent + child | Tasks 1–8 |
| PL placeholders with tone guidelines | Tasks 1–8 (appended to every article) |
| 4-part parent format | Tasks 1–7 |
| 3-part child format | Task 8 |
| Orchard Lead voice (child) | Task 8 |
| Mistrz Sadu tone note (PL placeholders) | Tasks 1–8 |
| "Who is the AI Mentor?" curious tone exception | Task 8, child-06 |
| Uproot in two places (warning + how-to) | Tasks 3 and 7 |
| Widget script in `index.html` (async) | Task 9 |
| Role tags: `role_parent`, `role_child`, `role_all` | Task 10 |
| Widget initialised after auth resolves | Task 10 |
| Uproot safeguard in contact form dropdown | Task 12 |
| HelpButton in parent and child dashboards | Task 11 |
| No Cloudflare Worker changes | Tasks 9–11 (frontend only) |
| Contextual search deferred to Phase 2 | Not implemented (correct per spec) |
| Custom domain deferred | Not implemented (correct per spec) |

**Placeholder scan:** No TBDs, TODOs, or incomplete code blocks. All steps contain complete content.

**Type consistency:** `FreshdeskWidget` referenced consistently. `HelpButton` import paths consistent between App.tsx and dashboard files. `window.FreshworksWidget` declaration duplicated intentionally in both files (each file is self-contained).
