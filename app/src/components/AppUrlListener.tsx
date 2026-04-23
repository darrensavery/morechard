import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';

const APP_HOSTS = ['app.morechard.com', 'morechard.com'];

export function AppUrlListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      try {
        const url = new URL(event.url);
        if (!APP_HOSTS.includes(url.hostname)) return;
        const path = `${url.pathname}${url.search}${url.hash}` || '/';
        navigate(path, { replace: false });
      } catch {
        // Malformed URL — ignore.
      }
    }).then(h => { handle = h; });

    return () => { handle?.remove().catch(() => {}); };
  }, [navigate]);

  return null;
}
