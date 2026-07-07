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
import { getAvailableBalancePence } from '../lib/ledgerBalance.js';

type AuthedRequest = Request & { auth: JwtPayload };

export async function handleGetFamilyAudit(request: Request, env: Env): Promise<Response> {
  const auth      = (request as AuthedRequest).auth;
  const family_id = new URL(request.url).searchParams.get('family_id');

  if (!family_id) return error('family_id required');
  if (family_id !== auth.family_id) return error('Forbidden', 403);
  if (auth.role === 'child') return error('Forbidden', 403);

  const monthKey   = getMonthKey(new Date());
  const monthStart = getMonthStartEpoch(monthKey);

  const cached = await getCachedSnapshot(env, family_id, monthKey);

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

    const [availableBalRaw, goalsRow, completionRow] = await Promise.all([
      getAvailableBalancePence(env.DB, family_id, childId),

      env.DB.prepare(`
        SELECT COALESCE(SUM(target_amount - current_saved_pence),0) AS locked
        FROM goals WHERE family_id=? AND child_id=? AND archived=0 AND target_amount > current_saved_pence
      `).bind(family_id, childId).first<{ locked: number }>().catch(() => ({ locked: 0 })),

      env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(CASE WHEN attempt_count=1 THEN 1 ELSE 0 END) AS first_time
        FROM completions WHERE family_id=? AND child_id=? AND status='completed' AND resolved_at >= ?
      `).bind(family_id, childId, monthStart).first<{ total: number; first_time: number }>(),
    ]);

    const availableBal    = Math.max(0, availableBalRaw);
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
    INSERT OR IGNORE INTO family_audit_snapshots
      (family_id, month_key, total_earned_pence, total_spent_pence, total_saved_pence, total_given_pence,
       flagged_child_id, flagged_pillar, observation, behavioral_root, the_action, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    family_id, monthKey,
    totals.total_earned_pence, totals.total_spent_pence, totals.total_saved_pence, totals.total_given_pence,
    flagged.child_id, flagged.pillar,
    content.observation, content.behavioral_root, content.the_action, content.source,
  ).run();

  // Re-read from the cache table rather than returning `content` directly: if a concurrent
  // request won the INSERT OR IGNORE race, this returns the winner's persisted text so the
  // response stays consistent with what's actually cached.
  const persisted = await getCachedSnapshot(env, family_id, monthKey);

  return json({
    month: monthKey,
    totals: persisted ? {
      total_earned_pence: persisted.total_earned_pence,
      total_spent_pence:  persisted.total_spent_pence,
      total_saved_pence:  persisted.total_saved_pence,
      total_given_pence:  persisted.total_given_pence,
    } : totals,
    flagged_child_id: persisted?.flagged_child_id ?? flagged.child_id,
    flagged_pillar:   persisted?.flagged_pillar   ?? flagged.pillar,
    observation:      persisted?.observation      ?? content.observation,
    behavioral_root:  persisted?.behavioral_root  ?? content.behavioral_root,
    the_action:       persisted?.the_action       ?? content.the_action,
    source:           persisted?.source           ?? content.source,
  });
}

interface CachedFamilyAuditSnapshot {
  total_earned_pence: number; total_spent_pence: number; total_saved_pence: number; total_given_pence: number;
  flagged_child_id: string; flagged_pillar: string;
  observation: string; behavioral_root: string; the_action: string; source: 'rule_based' | 'ai';
}

async function getCachedSnapshot(env: Env, family_id: string, monthKey: string): Promise<CachedFamilyAuditSnapshot | null> {
  return env.DB.prepare(`
    SELECT total_earned_pence, total_spent_pence, total_saved_pence, total_given_pence,
           flagged_child_id, flagged_pillar, observation, behavioral_root, the_action, source
    FROM family_audit_snapshots WHERE family_id = ? AND month_key = ?
  `).bind(family_id, monthKey).first<CachedFamilyAuditSnapshot>();
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
- UK English: "Wellbeing", "Organise", "Behaviour", "Recognise".
- Currency: every value in "totals" is in pence (100 pence = £1). ALWAYS convert to pounds and
  write it the way a person actually talks — "£8.00", "£21.50" — never write a raw pence figure
  or the word "pence" anywhere in your response.
- behavioral_root MUST name the given Pillar explicitly.
- Respond ONLY with a valid JSON object. No markdown, no commentary, no extra fields.

Response schema (strict):
{
  "observation": "<1 sentence — a statement of fact based on the family totals and flagged child>",
  "behavioral_root": "<1 sentence — names the given Pillar and links it to a future financial literacy outcome>",
  "the_action": "<1 sentence — a concrete option for the parent, framed as a choice>"
}`;

  const formatPounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  const userPrompt = JSON.stringify({
    family_name: familyName,
    totals_formatted: {
      earned: formatPounds(totals.total_earned_pence),
      spent:  formatPounds(totals.total_spent_pence),
      saved:  formatPounds(totals.total_saved_pence),
      given:  formatPounds(totals.total_given_pence),
    },
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
