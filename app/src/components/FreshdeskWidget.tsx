import { useEffect } from 'react'
import { getDeviceIdentity } from '../lib/deviceIdentity'

declare global {
  interface Window {
    fdWidget?: {
      init: (config: { token: string; host: string; widgetId: string }) => void
      open: () => void
      setCustomProperties: (props: Record<string, string>) => void
    }
  }
}

export function FreshdeskWidget() {
  useEffect(() => {
    const identity = getDeviceIdentity()
    if (!window.fdWidget) return

    const role = identity?.role === 'child' ? 'role_child' : 'role_parent'
    window.fdWidget.setCustomProperties({ role })
  }, [])

  return null
}
