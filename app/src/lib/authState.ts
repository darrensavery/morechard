/**
 * In-memory session state, primed once at app boot (see App.tsx's checkingAuth
 * gate). Exists because the real JWT now lives in an HttpOnly cookie (web) or
 * Keychain/Keystore (native) — neither is synchronously readable by JS, but
 * route guards (RequireSession, LockScreen, LandingScreen) need a fast,
 * synchronous "am I logged in" answer during render.
 *
 * Web: sourced from the non-HttpOnly `mc_session` cookie (role only, never
 * the token — see worker/src/lib/cookies.ts).
 * Native: sourced from a secure-storage read done once at primeAuthState().
 */
import { Capacitor } from '@capacitor/core';

let primed = false;
let cachedRole: 'parent' | 'child' | null = null;

function readSessionCookie(): 'parent' | 'child' | null {
  const match = document.cookie.match(/(?:^|;\s*)mc_session=(parent|child)(?:;|$)/);
  return (match?.[1] as 'parent' | 'child' | undefined) ?? null;
}

export async function primeAuthState(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { getToken } = await import('./api.js');
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      token = null; // corrupted/inaccessible keychain — treat as logged out
    }
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as { role?: 'parent' | 'child' };
        cachedRole = payload.role ?? null;
      } catch {
        cachedRole = null;
      }
    } else {
      cachedRole = null;
    }
  } else {
    cachedRole = readSessionCookie();
  }
  primed = true;
}

export function isAuthenticated(): boolean {
  return primed && cachedRole !== null;
}

export function getRole(): 'parent' | 'child' | null {
  return cachedRole;
}

/** Called by clearToken()/logout so the in-memory cache doesn't go stale mid-session. */
export function clearCachedAuthState(): void {
  cachedRole = null;
}
