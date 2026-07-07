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
