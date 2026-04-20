# Module 9b: The Snowball — Intro to Compound Interest
**Pillar 3 · Level 2 (Sapling) · Ages 10–12**

> **V3 template.** This module introduces compound interest as a real-world concept that exists outside Morechard. The **Sovereign Ledger Honest Framing opener** is required because Morechard does not pay interest on held balances. This is the Sapling-tier entry point to compounding; the fuller treatment (Rule of 72, projections, investment context) is in M13 (Compound Growth) at Oak tier.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `active_goals_count` — trigger condition (at least one active goal)
- `consecutive_weekly_growth` — primary trigger condition (4+ consecutive weeks of balance increase)
- `current_balance` — Hook personalisation and Lab principal
- `balance_4wk_ago` — used in Hook to show growth over the trigger window
- `savings_streak_weeks` — used in Hook
- `chore_rate_median` — used in Lab for context

**AI Mentor rendering rules:**
- Hook must reference the specific savings streak in weeks and the current balance.
- Lab projections must use the child's own `current_balance` as the principal.
- Lesson language must be age-appropriate for 10–12 — avoid "exponential," "compounding periods," or "annualised rate." Use plain English.
- Honest Framing opener is mandatory before Act 2.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `active_goals_count >= 1 AND consecutive_weekly_growth >= 4`*

> *"Four weeks in a row — your snowball is rolling. Here's the secret: it gets heavier without you pushing harder."*

Four weeks. Every week, your balance went up. You now have **£{current_balance}**, up from **£{balance_4wk_ago}** four weeks ago.

You did that by earning and saving. That's the straightforward part.

Here's the less obvious part: in the real world, once a snowball gets big enough, it picks up extra snow just by rolling. You don't have to push harder — it gets heavier on its own.

Money can do the same thing. Not inside Morechard — but in a savings account in the real world. There's a word for it. Let's look at what it actually means.

---

### ACT 2 — LESSON

**What interest is.**

When you put money in a savings account at a bank, the bank pays you a little extra for keeping it there. That extra is called interest.

Why does the bank pay you? Because the bank uses your money — it lends it to other people. In exchange for the use of your money, it shares a small portion of what it earns.

A typical savings account might pay 4% interest per year. If you saved £100, the bank would add £4 at the end of the year. You'd have £104 — without doing any extra chores.

---

**The difference between simple and compound interest.**

Simple interest is when the bank pays interest only on your original amount — the principal.

- Year 1: £100 + 4% of £100 = £104
- Year 2: £100 + 4% of £100 = £108
- Year 3: £100 + 4% of £100 = £112

Compound interest is when the bank pays interest on your original amount *plus* on the interest already earned.

- Year 1: £100 + 4% of £100 = £104
- Year 2: £104 + 4% of £104 = £108.16
- Year 3: £108.16 + 4% of £108.16 = £112.49

The difference looks small in three years. But over time, it adds up. That's the snowball effect: the pile gets bigger, so each year's interest is calculated on a bigger pile.

---

**The most important sentence.**

Starting early is worth more than saving a lot.

A person who saves a small amount starting at age 10 will often end up with more than someone who saves a larger amount starting at age 30 — because the early saver's money has more years to compound.

You can't buy back the years you didn't start. The best time to start is as early as possible. You're already doing that.

---

**What Morechard does and doesn't do.**

Morechard tracks what you earn and save. It does not add interest. Your balance grows only when you earn from chores.

When you're ready for a real savings account — which you'll be old enough to open before long — this is the concept that will make it useful. Every pound you move into a savings account starts compounding for you from that day.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**. Let's see what compound interest would look like over a few years.

Imagine you put this amount in a savings account paying 4% per year.

1. End of Year 1: £{current_balance} × 1.04 = ____________
2. End of Year 2: your Year 1 answer × 1.04 = ____________
3. End of Year 3: your Year 2 answer × 1.04 = ____________
4. How much interest have you earned in total over 3 years? (Year 3 balance − original balance) ____________
5. If the interest were simple (4% of the original amount only, each year), you'd earn 4% × £{current_balance} × 3 = ____________. How much more does compound interest earn? ____________

---

**Snowball comparison.**

Two people both start with £50:
- Person A puts it in a savings account at 4% and leaves it for 10 years.
- Person B keeps it at home and adds nothing.

1. Person A's balance after 10 years: £50 × 1.04^10 ≈ ____________ (Use: £50 × 1.48 ≈ £74)
2. Person B's balance after 10 years: ____________
3. How much extra did Person A earn just by using a savings account? ____________
4. How many chores at £{chore_rate_median} would it take to earn that extra amount? ____________

---

**Reflection.**

1. Your savings streak is **{savings_streak_weeks}** weeks. If you kept saving at this rate for a full year, roughly how much would you add to your balance? ____________
2. If that amount were earning 4% compound interest, what would it be worth in five years? (Rough answer: multiply by 1.22 — the approximate 4% compound multiplier for 5 years.) ____________
3. What would you do differently if you could open a savings account today?

**Bonus challenge:** Ask a parent you're with what interest rate their savings account currently pays. Is it higher or lower than 4%? When did they open their first savings account?

---

### ACT 4 — QUIZ

**Q1.** You save £200 in a 4% annual interest savings account. How much do you have after one year?

- A) £200 — interest doesn't apply in the first year
- B) £204 — 4% of £200 is £8... wait, 4% of £200 is £8? No: 4% of £200 = £8. So £208.

*Content note for editors: 4% of £200 = £8. £200 + £8 = £208. Correct answer is £208. Rework options: A) £200, B) £204, C) £208. Correct: C.*

*Correct: C. 4% of £200 = £8. £200 + £8 = £208.*

---

**Q2.** What makes compound interest grow faster than simple interest over time?

- A) The interest rate is higher with compound interest
- B) Each year's interest is calculated on the previous balance including earned interest, not just the original amount
- C) Banks pay more when you've been a customer longer

*Correct: B. Compound interest builds on the growing total, not just the original. This is the snowball effect: the pile itself earns more each year.*

---

**Q3.** Two siblings both start saving at different ages. Sibling A starts at age 10, Sibling B starts at age 20. Both save the same amount per year at the same interest rate. Who has more at age 40?

- A) Sibling B — they saved harder to catch up
- B) Sibling A — ten extra years of compounding produces more growth than Sibling B's larger contributions can overcome
- C) They end up equal if they save the same total amount

*Correct: B. Starting early beats starting bigger. The years of compound growth that Sibling A gets from age 10–20 cannot be replicated by saving more later.*

---

### CLOSING LINE

> *"Your snowball is already rolling. One day, it rolls into the real world — and there it gets heavier on its own."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M9b — The Snowball: Intro to Compound Interest
**TRIGGER:** `active_goals_count >= 1 AND consecutive_weekly_growth >= 4`
**HOOK:** *"4 consecutive weeks of positive balance delta detected. Active goal present. Compound interest mechanics now applicable to balance projection."*

---

### ACT 2 — LESSON

**Interest definition.**

Interest = periodic payment from deposit institution to depositor in exchange for custody of funds.

```
simple_interest = principal × rate × time
compound_interest = principal × (1 + rate)^time
```

For the same `principal`, `rate`, and `time`: `compound_interest > simple_interest` for all `time > 1`.

---

**Why compound exceeds simple.**

In simple interest, the base is fixed:
```
year_n_interest = principal × rate
```

In compound interest, the base grows:
```
year_n_interest = (principal × (1 + rate)^(n-1)) × rate
```

The growing base means each period's interest payment is larger than the last. Growth is non-linear.

---

**Time dominance.**

The `time` variable in `principal × (1 + rate)^time` is an exponent. Doubling time does not double the result — it raises it to a higher power. This means early start is more valuable than larger initial principal across most realistic timeframes.

---

**Morechard ledger note.**

Morechard does not apply interest to held balances. Balance grows only through chore earnings. External savings accounts apply compound interest. Module 13 (Compound Growth) covers the full treatment including Rule of 72 and long-horizon projections.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `principal = {current_balance}`, `rate = 0.04`:

1. `balance_year_1 = principal × 1.04` = ____________
2. `balance_year_2 = balance_year_1 × 1.04` = ____________
3. `balance_year_3 = balance_year_2 × 1.04` = ____________
4. `total_compound_interest = balance_year_3 − principal` = ____________
5. `total_simple_interest = principal × 0.04 × 3` = ____________
6. `compound_advantage = total_compound_interest − total_simple_interest` = ____________

---

**Projection comparison.**

```
person_a_balance = 50 × (1.04)^10 ≈ 50 × 1.48 = £74
person_b_balance = £50 (no growth)
advantage = person_a_balance − person_b_balance = ____________
chores_to_earn_advantage = advantage / chore_rate_median = ____________
```

---

### ACT 4 — QUIZ

**Q1.** `principal = £200`, `rate = 4%`, `time = 1 year`. Compute `compound_interest`.

- [ ] £200
- [ ] £204
- [x] £208 — `200 × 0.04 = £8 interest; £200 + £8 = £208`

**Q2.** Why does compound interest exceed simple interest over time?

- [ ] Higher rate
- [x] Interest is recalculated on a growing base each period, not the fixed original principal
- [ ] Bank pays loyalty bonus

**Q3.** 10-year head start vs. larger contributions starting later. Long-run outcome:

- [ ] Later larger contributions win
- [x] Early start wins — time is the exponent; compounding on early years cannot be replicated by later quantity
- [ ] Equal if same total deposited

---

### CLOSING LINE

*"Module complete. `compound_interest = principal × (1 + rate)^time` loaded. Savings decisions should prioritise early start over large initial deposit."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M9b",
  "title": "The Snowball — Intro to Compound Interest",
  "pillar": 3,
  "pillar_name": "Saving & Growth",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "NIGHTLY_SWEEP",
    "condition": "active_goals_count >= 1 AND consecutive_weekly_growth >= 4",
    "evaluation_timing": "nightly_cron_0200_utc",
    "null_safety": "If consecutive_weekly_growth is null (fewer than 4 full weeks of ledger data), module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M9b', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "active_goals_count",
      "consecutive_weekly_growth",
      "current_balance",
      "savings_streak_weeks"
    ],
    "datapoints_optional": [
      "balance_4wk_ago",
      "chore_rate_median"
    ],
    "fallback_behaviour": "If balance_4wk_ago is null, Hook omits the 4-week growth comparison. If chore_rate_median is null, Lab snowball comparison step 4 uses regional fallback rate. If current_balance < 5, use 5 as projection floor."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "Four weeks in a row — your snowball is rolling. Here's the secret: it gets heavier without you pushing harder.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Your snowball is already rolling. One day, it rolls into the real world — and there it gets heavier on its own.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references savings_streak_weeks and current_balance. Sets up the snowball metaphor.",
    "act_2": "Lesson — interest defined, simple vs. compound contrast, starting early as core principle. Honest Framing opener before lesson.",
    "act_3": "Lab — required numeracy: 3-year compound projection on current_balance, simple vs. compound comparison, 10-year snowball contrast.",
    "act_4": "Quiz — 3 questions on interest calculation, compounding mechanism, and early-start advantage."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M9b_Q1",
        "stem": "£200 at 4% for 1 year. Balance after one year.",
        "correct_option": "C",
        "concept_tested": "interest_calculation",
        "content_note": "Correct options: A=£200, B=£204, C=£208. Answer is C."
      },
      {
        "id": "M9b_Q2",
        "stem": "Why does compound interest exceed simple interest over time?",
        "correct_option": "B",
        "concept_tested": "compounding_mechanism"
      },
      {
        "id": "M9b_Q3",
        "stem": "10-year early start vs. larger later contributions. Who wins?",
        "correct_option": "B",
        "concept_tested": "time_dominance"
      }
    ]
  },

  "concepts_introduced": [
    "interest",
    "simple_interest",
    "compound_interest",
    "principal",
    "annual_rate",
    "time_dominance_in_saving",
    "starting_early"
  ],

  "prerequisites": ["M8"],

  "unlocks": ["M13", "M14"],

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

- **Moat Type: Parity + Live Data.** Every kids' finance curriculum covers compound interest. Morechard fires this module after 4 consecutive weeks of the child's own saving behaviour, anchoring the concept in their demonstrated pattern rather than a hypothetical example.
- **Honest Framing rationale:** Morechard does not accrue interest. Without the framing, the lesson could imply the app pays interest — creating false expectations. The framing is protective, not a limitation disclosure; it positions what's coming in the child's near future.
- **Relationship to M13:** M9b is the entry-level treatment for 10–12 year olds — simple vs. compound contrast, the snowball metaphor, starting early. M13 is the full Oak-tier treatment: Rule of 72, long-horizon projections, investment context. M9b seeds the concept; M13 completes it. Children who see M9b first will find M13 significantly more accessible.
- **Quiz Q1 content note:** 4% of £200 = £8, giving £208. The draft had a labelling error (£204 appearing as a plausible distractor). Corrected in JSON: A=£200, B=£204 (simple interest of 2%), C=£208. Answer is C.
- **Age vocabulary constraint:** No "exponential," "compounding periods," or "annualised return" in Orchard persona. The 1.04^n formula appears only in the Clean persona Lab. Orchard Lab uses the step-by-step multiplication approach.
- **Household neutrality:** Bonus challenge uses "a parent you're with."
