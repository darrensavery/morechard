import { render, screen, fireEvent } from '@testing-library/react'
import { SparklineExpanded } from '../SparklineExpanded'
import { describe, it, expect, vi } from 'vitest'
import type { MilestoneMarker } from '../../../lib/api'

const points  = [40, 45, 50, 55, 60, 62, 64]
const markers: MilestoneMarker[] = []

describe('SparklineExpanded', () => {
  it('renders the title', () => {
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={false}
        nextModuleTitle={null}
        onClose={() => {}}
        onUpgrade={() => {}}
      />
    )
    expect(screen.getByText('Consistency')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={false}
        nextModuleTitle={null}
        onClose={onClose}
        onUpgrade={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows next-module recommendation when hasLearningLab and nextModuleTitle provided', () => {
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={true}
        nextModuleTitle="Opportunity Cost"
        onClose={() => {}}
        onUpgrade={() => {}}
      />
    )
    expect(screen.getByText(/Opportunity Cost/)).toBeTruthy()
  })

  it('does not show module recommendation for Core tier', () => {
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={false}
        nextModuleTitle="Opportunity Cost"
        onClose={() => {}}
        onUpgrade={() => {}}
      />
    )
    expect(screen.queryByText(/Opportunity Cost/)).toBeNull()
  })

  it('shows a Learning Lab upsell CTA for Core tier and calls onUpgrade when tapped', () => {
    const onUpgrade = vi.fn()
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={false}
        nextModuleTitle={null}
        onClose={() => {}}
        onUpgrade={onUpgrade}
      />
    )
    fireEvent.click(screen.getByText(/add AI Mentor \+ Learning Lab/i))
    expect(onUpgrade).toHaveBeenCalled()
  })

  it('does not show the Learning Lab upsell CTA once Learning Lab is enabled', () => {
    render(
      <SparklineExpanded
        label="Consistency"
        value={64}
        points={points}
        milestones={markers}
        choreEvents={[]}
        hasLearningLab={true}
        nextModuleTitle="Opportunity Cost"
        onClose={() => {}}
        onUpgrade={() => {}}
      />
    )
    expect(screen.queryByText(/add AI Mentor \+ Learning Lab/i)).toBeNull()
  })
})
