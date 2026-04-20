# Module 10: The Interest Trap
**Pillar 4 · Level 2 (Sapling) · Ages 10–12**

> **V3 template.** This module teaches borrowing costs — a financial mechanism that Morechard simulates in a limited form through the Parental Loan feature, but does not replicate at real-world scale. The **Sovereign Ledger Honest Framing opener** applies because the lesson includes credit card interest rates and commercial lending that Morechard does not model.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `loan_request_raised` — primary trigger condition
- `parent_loan_enabled` — secondary trigger condition
- `loan_amount` — Hook personalisation and Lab numeracy
- `loan_repayment_terms` — used in Lab if available
- `current_balance` — context for Lab comparison
- `chore_rate_median` — used in Lab labor equivalent of interest cost

**AI Mentor rendering rules:**
- Hook must reference whether the trigger was a loan request or parent-enabled loan feature.
- Lab must use the actual `loan_amount` in interest calculations.
- Lesson must distinguish between the parental loan (agreed terms, no commercial interest) and real-world credit (legal contract, compounding interest, consequences for non-payment).
- Module must not discourage all borrowing — frame as "borrow with eyes open, not blindly."

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `loan_request_raised = true OR parent_loan_enabled = true`*

> *"Borrowing tomorrow's seeds to buy today's fruit — it can work. But the vine always wants something back. Let me show you the cost."*

You've asked to borrow money — or a borrowing option has been set up for you. That's a real thing. Adults do it all the time.

The question isn't whether borrowing is good or bad. The question is: do you know exactly what it costs?

Because borrowing isn't free. Even when a parent says yes, even when the terms seem generous — you're agreeing to repay something in the future. In the real world, that future repayment is always bigger than what you borrowed today.

That's the vine. Let's look at what it actually takes.

---

### ACT 2 — LESSON

**What borrowing actually is.**

When you borrow money, you receive something today in exchange for a promise: you'll return it later, plus extra.

The extra is called interest. It's the price of having money now instead of waiting until you've earned it.

From the lender's perspective — whether that's a parent, a bank, or a credit card company — lending involves risk. They might not get their money back. Interest compensates them for that risk, and for the time their money is tied up.

From the borrower's perspective: interest means the thing you bought costs more than its sticker price. Always.

---

**How interest turns a small loan into a large one.**

Imagine you borrow £100 at 20% interest per year (a realistic credit card rate in 2025).

- After 1 year, if you haven't repaid: you owe £120.
- After 2 years: £144.
- After 3 years: £173.
- After 5 years: £249.

You borrowed £100. If you wait five years to repay, you owe almost £250.

That's compounding working against you. The same mechanism that makes savings grow — interest calculated on a growing total — makes debt grow too. When it's your savings, it works for you. When it's your debt, it works against you.

---

**The three types of borrowing you'll encounter.**

**Parental loans** — informal agreements with a parent or carer. Interest is often zero or symbolic. Repayment terms are usually flexible. The risk is relational, not legal: not repaying damages trust, which is worth more than money.

**Overdrafts** — bank accounts that allow you to go below zero. Banks charge interest or fees on the overdrawn amount. Some overdrafts are free up to a limit; beyond that, charges apply quickly.

**Credit cards** — the most common form of consumer borrowing. You spend using the bank's money; you repay the bank later. If you repay in full before the due date — free. If you carry a balance, interest applies at rates typically between 20–40% per year. The interest compounds monthly.

**Buy Now Pay Later (BNPL)** — newer, often presented as "interest-free." The catch: missed payments trigger high penalty rates, and the psychological ease of BNPL makes it easier to over-commit. It's debt, even when the marketing doesn't say so.

---

**The rule that protects you.**

Never borrow for something that won't exist by the time you've finished paying for it.

A chocolate bar on credit — paid off over months — costs more than its price and is gone long before the debt is cleared.

A skill course on credit — if it genuinely increases your earnings — might make sense, because the return on the course outlasts the debt.

This is the core of "good debt vs. bad debt" — which Module 12 covers in detail.

For now: the simpler rule. Before borrowing, ask: **will this still be worth the total cost (price + interest) by the time I've finished paying?**

---

### ACT 3 — LAB

**Numeracy check (required).**

You've requested to borrow **£{loan_amount}**.

Imagine this were a commercial credit card at 30% annual interest (a realistic rate for someone without credit history).

1. If you repaid it in full after one year: total cost = £{loan_amount} × 1.30 = ____________
2. Interest paid = total cost − original loan = ____________
3. How many chores at **£{chore_rate_median}** would the interest cost alone represent? ____________
4. If you only paid the minimum each month (assume 2% of balance) and took 5 years to repay, the total repaid would be roughly £{loan_amount} × 1.75 = ____________. (This is a rough approximation; actual figures depend on monthly compounding.)

---

**Parental loan comparison.**

Your actual loan arrangement:
- Amount borrowed: **£{loan_amount}**
- Interest rate: ____________ (ask the parent you're with, or note if zero)
- Repayment plan: ____________

Compare:
- Total cost with zero interest: **£{loan_amount}** — you repay exactly what you borrowed.
- Total cost with 30% commercial interest over one year: ____________

The difference is the value of the parental arrangement. How many chores is that difference worth? ____________

---

**Repayment plan.**

If you borrowed £{loan_amount} and want to repay it over {loan_target_weeks} weeks:

1. Weekly repayment needed: £{loan_amount} / {loan_target_weeks} = ____________
2. As a percentage of your typical weekly earnings ({chore_rate_median} × average chores per week): ____________ %
3. What will you have to give up or reduce to make this repayment? ____________

---

**Reflection.**

1. Is what you borrowed for still going to be worth it by the time you've repaid it? ____________
2. If the parental loan had commercial interest (30%), would you still have borrowed? ____________
3. What's one thing you could save up for instead of borrowing next time — and how long would it take? ____________

**Bonus challenge:** Ask a parent you're with to describe the first time they borrowed money. What was it for? Did the total cost (including interest) change how they felt about the purchase?

---

### ACT 4 — QUIZ

**Q1.** You borrow £50 at 20% annual interest and take one full year to repay. How much do you pay back in total?

- A) £50 — you return what you borrowed
- B) £60 — £50 plus 20% of £50
- C) £70 — the interest compounds each month

*Correct: B. 20% of £50 = £10. Total repayment = £60. (In practice with monthly compounding slightly more, but £60 is the correct answer for annual simple interest at 20%.)*

---

**Q2.** What is Buy Now Pay Later (BNPL)?

- A) A government scheme to help people afford essentials
- B) A form of consumer credit that defers payment — debt, even when marketed as "interest-free"
- C) A savings tool that allows you to reserve items before paying

*Correct: B. BNPL is deferred payment — debt. "Interest-free" applies only if repaid on time; missed payments trigger penalties. The ease of use makes over-commitment more likely.*

---

**Q3.** The best rule for deciding whether borrowing is justified:

- A) Only borrow if a trusted adult says it's fine
- B) Only borrow if the thing you're buying will still be worth the total repayment cost (price + interest) by the time the debt is cleared
- C) Never borrow — always save first

*Correct: B. The question is about total cost vs. lasting value. A short-lived purchase on long-term debt fails this test. A productive asset that lasts longer than the debt may pass it. C is too absolute — sometimes borrowing makes sense.*

---

### CLOSING LINE

> *"The vine always wants something back. Now you know exactly what, and how to decide whether the fruit is worth it."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M10 — The Interest Trap
**TRIGGER:** `loan_request_raised = true OR parent_loan_enabled = true`
**HOOK:** *"Loan event detected. Borrowing cost framework applies. Review before commitment."*

---

### ACT 2 — LESSON

**Borrowing mechanics.**

```
total_repayment = principal × (1 + annual_rate)^years
interest_cost = total_repayment − principal
```

Interest is the price of accessing capital before earning it. From borrower's perspective: effective cost of purchase = sticker_price + interest_cost.

---

**Debt compounding (unfavourable).**

The same compound formula that grows savings also grows debt:

```
outstanding_debt_year_n = principal × (1 + rate)^n
```

Compound interest on debt means unpaid balances grow non-linearly. Minimum-payment strategies extend the repayment period and dramatically increase total interest paid.

---

**Borrowing instrument taxonomy.**

| Instrument | Interest | Compounding | Consequences of default |
|---|---|---|---|
| Parental loan | 0% (typically) | None | Relational trust damage |
| Overdraft | Varies (0–40%) | Daily/monthly | Fees + credit score impact |
| Credit card | 20–40% APR | Monthly | Credit score impact, debt spiral |
| BNPL | 0% if on time | N/A (penalty rates) | Penalty fees, credit impact |
| Personal loan | 5–30% APR | Monthly | Legal action, credit impact |

---

**Borrowing decision rule.**

```
borrow_justified = (value_at_debt_clearance > total_repayment_cost)
```

Where:
- `value_at_debt_clearance` = value of purchased item when debt is fully repaid
- `total_repayment_cost` = principal + total_interest_paid

If purchased item depreciates to zero before debt cleared: `borrow_justified = false`.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `loan_amount = {loan_amount}`, `chore_rate_median = {chore_rate_median}`:

1. `total_at_20pct_1yr = loan_amount × 1.20` = ____________
2. `total_at_30pct_1yr = loan_amount × 1.30` = ____________
3. `interest_cost_30pct = total_at_30pct_1yr − loan_amount` = ____________
4. `chores_to_cover_interest = interest_cost_30pct / chore_rate_median` = ____________
5. `total_at_30pct_5yr_approx = loan_amount × 1.75` = ____________ (minimum payment approximation)

---

**Repayment schedule.**

```json
{
  "principal": loan_amount,
  "annual_rate": 0.30,
  "repayment_period_weeks": number,
  "weekly_repayment": "principal / repayment_period_weeks",
  "pct_of_weekly_earnings": "weekly_repayment / (chore_rate_median × avg_chores_per_week) × 100",
  "total_repaid": number,
  "borrow_justified": true | false
}
```

---

### ACT 4 — QUIZ

**Q1.** `principal = £50`, `rate = 20%`, `time = 1 year`. Total repayment:

- [ ] £50
- [x] £60 — `50 × 1.20 = £60`
- [ ] £70

**Q2.** BNPL classification:

- [ ] Government scheme
- [x] Consumer credit — deferred payment is debt regardless of marketing framing
- [ ] Savings tool

**Q3.** Borrow-justified decision rule:

- [ ] Trusted adult approval
- [x] `value_at_debt_clearance > total_repayment_cost` — lasting value must exceed total cost
- [ ] Never borrow

---

### CLOSING LINE

*"Module complete. Borrowing cost framework loaded. Apply decision rule: `value_at_debt_clearance > total_repayment_cost` before committing to any debt instrument."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M10",
  "title": "The Interest Trap",
  "pillar": 4,
  "pillar_name": "Borrowing & Debt",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "LOAN_EVENT",
    "condition": "loan_request_raised = true OR parent_loan_enabled = true",
    "evaluation_timing": "on_loan_event",
    "null_safety": "If neither condition is true, module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M10', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "loan_amount",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "loan_request_raised",
      "parent_loan_enabled",
      "loan_repayment_terms",
      "current_balance",
      "loan_target_weeks"
    ],
    "fallback_behaviour": "If loan_amount is null, Lab uses £20 as illustrative example. If chore_rate_median is null, use regional fallback rate. If loan_target_weeks is null, Lab repayment plan section uses 4 weeks as default."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "Borrowing tomorrow's seeds to buy today's fruit — it can work. But the vine always wants something back. Let me show you the cost.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The vine always wants something back. Now you know exactly what, and how to decide whether the fruit is worth it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — acknowledges loan event. Frames borrowing as legitimate but not free.",
    "act_2": "Lesson — borrowing defined, compound debt mechanics, three instrument types, BNPL explained, borrowing decision rule introduced.",
    "act_3": "Lab — required numeracy on loan_amount at 20% and 30% interest. Parental loan comparison. Repayment plan calculation.",
    "act_4": "Quiz — 3 questions on interest calculation, BNPL classification, and borrowing decision rule."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M10_Q1",
        "stem": "£50 at 20% annual interest, 1 year. Total repayment.",
        "correct_option": "B",
        "concept_tested": "interest_calculation"
      },
      {
        "id": "M10_Q2",
        "stem": "BNPL — correct classification.",
        "correct_option": "B",
        "concept_tested": "bnpl_as_debt"
      },
      {
        "id": "M10_Q3",
        "stem": "Correct borrowing decision rule.",
        "correct_option": "B",
        "concept_tested": "borrow_justified_rule"
      }
    ]
  },

  "concepts_introduced": [
    "interest_as_borrowing_cost",
    "compound_debt",
    "parental_loan",
    "overdraft",
    "credit_card",
    "buy_now_pay_later",
    "total_repayment_cost",
    "borrow_justified_rule"
  ],

  "prerequisites": ["M9b"],

  "unlocks": ["M11", "M12"],

  "d1_logging": {
    "table": "unlocked_modules",
    "columns": ["child_id", "module_id", "triggered_at"],
    "duplicate_guard": "INSERT OR IGNORE"
  }
}
```

---

## PEDAGOGICAL NOTES
*(For module authors)*

- **Moat Type: Parity + Live Data.** GoHenry and Greenlight both mention interest; neither personalises the calculation to the child's actual loan amount. Morechard fires at the moment of a real loan event and uses the child's own `loan_amount` in the interest projection — making it immediate and personal.
- **Trigger rationale:** The module fires on any loan event — request or parent-enabled. This is exactly the right moment: the child has just entered into or considered a borrowing arrangement, so the lesson is immediately actionable.
- **Honest Framing rationale:** Morechard's parental loan feature does not charge commercial interest. The Honest Framing opener makes clear that the lesson is about real-world borrowing instruments the child will encounter, not the app's internal mechanics.
- **BNPL inclusion:** Buy Now Pay Later products are increasingly targeted at teenagers. Including them here (at Sapling tier, 10–12) is deliberate — they are more likely to encounter BNPL through gaming, fashion, and electronics before traditional credit products.
- **Non-prescriptive on all borrowing:** The module must not say "never borrow." The borrow-justified rule is the nuanced tool — use it to evaluate each decision. This builds judgment rather than blanket avoidance.
- **Household neutrality:** Bonus challenge uses "a parent you're with." Parental loan comparison uses "the parent you're with" without assuming which parent set up the arrangement.
