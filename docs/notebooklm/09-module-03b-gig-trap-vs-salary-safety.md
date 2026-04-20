# Module 3b: Gig Trap vs. Salary Safety
**Pillar 1 · Level 4 (Canopy) · Ages 16+**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `weekly_earnings_last_4` — array of four weekly totals; primary trigger data
- `weekly_earnings_variance_pct` — computed as STDDEV/AVG; trigger condition
- `chore_rate_median` — used in Lab as stable-income comparator
- `lifetime_earnings` — Hook personalisation
- `avg_chore_value` — used to contrast against high-variance weeks

**AI Mentor rendering rules:**
- Hook must reference the observed earnings pattern — name the best week and worst week from `weekly_earnings_last_4`.
- Lab must use the child's own `weekly_earnings_last_4` array in the variance calculation.
- Lesson must not advise the child to prefer salary over gig work — present the trade-off honestly and let them evaluate.
- If `weekly_earnings_variance_pct` returns null (insufficient data), module does not fire.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `STDDEV(weekly_earnings WHERE child_id = ? AND week IN last_4_weeks) / AVG(weekly_earnings) > 0.40`*

> *"Some weeks a feast, some weeks bare branches — your earnings are swinging. That pattern has a name, and it's worth knowing before you build a life around it."*

Look at your last four weeks: **£{week_1}**, **£{week_2}**, **£{week_3}**, **£{week_4}**. The gap between your best week and your worst is **£{week_max − week_min}**.

That swing is normal in a chore-based system — some weeks have more available. But in the wider world, income volatility like that is a structural choice, not just a scheduling quirk. Some people live this way deliberately. Others end up trapped in it without realising there was a choice.

This lesson is about making that choice consciously.

---

### ACT 2 — LESSON

**The spectrum of income stability.**

On one end: a salaried job. You agree to work defined hours for a fixed monthly amount. The money arrives on the same day every month, regardless of whether it was a busy month or a quiet one for your employer.

On the other end: gig work. You get paid per delivery, per task, per project. A busy week pays well. A slow week, a sick week, or a week the platform has fewer orders — pays little or nothing.

Between them: freelancing with recurring clients (predictable but not guaranteed), part-time employment (some stability, capped earning potential), zero-hours contracts (employment with no guaranteed hours).

Each position on that spectrum has trade-offs. None is objectively better.

---

**What stability buys you.**

A salary provides:

- **Predictability** — you can plan monthly expenses without guessing. Rent, direct debits, savings commitments can be sized accurately.
- **Access to credit** — banks and landlords check income stability. A salaried employee with moderate pay often gets better credit terms than a gig worker with higher average pay. Lenders price uncertainty.
- **Employment rights** — sick pay, holiday pay, pension contributions (in the UK, employer pension contributions of 3%+ are mandatory for employees), parental leave.
- **Career infrastructure** — colleagues, mentors, training, progression.

The cost: you cap your upside. You cannot earn significantly more in a strong month, because the contract defines the ceiling.

---

**What volatility buys you.**

Gig and freelance models offer:

- **Income ceiling removal** — a great month can pay twice or three times a bad month. There is no structural upper limit imposed by a contract.
- **Autonomy** — choose which jobs to take, when to work, which clients to keep.
- **Skill portability** — clients pay for specific output; skills developed transfer anywhere.

The cost: the income floor disappears. In a bad month — illness, platform changes, slow market — income can drop to near zero while fixed expenses (rent, food, phone) remain constant. This mismatch is the gig trap.

---

**The gig trap (specific mechanism).**

The gig trap is not "gig work is bad." It is this specific sequence:

1. You take on gig work expecting variable-but-generally-fine income.
2. You set your fixed expenses (rent, subscriptions, loan repayments) based on your average income, not your worst month.
3. A bad month comes — illness, market downturn, platform fee increase.
4. Fixed expenses cannot be cut quickly. You cannot un-sign a lease or cancel a loan in a bad week.
5. You borrow (credit card, overdraft) to cover the gap.
6. Interest charges on that debt reduce your effective earnings in future good months.
7. The next bad month repeats the cycle with a larger debt base.

The trap is not the volatility itself — it's the mismatch between variable income and fixed expenses.

---

**The defence: build a buffer, size expenses to your floor.**

Two rules that break the trap:

1. **Size expenses to your floor, not your average.** If your worst month this year was £800, your fixed monthly commitments must be below £800. The good months rebuild the buffer; the bad months don't collapse you.

2. **Maintain a volatility buffer.** Three months of fixed expenses saved before committing to gig-only income. This buffer is the structural function that the salary performs mechanically for an employee.

Both rules require a clear number: your income floor. That requires tracking, which is what Morechard does.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your last four weekly earnings were: £{week_1}, £{week_2}, £{week_3}, £{week_4}.

1. Average weekly earnings = (£{week_1} + £{week_2} + £{week_3} + £{week_4}) / 4 = ____________
2. Your floor (worst week) = ____________
3. Floor as % of average = ____________ %
4. Variance (STDDEV / average) = ____________ % (this was above 40%, which triggered this module)
5. If you set monthly expenses at 80% of average, could your worst week cover 25% of those monthly expenses? ____________

---

**Expense sizing exercise.**

Write down three fixed monthly expenses you would expect to have at age 20 (estimate):

| Expense | Monthly Cost | Can it be cut quickly in a crisis? |
|---|---|---|
| Rent / share of rent | £ | No |
| Phone | £ | With 30-day notice |
| Other | £ | ? |

**Total fixed expenses:** £____________

**Your income floor (worst month estimate from above):** £____________

**Gap (floor minus fixed expenses):** £____________ — Is this positive or negative?

If negative: how many months of buffer would you need before taking on full-time gig work? ____________

---

**Reflection.**

1. Name one type of work you'd be interested in that is typically salaried. What does the predictability buy you that gig work wouldn't?
2. Name one type of work that is typically gig or freelance. What does the ceiling removal buy you that a salary wouldn't?
3. Given your current earnings pattern (variance **{weekly_earnings_variance_pct}%**), which model fits you better right now — and why?

---

### ACT 4 — QUIZ

**Q1.** A gig worker earns an average of £2,000/month over the year, with a worst month of £400. They have fixed monthly expenses of £1,600. What is the immediate risk?

- A) The average is fine — month-to-month variation is normal
- B) Fixed expenses are set at the average, not the floor — a bad month creates a £1,200 shortfall
- C) £2,000 average is insufficient — they need to earn more overall

*Correct: B. The trap is the mismatch between fixed commitments (£1,600) and the income floor (£400). Average income is irrelevant in the month the floor is hit.*

---

**Q2.** Which of the following is an employment right that a salaried employee has but a self-employed gig worker does not?

- A) Ability to earn more than their contract rate
- B) Employer pension contribution, sick pay, and holiday pay
- C) Right to choose which projects to take on

*Correct: B. Pension contributions (3%+ employer), statutory sick pay, and holiday pay are employment rights that do not apply to self-employed individuals.*

---

**Q3.** The recommended buffer before transitioning to full-time gig work is:

- A) One month of average earnings
- B) Three months of fixed expenses
- C) Six months of maximum possible earnings

*Correct: B. The buffer must cover fixed expenses (the inflexible obligations) for long enough to survive a bad spell. Average earnings or maximum earnings are the wrong basis — the buffer is a defence against the floor.*

---

### CLOSING LINE

> *"The feast weeks are visible. The bare weeks are the lesson. Now you know how to plan for both."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M3b — Gig Trap vs. Salary Safety
**TRIGGER:** `STDDEV(weekly_earnings WHERE child_id = ? AND week IN last_4_weeks) / AVG(weekly_earnings) > 0.40`
**HOOK:** *"4-week earnings variance exceeds 40%. Income volatility pattern detected. Employment model trade-offs apply."*

---

### ACT 2 — LESSON

**Income stability spectrum.**

| Model | Floor guarantee | Ceiling | Employment rights | Predictability |
|---|---|---|---|---|
| Full-time salaried | Yes | Contract rate | Full | High |
| Part-time employed | Partial | Contract rate | Partial | Medium |
| Zero-hours contract | No | Uncapped | Partial | Low |
| Freelance (recurring clients) | Low | Uncapped | None | Medium |
| Gig platform (per-task) | Zero | Uncapped | None | Very low |

No position is optimal across all dimensions. Selection is a trade-off based on individual risk tolerance, expense structure, and career goals.

---

**Gig trap mechanism (formal).**

```
fixed_expenses_monthly = rent + loan_payments + subscriptions + essential_bills
income_floor_monthly = min(monthly_earnings, rolling_12_months)
gap = income_floor_monthly − fixed_expenses_monthly
```

If `gap < 0`: a bad month requires deficit financing (credit card, overdraft, borrowing).

Deficit financing cost compounds across consecutive bad months:

```
debt_end_of_month_n = debt_end_of_month_n-1 × (1 + monthly_interest_rate) + gap_n
```

The trap is triggered when fixed_expenses are sized to `AVG(income)` rather than `MIN(income)`.

---

**Defence rules.**

Rule 1: `fixed_expenses_monthly ≤ income_floor_monthly`
Rule 2: `volatility_buffer = fixed_expenses_monthly × 3` (minimum cash reserve before committing to gig-only income)

Both rules require `income_floor_monthly` to be known — which requires tracking. Morechard's ledger provides this directly.

---

**Employment rights comparison (UK, 2025).**

| Right | Employee | Worker (gig platform) | Self-employed |
|---|---|---|---|
| Minimum wage | Yes | Yes (if worker status) | No |
| Statutory sick pay | Yes | No | No |
| Holiday pay (5.6 wks/yr) | Yes | No | No |
| Employer pension contribution | Yes (3%+) | No | No |
| Unfair dismissal protection | Yes (2yr+) | No | No |

Note: employment status (employee / worker / self-employed) in the UK is determined by a facts-and-circumstances test, not by contract label.

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `weekly_earnings_last_4 = [{week_1}, {week_2}, {week_3}, {week_4}]`:

1. `avg_weekly = SUM(weekly_earnings_last_4) / 4` = ____________
2. `floor_weekly = MIN(weekly_earnings_last_4)` = ____________
3. `variance_pct = STDDEV / avg_weekly × 100` = ____________ %
4. If `fixed_monthly_expenses = avg_weekly × 4 × 0.80` (expenses set at 80% of average monthly), compute `gap = floor_weekly × 4 − fixed_monthly_expenses` = ____________
5. `volatility_buffer_required = fixed_monthly_expenses × 3` = ____________

---

**Expense floor model.**

```json
{
  "income_floor_monthly": number,
  "fixed_expenses": {
    "rent_or_share": number,
    "transport": number,
    "phone": number,
    "other": number
  },
  "total_fixed": "SUM(fixed_expenses)",
  "gap": "income_floor_monthly − total_fixed",
  "buffer_required": "total_fixed × 3",
  "verdict": "viable | gap_risk | unviable"
}
```

---

### ACT 4 — QUIZ

**Q1.** `avg_monthly_income = £2,400`. `income_floor = £600`. `fixed_expenses = £1,800`. Classify the exposure.

- [ ] Safe — average exceeds expenses
- [x] Gap risk — floor (£600) is £1,200 below fixed expenses (£1,800); bad month requires deficit financing

**Q2.** A platform worker is classified as a "worker" (not employee) in UK law. Which right do they have?

- [ ] Statutory sick pay
- [ ] Employer pension contribution
- [x] National Living Wage — workers are entitled to minimum wage; employees additionally receive sick pay and pension contributions

**Q3.** Correct sizing rule for fixed expenses on a variable income:

- [ ] Fixed expenses ≤ average monthly income
- [x] Fixed expenses ≤ floor monthly income (minimum observed)
- [ ] Fixed expenses ≤ maximum monthly income

---

### CLOSING LINE

*"Module complete. Volatility-buffer requirement computed. Future income planning should size fixed commitments to floor, not average."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M3b",
  "title": "Gig Trap vs. Salary Safety",
  "pillar": 1,
  "pillar_name": "Earning & Value",
  "level": 4,
  "level_name": "Canopy",
  "age_range": "16+",
  "launch_status": "Launch",
  "moat_type": "pedagogical_moat",
  "persona_versions": ["orchard", "clean"],
  "honest_framing_required": false,

  "trigger_logic": {
    "event_type": "NIGHTLY_SWEEP",
    "condition": "STDDEV(weekly_earnings WHERE child_id = ? AND week IN last_4_weeks) / AVG(weekly_earnings) > 0.40",
    "evaluation_timing": "nightly_cron_0200_utc",
    "null_safety": "If weekly_earnings has fewer than 4 data points, STDDEV returns null; module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M3b', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'CANOPY'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "weekly_earnings_last_4",
      "weekly_earnings_variance_pct",
      "chore_rate_median"
    ],
    "datapoints_optional": [
      "lifetime_earnings",
      "avg_chore_value"
    ],
    "fallback_behaviour": "If weekly_earnings_variance_pct is null (< 4 weeks history), module does not fire. If chore_rate_median is null, Lab uses regional fallback rate."
  },

  "mentor_hook": {
    "locale_en_gb": "Some weeks a feast, some weeks bare branches — your earnings are swinging. That pattern has a name, and it's worth knowing before you build a life around it.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "The feast weeks are visible. The bare weeks are the lesson. Now you know how to plan for both.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — names the child's actual week-by-week pattern from weekly_earnings_last_4.",
    "act_2": "Lesson — income stability spectrum, what stability and volatility each buy, gig trap mechanism, floor-sizing defence.",
    "act_3": "Lab — required numeracy computing variance, floor, gap, and buffer from child's actual weekly_earnings_last_4.",
    "act_4": "Quiz — 3 questions on gap risk, employment rights by classification, and correct floor-sizing rule."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M3b_Q1",
        "stem": "Gig worker with average income above expenses but floor far below. Primary risk?",
        "correct_option": "B",
        "concept_tested": "income_floor_vs_average"
      },
      {
        "id": "M3b_Q2",
        "stem": "UK platform worker vs. employee — which rights apply to worker classification?",
        "correct_option": "B",
        "concept_tested": "employment_status_rights"
      },
      {
        "id": "M3b_Q3",
        "stem": "Correct basis for sizing fixed expenses on variable income.",
        "correct_option": "B",
        "concept_tested": "floor_sizing_rule"
      }
    ]
  },

  "concepts_introduced": [
    "income_stability_spectrum",
    "gig_trap",
    "income_floor",
    "fixed_vs_variable_expenses",
    "volatility_buffer",
    "employment_rights_by_classification"
  ],

  "prerequisites": ["M3"],

  "unlocks": ["M12"],

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

- **Moat Type: Pedagogical Moat.** No comparable app addresses employment classification, the gig trap mechanism, or buffer sizing. This module is unique and directly actionable for a 16-year-old entering the workforce within a few years.
- **Trigger rationale:** 40% variance over four weeks is a behavioural proxy for income volatility. It fires the lesson at the moment the pattern is visible in the child's own data, not in a hypothetical example.
- **Non-prescriptive design:** The module must never say "salaried is better." The gig economy is a legitimate choice. The module teaches the mechanism of the trap and the defence against it — then steps back. A 16-year-old who correctly understands the floor-sizing rule can safely take on gig work.
- **Employment rights section:** UK-specific (2025 rates/rules). US variant needs FLSA worker classification nuances; PL variant needs ZUS contributions and umowa o dzieło vs. umowa zlecenia distinctions. Both are meaningful for those markets.
- **Household neutrality:** No parent references in this module — the lesson is about the child's own future. "A parent or carer" reference removed from Reflection because the questions are introspective.
