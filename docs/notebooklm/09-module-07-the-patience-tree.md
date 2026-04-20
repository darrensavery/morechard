# Module 7: The Patience Tree
**Pillar 3 · Level 1 (Sprout) · Ages 6–9 — Phase 2 (reserved)**

> **Phase 2 note:** This module is reserved for Phase 2 (Sprout tier, ages 6–9). Trigger rows are planning stubs. Do not implement trigger logic until Phase 2 ships.

> **V3 template.** This module teaches the concept of waiting to grow savings toward a future goal — a form of delayed gratification that includes an honest acknowledgement that Morechard does not pay interest. The **Sovereign Ledger Honest Framing opener** applies here because the core metaphor (planting a seed that grows) could be confused with compound interest, which Morechard does not simulate.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `goal_target_date` — primary trigger condition (target date > 14 days away)
- `goal_name` — Hook personalisation
- `goal_target_amount` — used in Lab numeracy
- `current_balance` — used in Lab
- `days_until_goal_target` — computed from `goal_target_date − CURRENT_DATE`
- `savings_streak_weeks` — used in Hook and Lab if available

**AI Mentor rendering rules:**
- Hook must name the child's goal and how many days away it is.
- Lab must use the child's actual `goal_target_amount` and `current_balance` in the savings plan calculation.
- Language must be simple and concrete — age 6–9 vocabulary throughout.
- Honest Framing opener must appear before Act 2. Wording unchanged from standard block.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal.target_date − CURRENT_DATE > 14`*

> *"You've planted a slow seed. The orchard's best fruit takes the most time. Here's why waiting makes the harvest sweeter."*

You made a goal: **{goal_name}**. And you said you want it by **{goal_target_date}** — that's **{days_until_goal_target}** days away.

That took patience just to plan. Most people grab at things the moment they want them. You've already done something different: you've decided to wait.

Waiting doesn't mean doing nothing. It means building up, slowly, until the day arrives. And something interesting happens when you wait: the thing you're waiting for feels better when it arrives than if you'd grabbed it right away.

Let's look at why that is — and how to make the waiting easier.

---

### ACT 2 — LESSON

**Why waiting is hard — and why it's worth it.**

Your brain loves right now. When you see something you want, a part of your brain sends a very loud signal: "Get it. Get it now. You'll feel better immediately." That signal is real and strong.

But there's another part of your brain — a slower, quieter part — that knows something the loud part forgets: things you earn by waiting feel more valuable than things you got immediately.

There's a famous experiment about this. Children were offered a choice: one marshmallow right now, or two marshmallows if they could wait fifteen minutes. Most grabbed the one. The children who waited got two.

That's a made-up example, but the feeling is real. The thing you saved up for — with your own effort, over your own time — will feel more yours than anything handed to you immediately. That's not a story. That's how human brains actually work.

---

**What waiting does to your savings.**

While you wait for your goal, you earn. Each chore adds to your balance. The balance grows.

In Morechard, your money doesn't grow on its own between chores. You have to earn it. But in the real world — once you're older — there are places to keep your savings that do add a little more while you wait. That's called interest, and it's something you'll learn about when you're a bit older.

For now, the powerful thing is this: every week you don't spend your savings on something else is a week your goal gets closer. Patience isn't passive. It's a skill you build.

---

**What makes waiting easier.**

Three things:

**1. A clear goal.** Saving "for something" feels vague and weak. Saving for **{goal_name}** — something specific with a real name — is different. You can picture it. That picture is what pulls you through the harder weeks.

**2. A target date.** You set one: {goal_target_date}. That date makes the finish line visible. Without a date, the goal can keep moving away from you.

**3. Small steps.** Saving a little each week feels manageable. Trying to save everything at once usually fails. Small and steady beats big and unpredictable.

---

**Waiting doesn't mean never.**

Patience isn't about never spending. You will enjoy your savings when the day arrives — that's the whole point. Patience is about not spending it now on something less important than {goal_name}.

Every time you're tempted to spend your savings on something unrelated, ask: "Is this more important than {goal_name}?" Usually the answer is no.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your goal is **{goal_name}**. It costs **£{goal_target_amount}**. You currently have **£{current_balance}**.

1. How much more do you need to save? £{goal_target_amount} − £{current_balance} = ____________
2. You have {days_until_goal_target} days until your target date. How many weeks is that? ____________ weeks
3. If you save the same amount each week, how much do you need to save per week? ____________
4. How many chores would that be each week, at your usual rate? ____________

---

**Patience plan.**

Fill in your plan:

- My goal: ____________
- What I'll save each week: ____________
- Date I'll reach my goal (from the numbers above): ____________
- One thing I might be tempted to spend my savings on instead: ____________
- How I'll remind myself why {goal_name} matters more: ____________

**Bonus challenge:** Ask a parent you're with to tell you something they saved up for when they were young. How long did it take? How did it feel when they finally got it?

---

### ACT 4 — QUIZ

**Q1.** You want a toy that costs £12. You have £3 and earn about £2 per week. How many weeks will it take to reach your goal?

- A) 3 weeks
- B) 4 weeks — you need £9 more, and earn £2 per week: 9 ÷ 2 = 4.5, round up to 5 weeks actually
- C) 5 weeks

*Correct: C. £12 − £3 = £9 needed. £9 ÷ £2/week = 4.5 weeks — round up to 5 because you can't earn half a week.*

---

**Q2.** You're saving for a goal. Your friend offers to share something similar right now for free. Should you stop saving?

- A) Yes — free is always better
- B) Not necessarily — think about whether the free thing is actually what you wanted, or if you still want to reach your own goal
- C) Always say no to free things when saving

*Correct: B. The question is whether the free offer replaces your goal or just distracts you. Think about it carefully rather than grabbing automatically.*

---

**Q3.** Which of these is the most important thing that helps you stick to a savings plan?

- A) Saving as much as possible each week, even if some weeks you can't
- B) Having a clear goal with a name, an amount, and a date
- C) Never spending on anything else while saving

*Correct: B. A named goal with a target amount and a target date gives you something concrete to hold onto. Vague saving is harder to maintain than goal-directed saving.*

---

### CLOSING LINE

> *"The slow seed is growing. Every week you wait, it gets closer to ready."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M7 — The Patience Tree
**TRIGGER:** `goal.target_date − CURRENT_DATE > 14`
**HOOK:** *"Goal `{goal_name}` has target date {days_until_goal_target} days out. Savings plan and delayed-gratification framework apply."*

---

### ACT 2 — LESSON

**Concept: Delayed Gratification and Goal-Directed Saving**

Delayed gratification = choosing a larger future reward over a smaller immediate reward.

In a savings context:
```
future_reward = goal_item (value: goal_target_amount)
immediate_reward = alternative_spend (value: variable)
decision_rule: future_reward > immediate_reward → wait
```

Research basis: longitudinal studies (Stanford Marshmallow Experiment and replications) show correlation between delay-of-gratification ability and long-term financial outcomes. The skill is learnable; it strengthens with practice.

---

**Morechard ledger note.**

Morechard does not apply interest to held balances. Your money grows only through chore earnings — not through passive accumulation. In external savings accounts, interest applies. This module teaches the patience mechanism; Module 9b (Snowball) covers compound interest.

---

**Goal-setting components.**

For a goal to support consistent saving behaviour, three components are required:

| Component | Function | Without it |
|---|---|---|
| Specific target item | Provides a concrete anchor | Saving "for something" lacks motivation |
| Target amount | Enables progress calculation | No way to measure how close you are |
| Target date | Creates urgency and planning window | Goal recedes indefinitely |

---

**Weekly savings plan formula.**

```
amount_needed = goal_target_amount − current_balance
weeks_available = days_until_goal_target / 7
weekly_savings_required = amount_needed / weeks_available
```

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `goal_target_amount = {goal_target_amount}`, `current_balance = {current_balance}`, `days_until_goal_target = {days_until_goal_target}`:

1. `amount_needed = goal_target_amount − current_balance` = ____________
2. `weeks_available = days_until_goal_target / 7` = ____________ (round up)
3. `weekly_savings_required = amount_needed / weeks_available` = ____________
4. `chores_per_week = weekly_savings_required / chore_rate_median` = ____________ (round up)

---

**Goal plan.**

```json
{
  "goal_name": "string",
  "target_amount": number,
  "current_balance": number,
  "amount_needed": number,
  "weeks_available": number,
  "weekly_savings_required": number,
  "chores_per_week": number,
  "on_track": true | false
}
```

---

### ACT 4 — QUIZ

**Q1.** Goal costs £12. Current balance £3. Weekly earnings £2. Weeks to goal:

- [ ] 3 weeks
- [ ] 4 weeks
- [x] 5 weeks — £9 ÷ £2 = 4.5, rounds up to 5

**Q2.** A free alternative to your goal item appears. Decision rule:

- [ ] Always accept — free dominates
- [x] Evaluate: does free alternative meet goal requirements? If yes, accept. If partial, decide. Avoid automatic grabbing.

**Q3.** Most effective goal structure:

- [ ] Vague goal with high motivation
- [x] Specific item + target amount + target date — all three components required for consistent saving behaviour

---

### CLOSING LINE

*"Module complete. Goal savings plan computed. Weekly_savings_required loaded. Maintain contributions to remain on track."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M7",
  "title": "The Patience Tree",
  "pillar": 3,
  "pillar_name": "Saving & Growth",
  "level": 1,
  "level_name": "Sprout",
  "age_range": "6-9",
  "launch_status": "Phase 2 — reserved",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "goal.target_date - CURRENT_DATE > 14",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If goal.target_date is null, difference is undefined; condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M7', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SPROUT'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')",
    "phase_gate": "Phase 2 — do not implement trigger at launch. Reserve level slot 1 in age_tier enum."
  },

  "live_app_integration": {
    "datapoints_required": [
      "goal_target_date",
      "goal_name",
      "goal_target_amount",
      "current_balance",
      "days_until_goal_target"
    ],
    "datapoints_optional": [
      "savings_streak_weeks",
      "chore_rate_median"
    ],
    "fallback_behaviour": "If chore_rate_median is null, Lab step 4 uses regional fallback rate. If savings_streak_weeks is null, omit streak reference from Hook."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "You've planted a slow seed. The orchard's best fruit takes the most time. Here's why waiting makes the harvest sweeter.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The slow seed is growing. Every week you wait, it gets closer to ready.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the child's goal and days until target date.",
    "act_2": "Lesson — delayed gratification explained in age-appropriate language. Goal components (name, amount, date). Honest Framing opener before lesson begins.",
    "act_3": "Lab — required numeracy computing weekly savings requirement from goal_target_amount, current_balance, and days_until_goal_target.",
    "act_4": "Quiz — 3 questions on weeks-to-goal calculation, evaluating free alternatives, and goal structure components."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M7_Q1",
        "stem": "Weeks to goal: £12 target, £3 balance, £2/week earnings.",
        "correct_option": "C",
        "concept_tested": "savings_plan_calculation"
      },
      {
        "id": "M7_Q2",
        "stem": "Free alternative to goal item appears — correct decision process.",
        "correct_option": "B",
        "concept_tested": "deliberate_vs_automatic_choice"
      },
      {
        "id": "M7_Q3",
        "stem": "Most effective goal structure for consistent saving.",
        "correct_option": "B",
        "concept_tested": "goal_setting_components"
      }
    ]
  },

  "concepts_introduced": [
    "delayed_gratification",
    "goal_directed_saving",
    "goal_components",
    "weekly_savings_plan",
    "patience_as_skill"
  ],

  "prerequisites": ["M4"],

  "unlocks": ["M9b", "M8"],

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

- **Moat Type: Parity + Live Data.** Delayed gratification is universal curriculum. Morechard's advance is using the child's actual goal name, target amount, and target date in the savings plan calculation — the numeracy exercise is personal, not hypothetical.
- **Honest Framing rationale:** The Patience Tree metaphor (seeds growing) could suggest money grows passively, which Morechard does not simulate. The Honest Framing opener makes this explicit before the lesson begins, so the child understands the orchard metaphor is illustrative, not mechanical. This prevents false expectations about interest accruing inside the app.
- **Phase 2 language constraint:** Act 2 Orchard persona must stay at age 6–9 vocabulary. No terms like "psychological correlation" or "longitudinal study." The marshmallow reference is sufficiently accessible and widely known.
- **Quiz Q1 arithmetic:** The correct answer requires rounding 4.5 weeks up to 5. This is a deliberate numeracy challenge — children must understand that you can't earn half a week of chores, so you round up to the next whole week.
- **Household neutrality:** Bonus challenge uses "a parent you're with" — handles any family structure without assuming which adult is present.
