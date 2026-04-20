# Module 1: Effort vs. Reward
**Pillar 1 · Level 2 (Sprout) · Ages 10–12**

> **Template Note:** This file follows the V3 canonical template for Learning Lab modules.
> Duplicate and rename to `09-module-XX-<slug>.md`. The Four-Act Structure, Persona Switch, Live App Integration block, and JSON Export are required for every module.

> **V3 Changelog (from V2):**
> - Metadata corrected: now Level 2 (Sprout), ages 10–12. Previously miscategorised as Level 1 (Sprout, 6–9).
> - Trigger changed from first-chore to pattern-based (3+ chores AND rate variance ≥ 30%).
> - Orchard metaphor rolled back per Dev Bible §17.2 — now confined to Act 1 Hook opener and Act 4 Closing Line. Act 2 Lesson rewritten in plain English.
> - Numeracy integrated into Act 3 Lab (mandatory per V3 spec).
> - Live App Integration block added.
> - Household composition neutrality enforced (no "mum/dad," singular/plural parent references throughout).

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `chore_rate_median` — baseline for variance calculation and numeracy Lab
- `chore_rate_variance` — primary trigger condition
- `distinct_chore_types` — used in Lesson to reference the child's chore breadth
- `lifetime_earnings` — used in Act 1 Hook personalisation
- `chore_count_lifetime` — used to confirm trigger eligibility

**AI Mentor rendering rules:**
- Hook must reference the child's actual `lifetime_earnings` value and `distinct_chore_types` count.
- Lab must use the child's own `chore_rate_median` in the numeracy calculation.
- Lesson must cite a concrete example from the child's `distinct_chore_types` if available; otherwise falls back to generic examples.
- If `chore_rate_variance` returns null (fewer than 10 chores on record), module does not fire — wait for threshold.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `chore_count_lifetime >= 3 AND chore_rate_variance >= 0.30`*

> *"Three jobs in, and already the rates are telling a story. Let's read it."*

Three chores done. You've earned **£{lifetime_earnings}** so far — not one lump sum, but three separate amounts. And they weren't the same, were they?

Have you ever wondered why?

It's not random. It's not your parent or parents being inconsistent. Every amount was a specific answer to a specific question: *what is this work actually worth?*

The answer changes with every job. Let's find out why.

---

### ACT 2 — LESSON

**Three things decide what a chore is worth.**

When a chore gets a price, three inputs combine:

**Time** — how long it takes. A five-minute job and a forty-five-minute job aren't the same, even if they share a name. "Tidying" can mean pushing three things into a drawer, or it can mean an hour of sorting.

**Difficulty** — how hard it is. Hard can mean physical (carrying something heavy), unpleasant (cleaning something gross), or mental (concentrating without giving up). All three count.

**Skill** — whether you need training or practice to do it well. Anyone can put a plate in the sink. Not anyone can cook a full meal.

A chore's value is roughly: **Time × Difficulty × Skill.**

That's why the same word — "clean your room" — might be worth £1 one week and £3 the next. The word stays the same. The three inputs don't.

---

**The three levers you can actually pull.**

If you want to earn more, there are only three ways:

1. **Take on longer jobs** — raises the Time input.
2. **Take on harder jobs** — raises the Difficulty input.
3. **Get skilled at something** — raises the Skill input.

You can't raise your rate by doing the same easy chore more often. Frequency is volume, not value. Doing the bins twenty times doesn't make each bin-take worth more — it just means you earned twenty times the same amount.

The child who becomes the house's expert at one specific thing — the only one who can do it properly — has changed their Skill input from 0 to 1. That's a rate change.

---

**Why can't every chore pay the same?**

If every chore paid £5, the maths would make no sense. Nobody would choose the hard chores. Everybody would fight for the easy ones. The hard chores would stop getting done, the house would fall apart, and your parent or parents would stop paying for chores entirely.

Different prices aren't unfair. They're the system telling the truth about what different work costs.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your median chore rate is currently **£{chore_rate_median}**. That means half the chores you've done paid more, half paid less.

1. If you did ten chores at the median rate this month, you'd earn: ____________
2. If your highest-paying chore paid double the median, how much more did that chore earn than a median chore? ____________
3. To double your total monthly earnings, how many extra median-rate chores would you need to do? ____________

---

**Reflection.**

Look at the last three chores you completed. For each one, decide:

- What was the **Time** input? (Short, medium, long.)
- What was the **Difficulty** input? (Low, medium, high.)
- Did it need a **Skill** you've built — or could anyone have done it?

Now answer:

1. Which of those three chores was the hardest? What made it hard — time, difficulty, skill, or more than one?
2. Is there a job in your home that nobody wants to do? That's almost always a high-value job, because nobody is competing for it.
3. If you could only do **one** chore this week, which one would earn you the most — and why?

**Bonus challenge:** Ask a parent you're with to name one chore in the home they would pay the most for if someone did it without being asked. That's your highest-value target.

---

### ACT 4 — QUIZ

**Three questions. No wrong answers — only honest ones.**

**Q1.** You and a friend both tidy a room. You take 10 minutes. They take 45 minutes because their room had years of junk in it. Should you both earn the same?

- A) Yes — tidying is tidying
- B) No — the harder job earned more
- C) It depends on whether anyone noticed

*Correct: B. Difficulty is part of the price. The same word — "tidy" — covered two very different amounts of work.*

---

**Q2.** There are two chores left on the list: putting the bins out (5 minutes, done every week, anyone can do it) and defrosting the freezer (45 minutes, done twice a year, needs care and patience). Which one should pay more?

- A) Putting the bins out — it happens more often
- B) Defrosting the freezer — it's rarer, harder, and takes more time
- C) Same — both are household chores

*Correct: B. Frequency doesn't raise per-job value. Rarity + difficulty does.*

---

**Q3.** Someone at home does the same washing-up job as you, but they do it three times a week for six months without missing once. You do it only when asked. Who has earned the right to charge more for that chore?

- A) You — you were asked, so your effort was on purpose
- B) The other person — consistency and reliability are a form of skill
- C) Neither — it's the same job

*Correct: B. Showing up reliably is a skill. The world pays more for people it can count on.*

---

### CLOSING LINE

> *"You've read the story your rates were telling. From here on, you'll see it in every job you do."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M1 — Effort vs. Reward
**TRIGGER:** `chore_count_lifetime >= 3 AND chore_rate_variance >= 0.30`
**HOOK:** *"Three completed chores on record. Rate variance exceeds 30%. Review the inputs that produced the variance."*

---

### ACT 2 — LESSON

**Concept: Variable Compensation**

A payment is the output of an equation:

```
chore_value = f(time, difficulty, skill_required)
```

**Definitions:**

- `time` — Duration in minutes required to complete the task to accepted standard.
- `difficulty` — Effort coefficient. Physical strain, unpleasantness, or cognitive load. Scale: 1 (low) to 3 (high).
- `skill_required` — Whether the task demands a trained or practised ability. Binary: 0 or 1.

**Output rule:** A task with higher inputs on any variable produces a higher output value. Tasks with identical names but different inputs may have different values.

---

**Why variable compensation is necessary:**

Flat-rate compensation decouples effort from reward. When reward is constant regardless of input, the rational actor minimises input. Result: only low-effort tasks get completed.

Variable compensation aligns incentives. Harder tasks earn more. The actor learns to identify high-value tasks and self-select toward them.

---

**The three levers:**

| Lever | Action | Effect |
|-------|--------|--------|
| Time | Take on larger tasks | Increases `time` variable |
| Difficulty | Choose harder tasks | Increases `difficulty` variable |
| Skill | Repeat a task until proficient | Increases `skill_required` from 0 → 1 |

Only these three levers change chore value. Frequency does not increase per-unit rate. Reliability is logged separately as a `trust_score` modifier (see M16 Credit Scores & Trust).

---

### ACT 3 — LAB

**Numeracy check (required).**

Your `chore_rate_median` = `{chore_rate_median}`.

1. Compute: `chore_rate_median × 10` = ____________
2. Compute: `(chore_rate_median × 2) − chore_rate_median` = ____________
3. Compute: `chore_rate_median × X = 2 × lifetime_monthly_earnings`. Solve for X. X = ____________

---

**Classification task.**

Classify three chores from your current list using this schema:

```json
{
  "chore_name": "string",
  "time_minutes": integer,
  "difficulty": 1 | 2 | 3,
  "skill_required": 0 | 1,
  "estimated_value": "low | medium | high"
}
```

Identify the highest-value task in your household that is currently unassigned or undesired. This is a priority target: high value, low competition.

---

### ACT 4 — QUIZ

**Q1.** Two people both complete a task called "clean the kitchen." Person A wipes surfaces (8 min). Person B scrubs the oven, cleans behind the bins, and mops the floor (55 min). Should they receive the same payment?

- [ ] Yes — same task name
- [x] No — `time` and `difficulty` inputs differ

**Q2.** A chore is completed 50 times in a year. Does frequency of completion increase the per-unit rate?

- [ ] Yes
- [x] No — `time`, `difficulty`, and `skill_required` are the rate-determining inputs. Frequency is a volume metric, not a value metric.

**Q3.** A person who completes a task every single week for 6 months without missing — what have they demonstrated?

- [ ] High task value
- [ ] High frequency
- [x] High `reliability` — a separate attribute that affects `trust_score`, not per-chore rate

---

### CLOSING LINE

*"Module complete. Variable compensation framework loaded. Future chore pricing decisions should reference the three-input equation."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M1",
  "title": "Effort vs. Reward",
  "pillar": 1,
  "pillar_name": "Earning & Value",
  "level": 2,
  "level_name": "Sprout",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "LEDGER_WRITE",
    "condition": "chore_count_lifetime >= 3 AND chore_rate_variance >= 0.30",
    "evaluation_timing": "on_ledger_write",
    "null_safety": "chore_rate_variance returns null if chore_count_lifetime < 10; module does not fire on null.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M1', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SPROUT'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "chore_rate_median",
      "chore_rate_variance",
      "distinct_chore_types",
      "lifetime_earnings",
      "chore_count_lifetime"
    ],
    "datapoints_optional": [],
    "fallback_behaviour": "If distinct_chore_types < 3, Lesson reverts to generic examples. If lifetime_earnings is null, Hook omits numeric reference."
  },

  "mentor_hook": {
    "locale_en_gb": "Three jobs in, and already the rates are telling a story. Let's read it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "You've read the story your rates were telling. From here on, you'll see it in every job you do.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — delivered at trigger point. References child's actual lifetime_earnings and distinct_chore_types.",
    "act_2": "Lesson — core concept taught as plain English three-input equation (Time × Difficulty × Skill).",
    "act_3": "Lab — required numeracy block using child's chore_rate_median + reflection task on child's live chore data.",
    "act_4": "Quiz — 3 questions validating comprehension. Multiple choice. Single correct answer per question."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M1_Q1",
        "stem": "Same task name, different time and effort inputs. Should payment be equal?",
        "correct_option": "B",
        "concept_tested": "variable_compensation"
      },
      {
        "id": "M1_Q2",
        "stem": "High-rarity, high-difficulty task vs. high-frequency, low-difficulty task. Which pays more?",
        "correct_option": "B",
        "concept_tested": "difficulty_over_frequency"
      },
      {
        "id": "M1_Q3",
        "stem": "Consistent completion vs. on-demand completion. Who has earned a higher rate?",
        "correct_option": "B",
        "concept_tested": "reliability_as_skill"
      }
    ]
  },

  "concepts_introduced": [
    "variable_compensation",
    "time_as_value_input",
    "difficulty_as_value_input",
    "skill_as_value_input",
    "reliability_as_trust_score"
  ],

  "prerequisites": [],

  "unlocks": ["M5", "M2"],

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

- **Moat Type: Parity + Live Data.** GoHenry teaches "you worked, you earned." Morechard's advance is using the child's actual `chore_rate_median` and `chore_rate_variance` to make variable compensation tangible with their own numbers.
- **Trigger rationale:** Firing at 3+ chores with 30%+ variance ensures the child has actual variance to observe. Firing at first-chore (V2 logic) taught the lesson before the evidence existed.
- **Numeracy pattern:** Basic multiplication and proportional reasoning. Appropriate for lower bound of Sprout tier (age 10).
- **Concept seeding:** Introduces `trust_score`/`reliability` as a concept that resurfaces in M16 (Credit Scores & Trust) at Oak tier without requiring full comprehension now.
- **Household neutrality:** Act 3 Bonus Challenge uses "a parent you're with" — handles 50/50 custody arrangements without requiring the child to specify which parent.