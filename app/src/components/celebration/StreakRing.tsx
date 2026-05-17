// app/src/components/celebration/StreakRing.tsx
// Duolingo-style choreography: SVG arc sweeps 0°→360°, then number rolls prev→new.
import { useEffect, useRef, useState } from 'react'

const R = 66
const CIRCUMFERENCE = 2 * Math.PI * R

interface Props {
  previousValue: number
  newValue:      number
  onComplete?:   () => void  // fires when number lands (payoff moment)
}

export function StreakRing({ previousValue, newValue, onComplete }: Props) {
  const progRef       = useRef<SVGCircleElement>(null)
  const [display, setDisplay] = useState(previousValue)
  const [popped,  setPopped]  = useState(false)
  const onCompleteRef = useRef(onComplete)
  const rafRef        = useRef<number>(0)
  useEffect(() => { onCompleteRef.current = onComplete })

  useEffect(() => {
    setDisplay(previousValue)
    setPopped(false)

    const prog = progRef.current
    if (!prog) return

    // Reset arc to empty
    prog.style.transition = 'none'
    prog.style.strokeDashoffset = String(CIRCUMFERENCE)
    void prog.offsetWidth // force reflow

    // Sweep arc 0°→360°
    const tSweep = setTimeout(() => {
      prog.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.45,.05,.3,1)'
      prog.style.strokeDashoffset = '0'
    }, 150)

    // Payoff: arc closes → number rolls
    const tPayoff = setTimeout(() => {
      setPopped(true)
      onCompleteRef.current?.()
      const start = Date.now()
      const duration = 480
      function tick() {
        const t = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        setDisplay(Math.round(previousValue + (newValue - previousValue) * ease))
        if (t < 1) rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }, 1450)

    return () => {
      clearTimeout(tSweep)
      clearTimeout(tPayoff)
      cancelAnimationFrame(rafRef.current)
    }
  }, [previousValue, newValue])

  return (
    <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto 22px' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="75" cy="75" r={R} fill="none" strokeWidth="7"
          stroke="rgba(255,255,255,.08)"
        />
        <circle
          ref={progRef}
          cx="75" cy="75" r={R} fill="none" strokeWidth="7"
          stroke="#00959c"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,149,156,.55))' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <b style={{
          fontSize: 46, color: '#fff', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1,
          display: 'inline-block',
          animation: popped ? 'mc-ring-pop .42s cubic-bezier(.2,1.4,.4,1) 1' : 'none',
        }}>
          {display}
        </b>
        <small style={{ fontSize: 10, letterSpacing: '.16em', color: '#7fd4d6', marginTop: 4, textTransform: 'uppercase' }}>
          day streak
        </small>
      </div>
      <style>{`
        @keyframes mc-ring-pop {
          0%   { transform: scale(1) }
          45%  { transform: scale(1.32) }
          100% { transform: scale(1) }
        }
      `}</style>
    </div>
  )
}
