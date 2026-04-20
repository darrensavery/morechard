# Module 17: Digital vs. Physical Currency
**Pillar 6 · Level 2 (Sapling) · Ages 10–12**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `gaming_goal_created` — primary trigger condition (first goal in 'gaming' category)
- `gaming_goal_name` — Hook personalisation
- `gaming_goal_target_amount` — used in Lab currency conversion
- `chore_rate_median` — used in Lab labor equivalent
- `current_balance` — used in Lab purchasing power comparison

**AI Mentor rendering rules:**
- Hook must name the specific gaming goal that triggered the module.
- Lab must use the child's actual `gaming_goal_target_amount` in the real-money conversion.
- Lesson must use specific examples the child is likely to recognise (V-Bucks, Robux, Gems) without endorsing or discouraging in-game spending.
- Module must not be preachy about gaming purchases — teach the mechanics of walled-garden currencies, not a moral judgement on the child's interests.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal.category = 'gaming' AND COUNT(goals WHERE child_id = ? AND category = 'gaming') = 1`*

> *"V-Bucks, Robux, Gems — the orchard has a dark corner selling 'magic seeds' that only grow inside one walled garden. Let's map the exit."*

You've set a goal in the gaming category: **{gaming_goal_name}**. Good. Saving up for something you want, rather than spending impulsively — that's exactly the right move.

But before you get there, let's look at something that most people don't stop to think about: the money inside games isn't quite money. It looks like money. It works like money inside the game. But outside the game, it's worth exactly nothing.

That's not an accident. It's a design choice. Let's understand why.

---

### ACT 2 — LESSON

**The two types of digital currency.**

**Real digital money** — money that exists in actual currency (pounds, dollars, złoty) stored and moved digitally. When you receive chore money in Morechard, that's real money recorded digitally. When you pay by card, that's real money moving between real accounts. Digital, but real. It can be spent anywhere that accepts payment.

**In-game currencies** — V-Bucks (Fortnite), Robux (Roblox), Gems, Coins, Credits — these are invented currencies that only exist inside one company's ecosystem. You buy them with real money. But you cannot convert them back to real money. You cannot spend them anywhere except the game that created them.

---

**Why companies create their own currencies.**

It's not random. There are specific reasons:

**1. It hides the real-money price.** £8 for a skin feels abstract when it becomes 800 V-Bucks first. The conversion step removes you from the direct comparison. You're not choosing "do I want to spend £8 on a digital costume?" — you're choosing "do I want this skin for 800 V-Bucks?" which feels different, even though it's the same thing.

**2. It forces over-purchasing.** V-Bucks are sold in fixed bundle sizes — 1,000 for £7.99, 2,800 for £19.99. The skin costs 800. So you need to buy 1,000 — but now you have 200 left over. The leftovers pressure you toward a next purchase to "use them up." This is engineered.

**3. It locks you in.** If you have 400 Robux left and you've decided to stop spending on Roblox, those 400 Robux are stranded. You can't get the money back. You're psychologically pressured to either spend them (buy something else) or feel like you've wasted them. Either way, the company wins.

**4. It makes spending feel less real.** Handing over £10 cash feels significant. Tapping to spend 1,000 V-Bucks feels abstract — even though it cost the same £10 real pounds to acquire.

---

**The walled garden problem.**

All in-game currencies are "walled gardens" — ecosystems controlled entirely by one company where only their rules apply and only their currency functions.

Inside the wall:
- The company sets all prices
- The company can change prices any time
- The company can remove items, games, or the entire service
- Your currency goes to zero if the game shuts down or removes the item you wanted

Outside the wall:
- Your V-Bucks are worth nothing
- You cannot exchange them for Robux or any other currency
- You cannot get your real money back

This means in-game currency is a **one-way conversion**. Real money → in-game currency → gone. There is no exit.

---

**How to think about gaming purchases.**

This isn't a lesson about never spending on games. Gaming is legitimate entertainment, and spending on things you enjoy is fine when done consciously.

The key is the labor equivalent — the test from M1:

**"Is this skin worth X chores of my work?"**

Before any in-game purchase:
1. Convert the in-game price back to real money. (What bundle size do you need? What does that cost in real pounds?)
2. Convert real pounds to chores at your rate.
3. Ask honestly: is this worth that many chores?

If yes — buy it with clear eyes. If no — the currency design was doing its job of making it feel less real than it is.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your gaming goal: **{gaming_goal_name}**, target: **£{gaming_goal_target_amount}**.

Let's work through the real-money conversion:

1. If your target costs in-game currency (e.g. 1,500 Robux), and the closest bundle is 1,600 Robux for £11.99 — how much real money do you spend? ____________
2. How much Robux is left over after the purchase (stranded currency)? ____________
3. In chores at **£{chore_rate_median}**: how many chores is **£{gaming_goal_target_amount}** worth? ____________
4. Your current real-money balance is **£{current_balance}**. If you converted it all to Robux at a typical rate (approx. 80 Robux per £1), how many Robux would you have? ____________ — and could you spend any of those Robux outside Roblox? ____________

---

**Bundle math — the stranded currency trap.**

V-Bucks bundle pricing (approximate 2025):
- 1,000 V-Bucks: £7.99
- 2,800 V-Bucks: £19.99
- 5,000 V-Bucks: £31.99

A Battle Pass costs 950 V-Bucks.

1. Which bundle do you need to buy to get the Battle Pass? ____________
2. How much does it cost in real money? ____________
3. How many V-Bucks are left over (stranded)? ____________
4. What happens to those stranded V-Bucks if you decide to stop playing Fortnite? ____________

---

**The labor equivalent.**

Pick one in-game item you've considered buying (real or hypothetical). Work out:

1. In-game price: ____________ [currency name]
2. Real-money equivalent: ____________ (convert at published exchange rate)
3. Bundle cost (nearest bundle that covers it): ____________
4. Chores to earn that: ____________ chores at £{chore_rate_median}
5. Decision: is it worth it? ____________ (Your answer — no judgment.)

---

**Reflection.**

1. Have you ever had leftover in-game currency that you felt pressured to spend? What happened?
2. Does thinking about games in terms of chores change how you feel about any purchase you've made or considered?
3. What's the difference between buying a real thing for £10 and buying 1,000 V-Bucks for £7.99?

**Bonus challenge:** Look up one game you play or have played. Find out: does the company convert in-game currency back to real money? (Almost all say no.) What happens to your currency if the game shuts down?

---

### ACT 4 — QUIZ

**Q1.** You spend £8 to buy 1,000 V-Bucks. You use 800 V-Bucks on a skin. What happens to the remaining 200 V-Bucks?

- A) They convert back to £1.60 automatically
- B) They stay in your account — you can spend them later on another purchase, but you cannot get the money back
- C) They expire after 30 days

*Correct: B. In-game currencies do not convert back to real money. The 200 V-Bucks remain, but they are stranded inside Fortnite's ecosystem.*

---

**Q2.** A game charges 800 in-game coins for an item. Coins are sold in bundles of 500 (£4.99) or 1,000 (£7.99). What is the minimum real-money cost of this item?

- A) £4.99 — the cheaper bundle
- B) £7.99 — you need the 1,000-coin bundle because 500 is not enough
- C) £6.39 — proportional to 800 coins at the 1,000-coin rate

*Correct: B. You need at least 800 coins. The 500-coin bundle is insufficient. The minimum bundle that covers the purchase is 1,000 coins at £7.99. You then have 200 coins stranded.*

---

**Q3.** Why do game companies create their own currencies instead of letting you pay with real money directly?

- A) It's easier for their payment systems to process
- B) It obscures the real-money price, enables over-purchasing via bundle sizing, locks users in, and makes spending feel less real
- C) It protects children from spending too much

*Correct: B. In-game currencies serve four commercial purposes: price obscuration, engineered over-purchasing via bundle gaps, ecosystem lock-in, and psychological distancing from real-money value.*

---

### CLOSING LINE

> *"The walled garden sells seeds you can't plant anywhere else. Now you know the wall is there — and how to count the real cost before you buy."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M17 — Digital vs. Physical Currency
**TRIGGER:** `goal.category = 'gaming' AND COUNT(goals WHERE child_id = ? AND category = 'gaming') = 1`
**HOOK:** *"First gaming-category goal detected: `{gaming_goal_name}`. In-game currency mechanics and walled-garden economics apply. Review before purchase."*

---

### ACT 2 — LESSON

**Currency taxonomy.**

| Type | Convertibility | Acceptance | Example |
|---|---|---|---|
| Physical fiat | Bidirectional | Universal (legal tender) | £ coins/notes |
| Digital fiat | Bidirectional | Wide (card/transfer) | Bank balance, PayPal |
| In-game currency | One-way (buy only) | Single ecosystem | V-Bucks, Robux, Gems |
| Cryptocurrency | Bidirectional (market) | Limited/exchange-dependent | Bitcoin, ETH |

In-game currencies are non-convertible: `real_money → in_game_currency` only. `in_game_currency → real_money = 0`.

---

**Walled-garden economics.**

In-game currencies implement a closed-loop ecosystem with four commercial properties:

1. **Price obscuration:**
   ```
   perceived_cost = in_game_price (abstract units)
   actual_cost = in_game_price / exchange_rate (real currency)
   gap = perceived_cost >> actual_cost_awareness
   ```

2. **Bundle-gap over-purchasing:**
   ```
   item_cost = X in-game units
   available_bundles = [size_1, size_2, ...] where no bundle = X exactly
   minimum_purchase = MIN(bundle where bundle_size >= item_cost)
   stranded_units = minimum_purchase - item_cost
   ```

3. **Ecosystem lock-in:**
   ```
   stranded_units > 0 → psychological pressure to make secondary purchase
   OR
   stranded_units = perceived_loss if account abandoned
   ```

4. **Psychological distancing:**
   Spending units feels less salient than spending equivalent real currency. Reduces purchase friction.

---

**Labor equivalent calculation.**

```
real_cost = bundle_price (real currency)
labor_equivalent = real_cost / chore_rate_median
```

This converts abstract in-game spending back to the unit of effort (chores) that produced the money, restoring salience.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `gaming_goal_target_amount = {gaming_goal_target_amount}`, `chore_rate_median = {chore_rate_median}`, `current_balance = {current_balance}`:

1. `labor_equivalent = gaming_goal_target_amount / chore_rate_median` = ____________ chores
2. `robux_from_full_balance = current_balance × 80` = ____________ Robux (approximate)
3. `convertible_back_to_gbp = 0` — in-game currencies have no exit
4. Bundle-gap example: item costs 800 V-Bucks. Bundle: 1,000 for £7.99.
   - `real_cost = 7.99`
   - `stranded_units = 1000 − 800 = 200`
   - `stranded_value_implied = 200 / 1000 × 7.99 = £1.60` (non-recoverable)
   - `chores_for_stranded = 1.60 / chore_rate_median` = ____________

---

**Bundle analysis.**

For a target item costing X in-game units, given bundle options:

```json
{
  "item_cost_units": number,
  "bundle_options": [
    {"size": number, "price_gbp": number},
    {"size": number, "price_gbp": number}
  ],
  "minimum_qualifying_bundle": {"size": number, "price_gbp": number},
  "stranded_units": "minimum_qualifying_bundle.size − item_cost_units",
  "stranded_value_gbp": "stranded_units / minimum_qualifying_bundle.size × minimum_qualifying_bundle.price_gbp",
  "labor_equivalent_chores": "minimum_qualifying_bundle.price_gbp / chore_rate_median"
}
```

---

### ACT 4 — QUIZ

**Q1.** 200 V-Bucks remaining after purchase — convertibility:

- [ ] £1.60 automatic credit
- [x] Zero — in-game currency has no exit; stranded in ecosystem
- [ ] Expires after 30 days

**Q2.** Item costs 800 in-game coins. Bundles: 500 for £4.99 or 1,000 for £7.99. Minimum real-money cost:

- [ ] £4.99
- [x] £7.99 — 500-coin bundle insufficient; 1,000-coin bundle required
- [ ] £6.39

**Q3.** Primary commercial purpose of in-game currencies:

- [ ] Technical payment processing convenience
- [x] Price obscuration, engineered over-purchasing, ecosystem lock-in, psychological distancing from real-money value
- [ ] Consumer protection from overspending

---

### CLOSING LINE

*"Module complete. In-game currency mechanics loaded. Apply labor_equivalent = real_cost / chore_rate_median before all in-game purchase decisions."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M17",
  "title": "Digital vs. Physical Currency",
  "pillar": 6,
  "pillar_name": "Society & Wellbeing",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "goal.category = 'gaming' AND COUNT(goals WHERE child_id = ? AND category = 'gaming') = 1",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If goal.category is null, condition evaluates false. COUNT returns 0 if no gaming goals exist; condition evaluates true on first gaming goal only.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M17', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "gaming_goal_name",
      "gaming_goal_target_amount",
      "chore_rate_median",
      "current_balance"
    ],
    "datapoints_optional": [
      "gaming_goal_created"
    ],
    "fallback_behaviour": "If gaming_goal_name is null, Hook uses 'a gaming goal'. If gaming_goal_target_amount is null, Lab uses £10 as illustrative amount. If chore_rate_median is null, use regional fallback rate."
  },

  "mentor_hook": {
    "locale_en_gb": "V-Bucks, Robux, Gems — the orchard has a dark corner selling 'magic seeds' that only grow inside one walled garden. Let's map the exit.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The walled garden sells seeds you can't plant anywhere else. Now you know the wall is there — and how to count the real cost before you buy.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the specific gaming goal. Frames the walled-garden concept without moralising.",
    "act_2": "Lesson — two currency types defined, four commercial reasons for in-game currencies, walled-garden mechanics, labor equivalent as the defence.",
    "act_3": "Lab — required numeracy: labor equivalent of gaming goal, Robux-from-balance conversion, bundle-gap stranded currency calculation.",
    "act_4": "Quiz — 3 questions on stranded currency, minimum bundle cost, and commercial purpose of in-game currencies."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M17_Q1",
        "stem": "200 V-Bucks remaining — real-money value.",
        "correct_option": "B",
        "concept_tested": "in_game_currency_non_convertibility"
      },
      {
        "id": "M17_Q2",
        "stem": "800-unit item, 500 or 1000 bundle — minimum real cost.",
        "correct_option": "B",
        "concept_tested": "bundle_gap_mechanics"
      },
      {
        "id": "M17_Q3",
        "stem": "Primary commercial purpose of in-game currencies.",
        "correct_option": "B",
        "concept_tested": "walled_garden_economics"
      }
    ]
  },

  "concepts_introduced": [
    "digital_fiat_currency",
    "in_game_currency",
    "walled_garden",
    "one_way_conversion",
    "price_obscuration",
    "bundle_gap",
    "stranded_currency",
    "labor_equivalent_applied_to_gaming"
  ],

  "prerequisites": ["M5"],

  "unlocks": ["M6", "M20"],

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

- **Moat Type: Pedagogical Moat.** No mainstream kids' finance app addresses in-game currency mechanics at this level of detail. GoHenry's gaming content treats gaming purchases as equivalent to any other purchase. Morechard explains the specific commercial architecture of in-game currencies — price obscuration, bundle-gap engineering, lock-in — which is genuinely novel curriculum.
- **Trigger rationale:** First gaming-category goal is the ideal trigger — the child is actively thinking about a gaming purchase at this exact moment, making the lesson immediately applicable rather than hypothetical.
- **Non-preachy framing:** The module must never say gaming purchases are bad or a waste. The Lesson explicitly states: "if yes — buy it with clear eyes." The goal is informed decision-making, not abstinence. A preachy module will be dismissed; a practical one will be retained.
- **Named currencies (V-Bucks, Robux):** Using real currency names grounds the lesson in the child's actual experience. These are the dominant in-game currencies for the 10–12 age group in 2025. If dominant platforms change, these examples should be updated. The mechanics remain identical regardless of the specific currency names.
- **Bundle-gap as core mechanic:** The engineered gap between item cost and available bundle sizes — producing stranded currency — is the most concrete and memorable element. The Quiz forces calculation of this gap explicitly.
- **Labor equivalent connection to M1:** This module applies M1's labor equivalent concept to gaming specifically. The connection should be explicit: "the test from M1." Children who completed M1 will find this immediately familiar.
- **Household neutrality:** No parent references needed — the lab and reflection exercises are based on the child's own gaming behaviour.
