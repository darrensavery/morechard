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

const OAUTH_STATE_COOKIE_PREFIX = 'mc_oauth_state_';

/**
 * Binds an OAuth `state` nonce to the browser that initiated the flow, so a
 * captured/replayed authorize URL from a different browser can't complete
 * login (login CSRF). HMAC-signing the state alone only proves *we* minted
 * it — not that this request came from the same browser that requested it.
 * SameSite=None because Apple's callback is a cross-site POST
 * (response_mode=form_post); SameSite=Lax would silently drop it there.
 * Scoped to the specific callback path and short-lived (10 min).
 */
export function setOAuthStateCookie(headers: Headers, provider: string, nonce: string, callbackPath: string): void {
  headers.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE_PREFIX}${provider}=${nonce}; HttpOnly; Secure; SameSite=None; Path=${callbackPath}; Max-Age=600`,
  );
}

export function getOAuthStateCookie(request: Request, provider: string): string | null {
  return parseCookies(request)[`${OAUTH_STATE_COOKIE_PREFIX}${provider}`] ?? null;
}

export function clearOAuthStateCookie(headers: Headers, provider: string, callbackPath: string): void {
  headers.append(
    'Set-Cookie',
    `${OAUTH_STATE_COOKIE_PREFIX}${provider}=; HttpOnly; Secure; SameSite=None; Path=${callbackPath}; Max-Age=0`,
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
