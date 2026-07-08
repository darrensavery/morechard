import { useRef, useState, type ReactNode } from 'react'
import { tick } from '../../lib/haptics'

const THRESHOLD = 80

interface Props {
  onDismiss: () => void
  children: ReactNode
  className?: string
}

export function SwipeDismissCard({ onDismiss, children, className }: Props) {
  const startX = useRef<number | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const dragging = startX.current !== null

  function onStart(x: number) {
    startX.current = x
  }

  function onMove(x: number) {
    if (startX.current === null) return
    setOffsetX(x - startX.current)
  }

  function onEnd() {
    if (startX.current === null) return
    startX.current = null
    if (Math.abs(offsetX) > THRESHOLD) {
      void tick()
      setDismissing(true)
      setTimeout(onDismiss, 200)
    } else {
      setOffsetX(0)
    }
  }

  return (
    <div
      className={className}
      style={{
        transform: `translateX(${dismissing ? (offsetX > 0 ? 400 : -400) : offsetX}px)`,
        opacity: dismissing ? 0 : 1 - Math.min(Math.abs(offsetX) / 300, 0.6),
        transition: dragging ? 'none' : 'transform 200ms ease, opacity 200ms ease',
        touchAction: 'pan-y',
      }}
      onTouchStart={e => onStart(e.touches[0].clientX)}
      onTouchMove={e => onMove(e.touches[0].clientX)}
      onTouchEnd={onEnd}
      onMouseDown={e => onStart(e.clientX)}
      onMouseMove={e => { if (startX.current !== null) onMove(e.clientX) }}
      onMouseUp={onEnd}
      onMouseLeave={() => { if (startX.current !== null) onEnd() }}
    >
      {children}
    </div>
  )
}
