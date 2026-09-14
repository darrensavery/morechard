// Wires up the actual "autoUpdate" behaviour for the service worker.
//
// vite-plugin-pwa's `registerType: 'autoUpdate'` config option does nothing
// on its own — it only takes effect once the app calls `registerSW()` from
// the `virtual:pwa-register` module. Without this file, the plugin falls
// back to auto-injecting a bare `navigator.serviceWorker.register()` call
// with no update detection at all, so a new deploy only takes effect once
// every tab/instance of the old service worker's clients has gone away —
// for an installed/backgrounded PWA that can take several force-closes.
//
// `registerSW()` here checks for a new worker, tells it to skip waiting the
// moment it's ready, and reloads once it takes control — on load, hourly
// while the app stays open, and immediately whenever the app is foregrounded
// (the exact moment a user "reopens the app").
import { registerSW } from 'virtual:pwa-register'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export function initPwaUpdate() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      setInterval(() => {
        registration.update().catch(() => {})
      }, UPDATE_CHECK_INTERVAL_MS)

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {})
        }
      })
    },
  })

  // registerSW's own internal handling already reloads the page once a new
  // worker activates (registerType: 'autoUpdate'); updateSW is unused here
  // but kept so a future onNeedRefresh prompt can call it directly.
  void updateSW
}
