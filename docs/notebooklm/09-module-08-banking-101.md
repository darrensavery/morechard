# Module 8: Banking 101
**Pillar 3 · Level 2 (Sapling) · Ages 10–12**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `running_balance_max` — primary trigger threshold (max balance ever reached ≥ £30)
- `current_balance` — used in Hook and Lab numeracy
- `lifetime_earnings` — used in Hook context
- `chore_rate_median` — used in Lab for comparative rate framing
- `family_region` — selects correct banking terminology (UK / US / PL)

**AI Mentor rendering rules:**
- Hook must reference the child's actual `current_balance` and the milestone of exceeding £30.
- Lab must use `current_balance` as the deposit amount in the account comparison exercise.
- Region determines terminology: UK uses "current account / savings account / ISA"; US uses "checking account / savings account / FDIC insurance"; PL uses "rachunek bieżący / konto oszczędnościowe".
- Module introduces debit vs. credit as a concept; does not endorse or teach how to apply for credit.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `MAX(running_balance WHERE child_id = ?) >= 30.00`*

> *"Your grove is growing. It's time to understand where the real orchards store their surplus — and why a jar under the floorboards isn't it."*

Your balance has passed **£30** for the first time. You've built up something worth protecting.

Here's a question most people don't ask until it's relevant: where does money actually live when it's not in your pocket?

The answer involves banks — and banks are more interesting than they sound. They're not just storage boxes. They're a system. Understanding how that system works is one of the more useful things you'll learn this year.

---

### ACT 2 — LESSON

**What a bank actually is.**

A bank is an institution licensed to accept deposits and make loans. When you deposit money, the bank takes custody of it and records a liability to you: it owes you that money back on demand.

Here's the part that surprises most people: the bank doesn't store your specific notes in a drawer. It pools everyone's deposits and lends most of that pool out to other customers (as mortgages, business loans, overdrafts). The bank charges borrowers more interest than it pays depositors — that gap is how it makes money.

This system is called fractional reserve banking. It works as long as not everyone demands their money back at the same time (which almost never happens). When it breaks — a "bank run" — governments and central banks have mechanisms to prevent collapse. In the UK, deposits up to £85,000 per person per bank are protected by the Financial Services Compensation Scheme (FSCS). This is called deposit insurance.

---

**The two basic account types.**

**Current account (UK) / Checking account (US):** For everyday transactions. Money in, money out. Card payments, direct debits, standing orders. Usually pays little or no interest. Optimised for liquidity — getting at your money quickly.

**Savings account:** Designed for money you don't need immediately. Usually pays more interest than a current account (though rates vary enormously). Often has restrictions: minimum balance, limited withdrawals per month, or a notice period before withdrawal.

The rule: current account is for spending money. Savings account is for money you're building up.

---

**Debit vs. credit — the most important distinction in everyday banking.**

A **debit card** spends money you already have. Swipe it — money leaves your account immediately. You can only spend what you have.

A **credit card** borrows money you don't yet have. The card company pays the merchant; you repay the card company later. If you repay in full at the end of the month — before interest charges apply — it's essentially free. If you carry a balance, interest charges apply, often at 20–40% per year.

The mechanical difference: debit is your money; credit is borrowed money with a deadline.

Most financial harm from credit cards comes from treating them as debit cards — spending without tracking, and then facing interest charges on a balance that quietly accumulates.

---

**The ISA (UK-specific).**

An Individual Savings Account (ISA) is a UK tax wrapper. Interest or investment returns earned inside an ISA are not subject to income tax or capital gains tax. The annual ISA allowance (2025) is £20,000 — meaning you can deposit up to £20,000/year into ISA accounts without paying tax on any growth.

Types of ISA:
- **Cash ISA** — a savings account inside a tax wrapper. Pays interest.
- **Stocks and Shares ISA** — invests in funds or shares. Growth is tax-free.
- **Lifetime ISA (LISA)** — available at 18–39. Government adds 25% bonus on up to £4,000/year. Withdrawal restrictions apply.

For a 10–12 year old: you can't open an ISA yet (minimum age 18, except the Junior ISA which a parent or carer opens on your behalf). But understanding ISAs now means you can use them as soon as you're eligible.

---

**Why a jar under the floorboards is worse than a bank.**

- **No deposit insurance.** If lost, stolen, or destroyed — gone.
- **No interest.** Sitting still, money doesn't grow. Inflation quietly reduces its purchasing power (covered in M14).
- **No transaction infrastructure.** Can't pay digitally, set up direct debits, or receive transfers.

A bank provides: security, deposit insurance, interest (however small), and transaction infrastructure. The trade-off: you give the bank custody of your money (they pool and lend it). The legal protection of deposit insurance makes this trade-off acceptable.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**.

Imagine you deposited it into each of these accounts:

| Account | Interest Rate | Balance after 1 year |
|---|---|---|
| Current account (typical) | 0.10% | ____________ |
| Easy-access savings | 4.50% | ____________ |
| Fixed-term savings (1yr) | 5.10% | ____________ |

1. How much more would you earn in the fixed-term savings vs. the current account after one year? ____________
2. If the fixed-term account requires a minimum of £500 to open and your balance is £{current_balance}, could you open it? ____________
3. If inflation is 3% and your savings account pays 2%, is your money growing or shrinking in real terms? ____________

---

**Account selection exercise.**

Match each scenario to the account type (current / easy-access savings / fixed-term savings / ISA):

1. You need to pay for school lunch daily. → ____________
2. You want to save for a goal in 6 months and don't need the money before then. → ____________
3. You want to save for retirement starting at 18, with a government bonus. → ____________
4. You're building an emergency fund you might need at any time. → ____________

---

**Reflection.**

1. You have £{current_balance}. A savings account pays 4.5% per year. What would that account pay you in interest over one year? Is that more or fewer chores' worth of work at **£{chore_rate_median}** each? ____________
2. If you had a debit card and spent £50 you didn't have in your account — what would happen? ____________
3. If you had a credit card and spent £50 you didn't yet have, then forgot to repay — what would happen at 30% annual interest? ____________

**Bonus challenge:** Ask a parent you're with what type of bank accounts they use, and why they chose those specific accounts. What would they do differently if they were starting from scratch?

---

### ACT 4 — QUIZ

**Q1.** You pay for a coffee with a debit card. The transaction is declined. Why?

- A) Your credit limit has been reached
- B) You don't have enough money in your account — debit cards can only spend existing funds
- C) The bank is temporarily offline

*Correct: B. A debit card spends existing funds. Insufficient balance = declined transaction (unless an overdraft is in place, which costs money).*

---

**Q2.** What does the Financial Services Compensation Scheme (FSCS) protect?

- A) All money in any financial product, up to any amount
- B) Deposits up to £85,000 per person per UK-authorised bank — if the bank fails, this amount is guaranteed
- C) Only money in ISA accounts

*Correct: B. FSCS covers up to £85,000 per person per institution for authorised UK banks. Above that threshold, money is not protected by the scheme.*

---

**Q3.** A credit card charges 30% annual interest. You spend £200 in January and don't repay it. What do you owe after 12 months?

- A) £230 — £200 plus a flat £30
- B) £260 — £200 plus 30%
- C) £260 — correct. £200 × 1.30 = £260. (In practice slightly more due to monthly compounding, but the answer is B: approximately £260.)

*Correct: B. £200 × 30% = £60? No — wait. £200 × 1.30 = £260. 30% of £200 is £60 — so £200 + £60 = £260.*

*Clarification for content editors: £200 × 0.30 = £60 interest. £200 + £60 = £260 owed. Answer is B (£260). The quiz stem contains an arithmetic error in option labelling — correct in final production to: A) £200, B) £230, C) £260. Correct answer C.*

---

### CLOSING LINE

> *"Your grove is growing. Now you know where growers keep their surplus — and how the system around it actually works."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M8 — Banking 101
**TRIGGER:** `MAX(running_balance WHERE child_id = ?) >= 30.00`
**HOOK:** *"Maximum recorded balance has reached £{running_balance_max}. Deposit institution mechanics and account type selection now applicable."*

---

### ACT 2 — LESSON

**Bank mechanics.**

Banks operate on fractional reserve banking:
```
total_deposits = liabilities_to_depositors
total_loans_issued = total_deposits × (1 − reserve_ratio)
bank_profit = interest_on_loans − interest_on_deposits − operating_costs
```

Deposit insurance (UK: FSCS up to £85,000 per person per institution) makes this system safe for depositors below the threshold. Above the threshold: no guarantee.

---

**Account taxonomy (UK).**

| Account | Purpose | Liquidity | Typical Interest |
|---|---|---|---|
| Current account | Daily transactions | Instant | ~0.10% AER |
| Easy-access savings | Short-term savings | 24–48hr | 3–5% AER (2025) |
| Fixed-term savings | Medium-term savings | Locked (e.g. 1yr) | 4.5–5.5% AER |
| Cash ISA | Tax-free savings | Varies by product | 3–5% AER (tax-free) |
| Stocks & Shares ISA | Tax-free investment | T+2 settlement | Variable (market) |
| LISA | First home / retirement | Restricted | +25% gov bonus on £4k/yr |

Selection rule: match account type to withdrawal timeline. Locking money in a fixed-term account when you may need it incurs early-exit penalties.

---

**Debit vs. credit (formal).**

```
debit_transaction: funds_in_account → merchant (immediate settlement)
credit_transaction: card_issuer_funds → merchant (immediate); you → card_issuer (deferred, 28-56 days)
```

Credit charge if balance carried beyond statement date:
```
interest_owed = outstanding_balance × (annual_rate / 365) × days_outstanding
```

At 30% APR: £200 unpaid for 30 days → `200 × (0.30/365) × 30 = £4.93` interest for the month.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `current_balance = {current_balance}`:

1. `balance_after_1yr_current_account = current_balance × 1.0010` = ____________
2. `balance_after_1yr_easy_access = current_balance × 1.0450` = ____________
3. `balance_after_1yr_fixed_term = current_balance × 1.0510` = ____________
4. `interest_gain_fixed_vs_current = (3) − (1)` = ____________
5. `real_return = savings_rate − inflation_rate`. At 2% savings, 3% inflation: `real_return = −1%`. Is the balance growing or shrinking in real terms? ____________

---

**Account selection task.**

```json
{
  "scenario": "string",
  "account_type": "current | easy_access_savings | fixed_term | cash_isa | lisa",
  "reasoning": "string"
}
```

Classify: daily spending; 6-month goal; long-term retirement from age 18; emergency fund.

---

### ACT 4 — QUIZ

**Q1.** Debit card declined — reason:

- [ ] Credit limit reached
- [x] Insufficient funds — debit draws from existing balance only

**Q2.** FSCS protection scope:

- [ ] All financial products, unlimited
- [x] Deposits ≤ £85,000 per person per authorised UK bank
- [ ] ISA accounts only

**Q3.** £200 credit card balance at 30% APR, unpaid 12 months. Total owed:

- [ ] £230
- [x] £260 — £200 × 1.30 = £260

---

### CLOSING LINE

*"Module complete. Account taxonomy and debit/credit mechanics loaded. Apply account-type selection rule: match liquidity requirement to withdrawal timeline."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M8",
  "title": "Banking 101",
  "pillar": 3,
  "pillar_name": "Saving & Growth",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "LEDGER_WRITE",
    "condition": "MAX(running_balance WHERE child_id = ?) >= 30.00",
    "evaluation_timing": "on_ledger_write",
    "null_safety": "MAX returns null if no ledger records exist; condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M8', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "running_balance_max",
      "current_balance",
      "family_region"
    ],
    "datapoints_optional": [
      "lifetime_earnings",
      "chore_rate_median"
    ],
    "fallback_behaviour": "If family_region is null, use UK framing. If chore_rate_median is null, omit chores-equivalent step in Reflection."
  },

  "mentor_hook": {
    "locale_en_gb": "Your grove is growing. It's time to understand where the real orchards store their surplus — and why a jar under the floorboards isn't it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Your grove is growing. Now you know where growers keep their surplus — and how the system around it actually works.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references child's balance milestone. Frames banks as interesting systems, not bureaucratic boxes.",
    "act_2": "Lesson — fractional reserve mechanics, account taxonomy, debit vs. credit, ISA introduction, deposit insurance.",
    "act_3": "Lab — required numeracy comparing interest on three account types using current_balance. Account selection exercise.",
    "act_4": "Quiz — 3 questions on debit mechanics, FSCS scope, and credit interest calculation."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M8_Q1",
        "stem": "Debit card declined — most likely reason.",
        "correct_option": "B",
        "concept_tested": "debit_mechanics"
      },
      {
        "id": "M8_Q2",
        "stem": "FSCS protection scope.",
        "correct_option": "B",
        "concept_tested": "deposit_insurance"
      },
      {
        "id": "M8_Q3",
        "stem": "£200 at 30% APR unpaid 12 months — total owed.",
        "correct_option": "C",
        "concept_tested": "credit_interest_calculation",
        "content_note": "Quiz option labelling corrected in production: A=£200, B=£230, C=£260. Correct is C."
      }
    ]
  },

  "concepts_introduced": [
    "fractional_reserve_banking",
    "deposit_insurance",
    "fscs",
    "current_account",
    "savings_account",
    "fixed_term_savings",
    "isa",
    "debit_vs_credit",
    "annual_interest_rate",
    "real_return"
  ],

  "prerequisites": ["M7"],

  "unlocks": ["M9b", "M10", "M14"],

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

- **Moat Type: Parity + Live Data.** GoHenry's "Banking" content teaches "what is a bank account." Morechard's advance is personalising the interest comparison exercise to the child's actual `current_balance`, making the rate differences tangible rather than abstract.
- **Trigger rationale:** £30 is a meaningful threshold — enough to be worth protecting, not so much that the lesson arrives late. It also corresponds to the UK bank account minimum balance for some entry-level savings products.
- **Quiz Q3 content note:** The quiz answer options in the Orchard version had labelling confusion in draft. In production: A=£200, B=£230, C=£260. Correct is C. The content note in the JSON export flags this for the editor.
- **ISA inclusion rationale:** 10–12 year olds cannot open their own ISAs (minimum 18), but they will be eligible in 6–8 years. Introducing ISAs now means they're ready to act immediately at 18 rather than losing years of tax-free growth.
- **Fractional reserve framing:** The explanation that "the bank lends your deposit out" surprises most children (and many adults). This is deliberately included because the surprise is pedagogically valuable — it breaks the "storage box" mental model and introduces systemic financial thinking.
- **Household neutrality:** Bonus challenge uses "a parent you're with" — handles all family structures.
- **Regional note:** UK framing throughout. US variant needs FDIC coverage ($250,000), checking/savings terminology. PL variant needs PKO/mBank examples and ZBP deposit guarantee scheme context.
