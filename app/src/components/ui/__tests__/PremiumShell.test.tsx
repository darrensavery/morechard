import { render, screen } from '@testing-library/react'
import { AiDisclosurePill } from '../PremiumShell'
import { describe, it, expect } from 'vitest'

describe('AiDisclosurePill', () => {
  it('renders the AI-generated disclosure text', () => {
    render(<AiDisclosurePill />)
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })
})
