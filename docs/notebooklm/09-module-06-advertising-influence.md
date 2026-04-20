# Module 6: Advertising & Influence
**Pillar 2 · Level 3 (Oak) · Ages 13–15**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `repeat_category_purchase_count` — primary trigger (3+ purchases in same non-essential category in 30 days)
- `repeat_purchase_category` — Hook personalisation (names the category)
- `purchases_last_30d` — used in Lab to examine the pattern
- `chore_rate_median` — used in Lab labor equivalent
- `total_spent_repeat_category` — used in Hook numeracy

**AI Mentor rendering rules:**
- Hook must name the specific category from `repeat_purchase_category`.
- Lab must reference the child's own `purchases_last_30d` data for the pattern audit.
- Lesson must name real techniques (dark patterns, social proof, scarcity) with their technical names.
- Module must not shame the purchases — the lesson is about the architecture of persuasion, not the choice made.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `COUNT(purchases WHERE child_id = ? AND category NOT IN ('essentials','savings') AND created_at >= NOW() - INTERVAL '30 days') >= 3`*

> *"Three times in a month, the same shelf called your name. That's not a coincidence — someone designed that shelf. Let's inspect the architecture."*

Three purchases in 30 days in the same category: **{repeat_purchase_category}**. Total spent: **£{total_spent_repeat_category}**.

You chose all three. That's real. But the choice didn't happen in a vacuum — someone spent a great deal of money and expertise to make sure that shelf was the one you noticed, the one that felt urgent, the one that made you feel like you'd miss out if you didn't reach for it.

Understanding how that works doesn't mean you stop buying things you enjoy. It means you get to decide when you're actually choosing and when you're being steered.

---

### ACT 2 — LESSON

**Advertising is not information — it is persuasion.**

An advertisement's job is not to inform you accurately about a product. Its job is to make you want the product. These are different goals.

Accurate information: "This game costs £49.99, takes approximately 40 hours to complete, has 3.8/5 average review score."

Advertising: "The most epic adventure you'll ever experience. Join millions of players. Limited edition. Don't miss out."

Both are about the same game. Only one is trying to move your money. Recognising which mode you're in is the skill.

---

**The techniques — named and explained.**

**Social proof.** "Millions of people bought this." "Bestseller." "5 stars." Humans look to other humans to know what's safe and desirable. Advertisers manufacture or amplify the appearance of consensus. When you see a product described as popular, your brain reads it as "safe choice." That's the mechanism being exploited.

**Scarcity.** "Only 3 left." "Limited edition." "Ends tonight." When something seems rare or temporary, we want it more. This is an evolutionary response — scarcity in nature meant act now or miss out. Advertisers fake scarcity to trigger that response. Most "limited editions" are produced in large quantities and restocked.

**Authority.** "Recommended by experts." "As seen on TV." "Used by professionals." We trust credentials. Advertisers attach their product to authority — real or invented. The authority doesn't have to be relevant; it just has to feel credible.

**Reciprocity.** "Free sample." "Free trial." "Get started for nothing." When someone gives you something, you feel a pull to give something back. Advertisers exploit this by offering free things that create a sense of obligation to buy.

**Fear of missing out (FOMO).** "Everyone's talking about this." "Don't get left behind." "Be first." FOMO is social pressure converted into urgency. It combines social proof with scarcity. It is one of the most powerful drivers of impulse spending.

**Dark patterns.** These are design choices in apps and websites that make it harder to say no than to say yes. Examples: pre-ticked boxes that add items to your basket, "Decline" buttons in tiny grey text next to a big coloured "Accept," countdown timers on prices, complicated cancellation flows. Dark patterns are not persuasion — they are architectural obstacles to the choice you actually want to make.

---

**How influencer marketing works — the current version.**

Social media influencers are paid — sometimes in money, sometimes in free products, sometimes in both — to promote products to their followers. The payment is not always disclosed. The legal requirement to disclose (in the UK, via ASA guidelines; in the US, via FTC guidelines) is frequently ignored.

The effectiveness of influencer promotion comes from parasocial relationships: followers feel they know the influencer, trust their taste, and want to be like them. This is the same mechanism as word-of-mouth recommendation from a friend — except the influencer is being paid and the friend is not.

Signs a recommendation may be commercial:
- "#ad" or "#sponsored" — required disclosure, but easy to miss
- Unusually enthusiastic language about a specific product
- Link in bio or swipe-up with discount code
- Product featured shortly after a brand partnership announcement

The discount code is particularly telling: it's also a tracking mechanism. The influencer's payment is often calculated per-purchase through that code.

---

**The question that disarms all of this.**

Before any non-essential purchase influenced by advertising, ask: **"Is this something I wanted before I saw it advertised?"**

If the answer is no: the advertising created the desire. That doesn't automatically mean don't buy — but it means you should pause and examine whether you actually want it, or whether you want the feeling the ad sold you.

The feeling (coolness, belonging, not missing out) is not the product. The product and the feeling are two different things. You can get one without the other.

---

### ACT 3 — LAB

**Numeracy check (required).**

You've spent **£{total_spent_repeat_category}** in the **{repeat_purchase_category}** category in the last 30 days across {repeat_category_purchase_count} purchases.

1. Average spend per purchase in this category: £{total_spent_repeat_category} ÷ {repeat_category_purchase_count} = ____________
2. At your current chore rate of **£{chore_rate_median}**, how many chores did that 30-day spend represent? ____________
3. If the same pattern continued for 12 months, projected annual spend in this category: ____________

---

**Advertising audit.**

Think of the last non-essential thing you bought or added to a wish list after seeing it advertised (social media, TV, YouTube ad, influencer recommendation). Answer:

1. Where did you see it? ____________
2. Which technique was used? (Social proof / Scarcity / Authority / FOMO / Dark pattern / Other) ____________
3. Did you want this thing before you saw the ad? ____________
4. Was the influencer or creator being paid to show it to you? (Check for #ad / #sponsored / discount code.) ____________
5. If you bought it — do you use it? If you didn't — does it still feel urgent?

---

**Dark pattern hunt.**

Open any app or website where you've made a purchase. Find and name one dark pattern: a design choice that made it easier to buy than to not buy, or harder to cancel than to sign up.

Describe it: ____________

---

**Reflection.**

1. Which of the six techniques (social proof, scarcity, authority, reciprocity, FOMO, dark patterns) do you find hardest to resist? Why?
2. In the **{repeat_purchase_category}** category specifically — was any of your spending driven by one of these techniques rather than a genuine, pre-existing desire?
3. What would you have done differently if you'd known the names of these techniques before the purchases?

---

### ACT 4 — QUIZ

**Q1.** An app shows a countdown timer: "Price rises in 00:04:32." You've been considering buying for a week. What is happening?

- A) Genuine price increase — the countdown is accurate
- B) Artificial scarcity — the timer creates urgency to bypass your deliberation
- C) The company is being transparent about price changes

*Correct: B. Countdown timers on purchases are a classic scarcity technique. They create urgency where none exists. Most prices do not actually change when the timer hits zero.*

---

**Q2.** A social media creator posts a glowing review of a product with "Get 20% off with my code." Which of the following is most likely?

- A) They genuinely love the product and offered the code as a favour to followers
- B) They are receiving payment or commission per sale through the code — the code is both a discount and a tracking mechanism
- C) The company is sharing profit with all customers via the creator

*Correct: B. Discount codes in influencer content are almost always affiliate or paid arrangements. The code tracks conversions and forms the basis of payment. The enthusiasm is commercial.*

---

**Q3.** You add an item to an online basket. At checkout, a box is pre-ticked: "Add premium protection: £4.99/month." What type of technique is this?

- A) Social proof
- B) Reciprocity
- C) Dark pattern — a pre-ticked addition that relies on you not noticing or not bothering to untick

*Correct: C. Pre-ticked options that add costs are a textbook dark pattern. The design assumes inertia: most people won't untick.*

---

### CLOSING LINE

> *"The shelf was built to call your name. Now you know how it was built. That knowledge doesn't stop you buying — it makes you the one doing the choosing."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M6 — Advertising & Influence
**TRIGGER:** `COUNT(purchases WHERE child_id = ? AND category NOT IN ('essentials','savings') AND created_at >= NOW() - INTERVAL '30 days') >= 3`
**HOOK:** *"3+ non-essential purchases in category `{repeat_purchase_category}` within 30-day window. Persuasion architecture review required."*

---

### ACT 2 — LESSON

**Advertising vs. information — formal distinction.**

```
information = accurate description of product attributes (price, function, quality)
advertising = persuasive content designed to increase purchase probability
```

Advertising's objective function is `maximise_purchase_probability`, not `maximise_buyer_information_accuracy`. These objectives frequently conflict.

---

**Persuasion techniques (taxonomy).**

| Technique | Mechanism | Cognitive bias exploited |
|---|---|---|
| Social proof | Displays popularity signals | Herding / safety-in-numbers |
| Scarcity | Real or manufactured rarity | Loss aversion |
| Authority | Credential attachment | Heuristic trust transfer |
| Reciprocity | Free sample / trial | Social obligation norm |
| FOMO | Social pressure + urgency | Loss aversion + social comparison |
| Dark patterns | UI/UX obstacles to refusal | Inertia / status quo bias |

---

**Influencer economics (formal).**

```
influencer_revenue = fixed_fee + (conversions × commission_rate)
```

Disclosure requirements (UK: ASA CAP Code; US: FTC Endorsement Guides) mandate labelling of paid content. Compliance rate is low. Default assumption: any influencer recommendation involving a product link or discount code is compensated.

Parasocial trust transfer: followers perceive the influencer as a known, trusted individual (not a commercial actor). This misclassification makes influencer advertising more effective than equivalent banner advertising by 3–8× on typical conversion metrics.

---

**Decision heuristic.**

```
if pre_advertising_desire = false:
    advertising created the desire
    evaluate: product_utility vs advertising_feeling
    if advertising_feeling is primary driver:
        defer 24 hours and re-evaluate
```

The 24-hour rule (Truth Engine §Behavioral Soft-Locks) applies automatically for purchases > 50% of balance. This module teaches the underlying rationale.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `total_spent_repeat_category = {total_spent_repeat_category}`, `count = {repeat_category_purchase_count}`, `chore_rate_median = {chore_rate_median}`:

1. `avg_purchase = total_spent / count` = ____________
2. `chores_equivalent = total_spent / chore_rate_median` = ____________
3. `projected_annual = total_spent × 12` = ____________

---

**Persuasion audit.**

For one recent non-essential purchase or wish-list item:

```json
{
  "item": "string",
  "source": "social_media | tv | search | influencer | other",
  "technique_identified": "social_proof | scarcity | authority | reciprocity | fomo | dark_pattern",
  "pre_existing_desire": true | false,
  "commercial_disclosure_present": true | false | unknown,
  "post_purchase_satisfaction": "high | medium | low | not_purchased"
}
```

---

**Dark pattern identification.**

In any e-commerce or subscription app: identify one UI element that is a dark pattern. Classify as:
- Pre-ticked add-on
- Difficult cancellation flow
- Misleading countdown timer
- Buried opt-out
- Confirm-shaming (negative-framed decline button)

---

### ACT 4 — QUIZ

**Q1.** Countdown timer on a purchase screen. Classification:

- [ ] Accurate price signal
- [x] Scarcity technique — manufactured urgency to suppress deliberation

**Q2.** Influencer with discount code. Primary revenue model:

- [ ] Charitable discount to followers
- [x] Commission-per-conversion — code is tracking mechanism; enthusiasm is commercial

**Q3.** Pre-ticked add-on at checkout. Classification:

- [ ] Social proof
- [ ] Reciprocity
- [x] Dark pattern — inertia exploitation via default-on opt-in

---

### CLOSING LINE

*"Module complete. Persuasion taxonomy loaded. Future purchase decisions should classify the source technique before committing funds."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M6",
  "title": "Advertising & Influence",
  "pillar": 2,
  "pillar_name": "Spending & Choices",
  "level": 3,
  "level_name": "Oak",
  "age_range": "13-15",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "PURCHASE_WRITE",
    "condition": "COUNT(purchases WHERE child_id = ? AND category NOT IN ('essentials','savings') AND created_at >= NOW() - INTERVAL '30 days') >= 3",
    "evaluation_timing": "on_purchase_write",
    "null_safety": "If purchases table has no records for child_id, COUNT returns 0; condition evaluates false.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M6', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "repeat_category_purchase_count",
      "repeat_purchase_category",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "purchases_last_30d",
      "total_spent_repeat_category"
    ],
    "fallback_behaviour": "If repeat_purchase_category is null, Hook uses 'the same category' as generic reference. If total_spent_repeat_category is null, Lab numeracy section proceeds with count and chore_rate_median only."
  },

  "mentor_hook": {
    "locale_en_gb": "Three times in a month, the same shelf called your name. That's not a coincidence — someone designed that shelf. Let's inspect the architecture.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The shelf was built to call your name. Now you know how it was built. That knowledge doesn't stop you buying — it makes you the one doing the choosing.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the specific repeat category and total spent. Non-shaming framing.",
    "act_2": "Lesson — advertising vs. information distinction, six techniques named and explained, influencer economics, pre-desire heuristic.",
    "act_3": "Lab — required numeracy on repeat spend and chore equivalent. Persuasion audit on one real purchase. Dark pattern hunt exercise.",
    "act_4": "Quiz — 3 questions on scarcity technique, influencer commission model, and dark pattern classification."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M6_Q1",
        "stem": "Countdown timer at checkout — classification.",
        "correct_option": "B",
        "concept_tested": "scarcity_technique"
      },
      {
        "id": "M6_Q2",
        "stem": "Influencer with discount code — revenue model.",
        "correct_option": "B",
        "concept_tested": "influencer_economics"
      },
      {
        "id": "M6_Q3",
        "stem": "Pre-ticked add-on at checkout — classification.",
        "correct_option": "C",
        "concept_tested": "dark_pattern_identification"
      }
    ]
  },

  "concepts_introduced": [
    "advertising_vs_information",
    "social_proof",
    "manufactured_scarcity",
    "authority_heuristic",
    "reciprocity",
    "fomo",
    "dark_patterns",
    "influencer_economics",
    "parasocial_trust",
    "pre_desire_test"
  ],

  "prerequisites": ["M5"],

  "unlocks": ["M9", "M18b"],

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

- **Moat Type: Pedagogical Moat.** No comparable kids' finance app addresses advertising psychology at this level. Jump$tart standards reference "recognising advertising influence" but don't name techniques or cover influencer economics. This module is a genuine curriculum advance.
- **Trigger rationale:** Three purchases in the same non-essential category in 30 days is a behavioural signal of category-specific susceptibility. The module fires at the moment the pattern is evidenced, making the persuasion audit personal rather than hypothetical.
- **Non-shaming design:** The Hook and Lesson must never imply the purchases were wrong. The goal is meta-cognitive awareness, not spending guilt. A child who feels shamed will reject the lesson; a child who feels curious will retain it.
- **Dark pattern hunt:** The exercise of finding a dark pattern in a real app the child uses is the most likely to produce a lasting "aha" — seeing it in a familiar context makes the abstract taxonomy concrete.
- **Pre-desire test as the master heuristic:** All six techniques can be defeated by one question: "Did I want this before I saw it advertised?" This is the single sentence to preserve in translation.
- **Household neutrality:** No parent references needed in this module — the exercises are about the child's own digital environment.
