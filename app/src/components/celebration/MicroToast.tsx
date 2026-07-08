// app/src/components/celebration/MicroToast.tsx
// Displays a Micro-tier celebration event as a dismissible bottom toast.
import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'
import { SwipeDismissCard } from '../ui/SwipeDismissCard'

interface Props {
  event:     MilestoneEvent
  onDismiss: () => void
}

export function MicroToast({ event, onDismiss }: Props) {
  const config = CONFIGS[event.type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 400)
    }, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  if (!config) return null

  const stage = event.appView === 'CLEAN' ? config.clean[0] : config.orchard[0]
  if (!stage) return null

  function close() {
    setVisible(false)
    setTimeout(onDismiss, 400)
  }

  return (
    <SwipeDismissCard onDismiss={close} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90]">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-[#1b2d2e] border border-white/10 shadow-xl',
          'transition-all duration-[400ms]',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
        style={{ maxWidth: 320 }}
      >
        <span className="text-2xl">{stage.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-semibold leading-snug', stage.headingColor)}>
            {stage.heading}
          </p>
          <p className={cn('text-[11px] leading-snug mt-0.5 truncate', stage.bodyColor)}>
            {stage.body}
          </p>
        </div>
        <button
          onClick={close}
          className="text-white/30 hover:text-white/60 text-lg leading-none ml-1"
          aria-label="Dismiss"
        >×</button>
      </div>
    </SwipeDismissCard>
  )
}
