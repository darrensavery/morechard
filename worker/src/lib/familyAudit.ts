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
