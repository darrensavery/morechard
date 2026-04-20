# Module 2: Taxes & Net Pay
**Pillar 1 · Level 2 (Sapling) · Ages 10–12**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `lifetime_earnings` — primary trigger threshold and Hook personalisation
- `chore_rate_median` — used in Lab numeracy (gross-to-net calculation)
- `last_chore_amount` — used in Act 2 Lesson example (concrete deduction illustration)
- `distinct_chore_types` — used to enrich Lesson context
- `family_region` — selects correct tax framing (UK NI + Income Tax / US FICA / PL ZUS)

**AI Mentor rendering rules:**
- Hook must reference the child's actual `lifetime_earnings` and region-appropriate terminology.
- Lab numeracy must use the child's own `chore_rate_median` as the gross wage input.
- If `family_region = 'UK'`, use NI and Income Tax framing. If `US`, use FICA (Social Security + Medicare). If `PL`, use ZUS and PIT framing. Fallback to UK if region unknown.
- Lesson must not suggest taxes are unfair — frame as collective infrastructure investment.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `SUM(ledger.amount WHERE type = 'chore_approved') >= 20.00`*

> *"You've earned your first real harvest. But before we count the apples, let's talk about the slice the orchard infrastructure quietly takes."*

You've earned **£{lifetime_earnings}** so far. Real money, earned by real effort.

Here's something nobody explains until you get your first proper payslip: the number your employer writes on your contract is not the number that arrives in your account. There's a gap between them. That gap has a name and a purpose — and the sooner you understand it, the less surprised you'll be when you meet it.

---

### ACT 2 — LESSON

**The orchard has shared costs.**

Orchards don't run on individual effort alone. Roads that connect them to markets, water systems, equipment that nobody could afford alone — these exist because everyone chips in. Taxes are the chip-in.

When you earn money in a job, two things happen at once:
1. You receive your pay.
2. A portion is redirected — before it reaches you — to fund shared infrastructure.

In the UK, this happens through two main deductions:

**Income Tax** — a percentage of earnings above a threshold (the Personal Allowance). The more you earn, the higher the rate. In 2025, earnings up to £12,570 are tax-free. Above that, the basic rate is 20%.

**National Insurance (NI)** — a separate contribution that funds the NHS and state pension. Starts on earnings above £12,570 at 8% (2025 rates). It's a different calculation from Income Tax — you pay both simultaneously on the same earnings above the threshold.

---

**The payslip you'll eventually see.**

A payslip shows:

```
Gross Pay:          £2,000
Income Tax:           £286
National Insurance:   £110
                    ──────
Net Pay:            £1,604
```

That gap — £396 — didn't disappear. It went somewhere specific: NHS, roads, schools, unemployment support, state pensions. These exist because people who earned before you paid into them, and people who earn after you will pay into them when you draw on them.

---

**Why the rates go up as you earn more.**

If you earn £200,000, you don't pay 20% on all of it. You pay 0% on the first £12,570, 20% on the next chunk, then 40% on the next chunk, then 45% on the rest. This is called a progressive tax system.

The logic: someone earning £200,000 can afford to contribute a larger share without it affecting their ability to meet essential needs. Someone earning £15,000 cannot. The rate changes with ability to pay.

You can agree or disagree with whether the current thresholds are set correctly — many adults do disagree, and that's a legitimate political debate. But the principle — contribution relative to capacity — is how almost all tax systems work.

---

**The three things taxes fund (in rough order of size).**

1. **Social security** — unemployment benefit, disability support, state pension.
2. **Healthcare** — the NHS (UK) or Medicaid/Medicare equivalents elsewhere.
3. **Infrastructure** — roads, schools, courts, defence, public services.

When you use a road, a hospital, a school, or call the emergency services — that was paid for in advance by tax. Not just yours. Everyone's.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your median chore rate is **£{chore_rate_median}**. Let's work out what a gross-to-net calculation looks like.

Imagine you worked enough chores this week to earn £{chore_rate_median × 40} gross (40-hour week equivalent, for practice).

1. The Income Tax Personal Allowance is £12,570/year, which is £241.73/week. If your gross weekly pay is below £241.73, Income Tax = £0. Is your hypothetical week above or below this? ____________
2. NI kicks in above £242/week at 8%. If your weekly gross is £300, NI = (£300 − £242) × 8% = ____________
3. If gross monthly pay is £1,800, Income Tax = (£1,800 − £1,047.50) × 20% = ____________ (the £1,047.50 is the monthly Personal Allowance).

---

**Reflection.**

Think about three things you've used in the past week that were paid for by taxes:

1. ____________
2. ____________
3. ____________

Now consider: if taxes were suddenly zero, how would each of those three things be funded? Who would pay, and how?

**Bonus challenge:** Ask a parent you're with to show you a recent payslip (or describe one from memory). How much was the gap between gross and net? Was that surprising?

---

### ACT 4 — QUIZ

**Q1.** Your contract says you'll earn £30,000 a year. Is this the amount that will arrive in your bank account?

- A) Yes — what the contract says is what you receive
- B) No — Income Tax and National Insurance are deducted before it reaches you
- C) Depends on the employer

*Correct: B. The contract states gross pay. Net pay is always lower once deductions are applied.*

---

**Q2.** Someone earning £15,000 pays income tax at 20% on the portion above £12,570. What is their annual Income Tax bill (approximately)?

- A) £3,000 (20% of the full £15,000)
- B) £486 (20% of £2,430 — the portion above the allowance)
- C) £0 — £15,000 is below the threshold

*Correct: B. Tax applies only to earnings above the Personal Allowance of £12,570. £15,000 − £12,570 = £2,430. 20% of that = £486.*

---

**Q3.** A progressive tax system charges higher rates as income increases. What is the reason for this design?

- A) Governments prefer high earners because they contribute more in total
- B) The system is designed so those with greater capacity to pay contribute a higher share, while protecting lower earners from unaffordable rates
- C) High earners chose to pay more voluntarily

*Correct: B. Progressive design is based on capacity: the same rate hits harder when income is lower.*

---

### CLOSING LINE

> *"The harvest is yours. Now you know what the orchard takes — and what it builds with what it takes."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M2 — Taxes & Net Pay
**TRIGGER:** `SUM(ledger.amount WHERE type = 'chore_approved') >= 20.00`
**HOOK:** *"Lifetime earnings threshold reached: £{lifetime_earnings}. Gross-to-net deduction framework now applicable. Review before first formal employment."*

---

### ACT 2 — LESSON

**Concept: Gross Pay vs. Net Pay**

```
net_pay = gross_pay − income_tax − national_insurance − other_deductions
```

**UK deduction schedule (2025/26):**

| Component | Threshold | Rate |
|---|---|---|
| Income Tax | > £12,570/yr (Personal Allowance) | 20% (basic rate) |
| Income Tax | > £50,270/yr | 40% (higher rate) |
| National Insurance | > £12,570/yr | 8% |
| NI (employer contribution) | On all employee earnings | 13.8% (not deducted from employee) |

Key: employee pays Income Tax + NI. Employer also pays NI separately — this does not reduce your take-home but affects total cost of employment.

---

**Progressive tax logic.**

Rate increases with income bracket. Each marginal pound above a threshold is taxed at the higher rate; below the threshold, lower rate applies. Result: effective tax rate (total_tax / gross_income) is always lower than the marginal rate at the top bracket.

```
effective_rate = total_tax_paid / gross_income
```

Example: £50,000 gross → effective rate ≈ 22%, not 40% (40% applies only to the slice above £50,270).

---

**Tax incidence and public goods.**

Tax revenue funds:
1. Transfer payments (social security, pensions, disability)
2. Public goods (healthcare, defence, justice)
3. Infrastructure (transport, education, emergency services)

These are consumed at zero marginal cost per individual user because costs are pre-paid via collective tax. Net value to any individual depends on usage and contribution level — but access is universal.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `gross_weekly_pay = chore_rate_median × 40`:

1. `income_tax_weekly = MAX(0, (gross_weekly_pay − 241.73) × 0.20)` = ____________
2. `ni_weekly = MAX(0, (gross_weekly_pay − 242) × 0.08)` = ____________
3. `net_weekly_pay = gross_weekly_pay − income_tax_weekly − ni_weekly` = ____________
4. Compute `effective_rate = (income_tax_weekly + ni_weekly) / gross_weekly_pay` = ____________ %

---

**Classification task.**

List three public services you have used in the past seven days. For each, identify the funding mechanism (tax-funded, fee-based, mixed) and the alternative if tax funding were removed.

---

### ACT 4 — QUIZ

**Q1.** Gross monthly pay = £2,500. Personal Allowance (monthly) = £1,047.50. Compute Income Tax due.

- [ ] £500 (20% of £2,500)
- [x] £290.50 (20% of £1,452.50 — the taxable portion above monthly allowance)

**Q2.** NI is deducted from gross pay at 8%. Does the employer's NI contribution (13.8%) also reduce employee take-home pay?

- [ ] Yes — both rates apply to net pay
- [x] No — employer NI is a separate cost paid by the employer, not deducted from the employee's gross

**Q3.** A progressive tax system means:

- [ ] All income is taxed at the highest applicable rate
- [x] Each income band is taxed at its own rate; higher rates apply only to the marginal portion above each threshold

---

### CLOSING LINE

*"Module complete. Gross-to-net framework loaded. All future earnings references should specify whether gross or net figures are being compared."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M2",
  "title": "Taxes & Net Pay",
  "pillar": 1,
  "pillar_name": "Earning & Value",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "LEDGER_WRITE",
    "condition": "SUM(ledger.amount WHERE child_id = ? AND type = 'chore_approved') >= 20.00",
    "evaluation_timing": "on_ledger_write",
    "null_safety": "SUM returns 0 if no chore records exist; condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M2', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "lifetime_earnings",
      "chore_rate_median",
      "family_region"
    ],
    "datapoints_optional": [
      "last_chore_amount",
      "distinct_chore_types"
    ],
    "fallback_behaviour": "If family_region is null, use UK framing. If chore_rate_median is null, use regional fallback rate (£5/hr UK, $6/hr US, 25 PLN/hr PL)."
  },

  "mentor_hook": {
    "locale_en_gb": "You've earned your first real harvest. But before we count the apples, let's talk about the slice the orchard infrastructure quietly takes.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The harvest is yours. Now you know what the orchard takes — and what it builds with what it takes.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — delivered at trigger point. References child's actual lifetime_earnings.",
    "act_2": "Lesson — gross-to-net explained via UK tax schedule. Progressive system logic. Public goods framing.",
    "act_3": "Lab — required numeracy using chore_rate_median as gross input. Reflection on personal public-service usage.",
    "act_4": "Quiz — 3 questions on gross/net distinction, marginal rate calculation, and progressive tax design."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M2_Q1",
        "stem": "Does the contract salary equal the bank deposit amount?",
        "correct_option": "B",
        "concept_tested": "gross_vs_net"
      },
      {
        "id": "M2_Q2",
        "stem": "Income Tax on £15,000 gross with £12,570 Personal Allowance.",
        "correct_option": "B",
        "concept_tested": "marginal_rate_calculation"
      },
      {
        "id": "M2_Q3",
        "stem": "Why does a progressive system charge higher rates at higher incomes?",
        "correct_option": "B",
        "concept_tested": "progressive_tax_rationale"
      }
    ]
  },

  "concepts_introduced": [
    "gross_pay",
    "net_pay",
    "income_tax",
    "national_insurance",
    "personal_allowance",
    "progressive_tax",
    "marginal_rate",
    "public_goods_funding"
  ],

  "prerequisites": ["M1"],

  "unlocks": ["M3", "M8"],

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

- **Moat Type: Parity + Live Data.** GoHenry and others cover "taxes exist." Morechard's advance is using the child's own `chore_rate_median` as the gross wage in the numeracy calculation, making the deduction tangible against work the child has actually done.
- **Trigger rationale:** £20 threshold ensures the child has a meaningful earnings context before the deduction concept is introduced. Firing at first chore would make the abstraction too distant from any lived experience.
- **Non-partisan framing:** The lesson explicitly names the progressive tax debate as a legitimate political one while teaching the mechanical fact. This is deliberate — the module is not making a policy argument; it's teaching a system the child will live inside.
- **Regional variants:** UK framing is the default. US variant requires FICA (Social Security 6.2%, Medicare 1.45%) and the concept of W-2 withholding. PL variant requires ZUS (Social Security) and PIT framing. All three share the same core gross-to-net formula.
- **Household neutrality:** Bonus challenge uses "a parent you're with" — handles custody arrangements without assuming which parent has employment documentation available.
