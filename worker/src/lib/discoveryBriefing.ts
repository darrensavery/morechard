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
  ENABLE_PHOTO_CHECKIN: (name) => `Turn on photo check-in for one task, so I can measure ${name}'s follow-through accurately.`,
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
