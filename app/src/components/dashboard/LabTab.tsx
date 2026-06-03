// app/src/components/dashboard/LabTab.tsx
// Learning Lab — level-grouped module grid, behaviour-triggered unlocks only.
// No chat input — the Mentor is observation-driven, not interactive.

import { useState, useEffect } from 'react'
import { Lock, ChevronRight, BookOpen } from 'lucide-react'
import { getLabModules, type LabModulesResponse } from '../../lib/api'
import {
  MODULES, LEVEL_LABELS, PILLARS,
  type ModuleSlug, type AgeLevel, type AppView, type ChildLabData,
} from '../../lib/labCatalogue'
import { ModuleReader } from './ModuleReader'

interface LabTabProps {
  appView: AppView
}

export function LabTab({ appView }: LabTabProps) {
  const [labData,    setLabData]    = useState<LabModulesResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [activeSlug, setActiveSlug] = useState<ModuleSlug | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLabModules()
      .then(res => { if (!cancelled) { setLabData(res); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Could not load modules.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const levels: AgeLevel[]      = [2, 3, 4]
  const childAge                 = (labData?.ageLevel ?? 2) as AgeLevel
  const unlockedSlugs            = new Set(Object.keys(labData?.modules ?? {}))
  const childLabData: ChildLabData | null = labData
    ? { ...labData.childData, appView }
    : null

  if (loading) return (
    <div className="flex flex-col gap-3 pt-1">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="animate-pulse rounded-xl bg-[var(--color-border)] h-20" />
      ))}
    </div>
  )

  if (error || !labData) return (
    <p className="text-[13px] text-red-500 pt-2">{error ?? 'No data'}</p>
  )

  const totalUnlocked = Object.keys(labData.modules).length
  const totalModules  = MODULES.length

  return (
    <div className="flex flex-col gap-7">

      {/* ── Introduction ── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col gap-2">
        <h2 className="text-[14px] font-bold text-[var(--color-text)] leading-snug">
          {appView === 'ORCHARD' ? 'The Orchard Curriculum' : 'Learning Lab'}
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
          {appView === 'ORCHARD'
            ? 'Each module unlocks when you do something real — earn your first £20, save for four weeks in a row, or set a goal. The lessons use your actual data, not made-up numbers.'
            : 'Modules unlock based on your activity — earnings, goals, and spending patterns. Each lesson is calculated using your real figures.'}
        </p>
        {totalUnlocked > 0 && (
          <p className="text-[11px] font-semibold text-[var(--brand-primary)]">
            {totalUnlocked} of {totalModules} modules unlocked
          </p>
        )}
      </div>

      {levels.map(level => {
        const levelModules  = MODULES.filter(m => m.level === level)
        const unlockedCount = levelModules.filter(m => unlockedSlugs.has(m.slug)).length
        const levelLabel    = LEVEL_LABELS[level][appView]
        const isFuture      = level > childAge
        const totalCount    = levelModules.length

        return (
          <section key={level}>

            {/* ── Level header ── */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className={`text-[11px] font-bold uppercase tracking-[0.08em] ${isFuture ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                  {levelLabel}
                  {isFuture && (
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-[10px]">
                      · unlocks later
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {unlockedCount} of {totalCount} {unlockedCount === totalCount && totalCount > 0 ? '— complete' : 'unlocked'}
                </p>
              </div>

              {/* Progress bar */}
              {!isFuture && (
                <div className="w-16 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalCount > 0 ? `${(unlockedCount / totalCount) * 100}%` : '0%',
                      backgroundColor: 'var(--brand-primary)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── 2-column tile grid ── */}
            <div className="grid grid-cols-2 gap-2.5">
              {levelModules.map(mod => {
                const isUnlocked  = unlockedSlugs.has(mod.slug)
                const Icon        = mod.icon
                const pillarLabel = appView === 'ORCHARD' ? PILLARS[mod.pillar].orchardName : PILLARS[mod.pillar].name

                // ── Too advanced ──
                if (isFuture) {
                  return (
                    <div
                      key={mod.slug}
                      className="rounded-xl border border-[var(--color-border)] p-3 opacity-30 flex flex-col gap-2"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--color-border)]">
                        <Lock size={12} className="text-[var(--color-text-muted)]" />
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--color-text-muted)] leading-tight">{mod.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{levelLabel}</p>
                    </div>
                  )
                }

                // ── Locked (within level) ──
                if (!isUnlocked) {
                  return (
                    <div
                      key={mod.slug}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      >
                        <Lock size={12} className="text-[var(--color-text-muted)]" />
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--color-text)] leading-tight">{mod.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{mod.triggerHint}</p>
                    </div>
                  )
                }

                // ── Unlocked ──
                const completedActs = labData.modules[mod.slug]?.completed_acts ?? []
                const allDone       = completedActs.length === 4

                return (
                  <button
                    key={mod.slug}
                    onClick={() => setActiveSlug(mod.slug as ModuleSlug)}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2 text-left cursor-pointer transition-all hover:border-[var(--brand-primary)] hover:shadow-sm"
                    style={{ borderLeftWidth: 3, borderLeftColor: 'var(--brand-primary)' }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'rgba(0,149,156,0.08)' }}
                      >
                        <Icon size={13} style={{ color: 'var(--brand-primary)' }} />
                      </div>
                      {allDone ? (
                        <span className="text-[9px] font-bold text-[var(--brand-primary)] flex-shrink-0 mt-0.5">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
                          {completedActs.length}/4
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <p className="text-[12px] font-bold text-[var(--color-text)] leading-tight">{mod.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] leading-tight line-clamp-2">{mod.description}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-auto pt-0.5">
                      <span className="text-[9px] text-[var(--color-text-muted)]">{pillarLabel}</span>
                      <ChevronRight size={9} className="text-[var(--color-text-muted)]" />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* ── Empty state if no modules at all ── */}
      {!loading && MODULES.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10">
          <BookOpen size={32} className="text-[var(--color-text-muted)]" />
          <p className="text-[13px] text-[var(--color-text-muted)] text-center">
            Modules unlock as you use the app.
          </p>
        </div>
      )}

      {/* ── Module Reader overlay ── */}
      {activeSlug && childLabData && labData && (
        <ModuleReader
          slug={activeSlug}
          childData={childLabData}
          completedActs={labData.modules[activeSlug]?.completed_acts ?? []}
          onActComplete={(actNum) => {
            setLabData(prev => {
              if (!prev) return prev
              const existing = prev.modules[activeSlug] ?? { unlocked_at: Date.now(), completed_acts: [] }
              const acts = existing.completed_acts.includes(actNum)
                ? existing.completed_acts
                : [...existing.completed_acts, actNum]
              return {
                ...prev,
                modules: { ...prev.modules, [activeSlug]: { ...existing, completed_acts: acts } },
              }
            })
          }}
          onClose={() => setActiveSlug(null)}
        />
      )}

    </div>
  )
}
