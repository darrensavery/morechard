---
feature: 08-learning-lab
title: Learning Lab
---

### Purpose

The Learning Lab delivers structured financial literacy education to children across 17 modules, unlocking lessons based on real account activity rather than manual progression. It ensures each module arrives when the child's own data — balance, streak, chore history, goals — makes the lesson directly relevant, not as abstract theory.

### Methodology

**API endpoints:**
- `GET /api/lab/modules` — child-auth only; re-evaluates passive unlock conditions on every call, then returns the child's unlock map, per-module act progress, and a rich `childData` snapshot used to personalise lesson content. All child data queries run in parallel via `Promise.all`.
- `POST /api/lab/modules/:slug/acts/:num/complete` — records act completion (acts 1–4 per module) in `module_act_progress` using `INSERT OR IGNORE`; verifies the module is unlocked before writing; fires a one-time reinforcement nudge for eligible modules (M9b, M11, M14) linking the lesson back to dashboard data.

**Passive unlock evaluation:** `evaluatePassive` runs on every Lab load, detecting trigger conditions that depend on absence of activity (e.g. M14 Inflation after 21 days with no transactions). Failures are swallowed so they never block the Lab from loading.

**UI components:**
- `LabTab` — top-level tab; fetches lab data, renders level-grouped module grid (levels 2–4), dismissable intro card (state persisted in localStorage), and progress summary. Passes `appView` prop to toggle Orchard vs. Clean copy.
- `ModuleReader` — rendered when a module slug is active; receives `childData` for real-data lesson personalisation.
- `LabSection` — supporting layout component.

**Data flow:** On Lab open → passive unlock eval → parallel D1 reads (unlocks, act progress, settings, balance, earnings, chore history, streak, goals, reliability) → JSON response → React state → grid render. Act completion → unlock check → D1 write → optional nudge fire.

### Dependencies

- **External packages**: `nanoid` (ID generation)
- **Internal modules**: `../lib/labTriggers.js` (`evaluatePassive`), `../lib/labCatalogue` (module definitions, level labels, pillars), `./child-nudges.js` (`generateOnceChildNudge`), `../lib/response.js` (`json`, `error`), `../lib/jwt.js` (JWT payload type), `../../lib/api` (`getLabModules`)
- **APIs / services**: Cloudflare D1 (`unlocked_modules`, `module_act_progress`, `user_settings`, `ledger`, `child_streaks`, `goals`, `completions` tables); `child-nudges` endpoint for reinforcement nudge delivery
