/**
 * Recognises D1 platform conditions that are transient — safe to surface to
 * the client as a 503 (which api.ts's `request()` retries automatically)
 * instead of a hard 500 that pages Sentry. Deliberately narrow: matches on
 * known exact D1 error phrasing rather than any D1_ERROR, since most D1
 * errors (bad SQL, constraint violations, etc.) are real bugs that should
 * still be visible in Sentry.
 */
export function isTransientD1Error(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes('D1 DB storage operation exceeded timeout') ||
    err.message.includes('too much load on D1')
  );
}
