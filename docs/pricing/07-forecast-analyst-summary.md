# 3-Year Forecast Model — Launch Scenario Analysis

**Date:** 2026-04-22
**Constraint:** Solo developer, £200/mo max marketing budget (£2,400/yr ceiling)
**Assumptions:** Conservative funnel (worst case), no seasonality, prices per Scenario B (Complete £44.99 / Shield £149 / AI £19.99)
**Files:** `05-3yr-forecast-model.csv` (detail), `06-scenario-rollup.csv` (summary), this file (narrative)

---

## TL;DR — The Hard Truth

| Scenario | £/mo | 3yr Cumulative Net | Y3 Run-rate | % of £200k target |
|---|---|---|---|---|
| Zero budget | £0 | **£27,665** | £1,370/mo | **0.8%** |
| Bootstrap | £50 | £31,569 | £1,585/mo | 0.9% |
| Lean | £100 | £38,997 | £2,008/mo | 1.2% |
| Targeted | £150 | £50,959 | £2,597/mo | 1.5% |
| Max budget | £200 | **£65,034** | £3,347/mo | **2.0%** |

**Under conservative assumptions at your affordable budget, Morechard will not reach £200k/yr within 3 years in any scenario I modelled.**

At maximum affordable spend (£200/mo), you exit Year 3 at **~£40k/year run-rate** — roughly 20% of the escape threshold, and only ~2x your bootstrap target of "£50k nice-to-have pocket money."

This isn't a failure of the product. It's a **math problem**: the budget ceiling is fundamentally mismatched to the goal. You can build a solid hobby-income stream this way, but not a full-time income.

---

## What the Model Actually Says

### 1. Zero budget is *almost* as good as £50/mo
The delta between **£0 and £50/mo** is only £3,904 over 3 years (£1,300/yr). At CAC of ~£50 per paying buyer (conservative funnel), £50/mo buys you roughly 12 extra paying buyers per month — ~40-60 incremental Complete sales per year. The marketing ROI at £50/mo is **positive but tiny** because you're fighting two problems simultaneously: small budget can't buy enough volume to hit efficient frequency, and conservative funnel strips away margin.

**Interpretation:** if you only have £50/mo, seriously consider spending £0 and reinvesting that £600/yr into product depth instead. The organic path is slow but compounds with SEO content.

### 2. £200/mo is the budget sweet spot
At max budget, you roughly **double the zero-budget outcome** (£65k vs £28k cumulative 3yr). The marginal £600/yr between £150 and £200 is your most efficient spend tier — it pushes you from £51k cumulative to £65k (+27%), which is the best ROI in the ladder.

**Channel allocation at £200/mo:**
- UK Meta ads + UK Reddit (legal forums for Shield): £125/mo
- US Meta ads: £75/mo
- PL: organic only — can't afford paid there at this scale

### 3. US is quietly your biggest market
Every scenario shows US outpacing UK from Year 1 onwards, despite lower paid allocation. Why: organic base scales with population, and US has ~4x the addressable family base. At £200/mo, Y3 US revenue is **£21k/yr** vs UK's **£18k/yr** — and US is under-invested in every scenario.

**Implication:** if you ever scale marketing spend, skew US heavier than you instinctively would.

### 4. PL is a rounding error at every budget tier
Poland contributes **<1% of revenue** in every scenario because (a) no paid allocation is affordable, (b) conservative funnel strips volume, and (c) your prices are PPP-adjusted low. It's not a reason *not* to launch in PL — the infrastructure cost is near-zero once translated — but don't expect it to move the revenue needle pre-£200/mo.

---

## Path to £200k/yr — What Would It Actually Take?

This is the analyst's honest answer to the threshold question. **Under conservative funnel assumptions**, hitting £200k annual run-rate by end of Year 3 requires approximately:

| Lever | Current | Required for £200k Y3 | Multiplier |
|---|---|---|---|
| Monthly budget | £200 | **£1,500–£2,000** | 7.5–10x |
| Paying buyers (cumulative 3yr) | ~420 | ~4,100 | 9.8x |
| Monthly signups Y3 | ~450 | ~4,200 | 9.3x |
| Required upfront capital | £7,200 (3yr marketing) | **£54k–£72k** | — |

**The uncomfortable truth:** the £200k/yr escape threshold is approximately a **£50–70k marketing investment over 3 years**, roughly 10x your current budget ceiling. You are not under-pricing or under-targeting — you're under-capitalised for the escape plan.

### Two rational paths forward

**Path A — Hobby mode (your stated default):**
Run at £0–£200/mo. Build to £3–4k/month run-rate over 3 years. Pocket-money outcome, full creative freedom, no external capital. **This is a defensible plan.**

**Path B — Raise capital for the escape:**
Seek £50–70k from one of:
- **Angel investor(s)** — family-tech is an accessible angel category; 1–2 experienced parent-founders could write this check
- **Revenue-based financing** — post-launch, once you have 6–12 months of transaction data, Uncapped/Outfund-style financing becomes available
- **Grant funding** — UK Innovate UK or EU Horizon grants for "family welfare tech" or "digital literacy" (Morechard fits both)
- **Crowdfunding (Kickstarter)** — your audit-ledger + separated-families angle is narratively strong; could raise £20–50k from pre-orders alone

**Path C (my recommendation) — Prove-it-first hybrid:**
Run Path A for **12 months** to generate real conversion data. Use that data to either:
- Validate the thesis (actual conversion > my conservative model) → justify raising capital with empirical numbers
- Invalidate the thesis (actual conversion = or < my model) → stay at hobby scale without regret

This is the only path that preserves optionality. Don't raise capital pre-launch; don't close the door on raising it either.

---

## What's Assumed (And Where The Model Could Be Wrong)

### Conservative funnel assumptions in use

| Funnel stage | Value used | Realistic range |
|---|---|---|
| Paid CTR (Meta) | 1.0% | 0.8%–1.8% |
| Click → Install | 20% | 18%–35% |
| Install → Trial | 50% | 45%–65% |
| Trial → Paid (Complete) | 12% | 10%–22% |
| Trial → Paid (Shield) | 25% | 20%–40% |
| AI Add-on attach | 28% | 22%–38% |

All six variables are set at the **low end** of realistic ranges. If the product is genuinely better than average (which your knowledge base strongly implies — immutable ledger + court-ready PDFs + AI mentor are all genuinely differentiated), real conversions might run 30–60% higher than this model. That's upside.

### Organic growth assumption

I modelled organic signups as **compounding at ~3x year-over-year** (UK: 12 → 38 → 72 monthly). This is defensible for a content-forward niche product but:
- **Upside risk:** if one Reddit post in /r/UKPersonalFinance goes viral, you could 3x the entire year's organic in a week
- **Downside risk:** if SEO doesn't catch (e.g. Google's AI Overviews kill family-finance SERPs), organic flatlines at Y1 levels

Organic is your **highest-variance lever**. One breakout post could reshape the whole model.

### What's *not* in the model

- **Referral/word-of-mouth coefficient** — a family app naturally spreads within schools/friend-groups. Not modelled (conservative).
- **Shield PR effect** — if you land one *Guardian* or *The Times* article on "the co-parenting app for DIY litigants", it would materially change the Y1 curve. Not modellable.
- **App store featuring** — if Apple/Google feature Morechard in a family category, expect +30–70% that week. Possible, not forecastable.
- **Price testing uplift** — once you have 6 months of data and run proper A/B tests, pricing typically improves revenue 10–25%.

---

## What I'd Actually Do If I Were You

Ordered by priority:

1. **Launch at zero budget.** Ship to the App Store with Scenario B pricing (£44.99 / £149 / £19.99) and zero paid spend. This is the highest-information, lowest-risk move.

2. **Spend £50/mo on content, not ads.** Your money is better spent on:
   - One well-researched blog post/month targeting DIY legal keywords ("how to prove child maintenance payments", "court-admissible records UK")
   - One YouTube video/month on your real-parent UX
   - Posting in /r/UKLegal + /r/Divorce + UK MumsNet with genuine non-promotional value
   SEO content compounds; ads don't.

3. **Track cohort conversion religiously.** Every signup, trial-start, trial-convert, churn event. After 90 days, you'll have real numbers that tell you whether to double down, pivot, or pull back. **The real forecast model starts the day you have 100 paying users** — everything before that is speculation.

4. **Re-evaluate at month 12.** At that point you'll have:
   - Real trial→paid conversion rates (not my 12%)
   - Real AI attach rates (not my 28%)
   - Real Shield conversion in the legal-forum funnel
   - Real organic compounding velocity
   With those numbers, rerun this model. The output will either justify capital-raising or confirm hobby scale.

5. **Don't quit your day job until Year 2 revenue hits £60k and Year 3 trajectory clearly points past £150k.** That's the honest signal.

---

## Files Delivered

- `05-3yr-forecast-model.csv` — detailed row-per-market-per-year-per-scenario forecast
- `06-scenario-rollup.csv` — summary table (shown above)
- `07-forecast-analyst-summary.md` — this file

Together with the earlier pricing files (01–04), you now have a complete pre-launch pricing + forecast model. Everything else is empirical — you'll only learn it by launching.
