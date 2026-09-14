import { useEffect, useRef, useState, type ReactNode } from 'react'
import { tick } from '../../lib/haptics'

// How far the card must travel before it snaps fully open (vs springing back
// closed) on release — same "reveal, don't auto-fire" pattern as swipe
// actions in most native list UIs: the action still needs an explicit tap.
const OPEN_THRESHOLD = 40
const REVEAL_WIDTH = 84
// How far the one-time coachmark nudges the card open — a "peek", not a
// full reveal, so it reads as a hint rather than an accidental open state.
const PEEK_WIDTH = 32

interface Props {
  onAction: () => void
  actionLabel: string
  children: ReactNode
  /** Applied to the outer (non-sliding) wrapper — put rounding/overflow-hidden here. */
  className?: string
  /** Plays a one-time "peek" animation on mount to teach the swipe gesture. */
  autoPeek?: boolean
  /** Fires once the peek animation has finished (used to set the "seen" flag). */
  onPeekComplete?: () => void
}

/** Swipe left to reveal a destructive action button (e.g. Archive) behind the card. */
export function SwipeRevealCard({ onAction, actionLabel, children, className, autoPeek, onPeekComplete }: Props) {
  const startX = useRef<number | null>(null)
  const startOffset = useRef(0)
  const [offsetX, setOffsetX] = useState(0) // 0 = closed, -REVEAL_WIDTH = fully open
  // Tracks which spring curve the release animation should use — a soft
  // overshoot when snapping open (gives the reveal some momentum/weight),
  // a plain deceleration when snapping shut (nothing to overshoot into).
  const [snappingOpen, setSnappingOpen] = useState(false)
  const dragging = startX.current !== null
  const isOpen = offsetX !== 0

  // One-time coachmark: nudge the card open briefly, then spring it back.
  useEffect(() => {
    if (!autoPeek) return
    const openTimer = setTimeout(() => { setSnappingOpen(true); setOffsetX(-PEEK_WIDTH) }, 500)
    const closeTimer = setTimeout(() => { setSnappingOpen(false); setOffsetX(0) }, 1400)
    const doneTimer = setTimeout(() => onPeekComplete?.(), 1700)
    return () => { clearTimeout(openTimer); clearTimeout(closeTimer); clearTimeout(doneTimer) }
    // Runs once on mount only — re-triggering on prop identity changes would replay the hint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clamp(v: number) {
    return Math.max(-REVEAL_WIDTH, Math.min(0, v))
  }

  function onStart(x: number) {
    startX.current = x
    startOffset.current = offsetX
  }

  function onMove(x: number) {
    if (startX.current === null) return
    setOffsetX(clamp(startOffset.current + (x - startX.current)))
  }

  function onEnd() {
    if (startX.current === null) return
    startX.current = null
    setOffsetX(prev => {
      const next = Math.abs(prev) > OPEN_THRESHOLD ? -REVEAL_WIDTH : 0
      if (next !== 0 && prev === 0) void tick()
      setSnappingOpen(next !== 0)
      return next
    })
  }

  function close() {
    setSnappingOpen(false)
    setOffsetX(0)
  }

  return (
    <div className={`relative bg-red-500 ${className ?? ''}`}>
      {/* Revealed action — sits behind the card, only reachable once swiped open.
          Rounded on all corners (not just the outer edge) and inset from the
          card's own edge so it reads as a floating button rather than a flat
          slab with a hard seam where the card slides away from it. The
          wrapper behind it is red too, so the inset gap (and any spring
          overshoot past REVEAL_WIDTH) never flashes blank background. */}
      <div className="absolute inset-y-0 right-0 flex py-1 pr-1" style={{ width: REVEAL_WIDTH }}>
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          aria-hidden={!isOpen}
          onClick={() => { onAction(); close() }}
          className="flex-1 rounded-lg bg-red-500 text-white text-[0.6875rem] font-bold cursor-pointer"
        >
          {actionLabel}
        </button>
      </div>
      <div
        className="rounded-xl"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging
            ? 'none'
            : snappingOpen
              // Slight overshoot on the way open gives the reveal some
              // momentum/weight instead of a linear, mechanical slide.
              ? 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
          // Some card content (e.g. overdue/priority accents) uses a
          // semi-transparent background. Without an opaque backdrop here,
          // that translucency lets the revealed action button bleed
          // through even while fully closed (offsetX 0).
          backgroundColor: 'var(--color-bg)',
        }}
        // A tap while swiped open closes the reveal instead of activating
        // whatever's underneath (expand toggle, etc.) — matches native list UX.
        onClickCapture={e => { if (isOpen) { e.stopPropagation(); close() } }}
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
    </div>
  )
}
