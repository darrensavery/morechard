# Module 11: Credit Scores & Trust
**Pillar 4 · Level 3 (Oak) · Ages 13–15**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `chore_completion_rate_8wk` — primary trigger condition (≥ 90% over rolling 8 weeks)
- `assigned_chores_8wk` — used in trigger calculation
- `approved_chores_8wk` — used in trigger calculation
- `reliability_rating` — computed as `approved/assigned`; referenced in Hook
- `savings_streak_weeks` — used in Hook as corroborating consistency signal
- `lifetime_earnings` — Hook context

**AI Mentor rendering rules:**
- Hook must reference the child's actual reliability rating percentage and the 8-week window.
- Lesson must explain credit scores accurately — not as a reward system, but as a data model.
- Module must not imply the child has a credit score (they don't, until they enter credit agreements). Frame as "this is the system you'll enter."
- Do not encourage pursuing a high credit score as an end in itself — frame as a consequence of responsible financial behaviour.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `(approved_chores / assigned_chores WHERE window = 'last_8_weeks') >= 0.90`*

> *"Your consistency has a number. In the wider world, that number opens doors — or closes them. Here's how the system actually works."*

Eight weeks. You've completed **{chore_completion_rate_8wk}%** of the chores assigned to you — nearly every one.

That consistency is something you built. And here's something useful to know: the wider financial world has built an entire system around exactly this kind of reliability signal. It's called a credit score, and it will follow you for the rest of your adult life.

Not in a threatening way. In a mechanical one. Understanding it now — before it applies to you — means you'll be ready when it does.

---

### ACT 2 — LESSON

**What a credit score is.**

A credit score is a number — typically between 0 and 999 in the UK (Experian scale) or 300 and 850 in the US (FICO scale) — that represents how reliably you're predicted to repay borrowed money.

It's calculated by credit reference agencies (in the UK: Experian, Equifax, and TransUnion) based on your credit history: every credit product you've opened, how reliably you've repaid, how much of your available credit you use, and how long you've been using credit.

The score doesn't measure your wealth. A millionaire with no credit history has a lower score than someone on modest income who has consistently repaid credit cards on time for ten years. It measures behavioural pattern, not financial size.

---

**Why it matters — the doors it opens and closes.**

Lenders use your credit score to decide:
- Whether to lend to you at all
- At what interest rate (higher risk = higher rate, meaning worse borrowers pay more to borrow)
- How much credit to extend

But it's not just lenders. Landlords check credit scores. Some employers check them (for financial roles). Utility companies may ask for a deposit if your score is low. The score has become a proxy for trustworthiness in formal financial contexts — not always fairly, but consistently.

A high score means: cheap access to credit when you need it. A low score means: expensive credit, or no credit, at the moment you need it most.

---

**What actually builds a credit score.**

Five factors determine most credit scores:

1. **Payment history (35% of FICO)** — did you pay on time? This is the dominant factor. A single missed payment can significantly reduce your score; consistent on-time payments build it slowly and reliably.

2. **Credit utilisation (30%)** — how much of your available credit are you using? High utilisation (using 80% of a credit card limit) signals financial stress. Keeping utilisation below 30% is the standard guideline.

3. **Length of credit history (15%)** — how long have you had credit? Older accounts help. This is why closing old credit cards can sometimes reduce your score.

4. **Credit mix (10%)** — variety of credit types (mortgage, credit card, personal loan). Minor factor.

5. **New credit (10%)** — applying for new credit creates a "hard enquiry" that temporarily lowers your score. Multiple applications in a short period signal desperation.

---

**What doesn't affect your score.**

Common misconceptions:
- Your income — not reported to credit agencies
- Your savings — not reported
- Your partner's or parent's score — separate credit files (but joint products do link them)
- Checking your own score — "soft enquiry"; does not reduce your score

---

**The reliability connection.**

Your chore completion rate — **{chore_completion_rate_8wk}%** — is not a credit score. Morechard is not a credit product. But the underlying variable being measured is the same: do you consistently do what you commit to doing?

Credit scores measure that same signal through financial behaviour. The habit of consistency is the same habit. You've been building it.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your 8-week chore completion rate is **{chore_completion_rate_8wk}%**, based on **{approved_chores_8wk}** approved out of **{assigned_chores_8wk}** assigned.

1. Confirm: approved ÷ assigned = ____________ % (should match the trigger rate)
2. If you had missed 2 more chores in that window, what would your completion rate be? ____________ %
3. A credit card at 20% APR is offered to someone with a score of 650 (average). The same card at 14% APR is offered to someone with a score of 800 (excellent). On a £1,000 balance over one year, how much interest does each person pay?
   - Score 650: £1,000 × 20% = ____________
   - Score 800: £1,000 × 14% = ____________
   - Difference per year: ____________
   - How many chores at **£{chore_rate_median}** is that difference worth? ____________

---

**Credit score builder plan.**

Imagine you're 18 and opening your first credit product. Answer:

1. What credit behaviour would you prioritise in your first year? (Refer to the five factors above.) ____________
2. What credit utilisation percentage should you aim to stay below? ____________
3. What is the one behaviour that has the largest single impact on credit scores? ____________
4. Name two things that do NOT affect your credit score that people commonly think do. ____________

---

**Reliability audit.**

Your consistency data:

| Week | Assigned | Approved | Completion % |
|---|---|---|---|
| 1–8 average | {assigned_chores_8wk / 8} | {approved_chores_8wk / 8} | {chore_completion_rate_8wk}% |

1. Is this above the 90% trigger threshold? ____________
2. What would need to change to drop below 80%? ____________
3. In financial terms, what would an 80% repayment rate on a credit product signal to a lender? ____________

---

**Reflection.**

1. The credit system rewards consistency over a long time period. How does this compare to how you think about short-term vs. long-term behaviour?
2. A credit score can be damaged by one bad month and takes years to rebuild. Is this fair? Why might the system be designed this way?
3. What's one financial habit you'd want to establish at 18, before your credit file starts building?

**Bonus challenge:** Ask a parent you're with what their credit score is, and whether they've ever checked it. (You can check your own UK credit score for free at Experian, Equifax, or TransUnion — no hard enquiry required.) What did they learn from checking it?

---

### ACT 4 — QUIZ

**Q1.** What is the single most important factor in a UK/US credit score?

- A) Income level — higher earners get higher scores
- B) Payment history — consistent on-time repayments have the largest weight
- C) The amount of money in savings accounts

*Correct: B. Payment history accounts for approximately 35% of a FICO score. Income and savings are not reported to credit agencies.*

---

**Q2.** You've been using 75% of your credit card limit for six months. How does this affect your credit score?

- A) Positively — you're actively using credit, which builds history
- B) Negatively — high credit utilisation signals financial stress and reduces scores
- C) No effect — utilisation is not measured

*Correct: B. Credit utilisation (the % of available credit used) is the second largest factor. High utilisation reduces scores even if all payments are on time.*

---

**Q3.** Two people have the same credit score but very different incomes. Which of the following is true?

- A) The higher earner will get a better interest rate because lenders check income separately
- B) Both will be assessed primarily on credit history, not income — the score reflects repayment behaviour, not wealth
- C) The lower earner will be declined credit regardless of score

*Correct: B. Credit scores measure behavioural reliability, not income level. Lenders may separately verify income for larger loans, but the score itself is income-neutral.*

---

### CLOSING LINE

> *"Consistency has always had a number. Now you know what that number measures — and how to make it work for you when the time comes."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M11 — Credit Scores & Trust
**TRIGGER:** `(approved_chores / assigned_chores WHERE window = 'last_8_weeks') >= 0.90`
**HOOK:** *"8-week chore completion rate: {chore_completion_rate_8wk}%. Reliability threshold met. Credit score mechanics now applicable."*

---

### ACT 2 — LESSON

**Credit score definition.**

A credit score is a numerical representation of predicted repayment reliability, computed from credit history data by credit reference agencies (UK: Experian, Equifax, TransUnion).

```
credit_score = f(payment_history, utilisation, history_length, credit_mix, new_credit)
```

Score ranges: Experian 0–999; FICO 300–850. Higher = lower predicted default probability.

---

**Factor weights (FICO model).**

| Factor | Weight | Description |
|---|---|---|
| Payment history | 35% | On-time vs. missed payments |
| Credit utilisation | 30% | outstanding_balance / credit_limit |
| History length | 15% | Age of oldest account, average age |
| Credit mix | 10% | Variety of credit types |
| New credit | 10% | Hard enquiries from applications |

**Optimisation rule:** `payment_history × 0.35 + utilisation_score × 0.30` accounts for 65% of variance. Prioritise these two.

---

**Utilisation target.**

```
utilisation_pct = outstanding_balance / total_credit_limit × 100
optimal_utilisation = < 30%
```

High utilisation is a negative signal regardless of on-time payment status.

---

**Score impact on cost of credit.**

```
interest_rate = base_rate + risk_premium(credit_score)
annual_interest_cost = loan_principal × interest_rate
```

Risk premium decreases as credit score increases. Over a lifetime of borrowing, a high score saves thousands in interest costs.

---

**What is not measured.**

Income, savings, employment status, and partner/parent scores are not included in individual credit files. Checking your own score = soft enquiry, zero score impact.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `approved_chores_8wk = {approved_chores_8wk}`, `assigned_chores_8wk = {assigned_chores_8wk}`, `chore_rate_median = {chore_rate_median}`:

1. `completion_rate = approved / assigned × 100` = ____________ %
2. `completion_rate_if_2_more_missed = (approved − 2) / assigned × 100` = ____________ %
3. `interest_score_650 = 1000 × 0.20` = ____________
4. `interest_score_800 = 1000 × 0.14` = ____________
5. `annual_saving = interest_score_650 − interest_score_800` = ____________
6. `chores_equivalent = annual_saving / chore_rate_median` = ____________

---

**Credit optimisation plan.**

```json
{
  "age_18_priority_actions": [
    "string — highest-weight factor first",
    "string",
    "string"
  ],
  "utilisation_target_pct": number,
  "most_impactful_single_behaviour": "string",
  "common_misconceptions": ["string", "string"]
}
```

---

### ACT 4 — QUIZ

**Q1.** Dominant credit score factor:

- [ ] Income level
- [x] Payment history — 35% weight; on-time repayments are the primary driver
- [ ] Savings balance

**Q2.** Credit utilisation at 75% — effect on score:

- [ ] Positive — demonstrates active use
- [x] Negative — high utilisation signals financial stress; optimal is below 30%
- [ ] No effect

**Q3.** Same credit score, different incomes — which receives better rate?

- [ ] Higher earner
- [x] Neither — score reflects repayment behaviour only; income is not in the credit file
- [ ] Lower earner is declined regardless

---

### CLOSING LINE

*"Module complete. Credit score factor model loaded. Priority actions at 18: establish payment_history first, maintain utilisation < 30%."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M11",
  "title": "Credit Scores & Trust",
  "pillar": 4,
  "pillar_name": "Borrowing & Debt",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "NIGHTLY_SWEEP",
    "condition": "(approved_chores / assigned_chores WHERE window = 'last_8_weeks') >= 0.90",
    "evaluation_timing": "nightly_cron_0200_utc",
    "null_safety": "If assigned_chores < 5 in the 8-week window, division produces unreliable result; module does not fire below 5 assigned chores minimum.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M11', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "chore_completion_rate_8wk",
      "assigned_chores_8wk",
      "approved_chores_8wk",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "reliability_rating",
      "savings_streak_weeks",
      "lifetime_earnings"
    ],
    "fallback_behaviour": "If assigned_chores_8wk < 5, module does not fire (null safety). If chore_rate_median is null, Lab interest-comparison chores-equivalent step uses regional fallback rate."
  },

  "mentor_hook": {
    "locale_en_gb": "Your consistency has a number. In the wider world, that number opens doors — or closes them. Here's how the system actually works.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Consistency has always had a number. Now you know what that number measures — and how to make it work for you when the time comes.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references the child's actual 8-week completion rate. Frames credit score as the adult world's version of the same signal.",
    "act_2": "Lesson — credit score defined, five factors explained with weights, what does/doesn't affect score, reliability connection to Morechard data.",
    "act_3": "Lab — required numeracy on completion rate, interest cost differential between scores, credit optimisation plan.",
    "act_4": "Quiz — 3 questions on dominant factor, utilisation effect, and income-neutrality of scores."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M11_Q1",
        "stem": "Single most important credit score factor.",
        "correct_option": "B",
        "concept_tested": "payment_history_dominance"
      },
      {
        "id": "M11_Q2",
        "stem": "75% utilisation — effect on credit score.",
        "correct_option": "B",
        "concept_tested": "utilisation_impact"
      },
      {
        "id": "M11_Q3",
        "stem": "Same score, different incomes — interest rate outcome.",
        "correct_option": "B",
        "concept_tested": "score_income_independence"
      }
    ]
  },

  "concepts_introduced": [
    "credit_score",
    "credit_reference_agency",
    "payment_history",
    "credit_utilisation",
    "credit_history_length",
    "hard_enquiry_vs_soft_enquiry",
    "risk_premium",
    "reliability_as_financial_signal"
  ],

  "prerequisites": ["M10"],

  "unlocks": ["M12", "M13"],

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

- **Moat Type: Parity + Live Data.** The credit score concept appears in most advanced kids' finance curricula. Morechard's advance is firing the module when the child's own Morechard reliability rating reaches 90% — connecting the abstract concept to a concrete, personal measurement they can see in their own dashboard.
- **Trigger rationale:** 90% completion rate over 8 weeks is a meaningful, sustained signal — not a one-week fluke. It's also a high bar, which means the module reaches a child who has genuinely demonstrated reliability and can receive the "your consistency translates to the real world" framing credibly.
- **No score-chasing framing:** The lesson must not say "get a high credit score." It teaches what the score measures and how it's built. A child who understands the underlying behaviour (pay on time, keep utilisation low) will develop a high score as a side effect of good practice. Gaming the score is not the goal.
- **Interest rate differential numeracy:** The Lab exercise showing the cost difference between a 650 and 800 score on a £1,000 balance — and converting it to chores — is the module's most impactful concrete element. A 13–15 year old can understand "your credit score is worth X chores per year" in a way they cannot with abstract percentages.
- **Household neutrality:** Bonus challenge uses "a parent you're with." Credit scores are personal (separate files for each person) — no co-parenting framing issues arise here.
- **Regional note:** UK uses Experian/Equifax/TransUnion with scores up to 999. US uses FICO 300–850. PL uses BIK (Biuro Informacji Kredytowej) — the mechanism is similar, the scale differs. Regional variants must use correct agency names and score ranges.
