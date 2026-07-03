---
feature: 07-ai-mentor-insights
title: AI Mentor & Insights
---

### Purpose

Gives parents a weekly AI-generated behavioural briefing on each child (task consistency, responsibility, planning horizon) grounded in real ledger and chore data. Gives children a conversational AI tutor that delivers financial literacy lessons tied to their actual balance and spending activity, unlocking Learning Lab modules as they progress.

### Methodology

**Parent Insights (`GET /api/insights/:childId`)**
- Aggregates chore completions, ledger credits/debits, and goal progress into KPI gauges (consistency, responsibility, planning horizon) with week-on-week deltas from a cached `insight_snapshots` D1 table.
- Calls `@cf/meta/llama-3-8b-instruct` via Cloudflare AI to generate a persona-aware briefing (Orchard Lead for EN, Mistrz Sadu for PL) with a 5-second timeout and rule-based fallback. Result is cached in D1 so AI runs once per week per child.
- Jar signal analysis surfaces anomalous spending/saving ratios, stale goals, and surplus triggers (balance > £100 or all goals funded).
- Returns period-toggle data (7d / 30d / 90d) for sparkline cards rendered in `InsightsTab.tsx`.

**Child AI Chat (`POST /api/chat`)**
- Selects one of five financial literacy pillars based on the child's balance, spending history, and goal state. Builds a locale-aware system prompt (UK/US/PL) including the child's current jar balances and recent transactions as grounding context.
- Sends the message to `@cf/meta/llama-3-8b-instruct` with streaming disabled; enforces a per-child rate limit via D1 (10 messages per day).
- Completing a chat exchange unlocks Learning Lab modules. `GET /api/chat/modules` returns the ordered unlock list; `GET /api/chat/history` provides paginated message history.

**Learning Lab (`ModuleReader.tsx`)**
- Four-act reader: Hook → Lesson → Lab → Quiz. Acts are tracked in local state; completion posts to the backend to mark the module done.

**InsightsTab.tsx**
- Parent-facing dashboard combining sparkline KPI cards, the AI briefing card (typewriter animation for `source=ai`), jar balance bar, and a Learning Lab section listing locked/unlocked modules.

### Dependencies

- **External packages**: `@cloudflare/ai` (Llama 3 8B inference), Cloudflare D1 (snapshots, chat history, rate-limit counters)
- **Internal modules**: `worker/src/routes/insights.ts`, `chat.ts`, `chat-history.ts`, `chat-modules.ts`; shared auth middleware; `app/src/lib/api.ts` for fetch wrappers
- **APIs / services**: Cloudflare Workers AI (`@cf/meta/llama-3-8b-instruct`); Morechard `/api/jars`, `/api/goals`, `/api/chores` endpoints for context hydration
