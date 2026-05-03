import { render, screen } from '@testing-library/react'
import { LabSection } from '../LabSection'
import { describe, it, expect } from 'vitest'
import type { CurrentModule } from '../../../lib/api'

const mod: CurrentModule = {
  slug: 'compound-interest', title: 'The Snowball',
  progress_pct: 60, pillar: 'DELAYED_GRATIFICATION',
}

describe('LabSection', () => {
  it('renders section title', () => {
    render(
      <LabSection
        childName="Henry"
        currentModule={mod}
        completedSlugs={['patience-tree']}
        retentionScore={84}
      />
    )
    expect(screen.getByText("Henry's Toolkit")).toBeTruthy()
  })

  it('renders current module name', () => {
    render(
      <LabSection
        childName="Henry"
        currentModule={mod}
        completedSlugs={[]}
        retentionScore={null}
      />
    )
    expect(screen.getByText('The Snowball')).toBeTruthy()
  })

  it('renders retention score when provided', () => {
    render(
      <LabSection
        childName="Henry"
        currentModule={mod}
        completedSlugs={[]}
        retentionScore={84}
      />
    )
    expect(screen.getByText('84%')).toBeTruthy()
  })

  it('renders skill track label', () => {
    render(
      <LabSection
        childName="Henry"
        currentModule={mod}
        completedSlugs={['patience-tree']}
        retentionScore={null}
      />
    )
    expect(screen.getByText("Skills Henry is Building")).toBeTruthy()
  })
})
