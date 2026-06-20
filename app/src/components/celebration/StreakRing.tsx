// app/src/components/celebration/StreakRing.tsx
// Duolingo-style choreography: SVG arc sweeps 0°→360°, then number rolls prev→new.
// Below the number: 4-segment act progress bar sourced from mc_lab_act_progress.
import { useEffect, useRef, useState } from 'react'

const R = 66
const CIRCUMFERENCE = 2 * Math.PI * R
const STALE_MS = 60 * 60 * 1000 // 1 hour

interface ActProgress {
  completedActs: number[]
  totalActs:     number
  newAct:        number
  ts:            number
}

function readActProgress(): ActProgress | null {
  try {
    const raw = localStorage.getItem('mc_lab_act_progress')
    if (!raw) return null
    const data = JSON.parse(raw) as ActProgress
    if (Date.now() - data.ts > STALE_MS) return null
    return data
  } catch { return null }
}

interface Props {
  previousValue: number
  newValue:      number
  onComplete?:   () => void  // fires when number lands (payoff moment)
}

export function StreakRing({ previousValue, newValue, onComplete }: Props) {
  const progRef       = useRef<SVGCircleElement>(null)
  const [display, setDisplay] = useState(previousValue)
  const [popped,  setPopped]  = useState(false)
  const [actProgress] = useState<ActProgress | null>(() => readActProgress())
  const [segsVisible, setSegsVisible] = useState(false)
  const onCompleteRef = useRef(onComplete)
  const rafRef        = useRef<number>(0)
  useEffect(() => { onCompleteRef.current = onComplete })

  useEffect(() => {
    setDisplay(previousValue)
    setPopped(false)
    setSegsVisible(false)

    const prog = progRef.current
    if (!prog) return

    // Reset arc to empty
    prog.style.transition = 'none'
    prog.style.strokeDashoffset = String(CIRCUMFERENCE)
    void (prog as unknown as HTMLElement).offsetWidth // force reflow

    // Sweep arc 0°→360°
    const tSweep = setTimeout(() => {
      prog.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.45,.05,.3,1)'
      prog.style.strokeDashoffset = '0'
    }, 150)

    // Payoff: arc closes → number rolls → segments appear
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

    // Segments appear after number settles
    const tSegs = setTimeout(() => setSegsVisible(true), 2050)

    return () => {
      clearTimeout(tSweep)
      clearTimeout(tPayoff)
      clearTimeout(tSegs)
      cancelAnimationFrame(rafRef.current)
    }
  }, [previousValue, newValue])

  const totalActs = actProgress?.totalActs ?? 4

  return (
    <div style={{ position: 'relative', width: 150, height: actProgress ? 178 : 150, margin: '0 auto 22px' }}>
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
        position: 'absolute', left: 0, right: 0, top: 0, bottom: actProgress ? 28 : 0,
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

      {actProgress && (
        <div style={{
          position: 'absolute', left: 20, right: 20, bottom: 0,
          opacity: segsVisible ? 1 : 0,
          transform: segsVisible ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .3s ease, transform .3s ease',
        }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: totalActs }, (_, i) => {
              const actNum = i + 1
              const isDone = actProgress.completedActs.includes(actNum)
              const isNew  = isDone && actNum === actProgress.newAct
              const delay  = segsVisible ? `${i * 0.09}s` : '0s'
              return (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 5, borderRadius: 3,
                    backgroundColor: isDone ? '#00959c' : 'rgba(255,255,255,.12)',
                    transformOrigin: 'left center',
                    animation: isDone && segsVisible
                      ? `${isNew ? 'mc-seg-new' : 'mc-seg-fill'} .38s cubic-bezier(.2,1.2,.4,1) ${delay} both`
                      : 'none',
                    boxShadow: isNew && segsVisible ? '0 0 8px rgba(0,149,156,.8)' : 'none',
                  }}
                />
              )
            })}
          </div>
          <p style={{
            margin: '5px 0 0', textAlign: 'center',
            fontSize: 9, letterSpacing: '.12em', color: 'rgba(127,212,214,.6)',
            textTransform: 'uppercase',
          }}>
            {actProgress.completedActs.length} of {totalActs} acts
          </p>
        </div>
      )}

      <style>{`
        @keyframes mc-ring-pop {
          0%   { transform: scale(1) }
          45%  { transform: scale(1.32) }
          100% { transform: scale(1) }
        }
        @keyframes mc-seg-fill {
          0%   { transform: scaleX(0) }
          100% { transform: scaleX(1) }
        }
        @keyframes mc-seg-new {
          0%   { transform: scaleX(0) }
          65%  { transform: scaleX(1.08) }
          100% { transform: scaleX(1) }
        }
      `}</style>
    </div>
  )
}
