# Orchard: The Grand Unified Financial Curriculum (2026 Master Spec)

This document is the "Source of Truth" for the Orchard Mentor AI. It ensures consistency in pedagogical goals, persona enforcement, and technical triggers.

---

## 🎭 Persona Standards

### 1. The "Orchard" Persona (Default / Warm)
- **Voice:** A wise, slightly witty gardener. Supportive but honest about consequences.
- **Tone:** Grounded, earthy, and metaphorical (seeds, harvest, soil, seasons).
- **Constraints:** NO "corporate-friendly" cheerleading. Acknowledge that "some plants die if they aren't watered"—money has real stakes.

### 2. The "Clean" Persona (Data-Driven / Utility)
- **Voice:** Like Stripe or AWS API Documentation.
- **Tone:** Professional, objective, and ultra-precise.
- **Constraints:** ZERO fluff. ZERO adjectives. Focus on mechanical execution and step-by-step logic.

---

## 🗺️ Curriculum Levels

Four tiers. Level 1 is greyed-out on the roadmap — planned for Phase 2, not built at launch.

| Level | Name | Ages | Launch Status |
| :--- | :--- | :--- | :--- |
| **Level 1** | Sprout | 6–9 | Phase 2 — reserved. 4–5 modules planned, not written. |
| **Level 2** | Sapling | 10–12 | **Launch entry tier.** |
| **Level 3** | Oak | 13–15 | Launch middle tier. |
| **Level 4** | Canopy | 16+ | Launch top tier. |

> **Design constraint:** Trigger conditions and `min_level` gate checks must be written to accommodate Level 1 without schema rework when Phase 2 ships. The `child.age_level` enum should reserve slot `1` even if no modules are assigned to it at launch.

---

## 🍎 The 20-Module Library

### Pillar 1: Earning & Value (The Roots)
- **Module 1 (Lvl 1 · Sprout — Phase 2):** Effort vs. Reward. Why different work has different value.
- **Module 2 (Lvl 2 · Sapling):** Taxes & Net Pay. The "Social Harvest" and infrastructure.
- **Module 3 (Lvl 3 · Oak):** Entrepreneurship. Scaling effort beyond hourly tasks.
- **Module 3b (Lvl 3 · Oak):** Gig Trap vs. Salary Safety. The trade-off between certainty and high-potential risk.

### Pillar 2: Spending & Choices (The Trunk)
- **Module 4 (Lvl 1 · Sprout — Phase 2):** Needs vs. Wants. Essentials vs. Gratification.
- **Module 5 (Lvl 2 · Sapling):** Scams & Digital Safety. Protecting PINs and identifying "Too good to be true."
- **Module 6 (Lvl 3 · Oak):** Advertising & Influence. UX "nudges" and impulse recognition.

### Pillar 3: Saving & Growth (The Fruit)
- **Module 7 (Lvl 1 · Sprout — Phase 2):** The Patience Tree. Simple delayed gratification (Wait = more seeds).
- **Module 8 (Lvl 2 · Sapling):** Banking 101. Accounts, Debit vs. Credit.
- **Module 9 (Lvl 3 · Oak):** Opportunity Cost. Choosing A means killing Choice B.
- **Module 9b (Lvl 2 · Sapling):** The Snowball. Intro to Compound Interest and time-value.

### Pillar 4: Borrowing & Debt (The Vine)
- **Module 10 (Lvl 2 · Sapling):** The Interest Trap. The cost of borrowing from the future.
- **Module 11 (Lvl 3 · Oak):** Credit Scores & Trust. Reliability as a numerical value.
- **Module 12 (Lvl 3 · Oak):** Good vs. Bad Debt. Assets vs. Consumables.

### Pillar 5: Investing & Future (The Canopy)
- **Module 13 (Lvl 4 · Canopy):** Stocks & Shares. Fractional ownership of the corporate forest.
- **Module 14 (Lvl 2 · Sapling):** Inflation. Why money "shrinks" if it just sits in a jar.
- **Module 15 (Lvl 4 · Canopy):** Risk & Diversification. Don't put all your seeds in one basket.

### Pillar 6: Society & Wellbeing (The Atmosphere)
- **Module 16 (Lvl 1 · Sprout — Phase 2):** Giving & Charity. Social Capital and strengthening the garden.
- **Module 17 (Lvl 2 · Sapling):** Digital vs. Physical Currency. V-Bucks/Robux vs. Real Cash.
- **Module 18 (Lvl 3 · Oak):** Money & Mental Health. Buyer's Remorse and Contentment.
- **Module 18b (Lvl 3 · Oak):** Social Comparison. The danger of "Keeping up with the YouTubers."

---

## 🛡️ The "Truth Engine" Guardrails

### 0. Family-Neutral Language (Non-Negotiable)
All module content — acts, labs, quiz stems, and mentor hooks — must treat the child's family structure as none of the app's business.

- **Never reference parents' relationship or situation.** Do not mention separation, divorce, custody, or "two homes." The primary safeguard is silence.
- **Use singular and plural interchangeably.** Write "your parent or parents" or "a parent." Never "your mum and dad," "both your parents," or "your family."
- **"Your home" not "your family."** When a location is needed, use "your home" or "your household." When people are needed, use "a parent or carer."
- **Labs and bonus challenges** must not assume two parents are present. "Ask your parent" is always correct; "Ask your mum and dad" is never correct.

This applies to all locales (EN-GB, EN-US, PL). The PL persona must apply the same rule in Polish — never assume a two-parent household.

### 1. Real-World Translation (In-Game Currency)
Mentor must calculate the **Labor Equivalent**: (Total Cost / Average Hourly Chore Rate).
Prompt: "Is this skin worth 3 hours of [Standard Chore]?"

### 2. Behavioral Soft-Locks (The 24-Hour Rule)
- **Trigger:** Purchase request > 50% of balance OR involving debt.
- **Action:** Move funds to "Holding Soil" for 24 hours.
- **Lesson:** Unlock age-appropriate Opportunity Cost lesson (Lvl 1: "The Toy Swap"; Lvl 2/3: "Opportunity Cost").

### 3. Resale Logic (Circular Economy)
- **Concept:** "Cost Per Use" vs "Initial Price."
- **Trigger:** Large purchase in high-depreciation categories (e.g., Fast Fashion).

---

## 🎯 Trigger Registry

Each module fires exactly once per child account. The `unlocked_modules` D1 table stores `(child_id, module_id, triggered_at)` — all trigger logic must guard against duplicate delivery.

**Column key:**
- **Event** — the user-facing action that initiates evaluation
- **Logic** — the SQL/runtime condition that must evaluate to `true` before the module is delivered
- **Orchard Mentor Hook** — the opening line delivered to the child when the module unlocks

---

### Level 1 (Sprout · Ages 6–9) — Phase 2, reserved. Trigger rows below are planned stubs only.

| Module | Event | Logic | Orchard Mentor Hook |
| :--- | :--- | :--- | :--- |
| **M1** Effort vs. Reward | First chore marked complete by parent | `COUNT(ledger WHERE child_id = ? AND type = 'chore_approved') = 1` | *"Your first seed has been planted. Every coin you earn is stored energy — let me show you how it grew."* |
| **M4** Needs vs. Wants | First purchase logged or goal created | `COUNT(goals WHERE child_id = ?) >= 1 OR COUNT(purchases WHERE child_id = ?) >= 1` | *"Something caught your eye. Before we water this idea, let's work out whether it's a root — or just a pretty weed."* |
| **M7** The Patience Tree | Child creates a goal with a completion date > 14 days away | `goal.target_date - CURRENT_DATE > 14` | *"You've planted a slow seed. The orchard's best fruit takes the most time. Here's why waiting makes the harvest sweeter."* |
| **M16** Giving & Charity | Parent activates the Give/Charity bucket in the child's three-grove split | `child_config.give_bucket_enabled = true` | *"A corner of your orchard now belongs to the forest. That's not charity — that's how forests grow strong enough to weather storms."* |

---

### Level 2 (Sapling · Ages 10–12) — Launch entry tier. Systems, patterns & real-world exposure

| Module | Event | Logic | Orchard Mentor Hook |
| :--- | :--- | :--- | :--- |
| **M2** Taxes & Net Pay | Child earns a cumulative total ≥ £20 / $25 / 100 PLN | `SUM(ledger.amount WHERE child_id = ? AND type = 'chore_approved') >= 20.00` | *"You've earned your first real harvest. But before we count the apples, let's talk about the slice the orchard infrastructure quietly takes."* |
| **M5** Scams & Digital Safety | Child attempts to add an external link to a goal title, OR parent flags a suspicious item | `goal.title ILIKE '%http%' OR scam_flag_raised = true` | *"Something in this corner of the orchard smells like blight. Scams grow fast and look delicious — let's learn how to spot them before they spread."* |
| **M8** Banking 101 | Child's cumulative balance exceeds £30 / $35 / 150 PLN for the first time | `MAX(running_balance WHERE child_id = ?) >= 30.00` | *"Your grove is growing. It's time to understand where the real orchards store their surplus — and why a jar under the floorboards isn't it."* |
| **M9b** The Snowball | Child has an active goal AND balance has increased for 4 consecutive weeks | `goal.status = 'active' AND consecutive_weekly_growth >= 4` | *"Four weeks in a row — your snowball is rolling. Here's the secret: it gets heavier without you pushing harder."* |
| **M10** The Interest Trap | Child marks a goal as 'borrow from parent' OR parent enables a Parental Loan feature | `loan_request_raised = true OR parent_loan_enabled = true` | *"Borrowing tomorrow's seeds to buy today's fruit — it can work. But the vine always wants something back. Let me show you the cost."* |
| **M14** Inflation | Child's balance has remained unchanged (no new chores, no new goals) for 21 consecutive days | `days_since_last_transaction >= 21` | *"Your seeds are sitting still. That's fine for rocks — but money has a slow rot. Here's what's quietly happening to your pile."* |
| **M17** Digital vs. Physical Currency | Child creates a goal in the 'Gaming' category for the first time | `goal.category = 'gaming' AND COUNT(goals WHERE child_id = ? AND category = 'gaming') = 1` | *"V-Bucks, Robux, Gems — the orchard has a dark corner selling 'magic seeds' that only grow inside one walled garden. Let's map the exit."* |

---

### Level 3 (Oak · Ages 13–15) — Complex economics, psychology & long-range strategy

### Level 4 (Canopy · Ages 16+) — Advanced strategy, wealth framing & formal tone (PL: Pan/Pani)

| Module | Event | Logic | Orchard Mentor Hook |
| :--- | :--- | :--- | :--- |
| **M3** Entrepreneurship | Child completes ≥ 10 distinct chore types AND average chore value > £3 / $4 / 15 PLN | `COUNT(DISTINCT chore_template_id WHERE child_id = ?) >= 10 AND AVG(ledger.amount WHERE type = 'chore_approved') > 3.00` | *"You've worked the whole orchard. Now here's the question every serious grower eventually asks: what if the orchard worked for you instead?"* |
| **M3b** Gig Trap vs. Salary Safety | Child's last 4 weeks show earnings variance > 40% week-on-week | `STDDEV(weekly_earnings WHERE child_id = ? AND week IN last_4_weeks) / AVG(weekly_earnings) > 0.40` | *"Some weeks a feast, some weeks bare branches — your earnings are swinging. That pattern has a name, and it's worth knowing before you build a life around it."* |
| **M6** Advertising & Influence | Child makes 3+ purchases in the same non-essential category within 30 days | `COUNT(purchases WHERE child_id = ? AND category NOT IN ('essentials','savings') AND created_at >= NOW() - INTERVAL '30 days') >= 3` | *"Three times in a month, the same shelf called your name. That's not a coincidence — someone designed that shelf. Let's inspect the architecture."* |
| **M9** Opportunity Cost | Child abandons a goal (deletes or marks 'cancelled') after spending in a competing category within the same 14-day window | `goal.status = 'cancelled' AND EXISTS (purchase WHERE child_id = ? AND category = goal.category AND created_at BETWEEN goal.created_at AND goal.cancelled_at AND DATEDIFF(day, goal.created_at, goal.cancelled_at) <= 14)` | *"You said yes to something — and quietly said no to something else. That trade has a name. Here's how to make it consciously next time."* |
| **M11** Credit Scores & Trust | Child achieves a 'Reliability Rating' (chore completion rate) ≥ 90% over a rolling 8-week window | `(approved_chores / assigned_chores WHERE window = 'last_8_weeks') >= 0.90` | *"Your consistency has a number. In the wider world, that number opens doors — or closes them. Here's how the system actually works."* |
| **M12** Good vs. Bad Debt | Child completes M10 (Interest Trap) AND creates a goal categorised as 'asset' (e.g., tool, instrument, skill course) | `module_unlocked('M10') = true AND goal.category = 'asset'` | *"Not all debt is a vine strangling your tree. Some debt is a trellis. Here's the test every serious grower uses to tell the difference."* |
| **M13** Stocks & Shares | Child's total lifetime earnings exceed £100 / $120 / 500 PLN | `SUM(ledger.amount WHERE child_id = ? AND type = 'chore_approved') >= 100.00` | *"A hundred pounds of harvested energy. The orchard now has a question for you: do you want to own a small piece of someone else's farm?"* |
| **M15** Risk & Diversification | Child has ≥ 3 active goals simultaneously AND at least one goal is categorised as 'long-term' (target date > 90 days) | `COUNT(goals WHERE child_id = ? AND status = 'active') >= 3 AND EXISTS (goal WHERE category = 'long-term' AND target_date - CURRENT_DATE > 90)` | *"Three seeds in three different soils — you're thinking like a strategist. Now let's examine what happens when one of those soils turns bad."* |
| **M18** Money & Mental Health | Child completes a goal purchase AND re-rates satisfaction < 3/5 within 48 hours (post-purchase reflection prompt) | `purchase.satisfaction_rating < 3 AND purchase.created_at >= NOW() - INTERVAL '48 hours'` | *"You got the thing — and something feels off. That feeling has a name. The orchard sees it a lot. Let's talk about it before it shapes your next harvest."* |
| **M18b** Social Comparison | Child creates a goal in the 'Electronics' or 'Fashion' category within 72 hours of a peer's visible goal in the same category (if family sharing is enabled) | `goal.category IN ('electronics','fashion') AND EXISTS (sibling_goal WHERE category = goal.category AND created_at >= NOW() - INTERVAL '72 hours')` | *"Someone else planted a seed and now you want the same crop. That's human — but let's make sure it's your hunger driving this, not theirs."* |

---

### Trigger Registry — Implementation Notes

1. **Idempotency:** All triggers wrap in `INSERT OR IGNORE INTO unlocked_modules (child_id, module_id, triggered_at)`. A module fires at most once per child.
2. **Evaluation timing:** Triggers evaluate on `ledger_write`, `goal_write`, `purchase_write`, and a nightly cron job that sweeps inactivity and streak conditions.
3. **Level gating:** Each module's trigger condition additionally checks `child.age_level >= module.min_level`. A Level 3 module will not fire for a Seedling even if the behavioural condition is met.
4. **Locale adapter:** The Orchard Mentor Hook above is the EN-GB default. The same logical trigger resolves to a Mistrz Sadu (PL) or Jump$tart-aligned (US) hook at render time based on `family.locale`.
5. **Satisfaction prompt:** M18 requires a post-purchase 1–5 star satisfaction rating prompt to be shown 24 hours after a goal purchase completes. This is a pre-condition for M18's trigger to ever fire.

---

## 🔧 Developer Notes: Data Integrity & Pioneer Phase
- **Pioneer Phase (US/PL):** If `orchard_median` is NULL, do NOT display a rate. Display: *"You're a Pioneer! Set your own rate to help build the local guide."*
- **Activation:** Market Rates only appear once 100 data points exist for that chore in that country.
- **D1 Integration:** Log all `trigger_logic` to `unlocked_modules` to prevent duplicate delivery.
- **The default 'Standard Chore Rate' for calculations is the median of the child's last 5 approved chores, or £5/hr if no history exists.