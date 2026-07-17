import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDeviceIdentity } from '../lib/deviceIdentity';

// Module-scoped, not component state — persists for the lifetime of this JS
// execution context. Backgrounding and resuming the app (task-switch, tab
// hidden, phone screen off) never re-evaluates this module, so the flag
// stays consumed and no re-lock happens. A genuine cold start — the process
// actually killed and restarted, or the page actually reloaded — re-runs
// this module from scratch, so the flag starts fresh again.
let hasCheckedThisProcess = false;

/**
 * Gates re-auth to real cold starts only — deliberately not a timer.
 *
 * This is a chore-tracker app, not a bank: the long-lived session
 * (365-day parent / 90-day child) should never force a re-login just from
 * switching apps or leaving a tab backgrounded, matching how Amazon/Tesco/
 * eBay-style apps behave. A quick biometric/PIN tap only makes sense once
 * per genuine process restart — e.g. the OS reclaimed the app's memory, or
 * the device rebooted — since that's the point a different person could
 * plausibly now be holding the device. Previously this fired on a 5-minute
 * background timer and was Capacitor-only; both removed 2026-07-17.
 */
export function AppAutoLock() {
  const navigate = useNavigate();

  useEffect(() => {
    if (hasCheckedThisProcess) return;
    hasCheckedThisProcess = true;

    const identity = getDeviceIdentity();
    if (!identity) return; // nothing to gate — RootGate handles the no-identity path

    const onLockRoute = window.location.pathname.startsWith('/lock') ||
      window.location.pathname === '/' ||
      window.location.pathname.startsWith('/auth');
    if (onLockRoute) return;

    navigate('/lock', { replace: true });
  }, [navigate]);

  return null;
}
