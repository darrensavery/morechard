# Module 18: Money & Mental Health
**Pillar 6 · Level 3 (Oak) · Ages 13–15**

> **V3 template.** This module is triggered by a post-purchase satisfaction rating below 3/5. It addresses buyer's remorse and the emotional relationship with money. The **Sovereign Ledger Honest Framing opener** applies because the module references psychological concepts and external support resources that Morechard does not provide.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `purchase_satisfaction_rating` — primary trigger condition (< 3/5 within 48 hours)
- `purchase_name` — Hook personalisation (the item that triggered the low rating)
- `purchase_amount` — used in Lab
- `chore_rate_median` — used in Lab labor equivalent
- `current_balance` — context for Lab
- `days_since_purchase` — confirms trigger window (≤ 48 hours)

**AI Mentor rendering rules:**
- Hook must name the specific purchase and reference the satisfaction rating without shaming.
- Lesson must be warm but honest — acknowledge the feeling is real without amplifying distress.
- Module must provide a signposting sentence to real support if financial stress is severe (e.g. YoungMinds, Mind).
- Do not diagnose or imply the child has a mental health condition. Frame as normal human experience.
- Honest Framing opener is mandatory before Act 2.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `purchase.satisfaction_rating < 3 AND purchase.created_at >= NOW() - INTERVAL '48 hours'`*

> *"You got the thing — and something feels off. That feeling has a name. The orchard sees it a lot. Let's talk about it before it shapes your next harvest."*

You bought **{purchase_name}**. And within 48 hours, you rated your satisfaction at **{purchase_satisfaction_rating}/5**.

That's an honest signal. Something about this doesn't feel right. Maybe it's not what you expected. Maybe you feel guilty about spending. Maybe you already want something different.

That feeling has a name, and it's more common than you might think. It's also useful information — if you know how to read it.

---

### ACT 2 — LESSON

**Buyer's remorse — what it is.**

Buyer's remorse is the uncomfortable feeling that follows a purchase — a mixture of regret, doubt, and sometimes guilt. It happens most often when:

- The purchase was impulsive (advertising or FOMO drove the decision rather than a genuine pre-existing desire)
- The item cost a significant amount relative to your resources
- The item doesn't match the expectation the advertising created
- You realise you could have used the money for something that matters more to you

It's a very common human experience. It is not a sign that you're bad with money — it's a signal worth paying attention to.

---

**What buyer's remorse is telling you.**

The feeling is information, not punishment.

When it's mild — "I wish I'd waited a day before buying this" — it's useful feedback that can inform your next decision. You now know that this type of purchase tends to feel hollow. That's valuable.

When it's more persistent — a sense of genuine distress about the money spent — it may be pointing to something bigger: anxiety about having enough, fear of disappointing a parent, or a pattern of using purchases to manage other emotions temporarily.

Neither response is wrong. Both are worth noticing.

---

**The emotional relationship with money.**

Money is not emotionally neutral for most people. It carries weight — status, security, freedom, stress, guilt, pride. These emotional associations develop over time, shaped by experiences in your household, messages from peers and media, and your own history with having or not having enough.

Common emotional patterns:

**Retail therapy** — using purchases to improve mood. It works briefly (shopping activates the same reward pathways as other pleasurable activities) but the mood lift is short-lived and the money is gone. If spending is your primary mood management tool, the tool is expensive and doesn't treat the underlying cause.

**Money anxiety** — a persistent worry about finances, even when the situation is objectively manageable. Can manifest as compulsive checking of balances, reluctance to spend on genuine needs, or a constant low-level sense of financial dread.

**Avoidance** — not looking at balances, not thinking about goals, not engaging with money at all. Often a coping response to financial stress. Makes the underlying situation harder to manage.

**Comparison spending** — buying things primarily because others have them or to signal status. Covered in more depth in M18b.

---

**What contentment looks like.**

Contentment is not the same as not wanting anything. It's a relationship with your current situation that allows satisfaction while still having goals.

In money terms: contentment is knowing what your goals are, making progress toward them, and being able to spend on things you genuinely enjoy without persistent guilt or craving.

It doesn't require a large balance. It requires alignment between your spending and your values — which is why the pre-desire test (M6) matters, and why having goals matters. Goals give direction to money; without them, spending is just filling a void temporarily.

---

**When to talk to someone.**

If financial worry is affecting your sleep, your mood, your relationships, or your ability to concentrate — that's worth discussing with a trusted adult. This is not weakness. Financial stress is one of the most common causes of mental health strain at all ages.

In the UK: YoungMinds (youngminds.org.uk) and Mind (mind.org.uk) both have resources on money and mental health. The Samaritans (116 123) are available if things feel overwhelming.

Morechard can track your money. It cannot replace a person. If the numbers feel crushing, tell someone.

---

### ACT 3 — LAB

**Numeracy check (required).**

You bought **{purchase_name}** for **£{purchase_amount}**.

1. In chores at **£{chore_rate_median}**: how many chores did this purchase cost you? ____________
2. As a percentage of your current balance **£{current_balance}**: ____________ %
3. If you rated satisfaction 2/5, what's the gap between expected value (5/5) and received value (2/5)? Express as a percentage: ____________ % of expected satisfaction delivered.
4. At this ratio, how many chores' worth of value did you actually receive from the purchase? ____________

---

**Buying pattern audit.**

Think about your last three purchases. For each:

| Purchase | Was it pre-planned? | What drove it? | Satisfaction (1–5) | What did you expect? |
|---|---|---|---|---|
| 1. | Yes / No | ____________ | /5 | ____________ |
| 2. | Yes / No | ____________ | /5 | ____________ |
| 3. | Yes / No | ____________ | /5 | ____________ |

Is there a pattern? (E.g. impulse purchases consistently rate lower, or certain categories consistently disappoint?) ____________

---

**Emotional trigger check.**

For the purchase that triggered this module:

1. What were you feeling just before you bought it? (Bored / excited / stressed / happy / trying to impress someone / none of these) ____________
2. Did the purchase change that feeling — even briefly? ____________
3. Did the feeling return after the purchase? ____________
4. If the purchase was partly about a feeling rather than the item itself — what might address the feeling more directly? ____________

---

**Contentment exercise.**

Write down three things you currently have (not things you want) that you genuinely value:

1. ____________
2. ____________
3. ____________

Now write down one goal you're working toward that excites you:

____________

Does your recent spending support that goal — or work against it? ____________

---

**Reflection.**

1. Buyer's remorse is information. What specifically is this purchase teaching you about your buying patterns?
2. Is your spending generally aligned with what you care about — or is there a gap between where your money goes and what matters to you?
3. If financial worry ever feels persistent or heavy: who is one trusted adult you could talk to?

---

### ACT 4 — QUIZ

**Q1.** Buyer's remorse is:

- A) A sign that you're bad with money and should stop spending
- B) A normal emotional response to purchases that can provide useful information about your spending patterns
- C) Only experienced by people who spend irresponsibly

*Correct: B. Buyer's remorse is nearly universal and not a character flaw. It's a signal — sometimes mild feedback, sometimes pointing to a deeper pattern — that deserves attention rather than shame.*

---

**Q2.** "Retail therapy" — using purchases to improve your mood — is problematic primarily because:

- A) Shopping in bad moods leads to worse choices
- B) The mood lift is short-lived and the money is spent, but the underlying emotional cause is not addressed
- C) It always leads to regret

*Correct: B. The problem with retail therapy is not the temporary improvement in mood — that's real. The problem is that the underlying cause of the mood remains, the money is gone, and the cycle repeats. It's expensive and treats the symptom, not the cause.*

---

**Q3.** Financial stress that affects sleep, concentration, or relationships is best addressed by:

- A) Tracking your spending more carefully in Morechard
- B) Spending less until the stress subsides
- C) Talking to a trusted adult — financial stress at this level warrants human support, not just financial tracking

*Correct: C. Morechard can organise financial information. It cannot provide the emotional support needed when financial worry is affecting wellbeing. A trusted adult — parent, carer, teacher, counsellor — is the right resource.*

---

### CLOSING LINE

> *"The feeling after the purchase is part of the harvest too. Pay attention to it — it's the orchard's most honest signal."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M18 — Money & Mental Health
**TRIGGER:** `purchase.satisfaction_rating < 3 AND purchase.created_at >= NOW() - INTERVAL '48 hours'`
**HOOK:** *"Post-purchase satisfaction rating: {purchase_satisfaction_rating}/5. Below threshold. Buyer's remorse framework and emotional spending patterns apply."*

---

### ACT 2 — LESSON

**Buyer's remorse definition.**

Post-purchase cognitive dissonance: the uncomfortable psychological state following a purchase that fails to meet pre-purchase expectations.

Common triggers:
- Impulse purchase (low deliberation time)
- High relative cost (large % of available balance)
- Expectation-reality gap (product ≠ advertising-generated expectation)
- Opportunity cost recognition (post-purchase awareness of foregone alternatives)

---

**Emotional spending patterns (taxonomy).**

| Pattern | Mechanism | Consequence |
|---|---|---|
| Retail therapy | Purchase activates reward pathway; mood lifts temporarily | Short duration; money spent; cause unaddressed |
| Money anxiety | Persistent financial worry; may be disproportionate to objective situation | Impairs decision-making; may cause avoidance |
| Avoidance | Non-engagement with financial information | Worsens underlying situation |
| Comparison spending | Purchase driven by social signalling rather than intrinsic value | Low satisfaction; recurring pattern |

None of these are character flaws. All are learnable responses that can be modified with awareness.

---

**Contentment model.**

```
contentment = f(goal_clarity, spending_alignment, absence_of_persistent_craving)
```

Contentment does not require high balance. It requires:
1. Known goals
2. Spending that moves toward (or does not contradict) those goals
3. Capacity for satisfaction with current state during progress toward goals

---

**Threshold for external support.**

```
if financial_stress_affects(sleep OR concentration OR relationships OR mood):
    action = talk_to_trusted_adult()
    # Morechard cannot substitute for human support
```

UK resources: YoungMinds (youngminds.org.uk), Mind (mind.org.uk), Samaritans (116 123).

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `purchase_amount = {purchase_amount}`, `chore_rate_median = {chore_rate_median}`, `current_balance = {current_balance}`, `purchase_satisfaction_rating = {purchase_satisfaction_rating}`:

1. `chores_cost = purchase_amount / chore_rate_median` = ____________
2. `pct_of_balance = purchase_amount / current_balance × 100` = ____________ %
3. `satisfaction_ratio = purchase_satisfaction_rating / 5` = ____________ (e.g. 2/5 = 0.40)
4. `value_received_in_chores = chores_cost × satisfaction_ratio` = ____________ chores' worth of value
5. `chores_effectively_wasted = chores_cost − value_received_in_chores` = ____________

---

**Spending pattern analysis.**

```json
{
  "purchases": [
    {
      "name": "string",
      "pre_planned": true | false,
      "driver": "need | want | impulse | social_pressure | mood_management",
      "satisfaction_rating": number,
      "expectation_rating": number,
      "gap": "satisfaction_rating − expectation_rating"
    }
  ],
  "pattern_identified": "string | null",
  "highest_satisfaction_driver": "string",
  "lowest_satisfaction_driver": "string"
}
```

---

**Emotional trigger classification.**

```json
{
  "purchase": "{purchase_name}",
  "pre_purchase_emotion": "string",
  "mood_change_immediate": true | false,
  "mood_change_duration": "hours | days | none",
  "underlying_cause_addressed": true | false,
  "alternative_mood_management": "string"
}
```

---

### ACT 4 — QUIZ

**Q1.** Buyer's remorse classification:

- [ ] Sign of irresponsibility
- [x] Normal post-purchase cognitive dissonance; useful signal about spending patterns
- [ ] Exclusive to impulsive buyers

**Q2.** Retail therapy primary limitation:

- [ ] Poor purchase quality in bad moods
- [x] Mood lift is temporary; underlying cause unaddressed; money permanently spent
- [ ] Always produces regret

**Q3.** Financial stress affecting sleep and relationships — correct response:

- [ ] Increase spending tracking granularity
- [ ] Reduce spending immediately
- [x] Engage trusted adult — stress at this level requires human support beyond financial tools

---

### CLOSING LINE

*"Module complete. Buyer's remorse framework loaded. Post-purchase satisfaction data is a valid input to future purchase decisions. If financial stress exceeds manageable levels: escalate to trusted adult."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M18",
  "title": "Money & Mental Health",
  "pillar": 6,
  "pillar_name": "Society & Wellbeing",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "PURCHASE_SATISFACTION_WRITE",
    "condition": "purchase.satisfaction_rating < 3 AND purchase.created_at >= NOW() - INTERVAL '48 hours'",
    "evaluation_timing": "on_satisfaction_rating_write",
    "prerequisite": "Post-purchase 1–5 star satisfaction rating prompt must be shown 24 hours after a goal purchase completes. M18 trigger cannot fire without this prompt being shown and answered.",
    "null_safety": "If satisfaction_rating is null (prompt not yet shown), module does not fire. If purchase.created_at is outside 48-hour window, module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M18', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "purchase_satisfaction_rating",
      "purchase_name",
      "purchase_amount",
      "chore_rate_median",
      "current_balance"
    ],
    "datapoints_optional": [
      "days_since_purchase"
    ],
    "fallback_behaviour": "If purchase_name is null, Hook uses 'your recent purchase'. If purchase_amount is null, Lab uses £10 as illustrative amount. If chore_rate_median is null, use regional fallback rate."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "You got the thing — and something feels off. That feeling has a name. The orchard sees it a lot. Let's talk about it before it shapes your next harvest.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The feeling after the purchase is part of the harvest too. Pay attention to it — it's the orchard's most honest signal.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names purchase and satisfaction rating. Warm, non-shaming entry.",
    "act_2": "Lesson — buyer's remorse defined, emotional patterns (retail therapy, anxiety, avoidance, comparison), contentment model, mental health signposting.",
    "act_3": "Lab — required numeracy on chore cost, satisfaction ratio, and value-received calculation. Buying pattern audit. Emotional trigger classification. Contentment exercise.",
    "act_4": "Quiz — 3 questions on buyer's remorse classification, retail therapy limitation, and when to seek human support."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M18_Q1",
        "stem": "Buyer's remorse — correct classification.",
        "correct_option": "B",
        "concept_tested": "buyers_remorse_as_signal"
      },
      {
        "id": "M18_Q2",
        "stem": "Retail therapy — primary limitation.",
        "correct_option": "B",
        "concept_tested": "retail_therapy_mechanism"
      },
      {
        "id": "M18_Q3",
        "stem": "Financial stress affecting sleep and relationships — correct response.",
        "correct_option": "C",
        "concept_tested": "mental_health_escalation_threshold"
      }
    ]
  },

  "concepts_introduced": [
    "buyers_remorse",
    "post_purchase_cognitive_dissonance",
    "retail_therapy",
    "money_anxiety",
    "financial_avoidance",
    "comparison_spending",
    "contentment",
    "spending_alignment",
    "mental_health_signposting"
  ],

  "prerequisites": ["M6"],

  "unlocks": ["M18b", "M20"],

  "support_resources": {
    "uk": [
      {"name": "YoungMinds", "url": "youngminds.org.uk"},
      {"name": "Mind", "url": "mind.org.uk"},
      {"name": "Samaritans", "phone": "116 123"}
    ],
    "us": [
      {"name": "Crisis Text Line", "text": "HOME to 741741"},
      {"name": "SAMHSA Helpline", "phone": "1-800-662-4357"}
    ],
    "pl": [
      {"name": "Telefon Zaufania dla Dzieci i Młodzieży", "phone": "116 111"}
    ]
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

- **Moat Type: Pedagogical Moat.** No comparable kids' finance app addresses the emotional relationship with money at this depth. GoHenry and Greenlight focus entirely on mechanics (earn, save, spend). Morechard's integration of buyer's remorse, emotional spending patterns, and mental health signposting is genuinely novel and addresses a real gap in financial literacy provision.
- **Trigger design:** The 1–5 satisfaction prompt 24 hours post-purchase is a prerequisite for M18. This prompt must be built into the purchase flow — it cannot be assumed. The trigger relies on this prompt having been answered with a rating below 3. Implementation note: the satisfaction prompt itself should be gentle, non-shaming, and framed as "how are you feeling about it?" not "was it worth it?"
- **Honest Framing rationale:** Morechard does not provide mental health support. The Honest Framing opener contextualises the app's limitation — the module teaches the concepts; if the emotional reality is severe, a human is needed. The mental health signposting at the end of Act 2 is non-negotiable and must appear in every locale variant.
- **Non-diagnostic framing:** The module must not imply the child has anxiety, depression, or any clinical condition. "Common human experience" and "emotional patterns" are the correct frames. If a child reads this lesson and recognises a persistent pattern in themselves, the lesson should make seeking support feel normal and accessible, not alarming.
- **Satisfaction ratio numeracy:** The calculation "value received in chores" (chores_cost × satisfaction_ratio) is deliberately uncomfortable — it makes the gap between expected and received value concrete in the child's own effort units. This is the module's most impactful data use.
- **Household neutrality:** Reflection Q3 uses "a trusted adult" broadly — covers parent, carer, teacher, school counsellor, or any adult the child trusts. This is important: in co-parenting or difficult household situations, the trusted adult may not be a parent.
- **Support resources in JSON:** The `support_resources` field is additional to the standard JSON structure. It must be included in locale variants with appropriate regional resources.
