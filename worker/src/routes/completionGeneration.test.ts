import { describe, it, expect } from 'vitest';
import { planCompletionGeneration, type ExistingCompletion } from './completionGeneration.js';

// periodStart values are epoch seconds; use round numbers for clarity.
const THIS_WEEK = 1_000_000;
const LAST_WEEK = THIS_WEEK - 7 * 86_400;

function avail(id: string, chore_id: string, submitted_at: number): ExistingCompletion {
  return { id, chore_id, status: 'available', submitted_at };
}

describe('planCompletionGeneration', () => {
  it('generates an available row when none exists for an active chore', () => {
    const res = planCompletionGeneration(
      [{ id: 'choreA', periodStart: THIS_WEEK }],
      [],
    );
    expect(res.choreIdsToInsert).toEqual(['choreA']);
    expect(res.completionIdsToDelete).toEqual([]);
  });

  it('does NOT stack a second available row when one is already open (the reported bug)', () => {
    // A stale available row from last week must NOT trigger a new insert this week.
    const res = planCompletionGeneration(
      [{ id: 'choreA', periodStart: THIS_WEEK }],
      [avail('c1', 'choreA', LAST_WEEK)],
    );
    expect(res.choreIdsToInsert).toEqual([]);
    expect(res.completionIdsToDelete).toEqual([]);
  });

  it('collapses pre-existing duplicate available rows, keeping the newest', () => {
    // The exact situation in the screenshot: 5 available rows for one chore.
    const rows = [
      avail('c1', 'choreA', LAST_WEEK - 0 * 86_400),
      avail('c2', 'choreA', LAST_WEEK - 1 * 86_400),
      avail('c3', 'choreA', LAST_WEEK - 2 * 86_400),
      avail('c4', 'choreA', LAST_WEEK - 3 * 86_400),
      avail('c5', 'choreA', LAST_WEEK - 4 * 86_400),
    ];
    const res = planCompletionGeneration(
      [{ id: 'choreA', periodStart: THIS_WEEK }],
      rows,
    );
    expect(res.choreIdsToInsert).toEqual([]);          // open task already exists
    // newest (c1) kept; the other four deleted
    expect(res.completionIdsToDelete.sort()).toEqual(['c2', 'c3', 'c4', 'c5']);
  });

  it('does NOT regenerate when the chore was already acted on this period', () => {
    const res = planCompletionGeneration(
      [{ id: 'choreA', periodStart: THIS_WEEK }],
      [{ id: 'c1', chore_id: 'choreA', status: 'awaiting_review', submitted_at: THIS_WEEK + 100 }],
    );
    expect(res.choreIdsToInsert).toEqual([]);
    expect(res.completionIdsToDelete).toEqual([]);
  });

  it('regenerates a new period once the prior available was completed', () => {
    // Completed last period (not available any more) → a fresh task is due this period.
    const res = planCompletionGeneration(
      [{ id: 'choreA', periodStart: THIS_WEEK }],
      [{ id: 'c1', chore_id: 'choreA', status: 'completed', submitted_at: LAST_WEEK }],
    );
    // The completed row is from a prior period, so the SQL wrapper would not even
    // return it; but if it does, it must not block this period's generation.
    expect(res.choreIdsToInsert).toEqual(['choreA']);
    expect(res.completionIdsToDelete).toEqual([]);
  });

  it('handles multiple chores independently', () => {
    const res = planCompletionGeneration(
      [
        { id: 'choreA', periodStart: THIS_WEEK },  // has open task → skip
        { id: 'choreB', periodStart: THIS_WEEK },  // nothing → insert
      ],
      [avail('c1', 'choreA', LAST_WEEK)],
    );
    expect(res.choreIdsToInsert).toEqual(['choreB']);
    expect(res.completionIdsToDelete).toEqual([]);
  });
});
