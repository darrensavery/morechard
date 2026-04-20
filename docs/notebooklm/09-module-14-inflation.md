# Module 14: Inflation
**Pillar 5 · Level 2 (Sapling) · Ages 10–12**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `days_since_last_transaction` — primary trigger condition (≥ 21 days)
- `current_balance` — Hook personalisation and Lab numeracy (the idle pile)
- `balance_21d_ago` — used to confirm balance has been genuinely static
- `chore_rate_median` — used in Lab purchasing power calculation
- `family_region` — determines which inflation rate example to use (UK CPI / US CPI / PL CPI)

**AI Mentor rendering rules:**
- Hook must reference how many days the balance has been sitting still and the current balance amount.
- Lab must use the child's actual `current_balance` as the principal for purchasing power loss calculation.
- Lesson must use the child's regional currency and an accurate recent inflation rate (from `family_region` lookup; default UK CPI).
- Do not imply inflation is always catastrophic — frame as a slow background force that requires awareness.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `days_since_last_transaction >= 21`*

> *"Your seeds are sitting still. That's fine for rocks — but money has a slow rot. Here's what's quietly happening to your pile."*

Your balance has been **£{current_balance}** for **{days_since_last_transaction}** days without moving. Nothing's been added, nothing's been spent.

It looks the same. But here's the thing: it isn't quite the same.

There's a quiet force at work on every pile of money that sits still — and on every pile of money that grows slowly, too. It's called inflation. It's not loud or dramatic. It's more like a very slow leak — and most people don't notice it until they try to buy something they could have bought cheaper a few years ago.

Let's look at how it works.

---

### ACT 2 — LESSON

**What inflation is.**

Inflation is the general rise in prices over time. When inflation is 3%, things that cost £100 this year will cost roughly £103 next year. Not every item — prices don't all move exactly together — but on average, across the economy.

Inflation is measured by tracking a "basket" of goods and services that households typically buy: food, housing, transport, clothing, energy. When that basket gets more expensive, inflation is rising.

In the UK, this is measured by the Consumer Price Index (CPI). In the US, also CPI. Most countries have equivalent measures.

---

**Why money sitting still loses value.**

Imagine you have £100 today. Inflation is 4% this year.

Next year, £100 buys what £96.15 would buy today. Your money hasn't shrunk in number — the number is still £100. But its purchasing power has fallen. You can buy slightly less with it.

The jar-under-the-floorboards problem from M8 is the extreme version: money buried and untouched for ten years at 4% inflation is worth only about 67% of its original purchasing power. The money shrank while sitting still.

This is why "just saving" is not enough on its own — it matters where and how the money is held.

---

**What causes inflation.**

Three main causes, simplified:

**1. Demand-pull.** When people have more money to spend, they buy more. When buyers chase the same amount of goods, sellers raise prices. More money chasing the same stuff = higher prices.

**2. Cost-push.** When it costs more to make things (energy, materials, wages), producers raise prices to maintain margins. Energy price spikes cause this — when oil gets expensive, almost everything made, transported, or heated gets more expensive too.

**3. Expectations.** This is the strangest one: if workers and businesses expect prices to rise, they act in ways that cause prices to rise. Workers demand higher wages "before inflation hits"; businesses raise prices "because costs will go up." The expectation becomes self-fulfilling.

---

**The defence: real returns.**

The way to combat inflation is to earn a return on your money that exceeds the inflation rate. This is called a **real return**.

```
real_return = savings_rate − inflation_rate
```

- Savings account at 5%, inflation at 3%: real return = +2% (you're beating inflation)
- Cash under the mattress, inflation at 4%: real return = −4% (inflation is eating your purchasing power)
- Savings account at 2%, inflation at 4%: real return = −2% (even saving loses purchasing power)

Inside Morechard, your balance grows only when you earn chores. Outside Morechard, in a savings account or investment, your money can earn a return that fights inflation.

---

**Why a little inflation is considered normal.**

Zero inflation sounds ideal — prices staying the same. But economists generally prefer a low, stable inflation rate (around 2% in the UK and US) because:

- Mild inflation encourages spending now rather than waiting (good for economic activity)
- Mild inflation makes it easier for wages to adjust upward
- Zero or negative inflation (deflation) can be more damaging — people delay spending, waiting for lower prices, which reduces demand, which reduces production, which reduces jobs

The Bank of England's target is 2% CPI. The Federal Reserve's is 2% PCE. A little inflation is the target, not a problem.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your current balance is **£{current_balance}**. It's been sitting still for **{days_since_last_transaction}** days.

Using UK CPI inflation at approximately 3% per year:

1. Purchasing power after 1 year of 3% inflation: £{current_balance} ÷ 1.03 = ____________ (this is what your balance is effectively worth in today's prices)
2. Purchasing power loss after 1 year: £{current_balance} − (1) = ____________
3. At your chore rate of **£{chore_rate_median}**, how many chores' worth of purchasing power has been lost in one year of 3% inflation? ____________
4. After 5 years at 3% inflation with no returns earned: value = £{current_balance} × (1 ÷ 1.03^5) ≈ £{current_balance} × 0.863 = ____________
5. Purchasing power lost after 5 years: ____________

---

**Real return comparison.**

| Scenario | Nominal rate | Inflation | Real return | After 1 yr on £{current_balance} |
|---|---|---|---|---|
| Cash at home | 0% | 3% | −3% | ____________ |
| Bank account | 2% | 3% | −1% | ____________ |
| Good savings account | 5% | 3% | +2% | ____________ |
| Inflation-beating investment (est.) | 7% | 3% | +4% | ____________ |

Which scenario preserves or grows your purchasing power? ____________

---

**What costs more now than it used to.**

Ask a parent you're with to name one thing they bought regularly ten years ago that costs noticeably more today. What is it? How much did it cost then vs. now?

Then calculate the approximate inflation rate implied by that price change:
- Price then: ____________
- Price now: ____________
- Total % increase: ____________
- Average annual rate: ____________ (roughly: total % ÷ number of years)

---

**Reflection.**

1. Your balance has been still for {days_since_last_transaction} days. In that time, has it lost purchasing power in real terms? ____________
2. What would you need your savings rate to be in order to stay ahead of 3% inflation? ____________
3. What's one thing you could do with idle money to make it work harder than sitting still?

---

### ACT 4 — QUIZ

**Q1.** You have £200 in cash under your bed. Inflation is 4%. After one year, how much can you buy with that £200?

- A) More — £200 is still £200
- B) The same — prices haven't changed for your specific purchases
- C) Less — the purchasing power of £200 has fallen by approximately 4%, to the equivalent of about £192 in today's money

*Correct: C. The number hasn't changed, but purchasing power has. £200 buys roughly what £192 bought a year earlier.*

---

**Q2.** A savings account pays 2% annual interest. Inflation is 3%. What is the real return?

- A) +2% — you're earning interest
- B) −1% — your savings are growing slower than prices, so purchasing power is falling
- C) 0% — the two rates cancel out

*Correct: B. Real return = savings rate − inflation rate = 2% − 3% = −1%. Even though the balance number grows, purchasing power falls.*

---

**Q3.** Why do economists generally prefer a small amount of inflation (around 2%) rather than zero?

- A) Governments benefit from inflation because it reduces the real value of their debts
- B) Mild inflation encourages spending and economic activity; zero or negative inflation (deflation) can cause spending to freeze as people wait for lower prices
- C) Banks need inflation to profit from savings accounts

*Correct: B. The economic harm of deflation (frozen spending, reduced demand, rising unemployment) is generally considered worse than mild, stable inflation. 2% is the standard central bank target.*

---

### CLOSING LINE

> *"The rot is slow. Now you know to check the pile — and to keep it working harder than sitting still."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M14 — Inflation
**TRIGGER:** `days_since_last_transaction >= 21`
**HOOK:** *"21+ days without ledger activity. Balance: £{current_balance} — static. Inflation mechanics reduce purchasing power of idle balances. Review."*

---

### ACT 2 — LESSON

**Inflation definition.**

Inflation = sustained general increase in price level across an economy, measured via price indices (UK: CPI; US: CPI/PCE; PL: GUS CPI).

```
real_value_t = nominal_value / (1 + inflation_rate)^t
purchasing_power_loss = nominal_value − real_value_t
```

Static nominal balances decline in real value at the inflation rate per period.

---

**Causes (simplified).**

| Cause | Mechanism |
|---|---|
| Demand-pull | Excess aggregate demand → price competition among buyers |
| Cost-push | Input cost increases → producer price increases |
| Expectations | Anticipated inflation → wage/price pre-increases → realised inflation |

---

**Real return formula.**

```
real_return = nominal_return − inflation_rate
```

Positive real return: purchasing power grows.
Zero real return: purchasing power maintained.
Negative real return: purchasing power erodes despite positive nominal return.

**Implication for idle cash:** `nominal_return = 0%`, `real_return = −inflation_rate`. Idle cash always loses real value in inflationary environments.

---

**Central bank targets.**

Bank of England: 2% CPI target. US Federal Reserve: 2% PCE target. Both prefer low, stable inflation over zero or negative (deflationary) conditions. Deflation → deferred spending → reduced demand → recession risk.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `current_balance = {current_balance}`, `inflation_rate = 0.03`, `chore_rate_median = {chore_rate_median}`:

1. `real_value_1yr = current_balance / 1.03` = ____________
2. `purchasing_power_loss_1yr = current_balance − real_value_1yr` = ____________
3. `chores_lost_to_inflation = purchasing_power_loss_1yr / chore_rate_median` = ____________
4. `real_value_5yr = current_balance × (1 / 1.03^5) ≈ current_balance × 0.863` = ____________
5. `purchasing_power_loss_5yr = current_balance − real_value_5yr` = ____________

---

**Real return table.**

For each scenario with `principal = current_balance`:

```json
{
  "scenario": "string",
  "nominal_rate": number,
  "inflation_rate": 0.03,
  "real_return": "nominal_rate − 0.03",
  "balance_after_1yr": "principal × (1 + nominal_rate)",
  "real_value_after_1yr": "balance_after_1yr / 1.03",
  "net_purchasing_power_change": "real_value_after_1yr − principal"
}
```

Run for: cash (0%), bank account (2%), savings account (5%), investment estimate (7%).

---

### ACT 4 — QUIZ

**Q1.** £200 cash, 4% inflation, 1 year. Real purchasing power remaining:

- [ ] £200 — nominal value unchanged
- [ ] £204 — inflation increases value
- [x] ~£192 — `200 / 1.04 ≈ 192.31`; purchasing power has fallen

**Q2.** `nominal_return = 2%`, `inflation = 3%`. Real return:

- [ ] +2%
- [x] −1% — `real_return = 2% − 3% = −1%`
- [ ] 0%

**Q3.** Economists prefer ~2% inflation over 0% because:

- [ ] Governments benefit from inflated debt values
- [x] Deflation causes spending freezes and recession risk; mild inflation maintains economic momentum
- [ ] Banks need inflation for savings product profitability

---

### CLOSING LINE

*"Module complete. `real_return = nominal_return − inflation_rate` loaded. Idle balances generate negative real returns in inflationary environments. Action: move to interest-bearing account."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M14",
  "title": "Inflation",
  "pillar": 5,
  "pillar_name": "Investing & Future",
  "level": 2,
  "level_name": "Sapling",
  "age_range": "10-12",
  "launch_status": "Launch",
  "moat_type": "parity_plus_live_data",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "NIGHTLY_SWEEP",
    "condition": "days_since_last_transaction >= 21",
    "evaluation_timing": "nightly_cron_0200_utc",
    "null_safety": "If last_transaction_date is null (no transactions yet), days_since_last_transaction is undefined; module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M14', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'SAPLING'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "days_since_last_transaction",
      "current_balance",
      "family_region"
    ],
    "datapoints_optional": [
      "balance_21d_ago",
      "chore_rate_median"
    ],
    "fallback_behaviour": "If current_balance is null, Hook omits balance reference. If chore_rate_median is null, Lab step 3 uses regional fallback rate. If family_region is null, use UK CPI (3%) as default inflation example."
  },

  "mentor_hook": {
    "locale_en_gb": "Your seeds are sitting still. That's fine for rocks — but money has a slow rot. Here's what's quietly happening to your pile.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The rot is slow. Now you know to check the pile — and to keep it working harder than sitting still.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — references the specific number of idle days and current balance. Frames inflation as slow and quiet, not dramatic.",
    "act_2": "Lesson — inflation defined, three causes explained, real return formula introduced, why mild inflation is the target.",
    "act_3": "Lab — required numeracy computing purchasing power loss over 1 and 5 years on current_balance. Real return comparison table. Historical price exercise with parent.",
    "act_4": "Quiz — 3 questions on purchasing power loss, real return calculation, and deflation risk."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M14_Q1",
        "stem": "£200 cash, 4% inflation — purchasing power after 1 year.",
        "correct_option": "C",
        "concept_tested": "purchasing_power_loss"
      },
      {
        "id": "M14_Q2",
        "stem": "2% nominal return, 3% inflation — real return.",
        "correct_option": "B",
        "concept_tested": "real_return_calculation"
      },
      {
        "id": "M14_Q3",
        "stem": "Why economists prefer ~2% inflation over zero.",
        "correct_option": "B",
        "concept_tested": "deflation_risk"
      }
    ]
  },

  "concepts_introduced": [
    "inflation",
    "consumer_price_index",
    "purchasing_power",
    "real_return",
    "demand_pull_inflation",
    "cost_push_inflation",
    "inflation_expectations",
    "deflation_risk",
    "central_bank_target"
  ],

  "prerequisites": ["M8"],

  "unlocks": ["M15", "M13"],

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

- **Moat Type: Parity + Live Data.** Inflation is covered in most curricula. Morechard's advance: the trigger fires on 21 days of inactivity, using the child's own idle balance as the principal for purchasing power loss calculations — making the abstract concept immediately and personally tangible.
- **Trigger rationale:** 21 days of inactivity is a deliberate threshold — long enough to be a genuine pattern, short enough that the child can still easily remember when they last engaged with the app. The module fires at the moment the "sitting still" behaviour is measurable.
- **Deflation section:** Including deflation at Sapling tier (10–12) is a deliberate choice. The explanation that "zero inflation sounds good but can be harmful" is counterintuitive and memorable — and prevents the misconception that lower prices are always better.
- **Real return formula:** `real_return = nominal_return − inflation_rate` is the key takeaway. It is simple enough for 10–12 year olds and precise enough to be genuinely useful. The Lab table reinforces it across four scenarios.
- **Historical price exercise:** Asking a parent to name something that costs more than it did ten years ago is the most effective way to make inflation tangible at this age. Almost every adult has an immediate example.
- **Household neutrality:** Parent reference uses "a parent you're with" in the Lab exercise.
- **Regional inflation rates:** UK uses ~3% CPI (2024/25 approximate). US CPI varies — use 3.5% for current exercises if family_region = US. PL has had higher recent inflation — use 5% for PL if family_region = PL. Flag for content localisation.
