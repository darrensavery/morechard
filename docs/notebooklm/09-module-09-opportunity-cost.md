# Module 9: Opportunity Cost
**Pillar 3 · Level 3 (Oak) · Ages 13–15**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `cancelled_goal_name` — Hook personalisation (the goal that was abandoned)
- `cancelled_goal_category` — trigger condition and Lesson example
- `competing_purchase_category` — category of the purchase made in the same window
- `competing_purchase_amount` — used in Lab numeracy
- `days_between_purchase_and_cancellation` — used to confirm trigger window (≤ 14 days)
- `chore_rate_median` — used in Lab labor equivalent

**AI Mentor rendering rules:**
- Hook must name the specific cancelled goal and the competing purchase category.
- Lab must use the child's actual `competing_purchase_amount` and `cancelled_goal_name` in the trade-off calculation.
- Lesson must not shame the choice made — the goal is conscious future decision-making, not guilt about the past.
- If cancelled_goal_name or competing_purchase_category is null, use generic framing: "a goal" and "a purchase."

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal.status = 'cancelled' AND EXISTS (purchase WHERE child_id = ? AND category = goal.category AND created_at BETWEEN goal.created_at AND goal.cancelled_at AND DATEDIFF(day, goal.created_at, goal.cancelled_at) <= 14)`*

> *"You said yes to something — and quietly said no to something else. That trade has a name. Here's how to make it consciously next time."*

You set a goal: **{cancelled_goal_name}**. Then, within two weeks, you spent money on something in a similar category — and the goal disappeared.

That's not a problem. That's a choice. But it's worth naming the choice properly, because most people make this kind of trade hundreds of times in their life without ever realising they're making it.

Every time you say yes to one thing, you say no to whatever else that money could have done. The thing you gave up — that's the opportunity cost.

---

### ACT 2 — LESSON

**Every choice has a hidden price.**

When you buy something, you pay the sticker price. But there's another price nobody writes on the label: what you can no longer buy with that same money.

If you have £30 and you spend it on a game, the game costs £30. But it also costs you whatever else £30 could have bought — the goal you cancelled, the experience you didn't save for, the thing you'll want next month.

That hidden price is the opportunity cost.

Economists define it precisely: **opportunity cost is the value of the best alternative you gave up.**

Not every alternative — the best one. The thing you would have done if you hadn't done this.

---

**Why it matters in real decisions.**

People who don't think about opportunity cost make a specific type of mistake: they evaluate a purchase only against itself.

"Is this worth £30?" is the wrong question.

The right question is: "Is this worth more to me than the best alternative use of £30?"

The second question is harder. It requires you to know what your best alternative actually is. That means knowing your goals, your priorities, and your spending patterns. Most people don't do this deliberately — which is why advertising works so well. Advertising focuses your attention entirely on the item in front of you, removing the alternatives from view.

---

**Opportunity cost isn't just money.**

The same logic applies to time. Every hour you spend on one thing is an hour not spent on something else. Every hour of studying is an hour not gaming. Every hour gaming is an hour not exercising. The "cost" of any time use is whatever else you would have done.

This is why time management and money management share the same core principle: you can't do everything. Every yes is secretly a no.

Understanding this doesn't mean you should always choose the "productive" option — rest and play are legitimate uses of time and money. It means making the trade consciously rather than by default.

---

**Sunk costs — and why they're irrelevant.**

A related concept that trips people up: the sunk cost fallacy.

A sunk cost is money already spent that you can't get back. Example: you bought a concert ticket for £40, but on the day you feel ill. Should you go anyway?

Most people say yes — "I already paid for it." But the £40 is gone either way. The only question is: given how I feel right now, would I rather go to the concert or stay home? The past payment is irrelevant to that present decision.

The sunk cost fallacy is the mistake of letting past, unrecoverable spending influence current decisions. It makes people:
- Keep watching bad films ("I've already invested an hour")
- Stay in bad situations ("we've already spent so much time on this")
- Pour more money into failing investments ("I can't sell now, I'd lose money")

When you find yourself justifying a current choice based on past spending — stop. Ask only: given my options right now, what's the best forward decision?

---

### ACT 3 — LAB

**Numeracy check (required).**

You cancelled **{cancelled_goal_name}** and spent **£{competing_purchase_amount}** on something else within 14 days.

1. What was the opportunity cost of that purchase — specifically, what did you give up? ____________
2. If **{cancelled_goal_name}** would have cost **£{cancelled_goal_target_amount}** and your competing purchase cost **£{competing_purchase_amount}**, how much more (or less) did you spend than you would have on the goal? ____________
3. At your chore rate of **£{chore_rate_median}**, how many chores did the competing purchase represent? ____________ How many would the goal have taken? ____________

---

**Three-choice audit.**

Think of a recent purchase decision. Write down:

1. What you chose: ____________ (cost: £______)
2. Your best alternative (what you would have done with the money): ____________ (value to you: ______)
3. Your next-best alternative: ____________ (value to you: ______)

Now answer: was option 1 actually worth more to you than option 2? ____________

If yes — you made a conscious trade. If no — you experienced opportunity cost without naming it.

---

**Sunk cost check.**

Recall a situation where you continued doing something because you'd "already started" or "already paid" — even though the forward-looking decision would have been to stop.

1. What was the situation? ____________
2. What was the sunk cost? ____________
3. What was the forward-looking choice you should have made? ____________
4. Did the past spending actually change what the right answer was? ____________

---

**Reflection.**

1. Name one area of your life where opportunity cost thinking would change how you make decisions. ____________
2. Is there a goal you have right now that's at risk of being quietly cancelled by smaller, unrelated spending? ____________
3. How would you make the opportunity cost visible before the next purchase — rather than only recognising it afterwards?

---

### ACT 4 — QUIZ

**Q1.** You have £50. You spend it on trainers. What is the opportunity cost?

- A) £50 — the price of the trainers
- B) The best alternative use of that £50 you gave up
- C) The difference between the trainers' price and their resale value

*Correct: B. Opportunity cost is not the sticker price — it's the value of the next-best thing you gave up by choosing this.*

---

**Q2.** You bought a cinema ticket for £12. When the day arrives, you don't feel like going. What should you do?

- A) Go anyway — you already paid for it, so you might as well get value from it
- B) Decide based on how you feel today, not the past payment — the £12 is gone either way
- C) Sell the ticket to recoup the cost first, then decide

*Correct: B. The £12 is a sunk cost. It cannot be recovered whether you go or not. The only relevant question is: what's the best use of tonight, given where you are now?*

---

**Q3.** Opportunity cost applies to:

- A) Money only — time and effort don't work the same way
- B) Both money and time — every use of either means giving up an alternative
- C) Only large decisions like buying a house or choosing a career

*Correct: B. Opportunity cost is a universal principle of resource allocation. Any resource with alternative uses — money, time, attention — has an opportunity cost.*

---

### CLOSING LINE

> *"Every yes is a quiet no to something else. The skill is knowing what you're trading before you trade it."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M9 — Opportunity Cost
**TRIGGER:** `goal.status = 'cancelled' AND competing_purchase_exists_within_14_days = true`
**HOOK:** *"Goal `{cancelled_goal_name}` cancelled. Competing purchase detected within 14-day window. Opportunity cost framework applies."*

---

### ACT 2 — LESSON

**Formal definition.**

```
opportunity_cost = value(best_foregone_alternative)
```

Not total alternatives — the single best alternative not chosen. This is a decision-time concept: it must be evaluated before committing, not after.

---

**Decision rule correction.**

Common error:
```
if item_value > item_price:
    buy
```

Correct framework:
```
if item_value > best_alternative_value:
    buy
else:
    choose_best_alternative
```

The item is only worth buying if it outperforms the best competing use of the same resource.

---

**Sunk cost fallacy (formal).**

```
sunk_cost = past_expenditure that is unrecoverable regardless of current decision
```

Sunk costs are decision-irrelevant: they do not change the value of forward options. Including them in current decisions produces irrational outcomes.

Correct decision function:
```
decision = argmax(forward_option_values)
# Sunk costs do not appear in this function
```

Incorrect (fallacy):
```
decision = argmax(forward_option_values + sunk_cost_recovery_attempt)
# Sunk costs cannot be recovered; this term is always 0
```

---

**Time as resource.**

Opportunity cost framework applies identically to time:

```
time_opportunity_cost = value(best_foregone_alternative_time_use)
```

Any time allocation forecloses alternatives. The analysis is identical to money allocation.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `competing_purchase_amount = {competing_purchase_amount}`, `cancelled_goal_target_amount = {cancelled_goal_target_amount}`, `chore_rate_median = {chore_rate_median}`:

1. `opportunity_cost = cancelled_goal_target_amount` — this was the best foregone alternative. Amount: ____________
2. `delta = competing_purchase_amount − cancelled_goal_target_amount` = ____________ (positive = overspent vs. goal; negative = underspent)
3. `chores_for_purchase = competing_purchase_amount / chore_rate_median` = ____________
4. `chores_for_goal = cancelled_goal_target_amount / chore_rate_median` = ____________

---

**Decision matrix.**

For a current spending decision, complete:

```json
{
  "option_chosen": "string",
  "option_chosen_value": number,
  "best_alternative": "string",
  "best_alternative_value": number,
  "opportunity_cost": "best_alternative_value",
  "net_value_of_choice": "option_chosen_value − best_alternative_value",
  "verdict": "rational | irrational"
}
```

`verdict = rational` if `net_value_of_choice > 0`. Otherwise: `irrational`.

---

**Sunk cost identification.**

```json
{
  "situation": "string",
  "sunk_cost_amount": number,
  "sunk_cost_is_recoverable": false,
  "correct_forward_decision": "string",
  "did_sunk_cost_change_correct_decision": false
}
```

---

### ACT 4 — QUIZ

**Q1.** Formal definition of opportunity cost:

- [ ] The sticker price of a purchase
- [x] The value of the best foregone alternative

**Q2.** Sunk cost decision rule:

- [ ] Include sunk costs in forward decision calculations — maximise recovery
- [x] Exclude sunk costs from forward decisions — they are unrecoverable and decision-irrelevant

**Q3.** Opportunity cost applies to:

- [ ] Money only
- [x] Any scarce resource with alternative uses — money, time, attention

---

### CLOSING LINE

*"Module complete. Opportunity cost framework loaded. Future decisions should evaluate option_value vs. best_alternative_value — not option_value vs. price."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M9",
  "title": "Opportunity Cost",
  "pillar": 3,
  "pillar_name": "Saving & Growth",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "goal.status = 'cancelled' AND EXISTS (SELECT 1 FROM purchases WHERE child_id = :child_id AND category = goal.category AND created_at BETWEEN goal.created_at AND goal.cancelled_at AND DATEDIFF('day', goal.created_at, goal.cancelled_at) <= 14)",
    "evaluation_timing": "on_goal_status_update",
    "null_safety": "If goal.category or purchase.category is null, EXISTS returns false; module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M9', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "cancelled_goal_name",
      "cancelled_goal_category",
      "competing_purchase_amount",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "cancelled_goal_target_amount",
      "competing_purchase_category",
      "days_between_purchase_and_cancellation"
    ],
    "fallback_behaviour": "If cancelled_goal_name is null, Hook uses 'a goal you were working toward'. If cancelled_goal_target_amount is null, Lab step 2 is skipped."
  },

  "mentor_hook": {
    "locale_en_gb": "You said yes to something — and quietly said no to something else. That trade has a name. Here's how to make it consciously next time.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Every yes is a quiet no to something else. The skill is knowing what you're trading before you trade it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the specific cancelled goal and competing purchase. Non-shaming.",
    "act_2": "Lesson — opportunity cost defined formally, decision rule corrected, sunk cost fallacy introduced, time as resource.",
    "act_3": "Lab — required numeracy on competing purchase vs. cancelled goal using child's actual data. Decision matrix and sunk cost exercises.",
    "act_4": "Quiz — 3 questions on opportunity cost definition, sunk cost decision rule, and resource scope."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M9_Q1",
        "stem": "Opportunity cost of a purchase — correct definition.",
        "correct_option": "B",
        "concept_tested": "opportunity_cost_definition"
      },
      {
        "id": "M9_Q2",
        "stem": "Sunk cost decision rule — go to cinema or stay home.",
        "correct_option": "B",
        "concept_tested": "sunk_cost_fallacy"
      },
      {
        "id": "M9_Q3",
        "stem": "Opportunity cost applies to which resources.",
        "correct_option": "B",
        "concept_tested": "resource_scope"
      }
    ]
  },

  "concepts_introduced": [
    "opportunity_cost",
    "best_foregone_alternative",
    "decision_rule_correction",
    "sunk_cost",
    "sunk_cost_fallacy",
    "time_as_resource"
  ],

  "prerequisites": ["M6"],

  "unlocks": ["M12", "M15"],

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

- **Moat Type: Parity + Live Data.** Opportunity cost is standard economics curriculum. Morechard's advance: the module fires when the child has just experienced opportunity cost — a cancelled goal vs. a competing purchase — making the abstract concept immediately personal with real numbers from their own data.
- **Trigger rationale:** The 14-day window and category-match requirement are deliberate precision constraints. They ensure the module fires on a genuine trade-off signal, not coincidental timing. A goal cancelled six months after a purchase is not the same event.
- **Sunk cost inclusion:** Sunk cost is introduced here rather than in a separate module because it is the natural complement to opportunity cost — both are about ignoring irrelevant information in forward decisions. Together they form a complete decision-hygiene framework for 13–15 year olds.
- **Non-shaming design:** The Hook and Lesson must never imply the cancellation was a mistake. The child made a choice. The lesson is about making the next choice consciously, not regretting the last one.
- **Household neutrality:** No parent references needed — the exercises reference the child's own past behaviour.
