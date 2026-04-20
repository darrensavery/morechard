# Module 18b: Social Comparison
**Pillar 6 · Level 3 (Oak) · Ages 13–15**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `goal_category_match_sibling` — primary trigger condition (goal in same category as a sibling/peer's recent goal, within 72 hours, if family sharing enabled)
- `goal_name` — Hook personalisation (the child's own goal)
- `sibling_goal_name` — Hook personalisation (the peer/sibling goal that preceded it)
- `goal_category` — trigger condition
- `goal_target_amount` — used in Lab
- `chore_rate_median` — used in Lab
- `current_balance` — context for Lab

**AI Mentor rendering rules:**
- Hook must reference both goals — the child's and the sibling/peer's — without implying any judgement about either.
- Lesson must not shame the child for the goal. The module is about examining the origin of the desire, not the desire itself.
- If family sharing is disabled and this module fires (e.g. via other signals), Hook uses a generic framing about social comparison without naming a specific peer.
- Module must never disclose one sibling's financial data to another.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal.category IN ('electronics','fashion') AND EXISTS (sibling_goal WHERE category = goal.category AND created_at >= NOW() - INTERVAL '72 hours')`*

> *"Someone else planted a seed and now you want the same crop. That's human — but let's make sure it's your hunger driving this, not theirs."*

You've set a goal for **{goal_name}**. And recently, someone else set a goal in the same category.

That might be pure coincidence. Or it might not be.

Social comparison — wanting what someone else has, or wanting to be seen as equivalent to someone else — is one of the oldest and most powerful drivers of spending. It's not a flaw. It's wired into us. But when it drives purchases you wouldn't have made otherwise, it's worth noticing.

This lesson is not about whether your goal is a good one. It might be exactly what you genuinely want. It's about learning to tell the difference between your hunger and someone else's — so that your spending reflects your values, not theirs.

---

### ACT 2 — LESSON

**What social comparison is.**

Social comparison theory — developed by psychologist Leon Festinger in 1954 — describes the human tendency to evaluate our own opinions, abilities, and circumstances by comparing them to others.

In financial terms: we notice what other people have and feel a pull toward having the same, or having more. This is not vanity or greed — it's a deeply embedded social instinct. Historically, keeping pace with your group signalled safety. Falling behind was a real risk.

In modern consumer culture, this instinct is systematically exploited. Advertising, social media, and peer visibility are all engineered to trigger upward social comparison — making you aware of what others have and feel the gap.

---

**The three forms social comparison takes in spending.**

**Keeping up** — buying things because people around you have them, even if you wouldn't have wanted them otherwise. The pull is not the item itself but the equivalence with your group.

**Signalling up** — buying things to signal membership in a group above your current one. The item's function matters less than its association with a higher-status group.

**Avoiding falling behind** — spending to prevent the discomfort of being visibly different. Slightly different motivation: not ambition, but anxiety. The goal is invisibility, not status.

All three patterns can drive spending that leaves you less satisfied than spending driven by genuine preference. The item was chosen for its social function, not its intrinsic value to you. When the social function fades — the group changes, the trend passes, the signal stops reading — you're left with the item and the depleted balance.

---

**Why social media amplifies this.**

Social media makes comparison continuous, quantified, and asymmetric:

- **Continuous** — unlike pre-internet social contexts (neighbourhood, school), social media comparison is available 24 hours a day.
- **Quantified** — likes, followers, and views make status numerical and visible. Your relative position is always legible.
- **Asymmetric** — you compare yourself to everyone's highlight reel. People post their best purchases, experiences, and moments. You compare your everyday reality to others' curated peaks.

The result: chronic upward comparison, which research consistently links to reduced life satisfaction and increased spending on status-signalling goods.

---

**The test: your hunger or theirs?**

Before any purchase driven by awareness of what others have:

1. **Would you have wanted this before you saw/heard that someone else had it?** If no — the desire is comparison-driven.

2. **Would you want it if nobody in your life could see you with it?** If no — the desire is about signalling, not the item.

3. **In a year, will you still use it or value it?** If no — it's serving a short-term social function that will pass.

None of these questions say "don't buy it." They say: know why you're buying it. If the answer is honest and you're comfortable with it — that's a conscious choice. If the honest answer makes you uncomfortable — that's worth pausing for.

---

**Contentment and comparison.**

The inverse of comparison-driven spending is contentment — which M18 introduced. Contentment doesn't mean not wanting things. It means the things you want emerge from your own values and goals, not from the desire to match or exceed someone else's.

This is harder than it sounds. Our sense of what we want is shaped partly by what we see around us. Complete independence from social influence isn't realistic. What is realistic: noticing when comparison is driving a desire, and deciding deliberately whether to act on it.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your goal: **{goal_name}**, target: **£{goal_target_amount}**.

1. In chores at **£{chore_rate_median}**: how many chores does this goal represent? ____________
2. As a percentage of your current balance **£{current_balance}**: ____________ %
3. If you were to apply the pre-desire test and determine this goal is comparison-driven: how many chores' worth of effort would you redirect? ____________
4. What would that redirected effort buy you in a goal of your own choosing? ____________

---

**Comparison audit.**

Think of your three most recent purchases or goals. For each, answer the three test questions:

| Purchase / Goal | Would I have wanted it without social awareness? | Would I want it if invisible to others? | Will I still value it in a year? | Origin: Genuine or Comparison? |
|---|---|---|---|---|
| 1. | Y/N | Y/N | Y/N | ____________ |
| 2. | Y/N | Y/N | Y/N | ____________ |
| 3. | Y/N | Y/N | Y/N | ____________ |

---

**Social media audit.**

Think about your last hour of social media use (or a typical hour). Answer:

1. How many posts involved someone showing something they bought or owned? ____________
2. Did any of those posts make you want something you didn't want before seeing the post? ____________
3. For any yes answers: was that desire still present 24 hours later? ____________

Pattern observed: ____________

---

**Values exercise.**

Write down three things you genuinely value that have nothing to do with what others think of you:

1. ____________
2. ____________
3. ____________

Now write down one financial goal that serves those values directly:

____________

Does your current goal list include this? If not — should it?

---

**Reflection.**

1. Which of the three comparison patterns (keeping up, signalling up, avoiding falling behind) do you recognise most in yourself?
2. Can you recall a purchase you made for social reasons that left you feeling satisfied? And one that didn't?
3. Your goal **{goal_name}** — which origin does it have? Are you comfortable with that answer?

**Bonus challenge:** For one week, notice every time you see something someone else has that makes you want it. Just notice — you don't have to do anything. Count how many times it happens. What does that tell you about the frequency of comparison-triggered desire?

---

### ACT 4 — QUIZ

**Q1.** You buy the same phone as your close friend immediately after seeing theirs. Three months later, you never use half the features and feel indifferent to it. What most likely happened?

- A) The phone was a bad product
- B) The desire was comparison-driven rather than based on genuine pre-existing need — the social function (equivalence with your friend) faded, leaving the item without intrinsic value to you
- C) You didn't research the phone thoroughly enough

*Correct: B. When social function drives a purchase, satisfaction fades when the social function fades. The item had no independent value to you — only relational value.*

---

**Q2.** Social media amplifies comparison spending primarily because:

- A) Social media shows expensive products constantly
- B) Comparison is continuous, quantified, and asymmetric — you compare your everyday reality to others' curated highlights, producing chronic upward comparison
- C) Social media advertising is more targeted than other channels

*Correct: B. The three structural properties of social media comparison (continuous, quantified, asymmetric) are what make it especially potent as a comparison trigger — more so than any specific content.*

---

**Q3.** The "would you want it if nobody could see you with it?" test is designed to detect:

- A) Genuine need — items you'd use privately
- B) Signalling-driven desire — the desire is for the social function of the item (status signal), not the item itself
- C) Poor quality — items that don't justify their price

*Correct: B. The invisibility test isolates intrinsic value from signal value. If the item only appeals when visible to others, the desire is primarily about signalling.*

---

### CLOSING LINE

> *"Your hunger is yours to decide. The skill is knowing when the appetite was planted by someone else — and choosing whether to water it."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M18b — Social Comparison
**TRIGGER:** `goal.category IN ('electronics','fashion') AND goal_category_match_sibling = true AND created_within_72hr = true`
**HOOK:** *"Electronics/fashion-category goal detected within 72 hours of matching peer goal. Social comparison mechanism likely active. Review before committing."*

---

### ACT 2 — LESSON

**Social comparison theory (Festinger, 1954).**

Humans evaluate personal status, ability, and desirability by comparing to others. In consumer contexts:

```
comparison_desire = f(awareness_of_peer_ownership, perceived_status_gap)
```

Comparison-driven desire is distinct from intrinsic desire:
- Intrinsic: `desire = f(personal_utility_of_item)`
- Comparison: `desire = f(peer_ownership, status_signal_value)`

These produce different post-purchase satisfaction trajectories: intrinsic desire → sustained satisfaction; comparison desire → satisfaction declines as social function fades.

---

**Social comparison spending patterns.**

| Pattern | Mechanism | Sustained satisfaction |
|---|---|---|
| Keeping up | Purchase to maintain parity with peer group | Low — dependent on continuous group equivalence |
| Signalling up | Purchase to signal membership in higher-status group | Low — group membership is never secured by purchase alone |
| Avoiding falling behind | Purchase to prevent visible differentiation | Variable — anxiety relief is real but temporary |

---

**Social media amplification model.**

Social media creates three structural comparison intensifiers:

1. `continuity = 24/7_access_to_peer_status_signals` (vs. limited historical social exposure)
2. `quantification = likes + followers + views` (status rendered numerical and legible)
3. `asymmetry = own_reality vs. peer_highlight_reel` (comparison is always upward in expectation)

```
comparison_intensity = f(continuity × quantification × asymmetry)
```

Research outcome: chronic upward comparison → reduced life satisfaction → increased status-signalling spend.

---

**Pre-desire test (three questions).**

```python
def pre_desire_test(item):
    q1 = would_want_without_social_awareness(item)  # → genuine vs comparison
    q2 = would_want_if_invisible_to_others(item)     # → intrinsic vs signalling
    q3 = will_value_in_12_months(item)               # → sustained vs transient
    
    if q1 and q2 and q3:
        return "likely_intrinsic"
    elif not q1 or not q2:
        return "likely_comparison_driven"
    else:
        return "transient_value — evaluate further"
```

Test does not prohibit the purchase. It classifies origin of desire, enabling deliberate decision.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `goal_target_amount = {goal_target_amount}`, `chore_rate_median = {chore_rate_median}`, `current_balance = {current_balance}`:

1. `chores_required = goal_target_amount / chore_rate_median` = ____________
2. `pct_of_balance = goal_target_amount / current_balance × 100` = ____________ %
3. `pre_desire_test_result`: apply three-question test to goal. Result: ____________
4. If comparison-driven and redirected: `alternative_goal_budget = goal_target_amount`. What intrinsic goal could this fund? ____________

---

**Purchase origin classification.**

```json
{
  "purchases": [
    {
      "name": "string",
      "q1_pre_social_awareness": true | false,
      "q2_invisible_to_others": true | false,
      "q3_value_in_12_months": true | false,
      "origin": "intrinsic | comparison | mixed"
    }
  ],
  "comparison_driven_pct": "count(comparison) / total × 100"
}
```

---

**Social media exposure audit.**

```json
{
  "posts_viewed_per_hour": number,
  "purchase_trigger_posts": number,
  "desire_persistence_24hr": number,
  "comparison_trigger_rate": "desire_persistence_24hr / purchase_trigger_posts × 100"
}
```

---

### ACT 4 — QUIZ

**Q1.** Phone purchase mirroring friend's — low satisfaction after 3 months. Primary cause:

- [ ] Product quality
- [x] Comparison-driven desire: social function (peer equivalence) faded; no intrinsic value remained
- [ ] Insufficient research

**Q2.** Social media comparison amplification — primary structural property:

- [ ] High-frequency product advertising
- [x] Continuous + quantified + asymmetric comparison structure → chronic upward comparison
- [ ] Better ad targeting

**Q3.** "Invisible to others" test — what it detects:

- [ ] Genuine need
- [x] Signalling-driven desire — desire contingent on social visibility of item
- [ ] Price-quality ratio

---

### CLOSING LINE

*"Module complete. Social comparison framework loaded. Apply pre_desire_test before electronics/fashion category purchases. Classification: intrinsic vs. comparison-driven → deliberate decision."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M18b",
  "title": "Social Comparison",
  "pillar": 6,
  "pillar_name": "Society & Wellbeing",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "goal.category IN ('electronics','fashion') AND EXISTS (SELECT 1 FROM goals g2 WHERE g2.family_id = :family_id AND g2.child_id != :child_id AND g2.category = goal.category AND g2.created_at >= NOW() - INTERVAL '72 hours')",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If family sharing is disabled or no sibling goals exist, EXISTS returns false. Module may still fire via a future alternative trigger path if warranted.",
    "privacy_guard": "Module must never expose sibling_goal financial details (amount, balance) to the triggering child. Only category match is used in Hook.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M18b', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "goal_name",
      "goal_category",
      "goal_target_amount",
      "chore_rate_median",
      "current_balance"
    ],
    "datapoints_optional": [
      "sibling_goal_name",
      "goal_category_match_sibling"
    ],
    "fallback_behaviour": "If sibling_goal_name is null or family sharing is disabled, Hook uses generic framing: 'you may have noticed someone else with something similar.' Never reference specific sibling financial data. If goal_target_amount is null, Lab uses £30 as illustrative amount."
  },

  "mentor_hook": {
    "locale_en_gb": "Someone else planted a seed and now you want the same crop. That's human — but let's make sure it's your hunger driving this, not theirs.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Your hunger is yours to decide. The skill is knowing when the appetite was planted by someone else — and choosing whether to water it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references the category match without shaming. Frames comparison as human, not a flaw.",
    "act_2": "Lesson — social comparison theory (Festinger), three spending patterns, social media amplification model, pre-desire test as the defence, connection to contentment.",
    "act_3": "Lab — required numeracy on goal cost in chores. Three-purchase comparison audit. Social media exposure audit. Values exercise.",
    "act_4": "Quiz — 3 questions on comparison-driven satisfaction decay, social media amplification structure, and invisibility test purpose."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M18b_Q1",
        "stem": "Phone mirroring friend — satisfaction fades after 3 months. Cause.",
        "correct_option": "B",
        "concept_tested": "comparison_desire_satisfaction_decay"
      },
      {
        "id": "M18b_Q2",
        "stem": "Social media comparison amplification — primary structural property.",
        "correct_option": "B",
        "concept_tested": "social_media_comparison_structure"
      },
      {
        "id": "M18b_Q3",
        "stem": "Invisibility test — what it detects.",
        "correct_option": "B",
        "concept_tested": "signalling_detection"
      }
    ]
  },

  "concepts_introduced": [
    "social_comparison_theory",
    "festinger_1954",
    "intrinsic_vs_comparison_desire",
    "keeping_up",
    "signalling_up",
    "avoiding_falling_behind",
    "social_media_amplification",
    "pre_desire_test",
    "invisibility_test",
    "satisfaction_decay"
  ],

  "prerequisites": ["M18", "M6"],

  "unlocks": ["M20"],

  "privacy_requirements": {
    "sibling_data_exposure": "NONE — only category match is disclosed to triggering child. No amounts, balances, or goal details from sibling are exposed.",
    "family_sharing_required": true,
    "fallback_if_sharing_disabled": "Generic Hook framing without peer reference"
  },

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

- **Moat Type: Pedagogical Moat.** Social comparison as a driver of spending is not addressed by any comparable kids' finance app. Morechard fires this module at the precise moment when behavioural evidence of comparison-triggered desire exists — a sibling/peer goal in the same category within 72 hours. That specificity is the moat.
- **Trigger rationale:** Electronics and fashion are the highest-comparison categories for 13–15 year olds. The 72-hour window captures the moment when the social trigger is recent enough to be the plausible driver. Category match is the signal — the module is not fired on all new goals, only on goals where social comparison is a structurally plausible explanation.
- **Privacy architecture (critical):** The trigger uses sibling goal data only for detection. The Hook and all subsequent content must never reveal the sibling's goal name, amount, or any financial detail. Only the category match is acknowledged — and even that is framed as generic ("someone in your household") unless the sibling has explicitly shared. The `privacy_requirements` field in JSON is non-negotiable.
- **Festinger attribution:** Leon Festinger's 1954 social comparison theory is correctly cited. At Oak tier (13–15), academic references are appropriate and add credibility. The citation is available in school Psychology courses.
- **Non-shaming design (enforced throughout):** The goal the child created may be entirely genuine. The module must never imply it isn't. The pre-desire test is offered as a tool, not a verdict. If the child applies it and concludes the desire is genuine — that's a valid answer. The point is deliberateness, not abstinence.
- **Social media audit:** The exercise of counting comparison-trigger posts in one hour of social media use is consistently surprising to 13–15 year olds. The count makes the invisible visible. This is the single most impactful exercise in the module.
- **Household neutrality:** "Someone in your household" or "a peer" in Hook — never "your sibling" (the other child may not be a sibling; family sharing covers step-siblings, cousins in the household, etc.). The relationship is not specified.
