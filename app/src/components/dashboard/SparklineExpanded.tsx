import { useRef, useState, useCallback } from 'react'
import { motion, animate, useMotionValue } from 'framer-motion'
import { useAndroidBack } from '../../hooks/useAndroidBack'
import type { MilestoneMarker } from '../../lib/api'

interface ChoreEvent { point_index: number; first_pass: boolean }

interface Props {
  label:           string;
  value:           number | null;
  points:          number[];
  milestones:      MilestoneMarker[];
  choreEvents:     ChoreEvent[];
  hasLearningLab:  boolean;
  nextModuleTitle: string | null;
  onClose:         () => void;
}

// SVG canvas dimensions — large numbers give SVG more precision
const W = 1000
const H = 360

// Y margins so 0% and 100% labels don't clip
const PAD_TOP    = 20
const PAD_BOTTOM = 24

function toPolylinePoints(data: number[], w: number, h: number, padT: number, padB: number): string {
  if (data.length < 2) return ''
  const usableH = h - padT - padB
  return data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = padT + usableH - (v / 100) * usableH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function getY(v: number, h: number, padT: number, padB: number): number {
  return padT + (h - padT - padB) - (v / 100) * (h - padT - padB)
}

export function SparklineExpanded({
  label, value, points, milestones, choreEvents, hasLearningLab, nextModuleTitle, onClose,
}: Props) {
  useAndroidBack(true, onClose)

  const polyPoints = toPolylinePoints(points, W, H, PAD_TOP, PAD_BOTTOM)

  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [tooltip,   setTooltip]   = useState('')
  const overlayRef  = useRef<SVGRectElement>(null)
  const dotX = useMotionValue(0)
  const dotY = useMotionValue(0)

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!overlayRef.current || points.length < 2) return
    const rect = overlayRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const idx  = Math.max(0, Math.min(points.length - 1, Math.round(relX * (points.length - 1))))
    const x    = (idx / (points.length - 1)) * W
    const y    = getY(points[idx], H, PAD_TOP, PAD_BOTTOM)
    animate(dotX, x, { type: 'spring', stiffness: 300, damping: 20 })
    animate(dotY, y, { type: 'spring', stiffness: 300, damping: 20 })
    setActiveIdx(idx)
    const milestone = milestones.find(m => m.point_index === idx)
    const chore     = choreEvents.filter(c => c.point_index === idx)
    if (milestone) {
      setTooltip(`🎓 ${milestone.module_title}`)
    } else if (chore.length > 0) {
      const fp = chore.filter(c => c.first_pass).length
      setTooltip(`${chore.length} chore${chore.length > 1 ? 's' : ''} · ${fp} first-pass`)
    } else {
      const v = points[idx]
      setTooltip(v >= 80 ? 'Great work 🌱' : v >= 50 ? 'Solid effort' : v > 0 ? 'Room to grow' : 'No data')
    }
  }, [points, milestones, choreEvents, dotX, dotY])

  const handlePointerLeave = useCallback(() => setActiveIdx(null), [])

  const lastMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null
  const curtainX = lastMilestone && points.length > 1
    ? (lastMilestone.point_index / (points.length - 1)) * W
    : null

  // Deduplicate chore events by bucket for rendering (show one dot per bucket)
  const choreByBucket = new Map<number, { total: number; firstPass: number }>()
  for (const c of choreEvents) {
    const existing = choreByBucket.get(c.point_index) ?? { total: 0, firstPass: 0 }
    choreByBucket.set(c.point_index, {
      total:     existing.total + 1,
      firstPass: existing.firstPass + (c.first_pass ? 1 : 0),
    })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)] shrink-0">
        <div>
          <p className="text-[18px] font-extrabold text-[var(--color-text)] tracking-tight">{label}</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
            All-time trend · {hasLearningLab ? 'tap any point · 🎓 = module unlocked' : 'tap any point to inspect'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Score + tooltip row */}
      <div className="flex items-baseline gap-3 px-5 pt-3 pb-1 shrink-0">
        <span className="text-[32px] font-black tabular-nums leading-none" style={{ color: 'var(--brand-primary)' }}>
          {value !== null ? `${value}%` : '—'}
        </span>
        <span className="text-[13px] text-[var(--color-text-muted)]">{label.toLowerCase()} score</span>
        {activeIdx !== null && (
          <span className="ml-auto text-[12px] font-semibold text-[var(--color-text)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-2.5 py-1 whitespace-nowrap">
            {tooltip}
          </span>
        )}
      </div>

      {/* Chart — fills remaining space */}
      <div className="flex-1 min-h-0 relative px-5 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.18}/>
              <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>

          {/* Axis grid lines at 0 / 25 / 50 / 75 / 100% */}
          {[0, 25, 50, 75, 100].map(pct => {
            const y = getY(pct, H, PAD_TOP, PAD_BOTTOM)
            return (
              <g key={pct}>
                <line x1={0} y1={y} x2={W} y2={y}
                  stroke="var(--color-border)" strokeWidth={pct === 0 || pct === 100 ? 1.5 : 1} opacity={0.5}/>
                {/* Y-axis labels — rendered in SVG using foreignObject workaround: use text instead */}
                <text x={-8} y={y + 4} textAnchor="end" fontSize={24}
                  fill="var(--color-text-muted)" opacity={0.6}>{pct}%</text>
              </g>
            )
          })}

          {/* Post-lesson curtain */}
          {hasLearningLab && curtainX !== null && (
            <>
              <rect x={curtainX} y={PAD_TOP} width={W - curtainX} height={H - PAD_TOP - PAD_BOTTOM}
                fill="var(--brand-primary)" opacity={0.04}/>
              <line x1={curtainX} y1={PAD_TOP} x2={curtainX} y2={H - PAD_BOTTOM}
                stroke="var(--brand-accent)" strokeWidth={2.5} strokeDasharray="6 4" opacity={0.55}/>
            </>
          )}

          {/* Area fill */}
          {polyPoints && (
            <polygon
              points={`${polyPoints} ${W},${getY(0, H, PAD_TOP, PAD_BOTTOM)} 0,${getY(0, H, PAD_TOP, PAD_BOTTOM)}`}
              fill="url(#exp-grad)"
            />
          )}

          {/* Line */}
          {polyPoints && (
            <polyline
              points={polyPoints}
              fill="none"
              stroke="var(--brand-primary)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Chore event dots — one per bucket, size = chore count */}
          {points.length > 1 && Array.from(choreByBucket.entries()).map(([idx, info]) => {
            const x = (idx / (points.length - 1)) * W
            const y = getY(points[idx] ?? 50, H, PAD_TOP, PAD_BOTTOM)
            const allFirstPass = info.firstPass === info.total
            return (
              <circle key={`chore-${idx}`}
                cx={x} cy={y}
                r={Math.min(22, 10 + info.total * 3)}
                fill={allFirstPass ? 'var(--brand-primary)' : '#f59e0b'}
                opacity={0.45}
                stroke="var(--color-surface)"
                strokeWidth={3}
              />
            )
          })}

          {/* Milestone emoji markers */}
          {hasLearningLab && milestones.map((m, mi) => {
            const x = points.length > 1 ? (m.point_index / (points.length - 1)) * W : W / 2
            const y = points[m.point_index] !== undefined
              ? getY(points[m.point_index], H, PAD_TOP, PAD_BOTTOM) - 22
              : PAD_TOP
            return <text key={mi} x={x} y={y} textAnchor="middle" fontSize={24}>🎓</text>
          })}

          {/* Active crosshair */}
          {activeIdx !== null && (
            <motion.line x1={dotX} x2={dotX} y1={PAD_TOP} y2={H - PAD_BOTTOM}
              stroke="var(--brand-primary)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.45}/>
          )}

          {/* Active dot */}
          {activeIdx !== null && (
            <motion.circle cx={dotX} cy={dotY} r={12} fill="var(--brand-primary)"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}/>
          )}

          {/* Hit area */}
          <rect
            ref={overlayRef}
            x={0} y={0} width={W} height={H}
            fill="none" style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 pb-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]"/>
          <span className="text-[11px] text-[var(--color-text-muted)]">{label} score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)] opacity-45"/>
          <span className="text-[11px] text-[var(--color-text-muted)]">Chore (first-pass)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b] opacity-45"/>
          <span className="text-[11px] text-[var(--color-text-muted)]">Chore (revised)</span>
        </div>
        {hasLearningLab && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <span>🎓</span><span>Module unlocked</span>
          </div>
        )}
      </div>

      {/* Next-module recommendation */}
      {hasLearningLab && nextModuleTitle && (
        <div className="mx-5 mb-5 rounded-xl px-4 py-3 border shrink-0"
          style={{
            background:  'color-mix(in srgb, var(--brand-primary) 8%, var(--color-surface))',
            borderColor: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
          }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--brand-primary)] mb-1">✦ Recommended next</p>
          <p className="text-[13px] text-[var(--color-text)] leading-snug">
            To strengthen this metric, try <strong>"{nextModuleTitle}"</strong> in the Learning Lab.
          </p>
        </div>
      )}
    </motion.div>
  )
}
