import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpendGuideSheet } from '../SpendGuideSheet'
import * as api from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  logSpend: vi.fn().mockResolvedValue({ id: 'spend1', spent_at: 0 }),
  logImpulseOutcome: vi.fn().mockResolvedValue({ ok: true }),
}))

const baseProps = {
  open: true,
  familyId: 'fam1',
  childId: 'child1',
  currency: 'GBP',
  appView: 'CLEAN' as const,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

function logACustomSpend(amountStr: string) {
  fireEvent.click(screen.getByText('Add a custom spend'))
  fireEvent.change(screen.getByPlaceholderText('What did you buy?'), { target: { value: 'New shoes' } })
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: amountStr } })
  fireEvent.click(screen.getByText('Save spend →'))
}

describe('SpendGuideSheet — Impulse Speed Bump', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('saves immediately, without a cooldown, when the spend is below 15% of balance', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('5.00') // 500p / 10000p = 5%

    await waitFor(() => expect(api.logSpend).toHaveBeenCalled())
    expect(api.logImpulseOutcome).not.toHaveBeenCalled()
    expect(screen.queryByText(/Shall we pause/)).toBeNull()
  })

  it('shows the cooldown interstitial when the spend exceeds 15% of balance', () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00') // 2000p / 10000p = 20%

    expect(screen.getByText(/Shall we pause/)).toBeTruthy()
    expect(api.logSpend).not.toHaveBeenCalled()
  })

  it('shows Orchard-toned copy when appView is ORCHARD', () => {
    render(<SpendGuideSheet {...baseProps} appView="ORCHARD" availableBalancePence={10000} />)
    logACustomSpend('20.00')

    expect(screen.getByText(/your grove keeps growing/)).toBeTruthy()
  })

  it('"Wait a bit" logs the waited outcome and does not save the spend', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00')

    fireEvent.click(screen.getByText('Wait a bit'))

    await waitFor(() => expect(api.logImpulseOutcome).toHaveBeenCalledWith({
      family_id: 'fam1', child_id: 'child1',
      amount_pence: 2000, balance_pence: 10000,
      outcome: 'waited',
    }))
    expect(api.logSpend).not.toHaveBeenCalled()
  })

  it('"I\'m sure, log it" logs the proceeded outcome and then saves the spend', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={10000} />)
    logACustomSpend('20.00')

    fireEvent.click(screen.getByText("I'm sure, log it"))

    await waitFor(() => expect(api.logSpend).toHaveBeenCalledWith({
      family_id: 'fam1', title: 'New shoes', amount: 2000, currency: 'GBP',
      category: 'other', note: undefined,
    }))
    expect(api.logImpulseOutcome).toHaveBeenCalledWith({
      family_id: 'fam1', child_id: 'child1',
      amount_pence: 2000, balance_pence: 10000,
      outcome: 'proceeded',
    })
  })

  it('does not trigger the cooldown when balance is below the £5 floor', async () => {
    render(<SpendGuideSheet {...baseProps} availableBalancePence={400} />)
    logACustomSpend('3.00') // 300p / 400p = 75%, but balance is under the floor

    await waitFor(() => expect(api.logSpend).toHaveBeenCalled())
    expect(screen.queryByText(/Shall we pause/)).toBeNull()
  })
})
