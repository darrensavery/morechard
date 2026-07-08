import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BaseSheet } from '../BaseSheet'

vi.mock('../../../lib/haptics', () => ({ tick: vi.fn(async () => {}) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn(async () => {}) })) } }))

describe('BaseSheet', () => {
  it('renders children and a drag handle', () => {
    render(<BaseSheet onClose={vi.fn()}><p>Sheet content</p></BaseSheet>)
    expect(screen.getByText('Sheet content')).toBeTruthy()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<BaseSheet onClose={onClose}><p>Sheet content</p></BaseSheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when the panel content is clicked', () => {
    const onClose = vi.fn()
    render(<BaseSheet onClose={onClose}><p>Sheet content</p></BaseSheet>)
    fireEvent.click(screen.getByText('Sheet content'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
