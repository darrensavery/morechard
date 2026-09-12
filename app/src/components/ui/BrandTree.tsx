/**
 * BrandTree — the real Morechard tree mark, animated.
 *
 * Path data and colours below are lifted directly from the source brand asset
 * (morechard-tree.svg, viewBox 71.39×97.24) — trunk included, unmodified — so
 * this renders as the literal logo tree rather than a lookalike.
 *
 * Motion: the tree is still most of the time — an occasional gentle sway
 * (ambient timer + hover), not a continuous idle loop, so it reads as a
 * subtle "it's alive" touch rather than something constantly moving and
 * competing for attention. Each sway is a single damped push-and-settle,
 * not a repeating oscillation. The whole tree — trunk and canopy (one
 * group, no per-leaf transforms) alike — rotates together from one pivot
 * at the base, same angle, same timing, no delay: a single rigid body, the
 * way a real trunk and the branches fused to it actually move. Because
 * it's one rotation about a ground-level pivot, the sway is naturally
 * near-zero at the base and grows with height/distance from that pivot —
 * no separate amplitude math needed for the canopy. Both amplitude (per
 * tree) and per-gust strength vary, so no two trees — and no two gusts on
 * the same tree — swing by quite the same amount.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

// Trunk — two layers, drawn back-to-front exactly as in the source file:
// the lighter base (cls-3) first, the darker shading overlay (cls-2) last,
// on top of the canopy. Both sway together (identical timing) so the trunk
// reads as one rigid piece even though it's painted in two passes.
const TRUNK_BACK  = { d: 'M47.95,97.24s-14.91-38.32,3.31-63.8c0,0-9.9,6.08-16.02,19.66-6.12-13.58-16.02-19.66-16.02-19.66,18.23,25.48,3.31,63.8,3.31,63.8h25.41Z', fill: '#81635a' }
const TRUNK_SHADE = { d: 'M22.54,97.24h14.42c-.02-51.68-17.73-63.8-17.73-63.8,18.23,25.48,3.31,63.8,3.31,63.8Z', fill: '#6a453c' }
// Pivot near the trunk's true base (viewBox user units) so it sways from
// where it plants in the ground, not its own bounding-box centre.
const TRUNK_ORIGIN   = '29px 97px'
const TRUNK_AMP_BASE = 1.6 // degrees — nominal; each tree scales this, see baseAmp below

// The 14 canopy blobs (cls-1/cls-4/cls-5 in the source file), in document order.
const BLOBS: { d: string; fill: string }[] = [
  { d: 'M39.46,2.52C38.65,1.01,37.06,0,35.24,0c-1.82,0-3.4,1.04-4.19,2.56.8,1.5,2.39,2.53,4.22,2.52,1.82,0,3.4-1.04,4.19-2.56Z', fill: '#259045' },
  { d: 'M18.93,29.58c.88-3.57-.19-7.49-3.12-10.1-2.93-2.62-6.95-3.23-10.39-1.95-.88,3.57.19,7.49,3.12,10.1,2.93,2.62,6.95,3.23,10.39,1.95Z', fill: '#43ab48' },
  { d: 'M67.74,38.77c2.34-1.45,3.83-4.1,3.63-7.04-.2-2.94-2.02-5.37-4.53-6.49-2.34,1.45-3.83,4.1-3.63,7.04.2,2.94,2.02,5.37,4.53,6.49Z', fill: '#43ab48' },
  { d: 'M52.72,8.02c-.26-2.21-1.69-4.2-3.9-5.06s-4.62-.36-6.3,1.1c.26,2.21,1.69,4.2,3.9,5.06,2.21.86,4.62.36,6.3-1.1Z', fill: '#43ab48' },
  { d: 'M65.19,23.29c1.44-2.84,1.31-6.35-.65-9.13-1.96-2.78-5.23-4.09-8.38-3.68-1.44,2.84-1.31,6.35.65,9.13,1.96,2.78,5.23,4.09,8.38,3.68Z', fill: '#7cc242' },
  { d: 'M61.51,54.7c2.74-.13,5.31-1.73,6.55-4.39,1.24-2.65.83-5.66-.82-7.84-2.74.13-5.31,1.73-6.55,4.39-1.24,2.65-.83,5.66.82,7.84Z', fill: '#259045' },
  { d: 'M1.88,44.02c1.07,3.94,4.23,7.18,8.5,8.16,4.28.98,8.54-.57,11.21-3.65-1.07-3.94-4.23-7.18-8.5-8.16-4.28-.98-8.54.57-11.21,3.65Z', fill: '#43ab48' },
  { d: 'M4.91,27.84c-2.48.71-4.41,2.63-4.83,5.14-.42,2.51.79,4.95,2.91,6.43,2.48-.71,4.41-2.63,4.83-5.14.42-2.51-.79-4.95-2.91-6.43Z', fill: '#7cc242' },
  { d: 'M24.82,66.95c.72-3.31-.38-6.93-3.18-9.31-2.79-2.39-6.54-2.91-9.69-1.68-.72,3.31.38,6.93,3.18,9.31,2.79,2.39,6.54,2.91,9.69,1.68Z', fill: '#7cc242' },
  { d: 'M13.91,15.14c3.44,1.71,7.68,1.52,11.02-.88,3.34-2.39,4.88-6.35,4.36-10.15-3.44-1.71-7.68-1.52-11.02.87-3.34,2.39-4.88,6.35-4.36,10.15Z', fill: '#259045' },
  { d: 'M46.98,68.26c3.78.31,7.6-1.42,9.78-4.84,2.18-3.42,2.15-7.61.28-10.91-3.78-.31-7.6,1.42-9.78,4.84-2.18,3.42-2.15,7.61-.28,10.91Z', fill: '#259045' },
  { d: 'M50.62,48.09c3.56.5,7.28-.93,9.54-4.04,2.26-3.12,2.46-7.09.87-10.32-3.56-.5-7.28.93-9.54,4.04-2.26,3.12-2.46,7.09-.87,10.32Z', fill: '#7cc242' },
  { d: 'M27.02,34.64c4.27-1.17,7.77-4.61,8.8-9.24,1.03-4.63-.69-9.22-4.07-12.09-4.27,1.17-7.77,4.61-8.8,9.24-1.03,4.63.69,9.22,4.07,12.09Z', fill: '#7cc242' },
  { d: 'M31.22,42.3c2.74.86,5.84.23,8.03-1.93,2.19-2.15,2.87-5.25,2.04-8-2.74-.86-5.84-.23-8.03,1.93s-2.87,5.25-2.04,8Z', fill: '#7cc242' },
  { d: 'M39.63,13.37c-1.61,4.38-.8,9.48,2.54,13.19,3.34,3.71,8.33,5.05,12.86,3.91,1.61-4.38.8-9.48-2.54-13.19-3.34-3.71-8.33-5.05-12.86-3.91Z', fill: '#259045' },
]

// A tiny deterministic PRNG (not Math.random) so each tree's *base* sway
// amplitude is stable across renders but varies from its siblings.
function seeded(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return x - Math.floor(x)
}

type TreeSize = 'sm' | 'md' | 'lg'
const SIZE_SCALE: Record<TreeSize, number> = { sm: 1.1, md: 1.3, lg: 1.5 }
const VB_W = 71.39
const VB_H = 97.24

interface FallingBlob {
  id:    number
  x:     number
  delay: number
  drift: number
  fill:  string
}

interface SwayEvent {
  amp: number // degrees, this event's trunk rotation
  dur: number // seconds
}

interface Props {
  size?:        TreeSize
  /** Stagger (seconds) for the ambient sway timer, and seed for this tree's base amplitude. */
  swayOffset?:  number
  /** Stagger (ms) for the on-mount grow-in, so trees don't pop in together. */
  growDelay?:   number
  flip?:        boolean
  className?:   string
}

export function BrandTree({ size = 'md', swayOffset = 0, growDelay = 0, flip = false, className = '' }: Props) {
  const scale = SIZE_SCALE[size]
  const svgW  = Math.round(VB_W * scale)
  const svgH  = Math.round(VB_H * scale)
  const cx    = Math.round((VB_W / 2) * scale)

  // Each tree gets its own nominal amplitude (roughly 0.6x–1.5x the base),
  // so a gustier-looking tree stays gustier-looking across its own events.
  const baseAmp = useMemo(() => TRUNK_AMP_BASE * (0.6 + seeded(swayOffset, 11) * 0.9), [swayOffset])

  const [sway,  setSway]  = useState<SwayEvent | null>(null)
  const [blobs, setBlobs] = useState<FallingBlob[]>([])
  const timerRef   = useRef<ReturnType<typeof setTimeout>>(undefined)
  const swayEndRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const blobId     = useRef(0)

  function fireSway() {
    const amp = baseAmp * (0.7 + Math.random() * 0.6) // per-event variety, ~0.7x–1.3x
    const dur = 2.3 + Math.random() * 0.9 // longer than a plain push, so the ring-out has room to play out
    setSway({ amp, dur })
    clearTimeout(swayEndRef.current)
    swayEndRef.current = setTimeout(() => setSway(null), dur * 1000 + 150)
  }

  useEffect(() => {
    // Still, most of the time — the tree only sways on an occasional,
    // randomised interval (well spaced out, not a constant idle loop) so it
    // stays a subtle "it's alive" touch instead of something distracting.
    const trigger = () => {
      fireSway()
      timerRef.current = setTimeout(trigger, 16000 + Math.random() * 14000) // ~16–30s apart
    }
    timerRef.current = setTimeout(trigger, swayOffset * 900 + 4000 + Math.random() * 5000)
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(swayEndRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swayOffset, baseAmp])

  function handleMouseEnter() {
    const count = Math.random() > 0.4 ? 2 : 1
    const newBlobs: FallingBlob[] = Array.from({ length: count }, (_, i) => {
      const source = BLOBS[Math.floor(Math.random() * BLOBS.length)]
      return {
        id:    blobId.current++,
        x:     (Math.random() - 0.5) * svgW * 0.5,
        delay: i * 140,
        drift: (Math.random() - 0.5) * 2,
        fill:  source.fill,
      }
    })
    setBlobs(prev => [...prev, ...newBlobs])
    fireSway()
  }

  function removeBlob(id: number) {
    setBlobs(prev => prev.filter(b => b.id !== id))
  }

  // One rotation, one pivot, shared verbatim by the trunk and the canopy
  // group — rotating the same angle about the same ground-level point means
  // the base barely moves and the sway grows with height for free.
  const swayStyle: React.CSSProperties = {
    transformOrigin: TRUNK_ORIGIN,
    ...(sway && {
      // ease-in-out (not an overshoot curve) — the ring-out itself now
      // comes from the keyframe's decaying bounces, so the timing function
      // just needs to glide smoothly between them.
      animation: `sway ${sway.dur.toFixed(2)}s ease-in-out 1`,
      '--amt':   `${sway.amp.toFixed(2)}deg`,
    } as React.CSSProperties),
  }

  return (
    <div
      className={`relative flex-shrink-0 cursor-pointer select-none ${className}`}
      style={{ width: svgW, height: svgH }}
      onMouseEnter={handleMouseEnter}
    >
      {blobs.map(b => (
        <FallingBlob
          key={b.id}
          startX={cx + b.x}
          startY={Math.round(35 * scale)}
          drift={b.drift}
          delay={b.delay}
          fill={b.fill}
          onDone={() => removeBlob(b.id)}
        />
      ))}

      <svg
        width={svgW} height={svgH}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        overflow="visible"
        aria-hidden
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
      >
        <path d={TRUNK_BACK.d} fill={TRUNK_BACK.fill} style={swayStyle} />

        <g style={swayStyle}>
          {BLOBS.map((b, i) => (
            <path
              key={i}
              d={b.d}
              fill={b.fill}
              style={{
                transformBox:    'fill-box',
                transformOrigin: 'center',
                animation:       `blobPop 0.45s cubic-bezier(.34,1.56,.64,1) ${growDelay + i * 35}ms both`,
              }}
            />
          ))}
        </g>

        <path d={TRUNK_SHADE.d} fill={TRUNK_SHADE.fill} style={swayStyle} />
      </svg>
    </div>
  )
}

// ── Falling blob (hover interaction) ────────────────────────────────────────

function FallingBlob({ startX, startY, drift, delay, fill, onDone }: {
  startX: number
  startY: number
  drift:  number
  delay:  number
  fill:   string
  onDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.style.animation = 'leafFall 1.5s ease-in forwards'
      }
      setTimeout(onDone, 1600)
    }, delay)
    return () => clearTimeout(t)
  }, [delay, onDone])

  return (
    <div
      ref={ref}
      style={{
        position:      'absolute',
        top:           startY,
        left:          startX - 4,
        pointerEvents: 'none',
        '--drift':     `${drift * 20}px`,
      } as React.CSSProperties}
    >
      <svg width="8" height="8" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="3.5" fill={fill} opacity="0.9" />
      </svg>
    </div>
  )
}
