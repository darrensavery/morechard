import { useEffect, useState } from 'react'
import {
  getChildGovernanceLog,
  confirmChildGovernanceRequest,
  rejectChildGovernanceRequest,
  type ChildGovernanceLogRow,
} from '../../../lib/api'

interface Props {
  childId: string
  userId: string
  setting: 'verify_mode' | 'overdraft'
  /** Human-readable label for the raw stored value, e.g. 'amicable' -> 'Auto-Verify (Amicable)'. */
  formatValue: (raw: string) => string
  /** Called after a confirm/reject resolves, so the caller can refetch the effective value. */
  onResolved?: () => void
}

function fmtExpiry(epochSec: number): string {
  const h = Math.max(0, Math.floor((epochSec - Date.now() / 1000) / 3600))
  if (h < 1) return 'less than 1 hour'
  return `${h} hour${h !== 1 ? 's' : ''}`
}

export function ChildGovernanceBanner({ childId, userId, setting, formatValue, onResolved }: Props) {
  const [pending, setPending] = useState<ChildGovernanceLogRow | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [done,    setDone]    = useState<'confirmed' | 'rejected' | null>(null)

  useEffect(() => {
    getChildGovernanceLog(childId)
      .then(({ log }) => {
        const p = log.find(r => r.setting === setting && r.status === 'pending') ?? null
        setPending(p)
      })
      .catch(() => {})
  }, [childId, setting])

  if (!pending || done) return null

  const isRequester = pending.requested_by === userId
  const newLabel     = formatValue(pending.new_value)

  async function handleConfirm() {
    setBusy(true)
    try {
      await confirmChildGovernanceRequest(pending!.id)
      setDone('confirmed')
      onResolved?.()
    } catch { /* non-fatal */ }
    finally { setBusy(false) }
  }

  async function handleReject() {
    setBusy(true)
    try {
      await rejectChildGovernanceRequest(pending!.id)
      setDone('rejected')
      onResolved?.()
    } catch { /* non-fatal */ }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3.5 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-500 text-lg shrink-0 mt-0.5">⚖️</span>
        <div className="flex-1 min-w-0">
          <p className="text-[0.8125rem] font-bold text-amber-700 dark:text-amber-300 mb-1">
            {isRequester ? 'Awaiting co-parent consent' : 'Co-parent consent required'}
          </p>
          <p className="text-[0.75rem] text-amber-800/80 dark:text-amber-300/80 leading-snug mb-3">
            {isRequester
              ? `You requested a switch to ${newLabel}. Waiting for your co-parent to confirm. Expires in ${fmtExpiry(pending.expires_at)}.`
              : `Your co-parent wants to switch to ${newLabel}. Expires in ${fmtExpiry(pending.expires_at)}.`
            }
          </p>
          {!isRequester && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 rounded-lg bg-amber-600 text-white text-[0.75rem] font-semibold py-2 px-3 disabled:opacity-50 cursor-pointer hover:bg-amber-700 transition-colors"
              >
                {busy ? '…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={busy}
                className="flex-1 rounded-lg bg-white/10 text-[var(--color-text-muted)] text-[0.75rem] py-2 px-3 disabled:opacity-50 cursor-pointer hover:bg-white/20 transition-colors"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
