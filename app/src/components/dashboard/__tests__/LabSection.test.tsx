import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { LabSection } from '../LabSection'
import { describe, it, expect } from 'vitest'
import type { LabModuleProgress } from '../../../lib/api'

const currentModule = {
  slug: 'compound-interest', title: 'The Snowball',
  progress_pct: 60, pillar: 'DELAYED_GRATIFICATION',
}

const labModuleProgress: LabModuleProgress[] = [
  {
    slug: 'patience-tree', title: 'Patience', pillar: 'SAVING_GROWTH', level: 1,
    unlocked_at: 1_700_000_000, completed_acts: [1, 2, 3, 4],
    total_minutes: 12, minutes_done: 12,
  },
  {
    slug: 'compound-interest', title: 'The Snowball', pillar: 'SAVING_GROWTH', level: 2,
    unlocked_at: 1_700_100_000, completed_acts: [1, 2],
    total_minutes: 22, minutes_done: 11,
  },
]

function renderSection(overrides: Partial<ComponentProps<typeof LabSection>> = {}) {
  return render(
    <LabSection
      childName="Henry"
      currentModule={currentModule}
      labModuleProgress={labModuleProgress}
      labActsCompleted={6}
      labTimeInvestedMinutes={23}
      labLastActiveAt={1_700_100_000}
      retentionScore={84}
      {...overrides}
    />
  )
}

describe('LabSection', () => {
  it('renders the section title', () => {
    renderSection()
    expect(screen.getByText("Henry's Learning Lab")).toBeTruthy()
  })

  it('renders the current module being studied', () => {
    renderSection()
    // Appears in the "Now studying" strip and again in the unlocked-modules carousel
    expect(screen.getAllByText('The Snowball').length).toBeGreaterThan(0)
  })

  it('renders the summary stats (acts done and quiz pass rate)', () => {
    renderSection()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText('acts done')).toBeTruthy()
    expect(screen.getByText('84%')).toBeTruthy()
  })

  it('renders the unlocked-modules progress badge', () => {
    renderSection()
    expect(screen.getByText('1 of 2 done')).toBeTruthy()
    expect(screen.getByText('Unlocked modules')).toBeTruthy()
  })
})
