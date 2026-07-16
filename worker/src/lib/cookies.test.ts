import { describe, it, expect } from 'vitest';
import { setAuthCookie, clearAuthCookie, setSessionMarkerCookie, clearSessionMarkerCookie } from './cookies.js';

describe('cookies', () => {
  it('setAuthCookie appends an HttpOnly, Secure, SameSite=Lax cookie with the given Max-Age', () => {
    const headers = new Headers();
    setAuthCookie(headers, 'abc.def.ghi', 31536000);
    const cookie = headers.get('Set-Cookie');
    expect(cookie).toContain('mc_token=abc.def.ghi');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=31536000');
  });

  it('clearAuthCookie sets Max-Age=0', () => {
    const headers = new Headers();
    clearAuthCookie(headers);
    expect(headers.get('Set-Cookie')).toContain('mc_token=;');
    expect(headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('setSessionMarkerCookie is NOT HttpOnly and carries the role', () => {
    const headers = new Headers();
    setSessionMarkerCookie(headers, 'parent', 31536000);
    const cookie = headers.get('Set-Cookie');
    expect(cookie).toContain('mc_session=parent');
    expect(cookie).not.toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('clearSessionMarkerCookie sets Max-Age=0', () => {
    const headers = new Headers();
    clearSessionMarkerCookie(headers);
    expect(headers.get('Set-Cookie')).toContain('mc_session=;');
    expect(headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('setAuthCookie and setSessionMarkerCookie both append (not overwrite) Set-Cookie', () => {
    const headers = new Headers();
    setAuthCookie(headers, 'tok', 100);
    setSessionMarkerCookie(headers, 'child', 100);
    // Headers.get('Set-Cookie') only returns the first entry via the standard
    // Headers API — use getSetCookie() (supported in the Workers runtime) to
    // confirm both were appended rather than one clobbering the other.
    const all = (headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(all).toHaveLength(2);
  });
});
