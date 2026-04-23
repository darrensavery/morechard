/**
 * DataSettings — Data & Exports section.
 *
 * Renders three export rows gated by licence state:
 *   Family Summary (PDF + JSON) — always enabled for authenticated users
 *   Growth & Learning          — requires AI Mentor (hasAiMentor)
 *   Forensic Report            — requires Shield (hasShield)
 *
 * Data Pruning is Lead-parent only with a two-step inline confirm.
 */

import { useState, useEffect } from 'react'
import { Database, FileText, Scale, AlertTriangle, Download } from 'lucide-react'
import { Toast, useToast, SettingsRow, SectionCard, SectionHeader } from '../shared'
import { getFamilyId } from '../../../lib/api'
import { useExportManager } from '../../hooks/useExportManager'

interface Props {
  isLead:           boolean
  hasAiMentor:      boolean
  hasShield:        boolean
  lang:             string
  toast:            string | null
  onBack:           () => void
  onNavigateToPlan: (sku: 'AI_ANNUAL' | 'SHIELD') => void
}

type PruneStep = 'idle' | 'confirm' | 'pruning'

export function DataSettings({
  isLead, hasAiMentor, hasShield,
  lang, toast, onBack, onNavigateToPlan,
}: Props) {
  const familyId = getFamilyId()
  const { stateOf, errorOf, triggerExport, triggerPrune, prunedCount } =
    useExportManager(familyId)

  const [pruneStep, setPruneStep] = useState<PruneStep>('idle')
  const { toast: localToast, showToast } = useToast()

  // React to prune completion
  useEffect(() => {
    const state = stateOf('prune')
    if (pruneStep === 'pruning' && state === 'success') {
      showToast(`Archived ${prunedCount ?? 0} records`)
      setPruneStep('idle')
    } else if (pruneStep === 'pruning' && state === 'error') {
      showToast(errorOf('prune') ?? 'Prune failed')
      setPruneStep('idle')
    }
  }, [stateOf('prune')]) // eslint-disable-line react-hooks/exhaustive-deps

  function exportLabel(key: Parameters<typeof stateOf>[0], idleLabel: string) {
    const s = stateOf(key)
    if (s === 'generating') return 'Generating…'
    if (s === 'success')    return 'Downloaded ✓'
    return idleLabel
  }

  function exportRightSlot(key: Parameters<typeof stateOf>[0], locked: boolean, lockBadgeLabel: string) {
    const s = stateOf(key)
    if (s === 'generating') return <Spinner />
    if (locked)             return <LockedBadge label={lockBadgeLabel} />
    if (s === 'success')    return <Download size={14} className="text-[var(--brand-primary)]" />
    return <Download size={14} className="text-gray-400" />
  }

  return (
    <div className="space-y-4">
      {toast      && <Toast message={toast} />}
      {localToast && <Toast message={localToast} />}

      <SectionHeader title="Data & Exports" onBack={onBack} />

      {/* Family Summary — always available */}
      <SectionCard>
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Family Summary
          </p>
        </div>

        <SettingsRow
          icon={<Database size={15} />}
          label={exportLabel('json-basic', 'Download Raw Data (JSON)')}
          description="Full transaction history — GDPR Article 20 data portability"
          onClick={() => triggerExport('json', 'basic')}
          disabled={stateOf('json-basic') === 'generating'}
          rightSlot={exportRightSlot('json-basic', false, '')}
        />
        {stateOf('json-basic') === 'error' && (
          <ErrorNote message={errorOf('json-basic')} />
        )}

        <SettingsRow
          icon={<FileText size={15} />}
          label={exportLabel('pdf-basic', 'Family Summary Report (PDF)')}
          description="Earnings, task ledger, and status log"
          onClick={() => triggerExport('pdf', 'basic')}
          disabled={stateOf('pdf-basic') === 'generating'}
          rightSlot={exportRightSlot('pdf-basic', false, '')}
        />
        {stateOf('pdf-basic') === 'error' && (
          <ErrorNote message={errorOf('pdf-basic')} />
        )}
      </SectionCard>

      {/* PDF Reports */}
      <SectionCard>
        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            PDF Reports
          </p>
        </div>

        {/* Growth & Learning — requires AI Mentor */}
        <SettingsRow
          icon={<FileText size={15} className="text-purple-500" />}
          label={exportLabel('pdf-behavioral', 'Growth & Learning Report')}
          description="Adds Learning Lab modules and Behavioural Pulse"
          onClick={hasAiMentor
            ? () => triggerExport('pdf', 'behavioral')
            : () => onNavigateToPlan('AI_ANNUAL')}
          disabled={stateOf('pdf-behavioral') === 'generating'}
          rightSlot={exportRightSlot('pdf-behavioral', !hasAiMentor, 'Add AI Mentor')}
        />
        {stateOf('pdf-behavioral') === 'error' && (
          <ErrorNote message={errorOf('pdf-behavioral')} />
        )}

        {/* Forensic Report — requires Shield */}
        <SettingsRow
          icon={<Scale size={15} className="text-orange-600" />}
          label={exportLabel('pdf-forensic', 'Forensic Report')}
          description="Tamper-evident record with secure digital signatures and device verification"
          onClick={hasShield
            ? () => triggerExport('pdf', 'forensic')
            : () => onNavigateToPlan('SHIELD')}
          disabled={stateOf('pdf-forensic') === 'generating'}
          rightSlot={exportRightSlot('pdf-forensic', !hasShield, 'Add Shield')}
        />
        {stateOf('pdf-forensic') === 'error' && (
          <ErrorNote message={errorOf('pdf-forensic')} />
        )}
      </SectionCard>

      {/* Data Pruning — lead only */}
      {isLead && (
        <SectionCard>
          {pruneStep === 'idle' && (
            <SettingsRow
              icon={<AlertTriangle size={15} />}
              label="Data Pruning"
              description="Clean up records older than 2 years (immutable ledger protection)"
              onClick={() => setPruneStep('confirm')}
              destructive
            />
          )}

          {pruneStep === 'confirm' && (
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-red-600 text-white">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--color-text)]">
                    Archive old records?
                  </p>
                  <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">
                    Records older than 2 years will be archived. The immutable ledger chain is preserved.
                    This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pl-11">
                <button
                  type="button"
                  onClick={() => {
                    triggerPrune()
                    setPruneStep('pruning')
                  }}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 active:bg-red-700 transition-colors cursor-pointer"
                >
                  Yes, archive old records
                </button>
                <button
                  type="button"
                  onClick={() => setPruneStep('idle')}
                  className="flex-1 py-2 rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[13px] font-semibold hover:bg-[var(--color-border)] active:bg-[var(--color-border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pruneStep === 'pruning' && (
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] text-[var(--brand-primary)]">
                <Spinner />
              </span>
              <p className="text-[14px] font-semibold text-[var(--color-text-muted)]">
                Archiving records…
              </p>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-[var(--brand-primary)]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function LockedBadge({ label }: { label?: string }) {
  return (
    <span className="text-[9px] font-semibold text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
      {label ?? 'Upgrade'}
    </span>
  )
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="px-4 pb-2 text-[11px] text-red-500 leading-snug">{message}</p>
  )
}
