import { useEffect } from 'react'
import { getDeviceIdentity } from '../lib/deviceIdentity'

declare global {
  interface Window {
    fdWidget?: {
      init: (config: { token: string; host: string; widgetId: string }) => void
      open: () => void
      setCustomProperties: (props: Record<string, unknown>) => void
    }
  }
}

export function FreshdeskWidget() {
  useEffect(() => {
    const identity = getDeviceIdentity()
    const role = identity?.role === 'child' ? 'role_child' : 'role_parent'

    // Widget loads async — poll until ready then set role tag
    const iv = setInterval(() => {
      if (window.fdWidget) {
        window.fdWidget.setCustomProperties({ role })
        clearInterval(iv)
      }
    }, 200)

    return () => clearInterval(iv)
  }, [])

  return null
}
