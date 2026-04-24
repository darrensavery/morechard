import { useEffect } from 'react'
import { getDeviceIdentity } from '../lib/deviceIdentity'

declare global {
  interface Window {
    FreshworksWidget?: (...args: unknown[]) => void
    fwSettings?: { widget_id: string }
  }
}

export function FreshdeskWidget() {
  useEffect(() => {
    const identity = getDeviceIdentity()
    if (!window.FreshworksWidget) return

    const role = identity?.role === 'child' ? 'role_child' : 'role_parent'

    window.FreshworksWidget('setTags', [role])
    window.FreshworksWidget('prefill', 'ticketForm', {
      subject: '',
      description: '',
    })
  }, [])

  return null
}
