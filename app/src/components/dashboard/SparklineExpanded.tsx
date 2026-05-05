import { useRef, useState, useCallback } from 'react'
import { motion, animate, useMotionValue } from 'framer-motion'
import { useAndroidBack } from '../../hooks/useAndroidBack'
import type { MilestoneMarker } from '../../lib/api'

interface Props {
  label:           string;
  value:           number | null;
  points:          number[];
  milestones:      MilestoneMarker[];
  hasLearningLab:  boolean;
  nextModuleTitle: string | null;
  onClose:         () => void;
}

function toPolylinePoints(data: number[], w: number, h: number): string {
  if (data.length < 2) return ''
  return data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / 100) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export function SparklineExpanded({
  label, value, points, milestones, hasLearningLab, nextModuleTitle, onClose,
}: Props) {
  useAndroidBack(true, onClose)

  const W = 1000, H = 400
  const polyPoints = toPolylinePoints(points, W, H)

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
    const y    = H - (points[idx] / 100) * H
    animate(dotX, x, { type: 'spring', stiffness: 300, damping: 20 })
    animate(dotY, y, { type: 'spring', stiffness: 300, damping: 20 })
    setActiveIdx(idx)
    const milestone = milestones.find(m => m.point_index === idx)
    setTooltip(milestone
      ? `${milestone.module_title} · ↑ ${milestone.delta_after}%`
      : points[idx] >= 80 ? 'Great work 🌱' : points[idx] >= 50 ? 'Solid effort' : 'Room to grow')
  }, [points, milestones, dotX, dotY])

  const handlePointerLeave = useCallback(() => setActiveIdx(null), [])

  const lastMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null
  const curtainX = lastMilestone && points.length > 1
    ? (lastMilestone.point_index / (points.length - 1)) * W
    : null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-5 pb-3 border-b border-[var(--color-border)] shrink-0">
        <div>
          <p className="text-[17px] font-extrabold text-[var(--color-text)] tracking-tight">{label}</p>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
            {hasLearningLab ? 'Tap any point · 🎓 = module completed' : 'Tap any point to inspect'}
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

      {/* Current value pill */}
      {value !== null && (
        <div className="px-4 pt-3 shrink-0">
          <span className="text-[28px] font-black tabular-nums text-[var(--brand-primary)]">{value}%</span>
          <span className="text-[13px] text-[var(--color-text-muted)] ml-2">{label.toLowerCase()} score</span>
        </div>
      )}

      {/* Chart — fills remaining space */}
      <div className="flex-1 px-4 pt-3 pb-2 relative min-h-0">
        {activeIdx !== null && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 shadow-sm z-10 pointer-events-none whitespace-nowrap">
            {tooltip}
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.22}/>
              <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>

          {/* Grid lines at 25 / 50 / 75% */}
          {[25, 50, 75].map(pct => (
            <line key={pct}
              x1={0} y1={H - (pct / 100) * H}
              x2={W} y2={H - (pct / 100) * H}
              stroke="var(--color-border)" strokeWidth={2} opacity={0.5}/>
          ))}

          {/* Post-lesson curtain */}
          {hasLearningLab && curtainX !== null && (
            <>
              <rect x={curtainX} y={0} width={W - curtainX} height={H} fill="var(--brand-primary)" opacity={0.04}/>
              <line x1={curtainX} y1={0} x2={curtainX} y2={H}
                stroke="var(--brand-accent)" strokeWidth={3} strokeDasharray="8 5" opacity={0.6}/>
            </>
          )}

          {/* Milestone emoji markers */}
          {hasLearningLab && milestones.map((m, mi) => {
            const x = points.length > 1 ? (m.point_index / (points.length - 1)) * W : W / 2
            const y = points[m.point_index] !== undefined ? H - (points[m.point_index] / 100) * H - 18 : 18
            return <text key={mi} x={x} y={y} textAnchor="middle" fontSize={22}>🎓</text>
          })}

          {/* Area fill */}
          {polyPoints && (
            <polygon points={`${polyPoints} ${W},${H} 0,${H}`} fill="url(#exp-grad)"/>
          )}

          {/* Line */}
          {polyPoints && (
            <polyline
              points={polyPoints}
              fill="none"
              stroke="var(--brand-primary)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair */}
          {activeIdx !== null && (
            <motion.line x1={dotX} x2={dotX} y1={0} y2={H}
              stroke="var(--brand-primary)" strokeWidth={2} strokeDasharray="5 4" opacity={0.4}/>
          )}

          {/* Dot */}
          {activeIdx !== null && (
            <motion.circle cx={dotX} cy={dotY} r={10} fill="var(--brand-primary)"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
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
      <div className="flex gap-5 px-4 pb-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]"/>
          <span className="text-[11px] text-[var(--color-text-muted)]">{label} score</span>
        </div>
        {hasLearningLab && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)] opacity-40"/>
              <span className="text-[11px] text-[var(--color-text-muted)]">After lesson</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <span>🎓</span><span>Module complete</span>
            </div>
          </>
        )}
      </div>

      {/* Next-module recommendation */}
      {hasLearningLab && nextModuleTitle && (
        <div className="mx-4 mb-5 rounded-xl px-4 py-3 border shrink-0"
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
