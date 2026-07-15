import { describe, it, expect, beforeEach, vi } from 'vitest';
import { primeAuthState, isAuthenticated, getRole } from './authState';

describe('authState (web path)', () => {
  beforeEach(() => {
    document.cookie = 'mc_session=; Max-Age=0; path=/';
    vi.resetModules();
  });

  it('isAuthenticated is false before priming with no session cookie', async () => {
    await primeAuthState();
    expect(isAuthenticated()).toBe(false);
    expect(getRole()).toBeNull();
  });

  it('isAuthenticated is true and getRole reflects the cookie after priming', async () => {
    document.cookie = 'mc_session=parent; path=/';
    await primeAuthState();
    expect(isAuthenticated()).toBe(true);
    expect(getRole()).toBe('parent');
  });
});
