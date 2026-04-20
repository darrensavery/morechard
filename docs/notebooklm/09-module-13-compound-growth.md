# Module 13: The Snowball — Compound Growth
**Pillar 3 · Level 3 (Sapling) · Ages 13–15**

> **V3 template.** This module teaches a financial instrument Morechard does not directly simulate (compound interest in a real savings or investment account), and therefore requires the **Sovereign Ledger Honest Framing opener** per Dev Bible §16 and Learning Lab §Truth Engine Guardrails.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `current_balance` — used in Hook and Lab as the principal for projections
- `balance_7d_delta` — recent growth signal referenced in Hook
- `balance_30d_delta` — used to calibrate projection examples
- `savings_streak_weeks` — primary trigger signal; referenced in Hook
- `planning_horizon_max_days` — used to scale projection time horizon in Lab
- `active_goals_count` — used to reference the child's saving context

**AI Mentor rendering rules:**
- Hook must reference `savings_streak_weeks` and `current_balance` in specific numeric terms.
- Lab projections must use the child's own `current_balance` as principal. If `current_balance < 10` (any currency), use `10` as the projection floor and flag the minimum explicitly.
- Lesson examples must use the child's locale currency and regional-appropriate interest rates (see `family_region` lookup).
- Honest Framing opener is mandatory before Act 2 Lesson begins.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2. Same wording across all Honest Framing modules.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `savings_streak_weeks >= 4 AND active_goals_count >= 1 AND planning_horizon_max_days > 60`*

> *"Four weeks in a row. Your snowball is rolling — and there's a secret about how it gets heavier without you pushing."*

Four weeks of positive growth. You've added to your balance every single week, and you're now holding **£{current_balance}**. You did that with your own hands.

Here's the thing nobody tells you early enough: if that money were sitting somewhere *other* than Morechard — in a real savings account, or in an investment — it would be working for you even on the weeks you didn't add to it.

Not a lot. Not fast. But constantly.

That's called compounding, and it's the most misunderstood force in money. Let's look at it properly.

---

### ACT 2 — LESSON

**The ordinary way money grows: arithmetic.**

You earn £10. You save it. You earn another £10 next week. You save it. After ten weeks, you have £100. Ten weeks of £10 each.

That's arithmetic growth. A straight line. Each week adds the same amount.

---

**The unusual way money grows: compounding.**

Now imagine that £10 was in a savings account paying 5% interest per year.

- Year 1: £10 + 5% = £10.50
- Year 2: £10.50 + 5% = £11.03
- Year 3: £11.03 + 5% = £11.58
- Year 10: £16.29
- Year 20: £26.53
- Year 40: £70.40

You didn't add a single penny. The original £10 turned into £70.40 on its own.

That's compounding. Each year's interest gets added to the principal, and the next year's interest is calculated on the *new, bigger* number. The growth accelerates.

---

**Why humans struggle with this.**

Our brains evolved to predict straight lines. If something grew by 5 yesterday, we expect it to grow by 5 tomorrow. This works for counting sheep and predicting rain.

It does not work for compounding. Compounding curves upward, and the curve gets steeper over time. The biggest gains happen in the last few years of a long stretch — not the first few.

This means:
- **Starting early is worth more than starting big.** A 15-year-old saving £10/month until 65 will often end up with more than a 35-year-old saving £50/month until 65.
- **Time is the main input, not money.** The compound formula has time as an exponent. Doubling the time doesn't double the result — it multiplies it.
- **You can't catch up by trying harder later.** The years you skip in your teens and twenties can't be bought back by saving more in your forties.

---

**The rule that actually matters.**

Economists call it the **Rule of 72**: to find out how many years it takes your money to double at a given interest rate, divide 72 by the interest rate.

- At 3% interest: 72 ÷ 3 = 24 years to double.
- At 6% interest: 72 ÷ 6 = 12 years to double.
- At 12% interest: 72 ÷ 12 = 6 years to double.

That's it. No fancy maths. That's the whole rule for predicting compound growth.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**. Let's project it forward using compounding.

1. Using the Rule of 72, how long would your £{current_balance} take to double at 4% interest per year? ____________ years.
2. How long at 8% interest per year? ____________ years.
3. If you left £{current_balance} untouched in a 5% account for 30 years, roughly how many times would it double? ____________ times. Roughly what would it be worth? ____________

---

**Projection task.**

Take the amount you're saving most months (based on `balance_30d_delta`, roughly **£{balance_30d_delta}**). Now imagine you kept that up every month until you're 30.

1. How many months is that? ____________
2. How much would you contribute in total (ignoring interest)? ____________
3. Now look up (or ask a parent you're with) what an average UK stocks-and-shares ISA has returned annually over long periods. Most estimates land around 5–7% after inflation. Using the Rule of 72, would your total double once in that timeframe? Twice? More?

This is a rough estimate, not a prediction. Real returns fluctuate and are never guaranteed. But the shape of the curve is what matters.

---

**Reflection.**

Your current `savings_streak_weeks` is **{savings_streak_weeks}** weeks. You've been saving consistently. Two questions:

1. If you stopped saving today but left your current balance alone for 20 years at 5%, it would roughly double twice (Rule of 72: 72 ÷ 5 ≈ 14 years per doubling). Roughly, what would your current balance become?
2. Which changes that number more: doubling the amount you save each month, or doubling the number of years you keep saving?

---

### ACT 4 — QUIZ

**Q1.** Two siblings both decide to save. Sibling A saves £20/month from age 15 to 25, then stops forever. Sibling B saves £20/month from age 25 to 65. Both accounts pay 6% interest per year. Who ends up with more at 65?

- A) Sibling B — they saved for four times as long
- B) Sibling A — early compounding beats late contribution
- C) They end up equal

*Correct: B. Sibling A's money had 50 years to compound; Sibling B's had only 40 years, starting from a smaller base. Starting early usually beats starting big.*

---

**Q2.** At what interest rate does the Rule of 72 predict money doubles in 9 years?

- A) 6%
- B) 8%
- C) 12%

*Correct: B. 72 ÷ 8 = 9.*

---

**Q3.** You have £100. It grows at 10% per year. After one year you have £110. After two years, do you have £120 or £121?

- A) £120 — 10% of £100 is £10, twice
- B) £121 — 10% of £110 is £11, so year 2 adds more
- C) £110 — no change in year two

*Correct: B. That extra £1 is compounding in miniature. Over decades, those extra pennies become the whole story.*

---

### CLOSING LINE

> *"The snowball is already rolling. Now you know what makes it heavier."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M13 — The Snowball: Compound Growth
**TRIGGER:** `savings_streak_weeks >= 4 AND active_goals_count >= 1 AND planning_horizon_max_days > 60`
**HOOK:** *"Positive balance delta detected for 4+ consecutive weeks. Current balance: `{current_balance}`. Compounding mechanics apply to balances held in interest-bearing instruments."*

---

### ACT 2 — LESSON

**Concept: Exponential growth via periodic reinvestment.**

Morechard's ledger records linear growth: principal increases by discrete deposits.
External instruments (savings accounts, investment accounts) apply **periodic interest**, which reinvests as additional principal:

```
final_value = principal × (1 + rate)^time
```

**Variables:**
- `principal` — starting balance.
- `rate` — periodic interest rate (expressed as decimal; 5% = 0.05).
- `time` — number of periods (typically years).

Because `time` is an exponent, growth is non-linear. Doubling `time` does not double `final_value` — it raises it to a power.

---

**Heuristic: Rule of 72.**

Approximation for doubling time:

```
years_to_double ≈ 72 / annual_rate_pct
```

| Annual Rate | Years to Double |
|------|------|
| 2% | 36 |
| 4% | 18 |
| 6% | 12 |
| 8% | 9 |
| 12% | 6 |

---

**Decision implications:**

1. `time` is the dominant input. `principal` increases scale linearly; `time` increases it exponentially.
2. Early contributions have more compounding cycles than late contributions. The sequence in which money is deposited matters more than the total amount over short horizons.
3. Consistent contributions across many periods outperform sporadic large contributions, because interest compounds on *every* intermediate balance.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `principal = {current_balance}`:

1. Compute `years_to_double` at `rate = 4%`. Answer: `____________ years`.
2. Compute `years_to_double` at `rate = 8%`. Answer: `____________ years`.
3. Compute `final_value ≈ {current_balance} × 2^n` where `n` = number of doublings in 30 years at 5%. Answer: `n = ____________`, `final_value ≈ ____________`.

---

**Projection task.**

Given `monthly_contribution = abs(balance_30d_delta)` (your recent monthly saving rate):

1. `total_months_to_age_30` = `(30 − current_age) × 12` = ____________
2. `undiscounted_total` = `monthly_contribution × total_months_to_age_30` = ____________
3. Apply Rule of 72 at `rate = 6%`: how many doublings occur over `total_months_to_age_30 ÷ 12` years?

Return rates on real instruments vary. Past performance does not guarantee future returns. Calculations above are order-of-magnitude, not predictions.

---

### ACT 4 — QUIZ

**Q1.** Two accounts both start at £100 and receive no further deposits. Account A compounds at 6% annually for 24 years. Account B compounds at 6% annually for 12 years. What is the approximate ratio of `balance_A : balance_B`?

- [ ] 2 : 1
- [x] 4 : 1 — A doubles twice (Rule of 72), B doubles once

**Q2.** `rate = 9%`. Compute `years_to_double` via Rule of 72.

- [ ] 6 years
- [x] 8 years
- [ ] 12 years

**Q3.** Increasing `principal` by 2x vs. increasing `time` by 2x (holding everything else constant). Which produces more growth over long horizons?

- [ ] `principal` × 2 — direct multiplication of result
- [x] `time` × 2 — `time` is the exponent; doubling it compounds the compounding

---

### CLOSING LINE

*"Module complete. `final_value = principal × (1 + rate)^time` loaded. Future savings decisions should weight `time` heavier than `principal`."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M13",
  "title": "The Snowball — Compound Growth",
  "pillar": 3,
  "pillar_name": "Saving & Growth",
  "level": 3,
  "level_name": "Sapling",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "NIGHTLY_SWEEP",
    "condition": "savings_streak_weeks >= 4 AND active_goals_count >= 1 AND planning_horizon_max_days > 60",
    "evaluation_timing": "nightly_cron_0200_utc",
    "null_safety": "If savings_streak_weeks is null (insufficient ledger history), module does not fire. Wait for 4+ full weeks of ledger data.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M13', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "current_balance",
      "savings_streak_weeks",
      "planning_horizon_max_days",
      "active_goals_count"
    ],
    "datapoints_optional": [
      "balance_7d_delta",
      "balance_30d_delta"
    ],
    "fallback_behaviour": "If current_balance < 10 (any currency), use 10 as projection floor and explicitly flag the minimum. If balance_30d_delta is null or negative, Projection Task omits monthly-contribution section and proceeds to Reflection only."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "Four weeks in a row. Your snowball is rolling — and there's a secret about how it gets heavier without you pushing.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The snowball is already rolling. Now you know what makes it heavier.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — delivered at trigger point. References child's savings_streak_weeks and current_balance.",
    "act_2": "Lesson — compounding explained as non-linear growth. Rule of 72 introduced as practical heuristic. Includes Honest Framing opener.",
    "act_3": "Lab — required numeracy block using Rule of 72 on child's current_balance, plus projection task using balance_30d_delta.",
    "act_4": "Quiz — 3 questions validating comprehension of time-as-exponent concept."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M13_Q1",
        "stem": "Early compounding (short duration, early start) vs. late contribution (long duration, late start). Which ends richer?",
        "correct_option": "B",
        "concept_tested": "time_dominance_in_compounding"
      },
      {
        "id": "M13_Q2",
        "stem": "Rule of 72 applied to 8% rate.",
        "correct_option": "B",
        "concept_tested": "rule_of_72_calculation"
      },
      {
        "id": "M13_Q3",
        "stem": "Year 2 growth on a compounding account: £120 (linear) or £121 (compound)?",
        "correct_option": "B",
        "concept_tested": "compounding_vs_simple_interest"
      }
    ]
  },

  "concepts_introduced": [
    "compound_interest",
    "exponential_growth",
    "rule_of_72",
    "time_as_exponent",
    "starting_early_vs_starting_big"
  ],

  "prerequisites": ["M11"],

  "unlocks": ["M14", "M18"],

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

- **Moat Type: Parity + Live Data.** Every kids' finance curriculum teaches compound interest. Morechard's advance is firing the module **after** the child has demonstrated 4+ weeks of personal saving behaviour, anchoring the abstract concept in the child's own `current_balance` as the projection principal.
- **Honest Framing rationale:** Morechard is a ledger, not a bank. Compound interest does not accrue inside Morechard. The Honest Framing opener positions the app's limitation as pedagogy — "one day you'll use these tools; here's what you'll need to know" — rather than papering over it.
- **Rule of 72 as core mechanic:** Kids can hold the Rule of 72 in their head. They cannot hold `P(1+r)^n` in their head. The heuristic is more important than the formula for 13–15-year-olds. The Clean persona includes the formula for children who want it; the Orchard persona treats the Rule of 72 as the main takeaway.
- **"Starting early beats starting big"** is the single most important sentence in the module. If the child forgets everything else, that's the sentence that changes behaviour.
- **Prerequisite link to M11 (Patience):** M13 assumes the child has already completed M11. The 4-week savings streak trigger is stronger evidence of patience than M11's trigger, so if a child hits M13's condition before M11, M11 fires retroactively in the same session.
- **Household neutrality:** Act 3 Projection Task uses "a parent you're with" for the optional stocks-and-shares ISA reference. Handles 50/50 custody without assuming one parent has the relevant financial knowledge.
- **Regional note:** UK uses 5–7% average equity return after inflation for the Projection Task benchmark. PL and US locales need their own regional anchors — flag for content localisation.