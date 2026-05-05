import { useState, useRef } from 'react'
import type { CurrentModule } from '../../lib/api'
import { CURRICULUM, PILLAR_ICONS, PILLAR_LABELS } from '../../lib/curriculum'

interface Props {
  childName:      string;
  currentModule:  CurrentModule | null;
  completedSlugs: string[];
  retentionScore: number | null;
}

function PillarIcon({ pillar, size = 20 }: { pillar: string; size?: number }) {
  const d = PILLAR_ICONS[pillar] ?? PILLAR_ICONS.LABOR_VALUE
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

function ModuleDetailSheet({
  module, status, onClose,
}: {
  module:  typeof CURRICULUM[number];
  status:  'completed' | 'current' | 'locked';
  onClose: () => void;
}) {
  const statusColors = {
    completed: { bg: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', border: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)', text: 'var(--brand-primary)' },
    current:   { bg: 'color-mix(in srgb, #f59e0b 12%, transparent)',              border: 'color-mix(in srgb, #f59e0b 30%, transparent)',              text: '#d97706'             },
    locked:    { bg: 'var(--color-surface-alt)',                                    border: 'var(--color-border)',                                       text: 'var(--color-text-muted)' },
  }[status]

  const statusLabel = { completed: 'Completed', current: 'In Progress', locked: 'Locked' }[status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: statusColors.bg, border: `1.5px solid ${statusColors.border}`, color: statusColors.text }}>
              <PillarIcon pillar={module.pillar} size={22}/>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide"
                 style={{ color: statusColors.text }}>{statusLabel}</p>
              <p className="text-[16px] font-extrabold text-[var(--color-text)] leading-snug mt-0.5">{module.label}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {PILLAR_LABELS[module.pillar] ?? module.pillar} · Level {module.level}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
              Objective
            </p>
            <p className="text-[14px] text-[var(--color-text)] leading-relaxed">{module.objective}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              Learning Outcomes
            </p>
            <ul className="space-y-2">
              {module.outcomes.map((outcome, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
                    style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
                    {i + 1}
                  </span>
                  <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{outcome}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LabSection({ childName, currentModule, completedSlugs }: Props) {
  const [detailSlug, setDetailSlug] = useState<string | null>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const dragState  = useRef({ dragging: false, moved: false, startX: 0, scrollLeft: 0 })

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current
    if (!el) return
    dragState.current = { dragging: true, moved: false, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current.dragging || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const delta = x - dragState.current.startX
    if (Math.abs(delta) > 4) dragState.current.moved = true
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - delta
  }
  function onMouseUp() {
    dragState.current.dragging = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }
  function wasDrag() { return dragState.current.moved }
  const detailModule = detailSlug ? CURRICULUM.find(s => s.slug === detailSlug) : null

  // Only count slugs that actually exist in the curriculum
  const validCompleted = completedSlugs.filter(s => CURRICULUM.some(m => m.slug === s))

  const getStatus = (slug: string): 'completed' | 'current' | 'locked' => {
    if (validCompleted.includes(slug))  return 'completed'
    if (currentModule?.slug === slug)   return 'current'
    return 'locked'
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-[12px] font-bold text-[var(--color-text)]">
          {childName}'s Learning Lab
        </p>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{
            background:  'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
            borderColor: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)',
            color:       'var(--brand-primary)',
          }}>
          {validCompleted.length === 0
            ? 'Not started'
            : `${validCompleted.length} of ${CURRICULUM.length} done`}
        </span>
      </div>

      {/* Current module progress bar */}
      {currentModule && (
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[12px] font-semibold text-[var(--color-text)]">
              Now learning: <span className="font-bold">{currentModule.title}</span>
            </p>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: '#d97706' }}>
              {currentModule.progress_pct}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-[var(--color-surface-alt)]">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width:      `${currentModule.progress_pct}%`,
                background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
              }}/>
          </div>
        </div>
      )}

      {/* Full curriculum carousel */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            Full Curriculum ({CURRICULUM.length} modules)
          </p>
          <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span>scroll to see all</span>
          </div>
        </div>
        {/* Wrapper with right-fade gradient hint */}
        <div className="relative">
          <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, transparent, var(--color-surface))' }}/>
          {/* overflow-visible so the completed-tick badge isn't clipped */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', overflowY: 'visible', cursor: 'grab', userSelect: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
          {CURRICULUM.map(chip => {
            const status    = getStatus(chip.slug)
            const isDone    = status === 'completed'
            const isCurrent = status === 'current'
            const isLocked  = status === 'locked'

            const cardBg     = isDone    ? 'color-mix(in srgb, var(--brand-primary) 10%, var(--color-surface))'
                             : isCurrent ? 'color-mix(in srgb, #f59e0b 10%, var(--color-surface))'
                             : 'var(--color-surface-alt)'
            const cardBorder = isDone    ? 'var(--brand-primary)'
                             : isCurrent ? '#f59e0b'
                             : 'var(--color-border)'
            const iconColor  = isDone    ? 'var(--brand-primary)'
                             : isCurrent ? '#d97706'
                             : 'var(--color-text-muted)'

            return (
              <button
                key={chip.slug}
                type="button"
                onClick={() => { if (!wasDrag()) setDetailSlug(chip.slug) }}
                className="flex flex-col items-center gap-2 shrink-0 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
                style={{ width: 72 }}
              >
                {/* pt-2 gives vertical room for the tick badge that sits above the card */}
                <div className="relative pt-2">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border-2"
                    style={{
                      borderColor: cardBorder,
                      background:  cardBg,
                      opacity:     isLocked ? 0.5 : 1,
                      color:       iconColor,
                    }}>
                    <PillarIcon pillar={chip.pillar} size={22}/>

                    {isLocked && (
                      <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                          stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full"
                        style={{ background: '#f59e0b', border: '2px solid var(--color-surface)' }}>
                        <span className="sr-only">In progress</span>
                      </div>
                    )}
                  </div>

                  {/* Completed tick — sits above the card in the pt-2 breathing room */}
                  {isDone && (
                    <div className="absolute top-0 right-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--brand-primary)', border: '2px solid var(--color-surface)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                  )}
                </div>

                <span className="text-[11px] text-center leading-tight font-semibold"
                  style={{ color: isDone ? 'var(--brand-primary)' : isCurrent ? '#d97706' : 'var(--color-text-muted)' }}>
                  {chip.label}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      </div>

      {/* Module detail sheet */}
      {detailModule && (
        <ModuleDetailSheet
          module={detailModule}
          status={getStatus(detailModule.slug)}
          onClose={() => setDetailSlug(null)}
        />
      )}
    </div>
  )
}
