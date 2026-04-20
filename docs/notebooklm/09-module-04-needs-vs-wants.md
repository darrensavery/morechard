# Module 4: Needs vs. Wants
**Pillar 2 · Level 1 (Sprout) · Ages 6–9 — Phase 2 (reserved)**

> **Phase 2 note:** This module is reserved for Phase 2 (Sprout tier, ages 6–9). Trigger rows are planning stubs. Do not implement trigger logic until Phase 2 ships. The `child.age_level` enum must reserve slot `1` even at launch.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `goals_count` — trigger condition (first goal created)
- `purchases_count` — trigger condition (first purchase logged)
- `first_goal_name` — Hook personalisation
- `first_goal_category` — used in Lesson to classify the goal as need or want
- `current_balance` — used in Lab numeracy

**AI Mentor rendering rules:**
- Hook must reference the child's actual first goal name or first purchase description.
- Lesson examples must use the category of the child's first goal where available.
- Language must be simple and concrete — age 6–9 vocabulary throughout.
- No complex financial terminology in Orchard persona Act 2.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `COUNT(goals WHERE child_id = ?) >= 1 OR COUNT(purchases WHERE child_id = ?) >= 1`*

> *"Something caught your eye. Before we water this idea, let's work out whether it's a root — or just a pretty weed."*

You want something. **{first_goal_name}** — that's what you wrote down. Good.

Wanting things is how we decide what matters. But there's a question worth asking before we start saving up: do you *need* it, or do you *want* it?

Those two words sound similar. They mean very different things. Let's look at the difference.

---

### ACT 2 — LESSON

**What a need is.**

A need is something you must have to stay safe, healthy, and able to do everyday things. Without it, something important stops working.

- Food — you need it to grow and have energy.
- Clothes — you need them to stay warm and go to school.
- A place to sleep — you need shelter.
- Medicine when you're sick — you need it to get better.

These are needs. They can't wait. If they're missing, life gets hard quickly.

---

**What a want is.**

A want is something you'd like to have — but you could still be okay without it. Life would be less fun, maybe less comfortable, but you'd be fine.

- A new game
- A favourite snack that's not for dinner
- A toy you saw advertised
- New trainers when your old ones still fit

Wants aren't bad. Wanting things is completely normal, and saving up for a want is a great idea. The difference is: if a want has to wait a bit, you'll survive.

---

**The tricky middle.**

Some things feel like needs but are actually wants.

- "I *need* that game, everyone has it." — This is a want. It feels urgent, but you won't be harmed if you don't get it today.
- "I *need* a new phone." — Maybe. If your current one works, it's probably a want.

And some things start as wants and become needs:

- "I want to get to school on time." → transport becomes a need when you live far away.

The difference isn't the thing itself — it's whether something stops working if you don't have it.

---

**Why it matters.**

When you have money to spend, you always have to choose: this thing or that thing. Needs go first. Always. Once needs are covered, wants are fair game.

If you spend want money on something and then discover a need you forgot about — that's when money trouble starts. Not because you did something wrong, but because you spent in the wrong order.

Needs first. Wants second. That's the rule.

---

### ACT 3 — LAB

**Numeracy check (required).**

You have **£{current_balance}** in your account.

Imagine this week you need:
- A new pencil case for school: £3.50 (need)
- A sticker set you like: £2.00 (want)

1. Can you afford both? ____________ (Yes / No)
2. If you could only buy one, which should you buy first? ____________
3. After buying the need, how much do you have left? ____________
4. Is that enough for the want? ____________

---

**Sort it out.**

Look at this list. Write N (need) or W (want) next to each one:

1. School shoes when yours have a hole in them: ____
2. A new video game: ____
3. Lunch: ____
4. A second lunch because the first one was good: ____
5. A coat in winter: ____
6. A matching hat to go with the coat: ____

---

**Reflection.**

Look at the goal you made: **{first_goal_name}**.

1. Is it a need or a want?
2. If it's a want — that's completely fine. How many weeks of saving would it take? ____________
3. Is there anything you *need* that should be covered first?

**Bonus challenge:** Ask a parent you're with to name one thing they buy that's a need, and one thing they buy that's a want. Are they the same as what you expected?

---

### ACT 4 — QUIZ

**Q1.** Your coat has a rip in it and it's getting cold outside. Is a new coat a need or a want?

- A) Want — you have a coat, even if it's broken
- B) Need — you need protection from the cold to stay healthy and get to school
- C) It depends on how cold it is

*Correct: B. A damaged coat in cold weather is a safety and health issue — it qualifies as a need.*

---

**Q2.** You have £5. A school book you need costs £4. A chocolate bar costs £1.50. In what order should you spend?

- A) Chocolate bar first — it's smaller and easier to buy
- B) School book first — it's a need; the chocolate bar is a want
- C) Both together — £5 covers both

*Correct: B. Even though technically £5 covers both, the correct habit is needs first. If money were tighter, the book is the non-negotiable.*

---

**Q3.** "I need the newest phone because all my friends have it." Is this a need or a want?

- A) Need — being left out is harmful
- B) Want — social pressure feels urgent, but a phone upgrade is not required for safety or health
- C) Depends on which phone you have now

*Correct: B. Social pressure can make a want feel like a need. The test is: does life stop working without it?*

---

### CLOSING LINE

> *"Now you know which seeds are roots and which are flowers. Both matter — roots come first."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M4 — Needs vs. Wants
**TRIGGER:** `COUNT(goals WHERE child_id = ?) >= 1 OR COUNT(purchases WHERE child_id = ?) >= 1`
**HOOK:** *"First goal or purchase recorded. Classify as need or want before allocation decision."*

---

### ACT 2 — LESSON

**Classification framework.**

```
need = item whose absence causes harm to health, safety, or required function
want = item whose absence reduces comfort or enjoyment but causes no harm
```

Needs have time-urgency: deferral causes deterioration. Wants do not: deferral is inconvenient but not harmful.

---

**Spending priority rule.**

```
if needs_unmet > 0:
    allocate to needs first
else:
    allocate to wants as desired
```

Spending on wants before needs are covered creates deficit risk: a need that arises later cannot be funded from already-spent money.

---

**Edge cases.**

- Perceived need (social pressure): feels urgent; fails the harm test. Classify as want.
- Escalating want (transport): if a want enables a need (getting to school), the want acquires need status. Reclassify.
- Dual-function items: a coat that is both warm (need) and a preferred colour (want). The baseline function = need. The preference upgrade = want.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `current_balance = {current_balance}`:

1. `need_cost = £3.50`. `want_cost = £2.00`. `total = need_cost + want_cost` = ____________
2. `affordable = current_balance >= total`. Answer: ____________
3. `balance_after_need = current_balance − need_cost` = ____________
4. `can_afford_want = balance_after_need >= want_cost`. Answer: ____________

---

**Classification task.**

Classify each item using the schema:

```json
{
  "item": "string",
  "classification": "need | want | edge_case",
  "harm_if_absent": true | false,
  "time_urgency": "immediate | deferrable"
}
```

Items to classify: school shoes with a hole; a video game; lunch; a second lunch; a winter coat; a hat to match the coat.

---

### ACT 4 — QUIZ

**Q1.** Classify a damaged coat in winter.

- [ ] Want
- [x] Need — absence causes harm (cold, health risk)

**Q2.** Spending order when balance covers both a need and a want:

- [ ] Want first — it's smaller
- [x] Need first — build the correct allocation habit regardless of current balance

**Q3.** "I need the newest phone because all my friends have it." Classification:

- [ ] Need — social wellbeing is important
- [x] Want — fails the harm test; social pressure does not constitute a health or safety requirement

---

### CLOSING LINE

*"Module complete. Needs-first allocation rule loaded. Future spending decisions should apply the classification framework before committing funds."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M4",
  "title": "Needs vs. Wants",
  "pillar": 2,
  "pillar_name": "Spending & Choices",
  "level": 1,
  "level_name": "Sprout",
  "age_range": "6-9",
  "launch_status": "Phase 2 — reserved",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "GOAL_WRITE_OR_PURCHASE_WRITE",
    "condition": "COUNT(goals WHERE child_id = ?) >= 1 OR COUNT(purchases WHERE child_id = ?) >= 1",
    "evaluation_timing": "on_goal_write OR on_purchase_write",
    "null_safety": "COUNT returns 0 if no records exist; condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M4', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SPROUT'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')",
    "phase_gate": "Phase 2 — do not implement trigger at launch. Reserve level slot 1 in age_tier enum."
  },

  "live_app_integration": {
    "datapoints_required": [
      "goals_count",
      "purchases_count",
      "current_balance"
    ],
    "datapoints_optional": [
      "first_goal_name",
      "first_goal_category"
    ],
    "fallback_behaviour": "If first_goal_name is null, Hook uses generic 'something you want' framing. If current_balance is null, Lab uses £10 as example floor."
  },

  "mentor_hook": {
    "locale_en_gb": "Something caught your eye. Before we water this idea, let's work out whether it's a root — or just a pretty weed.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Now you know which seeds are roots and which are flowers. Both matter — roots come first.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — delivered at first goal or purchase trigger. Names the child's actual goal.",
    "act_2": "Lesson — simple binary classification with concrete examples. Edge cases introduced without overcomplicating.",
    "act_3": "Lab — required numeracy using current_balance and simple cost comparison. Classification exercise on six sample items.",
    "act_4": "Quiz — 3 questions validating classification ability with the harm test as the decision rule."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M4_Q1",
        "stem": "Damaged coat in winter — need or want?",
        "correct_option": "B",
        "concept_tested": "need_classification_harm_test"
      },
      {
        "id": "M4_Q2",
        "stem": "Spending order when balance covers both need and want.",
        "correct_option": "B",
        "concept_tested": "needs_first_rule"
      },
      {
        "id": "M4_Q3",
        "stem": "Social pressure as perceived need — correct classification.",
        "correct_option": "B",
        "concept_tested": "social_pressure_vs_harm_test"
      }
    ]
  },

  "concepts_introduced": [
    "needs_vs_wants",
    "harm_test",
    "time_urgency",
    "needs_first_spending_rule",
    "perceived_need"
  ],

  "prerequisites": [],

  "unlocks": ["M5", "M7"],

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

- **Moat Type: Parity + Live Data.** Every children's financial literacy curriculum covers needs vs. wants. Morechard's advance is using the child's actual first goal name as the classification subject — making the abstract framework immediately personal.
- **Phase 2 reservation:** This module is planned for ages 6–9. The language level in Act 2 must remain simple. No financial jargon. No multi-step reasoning. The Orchard persona should feel like a friendly story, not a lesson.
- **Harm test as core heuristic:** The classification rule "does life stop working without it?" is a single, memorable, repeatable test. At 6–9, one rule is better than a taxonomy.
- **Social pressure edge case:** The quiz includes the "everyone has it" scenario deliberately — this is one of the most common mis-classifications children make, and naming it builds resistance.
- **Household neutrality:** Bonus challenge uses "a parent you're with" — handles all family structures without referencing relationships.
- **Clean persona note:** For ages 6–9, the Clean persona should still be simplified relative to Oak/Canopy Clean. The classification JSON schema in Act 3 is the complexity ceiling for Sprout tier.
