import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SwipeDismissCard } from '../SwipeDismissCard'

vi.mock('../../../lib/haptics', () => ({ tick: vi.fn(async () => {}) }))

describe('SwipeDismissCard', () => {
  it('renders children', () => {
    render(<SwipeDismissCard onDismiss={vi.fn()}><p>Card body</p></SwipeDismissCard>)
    expect(screen.getByText('Card body')).toBeTruthy()
  })

  it('calls onDismiss after a swipe past the threshold', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<SwipeDismissCard onDismiss={onDismiss}><p>Card body</p></SwipeDismissCard>)
    const card = screen.getByText('Card body').parentElement!

    fireEvent.touchStart(card, { touches: [{ clientX: 0 }] })
    fireEvent.touchMove(card, { touches: [{ clientX: 150 }] })
    fireEvent.touchEnd(card)

    vi.advanceTimersByTime(250)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not call onDismiss on a small swipe (snap-back)', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<SwipeDismissCard onDismiss={onDismiss}><p>Card body</p></SwipeDismissCard>)
    const card = screen.getByText('Card body').parentElement!

    fireEvent.touchStart(card, { touches: [{ clientX: 0 }] })
    fireEvent.touchMove(card, { touches: [{ clientX: 20 }] })
    fireEvent.touchEnd(card)

    vi.advanceTimersByTime(250)
    expect(onDismiss).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
