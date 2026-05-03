import { render, screen } from '@testing-library/react'
import { SparklineCard } from '../SparklineCard'
import { describe, it, expect } from 'vitest'
import type { TrendEntry } from '../../../lib/api'

const flatTrend: TrendEntry = { current: 64, delta: 0, direction: 'flat' }
const upTrend:   TrendEntry = { current: 78, delta: 12, direction: 'up' }
const downTrend: TrendEntry = { current: 42, delta: -3, direction: 'down' }

describe('SparklineCard', () => {
  it('renders label and value', () => {
    render(
      <SparklineCard
        label="Consistency"
        value={64}
        trend={flatTrend}
        points={[40, 50, 60, 55, 64, 62, 64]}
        isDiscovery={false}
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('Consistency')).toBeTruthy()
    expect(screen.getByText('64%')).toBeTruthy()
  })

  it('shows up arrow for up trend', () => {
    render(
      <SparklineCard
        label="Responsibility"
        value={78}
        trend={upTrend}
        points={[50, 55, 60, 65, 70, 75, 78]}
        isDiscovery={false}
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('↑ 12%')).toBeTruthy()
  })

  it('shows down arrow for down trend', () => {
    render(
      <SparklineCard
        label="Savings"
        value={42}
        trend={downTrend}
        points={[50, 48, 46, 44, 43, 43, 42]}
        isDiscovery={false}
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('↓ 3%')).toBeTruthy()
  })

  it('shows Establishing in discovery phase', () => {
    render(
      <SparklineCard
        label="Consistency"
        value={null}
        trend={null}
        points={[]}
        isDiscovery={true}
        onExpand={() => {}}
      />
    )
    expect(screen.getByText('Establishing…')).toBeTruthy()
  })
})
