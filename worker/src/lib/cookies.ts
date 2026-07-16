/**
 * HttpOnly auth cookie (the real credential) + a paired, JS-readable
 * "session marker" cookie (role only, never the token) so client code can
 * answer "is there an active session" without ever touching the secret.
 */

const AUTH_COOKIE    = 'mc_token';
const MARKER_COOKIE  = 'mc_session';

export function setAuthCookie(headers: Headers, token: string, expirySeconds: number): void {
  headers.append(
    'Set-Cookie',
    `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${expirySeconds}`,
  );
}

export function clearAuthCookie(headers: Headers): void {
  headers.append(
    'Set-Cookie',
    `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

export function setSessionMarkerCookie(headers: Headers, role: 'parent' | 'child', expirySeconds: number): void {
  headers.append(
    'Set-Cookie',
    `${MARKER_COOKIE}=${role}; Secure; SameSite=Lax; Path=/; Max-Age=${expirySeconds}`,
  );
}

export function clearSessionMarkerCookie(headers: Headers): void {
  headers.append(
    'Set-Cookie',
    `${MARKER_COOKIE}=; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

/** Parse the raw Cookie request header into a name→value map. */
export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie');
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

export function getAuthCookie(request: Request): string | null {
  return parseCookies(request)[AUTH_COOKIE] ?? null;
}
