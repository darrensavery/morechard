# Module 12: Good vs. Bad Debt
**Pillar 4 · Level 3 (Oak) · Ages 13–15**

> **V3 template.** This module teaches debt classification — a framework that extends beyond what Morechard models directly. The **Sovereign Ledger Honest Framing opener** applies because the Lesson covers mortgage and investment debt, which Morechard does not simulate.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `m10_unlocked` — prerequisite gate (M10 must be completed first)
- `asset_goal_name` — Hook personalisation (the goal categorised as 'asset')
- `asset_goal_category` — trigger condition
- `asset_goal_target_amount` — used in Lab debt-decision calculation
- `chore_rate_median` — used in Lab labor equivalent
- `current_balance` — used in Lab for coverage comparison

**AI Mentor rendering rules:**
- Hook must name the specific asset goal that triggered the module.
- Lab must use the child's `asset_goal_target_amount` in the debt-decision calculation.
- Lesson must be honest that the good/bad debt distinction is contested — some economists dispute it. Present the framework as useful, not as settled fact.
- Module must not glamourise debt. The point is classification, not encouragement.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `module_unlocked('M10') = true AND goal.category = 'asset'`*

> *"Not all debt is a vine strangling your tree. Some debt is a trellis. Here's the test every serious grower uses to tell the difference."*

You've set a goal for something in the **{asset_goal_category}** category — **{asset_goal_name}**. And you've already learned in M10 that borrowing has a cost.

But here's something that complicates the picture: not all borrowing is the same. Some debt makes people poorer. Some debt — used carefully — makes people wealthier. The difference comes down to what the borrowed money is used for, and whether what it buys grows in value or shrinks.

That distinction has a name, and it's worth understanding before you borrow anything significant.

---

### ACT 2 — LESSON

**The basic distinction.**

The terms "good debt" and "bad debt" are a simplification — economists argue about whether any debt is truly "good" — but the underlying concept is real and useful.

**Bad debt** is borrowing to buy something that loses value immediately or over time, and produces no ongoing return.

Examples:
- A credit card balance for a restaurant meal — consumed, gone, still being paid for months later
- A payday loan for clothing — worn, possibly faded, still generating interest
- BNPL for a phone upgrade you didn't strictly need — outdated in two years, debt potentially lasting as long

**Good debt** (provisionally) is borrowing to acquire something that either grows in value, produces income, or enables future earnings greater than the cost of the debt.

Examples:
- A student loan for a degree that increases lifetime earnings — if the return on the degree exceeds the debt cost
- A mortgage for a property — the property may appreciate; the alternative (renting forever) may cost more
- A business loan to buy equipment — if the equipment generates revenue exceeding the repayment cost

---

**The trellis test.**

Before classifying a debt, ask three questions:

1. **Does what I'm buying with this debt retain or grow in value?**
   - A pizza: no. A certificate course: possibly. A house: likely over long timeframes (though not guaranteed).

2. **Does what I'm buying produce ongoing return — income, earnings capacity, or saving of future costs?**
   - A gaming console: no ongoing economic return. A professional tool: potentially yes, if it enables paid work.

3. **Is the total cost of the debt (principal + interest) less than the value I'll receive?**
   - This is the hardest calculation, because it requires predicting future value. But it's the right question.

If the answer to all three is yes: the debt may be justified. If any answer is no: be very cautious.

---

**The honest caveats.**

The good/bad debt framework has real limitations:

- **Student debt is contested.** Many degrees do increase lifetime earnings. Many do not — or not by enough to justify the debt cost. The analysis requires looking at specific field, institution, and career prospects. "Education is always good debt" is too simple.

- **Mortgages are not guaranteed.** Property values fall as well as rise. In the UK housing crash of 1989–1995, many homeowners ended up with properties worth less than their mortgage. A mortgage is a leveraged bet on property values — usually a reasonable bet, but not risk-free.

- **All debt carries interest.** Even "good" debt costs more than the sticker price of the asset. The question is whether the asset's return exceeds the interest cost. This requires honest arithmetic, not optimistic assumptions.

---

**The asset-goal connection.**

Your goal, **{asset_goal_name}**, is categorised as an asset. That means it's something designed to last, to be used repeatedly, or to enable something — not just to be consumed.

That's a different relationship to money than buying something that gets spent immediately. Assets hold value. Bad debt funds consumption. Good debt — tentatively, carefully — funds assets.

The decision of whether to borrow for this asset, rather than save, comes down to the trellis test: does the asset's value or utility outweigh the total cost of the debt?

---

### ACT 3 — LAB

**Numeracy check (required).**

Your asset goal: **{asset_goal_name}**, target amount: **£{asset_goal_target_amount}**.

1. If you borrowed the full **£{asset_goal_target_amount}** at 20% interest over one year, total repayment = ____________
2. Interest cost = ____________
3. In chores at **£{chore_rate_median}**: the interest alone = ____________ chores
4. Your current balance is **£{current_balance}**. If you saved up instead of borrowing, how much more do you need? ____________
5. At your current earnings pace, roughly how many weeks would it take to save the gap? ____________ (Use your typical weekly earnings rate.)
6. Save vs. borrow: which approach costs less in total? ____________

---

**Debt classification exercise.**

Classify each of the following using the trellis test (Good / Bad / Contested):

| Item bought on credit | Retains value? | Produces return? | Total value > total cost? | Classification |
|---|---|---|---|---|
| Concert tickets | No | No | No | ____________ |
| University degree | Sometimes | Often | Depends | ____________ |
| Mortgage on a home | Usually | Saves rent cost | Usually | ____________ |
| Designer trainers on BNPL | No | No | No | ____________ |
| Professional camera for freelance photography | Yes (slow depreciation) | Yes (income) | Depends on usage | ____________ |
| Payday loan for groceries | N/A (consumed) | No | No | ____________ |

---

**Your asset goal — borrow or save?**

Apply the trellis test to **{asset_goal_name}**:

1. Does it retain or grow in value? ____________
2. Does it produce ongoing return or enable future earnings? ____________
3. Would you recommend borrowing for it, or saving? Give your reasoning. ____________
4. If a parent or carer offered to lend you the full amount at zero interest, would you take it? Why or why not? ____________

---

**Reflection.**

1. The "good debt" label is debated among economists. Why might describing any debt as "good" be misleading?
2. Can you think of a real example where borrowing for an "asset" turned out to be a mistake?
3. What's the most important question to ask before any borrowing decision?

---

### ACT 4 — QUIZ

**Q1.** You borrow £500 to buy a professional camera. You use it to earn £1,200 in freelance photography in the next year. Interest on the loan costs £80. Is this good or bad debt?

- A) Bad debt — borrowing is always risky
- B) Good debt — the return (£1,200) significantly exceeds the total cost (£500 + £80 = £580)
- C) Neither — the camera will depreciate, so it cannot be good debt

*Correct: B. The debt funded an asset that produced income exceeding the total repayment cost. The trellis test passes on all three questions.*

---

**Q2.** You take out a student loan for a degree. The degree is in a field where graduates typically earn an additional £8,000/year vs. non-graduates. The loan costs £40,000 total with interest. Over a career, is this good debt?

- A) Yes — all education is good debt, automatically
- B) Depends — £8,000/year extra × 40 working years = £320,000 additional earnings, which exceeds the £40,000 cost. But this requires staying in that field, the earnings gap holding, and the degree actually being required for those roles.
- C) No — student debt is always bad debt

*Correct: B. The analysis is correct in principle, but the specific numbers must be checked. "Education is always good debt" is a dangerous oversimplification. The trellis test requires actual numbers, not assumptions.*

---

**Q3.** Which of these best describes the trellis test?

- A) Only borrow for things that are physically durable
- B) Before borrowing, ask whether what you're buying retains value, produces return, and whether total value exceeds total debt cost
- C) Borrow freely for assets; never borrow for anything else

*Correct: B. The trellis test has three components: value retention, ongoing return, and net value vs. total cost. Physical durability alone is insufficient.*

---

### CLOSING LINE

> *"Some debt builds the tree. Some debt takes it. Now you have the test to tell which is which — before you sign."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M12 — Good vs. Bad Debt
**TRIGGER:** `module_unlocked('M10') = true AND goal.category = 'asset'`
**HOOK:** *"M10 prerequisite met. Asset-category goal detected: `{asset_goal_name}`. Debt classification framework applies."*

---

### ACT 2 — LESSON

**Debt classification framework.**

```
bad_debt = borrow_to_fund(depreciating_asset OR consumption)
           where: asset_value_at_debt_clearance < total_repayment_cost

good_debt = borrow_to_fund(appreciating_asset OR income_generating_asset)
            where: asset_return_over_period > total_repayment_cost
```

Note: "good debt" is a heuristic, not an economic category. The classification depends on realised returns, which are uncertain at decision time.

---

**Trellis test (formal decision function).**

```python
def trellis_test(asset):
    q1 = asset.value_at_debt_clearance > 0  # retains value
    q2 = asset.ongoing_return > 0            # produces return
    q3 = asset.total_return > total_repayment_cost  # net positive
    
    if q1 and q2 and q3:
        return "potentially_justified"
    elif not q1 and not q2:
        return "bad_debt"
    else:
        return "contested — analyse further"
```

---

**Contested cases.**

| Debt type | Q1 | Q2 | Q3 | Classification |
|---|---|---|---|---|
| Consumer credit (clothing, food) | No | No | No | Bad debt |
| Student loan | Sometimes | Often | Depends on field/institution | Contested |
| Mortgage | Usually | Saves rent | Usually over long horizon | Provisionally good |
| Business loan (productive asset) | Depends | Yes | Depends on ROI | Contested → good if ROI > cost |
| Payday loan (emergency) | No | No | No | Bad debt |

---

**Interest cost on provisionally good debt.**

Even justified debt has an interest cost:

```
net_return = asset_total_return − (principal + total_interest)
```

Debt is only "good" when `net_return > 0`. This requires honest projection of `asset_total_return`, which is uncertain. Conservative estimates reduce the risk of misclassification.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `asset_goal_target_amount = {asset_goal_target_amount}`, `current_balance = {current_balance}`, `chore_rate_median = {chore_rate_median}`:

1. `total_repayment_20pct_1yr = asset_goal_target_amount × 1.20` = ____________
2. `interest_cost = total_repayment_20pct_1yr − asset_goal_target_amount` = ____________
3. `chores_to_cover_interest = interest_cost / chore_rate_median` = ____________
4. `gap_if_saving = asset_goal_target_amount − current_balance` = ____________
5. `save_vs_borrow_cost_delta = interest_cost` — saving costs £0 in interest; borrowing costs ____________

---

**Trellis test matrix.**

For each item, complete the trellis test:

```json
{
  "item": "string",
  "q1_retains_value": true | false | "contested",
  "q2_produces_return": true | false | "contested",
  "q3_net_positive": true | false | "contested",
  "classification": "good | bad | contested"
}
```

Items: concert tickets; university degree; mortgage; designer trainers on BNPL; professional camera for paid work; payday loan for groceries.

---

**Asset goal analysis.**

```json
{
  "goal_name": "{asset_goal_name}",
  "target_amount": asset_goal_target_amount,
  "q1_retains_value": true | false | "contested",
  "q2_produces_return": true | false | "contested",
  "q3_projected_return": number | null,
  "total_repayment_if_borrowed": asset_goal_target_amount × 1.20,
  "verdict": "borrow_justified | save_preferred | insufficient_data"
}
```

---

### ACT 4 — QUIZ

**Q1.** Camera costs £500. Loan at 16% = £580 total. Camera earns £1,200 in year 1. Net return:

- [ ] Negative — debt is always a cost
- [x] Positive — `net_return = 1200 − 580 = £620`. Trellis test passes.

**Q2.** Student loan classification:

- [ ] Always good debt — education universally increases earnings
- [x] Contested — depends on field, institution, and realised earnings premium. Requires analysis, not assumption.
- [ ] Always bad debt

**Q3.** Trellis test definition:

- [ ] Borrow only for durable physical goods
- [x] Three-part test: value retention + ongoing return + net return > total repayment cost
- [ ] Borrow freely for assets, never for consumption

---

### CLOSING LINE

*"Module complete. Debt classification framework loaded. Apply trellis test before any borrowing decision: q1 (value retention) + q2 (ongoing return) + q3 (net return > total cost)."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M12",
  "title": "Good vs. Bad Debt",
  "pillar": 4,
  "pillar_name": "Borrowing & Debt",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "module_unlocked('M10') = true AND goal.category = 'asset'",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If goal.category is null, condition evaluates false. If M10 not unlocked, prerequisite gate blocks firing.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M12', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "m10_unlocked",
      "asset_goal_name",
      "asset_goal_target_amount",
      "chore_rate_median",
      "current_balance"
    ],
    "datapoints_optional": [
      "asset_goal_category"
    ],
    "fallback_behaviour": "If asset_goal_name is null, Hook uses 'an asset goal you created'. If asset_goal_target_amount is null, Lab uses £50 as illustrative amount. If chore_rate_median is null, use regional fallback rate."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "Not all debt is a vine strangling your tree. Some debt is a trellis. Here's the test every serious grower uses to tell the difference.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Some debt builds the tree. Some debt takes it. Now you have the test to tell which is which — before you sign.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the specific asset goal. Frames good/bad debt distinction as a test, not a rule.",
    "act_2": "Lesson — good/bad debt defined, trellis test introduced, three examples per category, honest caveats on student debt and mortgages.",
    "act_3": "Lab — required numeracy on borrow-vs-save cost differential for asset_goal. Six-item trellis test exercise. Asset goal analysis.",
    "act_4": "Quiz — 3 questions on trellis test outcome, contested student debt classification, and trellis test definition."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M12_Q1",
        "stem": "Camera loan: £580 total cost, £1,200 return. Net outcome.",
        "correct_option": "B",
        "concept_tested": "trellis_test_application"
      },
      {
        "id": "M12_Q2",
        "stem": "Student loan classification.",
        "correct_option": "B",
        "concept_tested": "contested_debt_analysis"
      },
      {
        "id": "M12_Q3",
        "stem": "Trellis test — correct definition.",
        "correct_option": "B",
        "concept_tested": "trellis_test_definition"
      }
    ]
  },

  "concepts_introduced": [
    "good_debt",
    "bad_debt",
    "trellis_test",
    "value_retention",
    "ongoing_return",
    "net_return",
    "contested_debt_cases",
    "student_debt_analysis",
    "mortgage_risk"
  ],

  "prerequisites": ["M10"],

  "unlocks": ["M15"],

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

- **Moat Type: Parity + Live Data.** Good/bad debt appears in standard curricula. Morechard's advance: the trigger fires when the child has created a real asset-category goal, so the trellis test is immediately applied to something they actually want — not a hypothetical.
- **Honest framing on the framework itself:** The Lesson explicitly acknowledges that "good debt" is a contested economic term. Teaching children that financial frameworks have limits is itself a form of financial literacy. A child who knows the trellis test but also knows it requires honest arithmetic — not optimistic assumptions — is better equipped than one taught a simple rule.
- **Student debt section:** This is the most politically sensitive part of the module. The treatment must be genuinely analytical — showing the maths without endorsing or discouraging higher education. The answer "it depends on field and institution" is correct and should be preserved in translation.
- **Mortgage coverage:** Brief but essential for completeness. The 1989–1995 UK housing crash reference is accurate and prevents the "property always goes up" misconception.
- **Honest Framing rationale:** Morechard tracks earnings; it does not model mortgages, student loans, or investment debt. The framing contextualises the lesson as forward preparation, not app functionality.
- **Household neutrality:** Lab question 4 uses "a parent or carer" for the zero-interest loan hypothetical.
