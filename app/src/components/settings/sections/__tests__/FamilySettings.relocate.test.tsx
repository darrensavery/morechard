import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { FamilySettings } from '../FamilySettings'
import { LocaleProvider } from '../../../../lib/locale'

function renderFamilySettings(overrides: Partial<ComponentProps<typeof FamilySettings>> = {}) {
  const props: ComponentProps<typeof FamilySettings> = {
    children: [], appViews: {}, appViewBusy: null, growthSettings: {}, growthBusy: null,
    familyId: 'fam_1', userId: 'parent_1', isLead: true, hasCoParent: false,
    sharedExpenseThreshold: 0, sharedExpenseSplitBp: 5000, savingSharedExpense: false,
    toast: null, onBack: () => {}, onComingSoon: () => {},
    onAddChild: async () => ({ child_id: 'c1', invite_code: '123456' }),
    onAppViewToggle: () => {}, onGrowthUpdate: () => {}, onRenameChild: () => {},
    onPinResetSuccess: () => {}, onGenerateInvite: async () => ({ code: '123456', expires_at: 0 }),
    onSharedExpenseThresholdChange: () => {}, onSharedExpenseSplitChange: () => {},
    onSaveSharedExpense: async () => {},
    pocketMoneyDay: 6, onSavePocketMoneyDay: async () => {},
    overdraftEnabled: false, overdraftLimitPence: 0, onSaveOverdraftPolicy: async () => {},
    onCoParentRemoved: async () => {},
    currentCurrency: 'GBP', onRelocate: vi.fn(async () => {}),
    ...overrides,
  }
  return render(
    <LocaleProvider>
      <FamilySettings {...props} />
    </LocaleProvider>
  )
}

describe('FamilySettings — Relocation Audit', () => {
  it('shows the Relocation Audit row with the current currency, enabled for the lead', () => {
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP' })
    expect(screen.getByText('Relocation Audit')).toBeTruthy()
    expect(screen.getByText(/Currently GBP/)).toBeTruthy()
  })

  it('disables the row for a non-lead co-parent', () => {
    renderFamilySettings({ isLead: false })
    const row = screen.getByText('Relocation Audit').closest('button')
    expect(row).toHaveProperty('disabled', true)
  })

  it('calls onRelocate with the selected currency and note, then closes the sheet', async () => {
    const onRelocate = vi.fn(async () => {})
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP', onRelocate })

    fireEvent.click(screen.getByText('Relocation Audit'))
    fireEvent.click(screen.getByText(/\$ USD/))
    fireEvent.change(screen.getByPlaceholderText('e.g. Moved to the US'), { target: { value: 'Moved to Austin' } })
    fireEvent.click(screen.getByText('Switch to USD'))

    await waitFor(() => expect(onRelocate).toHaveBeenCalledWith('USD', 'Moved to Austin'))
    await waitFor(() => expect(screen.queryByText('Switch to USD')).toBeNull())
  })

  it('shows the server error message when onRelocate rejects', async () => {
    const onRelocate = vi.fn(async () => { throw new Error('Family is already using USD') })
    renderFamilySettings({ isLead: true, currentCurrency: 'GBP', onRelocate })

    fireEvent.click(screen.getByText('Relocation Audit'))
    fireEvent.click(screen.getByText(/\$ USD/))
    fireEvent.click(screen.getByText('Switch to USD'))

    await waitFor(() => expect(screen.getByText('Family is already using USD')).toBeTruthy())
  })
})
