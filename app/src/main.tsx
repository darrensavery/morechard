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
import { initAnalytics } from './lib/analytics'
import './index.css'
import App from './App.tsx'

initAnalytics()

Sentry.init({
  // Replace with your real DSN from sentry.io — safe to leave empty in dev
  dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
  environment: import.meta.env.MODE,
  // Only send errors in production to keep dev noise-free
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
