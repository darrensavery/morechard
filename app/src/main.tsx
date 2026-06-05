// Polyfill Array.prototype.at for older browsers (required by web-vitals v5 via @sentry/react)
if (!Array.prototype.at) {
  Array.prototype.at = function (index: number) {
    const i = index < 0 ? this.length + index : index
    return this[i]
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initAnalytics, replayAllowed } from './lib/analytics'
import './index.css'
import App from './App.tsx'

initAnalytics()

// Session replay is non-essential and never runs for children — only attach the
// replay integration when consent allows it. Error monitoring stays always-on.
const allowReplay = replayAllowed()

const SENSITIVE_FIELDS = new Set(['password', 'pin', 'token', 'secret', 'authorization', 'jwt', 'api_key', 'apikey']);

Sentry.init({
  // Replace with your real DSN from sentry.io — safe to leave empty in dev
  dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  environment: import.meta.env.MODE,
  // Only send errors in production to keep dev noise-free
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: allowReplay ? 1.0 : 0,
  integrations: [
    Sentry.browserTracingIntegration(),
    ...(allowReplay ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })] : []),
  ],
  beforeSend(event) {
    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        if (SENSITIVE_FIELDS.has(key.toLowerCase())) delete event.extra[key];
      }
    }
    return event;
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
