---
feature: 27-child-history-money
title: Child Dashboard (History, Money, Spending)
---

### Purpose

Gives children a self-service view of their earning history, current balances, and spending record without needing parent access. It surfaces approved and in-review chore completions, jar balances (Spend / Save / Give), and spending trends so a child can track progress toward goals independently.

### Methodology

**ChildHistoryTab** (`app/src/components/dashboard/ChildHistoryTab.tsx`)
- Calls `GET /api/history?family_id=&child_id=&limit=500` via `getHistory()`.
- Groups completions by YYYY-MM month and renders collapsible month sections with sort toggle (date-desc / date-asc).
- Each row shows status badge (`completed`, `awaiting_review`, `needs_revision`, `rejected`) and tapping opens a `ChoreDetailSheet`.
- Polls silently every 30 s and on `visibilitychange` to keep status fresh without a full-screen reload.

**ChildMoneyTab** (`app/src/components/dashboard/ChildMoneyTab.tsx`)
- Fires three parallel calls on mount: `GET /api/balance`, `GET /api/goals`, `GET /api/spending`, plus an independent `GET /api/jars` that degrades silently on failure.
- Renders a balance hero card, active goal summaries, and a categorised spending list via `spendCategoryHeading()`.
- Jar support: when jars are enabled, renders `JarCard` tiles (Spend / Save / Give) with split percentages; tapping opens `JarDetailSheet`. Onboarding is handled by `JarOnboardingWizard`; settings by `JarSettingsSheet`.
- A `SpendGuideSheet` explains spend categories. A `GiveRequestSheet` lets the child initiate a give transfer.
- Also polls silently every 30 s and on `visibilitychange`.

**SparklineCard / SparklineExpanded** (`app/src/components/dashboard/SparklineCard.tsx`)
- Renders a 70x32 px SVG sparkline (polyline + area fill) with framer-motion animated scrubbing and milestone markers.
- Colour-coded by trend direction (teal = up, red = down, gold = flat).
- Tapping expands to `SparklineExpanded` for a full-width historical view.

**ChildDashboard orchestration** (`app/src/screens/ChildDashboard.tsx`)
- Passes `familyId`, `childId`, `currency`, and `appView` props down to both tab components.
- Auto-refreshes the full data set every 30 s at the dashboard level as well.

### Dependencies

- **External packages**: React, framer-motion (sparkline animation), lucide-react (icons)
- **Internal modules**: `app/src/lib/api.ts` (`getHistory`, `getBalance`, `getGoals`, `getSpending`, `getJars`, `formatCurrency`), `app/src/lib/spendCategories.ts`, `ChildNudgeBanner`, `JarCard`, `JarDetailSheet`, `JarSettingsSheet`, `JarOnboardingWizard`, `GiveRequestSheet`, `SpendGuideSheet`, `HistoryTab` (re-exports `ChoreDetailSheet`)
- **APIs / services**: Cloudflare D1 (ledger, completions, goals, jars tables via Worker routes `/api/history`, `/api/balance`, `/api/goals`, `/api/spending`, `/api/jars`)
