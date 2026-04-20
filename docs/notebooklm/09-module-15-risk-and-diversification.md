# Module 15: Risk & Diversification
**Pillar 5 · Level 4 (Canopy) · Ages 16+**

> **V3 template.** This module teaches investment risk management — a concept that applies to financial instruments Morechard does not simulate. The **Sovereign Ledger Honest Framing opener** is required. This is Canopy tier: formal tone, PL uses Pan/Pani, content may reference adult financial decisions directly.

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `active_goals_count` — trigger condition (≥ 3 active goals simultaneously)
- `long_term_goal_exists` — trigger condition (at least one goal with target_date > 90 days)
- `goal_categories` — array of active goal categories; used in Hook to frame portfolio analogy
- `planning_horizon_max_days` — used in Lesson to connect saving horizon to investment horizon
- `current_balance` — used in Lab for portfolio allocation exercise
- `chore_rate_median` — used in Lab labor equivalent

**AI Mentor rendering rules:**
- Hook must reference the child's actual number of active goals and their diversity as a portfolio analogy.
- Lesson must not recommend specific investments or funds — teach the principle, not the product.
- Lab portfolio exercise must use the child's `current_balance` as the notional allocation amount.
- Honest Framing opener is mandatory before Act 2.
- At Canopy tier, language may be more formal and dense than Oak tier.

---

## SOVEREIGN LEDGER HONEST FRAMING

> *"This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."*

*(Delivered as a standalone block immediately before Act 2.)*

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `COUNT(goals WHERE child_id = ? AND status = 'active') >= 3 AND EXISTS (goal WHERE category = 'long-term' AND target_date − CURRENT_DATE > 90)`*

> *"Three seeds in three different soils — you're thinking like a strategist. Now let's examine what happens when one of those soils turns bad."*

You currently have **{active_goals_count}** active goals. Different things, different timelines, different categories.

That's not accidental — that's diversification, even if you didn't call it that. You've spread your intentions across multiple targets rather than betting everything on one.

The investment world does the same thing — deliberately, with money. And for the same reason: you don't know which soil will be poor this season. Spreading your seeds is protection against the harvest you can't predict.

---

### ACT 2 — LESSON

**What risk actually means in financial terms.**

Risk is not just "the chance of losing everything." It has a more precise definition: **risk is the variability of possible outcomes around an expected return.**

A government bond returning exactly 3% per year is low-risk: the outcome is predictable. A technology share that might return +40% or −30% is high-risk: outcomes vary widely. Both might have the same expected (average) return — but the spread of outcomes differs dramatically.

This is why two investments can look similar on average but feel very different in practice. High variance means you might be up or down significantly in any given year. Low variance means you know roughly what to expect.

---

**The risk-return trade-off.**

In broadly functioning markets, higher risk is compensated by higher expected return. This is not a guarantee — but it is the general principle that makes financial markets work.

Why? Because rational investors demand more return to accept more uncertainty. If a risky investment offered the same return as a safe one, nobody would take the risk. Prices adjust until the risky investment offers higher expected return — which attracts buyers willing to accept the uncertainty.

This means:

- **Safe assets** (government bonds, savings accounts) offer predictable, modest returns.
- **Risky assets** (equities, property, commodities) offer variable returns — potentially much higher, potentially negative.
- **The level of risk you take should match your time horizon.** If you need money in six months, you cannot afford high variance — a bad year would destroy your plan. If you won't need money for twenty years, short-term variance matters far less; you can wait out the downturns.

---

**Diversification — the only free lunch in investing.**

The financial economist Harry Markowitz called diversification "the only free lunch in investing." The reasoning is precise:

When two assets are not perfectly correlated — when one going down does not mean the other goes down by the same amount at the same time — combining them reduces overall portfolio variance without proportionally reducing expected return.

Example: you hold two assets. In good economic conditions, both rise. In poor conditions, Asset A falls (a cyclical business) but Asset B rises (a defensive business that people buy from regardless of the economy — food, utilities). The combination is less volatile than either alone.

This is why diversified funds — index funds that own hundreds or thousands of shares — have lower variance than any single share, while retaining a significant portion of the market's expected return.

---

**The limits of diversification.**

Diversification reduces **unsystematic risk** — risk specific to a single company or sector. It does not reduce **systematic risk** — risk that affects the whole market simultaneously.

In the 2008 financial crisis, almost all asset classes fell together. In the 2020 pandemic crash, broadly similar. A diversified portfolio of equities still fell 30–40% in both cases. Diversification reduced the damage compared to single-stock holding, but did not eliminate market-wide losses.

To reduce systematic risk, you need:
- Different asset classes (equities, bonds, property, commodities, cash)
- Different geographies
- Different time horizons (some assets maturing when you might need the money)

Full portfolio diversification is complex. The practical starting point for most individuals: a low-cost global index fund, which provides instant diversification across thousands of companies in dozens of countries.

---

**Your goals as a proto-portfolio.**

Your three active goals represent different categories, different timelines, and different levels of certainty. That's a portfolio instinct — even if it's savings rather than investments.

When you move from saving to investing, the same instinct applies. Don't concentrate everything in one asset, one sector, or one geography. Spread the seeds.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**. Imagine allocating it across a simple three-asset portfolio:

| Asset | Allocation % | Amount | Expected annual return | Variance (low/med/high) |
|---|---|---|---|---|
| Cash savings | 30% | ____________ | 4% | Low |
| Global equity index fund | 50% | ____________ | 7% (long-run estimate) | High |
| Government bonds | 20% | ____________ | 3% | Very low |

1. Amount in each asset: ____________, ____________, ____________
2. Weighted average expected return: (30% × 4%) + (50% × 7%) + (20% × 3%) = ____________ %
3. If equities fell 30% in year 1, how much would that asset lose in value? ____________
4. What would the portfolio's total loss be (assuming cash and bonds held steady)? ____________ (vs. ____________ if 100% in equities)
5. In chores at **£{chore_rate_median}**: how many chores' worth of loss was avoided by diversification? ____________

---

**Risk-horizon matching.**

For each goal, identify the appropriate risk level:

| Goal | Time horizon | Appropriate risk level | Rationale |
|---|---|---|---|
| Emergency fund | 0–3 months | ____________ | ____________ |
| Holiday in 1 year | ~12 months | ____________ | ____________ |
| University fees in 3 years | ~36 months | ____________ | ____________ |
| Retirement at 65 | 40–50 years | ____________ | ____________ |

---

**Portfolio correlation exercise.**

Consider two pairs of assets:

Pair A: Two technology companies (both rise and fall with tech sentiment).
Pair B: A technology company and a supermarket chain (different economic sensitivities).

1. Which pair is more correlated? ____________
2. Which pair provides better diversification? ____________
3. If you could only own two assets, which pair would you choose and why? ____________

---

**Reflection.**

1. Your **{active_goals_count}** active goals span different categories and timelines. How does this mirror investment diversification?
2. What systematic risk would affect all your goals simultaneously? (Think: economic recession, job loss in your household, major unexpected expense.)
3. How would you defend against that systematic risk?

**Bonus challenge:** Look up the historical annual return of the FTSE All-World Index over the past 20 years. How many of those years were negative? How did the portfolio recover in subsequent years? What does this tell you about the relationship between time horizon and variance tolerance?

---

### ACT 4 — QUIZ

**Q1.** What is the precise financial definition of risk?

- A) The chance of losing all your money
- B) The variability of possible outcomes around an expected return — how widely results might spread
- C) Any investment in something that could fall in price

*Correct: B. Risk = variance of outcomes. A high-variance asset can produce much better or much worse results than expected; a low-variance asset stays close to its expected return.*

---

**Q2.** You hold a single share in one company. If you replace it with an index fund owning 3,000 companies, which risk is reduced?

- A) Systematic risk — the risk of the whole market falling
- B) Unsystematic risk — the risk specific to a single company's performance
- C) Both systematic and unsystematic risk equally

*Correct: B. Diversification eliminates unsystematic (company-specific) risk. If one company fails, 2,999 others continue. Systematic risk (whole-market downturns) persists.*

---

**Q3.** You need money in 6 months for a planned expense. What level of investment risk is appropriate?

- A) High — more time means you can recover from downturns
- B) Low — short time horizon means you cannot afford high variance; a bad 6 months could eliminate the money you need
- C) Medium — balance risk and return regardless of horizon

*Correct: B. Time horizon is the primary driver of appropriate risk level. Short horizon = low variance. If the investment falls 30% in month 4, you cannot wait for recovery.*

---

### CLOSING LINE

> *"Three soils, three seasons, three harvest possibilities. The strategist doesn't bet everything on one. Neither should your future self."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M15 — Risk & Diversification
**TRIGGER:** `COUNT(goals WHERE status = 'active') >= 3 AND EXISTS (goal WHERE target_date − CURRENT_DATE > 90)`
**HOOK:** *"3+ active goals detected. Long-term goal present. Portfolio risk management mechanics apply."*

---

### ACT 2 — LESSON

**Risk definition (formal).**

```
risk = variance(return_distribution)
     = E[(return − expected_return)^2]
```

High variance = outcomes spread widely above and below expected return.
Low variance = outcomes cluster near expected return.

Risk ≠ probability of loss. Risk = magnitude of outcome uncertainty.

---

**Risk-return relationship.**

In efficient markets:
```
expected_return ∝ risk_premium
risk_premium = compensation for bearing variance
```

Higher variance assets must offer higher expected return to attract rational investors. This relationship is captured in the Capital Asset Pricing Model (CAPM):

```
expected_return = risk_free_rate + beta × market_risk_premium
```

where `beta` = asset's covariance with market / market variance.

---

**Diversification mechanics.**

Portfolio variance for two assets:
```
portfolio_variance = w1² × σ1² + w2² × σ2² + 2 × w1 × w2 × ρ12 × σ1 × σ2
```

Where:
- `w1, w2` = portfolio weights
- `σ1, σ2` = individual asset standard deviations
- `ρ12` = correlation coefficient between assets (−1 to +1)

Key insight: when `ρ12 < 1`, `portfolio_variance < weighted_average(σ1², σ2²)`. Diversification reduces variance below the weighted average of individual variances — without proportionally reducing expected return.

When `ρ12 = 1` (perfect correlation): no diversification benefit.
When `ρ12 = −1` (perfect negative correlation): theoretical perfect hedge.

---

**Systematic vs. unsystematic risk.**

```
total_risk = systematic_risk + unsystematic_risk

unsystematic_risk → 0 as portfolio_size → ∞
systematic_risk = irreducible via diversification
```

Systematic risk reducers: multi-asset-class allocation, geographic diversification, time diversification (holding through multiple market cycles).

---

**Time horizon and risk tolerance.**

```
appropriate_risk = f(time_to_required_liquidity)
```

Short horizon (< 1yr): low variance required — cannot afford drawdown followed by recovery period.
Long horizon (20yr+): high variance tolerable — recovery probability approaches certainty over sufficient time.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `current_balance = {current_balance}`, `chore_rate_median = {chore_rate_median}`:

Portfolio allocation:

1. `cash_savings = current_balance × 0.30` = ____________
2. `equity_index = current_balance × 0.50` = ____________
3. `gov_bonds = current_balance × 0.20` = ____________
4. `weighted_avg_return = (0.30 × 0.04) + (0.50 × 0.07) + (0.20 × 0.03)` = ____________ %
5. `equity_loss_at_30pct_drawdown = equity_index × 0.30` = ____________
6. `portfolio_loss = equity_loss_at_30pct_drawdown` (cash and bonds held) = ____________
7. `portfolio_loss_if_100pct_equity = current_balance × 0.30` = ____________
8. `diversification_saving = (7) − (6)` = ____________
9. `chores_equivalent = diversification_saving / chore_rate_median` = ____________

---

**Risk-horizon matrix.**

```json
{
  "goals": [
    {
      "name": "string",
      "horizon_months": number,
      "appropriate_risk": "very_low | low | medium | high",
      "rationale": "string"
    }
  ]
}
```

Complete for: emergency fund, 1-year goal, 3-year goal, retirement.

---

**Correlation analysis.**

```json
{
  "pair_a": {
    "assets": ["tech company A", "tech company B"],
    "estimated_correlation": "high (0.8+)",
    "diversification_benefit": "low"
  },
  "pair_b": {
    "assets": ["tech company", "supermarket chain"],
    "estimated_correlation": "medium (0.3–0.5)",
    "diversification_benefit": "medium-high"
  },
  "preferred_pair": "B",
  "reasoning": "string"
}
```

---

### ACT 4 — QUIZ

**Q1.** Formal definition of financial risk:

- [ ] Probability of total loss
- [x] Variance of return distribution — spread of possible outcomes around expected return
- [ ] Any asset that could decline in price

**Q2.** Single share → index fund of 3,000 companies. Which risk is reduced?

- [ ] Systematic risk
- [x] Unsystematic (company-specific) risk
- [ ] Both equally

**Q3.** 6-month time horizon — appropriate risk level:

- [ ] High — more upside
- [x] Low — insufficient time to recover from drawdown before required liquidity
- [ ] Medium regardless of horizon

---

### CLOSING LINE

*"Module complete. `portfolio_variance = f(weights, individual_variances, correlations)` loaded. Risk-horizon matching principle: `appropriate_risk ∝ time_to_required_liquidity`. Apply at first investment decision."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M15",
  "title": "Risk & Diversification",
  "pillar": 5,
  "pillar_name": "Investing & Future",
  "level": 4,
  "level_name": "Canopy",
  "age_range": "16+",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": true,

  "trigger_logic": {
    "event_type": "GOAL_WRITE",
    "condition": "COUNT(goals WHERE child_id = ? AND status = 'active') >= 3 AND EXISTS (SELECT 1 FROM goals WHERE child_id = :child_id AND category = 'long-term' AND target_date - CURRENT_DATE > 90)",
    "evaluation_timing": "on_goal_write",
    "null_safety": "If goals table has no records for child_id, COUNT returns 0; condition evaluates false.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M15', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'CANOPY'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "active_goals_count",
      "long_term_goal_exists",
      "current_balance",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "goal_categories",
      "planning_horizon_max_days"
    ],
    "fallback_behaviour": "If current_balance < 10, Lab uses £10 as allocation floor. If chore_rate_median is null, use regional fallback rate. If goal_categories is null, Hook uses generic 'multiple goals' framing."
  },

  "honest_framing": {
    "required": true,
    "placement": "before_act_2_lesson",
    "text_en_gb": "This lesson is about something Morechard doesn't do. Yet. Morechard tracks what you've earned — but the world has tools that do more. One day you'll use them. This is what you'll need to know when you do."
  },

  "mentor_hook": {
    "locale_en_gb": "Three seeds in three different soils — you're thinking like a strategist. Now let's examine what happens when one of those soils turns bad.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "Three soils, three seasons, three harvest possibilities. The strategist doesn't bet everything on one. Neither should your future self.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references child's active goal count and diversity as a portfolio analogy.",
    "act_2": "Lesson — risk defined formally as variance, risk-return trade-off, diversification mechanics (Markowitz), systematic vs. unsystematic risk, time horizon matching.",
    "act_3": "Lab — required numeracy on three-asset portfolio allocation, weighted return, diversification saving in drawdown, risk-horizon matrix, correlation analysis.",
    "act_4": "Quiz — 3 questions on risk definition, diversification scope, and time-horizon risk matching."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M15_Q1",
        "stem": "Precise financial definition of risk.",
        "correct_option": "B",
        "concept_tested": "risk_as_variance"
      },
      {
        "id": "M15_Q2",
        "stem": "Single share to index fund — which risk is reduced.",
        "correct_option": "B",
        "concept_tested": "systematic_vs_unsystematic_risk"
      },
      {
        "id": "M15_Q3",
        "stem": "6-month horizon — appropriate risk level.",
        "correct_option": "B",
        "concept_tested": "risk_horizon_matching"
      }
    ]
  },

  "concepts_introduced": [
    "risk_as_variance",
    "risk_return_tradeoff",
    "diversification",
    "portfolio_variance",
    "correlation",
    "systematic_risk",
    "unsystematic_risk",
    "time_horizon_matching",
    "index_fund",
    "markowitz_free_lunch"
  ],

  "prerequisites": ["M13", "M9"],

  "unlocks": ["M20"],

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

- **Moat Type: Pedagogical Moat.** No comparable kids' finance app teaches portfolio variance, correlation, or the systematic/unsystematic risk distinction. Jump$tart standards reference "investment risk" generally but don't reach Markowitz-level mechanics. This is genuinely advanced content for 16-year-olds — and appropriate for the Canopy tier.
- **Trigger rationale:** Three active goals with at least one long-term goal signals the child is thinking in multiple timelines simultaneously — the structural analogy to portfolio management. The trigger fires when the behaviour demonstrates portfolio instinct, then names what that instinct is.
- **Markowitz attribution:** "The only free lunch in investing" is correctly attributed to Harry Markowitz (1952 portfolio selection paper). Including the attribution is optional in Orchard persona but signals that this is real economics, not simplified folk wisdom.
- **CAPM inclusion (Clean persona):** The Capital Asset Pricing Model is introduced in the Clean persona without full derivation. At Canopy tier (16+), a motivated student can encounter CAPM in A-level Economics or IB Business & Management. Mentioning it gives them a foothold.
- **Non-recommendation discipline:** The Lesson names "low-cost global index fund" as the practical starting point but does not name specific products (Vanguard, iShares, etc.). Product recommendations require FCA authorisation in the UK; the module is educational, not advisory.
- **Bonus challenge:** The FTSE All-World historical return exercise requires internet access (not Morechard data). It is an optional extension that rewards motivated Canopy-tier children. The key insight: even with multiple negative years, long-horizon investors consistently recovered. This is the empirical basis for time-horizon-based risk tolerance.
- **Household neutrality:** Reflection Q3 uses "your household" not "your family" — consistent with spec.
