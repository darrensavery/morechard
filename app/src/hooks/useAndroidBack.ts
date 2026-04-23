import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Android-only hardware back-button override.
 *
 * When `active` is true, the most recently registered active listener handles
 * back presses — typically to close an open sheet/modal. When no listener is
 * active, the root `AndroidBackController` (App.tsx) decides whether to pop
 * the router history or exit the app.
 *
 * No-op on web and iOS.
 */
export function useAndroidBack(active: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!active) return;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    App.addListener('backButton', () => { onBack(); }).then(h => {
      if (cancelled) { h.remove().catch(() => {}); return; }
      handle = h;
    });

    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
  }, [active, onBack]);
}
