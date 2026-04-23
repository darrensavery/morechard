import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const ROOT_ROUTES = new Set(['/', '/lock', '/parent', '/child', '/auth/login']);

/**
 * Root-level Android back button handler. Must stay mounted inside BrowserRouter.
 *
 * Registering any `backButton` listener disables Capacitor's default handling,
 * so something has to decide what "back" means at every route. Sheets/modals
 * override via `useAndroidBack(open, onClose)` — those listeners fire first
 * because Capacitor invokes listeners in reverse registration order. When no
 * modal is open, this controller either pops router history or exits the app
 * from a root route.
 */
export function AndroidBackController() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    App.addListener('backButton', ({ canGoBack }) => {
      if (ROOT_ROUTES.has(location.pathname) || !canGoBack) {
        App.exitApp().catch(() => {});
        return;
      }
      navigate(-1);
    }).then(h => {
      if (cancelled) { h.remove().catch(() => {}); return; }
      handle = h;
    });

    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
  }, [navigate, location.pathname]);

  return null;
}
