# Discovery Card AI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Discovery Phase card's 100%-static template text with an AI-generated (gpt-4o-mini, rule-based fallback) intro + up-to-3-item action list, driven by the child's actual setup state (chores assigned, goal exists, photo check-in on), cached per child and regenerated only when that setup state changes.

**Architecture:** Pure setup-signal logic (candidate menu, signature builder, rule-based fallback text) lives in `worker/src/lib/discoveryBriefing.ts`, mirroring the existing `familyAudit.ts` pattern (DB-free, unit-testable). `insights.ts` queries live setup facts on every request while `is_discovery_phase`, compares against a cached `discovery_briefings` row keyed by `child_id`, and only calls the LLM when the setup signature has changed. The frontend `DiscoveryCard` renders whatever the API returns instead of hardcoded JSX text.

**Tech Stack:** Cloudflare Workers (TypeScript), D1 (SQLite), OpenAI `gpt-4o-mini`, React (Vite app), Vitest.

## Global Constraints

- Never use `--local` on any wrangler command (dead per project CLAUDE.md).
- Migrations containing no triggers use `wrangler d1 migrations apply` (this one has none).
- EU AI Act Article 50 disclosure: `<AiDisclosurePill />` must render whenever content's `source === 'ai'` — same component, same condition pattern as `LiveBriefingCard` and `FamilyAuditCard`.
- English only — no Polish localisation for this card's AI content, matching the precedent already shipped in `family-audit.ts` (which also does not localise; only the weekly per-child briefing does).
- Do not change the Discovery Phase threshold (`allTimeCompleted < 3 || daysSinceFirst < 7`) or the progress ring — out of spec scope.

---

### Task 1: `discoveryBriefing.ts` — pure setup-signal logic

**Files:**
- Create: `worker/src/lib/discoveryBriefing.ts`
- Test: `worker/src/lib/discoveryBriefing.test.ts`

**Interfaces:**
- Produces (used by Task 2):
  - `type DiscoveryCandidateKey = 'ASSIGN_MORE_CHORES' | 'SET_A_GOAL' | 'ENABLE_PHOTO_CHECKIN'`
  - `interface DiscoverySetupFacts { chore_count: number; has_proof_required_chore: boolean; has_active_goal: boolean; jars_enabled: boolean }`
  - `interface DiscoveryBriefingContent { intro: string; actions: string[] }`
  - `buildSetupSignature(facts: DiscoverySetupFacts): string`
  - `getOutstandingCandidates(facts: DiscoverySetupFacts): DiscoveryCandidateKey[]`
  - `buildRuleBasedDiscoveryBriefing(childName: string, outstanding: DiscoveryCandidateKey[]): DiscoveryBriefingContent`

- [ ] **Step 1: Write the failing tests**

Create `worker/src/lib/discoveryBriefing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildSetupSignature, getOutstandingCandidates, buildRuleBasedDiscoveryBriefing,
  type DiscoverySetupFacts,
} from './discoveryBriefing.js';

const allDone: DiscoverySetupFacts = {
  chore_count: 3, has_proof_required_chore: true, has_active_goal: true, jars_enabled: true,
};
const noneDone: DiscoverySetupFacts = {
  chore_count: 0, has_proof_required_chore: false, has_active_goal: false, jars_enabled: false,
};

describe('buildSetupSignature', () => {
  it('produces a stable signature for the same facts', () => {
    expect(buildSetupSignature(allDone)).toBe(buildSetupSignature({ ...allDone }));
  });

  it('changes when chore_count crosses the 3-chore threshold', () => {
    const below = buildSetupSignature({ ...allDone, chore_count: 2 });
    const above = buildSetupSignature({ ...allDone, chore_count: 3 });
    expect(below).not.toBe(above);
  });

  it('does not change when chore_count changes within the same side of the threshold', () => {
    const a = buildSetupSignature({ ...allDone, chore_count: 5 });
    const b = buildSetupSignature({ ...allDone, chore_count: 9 });
    expect(a).toBe(b);
  });

  it('changes when has_active_goal flips', () => {
    const withGoal    = buildSetupSignature(allDone);
    const withoutGoal = buildSetupSignature({ ...allDone, has_active_goal: false });
    expect(withGoal).not.toBe(withoutGoal);
  });
});

describe('getOutstandingCandidates', () => {
  it('returns all three candidates when nothing is set up', () => {
    expect(getOutstandingCandidates(noneDone)).toEqual([
      'ASSIGN_MORE_CHORES', 'SET_A_GOAL', 'ENABLE_PHOTO_CHECKIN',
    ]);
  });

  it('returns an empty array when everything is set up', () => {
    expect(getOutstandingCandidates(allDone)).toEqual([]);
  });

  it('omits ASSIGN_MORE_CHORES once 3 or more chores are assigned', () => {
    const result = getOutstandingCandidates({ ...noneDone, chore_count: 3 });
    expect(result).not.toContain('ASSIGN_MORE_CHORES');
  });

  it('omits SET_A_GOAL once an active goal exists', () => {
    const result = getOutstandingCandidates({ ...noneDone, has_active_goal: true });
    expect(result).not.toContain('SET_A_GOAL');
  });

  it('omits ENABLE_PHOTO_CHECKIN once a proof-required chore exists', () => {
    const result = getOutstandingCandidates({ ...noneDone, has_proof_required_chore: true });
    expect(result).not.toContain('ENABLE_PHOTO_CHECKIN');
  });
});

describe('buildRuleBasedDiscoveryBriefing', () => {
  it('returns one action per outstanding candidate, in the given order', () => {
    const result = buildRuleBasedDiscoveryBriefing('Mia', ['SET_A_GOAL', 'ENABLE_PHOTO_CHECKIN']);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]).toContain('Mia');
    expect(result.actions[1]).toContain('Mia');
  });

  it('returns an empty actions array and a "fully set up" intro when nothing is outstanding', () => {
    const result = buildRuleBasedDiscoveryBriefing('Mia', []);
    expect(result.actions).toEqual([]);
    expect(result.intro.toLowerCase()).toContain('set up');
  });

  it('never returns more than 3 actions', () => {
    const result = buildRuleBasedDiscoveryBriefing('Mia', [
      'ASSIGN_MORE_CHORES', 'SET_A_GOAL', 'ENABLE_PHOTO_CHECKIN',
    ]);
    expect(result.actions.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run src/lib/discoveryBriefing.test.ts`
Expected: FAIL — `Cannot find module './discoveryBriefing.js'`

- [ ] **Step 3: Write the implementation**

Create `worker/src/lib/discoveryBriefing.ts`:

```ts
// worker/src/lib/discoveryBriefing.ts
//
// Pure, DB-free logic for the Discovery Phase card (parent Insights tab).
// Kept separate from the route handler so the candidate menu, signature
// builder, and rule-based fallback text can be unit tested without a D1
// binding — mirrors the pattern established in familyAudit.ts.

export type DiscoveryCandidateKey =
  | 'ASSIGN_MORE_CHORES'
  | 'SET_A_GOAL'
  | 'ENABLE_PHOTO_CHECKIN';

export interface DiscoverySetupFacts {
  chore_count:              number;
  has_proof_required_chore: boolean;
  has_active_goal:          boolean;
  jars_enabled:              boolean;
}

export interface DiscoveryBriefingContent {
  intro:   string;
  actions: string[];
}

/**
 * A short, deterministic string that changes only when a candidate's
 * fire-state would change (crossing the 3-chore threshold, a goal
 * appearing/disappearing, etc). Not a cryptographic hash — just enough to
 * detect "something relevant changed" so insights.ts knows when to
 * regenerate the cached briefing.
 */
export function buildSetupSignature(facts: DiscoverySetupFacts): string {
  return [
    facts.chore_count >= 3 ? '1' : '0',
    facts.has_proof_required_chore ? '1' : '0',
    facts.has_active_goal ? '1' : '0',
    facts.jars_enabled ? '1' : '0',
  ].join('');
}

/** Which onboarding steps are still outstanding for this child, in priority order. */
export function getOutstandingCandidates(facts: DiscoverySetupFacts): DiscoveryCandidateKey[] {
  const out: DiscoveryCandidateKey[] = [];
  if (facts.chore_count < 3) out.push('ASSIGN_MORE_CHORES');
  if (!facts.has_active_goal) out.push('SET_A_GOAL');
  if (!facts.has_proof_required_chore) out.push('ENABLE_PHOTO_CHECKIN');
  return out;
}

const CANDIDATE_TEXT: Record<DiscoveryCandidateKey, (childName: string) => string> = {
  ASSIGN_MORE_CHORES:   (name) => `Assign 2–3 small daily tasks so I can spot ${name}'s consistency patterns.`,
  SET_A_GOAL:           (name) => `Help ${name} set a savings goal — even a small one — so I can track their planning instincts.`,
  ENABLE_PHOTO_CHECKIN: (_name) => 'Turn on photo check-in for one task, so I can measure follow-through accurately.',
};

/** Deterministic fallback text — used when the LLM call errors or times out. */
export function buildRuleBasedDiscoveryBriefing(
  childName:   string,
  outstanding: DiscoveryCandidateKey[],
): DiscoveryBriefingContent {
  if (outstanding.length === 0) {
    return {
      intro: `I'm building a picture of how ${childName} approaches their responsibilities. ` +
             `Everything's set up on your end — once ${childName} has a few completed tasks, ` +
             `I'll have enough to give you genuinely useful, specific coaching.`,
      actions: [],
    };
  }

  const intro = `I'm building a picture of how ${childName} approaches their responsibilities. ` +
                `Once I've seen a few more completed tasks, I'll have enough to give you genuinely ` +
                `useful, specific coaching — not generic tips. To speed this up, try ` +
                `${outstanding.length === 1 ? 'this' : 'these'} this week:`;

  const actions = outstanding.slice(0, 3).map(key => CANDIDATE_TEXT[key](childName));

  return { intro, actions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run src/lib/discoveryBriefing.test.ts`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Create the migration**

Create `worker/migrations/0077_discovery_briefings.sql`:

```sql
-- 0077_discovery_briefings.sql
-- AI-generated Discovery Phase card content (parent Insights tab),
-- cached one row per child, regenerated when setup_signature changes.

CREATE TABLE IF NOT EXISTS discovery_briefings (
  child_id         TEXT PRIMARY KEY REFERENCES users(id),
  family_id        TEXT NOT NULL REFERENCES families(id),
  setup_signature  TEXT NOT NULL,
  intro            TEXT NOT NULL,
  actions          TEXT NOT NULL,   -- JSON array of strings
  source           TEXT NOT NULL DEFAULT 'rule_based' CHECK (source IN ('rule_based','ai')),
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Apply it to the dev database:

```bash
cd worker
npx wrangler d1 migrations apply morechard-dev --remote
```

Expected: `discovery_briefings` listed as applied.

- [ ] **Step 6: Commit**

```bash
git add worker/src/lib/discoveryBriefing.ts worker/src/lib/discoveryBriefing.test.ts worker/migrations/0077_discovery_briefings.sql
git commit -m "feat: add discoveryBriefing lib and discovery_briefings table

Pure setup-signal logic (candidate menu, signature builder, rule-based
fallback) for the Discovery Phase card, unit tested without a D1 binding."
```

---

### Task 2: `insights.ts` — setup facts, caching, and AI generation

**Files:**
- Modify: `worker/src/routes/insights.ts`

**Interfaces:**
- Consumes: `buildSetupSignature`, `getOutstandingCandidates`, `buildRuleBasedDiscoveryBriefing`, `DiscoverySetupFacts`, `DiscoveryCandidateKey`, `DiscoveryBriefingContent` from Task 1.
- Consumes: `captureAiGeneration(env, props)` from `worker/src/lib/posthog.js` (already imported in this file).
- Produces: adds `discovery_briefing: (DiscoveryBriefingContent & { source: 'ai' | 'rule_based' }) | null` to the `GET /api/insights` JSON response — Task 3's frontend type must match this shape exactly.

No isolated unit test for this task (same rationale as the balance-math plan: it's D1-bound route logic with no existing D1 test harness in this repo). Verified via Steps 4-5 (typecheck + manual dev-server check).

- [ ] **Step 1: Add the import**

In `worker/src/routes/insights.ts`, add near the existing `jar-balance.js` import (line 28):

```ts
import {
  buildSetupSignature, getOutstandingCandidates, buildRuleBasedDiscoveryBriefing,
  type DiscoverySetupFacts, type DiscoveryCandidateKey, type DiscoveryBriefingContent,
} from '../lib/discoveryBriefing.js';
```

- [ ] **Step 2: Insert the Discovery Briefing section**

In `worker/src/routes/insights.ts`, immediately after the `// ── 8. Velocity Context (view_mode-aware) & Locale ──` block ends (i.e. right after the `velocityContext` const, which is defined just before the existing `// ── 9. Orchard Lead Mentor Briefing` comment at line 357), insert:

```ts
  // ── 8b. Discovery Briefing (Discovery Phase only) ────────────────────────
  let discoveryBriefing: (DiscoveryBriefingContent & { source: 'ai' | 'rule_based' }) | null = null;

  if (isDiscoveryPhase) {
    const [choreRow, proofRow, goalRow, jarRow] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM chores WHERE assigned_to = ?`)
        .bind(effectiveChildId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM chores WHERE assigned_to = ? AND proof_required = 1`)
        .bind(effectiveChildId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM goals WHERE child_id = ? AND archived = 0`)
        .bind(effectiveChildId).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT enabled FROM jar_config WHERE family_id = ? AND child_id = ?`)
        .bind(family_id, effectiveChildId).first<{ enabled: number }>(),
    ]);

    const setupFacts: DiscoverySetupFacts = {
      chore_count:              choreRow?.cnt ?? 0,
      has_proof_required_chore: (proofRow?.cnt ?? 0) > 0,
      has_active_goal:          (goalRow?.cnt ?? 0) > 0,
      jars_enabled:              (jarRow?.enabled ?? 0) === 1,
    };
    const signature = buildSetupSignature(setupFacts);

    const cachedDiscovery = await env.DB.prepare(`
      SELECT setup_signature, intro, actions, source FROM discovery_briefings WHERE child_id = ?
    `).bind(effectiveChildId)
      .first<{ setup_signature: string; intro: string; actions: string; source: 'ai' | 'rule_based' }>();

    if (cachedDiscovery && cachedDiscovery.setup_signature === signature) {
      discoveryBriefing = {
        intro:   cachedDiscovery.intro,
        actions: JSON.parse(cachedDiscovery.actions) as string[],
        source:  cachedDiscovery.source,
      };
    } else {
      const outstanding = getOutstandingCandidates(setupFacts);
      const generated    = await generateDiscoveryBriefing(env, effectiveChildId, childName, outstanding);

      await env.DB.prepare(`
        INSERT INTO discovery_briefings (child_id, family_id, setup_signature, intro, actions, source)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(child_id) DO UPDATE SET
          family_id       = excluded.family_id,
          setup_signature = excluded.setup_signature,
          intro           = excluded.intro,
          actions         = excluded.actions,
          source          = excluded.source,
          created_at      = unixepoch()
      `).bind(
        effectiveChildId, family_id, signature,
        generated.intro, JSON.stringify(generated.actions), generated.source,
      ).run();

      discoveryBriefing = generated;
    }
  }
```

- [ ] **Step 3: Add the field to the JSON response**

In the `return json({...})` block at the end of `handleInsights` (around line 634-684), add the new field next to the existing `mentor_briefing` field:

```ts
    // AI Executive Briefing (null during Discovery Phase)
    mentor_briefing: mentorBriefing,

    // Discovery Phase onboarding briefing (null once past Discovery Phase)
    discovery_briefing: discoveryBriefing,
```

- [ ] **Step 4: Add the `generateDiscoveryBriefing` function**

In `worker/src/routes/insights.ts`, add this function directly after the existing `generateBriefing` function (which ends around line 1407, just before `// ── Jar Briefing Helpers ──`):

```ts
async function generateDiscoveryBriefing(
  env:         Env,
  childId:     string,
  childName:   string,
  outstanding: DiscoveryCandidateKey[],
): Promise<DiscoveryBriefingContent & { source: 'ai' | 'rule_based' }> {
  const systemPrompt = `You are the 'Orchard Lead', a collaborative financial coach for parents. \
A child has just started on Morechard and has not yet completed enough tasks for real behavioural \
coaching. Your job is to write a short, warm onboarding note for the parent.

You are given a list of "outstanding" setup steps for this child — a subset of:
- ASSIGN_MORE_CHORES: fewer than 3 chores are currently assigned to the child.
- SET_A_GOAL: the child has no active savings goal.
- ENABLE_PHOTO_CHECKIN: none of the child's chores require photo proof.

CONSTRAINTS:
- Only write about the steps in the given "outstanding" list. Never invent or mention a step that
  is not listed — if a step isn't listed, treat it as already done and do not reference it.
- If "outstanding" is an empty array, write ONLY a short intro telling the parent everything is
  set up and you just need a few completions from the child to start coaching — return an empty
  "actions" array in that case.
- Use first-person singular ("I'm building a picture of...") — this note is from the Mentor
  observing the child, distinct from the family-wide "We" voice used elsewhere in the app.
- Tone: warm, professional, not childish. UK English.
- Respond ONLY with a valid JSON object. No markdown, no commentary, no extra fields.

Response schema (strict):
{
  "intro": "<1-2 sentences>",
  "actions": ["<one sentence per outstanding step, same order as given, empty array if none>"]
}`;

  const userPrompt = JSON.stringify({ child_name: childName, outstanding });

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
        max_tokens:      250,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);

    const data   = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw    = data.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as Partial<DiscoveryBriefingContent>;

    if (!parsed.intro || !Array.isArray(parsed.actions)) {
      throw new Error('Incomplete AI response schema');
    }

    captureAiGeneration(env, {
      distinctId:     childId,
      traceId,
      spanName:       'discovery_briefing',
      model:          'gpt-4o-mini',
      provider:       'openai',
      input:          messages,
      outputText:     raw,
      latencySeconds: (Date.now() - t0) / 1000,
    });

    return { intro: parsed.intro, actions: parsed.actions, source: 'ai' };
  } catch (err) {
    captureAiGeneration(env, {
      distinctId:     childId,
      traceId,
      spanName:       'discovery_briefing',
      model:          'gpt-4o-mini',
      provider:       'openai',
      input:          messages,
      latencySeconds: (Date.now() - t0) / 1000,
      isError:        true,
      errorMessage:   err instanceof Error ? err.message : String(err),
    });

    return { ...buildRuleBasedDiscoveryBriefing(childName, outstanding), source: 'rule_based' };
  }
}
```

- [ ] **Step 5: Typecheck and run the worker test suite**

Run: `cd worker && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests (including Task 1's 11 new tests) pass.

- [ ] **Step 6: Manual verification against morechard-dev**

Start the dev server (`npm run dev` from repo root), sign in as a parent whose child is in Discovery Phase (fewer than 3 completions), and load the Insights tab. Confirm in the network tab that `GET /api/insights` now returns a non-null `discovery_briefing` with `intro` and `actions`. Then, as that parent, assign a 3rd chore to the child (or add a goal, or enable photo check-in on a chore) and reload Insights — confirm `discovery_briefing.actions` no longer lists the step you just completed, and that a fresh D1 row was written:

```bash
cd worker
npx wrangler d1 execute morechard-dev --remote --command="SELECT child_id, setup_signature, source, created_at FROM discovery_briefings ORDER BY created_at DESC LIMIT 5"
```

Expected: the row for your test child has an updated `setup_signature` and a newer `created_at` than before the setup change.

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/insights.ts
git commit -m "feat: generate AI-driven Discovery Phase briefing in GET /api/insights

Setup state (chores assigned, goal exists, photo check-in on) is queried
on every request during Discovery Phase and compared against a cached
per-child signature; the LLM only runs when that signature changes."
```

---

### Task 3: Frontend — `DiscoveryCard` renders the AI content

**Files:**
- Modify: `app/src/lib/api.ts` (add `discovery_briefing` to `InsightsData`)
- Modify: `app/src/components/dashboard/InsightsTab.tsx:425-504` (`DiscoveryCard`, `DiscoveryAction`)

**Interfaces:**
- Consumes: `discovery_briefing: { intro: string; actions: string[]; source: 'ai' | 'rule_based' } | null` from Task 2's `GET /api/insights` response.

No isolated component test for this task — matches the existing convention in this file (`LiveBriefingCard`, `MentorCarousel`, and the original `DiscoveryCard` are all un-exported local functions inside `InsightsTab.tsx` with no dedicated test file; only the standalone `FamilyAuditCard.tsx` file has one, because it's a separate exported module). Verified via Step 3 (typecheck) and Step 4 (manual browser check, continuing from Task 2 Step 6's dev server session).

- [ ] **Step 1: Add the type field**

In `app/src/lib/api.ts`, inside the `InsightsData` interface (around line 594, right after `mentor_briefing: MentorBriefing | null;`), add:

```ts
  discovery_briefing: { intro: string; actions: string[]; source: 'ai' | 'rule_based' } | null;
```

- [ ] **Step 2: Rewrite `DiscoveryCard` and `DiscoveryAction`**

In `app/src/components/dashboard/InsightsTab.tsx`, replace the entire `DiscoveryCard` function and the `DiscoveryAction` function (lines 425-504) with:

```tsx
function DiscoveryCard({ data, name }: { data: InsightsData; name: string }) {
  const briefing = data.discovery_briefing

  return (
    <PremiumShell>
      <div className="px-4 pt-5 pb-4 relative z-10">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Mentor avatar */}
            <MentorAvatar />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#6b9e87' }}>
                  Orchard Mentor
                </span>
                {briefing?.source === 'ai'
                  ? <AiDisclosurePill />
                  : <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              </div>
              <p className="text-[15px] font-extrabold tracking-tight" style={{ color: '#f0fdf4' }}>
                Getting to know {name}
              </p>
            </div>
          </div>
          {/* Progress ring — discovery state */}
          <div className="relative w-9 h-9 shrink-0">
            <svg width={36} height={36} viewBox="0 0 36 36">
              <circle cx={18} cy={18} r={13} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4}/>
              <circle cx={18} cy={18} r={13} fill="none" stroke="#0d9488" strokeWidth={4}
                strokeDasharray={`${Math.round((Math.min(data.all_time_completed, 3) / 3) * 82)} 82`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
              />
              <text x={18} y={22} textAnchor="middle" fontSize={8} fontWeight={700} fill="#0d9488">
                {data.all_time_completed}/3
              </text>
            </svg>
          </div>
          <ProBadge />
        </div>

        {/* Body — advisor prose style */}
        <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#a7c4b5' }}>
          {briefing
            ? briefing.intro
            : <>I'm building a picture of how <span style={{ color: '#e2f5ee', fontWeight: 600 }}>{name}</span> approaches their responsibilities.</>}
        </p>

        {/* Action list */}
        {briefing && briefing.actions.length > 0 && (
          <div className="space-y-2.5 mb-4">
            {briefing.actions.map((text, i) => (
              <DiscoveryAction key={i} step={String(i + 1).padStart(2, '0')} text={text} />
            ))}
          </div>
        )}

      </div>
    </PremiumShell>
  )
}

function DiscoveryAction({ step, text }: { step: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-[9px] font-black tracking-wider tabular-nums mt-0.5"
            style={{ color: '#0d9488' }}>
        {step}
      </span>
      <p className="text-[12px] leading-relaxed" style={{ color: '#a7c4b5' }}>{text}</p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and run the app test suite**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all existing tests pass (no test targets `DiscoveryCard` directly, so this is a regression guard for `FamilyAuditCard.test.tsx` and the other component tests, confirming the `InsightsData` type change didn't break anything).

- [ ] **Step 4: Manual browser verification**

With the dev server still running from Task 2 Step 6, reload the parent Insights tab for a child in Discovery Phase in an actual browser. Confirm:
- The AI disclosure pill appears when `discovery_briefing.source === 'ai'` (check the network response to confirm which source came back).
- The action list shows 1-3 items reflecting only what's actually outstanding — after completing Task 2 Step 6's manual test (assigning a 3rd chore / adding a goal / enabling photo check-in), confirm that action no longer appears.
- If you temporarily set `OPENAI_API_KEY` to an invalid value to force the fallback path, confirm the card still renders correctly with rule-based text and no `AiDisclosurePill` (pulsing amber dot instead) — then restore the real key.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/api.ts app/src/components/dashboard/InsightsTab.tsx
git commit -m "feat: render AI-generated Discovery Phase content in DiscoveryCard

Replaces the hardcoded intro paragraph and fixed 3-item action list with
data from GET /api/insights' new discovery_briefing field; adds the AI
disclosure pill matching LiveBriefingCard and FamilyAuditCard."
```

---

## Self-Review Notes

- **Spec coverage:** §1 (setup signal) → Task 1. §2 (data & caching) → migration in Task 1 Step 5, cache read/write in Task 2 Step 2. §3 (generation, candidate menu, fallback) → Task 1's `buildRuleBasedDiscoveryBriefing` + Task 2's `generateDiscoveryBriefing`. §4 (frontend, AI disclosure pill) → Task 3. Edge cases (zero chores, everything configured) → covered by Task 1's tests (`noneDone`/`allDone` fixtures) and Task 1's empty-outstanding branch in `buildRuleBasedDiscoveryBriefing`.
- **Deviation from spec worth flagging:** the design spec's §3 says the prompt reuses `buildInsightsFamilyBlock` for family context. This plan's `generateDiscoveryBriefing` (Task 2 Step 4) does not — it follows the simpler, more recent precedent set by `family-audit.ts`'s `generateFamilyAuditContent`, which also skips the bilingual family-context block and Polish localisation entirely. Both AI surfaces are now consistent with each other; only the original weekly per-child briefing does full EN/PL family-context injection. This is called out here rather than silently diverging from the written spec.
- **Placeholder scan:** No TBD/TODO. Both D1-bound tasks (2) are verified via typecheck + manual dev-server check rather than a red/green D1 unit test, consistent with the balance-math-shared-fix plan's justification (no D1 test harness exists in this repo).
- **Type consistency:** `DiscoveryBriefingContent` (`{ intro: string; actions: string[] }`) is defined once in Task 1 and reused unchanged through Task 2 (route) and Task 3 (frontend, inlined as a matching object-literal type since the frontend doesn't import worker types). `DiscoveryCandidateKey`'s three string-literal values match exactly between Task 1's `getOutstandingCandidates`/`CANDIDATE_TEXT` and Task 2's system-prompt documentation of the same three keys.
