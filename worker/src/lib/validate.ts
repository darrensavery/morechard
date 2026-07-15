/**
 * Schema-validated request body parsing, built on zod.
 *
 * Most routes still use the ad hoc `parseBody()` + manual `typeof x !==
 * 'string'` checks from `response.ts` — this isn't a rip-and-replace, it's
 * the pattern for new routes and for hardening existing high-risk ones
 * incrementally (unauthenticated endpoints first: invite redemption, child
 * login). Broader adoption is intentionally left as follow-up work rather
 * than one large mechanical refactor across every route in the same pass
 * as unrelated security fixes.
 */
import { z } from 'zod';
import { error } from './response.js';

/**
 * Parses the request body as JSON and validates it against `schema`.
 * Returns the typed, validated data on success, or a 400 Response on
 * failure (invalid JSON or a schema violation) — callers should
 * short-circuit exactly like the existing `parseBody()` convention:
 *
 *   const parsed = await parseValidatedBody(request, mySchema);
 *   if (parsed instanceof Response) return parsed;
 *   // parsed is now fully typed and validated
 */
export async function parseValidatedBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path.join('.') || 'body';
    return error(`${field}: ${firstIssue?.message ?? 'invalid'}`);
  }

  return result.data;
}
