/**
 * Reads the concatenated docs/support/*.md playbook bundle from KV. Workers
 * have no filesystem access to read the repo at request time, so the bundle
 * is written to KV out-of-band by the seed script (Task 23) — run manually
 * after any docs/support/ edit in Phase 0/1; automated via CI in Phase 2+
 * per the design spec's rollout table.
 */
import { Env } from '../../types.js';
import { sha256 } from '../hash.js';

export const PLAYBOOK_BUNDLE_KEY = 'agent:playbook:bundle';
export const PLAYBOOK_HASH_KEY = 'agent:playbook:hash';

export interface PlaybookBundle {
  content: string;
  hash: string;
}

export async function computeContentHash(content: string): Promise<string> {
  return sha256(content);
}

export async function getPlaybookBundle(env: Env): Promise<PlaybookBundle | null> {
  const [content, hash] = await Promise.all([
    env.CACHE.get(PLAYBOOK_BUNDLE_KEY),
    env.CACHE.get(PLAYBOOK_HASH_KEY),
  ]);
  if (!content || !hash) return null;
  return { content, hash };
}
