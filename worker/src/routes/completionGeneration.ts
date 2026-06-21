/**
 * Pure decision logic for lazy completion generation.
 *
 * Extracted from lazyGenerateCompletions so it can be unit-tested without a D1.
 *
 * Invariant enforced here: a child has AT MOST ONE open ('available') completion
 * per chore at any time. Without this, an untouched recurring chore stacks a new
 * 'available' row every period (the prior period's row has an out-of-window
 * submitted_at, so the period-coverage check never sees it), and the child sees
 * the same task duplicated many times.
 */

export interface ExistingCompletion {
  id: string;
  chore_id: string;
  status: string;       // 'available' | 'awaiting_review' | 'completed' | 'needs_revision'
  submitted_at: number; // epoch seconds
}

export interface ActiveChore {
  id: string;
  periodStart: number;  // epoch seconds — start of the chore's current period
}

export interface GenerationPlan {
  choreIdsToInsert: string[];      // create a fresh 'available' row for these
  completionIdsToDelete: string[]; // stale duplicate 'available' rows to remove
}

export function planCompletionGeneration(
  activeChores: ActiveChore[],
  existing: ExistingCompletion[],
): GenerationPlan {
  const byChore = new Map<string, ExistingCompletion[]>();
  for (const row of existing) {
    const list = byChore.get(row.chore_id);
    if (list) list.push(row);
    else byChore.set(row.chore_id, [row]);
  }

  const choreIdsToInsert: string[] = [];
  const completionIdsToDelete: string[] = [];

  for (const { id: choreId, periodStart } of activeChores) {
    const rows = byChore.get(choreId) ?? [];

    // Open tasks already waiting for this chore (newest first).
    const availableRows = rows
      .filter(r => r.status === 'available')
      .sort((a, b) => b.submitted_at - a.submitted_at);

    if (availableRows.length > 0) {
      // One open task is enough — keep the newest, retire any older duplicates.
      for (const dup of availableRows.slice(1)) completionIdsToDelete.push(dup.id);
      continue; // never create a second open task while one is pending
    }

    // No open task. Has the child already acted on this chore this period?
    const actedThisPeriod = rows.some(
      r => r.status !== 'available' && r.submitted_at >= periodStart,
    );
    if (actedThisPeriod) continue;

    choreIdsToInsert.push(choreId);
  }

  return { choreIdsToInsert, completionIdsToDelete };
}
