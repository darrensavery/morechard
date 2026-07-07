import { describe, it, expect } from 'vitest';
import {
  buildSetupSignature, getOutstandingCandidates, buildRuleBasedDiscoveryBriefing,
  type DiscoverySetupFacts,
} from './discoveryBriefing.js';

const allDone: DiscoverySetupFacts = {
  chore_count: 3, has_proof_required_chore: true, has_active_goal: true,
};
const noneDone: DiscoverySetupFacts = {
  chore_count: 0, has_proof_required_chore: false, has_active_goal: false,
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
