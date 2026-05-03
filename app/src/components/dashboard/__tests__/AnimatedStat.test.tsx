import { render, screen } from '@testing-library/react'
import { AnimatedStat } from '../AnimatedStat'
import { describe, it, expect } from 'vitest'

describe('AnimatedStat', () => {
  it('renders the value', () => {
    render(<AnimatedStat value="£8.50" />)
    expect(screen.getByText('£8.50')).toBeTruthy()
  })

  it('renders with className', () => {
    const { container } = render(<AnimatedStat value="7" className="font-bold" />)
    expect(container.firstChild).toBeTruthy()
  })
})
