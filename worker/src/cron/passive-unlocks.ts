// worker/src/cron/passive-unlocks.ts
// Nightly sweep: re-evaluate passive Learning Lab unlock conditions for every
// active child, so triggers that depend on the ABSENCE of activity fire even
// while the app is closed — e.g. M14 (Inflation) after 21 days with no
// transactions. On Lab open these are also evaluated (see routes/lab.ts); this
// cron is the safety net for children who haven't opened the app.
//
// evaluatePassive is idempotent (unlock() uses INSERT OR IGNORE), so repeated
// runs are safe. Per-child failures are isolated so one bad row cannot abort
// the whole sweep.

import type { Env } from '../types.js'
import { evaluatePassive } from '../lib/labTriggers.js'

export async function runPassiveUnlockSweep(env: Env): Promise<void> {
  const { results: children } = await env.DB.prepare(`
    SELECT u.id AS child_id
    FROM users u
    JOIN family_roles fr ON fr.user_id = u.id AND fr.role = 'child'
    JOIN families f ON f.id = u.family_id
    WHERE f.deleted_at IS NULL
  `).all<{ child_id: string }>()

  for (const child of children ?? []) {
    await evaluatePassive(env.DB, child.child_id).catch((err) => {
      console.error('[runPassiveUnlockSweep] failed for child', child.child_id, err)
    })
  }
}
