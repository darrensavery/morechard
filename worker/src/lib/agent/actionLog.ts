/**
 * Hash-chained audit log for every agent read/reply/action — mirrors the
 * ledger's own SHA-256 chain pattern (worker/src/lib/hash.ts) because this
 * system makes financially and behaviourally consequential decisions and
 * gets the same tamper-evidence guarantee the product promises its users.
 *
 * id is app-assigned (not AUTOINCREMENT), same convention as ledger.id —
 * see the migration note in Task 1 of the implementation plan.
 */
import { sha256, GENESIS_HASH } from '../hash.js';

export type ActionTier = 'read' | 'auto' | 'gated';

export interface ActionLogHashInput {
  id: number;
  incidentId: string;
  actor: string;
  toolName: string;
  tier: ActionTier;
  payload: string;
  previousHash: string;
}

function esc(v: string | number): string {
  return String(v).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export async function computeActionLogHash(input: ActionLogHashInput): Promise<string> {
  const payload = [
    input.id, input.incidentId, input.actor, input.toolName, input.tier,
    input.payload, input.previousHash,
  ].map(esc).join('|');
  return sha256(payload);
}

export interface AgentActionLogEntry {
  incidentId: string;
  actor: string;      // 'agent' | 'human:<email>'
  toolName: string;
  tier: ActionTier;
  payload: unknown;   // JSON-serialised before hashing/storing
  result?: unknown;
}

const MAX_WRITE_ATTEMPTS = 3;

/**
 * Fetches the chain tip, computes the next entry's hash, and inserts —
 * retrying if a concurrent queue-consumer invocation won the race for the
 * same id. Same retry-on-UNIQUE-violation pattern as writeLedgerEntry.
 */
export async function writeAgentActionLogEntry(
  db: D1Database,
  entry: AgentActionLogEntry,
): Promise<{ id: number; previousHash: string; recordHash: string }> {
  const payloadJson = JSON.stringify(entry.payload ?? null);
  const resultJson = entry.result !== undefined ? JSON.stringify(entry.result) : null;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const tip = await db
      .prepare('SELECT id, record_hash FROM agent_action_log ORDER BY id DESC LIMIT 1')
      .first<{ id: number; record_hash: string }>();

    const previousHash = tip?.record_hash ?? GENESIS_HASH;
    const newId = (tip?.id ?? 0) + 1;

    const recordHash = await computeActionLogHash({
      id: newId,
      incidentId: entry.incidentId,
      actor: entry.actor,
      toolName: entry.toolName,
      tier: entry.tier,
      payload: payloadJson,
      previousHash,
    });

    try {
      await db
        .prepare(`
          INSERT INTO agent_action_log
            (id, incident_id, actor, tool_name, tier, payload, result, previous_hash, record_hash)
          VALUES (?,?,?,?,?,?,?,?,?)
        `)
        .bind(newId, entry.incidentId, entry.actor, entry.toolName, entry.tier, payloadJson, resultJson, previousHash, recordHash)
        .run();
      return { id: newId, previousHash, recordHash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_WRITE_ATTEMPTS && /UNIQUE constraint failed/i.test(msg)) continue;
      throw err;
    }
  }
  throw new Error('agent_action_log write failed after retries — concurrent writer contention');
}
