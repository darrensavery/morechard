# Morechard AI System Inventory
## Article 4 AI Literacy Record — 2026-06-29

**Document type:** Internal accountability record. Not published to the public site.  
**Controller:** Darren Savery, trading as Morechard (sole trader)  
**Status:** Verified against codebase 2026-06-29. Sections marked [OWNER TO COMPLETE] require human judgment.  
**Next review:** [OWNER TO COMPLETE — suggest quarterly; 2026-09-29]

---

## AI System 1: Parent Weekly Briefing (Orchard Mentor / Mistrz Sadu)

**Source file:** `worker/src/routes/insights.ts`, function `generateBriefing()`

- **Provider:** OpenAI
- **Model:** `gpt-4o-mini`
- **API endpoint:** `https://api.openai.com/v1/chat/completions`
- **Auth:** `env.OPENAI_API_KEY` (Cloudflare Worker secret)
- **Timeout:** 10 seconds per call
- **Cache:** Output stored in `insight_snapshots` D1 table keyed by ISO week. AI is called at most once per child per week; subsequent loads return cached output with `source='cache'`.

**Purpose:** Generate a personalised weekly coaching note for parents summarising their child's financial behaviour — consistency, responsibility, planning horizon, and savings progress — and recommending a parenting action (the "nudge").

**Inputs passed to the model (from `insights.ts` lines 1289–1330):**
| Field | Source |
|---|---|
| `consistency_score` | D1 `insight_snapshots` — % of tasks completed on time |
| `responsibility_score` (first_time_pass_rate) | D1 — % of tasks approved without revision |
| `planning_horizon` | D1 — average days between goal creation and goal-complete |
| `available_balance_pence` | D1 ledger — current available balance |
| `goals_locked_pence` | D1 ledger — balance reserved for active goals |
| `trends.consistency / responsibility / horizon` | Computed delta vs. prior week snapshot |
| `velocity.mode` | Derived — 'seedling' (task-count) or 'professional' (earnings-based) |
| `effort_preference` | Derived — 'high_yield' or 'steady' based on task selection patterns |
| `locale` | Family setting — 'en' or 'pl' |
| `child_name` | Child profile display_name (nickname — no legal name) |
| Jar allocations (if enabled) | Spend/Save/Give jar balances |
| Co-parent name and family surname | Family record (used for persona framing only) |

**Outputs:** JSON object `{ observation, behavioral_root, the_nudge }` — three coaching text strings displayed to the parent inside `InsightsTab.tsx → LiveBriefingCard`.

**Decision-making:** Informational only. The AI observation is displayed to the parent as guidance. No automated decisions with binding effect. All chore approvals, reward payments, and account-level decisions are made by the parent.

**Fallback:** If the AI call times out or errors, `buildRuleBasedBriefing()` returns a hardcoded decision-tree response using the same data fields. Fallback content is rendered with `source='fallback'` and does **not** carry the "AI-generated" disclosure label.

**Risk classification:** Limited risk (EU AI Act Article 50 transparency obligations apply).  
[OWNER TO COMPLETE: confirm this classification. Inputs include a child's financial behaviour data and the output influences parenting decisions about a minor. If the system is characterised as influencing significant decisions about children, Annex III item 3(a) may apply — see Annex III flag below.]

**Disclosure in place:**
- In-app: "AI-generated" badge in the `LiveBriefingCard` header; "AI-generated coaching note" in the card footer. Both conditional on `briefing.source !== 'fallback'`. Added 2026-06-29 (`InsightsTab.tsx`).
- Privacy policy: Section 9 of privacy policy v1.4 (deployed 2026-06-28).

**Children's data involved:** Yes. Child activity data (scores, balance, goals) is an input. The child is identified by nickname only (no legal name passed to the API).

**Human oversight mechanism:** Parent reviews all AI outputs before taking any action. The parent decides whether to follow the nudge recommendation, share it with the child, or discard it.

**PostHog event capture:** `$ai_generation` event fired on each successful AI call (`worker/src/lib/posthog.ts`). Captures model, latency, input messages, and output text for LLM observability. Fire-and-forget; non-blocking.

**Known limitations:** [OWNER TO COMPLETE — e.g. model accuracy on edge cases, language quality for Polish persona, behaviour at low data volumes (< 3 tasks / < 7 days history)]

---

## AI System 2: Child Mentor Chat

**Source file:** `worker/src/routes/chat.ts`, route `POST /api/chat`

- **Provider:** OpenAI
- **Model:** `gpt-4o-mini`
- **API endpoint:** `https://api.openai.com/v1/chat/completions`
- **Auth:** `env.OPENAI_API_KEY` (Cloudflare Worker secret)
- **Timeout:** 10 seconds per call
- **Cache:** None — each message generates a fresh response.

**Purpose:** Real-time conversational coaching for the child. The child sends a message; the AI responds in-character as a persona (Collaborative Coach / Performance Coach / Master Mentor depending on locale) grounded in the child's real financial data and behavioural signals.

**Inputs passed to the model (from `chat.ts` system prompt construction):**
| Field | Source |
|---|---|
| Child's message | User input (max 500 chars) |
| `balance` | D1 ledger — current balance |
| `goals` | D1 — active goals and progress |
| `velocity` | Derived — recent earning rate |
| `reliability_rating` | Derived — task completion rate |
| `consecutive_low_confidence` | D1 — count of low-confidence photo submissions (integrity signal) |
| `batching_detected` | EXIF metadata analysis — chores completed in rapid succession |
| `is_burner` | Derived — balance hit zero within 24h of receipt |
| `is_stagnant` | Derived — 14+ days no chore activity after high activity |
| `inflation_nudge` | Derived — chore reward recently increased |
| `is_hoarder` | Derived — balance > £100, no spending in 60+ days |
| `overdue_chore_count` | D1 — number of assigned chores past due |
| ~~`distinct_ips_7d`~~ | Removed 2026-06-29 — IP/location-adjacent signal eliminated from AI inputs to avoid Annex III high-risk classification. |
| `locale` | Family setting — 'en', 'en-US', or 'pl' |

**Outputs:** `{ reply, pillar, data_points, app_view, locale, unlock_slug }` — the AI reply text plus metadata. The `unlock_slug` triggers curriculum module unlock if the conversation matches a module topic.

**Decision-making:** Informational only. The AI reply is coaching text directed at the child. No automated decisions with binding effect.

**Disclosure in place:**
- **Frontend UI not yet built.** The chat API endpoint exists in the worker but there is no corresponding frontend component in the app as of 2026-06-29. When the frontend is built, an "AI-generated" disclosure label must be added inline with the chat reply, per the same pattern as AI System 1.
- Privacy policy: Section 9 of privacy policy v1.4 covers AI coaching broadly.

**Children's data involved:** Yes. The child is the direct user of this feature. Multiple behavioural signals derived from the child's activity are injected into the system prompt.

**Human oversight mechanism:** Parent is not present in the chat session. The AI acts directly with the child. The parent retains overall account control and can review child activity history. [OWNER TO COMPLETE: consider whether additional oversight is needed given the child is the direct recipient with no parent in the loop.]

**PostHog event capture:** `$ai_generation` event fired per chat message (`worker/src/lib/posthog.ts`).

**Known limitations:** [OWNER TO COMPLETE]

---

## Annex III Risk Assessment — resolved 2026-06-29

**Item:** Module unlock matrix in `worker/src/routes/chat.ts`, function `detectUnlockSlug()`.

**Previous concern:** The `distinct_ips_7d` trigger used IP/location-adjacent data to characterise a child's behaviour and influence which curriculum modules they could access — a combination that risked Annex III item 3(a) classification (educational access systems for children).

**Resolution:** `distinct_ips_7d` has been removed from the AI input pipeline entirely (2026-06-29). The field is no longer fetched, passed to the AI, or used in pillar selection or prompt construction. The module unlock mechanism now operates solely on in-app behavioural signals (task completion, spending patterns, goal progress) with no location-adjacent data.

**Residual question:** [OWNER TO COMPLETE] The module unlock mechanic still determines which educational content a child accesses based on behavioural profiling (without location data). Seek specialist legal advice on whether this residual pattern reaches Annex III item 3(a). The removal of IP signals significantly reduces the risk profile; the remaining signals are all derived from explicit app interactions rather than passive location inference.

---

## PostHog opt-out — confirmation

PostHog is initialised in `app/src/lib/analytics.ts`, invoked from `app/src/main.tsx` (line 15).

The following opt-outs are applied **at the initialisation layer**, before any events are captured:

| Control | Implementation |
|---|---|
| Session replay disabled for all child devices | `disable_session_recording: isChildDevice()` at init (line 83). `isChildDevice()` checks `getDeviceIdentity()?.role === 'child'`. |
| Person profiles only for identified users | `person_profiles: 'identified_only'` (line 79) — no anonymous profiles created. |
| Analytics consent gate | `hasAnalyticsConsent()` reads `mc_analytics_consent` from localStorage. PostHog only activated post-consent. |
| Child replay guard in `replayAllowed()` | Returns `false` if `isChildDevice()` is true, even if family has accepted analytics. |
| Consent revocation | `revokeAnalyticsConsent()` calls `posthog.opt_out_capturing()` mid-session without reload. |

All five controls are in place at the initialisation layer. Child session replay is never enabled regardless of parental consent status.

---

*This document is an internal accountability record under EU AI Act Article 4 and UK ICO Children's Code. It is not legal advice. It should be reviewed by a data-protection and AI-law specialist before being relied upon, particularly in relation to the Annex III flag above.*
