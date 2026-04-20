# Module 16: Giving & Charity
**Pillar 6 · Level 1 (Sprout) · Ages 6–9 — Phase 2 (reserved)**

> **Phase 2 note:** This module is reserved for Phase 2 (Sprout tier, ages 6–9). Trigger rows are planning stubs. Do not implement trigger logic until Phase 2 ships.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `give_bucket_enabled` — primary trigger condition (parent activates Give/Charity bucket)
- `give_bucket_balance` — used in Hook and Lab (how much is in the giving pot)
- `child_name` — Hook personalisation
- `current_balance` — used in Lab for proportion calculation
- `recent_give_actions` — used in Hook if any giving actions already taken

**AI Mentor rendering rules:**
- Hook must reference that a give bucket has been set up — and if any giving has already happened, reference it warmly.
- Lesson language must be age-appropriate for 6–9 — simple, concrete, story-based.
- Lab numeracy must be very simple (addition, simple fractions, counting).
- Module must not impose a specific charitable cause — give examples only, let the child choose.
- Do not imply that giving is obligatory. Frame as a choice with meaning, not a rule.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `child_config.give_bucket_enabled = true`*

> *"A corner of your orchard now belongs to the forest. That's not charity — that's how forests grow strong enough to weather storms."*

Someone set up a giving pot for you. There's now a small corner of your money that's set aside — not for you, but for something bigger than you.

That might feel a bit strange. Why give away money you worked hard to earn?

Let's talk about that. Not to convince you of anything — but to explain what giving actually does, and why some people find it one of the most satisfying things they do with their money.

---

### ACT 2 — LESSON

**What giving is.**

Giving is using some of your money — or time, or things — to help someone else, without expecting anything back.

People give to:
- Charities that help animals, people in need, or the environment
- Local organisations like food banks or community gardens
- Friends or family who need support
- Causes they care about personally

There's no rule about which cause is best. It depends on what you care about.

---

**Why people give.**

You might think giving feels bad — you have less money afterwards. But something interesting happens in people's brains when they give: many people feel better, not worse. Scientists call this the "helper's high" — a real feeling of warmth and happiness that comes from doing something for someone else.

It doesn't mean you have to give. And it doesn't mean giving away everything. It just means that money you give away isn't only a loss — it often comes back as a different kind of feeling.

There's also something else: when everyone in a community helps out a little, the whole community becomes stronger. A food bank that gets small donations from lots of people can feed families who've hit hard times. A tree-planting charity that gets small amounts from many donors can plant thousands of trees.

Small amounts, many people, big result.

---

**How much to give.**

There's no right answer. Many people use the idea of a percentage — "I'll give 1% of what I earn" or "I'll give 10%." Some give more, some give less, some give nothing for a while and more later.

Your give bucket is just a starting place. It's a way of making the decision once — "I'll keep a little to the side for this" — so you don't have to decide every time.

If you don't know what cause to give to yet: that's fine. The money will wait in the pot until you find something that matters to you.

---

**What doesn't happen when you give.**

The money doesn't come back. That's the nature of a gift — it belongs to the person or cause who received it. Unlike saving (which you can spend later) or investing (which might grow), giving is one-directional.

This is worth knowing. Not to stop you giving — but so you go in with clear eyes. A gift is a gift. The return is not money. The return is the effect of what the money does.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your give bucket has **£{give_bucket_balance}** in it. Your total balance (including the give bucket) is **£{current_balance}**.

1. What percentage of your total balance is in the give bucket? £{give_bucket_balance} ÷ £{current_balance} × 100 = ____________ %
2. If you added 10p to the give bucket every time you completed a chore, and you did 5 chores this week, how much would you add this week? ____________
3. After 4 weeks of that, how much would be in the give bucket? (Current balance + 4 weeks' additions.) ____________
4. If a food bank needs £10 to provide one meal for a family, how many families could your give bucket currently feed? ____________

---

**Choose a cause.**

Look at these examples of things people give to:

- Animals in need (animal shelters, wildlife)
- People who are hungry (food banks)
- Children who don't have books (book charities)
- Trees and the environment (planting projects)
- Local community things (sports clubs, community gardens)

Is there one that catches your attention? ____________

You don't have to decide right now. But think about: what's something in the world you'd like to be slightly more of?

---

**Reflection.**

1. Has someone ever done something kind for you without expecting anything back? How did that feel?
2. If your give bucket grew to £20, what would you spend it on? (Any cause you like.)
3. Some people give time instead of money — volunteering. Can you think of one way to give time rather than money?

**Bonus challenge:** Ask a parent you're with to name one cause they give to (or have given to). Why did they choose it?

---

### ACT 4 — QUIZ

**Q1.** You give £2 to a charity. What do you get back?

- A) £2 worth of things from the charity
- B) Nothing back in money — but the charity uses it to help people or animals or the environment, and many people feel good about that
- C) Extra pocket money from your parent as a reward for giving

*Correct: B. Giving is one-directional. You receive nothing monetary in return. What you receive is the effect of the donation and — for many people — a genuine feeling of satisfaction.*

---

**Q2.** A food bank receives small donations from 500 families in a town. Each family gives £2. How much does the food bank collect?

- A) £200
- B) £500
- C) £1,000

*Correct: C. 500 × £2 = £1,000. Small amounts from many people add up to significant impact.*

---

**Q3.** You're not sure which cause to give to yet. What should you do with your give bucket?

- A) Give it all away quickly so the money doesn't sit there
- B) Let it wait until you find something that matters to you — there's no rush
- C) Move it back to your main savings since you don't have a cause

*Correct: B. The give bucket can wait. Taking time to choose a cause you genuinely care about means the giving feels more meaningful when it happens.*

---

### CLOSING LINE

> *"The corner of the orchard that belongs to the forest makes the whole forest — yours included — stronger."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M16 — Giving & Charity
**TRIGGER:** `child_config.give_bucket_enabled = true`
**HOOK:** *"Give bucket activated. Charitable allocation framework now available. Review giving mechanics before first allocation decision."*

---

### ACT 2 — LESSON

**Giving definition.**

Charitable giving = voluntary transfer of value (money, time, or goods) to a recipient with no expectation of direct financial return.

Distinguishing properties:
- Unilateral — one-directional value transfer
- Voluntary — no obligation or contract
- Non-financial return — return is social, emotional, or reputational, not monetary

---

**Why giving occurs (economic framing).**

Behavioural economics identifies several motivations for voluntary giving:

1. **Warm glow** — the positive emotional response from altruistic acts. Empirically distinct from the utility of the outcome.
2. **Social identity** — giving as signal of values or community membership.
3. **Reciprocal norms** — belief that others will give when needed creates cooperative equilibrium.
4. **Impact belief** — rational calculation that marginal donation produces sufficient expected good.

None of these motivations require self-sacrifice as a prerequisite.

---

**Collective action mathematics.**

```
total_impact = individual_contribution × number_of_contributors
```

Small-unit contributions aggregated across many donors produce large collective outcomes. This is the structural reason charitable models work despite low individual contribution amounts.

Example: £2 from 500 contributors = £1,000 available for charitable deployment.

---

**Allocation rule (optional).**

Percentage-based giving:
```
give_amount = earnings × give_rate
```

Where `give_rate` is chosen by the individual. Common conventions: 1%, 5%, 10%. No normatively correct rate — chosen based on personal values and financial capacity.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `give_bucket_balance = {give_bucket_balance}`, `current_balance = {current_balance}`:

1. `give_pct = give_bucket_balance / current_balance × 100` = ____________ %
2. `weekly_addition = 0.10 × chores_per_week_estimate`. If 5 chores/week: `0.10 × 5` = ____________
3. `give_balance_after_4wk = give_bucket_balance + (weekly_addition × 4)` = ____________
4. `families_fed = give_bucket_balance / 10` = ____________ (at £10 per meal-pack)

---

**Cause selection.**

```json
{
  "selected_cause": "string | null",
  "reason": "string | null",
  "target_donation_amount": number | null,
  "timeline": "immediate | next_month | when_bucket_reaches_X"
}
```

---

### ACT 4 — QUIZ

**Q1.** Giving £2 to charity — return received:

- [ ] £2 of goods or services
- [x] No financial return — charitable impact + potential warm-glow effect
- [ ] Reward from parent

**Q2.** 500 contributors × £2 each = total collected:

- [ ] £200
- [ ] £500
- [x] £1,000 — `500 × £2 = £1,000`

**Q3.** Give bucket with no chosen cause — correct action:

- [ ] Give immediately to any cause
- [x] Hold until a meaningful cause is identified — deliberate giving is more impactful than hasty allocation
- [ ] Return to main savings

---

### CLOSING LINE

*"Module complete. Give bucket mechanics loaded. No allocation obligation until cause is identified. Percentage-based give_rate optional framework available."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M16",
  "title": "Giving & Charity",
  "pillar": 6,
  "pillar_name": "Society & Wellbeing",
  "level": 1,
  "level_name": "Sprout",
  "age_range": "6-9",
  "launch_status": "Phase 2 — reserved",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "CONFIG_WRITE",
    "condition": "child_config.give_bucket_enabled = true",
    "evaluation_timing": "on_config_write",
    "null_safety": "If child_config.give_bucket_enabled is null or false, condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M16', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SPROUT'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')",
    "phase_gate": "Phase 2 — do not implement trigger at launch. Reserve level slot 1 in age_tier enum."
  },

  "live_app_integration": {
    "datapoints_required": [
      "give_bucket_enabled",
      "give_bucket_balance",
      "current_balance"
    ],
    "datapoints_optional": [
      "child_name",
      "recent_give_actions"
    ],
    "fallback_behaviour": "If give_bucket_balance is null (newly created, no contributions yet), Hook uses 'your give bucket has been set up' with no balance figure. Lab uses £1 as example floor for numeracy."
  },

  "mentor_hook": {
    "locale_en_gb": "A corner of your orchard now belongs to the forest. That's not charity — that's how forests grow strong enough to weather storms.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The corner of the orchard that belongs to the forest makes the whole forest — yours included — stronger.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — acknowledges give bucket activation. Warm framing, not obligatory.",
    "act_2": "Lesson — giving defined simply, why people give (helper's high, collective impact), how much is a personal choice, honest about one-directionality.",
    "act_3": "Lab — required numeracy: percentage of balance in give bucket, weekly addition calculation, families-fed example. Cause selection exercise.",
    "act_4": "Quiz — 3 questions on giving return, collective mathematics, and correct action when no cause is identified."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M16_Q1",
        "stem": "Financial return from charitable giving.",
        "correct_option": "B",
        "concept_tested": "giving_is_unilateral"
      },
      {
        "id": "M16_Q2",
        "stem": "500 × £2 collective contribution total.",
        "correct_option": "C",
        "concept_tested": "collective_impact_maths"
      },
      {
        "id": "M16_Q3",
        "stem": "Give bucket with no identified cause — correct action.",
        "correct_option": "B",
        "concept_tested": "deliberate_vs_hasty_giving"
      }
    ]
  },

  "concepts_introduced": [
    "charitable_giving",
    "warm_glow",
    "collective_action",
    "percentage_giving",
    "give_bucket",
    "cause_selection",
    "voluntary_vs_obligatory"
  ],

  "prerequisites": ["M4"],

  "unlocks": ["M18"],

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

- **Moat Type: Parity + Live Data.** Charitable giving is covered in some curricula (Jump$tart includes it). Morechard's advance: the module fires when a parent has actively enabled the give bucket, meaning the lesson is grounded in a real feature the child can see in their dashboard — not an abstract concept.
- **Phase 2 language constraint:** Act 2 must stay at age 6–9 vocabulary. "Helper's high" is acceptable — it's concrete and memorable. "Behavioural economics" is not appropriate in the Orchard persona at this level.
- **Non-obligatory framing:** The lesson must not say "you should give" or imply giving is a moral requirement. It explains what giving is, why people do it, and leaves the choice entirely to the child. Moralising at this age creates resistance; curiosity creates engagement.
- **Helper's high:** The neuroscience of prosocial behaviour (activation of reward pathways during altruistic acts) is real and documented. "Warm glow" is the behavioural economics term; "helper's high" is the colloquial version appropriate for this age tier.
- **Collective action maths:** The 500 × £2 = £1,000 calculation is deliberately included at a level manageable for 6–9 year olds (simple multiplication). The point: small contributions aggregate into meaningful impact. This is the lesson that combats "my donation is too small to matter."
- **Household neutrality:** Bonus challenge uses "a parent you're with." Give bucket may have been activated by either parent in co-parenting arrangements — no assumption about which parent or why.
