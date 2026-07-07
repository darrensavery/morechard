import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ChildNudgeBanner } from '../ChildNudgeBanner'
import type { ChildNudge } from '../../../lib/api'

function makeNudge(source: ChildNudge['source']): ChildNudge {
  return {
    id: 1,
    trigger_type: 'streak_3',
    screen_context: 'earn',
    orchard_text: 'Three tasks in a row!',
    clean_text: 'Three-day streak.',
    pillar: 'LABOR_VALUE',
    tone: 'encouraging',
    source,
    parent_summary: 'Streak nudge',
    created_at: 0,
  }
}

describe('ChildNudgeBanner', () => {
  it('shows the AI-generated pill when source is ai', () => {
    render(<ChildNudgeBanner nudge={makeNudge('ai')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })

  it('does not show the pill for rule_based nudges', () => {
    render(<ChildNudgeBanner nudge={makeNudge('rule_based')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.queryByText('AI-generated')).toBeNull()
  })

  it('still renders a static attribution footer regardless of source', () => {
    render(<ChildNudgeBanner nudge={makeNudge('rule_based')} appView="ORCHARD" onDismiss={vi.fn()} />)
    expect(screen.getByText(/Personalised coaching/)).toBeTruthy()
  })
})
