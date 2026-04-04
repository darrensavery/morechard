import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { initAnalytics } from './lib/analytics'
import './index.css'
import App from './App.tsx'

initAnalytics()

// TEMP: posthog connectivity test — remove after confirming event arrives
import('posthog-js').then(({ default: posthog }) => {
  posthog.init('phc_zf5uHwc5ZCvCJtxHts6AGaqBPw5x2zLHJFYsL6ftvtj3', {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
  })
  posthog.capture('posthog_test_ping', { source: 'morechard_dev_check' })
})

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
