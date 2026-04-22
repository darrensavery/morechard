import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

type Props = {
  url: string;
  onOpened: () => void;    // fired when we're confident the deep link resolved
  onFallback: () => void;  // fired when it didn't (show Smart Copy with apology)
};

// Best-effort detection of whether a custom-scheme or https deep link
// actually opened an external app. @capacitor/app v8 does NOT expose openUrl
// (see node_modules/@capacitor/app/dist/esm/definitions.d.ts), so both paths
// rely on the same visibilitychange sentinel:
// - Native: window.open(url, '_system') hands the URI to the OS.
// - PWA: window.location.href triggers the scheme.
// If the page hides within ~1.5s, the OS switched apps → success.
// If it never hides, the scheme didn't resolve → fall back to Smart Copy.
export function DeepLinkHandler({ url, onOpened, onFallback }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pageHidden = false;

    function onVisibility() {
      if (document.hidden) pageHidden = true;
    }
    document.addEventListener('visibilitychange', onVisibility);

    (async () => {
      if (Capacitor.isNativePlatform()) {
        window.open(url, '_system');
      } else {
        window.location.href = url;
      }

      await new Promise((r) => setTimeout(r, 1500));
      if (cancelled) return;
      fire(pageHidden ? 'opened' : 'fallback');
    })();

    function fire(s: 'opened' | 'fallback') {
      if (firedRef.current) return;
      firedRef.current = true;
      if (s === 'opened') onOpened();
      else onFallback();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [url, onOpened, onFallback]);

  return null;
}
