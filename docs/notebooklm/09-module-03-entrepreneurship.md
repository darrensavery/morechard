# Module 3: Entrepreneurship
**Pillar 1 · Level 4 (Canopy) · Ages 16+**

---

## LIVE APP INTEGRATION

**Datapoints consumed:**
- `distinct_chore_types` — primary trigger condition and Hook personalisation
- `chore_rate_median` — used as hourly-wage benchmark in Lab contrast exercise
- `lifetime_earnings` — used in Hook to frame total output so far
- `avg_chore_value` — trigger condition (must exceed £3 / $4 / 15 PLN)
- `chore_count_lifetime` — used to confirm breadth of experience in Hook

**AI Mentor rendering rules:**
- Hook must reference `distinct_chore_types` and `lifetime_earnings` as concrete numbers.
- Lab must use `chore_rate_median` as the hourly-wage comparator for the leverage calculation.
- Lesson must distinguish between value created by the individual's time vs. value created by systems, assets, or other people's time.
- Module must not romanticise entrepreneurship — explicitly acknowledge that most businesses fail.

---

## ORCHARD PERSONA VERSION

### ACT 1 — HOOK

*Trigger delivered when `COUNT(DISTINCT chore_template_id WHERE child_id = ?) >= 10 AND AVG(ledger.amount WHERE type = 'chore_approved') > 3.00`*

> *"You've worked the whole orchard. Now here's the question every serious grower eventually asks: what if the orchard worked for you instead?"*

Ten different jobs. **£{lifetime_earnings}** earned. You know how to graft.

Here's the thing about grafting: it has a ceiling. Every hour you work, you earn once. When you stop working, you stop earning. That's a clean, honest exchange — and most people live their whole working lives inside it.

But there's another mode. Some growers figured out how to multiply their hours — not by working longer, but by building something that kept producing after they put their tools down.

That's what this lesson is about. Not "get rich quick." Not a fantasy. A real structure — and the real risks that come with it.

---

### ACT 2 — LESSON

**The core problem with trading time for money.**

There are 168 hours in a week. You sleep for roughly 56. You spend time on food, rest, relationships. At the extreme, you might be able to work 60 hours in a week. At £10/hr, that's £600. That's the ceiling of the time-for-money model.

The ceiling is real. You can raise your hourly rate — M1 explained how. But the ceiling doesn't disappear: it just moves higher.

**Entrepreneurship is the attempt to break the ceiling.** Instead of being paid for your time, you build something that generates value independently of whether you're personally working on it right now.

---

**The three forms of entrepreneurial income.**

**1. Product income:** You create something once, and sell it many times. A book written once can be sold ten thousand times. A piece of software built once can be licensed to a million users. The creation is time-intensive; the distribution is not.

**2. Service leverage:** You systematise a service so that other people (employees, contractors) can deliver it. A plumber who works alone earns £40/hr. A plumbing company with ten engineers earns the margin on each of them. The owner isn't on the tools — they're running the system.

**3. Asset income:** You own something that generates returns — rental property, a portfolio of shares, a website with advertising revenue. The asset works; you don't.

Most successful businesses combine all three over time. Most small businesses start with one and never build the others.

---

**Why most businesses fail — and why that matters.**

About 50–60% of new small businesses in the UK fail within five years. In the US, the numbers are similar. This isn't because the people running them were bad — it's because entrepreneurship is genuinely hard, and the market is a competitive, honest judge.

The most common failure modes:

- **Running out of cash** — a business can be profitable in theory and still collapse because the money doesn't arrive when the bills do. Cash flow is not the same as profit.
- **Building something nobody wants** — the classic error: solving your own problem instead of a customer's. Your passion is not a business plan.
- **Underpricing** — many first-time entrepreneurs charge too little because they feel uncomfortable with money or fear rejection. A business charging below its costs will fail, however good the service is.
- **Refusing to delegate** — once a business grows beyond one person, the owner who stays "on the tools" becomes the bottleneck. The skill of running a business is different from the skill of doing the work.

---

**The honest maths of a small business.**

A business that earns £10,000 in a year is not necessarily profitable. Deduct:
- Materials and supplies
- Software and tools
- Marketing and advertising
- Tax on profit (Corporation Tax in UK, or Income Tax if sole trader)
- Your own time (at opportunity cost — what else could you have earned?)

What remains is the actual economic return. Sometimes it's less than you'd have earned in a job. Sometimes much more. The point is: the revenue number alone is not the answer.

---

**What entrepreneurship actually requires.**

- Tolerance for uncertainty (income is not guaranteed, especially at first)
- Willingness to do uncomfortable things (charging full price, having difficult conversations, firing people)
- Systems thinking (building processes that don't depend on you showing up)
- Financial literacy (understanding cash flow, margin, and cost structure)

You've been building financial literacy since M1. That's not irrelevant — it's the foundation that most failed entrepreneurs didn't have.

---

### ACT 3 — LAB

**Numeracy check (required).**

Your median chore rate is **£{chore_rate_median}/hr**. Let's model the contrast between time-for-money and leverage.

**Scenario A — Solo work:**
1. You charge £{chore_rate_median}/hr and work 40 hours/week for 50 weeks. Total revenue = ____________
2. Subtract: materials (10% of revenue), tax (20% of profit after materials), and your own 2,000 hours at opportunity cost. Net return per hour of your time = ____________

**Scenario B — Leverage:**
3. You build a service business. You charge clients £{chore_rate_median × 2}/hr. You pay two workers £{chore_rate_median}/hr each. Each worker does 30 hours/week. Your margin per worker-hour = ____________
4. After 50 weeks, if both workers are fully booked, total worker-hours = 3,000. Your total margin = ____________ (before your own time and fixed costs)

---

**Business idea stress test.**

Think of one thing you could sell — a product, a service, or a skill you have. Answer these questions:

1. Who would pay for it? (Name a specific type of person, not "everyone.")
2. How much would they pay? (A real number, not "whatever feels fair.")
3. What would it cost you to deliver? (Time, materials, tools, marketing.)
4. What's the margin? (Price minus cost, in £ and %.)
5. How many units/hours would you need to sell to earn £500 in a month?
6. How would you find the first five customers?

**Bonus challenge:** Ask a parent or carer who runs a business, or has run one, to describe their biggest unexpected cost. That cost is usually the lesson that business school doesn't teach.

---

### ACT 4 — QUIZ

**Q1.** A freelancer earns £50/hr and works 35 hours/week for 48 weeks. A business owner earns £20/hr margin on 5 workers doing 35 hours/week each for 48 weeks. Who has higher gross income?

- A) The freelancer — higher individual rate
- B) The business owner — 5× the hours generating margin
- C) Equal — same total hours in the market

*Correct: B. Freelancer: £50 × 35 × 48 = £84,000. Business owner: £20 × 5 × 35 × 48 = £168,000. Leverage doubles gross income.*

---

**Q2.** A new business earns £30,000 in its first year. After materials (£8,000), marketing (£4,000), tools (£2,000), and 20% tax on remaining profit, roughly how much profit does the owner keep?

- A) £30,000 — revenue is profit
- B) £12,800 — after costs and tax on the remaining £16,000
- C) £0 — costs always equal revenue in year one

*Correct: B. Revenue £30,000 − costs £14,000 = £16,000 profit. Tax at 20% = £3,200. Net = £12,800.*

---

**Q3.** Which of the following is the most common reason new small businesses fail?

- A) Bad products or services
- B) The owner runs out of cash before the business becomes profitable
- C) Competition from large companies

*Correct: B. Cash flow failure — running out of money before break-even — is the leading cause, even in businesses with legitimate products and genuine customer demand.*

---

### CLOSING LINE

> *"You've worked the whole orchard. Now you know what it takes to build one that works without you."*

---

## CLEAN PERSONA VERSION

### ACT 1 — HOOK

**MODULE:** M3 — Entrepreneurship
**TRIGGER:** `COUNT(DISTINCT chore_template_id WHERE child_id = ?) >= 10 AND AVG(ledger.amount WHERE type = 'chore_approved') > 3.00`
**HOOK:** *"10+ distinct task types completed. Average task value exceeds threshold. Time-for-money ceiling reached. Leverage mechanics apply."*

---

### ACT 2 — LESSON

**Concept: Income Leverage**

Linear income model:
```
income = hours_worked × hourly_rate
```
Ceiling: `hours_worked` is bounded by human capacity (~60hr/week maximum). `income` therefore has a hard ceiling at `60 × hourly_rate`.

Leveraged income model:
```
income = (own_hours × own_rate) + SUM(worker_hours × margin_per_hour) + asset_returns
```

Leverage breaks the ceiling by generating income from inputs that are not constrained by personal time.

---

**Three leverage types:**

| Type | Mechanism | Scale |
|---|---|---|
| Product | Create once, distribute many times | High — marginal cost per unit approaches zero |
| Service leverage | Employ others; capture margin | Medium — limited by management capacity |
| Asset income | Capital generates returns | High — limited by capital base and yield |

---

**Business viability model:**

```
gross_profit = revenue − cost_of_goods_sold
operating_profit = gross_profit − operating_expenses
net_profit = operating_profit − tax
cash_position = cash_in − cash_out (timing-dependent, not profit-dependent)
```

Note: cash_position ≠ net_profit. A profitable business can fail if receivables arrive after payables are due. This is the leading cause of small-business failure.

---

**Failure modes (empirical):**

1. Cash flow insolvency — profitable on paper, bankrupt in reality
2. Product-market mismatch — solution without a customer
3. Below-cost pricing — revenue insufficient to cover full cost
4. Founder bottleneck — owner cannot delegate; growth is capped

---

### ACT 3 — LAB

**Numeracy check (required).**

Given `hourly_rate = chore_rate_median`:

1. Solo ceiling: `revenue_solo = chore_rate_median × 2000` (annual hours). After 30% total deductions: `net_solo = revenue_solo × 0.70` = ____________
2. Leverage scenario: 2 workers at `chore_rate_median`, charged to clients at `chore_rate_median × 1.8`. Margin per worker-hour = `chore_rate_median × 0.8`. Annual margin on 2 workers × 1600hr each = ____________
3. Compute `leverage_multiple = annual_margin / net_solo` = ____________ ×

---

**Business model canvas (simplified).**

For a business idea of your choice, complete:

```json
{
  "customer_segment": "string — who specifically pays",
  "value_proposition": "string — what specific problem you solve",
  "revenue_per_unit": number,
  "cost_per_unit": number,
  "gross_margin_pct": "computed: (revenue - cost) / revenue × 100",
  "units_to_earn_500_per_month": "computed: 500 / (revenue_per_unit - cost_per_unit)",
  "customer_acquisition_method": "string — first 5 customers"
}
```

---

### ACT 4 — QUIZ

**Q1.** `hourly_rate = £40`. Solo worker vs. business owner with 5 workers at £40/hr client rate, £25/hr worker cost. Both work 40hr/week for 50 weeks. Compute net revenue for each.

- [ ] Solo earns more — higher individual rate
- [x] Business owner earns more — margin on 5 workers × 2000hr exceeds solo revenue

**Q2.** A business has £80,000 revenue, £60,000 costs, and £15,000 profit. It has £5,000 cash in the bank and owes £12,000 to suppliers due this week. What is the business's immediate problem?

- [ ] Insufficient profit
- [x] Cash flow insolvency — profit is irrelevant if payables exceed available cash

**Q3.** Which business model has the highest theoretical scale?

- [ ] Service leverage — limited by team size
- [x] Product — marginal cost approaches zero at scale
- [ ] Asset income — limited by capital base

---

### CLOSING LINE

*"Module complete. Leverage model loaded. Future income planning should distinguish between time-constrained and time-decoupled revenue sources."*

---

## TECHNICAL JSON EXPORT

```json
{
  "module_id": "M3",
  "title": "Entrepreneurship",
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
    "event_type": "LEDGER_WRITE",
    "condition": "COUNT(DISTINCT chore_template_id WHERE child_id = ?) >= 10 AND AVG(ledger.amount WHERE child_id = ? AND type = 'chore_approved') > 3.00",
    "evaluation_timing": "on_ledger_write",
    "null_safety": "AVG returns null if no chore records exist; condition evaluates false — module does not fire.",
    "idempotency_guard": "INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at) VALUES (:child_id, 'M3', CURRENT_TIMESTAMP)",
    "level_gate_check": "child.age_tier >= 'CANOPY'",
    "subscription_gate": "ai_subscription_status IN ('ACTIVE')"
  },

  "live_app_integration": {
    "datapoints_required": [
      "distinct_chore_types",
      "chore_rate_median",
      "lifetime_earnings",
      "avg_chore_value"
    ],
    "datapoints_optional": [
      "chore_count_lifetime"
    ],
    "fallback_behaviour": "If chore_rate_median is null, use regional fallback rate (£5/hr UK, $6/hr US, 25 PLN/hr PL). If lifetime_earnings is null, Hook omits the numeric reference."
  },

  "mentor_hook": {
    "locale_en_gb": "You've worked the whole orchard. Now here's the question every serious grower eventually asks: what if the orchard worked for you instead?",
    "locale_pl": null,
    "locale_en_us": null
  },

  "closing_line": {
    "locale_en_gb": "You've worked the whole orchard. Now you know what it takes to build one that works without you.",
    "locale_pl": null,
    "locale_en_us": null
  },

  "structure": {
    "act_1": "Hook — delivered at trigger point. References child's distinct_chore_types and lifetime_earnings.",
    "act_2": "Lesson — time-for-money ceiling explained, three leverage types introduced, failure rates and causes given honestly.",
    "act_3": "Lab — required numeracy contrasting solo income ceiling vs. leverage multiplier using chore_rate_median. Business stress-test exercise.",
    "act_4": "Quiz — 3 questions on leverage maths, cash flow vs. profit, and scale comparison across income types."
  },

  "quiz": {
    "pass_threshold": 2,
    "questions": [
      {
        "id": "M3_Q1",
        "stem": "Solo freelancer vs. business owner with leverage. Which earns more gross?",
        "correct_option": "B",
        "concept_tested": "leverage_multiplier"
      },
      {
        "id": "M3_Q2",
        "stem": "Profitable business with insufficient cash. What is the problem?",
        "correct_option": "B",
        "concept_tested": "cash_flow_vs_profit"
      },
      {
        "id": "M3_Q3",
        "stem": "Highest theoretical scale: product, service leverage, or asset income?",
        "correct_option": "B",
        "concept_tested": "income_type_scale_ranking"
      }
    ]
  },

  "concepts_introduced": [
    "income_ceiling",
    "leverage",
    "product_income",
    "service_leverage",
    "asset_income",
    "gross_profit",
    "cash_flow_vs_profit",
    "business_failure_modes"
  ],

  "prerequisites": ["M2", "M1"],

  "unlocks": ["M3b", "M11"],

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

- **Moat Type: Pedagogical Moat.** No mainstream kids' finance app teaches leverage or business failure rates. GoHenry's "Earn" tab teaches task completion → payment; it does not model what happens when the task becomes a business. This is genuine curriculum advance.
- **Trigger rationale:** 10 distinct chore types + £3 average value signals the child has real breadth and a pattern of taking on complex tasks — a meaningful proxy for "ready to think about systems." Firing on first chore would make the lesson meaningless.
- **Failure rate honesty:** The 50–60% five-year failure rate is intentional and non-negotiable. Romanticising entrepreneurship does the child a disservice. The module's credibility — and the child's future decisions — depends on an honest picture.
- **Cash flow as primary concept:** Most entrepreneurship content for young people focuses on the idea or the passion. The cash flow section addresses the leading mechanical failure mode. This is Morechard's distinctive contribution: mechanics over inspiration.
- **Household neutrality:** Bonus challenge uses "a parent or carer" to avoid assuming the child has access to a parent who has run a business.
- **Canopy-level framing:** At 16+, formal tone is appropriate. The Clean persona uses precise financial notation. The Orchard persona uses directness rather than warmth — these children are near adulthood.
