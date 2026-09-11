import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FamilyAuditCard } from '../FamilyAuditCard'
import * as api from '../../../lib/api'

afterEach(() => vi.restoreAllMocks())

describe('FamilyAuditCard', () => {
  it('renders totals and observation text when data is present', async () => {
    vi.spyOn(api, 'getFamilyAudit').mockResolvedValue({
      month: '2026-07',
      totals: { total_earned_pence: 5000, total_spent_pence: 2000, total_saved_pence: 1500, total_given_pence: 500 },
      flagged_child_id: 'c1',
      flagged_pillar: 'PILLAR_4_CAPITAL_MANAGEMENT',
      observation: 'We noted a stable month.',
      behavioral_root: 'Pillar 4 — Capital Management: test root.',
      the_action: 'You might consider a test action.',
      source: 'ai',
    })

    render(<FamilyAuditCard familyId="fam1" />)

    await waitFor(() => expect(screen.getByText('We noted a stable month.')).toBeTruthy())
    expect(screen.getByText('£50.00')).toBeTruthy()
    expect(screen.getByText('AI-generated')).toBeTruthy()
  })

  it('shows a proper empty state instead of rendering nothing when there is no data yet this month', async () => {
    vi.spyOn(api, 'getFamilyAudit').mockResolvedValue({ month: '2026-07', is_empty: true })

    render(<FamilyAuditCard familyId="fam1" />)

    await waitFor(() => expect(screen.getByText('Not enough activity yet')).toBeTruthy())
  })

  it('shows the same empty state when the request fails', async () => {
    vi.spyOn(api, 'getFamilyAudit').mockRejectedValue(new Error('network error'))

    render(<FamilyAuditCard familyId="fam1" />)

    await waitFor(() => expect(screen.getByText('Not enough activity yet')).toBeTruthy())
  })
})
