import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { OnboardingCarousel } from '../OnboardingCarousel'
import { ONBOARDING_SEEN_KEY } from '../../lib/onboarding'

function renderCarousel() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingCarousel />
    </MemoryRouter>
  )
}

describe('OnboardingCarousel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the first slide headline on mount', () => {
    renderCarousel()
    expect(screen.getByText('Chores that actually pay')).toBeInTheDocument()
  })

  it('shows 4 pagination dots', () => {
    renderCarousel()
    expect(screen.getAllByRole('button', { name: /go to slide/i })).toHaveLength(4)
  })

  it('advances to the next slide when Next is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Money lessons that actually stick')).toBeInTheDocument()
  })

  it('shows "Get Started" instead of "Next" on the final slide', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('A record nothing can quietly change')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
  })

  it('jumps directly to a slide when its dot is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3' }))
    expect(screen.getByText('You approve everything')).toBeInTheDocument()
  })

  it('marks onboarding seen and does not stay on /onboarding when Skip is tapped', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
  })

  it('marks onboarding seen when Get Started is tapped on the final slide', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1')
  })
})
