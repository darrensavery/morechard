import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App, type AppState } from '@capacitor/app';

const BACKGROUND_KEY = 'mc_backgrounded_at';
const LOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Native auto-lock: if the app has been backgrounded for 5+ minutes, redirect
 * to /lock on resume. Web build is a no-op — browser PWAs already require
 * re-auth on cold load via the LockScreen gate.
 *
 * The token stays in localStorage so PIN/biometric unlock on LockScreen
 * navigates straight back to the dashboard without a fresh magic link.
 */
export function AppAutoLock() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    App.addListener('appStateChange', ({ isActive }: AppState) => {
      if (!isActive) {
        localStorage.setItem(BACKGROUND_KEY, String(Date.now()));
        return;
      }

      const raw = localStorage.getItem(BACKGROUND_KEY);
      localStorage.removeItem(BACKGROUND_KEY);
      if (!raw) return;

      const backgroundedAt = Number(raw);
      if (!Number.isFinite(backgroundedAt)) return;

      const awayMs = Date.now() - backgroundedAt;
      if (awayMs < LOCK_AFTER_MS) return;

      const onLockRoute = window.location.pathname.startsWith('/lock') ||
        window.location.pathname === '/' ||
        window.location.pathname.startsWith('/auth');
      if (onLockRoute) return;

      navigate('/lock', { replace: true });
    }).then(h => {
      if (cancelled) { h.remove().catch(() => {}); return; }
      handle = h;
    });

    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
  }, [navigate]);

  return null;
}
