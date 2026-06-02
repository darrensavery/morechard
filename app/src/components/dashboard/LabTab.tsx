// app/src/components/dashboard/LabTab.tsx
// Learning Lab — level-grouped module grid with 3-state tiles + chat history.

import { useState, useEffect, useRef } from 'react'
import { Lock, ChevronRight } from 'lucide-react'
import {
  getLabModules, getChatHistory, postChat,
  type LabModulesResponse, type ChatHistoryItem, type MentorResponse,
} from '../../lib/api'
import {
  MODULES, LEVEL_LABELS, PILLARS,
  type ModuleSlug, type AgeLevel, type AppView, type ChildLabData,
} from '../../lib/labCatalogue'
import { ModuleReader } from './ModuleReader'

// ── Pillar badge colours for chat history ─────────────────────────────────────

const PILLAR_COLOURS: Record<string, string> = {
  LABOR_VALUE:           'bg-amber-100 text-amber-800',
  DELAYED_GRATIFICATION: 'bg-blue-100 text-blue-800',
  OPPORTUNITY_COST:      'bg-orange-100 text-orange-800',
  CAPITAL_MANAGEMENT:    'bg-green-100 text-green-800',
  SOCIAL_RESPONSIBILITY: 'bg-purple-100 text-purple-800',
}

const PILLAR_LABELS: Record<string, string> = {
  LABOR_VALUE:           'Labour Value',
  DELAYED_GRATIFICATION: 'Patience',
  OPPORTUNITY_COST:      'Trade-offs',
  CAPITAL_MANAGEMENT:    'Growth',
  SOCIAL_RESPONSIBILITY: 'Giving',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface LabTabProps {
  appView: AppView
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LabTab({ appView }: LabTabProps) {
  const [labData,      setLabData]      = useState<LabModulesResponse | null>(null)
  const [labLoading,   setLabLoading]   = useState(true)
  const [labError,     setLabError]     = useState<string | null>(null)
  const [activeSlug,   setActiveSlug]   = useState<ModuleSlug | null>(null)

  // Chat state
  const [history,       setHistory]       = useState<ChatHistoryItem[]>([])
  const [histLoading,   setHistLoading]   = useState(true)
  const [inputValue,    setInputValue]    = useState('')
  const [sending,       setSending]       = useState(false)
  const [sendError,     setSendError]     = useState<string | null>(null)
  const [hasMore,       setHasMore]       = useState(false)
  const [histOffset,    setHistOffset]    = useState(0)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [activeHistModule, setActiveHistModule] = useState<{ slug: string; title: string; content: string } | null>(null)

  // Load lab modules
  useEffect(() => {
    let cancelled = false
    setLabLoading(true)
    getLabModules()
      .then(res => { if (!cancelled) { setLabData(res); setLabLoading(false) } })
      .catch(() => { if (!cancelled) { setLabError('Could not load modules.'); setLabLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // Load chat history
  useEffect(() => {
    let cancelled = false
    getChatHistory(20, 0)
      .then(res => {
        if (!cancelled) {
          setHistory(res.history)
          setHasMore(res.history.length === 20)
          setHistLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setHistLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Dialog open/close
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (activeHistModule) { if (!el.open) el.showModal() }
    else { if (el.open) el.close() }
  }, [activeHistModule])

  async function handleSend() {
    const msg = inputValue.trim()
    if (!msg || sending) return
    setSending(true)
    setSendError(null)
    setInputValue('')
    try {
      const res: MentorResponse = await postChat(msg)
      const newItem: ChatHistoryItem = {
        id:          crypto.randomUUID(),
        message:     msg,
        reply:       res.reply,
        pillar:      res.pillar,
        unlock_slug: res.unlock_slug ?? null,
        app_view:    res.app_view,
        locale:      res.locale,
        created_at:  Math.floor(Date.now() / 1000),
      }
      setHistory(prev => [newItem, ...prev])
    } catch {
      setSendError('Message could not be sent. Please try again.')
      setInputValue(msg)
    } finally {
      setSending(false)
    }
  }

  async function handleLoadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    const nextOffset = histOffset + 20
    try {
      const res = await getChatHistory(20, nextOffset)
      setHistory(prev => [...prev, ...res.history])
      setHistOffset(nextOffset)
      setHasMore(res.history.length === 20)
    } catch { /* silent */ }
    finally { setLoadingMore(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const levels: AgeLevel[] = [2, 3, 4]
  const childAge = (labData?.ageLevel ?? 2) as AgeLevel
  const unlockedSlugs = new Set(Object.keys(labData?.modules ?? {}))

  const childLabData: ChildLabData | null = labData
    ? { ...labData.childData, appView }
    : null

  return (
    <div className="flex flex-col gap-6">

      {/* ── Chat Input ── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder={appView === 'ORCHARD' ? 'Ask your Mentor...' : 'Ask a question...'}
            disabled={sending}
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--brand-primary)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
            className="rounded-xl bg-[var(--brand-primary)] text-white px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40 cursor-pointer"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        {sendError && <p className="text-[12px] text-red-500">{sendError}</p>}
      </div>

      {/* ── Module Grid ── */}
      {labLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse rounded-xl bg-[var(--color-border)] h-20" />)}
        </div>
      ) : labError ? (
        <p className="text-[13px] text-red-500">{labError}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {levels.map(level => {
            const levelModules  = MODULES.filter(m => m.level === level)
            const unlockedCount = levelModules.filter(m => unlockedSlugs.has(m.slug)).length
            const levelLabel    = LEVEL_LABELS[level][appView]
            const isFuture      = level > childAge

            return (
              <section key={level}>
                {/* Level header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-[13px] font-bold text-[var(--color-text)] uppercase tracking-wide">
                      {levelLabel}
                      {isFuture && (
                        <span className="ml-2 text-[10px] font-normal text-[var(--color-text-muted)] normal-case tracking-normal">
                          · unlocks later
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {unlockedCount} of {levelModules.length} unlocked
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-20 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: levelModules.length > 0
                          ? `${(unlockedCount / levelModules.length) * 100}%`
                          : '0%',
                        backgroundColor: PILLARS[levelModules[0]?.pillar ?? 1].color,
                      }}
                    />
                  </div>
                </div>

                {/* 2-column tile grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {levelModules.map(mod => {
                    const pillar     = PILLARS[mod.pillar]
                    const isUnlocked = unlockedSlugs.has(mod.slug)
                    const Icon       = mod.icon

                    // Too advanced (above child's level)
                    if (isFuture) {
                      return (
                        <div
                          key={mod.slug}
                          className="rounded-xl border border-[var(--color-border)] p-3 opacity-35 flex flex-col gap-2"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-border)]">
                            <Lock size={14} className="text-[var(--color-text-muted)]" />
                          </div>
                          <p className="text-[12px] font-semibold text-[var(--color-text-muted)] leading-tight">{mod.title}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">{levelLabel}</p>
                        </div>
                      )
                    }

                    // Locked (within child's level but not yet earned)
                    if (!isUnlocked) {
                      return (
                        <div
                          key={mod.slug}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-2"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: pillar.mutedColor }}
                          >
                            <Lock size={14} style={{ color: pillar.color }} />
                          </div>
                          <p className="text-[12px] font-semibold text-[var(--color-text)] leading-tight">{mod.title}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{mod.triggerHint}</p>
                        </div>
                      )
                    }

                    // Unlocked
                    const completedActs = labData?.modules[mod.slug]?.completed_acts ?? []
                    const allDone       = completedActs.length === 4

                    return (
                      <button
                        key={mod.slug}
                        onClick={() => setActiveSlug(mod.slug as ModuleSlug)}
                        className="rounded-xl border-2 bg-[var(--color-surface)] p-3 flex flex-col gap-2 text-left hover:brightness-95 transition-all cursor-pointer"
                        style={{ borderColor: pillar.color }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: pillar.color }}
                          >
                            <Icon size={14} className="text-white" />
                          </div>
                          {allDone ? (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                              style={{ backgroundColor: pillar.color }}
                            >
                              ✓ Done
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                              {completedActs.length}/4
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] font-bold text-[var(--color-text)] leading-tight">{mod.title}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-tight line-clamp-2">{mod.description}</p>
                        <div className="flex items-center gap-1 mt-auto pt-1">
                          <span className="text-[9px] font-semibold" style={{ color: pillar.color }}>
                            {appView === 'ORCHARD' ? pillar.orchardName : pillar.name}
                          </span>
                          <ChevronRight size={9} style={{ color: pillar.color }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Chat History ── */}
      <section>
        <h2 className="text-[12px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
          Mentor History
        </h2>
        {histLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => <div key={i} className="animate-pulse rounded-xl bg-[var(--color-border)] h-16" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {appView === 'ORCHARD' ? 'No conversations yet. Ask the Mentor anything.' : 'No conversations yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-1.5"
              >
                <p className="text-[12px] text-[var(--color-text-muted)] text-right">{item.message}</p>
                <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${PILLAR_COLOURS[item.pillar] ?? 'bg-gray-100 text-gray-700'}`}>
                  {PILLAR_LABELS[item.pillar] ?? item.pillar}
                </span>
                <p className="text-[13px] text-[var(--color-text)] leading-snug">{item.reply}</p>
                {item.unlock_slug && (
                  <p className="text-[11px] text-[var(--brand-primary)] font-semibold">New module unlocked</p>
                )}
              </div>
            ))}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-[13px] text-[var(--brand-primary)] font-semibold py-2 disabled:opacity-40 cursor-pointer"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </section>

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

      {/* ── Legacy chat dialog (unused, kept for safety) ── */}
      <dialog
        ref={dialogRef}
        onClose={() => setActiveHistModule(null)}
        className="fixed inset-0 m-auto w-full max-w-[520px] rounded-t-2xl rounded-b-none sm:rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 shadow-xl backdrop:bg-black/50 max-h-[80vh] overflow-y-auto"
        style={{ bottom: 0, top: 'auto', left: 0, right: 0 }}
      >
        {activeHistModule && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[18px] font-extrabold text-[var(--color-text)]">{activeHistModule.title}</h3>
              <button
                onClick={() => setActiveHistModule(null)}
                className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] cursor-pointer"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-[14px] text-[var(--color-text)] leading-relaxed">{activeHistModule.content}</p>
            <button
              onClick={() => setActiveHistModule(null)}
              className="w-full py-3 rounded-xl bg-[var(--brand-primary)] text-white text-[14px] font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </dialog>

    </div>
  )
}
