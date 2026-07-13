# 07 · AI Mentor, Learning Lab & Insights

Covers the child-facing AI Mentor (nudges + chat), the Learning Lab curriculum, parent-facing Insights briefings, and the Family Audit.

**Access gating (the key fact):**
- The AI Mentor, Learning Lab, child AI chat, and parent Insights/Scouting all require **`has_ai_mentor = 1`** on the family.
- Families get `has_ai_mentor` by buying **Core AI** (`COMPLETE_AI`), **Shield AI** (`SHIELD_AI`), or the **AI upgrade** (`AI_UPGRADE`, on top of Core). During the 14-day trial, AI is active for everyone.
- **Core-only** families (bought `COMPLETE`) see an **upsell card** ("The Head Gardener's quarters are closed") instead of AI surfaces. This is expected, not a bug.

**AI engine:** OpenAI `gpt-4o-mini` with a **10-second timeout** and a **rule-based fallback** — if the model is slow or errors, users still get a sensible non-AI response. So "the AI gave me a generic/templated answer" is often the fallback firing, not a broken feature.

---

## Access & gating

### Symptom: "The AI Mentor / Learning Lab is locked"
**Diagnose:** Check `has_ai_mentor` (Toolkit). If 0, they're on Core-only (or trial expired without an AI-bearing purchase).
**Resolve:** Explain they need Core AI, Shield AI, or the £29.99 AI upgrade. The upgrade only requires they already own Core. See [06](06-billing-payments-stripe.md). If `has_ai_mentor = 1` but it's still locked, it's a client cache issue → log out/in or reopen the app; if it persists, escalate.

### Symptom: "I paid for AI but it's still locked"
**This is a billing/webhook issue, not an AI issue.** Follow the "I paid but nothing unlocked" playbook in [06-billing-payments-stripe.md](06-billing-payments-stripe.md) — verify Stripe → `payment_audit_log` → flags, and escalate for a manual grant if the flag didn't set.

---

## Child AI Mentor — nudges & chat

**Facts:** The Mentor delivers **behaviourally-triggered** coaching, not a static course. Triggers fire from real data (spending velocity, balance hitting zero, hoarding, overdue chores, proof-confidence, keyword mentions, etc.) and can unlock matching Learning Lab modules. Tone is always encouraging (never accusatory). Personas: **Seedling** (younger/visual) vs. **Professional** (older/velocity-framed), and a formal **Mistrz Sadu** persona in Polish.

### Symptom: "The Mentor keeps sending the same lesson / a lesson that doesn't fit"
**Diagnose:** Each nudge maps to a data trigger (e.g. balance → 0 within 24h fires a "needs vs wants" lesson; balance > £100 with no spending fires a "hoarder"/compound-growth lesson). A repeated lesson means the triggering condition is still true.
**Resolve:** Explain the Mentor responds to real behaviour — the lesson stops when the pattern changes (e.g. the child spends down a hoard, or completes overdue chores). **Never expose the exact trigger mechanics** (especially anything EXIF/GPS/IP-based) — those signals are private and only inform confidence internally.

### Symptom: "Is the AI reading my child's photos / location?"
**Fact + reassurance:** Proof-photo EXIF (timestamp/GPS) and IP are used **only** to compute a hidden verification-confidence score, and **GPS/IP are never surfaced** to any user view. The Mentor's lessons trigger from the *confidence score*, not from raw location. No location or image content is shown to parent, child, or the AI's output. This is a core privacy guarantee — state it plainly.

### Symptom (child): "The AI answer looks generic / cut off"
**Diagnose:** The model has a 10s timeout; on a slow response the **rule-based fallback** serves a templated (but valid) answer. Network hiccups can also truncate.
**Resolve:** Retry — a fresh request usually gets the full AI response. Not a data issue.

### Symptom: "Can the AI let my kids message each other / message the other parent?"
**Fact:** No. There is a **hard product ban on human-to-human chat**. The AI Mentor is the child talking to a coach, scoped to curriculum triggers — it is never a channel to another person. By design.

---

## Learning Lab (curriculum)

**Facts:** 20-module library across financial-literacy pillars, in a 4-tier age structure (Level 1 / Seed 6–9 is **reserved for Phase 2** and shows "Coming 2026"; Levels 2–4 are live). Each child has an `experience_level`: **ORCHARD** (metaphor labels — Sprout/Sapling/Oak) or **CLEAN** (functional Level 1–4 labels). Parents toggle it in Settings.

### Symptom: "Level 1 / the youngest tier is greyed out"
**Fact:** Intended. Level 1 (ages 6–9) launches in Phase 2 — it shows greyed with "Coming 2026." A parent who registered a child under 10 was told the younger curriculum is in development; the child's data is ready for when it launches.

### Symptom: "The tier names changed (Sprout/Oak vs Level 1–4)"
**Fact:** That's the `experience_level` toggle. **ORCHARD** shows metaphor names; **CLEAN** shows functional level names. Toggling it changes *presentation only* — it does **not** reset progress or re-trigger modules.
**Resolve:** Point them to **Settings → the child's experience level** to switch it back.

### Symptom: "My child's Learning Lab progress reset after we lapsed/re-bought AI"
**Fact:** It shouldn't — tier progression and previously-unlocked modules are preserved across a lapse and re-purchase; the child resumes at their current tier. If progress genuinely vanished, capture child_id and escalate.

---

## Parent Insights & Family Audit

**Facts:**
- **Insights briefing** (per child): a weekly AI-written summary grounded in the literacy pillars, with trend deltas vs. the prior week. It's **cached** — the AI runs **once per week per child**; later loads return the cached briefing instantly. Personas: **Orchard Lead** (EN, collaborative) vs. **Mistrz Sadu** (PL, formal).
- **Family Audit**: an AI cross-child monthly spending/trend summary (`GET /api/family-audit`, cached in `family_audit_snapshots`).
- Both are gated behind `has_ai_mentor`.

### Symptom: "My weekly insight didn't update / is stale"
**Fact:** The briefing is generated **once per week per child** and cached — subsequent loads that same week intentionally return the same briefing (cost/consistency). A new briefing appears the following week.
**Resolve:** Reassure them the once-weekly cadence is by design. If a briefing is *weeks* stale (never regenerating), capture child_id and escalate.

### Symptom: "The insight/audit shows an error or a very generic summary"
**Diagnose:** If OpenAI timed out (10s) or errored, the **rule-based fallback** briefing is shown (`source` won't be `ai`; the typewriter animation only runs for real AI briefings). It's still accurate, just not model-written.
**Resolve:** It self-heals on the next weekly generation. Persistent failures → escalate + check Sentry for the insights route.

### Symptom: "The 'Copy for Child' text uses odd metaphors"
**Fact:** The Copy-for-Child modal offers **Seedling** (visual/orchard) and **Professional** (velocity/streak) templates, attributed "Drafted by your Orchard Mentor." Pick the other template if the tone doesn't fit the child's age.

---

## Escalation triggers for this domain
- `has_ai_mentor = 1` but AI surfaces stay locked after a full app restart → engineering.
- Learning Lab progress genuinely lost across a lapse/re-purchase → engineering with child_id.
- Insights/Family Audit persistently failing to generate (always fallback, never `ai`) → engineering + Sentry.
- Any report suggesting private EXIF/GPS/IP data is being **shown** to a user → **P1** (privacy breach), escalate immediately.
