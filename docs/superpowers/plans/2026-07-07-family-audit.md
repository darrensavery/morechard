# Family Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly, family-wide AI spending/earning/saving rollup for parents (Phase 5 "Audit" roadmap item), and standardize the EU AI Act Article 50 "AI-generated" disclosure across every AI-authored card in the app.

**Architecture:** New D1 table `family_audit_snapshots` caches one row per family per calendar month. A new worker route `GET /api/family-audit` aggregates ledger/spending/jar_movements/give_requests data across all children in the family, picks a "flagged" child via a Pillar-priority ladder (mirrors the existing per-child weekly briefing logic), calls `gpt-4o-mini` for narrative text with a rule-based fallback on error/timeout, and caches the result. A new `FamilyAuditCard` React component renders it in the parent Insights tab. A shared `AiDisclosurePill` component (extracted from existing inline JSX) is reused on the new card and retrofitted onto the existing child-facing nudge banner.

**Tech Stack:** Cloudflare Workers (TypeScript) + D1 (SQLite), React 18 + Vite + TypeScript, Vitest + React Testing Library, OpenAI `gpt-4o-mini` via raw `fetch`.

## Global Constraints

- Never use `wrangler d1` with `--local` — local D1 is dead per project rules.
- Migrations are applied to `morechard-dev` first (no `--env` flag), verified, then to `morechard` with `--env production`.
- All monetary values are stored and transmitted as integer pence.
- UK English spelling throughout any user-facing copy ("Wellbeing", "Organise", etc.).
- First-person plural ("We", "Us", "Our") in all AI/coaching-voice copy.
- Every AI-generated (not rule-based-fallback) card must show the "AI-generated" disclosure pill (EU AI Act Article 50).
- `has_ai_mentor` / plan gating is NOT applied to this feature — it follows the existing Insights tab precedent of being always-visible (see `mentor_briefing` in `insights.ts`, which has no plan gate).

---

## File Structure

| File | Responsibility |
|---|---|
| `worker/migrations/0076_family_audit_snapshots.sql` | New cache table |
| `worker/src/lib/familyAudit.ts` | Pure, unit-testable logic: month-key helpers, flagged-child picker, rule-based text generator |
| `worker/src/routes/family-audit.ts` | `GET /api/family-audit` handler — DB aggregation, cache read/write, LLM call |
| `worker/src/index.ts` | Route registration (modify) |
| `app/src/components/ui/PremiumShell.tsx` | Add `AiDisclosurePill` export (modify) |
| `app/src/lib/api.ts` | Add `FamilyAuditData` type + `getFamilyAudit()` client (modify) |
| `app/src/components/dashboard/FamilyAuditCard.tsx` | New card component |
| `app/src/components/dashboard/InsightsTab.tsx` | Mount `FamilyAuditCard`; refactor inline pill to use `AiDisclosurePill` (modify) |
| `app/src/components/child/ChildNudgeBanner.tsx` | Retrofit disclosure to use `AiDisclosurePill` (modify) |
| `worker/src/lib/familyAudit.test.ts` | Unit tests for pure logic |
| `app/src/components/ui/__tests__/PremiumShell.test.tsx` | Unit test for `AiDisclosurePill` |
| `app/src/components/dashboard/__tests__/FamilyAuditCard.test.tsx` | Component test |
| `app/src/components/child/__tests__/ChildNudgeBanner.test.tsx` | Component test |

---

### Task 1: D1 migration for `family_audit_snapshots`

**Files:**
- Create: `worker/migrations/0076_family_audit_snapshots.sql`

**Interfaces:**
- Produces: table `family_audit_snapshots` with columns `family_id, month_key, total_earned_pence, total_spent_pence, total_saved_pence, total_given_pence, flagged_child_id, flagged_pillar, observation, behavioral_root, the_action, source, created_at`, unique on `(family_id, month_key)`.

- [ ] **Step 1: Write the migration file**

```sql
-- 0076_family_audit_snapshots.sql
-- Monthly, family-wide AI spending/earning/saving rollup — cache-on-read,
-- one row per family per calendar month (mirrors insight_snapshots).

CREATE TABLE IF NOT EXISTS family_audit_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id           TEXT NOT NULL REFERENCES families(id),
  month_key           TEXT NOT NULL,  -- 'YYYY-MM'
  total_earned_pence  INTEGER NOT NULL DEFAULT 0,
  total_spent_pence   INTEGER NOT NULL DEFAULT 0,
  total_saved_pence   INTEGER NOT NULL DEFAULT 0,
  total_given_pence   INTEGER NOT NULL DEFAULT 0,
  flagged_child_id    TEXT REFERENCES users(id),
  flagged_pillar      TEXT,
  observation         TEXT,
  behavioral_root     TEXT,
  the_action          TEXT,
  source              TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_audit_month
  ON family_audit_snapshots (family_id, month_key);
```

- [ ] **Step 2: Apply to morechard-dev**

Run (from `worker/`):
```bash
npx wrangler d1 migrations apply morechard-dev --remote
```
Expected: output lists `0076_family_audit_snapshots.sql` as applied, no errors.

- [ ] **Step 3: Verify the table exists**

Run:
```bash
npx wrangler d1 execute morechard-dev --remote --command="SELECT sql FROM sqlite_master WHERE name='family_audit_snapshots'"
```
Expected: one row showing the `CREATE TABLE` statement.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0076_family_audit_snapshots.sql
git commit -m "feat: add family_audit_snapshots migration"
```

---

### Task 2: Shared `AiDisclosurePill` component + refactor existing usage

**Files:**
- Modify: `app/src/components/ui/PremiumShell.tsx`
- Modify: `app/src/components/dashboard/InsightsTab.tsx:20,540-546`
- Test: `app/src/components/ui/__tests__/PremiumShell.test.tsx`

**Interfaces:**
- Produces: `AiDisclosurePill(): JSX.Element` exported from `PremiumShell.tsx` — no props.

- [ ] **Step 1: Write the failing test**

```tsx
// app/src/components/ui/__tests__/PremiumShell.test.tsx
import { render, screen } from '@testing-library/react'
import { AiDisclosurePill } from '../PremiumShell'
import { describe, it, expect } from 'vitest'

describe('AiDisclosurePill', () => {
  it('renders the AI-generated disclosure text', () => {
    render(<AiDisclosurePill />)
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/ui/__tests__/PremiumShell.test.tsx`
Expected: FAIL — `AiDisclosurePill` is not exported from `../PremiumShell`.

- [ ] **Step 3: Add the component to PremiumShell.tsx**

Add after the existing `ProBadge` export in `app/src/components/ui/PremiumShell.tsx`:

```tsx
/**
 * EU AI Act Article 50 disclosure — shown on every card whose content is
 * genuinely AI-generated (never on deterministic rule-based fallback text).
 */
export function AiDisclosurePill() {
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color:      'rgba(164,196,181,0.85)',
        border:     '1px solid rgba(255,255,255,0.1)',
      }}
    >
      AI-generated
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/ui/__tests__/PremiumShell.test.tsx`
Expected: PASS

- [ ] **Step 5: Refactor InsightsTab.tsx to use the shared component**

In `app/src/components/dashboard/InsightsTab.tsx`, change the import on line 20:

```tsx
import { PremiumShell, MentorAvatar, ProBadge, injectPremiumStyles } from '../ui/PremiumShell'
```
to:
```tsx
import { PremiumShell, MentorAvatar, ProBadge, AiDisclosurePill, injectPremiumStyles } from '../ui/PremiumShell'
```

Then replace the inline pill block (lines 540-546):

```tsx
                  {/* EU AI Act Article 50 disclosure — visible on every AI-generated card */}
                  {briefing.source !== 'fallback' && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(164,196,181,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      AI-generated
                    </span>
                  )}
```
with:
```tsx
                  {/* EU AI Act Article 50 disclosure — visible on every AI-generated card */}
                  {briefing.source !== 'fallback' && <AiDisclosurePill />}
```

- [ ] **Step 6: Run the full frontend test suite to confirm no regression**

Run: `cd app && npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/ui/PremiumShell.tsx app/src/components/dashboard/InsightsTab.tsx app/src/components/ui/__tests__/PremiumShell.test.tsx
git commit -m "refactor: extract shared AiDisclosurePill component"
```

---

### Task 3: Pure logic — month keys, flagged-child picker, rule-based text

**Files:**
- Create: `worker/src/lib/familyAudit.ts`
- Test: `worker/src/lib/familyAudit.test.ts`

**Interfaces:**
- Produces:
  - `getMonthKey(date: Date): string` — e.g. `'2026-07'`
  - `getMonthStartEpoch(monthKey: string): number` — UTC seconds
  - `interface ChildMonthSignal { child_id: string; child_name: string; available_balance_pence: number; goals_locked_pence: number; planning_horizon: number | null; responsibility_score: number | null }`
  - `interface FlaggedChild { child_id: string; child_name: string; pillar: FlaggedPillar }`
  - `type FlaggedPillar = 'PILLAR_5_SOCIAL_RESPONSIBILITY' | 'PILLAR_3_OPPORTUNITY_COST' | 'PILLAR_1_LABOUR_VALUE' | 'PILLAR_4_CAPITAL_MANAGEMENT'`
  - `pickFlaggedChild(signals: ChildMonthSignal[]): FlaggedChild | null`
  - `interface FamilyTotals { total_earned_pence: number; total_spent_pence: number; total_saved_pence: number; total_given_pence: number }`
  - `interface FamilyAuditContent { observation: string; behavioral_root: string; the_action: string }`
  - `buildRuleBasedFamilyAudit(totals: FamilyTotals, flagged: FlaggedChild, familyName: string): FamilyAuditContent`
- Consumed by: Task 4 (`family-audit.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// worker/src/lib/familyAudit.test.ts
import { describe, it, expect } from 'vitest';
import {
  getMonthKey, getMonthStartEpoch, pickFlaggedChild, buildRuleBasedFamilyAudit,
  type ChildMonthSignal,
} from './familyAudit.js';

describe('getMonthKey', () => {
  it('formats a July 2026 date as 2026-07', () => {
    expect(getMonthKey(new Date(Date.UTC(2026, 6, 7)))).toBe('2026-07');
  });
  it('pads single-digit months', () => {
    expect(getMonthKey(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01');
  });
});

describe('getMonthStartEpoch', () => {
  it('returns the UTC epoch seconds for the 1st of the given month', () => {
    const expected = Math.floor(Date.UTC(2026, 6, 1) / 1000);
    expect(getMonthStartEpoch('2026-07')).toBe(expected);
  });
});

describe('pickFlaggedChild', () => {
  const base: ChildMonthSignal = {
    child_id: 'c1', child_name: 'Logan',
    available_balance_pence: 0, goals_locked_pence: 0,
    planning_horizon: 50, responsibility_score: 90,
  };

  it('returns null for an empty signal list', () => {
    expect(pickFlaggedChild([])).toBeNull();
  });

  it('prioritises Pillar 5 when a child has a surplus balance over £100', () => {
    const signals = [base, { ...base, child_id: 'c2', child_name: 'Mia', available_balance_pence: 10001 }];
    const result = pickFlaggedChild(signals);
    expect(result).toEqual({ child_id: 'c2', child_name: 'Mia', pillar: 'PILLAR_5_SOCIAL_RESPONSIBILITY' });
  });

  it('falls to Pillar 3 when planning horizon is low and no surplus exists', () => {
    const signals = [base, { ...base, child_id: 'c2', child_name: 'Mia', planning_horizon: 10 }];
    const result = pickFlaggedChild(signals);
    expect(result).toEqual({ child_id: 'c2', child_name: 'Mia', pillar: 'PILLAR_3_OPPORTUNITY_COST' });
  });

  it('falls to Pillar 1 when responsibility score is low', () => {
    const signals = [base, { ...base, child_id: 'c2', child_name: 'Mia', responsibility_score: 40 }];
    const result = pickFlaggedChild(signals);
    expect(result).toEqual({ child_id: 'c2', child_name: 'Mia', pillar: 'PILLAR_1_LABOUR_VALUE' });
  });

  it('defaults to Pillar 4, picking the highest planning horizon, when no other signal fires', () => {
    const signals = [base, { ...base, child_id: 'c2', child_name: 'Mia', planning_horizon: 80 }];
    const result = pickFlaggedChild(signals);
    expect(result).toEqual({ child_id: 'c2', child_name: 'Mia', pillar: 'PILLAR_4_CAPITAL_MANAGEMENT' });
  });

  it('treats a single child as its own subject with no comparison', () => {
    const result = pickFlaggedChild([base]);
    expect(result?.child_id).toBe('c1');
  });
});

describe('buildRuleBasedFamilyAudit', () => {
  const totals = { total_earned_pence: 5000, total_spent_pence: 2000, total_saved_pence: 1500, total_given_pence: 500 };

  it('names the correct Pillar for each flagged pillar type', () => {
    const cases: Array<[ChildMonthSignal['planning_horizon'] extends never ? never : string, string]> = [] as never;
    const pillars = ['PILLAR_5_SOCIAL_RESPONSIBILITY', 'PILLAR_3_OPPORTUNITY_COST', 'PILLAR_1_LABOUR_VALUE', 'PILLAR_4_CAPITAL_MANAGEMENT'] as const;
    for (const pillar of pillars) {
      const content = buildRuleBasedFamilyAudit(totals, { child_id: 'c1', child_name: 'Logan', pillar }, 'Thomson');
      expect(content.behavioral_root).toContain(
        pillar === 'PILLAR_5_SOCIAL_RESPONSIBILITY' ? 'Pillar 5' :
        pillar === 'PILLAR_3_OPPORTUNITY_COST'      ? 'Pillar 3' :
        pillar === 'PILLAR_1_LABOUR_VALUE'          ? 'Pillar 1' : 'Pillar 4'
      );
      expect(content.observation).toContain('Logan') ;
      expect(content.the_action.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run src/lib/familyAudit.test.ts`
Expected: FAIL — `./familyAudit.js` does not exist.

- [ ] **Step 3: Implement `familyAudit.ts`**

```ts
// worker/src/lib/familyAudit.ts
//
// Pure, DB-free logic for the monthly Family Audit (Phase 5). Kept separate
// from the route handler so the flagged-child priority ladder and the
// rule-based fallback text can be unit tested without a D1 binding.

export function getMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getMonthStartEpoch(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, 1) / 1000);
}

export interface ChildMonthSignal {
  child_id: string;
  child_name: string;
  available_balance_pence: number;
  goals_locked_pence: number;
  planning_horizon: number | null;      // 0–100 | null (no goals/balance yet)
  responsibility_score: number | null;  // first-time pass rate, 0–100 | null
}

export type FlaggedPillar =
  | 'PILLAR_5_SOCIAL_RESPONSIBILITY'
  | 'PILLAR_3_OPPORTUNITY_COST'
  | 'PILLAR_1_LABOUR_VALUE'
  | 'PILLAR_4_CAPITAL_MANAGEMENT';

export interface FlaggedChild {
  child_id:   string;
  child_name: string;
  pillar:     FlaggedPillar;
}

/**
 * Picks the one child whose pattern most needs a parent's attention this
 * month, using the same Pillar-priority ladder as the per-child weekly
 * briefing's buildRuleBasedBriefing (insights.ts): surplus/Pillar 5 first,
 * then opportunity cost, then labour value, defaulting to capital
 * management (the best performer) when nothing else fires.
 */
export function pickFlaggedChild(signals: ChildMonthSignal[]): FlaggedChild | null {
  if (signals.length === 0) return null;

  const surplus = signals.find(s =>
    s.available_balance_pence > 10000 ||
    (s.goals_locked_pence === 0 && s.available_balance_pence > 0)
  );
  if (surplus) {
    return { child_id: surplus.child_id, child_name: surplus.child_name, pillar: 'PILLAR_5_SOCIAL_RESPONSIBILITY' };
  }

  const spendHeavy = signals.find(s => (s.planning_horizon ?? 50) < 20);
  if (spendHeavy) {
    return { child_id: spendHeavy.child_id, child_name: spendHeavy.child_name, pillar: 'PILLAR_3_OPPORTUNITY_COST' };
  }

  const struggling = signals.find(s => (s.responsibility_score ?? 100) < 60);
  if (struggling) {
    return { child_id: struggling.child_id, child_name: struggling.child_name, pillar: 'PILLAR_1_LABOUR_VALUE' };
  }

  const best = [...signals].sort((a, b) => (b.planning_horizon ?? 0) - (a.planning_horizon ?? 0))[0];
  return { child_id: best.child_id, child_name: best.child_name, pillar: 'PILLAR_4_CAPITAL_MANAGEMENT' };
}

export interface FamilyTotals {
  total_earned_pence: number;
  total_spent_pence:  number;
  total_saved_pence:  number;
  total_given_pence:  number;
}

export interface FamilyAuditContent {
  observation:     string;
  behavioral_root: string;
  the_action:      string;
}

/** Deterministic fallback text — used when the LLM call errors or times out. */
export function buildRuleBasedFamilyAudit(
  totals:      FamilyTotals,
  flagged:     FlaggedChild,
  familyName:  string,
): FamilyAuditContent {
  const earnedDisplay = `£${(totals.total_earned_pence / 100).toFixed(2)}`;
  const spentDisplay  = `£${(totals.total_spent_pence  / 100).toFixed(2)}`;

  switch (flagged.pillar) {
    case 'PILLAR_5_SOCIAL_RESPONSIBILITY':
      return {
        observation:     `We've noted that the ${familyName} family earned ${earnedDisplay} this month, and ${flagged.child_name} is carrying a meaningful surplus balance.`,
        behavioral_root: 'Pillar 5 — Social Responsibility: a funded surplus without a social allocation represents idle capital in behavioural finance terms.',
        the_action:      `You might consider introducing a Social Allocation target for ${flagged.child_name} (e.g. 5–10% of surplus) this month.`,
      };
    case 'PILLAR_3_OPPORTUNITY_COST':
      return {
        observation:     `We've noted that ${flagged.child_name}'s Planning Horizon is low this month, with ${spentDisplay} spent across the family overall.`,
        behavioral_root: 'Pillar 3 — Opportunity Cost: a low Planning Horizon at this stage indicates a preference for immediate value over compounding future returns.',
        the_action:      `You might consider asking ${flagged.child_name} what goal one recent purchase could have moved forward instead.`,
      };
    case 'PILLAR_1_LABOUR_VALUE':
      return {
        observation:     `We've noted a dip in task consistency or first-time pass rate for ${flagged.child_name} this month.`,
        behavioral_root: 'Pillar 1 — Labour Value: variable-quality weeks are part of every growth cycle; the productive question is whether the cause is task scope, motivation, or reward structure.',
        the_action:      `You might consider a short check-in with ${flagged.child_name} about which tasks feel hardest right now.`,
      };
    case 'PILLAR_4_CAPITAL_MANAGEMENT':
    default:
      return {
        observation:     `We've noted a stable month for the ${familyName} family — ${earnedDisplay} earned in total, with ${flagged.child_name} showing the strongest Planning Horizon.`,
        behavioral_root: 'Pillar 4 — Capital Management: sustained stability at high performance is the optimal condition for introducing compound growth concepts.',
        the_action:      `You might consider modelling with ${flagged.child_name} what a 5% annual return would look like on their current savings balance.`,
      };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run src/lib/familyAudit.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/familyAudit.ts worker/src/lib/familyAudit.test.ts
git commit -m "feat: add pure family-audit logic (month keys, flagged-child picker, rule-based fallback)"
```

---

### Task 4: `GET /api/family-audit` route handler

**Files:**
- Create: `worker/src/routes/family-audit.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `getMonthKey`, `getMonthStartEpoch`, `pickFlaggedChild`, `buildRuleBasedFamilyAudit`, `ChildMonthSignal`, `FamilyTotals`, `FlaggedChild` from `../lib/familyAudit.js` (Task 3); `getFamilyContext` from `../lib/intelligence.js`; `captureAiGeneration` from `../lib/posthog.js`; `json`, `error` from `../lib/response.js`; `JwtPayload` from `../lib/jwt.js`; `Env` from `../types.js`.
- Produces: `handleGetFamilyAudit(request: Request, env: Env): Promise<Response>`, registered at `GET /api/family-audit`.

- [ ] **Step 1: Implement the route handler**

```ts
// worker/src/routes/family-audit.ts
//
// GET /api/family-audit?family_id=
//
// Monthly, family-wide spending/earning/saving rollup for parents.
// Cached one row per family per calendar month in family_audit_snapshots —
// on cache miss, calls gpt-4o-mini for narrative text (with a rule-based
// fallback on error/timeout), mirroring the per-child weekly briefing
// pattern in insights.ts.

import type { Env } from '../types.js';
import { json, error } from '../lib/response.js';
import { JwtPayload } from '../lib/jwt.js';
import { captureAiGeneration } from '../lib/posthog.js';
import { getFamilyContext } from '../lib/intelligence.js';
import {
  getMonthKey, getMonthStartEpoch, pickFlaggedChild, buildRuleBasedFamilyAudit,
  ChildMonthSignal, FamilyTotals, FlaggedChild,
} from '../lib/familyAudit.js';

type AuthedRequest = Request & { auth: JwtPayload };

export async function handleGetFamilyAudit(request: Request, env: Env): Promise<Response> {
  const auth      = (request as AuthedRequest).auth;
  const family_id = new URL(request.url).searchParams.get('family_id');

  if (!family_id) return error('family_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child') return error('Forbidden', 403);

  const monthKey   = getMonthKey(new Date());
  const monthStart = getMonthStartEpoch(monthKey);

  const cached = await env.DB.prepare(`
    SELECT total_earned_pence, total_spent_pence, total_saved_pence, total_given_pence,
           flagged_child_id, flagged_pillar, observation, behavioral_root, the_action, source
    FROM family_audit_snapshots WHERE family_id = ? AND month_key = ?
  `).bind(family_id, monthKey).first<{
    total_earned_pence: number; total_spent_pence: number; total_saved_pence: number; total_given_pence: number;
    flagged_child_id: string; flagged_pillar: string;
    observation: string; behavioral_root: string; the_action: string; source: 'rule_based' | 'ai';
  }>();

  if (cached) {
    return json({
      month: monthKey,
      totals: {
        total_earned_pence: cached.total_earned_pence,
        total_spent_pence:  cached.total_spent_pence,
        total_saved_pence:  cached.total_saved_pence,
        total_given_pence:  cached.total_given_pence,
      },
      flagged_child_id: cached.flagged_child_id,
      flagged_pillar:   cached.flagged_pillar,
      observation:      cached.observation,
      behavioral_root:  cached.behavioral_root,
      the_action:       cached.the_action,
      source:           cached.source,
    });
  }

  const familyCtx = await getFamilyContext(env.DB, family_id);
  if (familyCtx.child_ids.length === 0) return json({ month: monthKey, is_empty: true });

  const placeholders = familyCtx.child_ids.map(() => '?').join(',');

  const [earnedRow, spentRow, savedRow, givenRow] = await Promise.all([
    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total FROM ledger
      WHERE family_id=? AND entry_type='credit' AND created_at >= ? AND child_id IN (${placeholders})
    `).bind(family_id, monthStart, ...familyCtx.child_ids).first<{ total: number }>(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total FROM spending
      WHERE family_id=? AND spent_at >= ? AND child_id IN (${placeholders})
    `).bind(family_id, monthStart, ...familyCtx.child_ids).first<{ total: number }>(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(delta),0) AS total FROM jar_movements
      WHERE family_id=? AND jar='save' AND kind='allocation' AND created_at >= ? AND child_id IN (${placeholders})
    `).bind(family_id, monthStart, ...familyCtx.child_ids).first<{ total: number }>(),

    env.DB.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total FROM give_requests
      WHERE family_id=? AND status='fulfilled' AND fulfilled_at >= ? AND child_id IN (${placeholders})
    `).bind(family_id, monthStart, ...familyCtx.child_ids).first<{ total: number }>(),
  ]);

  const totals: FamilyTotals = {
    total_earned_pence: earnedRow?.total ?? 0,
    total_spent_pence:  spentRow?.total  ?? 0,
    total_saved_pence:  savedRow?.total  ?? 0,
    total_given_pence:  givenRow?.total  ?? 0,
  };

  if (totals.total_earned_pence === 0 && totals.total_spent_pence === 0) {
    return json({ month: monthKey, is_empty: true });
  }

  const signals: ChildMonthSignal[] = [];
  for (let i = 0; i < familyCtx.child_ids.length; i++) {
    const childId   = familyCtx.child_ids[i];
    const childName = familyCtx.child_names[i];

    const [balRow, goalsRow, completionRow] = await Promise.all([
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) AS bal
        FROM ledger WHERE family_id=? AND child_id=?
      `).bind(family_id, childId).first<{ bal: number }>(),

      env.DB.prepare(`
        SELECT COALESCE(SUM(target_amount - current_saved_pence),0) AS locked
        FROM goals WHERE family_id=? AND child_id=? AND archived=0 AND target_amount > current_saved_pence
      `).bind(family_id, childId).first<{ locked: number }>().catch(() => ({ locked: 0 })),

      env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(CASE WHEN attempt_count=1 THEN 1 ELSE 0 END) AS first_time
        FROM completions WHERE family_id=? AND child_id=? AND status='completed' AND resolved_at >= ?
      `).bind(family_id, childId, monthStart).first<{ total: number; first_time: number }>(),
    ]);

    const availableBal    = Math.max(0, balRow?.bal ?? 0);
    const goalsLocked     = goalsRow?.locked ?? 0;
    const totalHeld       = availableBal + goalsLocked;
    const totalCompleted  = completionRow?.total ?? 0;

    signals.push({
      child_id:                childId,
      child_name:              childName,
      available_balance_pence: availableBal,
      goals_locked_pence:      goalsLocked,
      planning_horizon:        totalHeld > 0 ? Math.round((goalsLocked / totalHeld) * 100) : null,
      responsibility_score:    totalCompleted > 0 ? Math.round(((completionRow?.first_time ?? 0) / totalCompleted) * 100) : null,
    });
  }

  const flagged = pickFlaggedChild(signals);
  if (!flagged) return json({ month: monthKey, is_empty: true });

  const content = await generateFamilyAuditContent(env, family_id, totals, flagged, familyCtx.family_name);

  await env.DB.prepare(`
    INSERT INTO family_audit_snapshots
      (family_id, month_key, total_earned_pence, total_spent_pence, total_saved_pence, total_given_pence,
       flagged_child_id, flagged_pillar, observation, behavioral_root, the_action, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    family_id, monthKey,
    totals.total_earned_pence, totals.total_spent_pence, totals.total_saved_pence, totals.total_given_pence,
    flagged.child_id, flagged.pillar,
    content.observation, content.behavioral_root, content.the_action, content.source,
  ).run();

  return json({
    month: monthKey,
    totals,
    flagged_child_id: flagged.child_id,
    flagged_pillar:   flagged.pillar,
    ...content,
  });
}

interface GeneratedContent {
  observation:     string;
  behavioral_root: string;
  the_action:      string;
  source:          'ai' | 'rule_based';
}

async function generateFamilyAuditContent(
  env:        Env,
  familyId:   string,
  totals:     FamilyTotals,
  flagged:    FlaggedChild,
  familyName: string,
): Promise<GeneratedContent> {
  const systemPrompt = `You are the 'Orchard Lead', a collaborative financial coach for parents. \
Your goal is to analyse a family's month of financial behaviour data across ALL of their children \
combined, and produce a professional family-wide executive briefing grounded in the Morechard \
Financial Literacy Matrix.

THE LITERACY MATRIX (your mandatory syllabus):
- Pillar 1 — Labour Value ("The Toil"): Money is stored energy; link tasks to Purchasing Power.
- Pillar 2 — Delayed Gratification ("The Season"): The wait for a bigger harvest; Needs vs. Wants.
- Pillar 3 — Opportunity Cost ("Pruning the Path"): Every "Yes" to a small spend is a "No" to a major goal.
- Pillar 4 — Capital Management ("The Savings Grove"): Compound Interest (Growth) and Inflation (Decay).
- Pillar 5 — Social Responsibility ("The Overhang"): Using surplus harvest to contribute to the Community Forest.

You have already been told which child and which Pillar to focus on — do not choose a different one.
Reference the flagged child by name and ground the observation in the family totals provided.

CONSTRAINTS:
- Use first-person plural ("We", "Us", "Our") throughout.
- Tone: supportive, egalitarian, collaborative. No chatbot fluff or excessive praise.
- Choice Architecture: present options for the parent ("You might consider..."); never dictate.
- UK English: "Wellbeing", "Pence", "Organise", "Behaviour", "Recognise".
- behavioral_root MUST name the given Pillar explicitly.
- Respond ONLY with a valid JSON object. No markdown, no commentary, no extra fields.

Response schema (strict):
{
  "observation": "<1 sentence — a statement of fact based on the family totals and flagged child>",
  "behavioral_root": "<1 sentence — names the given Pillar and links it to a future financial literacy outcome>",
  "the_action": "<1 sentence — a concrete option for the parent, framed as a choice>"
}`;

  const userPrompt = JSON.stringify({
    family_name:   familyName,
    totals,
    flagged_child: flagged.child_name,
    flagged_pillar: flagged.pillar,
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
  const traceId = crypto.randomUUID();
  const t0      = Date.now();

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages,
        max_tokens:      350,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);

    const data   = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw    = data.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as Partial<GeneratedContent>;

    if (!parsed.observation || !parsed.behavioral_root || !parsed.the_action) {
      throw new Error('Incomplete AI response schema');
    }

    captureAiGeneration(env, {
      distinctId:     familyId,
      traceId,
      spanName:       'family_audit',
      model:          'gpt-4o-mini',
      provider:       'openai',
      input:          messages,
      outputText:     raw,
      latencySeconds: (Date.now() - t0) / 1000,
    });

    return { observation: parsed.observation, behavioral_root: parsed.behavioral_root, the_action: parsed.the_action, source: 'ai' };
  } catch (err) {
    captureAiGeneration(env, {
      distinctId:     familyId,
      traceId,
      spanName:       'family_audit',
      model:          'gpt-4o-mini',
      provider:       'openai',
      input:          messages,
      latencySeconds: (Date.now() - t0) / 1000,
      isError:        true,
      errorMessage:   err instanceof Error ? err.message : String(err),
    });

    const fallback = buildRuleBasedFamilyAudit(totals, flagged, familyName);
    return { ...fallback, source: 'rule_based' };
  }
}
```

- [ ] **Step 2: Register the route in `index.ts`**

Add the import near the existing `child-nudges` import (around line 196):

```ts
import { handleGetFamilyAudit } from './routes/family-audit.js';
```

Add the route registration near the `/api/insights` line (around line 628):

```ts
  if (path === '/api/family-audit' && method === 'GET') return withAuth(request, auth, env, handleGetFamilyAudit);
```

- [ ] **Step 3: Type-check the worker**

Run: `cd worker && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Manual smoke test against morechard-dev**

Run the worker locally against the remote dev DB (per `npm run dev` in repo root), then from another terminal:
```bash
curl -s "http://localhost:8787/api/family-audit?family_id=<a real dev family_id>" \
  -H "Authorization: Bearer <a valid parent JWT from that family>"
```
Expected: JSON response with either `is_empty: true` (fresh/empty family) or a full `totals` + `observation`/`behavioral_root`/`the_action`/`source` payload.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/family-audit.ts worker/src/index.ts
git commit -m "feat: add GET /api/family-audit route with LLM + rule-based fallback"
```

---

### Task 5: Frontend API client

**Files:**
- Modify: `app/src/lib/api.ts`

**Interfaces:**
- Produces: `interface FamilyAuditData`, `getFamilyAudit(family_id: string): Promise<FamilyAuditData>`.
- Consumed by: Task 6 (`FamilyAuditCard.tsx`).

- [ ] **Step 1: Add the type and client function**

Add near the existing `ChildNudge` types (after line 1323, the end of the child-nudges block) in `app/src/lib/api.ts`:

```ts
export interface FamilyAuditData {
  month:             string;
  is_empty?:         boolean;
  totals?: {
    total_earned_pence: number;
    total_spent_pence:  number;
    total_saved_pence:  number;
    total_given_pence:  number;
  };
  flagged_child_id?:   string;
  flagged_pillar?:     string;
  observation?:        string;
  behavioral_root?:    string;
  the_action?:         string;
  source?:             'ai' | 'rule_based';
}

export async function getFamilyAudit(family_id: string): Promise<FamilyAuditData> {
  return request(`/api/family-audit?family_id=${family_id}`);
}
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd app && npx tsc -b --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat: add getFamilyAudit API client function"
```

---

### Task 6: `FamilyAuditCard` component + InsightsTab integration

**Files:**
- Create: `app/src/components/dashboard/FamilyAuditCard.tsx`
- Modify: `app/src/components/dashboard/InsightsTab.tsx`
- Test: `app/src/components/dashboard/__tests__/FamilyAuditCard.test.tsx`

**Interfaces:**
- Consumes: `getFamilyAudit`, `FamilyAuditData` from `../../lib/api.js` (Task 5); `PremiumShell`, `MentorAvatar`, `AiDisclosurePill`, `injectPremiumStyles` from `../ui/PremiumShell.js` (Task 2).
- Produces: `FamilyAuditCard({ familyId: string }): JSX.Element | null`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/src/components/dashboard/__tests__/FamilyAuditCard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FamilyAuditCard } from '../FamilyAuditCard'
import * as api from '../../../lib/api'

afterEach(() => vi.restoreAllMocks())

describe('FamilyAuditCard', () => {
  it('renders totals and observation text when data is present', async () => {
    vi.spyOn(api, 'getFamilyAudit').mockResolvedValue({
      month: '2026-07',
      totals: { total_earned_pence: 5000, total_spent_pence: 2000, total_saved_pence: 1500, total_given_pence: 500 },
      flagged_child_id: 'c1',
      flagged_pillar: 'PILLAR_4_CAPITAL_MANAGEMENT',
      observation: 'We noted a stable month.',
      behavioral_root: 'Pillar 4 — Capital Management: test root.',
      the_action: 'You might consider a test action.',
      source: 'ai',
    })

    render(<FamilyAuditCard familyId="fam1" />)

    await waitFor(() => expect(screen.getByText('We noted a stable month.')).toBeTruthy())
    expect(screen.getByText('£50.00')).toBeTruthy()
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })

  it('renders nothing when the family has no data yet this month', async () => {
    vi.spyOn(api, 'getFamilyAudit').mockResolvedValue({ month: '2026-07', is_empty: true })

    const { container } = render(<FamilyAuditCard familyId="fam1" />)

    await waitFor(() => expect(container.firstChild).toBeNull())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/dashboard/__tests__/FamilyAuditCard.test.tsx`
Expected: FAIL — `../FamilyAuditCard` does not exist.

- [ ] **Step 3: Implement `FamilyAuditCard.tsx`**

```tsx
// app/src/components/dashboard/FamilyAuditCard.tsx
//
// Monthly, family-wide AI rollup card — sits above the per-child Insights
// dashboard. Fetched once per InsightsTab mount (family-scoped, not
// re-fetched when the parent switches the selected child).

import { useEffect, useState } from 'react'
import { getFamilyAudit } from '../../lib/api'
import type { FamilyAuditData } from '../../lib/api'
import { PremiumShell, MentorAvatar, AiDisclosurePill, injectPremiumStyles } from '../ui/PremiumShell'

interface Props {
  familyId: string
}

const STAT_LABELS = [
  { key: 'total_earned_pence', label: 'Earned' },
  { key: 'total_spent_pence',  label: 'Spent'  },
  { key: 'total_saved_pence',  label: 'Saved'  },
  { key: 'total_given_pence',  label: 'Given'  },
] as const

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export function FamilyAuditCard({ familyId }: Props) {
  const [data, setData]       = useState<FamilyAuditData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { injectPremiumStyles() }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getFamilyAudit(familyId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [familyId])

  if (loading || !data || data.is_empty || !data.totals) return null

  return (
    <PremiumShell>
      <div className="px-4 pt-4 pb-3.5 relative z-10">

        <div className="flex items-center gap-2 mb-3">
          <MentorAvatar />
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#0d9488' }}>
            This Month, Family-Wide
          </span>
          {data.source === 'ai' && <AiDisclosurePill />}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3.5">
          {STAT_LABELS.map(({ key, label }) => (
            <div key={key} className="text-center">
              <p className="text-[13px] font-extrabold tabular-nums" style={{ color: '#f0fdf4' }}>
                {formatPence(data.totals![key])}
              </p>
              <p className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(167,196,181,0.6)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] leading-relaxed" style={{ color: '#e2f5ee' }}>{data.observation}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: '#a7c4b5' }}>{data.behavioral_root}</p>
          <p className="text-[12px] leading-relaxed font-semibold" style={{ color: '#6b9e87' }}>{data.the_action}</p>
        </div>

      </div>
    </PremiumShell>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/dashboard/__tests__/FamilyAuditCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Mount it in InsightsTab.tsx**

In `app/src/components/dashboard/InsightsTab.tsx`, add the import near the other local component imports (after line 23, the `LabSection` import):

```tsx
import { FamilyAuditCard } from './FamilyAuditCard'
```

Then, in the `InsightsTab` root component's returned JSX (around line 71-100), add `<FamilyAuditCard familyId={familyId} />` as the first child, above the period toggle:

```tsx
  return (
    <div className="space-y-4">

      <FamilyAuditCard familyId={familyId} />

      {/* ── Period toggle ── */}
      <div className="flex gap-1.5 bg-[var(--color-surface-alt)] rounded-xl p-1">
```

- [ ] **Step 6: Run the full frontend test suite**

Run: `cd app && npx vitest run`
Expected: all tests PASS, including the two new `FamilyAuditCard` tests.

- [ ] **Step 7: Manual verification in the browser**

Start the dev server (`npm run dev` from repo root), sign in as a parent in a family with at least one completed chore and a ledger credit this month, open the Insights tab, and confirm the Family Audit card renders above the period toggle with the four stat totals and Problem→Insight→Action text.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/dashboard/FamilyAuditCard.tsx app/src/components/dashboard/InsightsTab.tsx app/src/components/dashboard/__tests__/FamilyAuditCard.test.tsx
git commit -m "feat: add FamilyAuditCard to parent Insights tab"
```

---

### Task 7: Retrofit `ChildNudgeBanner` disclosure to the shared pill

**Files:**
- Modify: `app/src/components/child/ChildNudgeBanner.tsx`
- Test: `app/src/components/child/__tests__/ChildNudgeBanner.test.tsx`

**Interfaces:**
- Consumes: `AiDisclosurePill` from `../ui/PremiumShell.js` (Task 2).

- [ ] **Step 1: Write the failing test**

```tsx
// app/src/components/child/__tests__/ChildNudgeBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChildNudgeBanner } from '../ChildNudgeBanner'
import type { ChildNudge } from '../../../lib/api'

function makeNudge(source: ChildNudge['source']): ChildNudge {
  return {
    id: 1,
    trigger_type: 'streak_3',
    screen_context: 'earn',
    orchard_text: 'Three tasks in a row!',
    clean_text: 'Three-day streak.',
    pillar: 'LABOR_VALUE',
    tone: 'encouraging',
    source,
    parent_summary: 'Streak nudge',
    created_at: 0,
  }
}

describe('ChildNudgeBanner', () => {
  it('shows the AI-generated pill when source is ai', () => {
    render(<ChildNudgeBanner nudge={makeNudge('ai')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })

  it('does not show the pill for rule_based nudges', () => {
    render(<ChildNudgeBanner nudge={makeNudge('rule_based')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.queryByText('AI-generated')).toBeNull()
  })

  it('still renders a static attribution footer regardless of source', () => {
    render(<ChildNudgeBanner nudge={makeNudge('rule_based')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Personalised coaching/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/components/child/__tests__/ChildNudgeBanner.test.tsx`
Expected: FAIL — no element with text `AI-generated` for the `'ai'` case (current code only shows "AI coaching note" text, not the pill).

- [ ] **Step 3: Update `ChildNudgeBanner.tsx`**

Change the import (line 15):
```tsx
import { injectPremiumStyles, PremiumShell, MentorAvatar } from '../ui/PremiumShell'
```
to:
```tsx
import { injectPremiumStyles, PremiumShell, MentorAvatar, AiDisclosurePill } from '../ui/PremiumShell'
```

Replace the header block (lines 54-64):
```tsx
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <MentorAvatar accent={accent} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: accent }}>
              Your Orchard Mentor
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(167,196,181,0.7)' }}>
              {pillarLabel}
            </p>
          </div>
```
with:
```tsx
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <MentorAvatar accent={accent} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: accent }}>
                Your Orchard Mentor
              </p>
              {nudge.source === 'ai' && <AiDisclosurePill />}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(167,196,181,0.7)' }}>
              {pillarLabel}
            </p>
          </div>
```

Replace the attribution footer (lines 83-86):
```tsx
        {/* Attribution footer */}
        <p className="text-[10px] mt-3 text-center" style={{ color: 'rgba(107,158,135,0.6)' }}>
          ✦ Your Orchard Mentor · {nudge.source === 'ai' ? 'AI coaching note' : 'Personalised coaching'}
        </p>
```
with:
```tsx
        {/* Attribution footer — the AI-generated distinction is now carried by the header pill above */}
        <p className="text-[10px] mt-3 text-center" style={{ color: 'rgba(107,158,135,0.6)' }}>
          ✦ Your Orchard Mentor · Personalised coaching
        </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/components/child/__tests__/ChildNudgeBanner.test.tsx`
Expected: PASS (all three cases)

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd app && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/child/ChildNudgeBanner.tsx app/src/components/child/__tests__/ChildNudgeBanner.test.tsx
git commit -m "fix: standardize AI disclosure pill on ChildNudgeBanner (EU AI Act Article 50)"
```

---

### Task 8: Deploy migration + worker to production

**Files:** none (operational task)

This task touches the live production database and worker. Confirm with the
user before running the `--env production` commands — do not run them
unattended.

- [ ] **Step 1: Apply the migration to production**

Run (from `worker/`):
```bash
npx wrangler d1 migrations apply morechard --remote --env production
```
Expected: output lists `0076_family_audit_snapshots.sql` as applied.

- [ ] **Step 2: Verify the table exists in production**

Run:
```bash
npx wrangler d1 execute morechard --remote --env production --command="SELECT sql FROM sqlite_master WHERE name='family_audit_snapshots'"
```
Expected: one row showing the `CREATE TABLE` statement.

- [ ] **Step 3: Deploy the worker**

Run (from `worker/`):
```bash
npx wrangler deploy --env production
```
Expected: deploy succeeds, output shows the production worker URL.

- [ ] **Step 4: Smoke-test the live endpoint**

Run:
```bash
curl -s "https://<production-worker-url>/api/family-audit?family_id=<a real prod family_id>" \
  -H "Authorization: Bearer <a valid parent JWT>"
```
Expected: JSON response (either `is_empty: true` or a full payload), no 500 errors.

- [ ] **Step 5: Confirm the Cloudflare Pages frontend deploy**

The frontend deploys automatically on push to `main` (per project convention — no manual step needed once Tasks 1-7 are pushed).

- [ ] **Step 6: Update the roadmap in CLAUDE.md**

In the repo root `CLAUDE.md`, under `### **Phase 5: The AI Mentor (Behavioral Nudging)**`, change:

```diff
- [ ] An AI-driven "Audit" of monthly spending across all children to identify family-wide trends
- [ ] Linking "Seasonal" events (Birthdays, Holidays, School trips) to the Mentor's advice so it can predict future spending needs
+ [x] An AI-driven "Audit" of monthly spending across all children to identify family-wide trends — Family Audit card in parent Insights tab (`GET /api/family-audit`, `family_audit_snapshots` cache table)
```

(The "Seasonal events" line is removed entirely — dropped from scope, no DOB or events data exists to support it; see `docs/superpowers/specs/2026-07-07-family-audit-design.md` Context section.)

Commit:
```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 5 Family Audit complete, drop out-of-scope seasonal events item"
```
