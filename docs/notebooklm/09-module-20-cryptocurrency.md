# Module 20: Cryptocurrency & Speculative Assets
**Pillar 5 · Level 4 (Oak) · Ages 16+**

> **V3 template.** This module teaches a financial instrument Morechard does not simulate, requires the **Sovereign Ledger Honest Framing opener**, and uses a **default-fire trigger** — every Oak-tier child sees this module within 60 days of entering Oak, regardless of whether they've shown crypto interest. This is deliberate: the harm vector from uninformed crypto exposure is high enough at 16+ to justify proactive delivery.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `goal_keyword_crypto` — primary keyword trigger (fires module early if child signals interest)
- `active_goal_titles` — referenced in Hook if crypto keyword match exists
- `current_balance` — used in Labor Equivalent calculation (how many chores would a £100 crypto bet cost?)
- `chore_rate_median` — used in Labor Equivalent calculation
- `child_age_tier` — required = 'OAK' for default-fire path
- `days_since_oak_entry` — computed from `children.age_tier_changed_at`; triggers default-fire at 60 days

**AI Mentor rendering rules:**
- If `goal_keyword_crypto = true`, Hook uses the keyword-triggered variant and names the specific matched keyword.
- If triggered via default-fire (no keyword match), Hook uses the generic Oak variant.
- Labor Equivalent calculation in Lab must use the child's own `chore_rate_median`.
- Regional volatility examples must reference the locale's currency (£/zł/$).
- Module must not recommend, endorse, or discourage crypto purchase. The Lesson is informational; the child decides.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `goal_keyword_crypto = true` OR `(child_age_tier = 'OAK' AND days_since_oak_entry >= 60 AND NOT module_unlocked('M20'))`*

**Keyword-triggered variant** *(when `goal_keyword_crypto = true`)*:

> *"Something in the orchard is making promises that don't match its seasons. Let's look at what it actually is."*

You've named a goal with a word that caught the orchard's attention: {matched_keyword}. Before you go further — let's make sure you know what you're planting.

**Default-fire variant** *(no keyword match, 60-day Oak-entry default)*:

> *"There's a corner of the modern orchard that doesn't follow the seasons — and everyone at your age will eventually be asked to plant something in it. Best to know the soil first."*

You haven't looked at it. That's fine. But cryptocurrency, meme coins, NFTs — whatever shape they take by the time you meet them — will show up in your feed, your friends' conversations, or a pitch from someone trying to make money from your attention. Today is the day we look at it properly, before anyone else does the looking for you.

---

### ACT 2 — LESSON

**What crypto actually is.**

A cryptocurrency is a digital asset whose ownership is recorded on a public ledger called a blockchain. There's no government backing it, no company guaranteeing its value, and no underlying business producing profits.

A "share" in a company represents a claim on that company's future earnings. A bond represents a loan that will be repaid with interest. A cryptocurrency represents... whatever the next person is willing to pay for it.

That last sentence is the whole lesson. Read it again.

---

**Why people buy it.**

Three reasons dominate:

1. **Belief in the technology.** Some crypto holders genuinely believe the underlying blockchain has long-term uses — decentralised finance, cross-border payments, identity verification. Some of this may prove true over decades.
2. **Speculation.** Many people buy because they think the price will go up and they can sell to someone else for more. This is a reasonable thing to do *if* you understand you're participating in a guessing game about other people's future behaviour.
3. **Fear of missing out.** A lot of crypto demand is driven by seeing others make money and not wanting to be left behind. This is where most of the harm happens.

None of these reasons are wrong on their own. But confusing them matters. If you buy because of reason 3 while telling yourself it's reason 1, you'll hold too long, sell at the wrong time, and lose money you couldn't afford to lose.

---

**The volatility asymmetry — the single most important thing on this page.**

If an asset drops 50%, how much does it have to rise to get back to where it was?

Most people say 50%.

The real answer is **100%**.

- You have £100. It drops 50% → you have £50.
- £50 needs to rise by 100% (double) to get back to £100.

This is called volatility asymmetry, and it's why volatile assets are harder to make money on than they look. A coin that swings between +50% and −50% every year doesn't break even. It slowly loses value, because the recoveries have to be bigger than the drops.

Most cryptocurrencies are far more volatile than this example. Drops of 70%, 80%, 90% have happened repeatedly. The required recoveries are 233%, 400%, 900% respectively.

---

**Who profits when you buy crypto.**

Always ask this question about any asset. For a share in a company, the answer is: you profit if the company does well. For a savings account, you profit along with the bank's lending activities.

For cryptocurrency, the answer is more specific:

- **The person selling to you** profits immediately — they get your money.
- **Earlier buyers** profit from rising prices, which your purchase helps drive.
- **Exchanges** profit from the transaction fee you pay.
- **Influencers promoting the coin** often profit from undisclosed payments from the coin's creators — or from holding the coin themselves and pumping its price.

Your profit, if any, comes later, and depends on another person buying from you at a higher price. This chain only holds if someone keeps buying.

When that chain breaks — as it has repeatedly in crypto history — the asset can go to zero in hours.

---

**Pump-and-dump, explained.**

This is the specific mechanism for the harm you most need to recognise:

1. A small group buys a cheap, obscure coin.
2. They use social media — paid influencers, forums, memes — to convince others the coin is about to "moon."
3. As new buyers rush in, the price rises, which *confirms the story* and draws in more buyers.
4. At a peak, the original group sells everything. The price collapses.
5. Late buyers lose nearly everything.

This pattern is not occasional. For small-cap coins and meme coins, it is the *default* outcome, not an exception. If you've seen a coin promoted heavily by influencers with large followings, the probability that you are the late buyer is very high.

---

**A word on NFTs.**

Non-fungible tokens claim to represent ownership of digital images, music, or other media. Same principles apply: the "ownership" is whatever the blockchain records; the value is whatever the next buyer pays. In the 2021–2022 NFT boom, many high-profile collections lost 95%+ of their peak value within two years. People who bought in late at hyped prices mostly did not recover.

---

### ACT 3 — LAB

**Numeracy check (required).**

1. **Volatility asymmetry.** You invest £100 in a coin. It drops 60%. What percentage rise do you need to get back to £100? ____________ %
2. **Volatility asymmetry again.** The same coin drops 80%. What percentage rise do you need? ____________ %
3. **Labor Equivalent.** At your current `chore_rate_median` of **£{chore_rate_median}**, how many chores would you need to complete to fund a £100 crypto purchase? ____________ chores. If that £100 dropped to £30 (a 70% drop), how many chores of work would you have effectively lost? ____________

---

**Influence Audit.**

In the last 30 days, can you name three sources that mentioned crypto to you? (Social media creator, friend, ad, YouTube video, article — anywhere.)

For each one, answer:

1. **Does this source have something to gain if I buy?** (Paid promotion, affiliate link, they hold the coin themselves?)
2. **Did they disclose if they did?** (Required by law in many places. Often ignored.)
3. **How confident were they?** Confidence is a sales signal, not a knowledge signal.

---

**The Promise Test.**

Write down the last cryptocurrency-related claim you've heard or seen, word for word if you can. Now answer:

1. **What exactly is being promised?** ("Price will rise," "Change the world," "New financial system.")
2. **Who would have to do what for that promise to come true?** (Other people buying. Institutions adopting. Governments allowing.)
3. **Is any of that under your control — or anyone's?**

The promise test is the single most effective defence. Most crypto pitches collapse when examined like this.

---

### ACT 4 — QUIZ

**Q1.** A cryptocurrency drops from £200 to £50 — a 75% loss. What percentage rise is needed to break even?

- A) 75%
- B) 150%
- C) 300%

*Correct: C. £50 must triple (+200%) to reach £150, and then rise another third (+33%) to reach £200. Total required rise = 300%. Volatility asymmetry gets worse the deeper the drop.*

---

**Q2.** Which of these is the MOST honest answer to "why does a cryptocurrency have value?"

- A) Because the blockchain technology is revolutionary
- B) Because whoever I sell it to is willing to pay what I ask
- C) Because governments have approved it

*Correct: B. A is an argument for future value (debatable). C is false for most cryptocurrencies. B is the mechanical, present-tense answer for why any given coin has a price today.*

---

**Q3.** A popular influencer with two million followers spends an entire video praising a new coin and saying "this is going to moon." What is the most likely situation?

- A) They genuinely believe it will rise and are sharing their research
- B) They are being paid or hold the coin themselves and benefit if their followers buy
- C) They have inside information unavailable to the public

*Correct: B. Paid promotion of crypto is an established industry. Even when disclosed (and it often isn't), the incentive to praise outweighs the incentive to warn. Assume B unless proven otherwise.*

---

### CLOSING LINE

> *"You didn't buy anything today. You built a filter for everything you'll be sold tomorrow. That's the whole lesson."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M20 — Cryptocurrency & Speculative Assets
**TRIGGER (keyword):** `goal_keyword_crypto = true`
**TRIGGER (default-fire):** `child_age_tier = 'OAK' AND days_since_oak_entry >= 60 AND NOT module_unlocked('M20')`
**HOOK (keyword):** *"Goal title contains crypto-category keyword: `{matched_keyword}`. Review asset class fundamentals before proceeding."*
**HOOK (default-fire):** *"Oak-tier account has reached 60 days without exposure to speculative asset class pedagogy. Proactive delivery required."*

---

### ACT 2 — LESSON

**Classification.**

Cryptocurrency is a **speculative asset class**. Distinguishing properties:

| Property | Equity (Share) | Bond | Cryptocurrency |
|---|---|---|---|
| Claim on future earnings | Yes | No (interest only) | No |
| Underlying entity obligation | Yes | Yes | No |
| Government/institutional backing | Partial | Usually | No |
| Volatility (10-yr stddev) | ~15–20% | ~5–10% | 60–120%+ |
| Historical drawdown | −50% (rare) | −10% (rare) | −80%+ (recurring) |

---

**Valuation mechanism.**

- Equities: `price ≈ discounted_future_earnings + market_sentiment`
- Bonds: `price ≈ face_value × (interest_rate_adjusted_factor)`
- Cryptocurrency: `price = next_buyer_willingness_to_pay`

The crypto valuation model has no internal cash-flow anchor. Price is purely a function of aggregate market sentiment.

---

**Volatility asymmetry (formal).**

Required recovery from a drawdown:

```
recovery_required = 1 / (1 − drawdown) − 1
```

| Drawdown | Required Recovery |
|---|---|
| 10% | 11.1% |
| 25% | 33.3% |
| 50% | 100% |
| 75% | 300% |
| 90% | 900% |
| 95% | 1900% |

Asymmetry is the core reason high-volatility assets underperform their arithmetic mean: geometric mean is strictly less than arithmetic mean for any non-constant series.

---

**Pump-and-dump mechanism (formal).**

1. Accumulation phase: insiders acquire large position at low price.
2. Distribution phase: insiders sell to retail buyers drawn in by social-media promotion.
3. Price peaks as new-buyer velocity slows.
4. Insiders complete exit; price collapses.
5. Late buyers hold assets at 80%+ drawdown.

For low-market-cap coins, this pattern is the *modal* outcome, not the exception. Base rate of retail-buyer loss in heavily-promoted small-cap crypto: >70% within 12 months.

---

**Influence economics.**

Major crypto promotion channels:
- Paid influencer partnerships (often undisclosed despite legal requirements)
- Insider holdings with incentive to promote
- Coordinated "raids" from Discord / Telegram groups
- Algorithmic amplification of engagement-optimised content (confident, emotional, urgent)

Disclosure requirements vary by jurisdiction. Enforcement is inconsistent. Assume any high-engagement crypto promotion is compensated in some way until proven otherwise.

---

### ACT 3 — LAB

**Numeracy check (required).**

1. Drawdown = 60%. Compute `recovery_required`. Answer: ____________ %
2. Drawdown = 80%. Compute `recovery_required`. Answer: ____________ %
3. Given `chore_rate_median = {chore_rate_median}`, compute `chores_required_to_fund_100_purchase = 100 / chore_rate_median` = ____________. Compute `chores_effectively_lost_on_70pct_drawdown = chores_required × 0.7` = ____________.

---

**Source audit task.**

Log three crypto mentions from the past 30 days. For each:

```json
{
  "source": "string",
  "claim": "string",
  "source_has_position_in_asset": true | false | unknown,
  "disclosed_position": true | false | not_applicable,
  "confidence_level": "low | medium | high",
  "actionable_information_content": "low | medium | high"
}
```

Compute the ratio: `sources_with_undisclosed_interest / total_sources`. Flag any asset where ratio > 0.33 as high-promotion-risk.

---

### ACT 4 — QUIZ

**Q1.** `drawdown = 0.75`. Compute `recovery_required`.

- [ ] 75%
- [ ] 150%
- [x] 300%

**Q2.** Primary determinant of cryptocurrency price today.

- [ ] Underlying blockchain utility
- [x] Aggregate buyer sentiment — no cash-flow anchor exists
- [ ] Central bank policy

**Q3.** Base-rate-optimal prior for a crypto promotion from a high-engagement social media source.

- [ ] Genuine belief in asset fundamentals
- [x] Compensated or position-holding — default assumption until disclosure proves otherwise
- [ ] Privileged information

---

### CLOSING LINE

*"Module complete. Speculative-asset classification framework loaded. Future promotion exposure should be filtered through the Source Audit schema."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M20",
  "title": "Cryptocurrency & Speculative Assets",
  "pillar": 5,
  "pillar_name": "Investing & Future",
  "level": 4,
  "level_name": "Oak",
  "age_range": "16+",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,
  "default_fire_enabled": true,

  "trigger_logic": {
    "event_type": "MULTI_PATH",
    "keyword_path": {
      "event_type": "GOAL_WRITE",
      "condition": "goal_keyword_crypto = true",
      "evaluation_timing": "on_goal_write"
    },
    "default_fire_path": {
      "event_type": "NIGHTLY_SWEEP",
      "condition": "child_age_tier = 'OAK' AND days_since_oak_entry >= 60 AND NOT module_unlocked('M20')",
      "evaluation_timing": "nightly_cron_0200_utc"
    },
    "null_safety": "days_since_oak_entry defaults to 0 if age_tier_changed_at is null; module will not fire via default-fire path until entry timestamp is recorded.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M20', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'OAK'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "child_age_tier",
      "days_since_oak_entry",
      "chore_rate_median",
      "current_balance"
    ],
    "datapoints_optional": [
      "goal_keyword_crypto",
      "active_goal_titles"
    ],
    "fallback_behaviour": "If goal_keyword_crypto is false at trigger time, Hook uses default-fire variant. If chore_rate_median is null, Labor Equivalent numeracy section uses regional fallback rate (see Dev Bible §Developer Notes)."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb_keyword": "Something in the orchard is making promises that don't match its seasons. Let's look at what it actually is.",
    "locale_en_gb_default_fire": "There's a corner of the modern orchard that doesn't follow the seasons — and everyone at your age will eventually be asked to plant something in it. Best to know the soil first.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "You didn't buy anything today. You built a filter for everything you'll be sold tomorrow. That's the whole lesson.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — dual-variant based on trigger path. Keyword-triggered variant names the matched keyword; default-fire variant opens with generic crypto exposure framing.",
    "act_2": "Lesson — classifies crypto as speculative asset, introduces volatility asymmetry and pump-and-dump mechanics. Includes Honest Framing opener.",
    "act_3": "Lab — required numeracy on volatility asymmetry and Labor Equivalent; Influence Audit and Promise Test exercises.",
    "act_4": "Quiz — 3 questions validating understanding of asymmetry, valuation, and promotion incentives."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M20_Q1",
        "stem": "75% drawdown requires what recovery to break even?",
        "correct_option": "C",
        "concept_tested": "volatility_asymmetry"
      },
      {
        "id": "M20_Q2",
        "stem": "Most honest answer to 'why does crypto have value?'",
        "correct_option": "B",
        "concept_tested": "valuation_mechanism"
      },
      {
        "id": "M20_Q3",
        "stem": "Default prior when a popular influencer praises a specific coin.",
        "correct_option": "B",
        "concept_tested": "influence_economics"
      }
    ]
  },

  "concepts_introduced": [
    "speculative_asset_class",
    "volatility_asymmetry",
    "pump_and_dump_mechanics",
    "influence_economics",
    "valuation_without_cashflow",
    "labor_equivalent_applied_to_speculation"
  ],

  "prerequisites": ["M18", "M19"],

  "unlocks": ["M27"],

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

- **Moat Type: Pedagogical Moat.** Most kids' finance apps either ignore crypto entirely or treat it as a legitimate investment. Morechard takes a position: crypto is a speculative asset dominated by manipulation, and the 16-year-old needs the critical framework before encountering it. This is the stance Jump$tart 2021 standards point toward without fully committing to.
- **Default-fire rationale:** The harm vector here is asymmetric. A child who never encounters crypto lost nothing by seeing this module. A child who encounters crypto without this module may lose meaningful money — or worse, their first experience with financial autonomy. The trade-off favours universal delivery at Oak tier.
- **Non-recommendation discipline:** The module must not recommend or discourage crypto purchase. It teaches classification, asymmetry, and promotion economics. The child decides. This is critical — moralising would invite parental backlash and also underestimates the intelligence of a 16-year-old.
- **The "read it again" sentence in Act 2** — *"A cryptocurrency represents whatever the next person is willing to pay for it"* — is the central load-bearing sentence. Every other lesson point flows from it. If translated, it must retain its directness.
- **Volatility asymmetry is the most durable takeaway.** The numeracy exercise is deliberately constructed so the child feels the asymmetry by computing it, not just reading about it. Most adults do not know this; a 16-year-old who does has a real advantage.
- **NFTs covered briefly but not as their own module.** The underlying mechanics are identical; a separate NFT module would dilute attention. If NFTs become structurally different in future (e.g., tokenised property deeds with legal force), consider a spin-off module in Phase 2+.
- **Regional localisation:** UK/US/PL all have active crypto markets with varying regulatory frameworks. Regional variants of this module need local regulatory context (FCA warnings in UK, SEC actions in US, KNF positions in PL) but the core mechanics translate directly.
- **Parent-visibility consideration:** This module may be the first time a parent sees the app teach something contentious. The Scouting Report must handle the parent-facing summary carefully — frame as "your child learned a critical-thinking framework for evaluating speculative assets," not "your child was taught about crypto." Framing matters; the content does not change.