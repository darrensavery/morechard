import { useState, useEffect, useCallback } from 'react'
import type { Completion, PayoutRecord, ChildRecord } from '../../lib/api'
import {
  getHistory, getPayouts, createPayout, createBonus, formatCurrency,
} from '../../lib/api'

interface Props {
  familyId: string
  child: ChildRecord
}

const LIMIT = 20

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  approved:   { label: 'Approved',   bg: 'bg-green-100',  text: 'text-green-700' },
  pending:    { label: 'Pending',    bg: 'bg-amber-100',  text: 'text-amber-700' },
  rejected:   { label: 'Rejected',  bg: 'bg-red-100',    text: 'text-red-700' },
  suggestion: { label: 'Suggestion', bg: 'bg-blue-100',   text: 'text-blue-700' },
}

export function HistoryTab({ familyId, child }: Props) {
  const [history, setHistory]   = useState<Completion[]>([])
  const [payouts, setPayouts]   = useState<PayoutRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [offset, setOffset]     = useState(0)
  const [hasMore, setHasMore]   = useState(false)

  // Pay out modal
  const [showPayout, setShowPayout]   = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote]   = useState('')
  const [payoutBusy, setPayoutBusy]   = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)

  // Bonus modal
  const [showBonus, setShowBonus]   = useState(false)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [bonusBusy, setBonusBusy]   = useState(false)
  const [bonusError, setBonusError] = useState<string | null>(null)

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    const newOffset = reset ? 0 : offset
    const [h, p] = await Promise.all([
      getHistory({ family_id: familyId, child_id: child.id, limit: LIMIT, offset: newOffset }),
      getPayouts(familyId, child.id),
    ])
    setHistory(reset ? h.history : prev => [...prev, ...h.history])
    setPayouts(p.payouts)
    setHasMore(h.history.length === LIMIT)
    if (reset) setOffset(0)
    setLoading(false)
  }, [familyId, child.id, offset])

  useEffect(() => { load(true) }, [familyId, child.id])

  async function handlePayout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payoutAmount) return
    setPayoutBusy(true)
    setPayoutError(null)
    try {
      await createPayout({
        family_id: familyId, child_id: child.id,
        amount: Math.round(parseFloat(payoutAmount) * 100),
        currency: 'GBP',
        note: payoutNote || undefined,
      })
      setShowPayout(false)
      setPayoutAmount('')
      setPayoutNote('')
      await load(true)
    } catch (err: unknown) {
      setPayoutError((err as Error).message)
    } finally {
      setPayoutBusy(false)
    }
  }

  async function handleBonus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!bonusAmount || !bonusReason.trim()) return
    setBonusBusy(true)
    setBonusError(null)
    try {
      await createBonus({
        family_id: familyId, child_id: child.id,
        amount: Math.round(parseFloat(bonusAmount) * 100),
        currency: 'GBP',
        reason: bonusReason.trim(),
      })
      setShowBonus(false)
      setBonusAmount('')
      setBonusReason('')
      await load(true)
    } catch (err: unknown) {
      setBonusError((err as Error).message)
    } finally {
      setBonusBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowPayout(true)}
          className="flex-1 bg-teal-600 text-white font-bold py-2.5 rounded-xl text-[14px] hover:bg-teal-700 cursor-pointer"
        >
          Pay out
        </button>
        <button
          onClick={() => setShowBonus(true)}
          className="flex-1 border border-[#D3D1C7] text-[#1C1C1A] font-bold py-2.5 rounded-xl text-[14px] hover:bg-gray-50 cursor-pointer"
        >
          + Bonus
        </button>
      </div>

      {/* Payout modal */}
      {showPayout && (
        <form onSubmit={handlePayout} className="bg-white border border-[#D3D1C7] rounded-xl p-4 space-y-3">
          <p className="text-[15px] font-bold">Pay out to {child.display_name}</p>
          {payoutError && <p className="text-[13px] text-red-600">{payoutError}</p>}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6b6a66]">£</span>
            <input
              type="number" min="0.01" step="0.01" required
              className="w-full border border-[#D3D1C7] rounded-lg pl-7 pr-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-600"
              placeholder="0.00"
              value={payoutAmount}
              onChange={e => setPayoutAmount(e.target.value)}
            />
          </div>
          <input
            className="w-full border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-600"
            placeholder="Note (optional)"
            value={payoutNote}
            onChange={e => setPayoutNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowPayout(false)} className="flex-1 border border-[#D3D1C7] rounded-xl py-2.5 text-[14px] font-semibold text-[#6b6a66] cursor-pointer">Cancel</button>
            <button type="submit" disabled={payoutBusy} className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-[14px] font-bold hover:bg-teal-700 disabled:opacity-50 cursor-pointer">
              {payoutBusy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      )}

      {/* Bonus modal */}
      {showBonus && (
        <form onSubmit={handleBonus} className="bg-white border border-[#D3D1C7] rounded-xl p-4 space-y-3">
          <p className="text-[15px] font-bold">Add bonus for {child.display_name}</p>
          {bonusError && <p className="text-[13px] text-red-600">{bonusError}</p>}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6b6a66]">£</span>
            <input
              type="number" min="0.01" step="0.01" required
              className="w-full border border-[#D3D1C7] rounded-lg pl-7 pr-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="0.00"
              value={bonusAmount}
              onChange={e => setBonusAmount(e.target.value)}
            />
          </div>
          <input
            required
            className="w-full border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="Reason (required)"
            value={bonusReason}
            onChange={e => setBonusReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowBonus(false)} className="flex-1 border border-[#D3D1C7] rounded-xl py-2.5 text-[14px] font-semibold text-[#6b6a66] cursor-pointer">Cancel</button>
            <button type="submit" disabled={bonusBusy} className="flex-1 bg-green-700 text-white rounded-xl py-2.5 text-[14px] font-bold hover:bg-green-800 disabled:opacity-50 cursor-pointer">
              {bonusBusy ? 'Saving…' : 'Add bonus'}
            </button>
          </div>
        </form>
      )}

      {/* Recent payouts */}
      {payouts.length > 0 && (
        <div className="bg-white border border-[#D3D1C7] rounded-xl divide-y divide-[#D3D1C7]">
          <p className="px-4 py-2.5 text-[13px] font-bold text-[#6b6a66]">Recent payouts</p>
          {payouts.slice(0, 3).map(p => (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[#1C1C1A]">{formatCurrency(p.amount, p.currency)}</p>
                <p className="text-[12px] text-[#6b6a66]">
                  {new Date(p.paid_at * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              <span className="text-[12px] font-semibold text-teal-700 bg-teal-100 rounded-full px-2 py-1">Paid</span>
            </div>
          ))}
        </div>
      )}

      {/* Job history */}
      <div className="bg-white border border-[#D3D1C7] rounded-xl divide-y divide-[#D3D1C7]">
        <p className="px-4 py-2.5 text-[13px] font-bold text-[#6b6a66]">Job history</p>
        {loading && history.length === 0 ? (
          <div className="px-4 py-6 text-center text-[14px] text-[#6b6a66]">Loading…</div>
        ) : history.length === 0 ? (
          <div className="px-4 py-6 text-center text-[14px] text-[#6b6a66]">No history yet.</div>
        ) : (
          <>
            {history.map(item => {
              const s = STATUS_STYLES[item.status] ?? { label: item.status, bg: 'bg-gray-100', text: 'text-gray-600' }
              return (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#1C1C1A] truncate">{item.chore_title}</p>
                    <p className="text-[12px] text-[#6b6a66]">
                      {formatCurrency(item.reward_amount, item.currency)} ·{' '}
                      {new Date(item.submitted_at * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {item.rejection_note && <span className="ml-1 italic text-red-500">"{item.rejection_note}"</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-1 ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
            {hasMore && (
              <button
                onClick={() => { setOffset(o => o + LIMIT); load() }}
                className="w-full py-3 text-[13px] font-semibold text-[#6b6a66] hover:bg-gray-50 cursor-pointer"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}