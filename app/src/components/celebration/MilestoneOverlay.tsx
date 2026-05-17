/**
 * MilestoneOverlay — CelebrationEngine base renderer.
 * Sequences through MilestoneConfig stages with timed transitions.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'
import type { MilestoneEvent } from './types'
import { CONFIGS } from './registry'
import { StreakRing } from './StreakRing'

interface Props {
  event:      MilestoneEvent
  onComplete: () => void
}

type Phase = 'stage' | 'transition' | 'exit'

function spawnConfetti(container: HTMLDivElement) {
  const cols = ['#00959c', '#3fcf9b', '#e6b222', '#ffe39a', '#1d8f6f']
  for (let i = 0; i < 22; i++) {
    const leaf = document.createElement('div')
    const size = 10 + Math.random() * 8
    leaf.style.cssText = [
      'position:absolute', 'top:-28px',
      `width:${size}px`, `height:${size}px`,
      `left:${6 + Math.random() * 88}%`,
      `background:${cols[i % cols.length]}`,
      'border-radius:0 100% 0 100%',
      'opacity:0',
      `animation:mc-leaf-drop ${2.6 + Math.random() * 1.4}s cubic-bezier(.3,.2,.5,1) ${Math.random() * 0.5}s 1 forwards`,
      `--dx:${(Math.random() * 120) - 60}px`,
    ].join(';')
    container.appendChild(leaf)
  }
}

export function MilestoneOverlay({ event, onComplete }: Props) {
  const config    = CONFIGS[event.type] ?? null
  const stages    = config ? (event.appView === 'CLEAN' ? config.clean : config.orchard) : []
  const isShimmer = config?.transition === 'shimmer'
  const hasPayoff = config?.tier === 'landmark' || config?.tier === 'standard'

  const [stageIdx, setStageIdx] = useState(0)
  const [phase,    setPhase]    = useState<Phase>('stage')
  const [visible,  setVisible]  = useState(true)
  const containerRef            = useRef<HTMLDivElement>(null)
  const flashRef                = useRef<HTMLDivElement>(null)
  const confettiSpawned         = useRef(false)
  const onCompleteRef           = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  const triggerPayoff = useCallback(() => {
    if (!confettiSpawned.current && containerRef.current && hasPayoff) {
      confettiSpawned.current = true
      if (flashRef.current) {
        flashRef.current.style.animation = 'none'
        void flashRef.current.offsetWidth
        flashRef.current.style.animation = 'mc-flash .42s ease-out 1 forwards'
      }
      spawnConfetti(containerRef.current)
    }
  }, [hasPayoff])

  useEffect(() => {
    if (!config || stages.length === 0) { onCompleteRef.current(); return }
    confettiSpawned.current = false

    const current = stages[stageIdx]
    let tInner: ReturnType<typeof setTimeout> | null = null

    const tTransition = setTimeout(() => {
      if (stageIdx < stages.length - 1) {
        setPhase('transition')
        tInner = setTimeout(() => {
          setStageIdx(i => i + 1)
          setPhase('stage')
        }, 1500)
      } else {
        setPhase('exit')
        setVisible(false)
        setTimeout(() => onCompleteRef.current(), 600)
      }
    }, current.durationMs)

    return () => {
      clearTimeout(tTransition)
      if (tInner !== null) clearTimeout(tInner)
    }
  }, [stageIdx, stages, config])

  // Auto-trigger payoff for orchard streak stages (no ring to signal completion)
  useEffect(() => {
    const current = stages[stageIdx]
    if (current?.variant === 'streak-ring' && event.appView !== 'CLEAN') {
      triggerPayoff()
    }
  }, [stageIdx, stages, event.appView, triggerPayoff])

  if (!config) return null

  const current = stages[stageIdx]
  const isStreakRing = current.variant === 'streak-ring' && event.appView === 'CLEAN'

  return (
    <>
      <style>{`
        @keyframes mc-flash {
          0%   { opacity:0; transform:scale(.2) }
          18%  { opacity:1 }
          100% { opacity:0; transform:scale(1.5) }
        }
        @keyframes mc-leaf-drop {
          0%   { opacity:0; transform:translateY(-30px) translateX(0) rotate(0) }
          8%   { opacity:1 }
          100% { opacity:0; transform:translateY(600px) translateX(var(--dx,30px)) rotate(540deg) }
        }
      `}</style>

      <div
        ref={containerRef}
        className={cn(
          'fixed inset-0 z-[100] flex items-center justify-center overflow-hidden',
          'transition-opacity duration-[600ms]',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ backgroundColor: config.bgColor }}
      >
        <div
          ref={flashRef}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
            background: 'radial-gradient(circle at 50% 40%,rgba(255,255,255,.95),rgba(230,178,34,.5) 35%,transparent 70%)',
          }}
        />

        {isShimmer && phase === 'transition' && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-amber-400/10 to-blue-500/20 animate-pulse pointer-events-none" />
        )}
        {!isShimmer && phase === 'transition' && (
          <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        )}
        {phase === 'transition' && (
          <div className="absolute text-5xl animate-spin pointer-events-none" style={{ animationDuration: '2s' }}>
            {isShimmer ? '✦' : '◈'}
          </div>
        )}

        <div className={cn(
          'text-center px-8 max-w-sm transition-all duration-700 flex flex-col items-center',
          phase === 'stage' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 scale-95 pointer-events-none',
        )}>
          {isStreakRing ? (
            <StreakRing
              previousValue={event.meta?.previousStreak ?? 0}
              newValue={event.meta?.newStreak ?? 0}
              onComplete={triggerPayoff}
            />
          ) : (
            <div className="text-6xl mb-6">{current.icon}</div>
          )}
          <p className={cn('text-[22px] font-bold leading-snug mb-3', current.headingColor)}>
            {current.heading}
          </p>
          <p className={cn('text-[15px] leading-relaxed', current.bodyColor)}>
            {current.body}
          </p>
          {current.attribution && (
            <p className="text-[12px] text-white/30 mt-4 italic">{current.attribution}</p>
          )}
        </div>
      </div>
    </>
  )
}
