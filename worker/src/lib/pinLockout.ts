/**
 * Escalating PIN lockout, shared by child login (`/auth/child/login`) and
 * parent step-up PIN verification (`/auth/verify-pin`).
 *
 * A flat lockout after N fails on a 4-digit PIN (10,000 combinations) is
 * grindable within a day. Each time a user is locked out again, the lockout
 * doubles (30s, 60s, 120s, ... capped at 24h) — a real deterrent without
 * escalating the very first mistyped PIN.
 */
import { Env } from '../types.js';

const BASE_LOCKOUT_SEC = 30;
const MAX_LOCKOUT_SEC  = 24 * 60 * 60;

export function lockoutSecondsForTier(tier: number): number {
  return Math.min(BASE_LOCKOUT_SEC * 2 ** Math.max(0, tier - 1), MAX_LOCKOUT_SEC);
}

/** Call after a failed PIN attempt. Locks the account once `maxAttempts` is reached. */
export async function recordPinFailure(
  env: Env,
  userId: string,
  attemptCount: number,
  lockoutTier: number,
  now: number,
  maxAttempts: number,
): Promise<void> {
  const newCount = attemptCount + 1;
  if (newCount >= maxAttempts) {
    const newTier = lockoutTier + 1;
    await env.DB
      .prepare('UPDATE users SET pin_attempt_count = 0, pin_locked_until = ?, pin_lockout_tier = ? WHERE id = ?')
      .bind(now + lockoutSecondsForTier(newTier), newTier, userId)
      .run();
  } else {
    await env.DB
      .prepare('UPDATE users SET pin_attempt_count = ? WHERE id = ?')
      .bind(newCount, userId)
      .run();
  }
}

/** Call after a successful PIN verification — forgives prior lockout escalation. */
export async function clearPinLockout(env: Env, userId: string): Promise<void> {
  await env.DB
    .prepare('UPDATE users SET pin_attempt_count = 0, pin_locked_until = NULL, pin_lockout_tier = 0 WHERE id = ?')
    .bind(userId)
    .run();
}
