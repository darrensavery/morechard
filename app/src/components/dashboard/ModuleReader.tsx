// app/src/components/dashboard/ModuleReader.tsx
// Four-act stepped module reader: Hook → Lesson → Lab → Quiz
// Full-screen overlay, resumable from last completed act.

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { MODULES, PILLARS, type ModuleSlug, type ChildLabData } from '../../lib/labCatalogue'
import { completeLabAct } from '../../lib/api'

const ACT_LABELS = ['Hook', 'Lesson', 'Lab', 'Quiz'] as const
type ActIndex = 0 | 1 | 2 | 3

interface ModuleReaderProps {
  slug:           ModuleSlug
  childData:      ChildLabData
  completedActs:  number[]
  onActComplete:  (actNum: 1 | 2 | 3 | 4) => void
  onClose:        () => void
}

export function ModuleReader({ slug, childData, completedActs, onActComplete, onClose }: ModuleReaderProps) {
  const mod    = MODULES.find(m => m.slug === slug)!
  const pillar = PILLARS[mod.pillar]

  // Resume from the first incomplete act
  const firstIncomplete = ([0, 1, 2, 3] as ActIndex[]).find(i => !completedActs.includes(i + 1)) ?? 0
  const [actIndex,     setActIndex]     = useState<ActIndex>(firstIncomplete)
  const [quizAnswer,   setQuizAnswer]   = useState<'A' | 'B' | 'C' | null>(null)
  const [quizIdx,      setQuizIdx]      = useState(0)
  const [quizResults,  setQuizResults]  = useState<boolean[]>([])
  const [saving,       setSaving]       = useState(false)

  // Reset quiz state when act changes
  useEffect(() => {
    setQuizAnswer(null)
    setQuizIdx(0)
    setQuizResults([])
  }, [actIndex])

  const actNum    = (actIndex + 1) as 1 | 2 | 3 | 4
  const isCompleted = completedActs.includes(actNum)

  async function markComplete() {
    if (saving || isCompleted) return
    setSaving(true)
    try {
      await completeLabAct(slug, actNum)
      onActComplete(actNum)
    } catch {
      // Optimistic update already done via onActComplete — non-fatal
    } finally {
      setSaving(false)
    }
  }

  function handleNext() {
    if (!isCompleted) markComplete()
    if (actIndex < 3) setActIndex(prev => (prev + 1) as ActIndex)
    else onClose()
  }

  // ── Quiz renderer ─────────────────────────────────────────────────────────
  function renderQuiz() {
    const q = mod.quiz[quizIdx]
    if (!q) {
      return (
        <div className="flex flex-col gap-3 items-center py-6">
          <CheckCircle2 size={40} style={{ color: pillar.color }} />
          <p className="text-[15px] font-semibold text-[var(--color-text)]">Quiz complete</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {quizResults.filter(Boolean).length} of {mod.quiz.length} correct
          </p>
        </div>
      )
    }

    const questionText = typeof q.question === 'function' ? q.question(childData) : q.question
    const answered = quizAnswer !== null

    return (
      <div className="flex flex-col gap-4">
        <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Question {quizIdx + 1} of {mod.quiz.length}
        </p>
        <p className="text-[15px] font-semibold leading-snug">{questionText}</p>
        <div className="flex flex-col gap-2">
          {q.options.map(opt => {
            const isSelected = quizAnswer === opt.label
            const isCorrect  = answered && opt.label === q.correct
            const isWrong    = answered && isSelected && opt.label !== q.correct
            return (
              <button
                key={opt.label}
                disabled={answered}
                onClick={() => {
                  setQuizAnswer(opt.label)
                  setQuizResults(prev => [...prev, opt.label === q.correct])
                }}
                className={[
                  'text-left rounded-xl border px-4 py-3 text-[13px] transition-colors',
                  answered ? '' : 'cursor-pointer hover:border-[var(--brand-primary)]',
                  isCorrect ? 'border-green-500 bg-green-50 text-green-800' : '',
                  isWrong   ? 'border-red-400 bg-red-50 text-red-800' : '',
                  !answered ? 'border-[var(--color-border)]' : '',
                  answered && !isSelected && opt.label !== q.correct ? 'opacity-40' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="font-bold mr-2">{opt.label}.</span>{opt.text}
              </button>
            )
          })}
        </div>
        {answered && (
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-[13px] leading-relaxed">
            <span className="font-semibold">{quizAnswer === q.correct ? '✓ Correct. ' : '✗ Not quite. '}</span>
            {q.explanation}
          </div>
        )}
        {answered && quizIdx < mod.quiz.length - 1 && (
          <button
            onClick={() => { setQuizAnswer(null); setQuizIdx(prev => prev + 1) }}
            className="self-end text-[13px] font-semibold cursor-pointer"
            style={{ color: pillar.color }}
          >
            Next question →
          </button>
        )}
      </div>
    )
  }

  // ── Act content ───────────────────────────────────────────────────────────
  function renderAct() {
    switch (actIndex) {
      case 0: return mod.hook(childData)
      case 1: return mod.lesson(childData)
      case 2: return mod.lab(childData)
      case 3: return renderQuiz()
    }
  }

  const quizDone = actIndex === 3 && (quizResults.length === mod.quiz.length || mod.quiz.length === 0)
  const canProceed = actIndex < 3 || quizDone

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => actIndex > 0 ? setActIndex(prev => (prev - 1) as ActIndex) : onClose()}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {mod.title}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: pillar.color }}>
            {ACT_LABELS[actIndex]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] cursor-pointer"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Act progress strip ── */}
      <div className="flex px-4 pt-3 pb-1 gap-1.5">
        {([0, 1, 2, 3] as ActIndex[]).map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: completedActs.includes(i + 1)
                ? pillar.color
                : i === actIndex
                  ? pillar.mutedColor
                  : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      {/* ── Act labels ── */}
      <div className="flex px-4 pb-3">
        {ACT_LABELS.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <span
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: i === actIndex ? pillar.color : 'var(--color-text-muted)' }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Scrollable act content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {renderAct()}
      </div>

      {/* ── Footer CTA ── */}
      <div className="px-4 pb-6 pt-3 border-t border-[var(--color-border)]">
        {!canProceed ? (
          <p className="text-center text-[13px] text-[var(--color-text-muted)]">
            Answer all questions to continue
          </p>
        ) : (
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full py-3.5 rounded-xl text-white text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: pillar.color }}
          >
            {isCompleted && actIndex < 3 && <CheckCircle2 size={16} />}
            {actIndex < 3 ? 'Next' : 'Finish'}
            {actIndex < 3 && <ChevronRight size={16} />}
          </button>
        )}
      </div>

    </div>
  )
}
