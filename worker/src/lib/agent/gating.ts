/**
 * Pure decision logic for the frictionless GATED queue (design spec §4.3,
 * §4.4). Confidence and preconditions only ever affect queue *sorting/
 * pre-fill* — never whether something executes without a human. Phase 0
 * has no execution endpoint yet, but this module is built now so the
 * diagnosis pass (Task 13) can set queue_bucket/payload_hash correctly
 * from day one.
 */
import { sha256 } from '../hash.js';

export const AUTO_RECOMMEND_CONFIDENCE_THRESHOLD = 0.9;

export interface GatedRecommendationInput {
  confidence: number;
  category: string; // matched playbook section slug, or 'novel'
  preconditionsVerified: boolean;
}

export type QueueBucket = 'recommended_approve' | 'needs_review';

export function classifyGatedRecommendation(input: GatedRecommendationInput): QueueBucket {
  if (input.category === 'novel') return 'needs_review';
  if (!input.preconditionsVerified) return 'needs_review';
  return input.confidence >= AUTO_RECOMMEND_CONFIDENCE_THRESHOLD ? 'recommended_approve' : 'needs_review';
}

/** Deterministic (key-order-independent) JSON stringify, for stable hashing. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

export async function computeDeterministicPayloadHash(payload: unknown): Promise<string> {
  return sha256(stableStringify(payload));
}
