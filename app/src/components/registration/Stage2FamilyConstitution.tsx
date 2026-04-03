/**
 * Stage 2 — Family Constitution (Market & Rules)
 *
 * Collects: base_currency (GBP | PLN), governance_mode (amicable | standard)
 * - Currency is locked post-registration (ledger integrity)
 * - Co-parenting flow from Stage 1 pre-selects Standard governance
 * - Info popover explains governance modes (styled like payment-success AI bubbles)
 */

import { useState } from 'react'
import { Info, Scale, Zap, PoundSterling, BadgeDollarSign, Lock } from 'lucide-react'
import { Button }                       from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn }                           from '@/lib/utils'
import type { RegistrationState }       from './RegistrationShell'

interface Props {
  data: RegistrationState
  onNext: (patch: Partial<RegistrationState>) => void
  onBack: () => void
}

export function Stage2FamilyConstitution({ data, onNext, onBack }: Props) {
  const [currency, setCurrency]   = useState<'GBP' | 'PLN'>(data.base_currency ?? 'GBP')
  const [govMode,  setGovMode]    = useState<'amicable' | 'standard'>(
    data.governance_mode ?? (data.parenting_mode === 'co-parenting' ? 'standard' : 'amicable')
  )

  function handleNext() {
    onNext({ base_currency: currency, governance_mode: govMode })
  }

  const isSingleParent = data.parenting_mode === 'single'

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Family Constitution</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          These settings define the legal and financial framework of your family record.
          They cannot be changed without mutual consent once the ledger is active.
        </p>
      </div>

      {/* Currency selection */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Payment region</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock size={11} />
            <span>Locked after registration</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CurrencyCard
            active={currency === 'GBP'}
            onClick={() => setCurrency('GBP')}
            symbol="£"
            label="British Pound"
            region="United Kingdom"
            icon={<PoundSterling size={20} />}
          />
          <CurrencyCard
            active={currency === 'PLN'}
            onClick={() => setCurrency('PLN')}
            symbol="zł"
            label="Polish Zloty"
            region="Poland"
            icon={<BadgeDollarSign size={20} />}
          />
        </div>

        <Alert variant="warning">
          <Lock size={15} />
          <AlertTitle>Currency is locked to your payment region</AlertTitle>
          <AlertDescription>
            To maintain ledger integrity, all transactions are denominated in your
            chosen currency. Changing region requires a formal Currency Rebase entry
            in the audit trail.
          </AlertDescription>
        </Alert>
      </section>

      {/* Governance mode */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Governance model</span>
          <GovernanceInfoPopover />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <GovernanceCard
            active={govMode === 'amicable'}
            onClick={() => setGovMode('amicable')}
            icon={<Zap size={20} />}
            title="Amicable"
            subtitle="Instant approval"
            description="Transactions are recorded immediately. The other parent receives a notification for awareness."
            disabled={false}
          />
          <GovernanceCard
            active={govMode === 'standard'}
            onClick={() => !isSingleParent && setGovMode('standard')}
            icon={<Scale size={20} />}
            title="Standard"
            subtitle="Dual-parent approval required"
            description="Each transaction enters a Pending state until the second custodian formally verifies it. Required for a legally admissible audit trail."
            disabled={isSingleParent}
          />
        </div>

        {isSingleParent && govMode === 'amicable' && (
          <p className="text-xs text-muted-foreground">
            Standard governance requires two custodians. You can upgrade when a co-parent joins.
          </p>
        )}
      </section>

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="flex-1 h-12" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-[2] h-12 text-base" onClick={handleNext}>
          Continue — Child Onboarding
        </Button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CurrencyCard({
  active, onClick, symbol, label, region, icon,
}: {
  active: boolean
  onClick: () => void
  symbol: string
  label: string
  region: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('rounded-lg p-1.5', active ? 'bg-primary/10 text-primary' : 'bg-muted')}>
          {icon}
        </span>
        <span className="text-2xl font-bold tabular-nums">{symbol}</span>
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{region}</p>
      </div>
    </button>
  )
}

function GovernanceCard({
  active, onClick, icon, title, subtitle, description, disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all w-full',
        active   && 'border-primary bg-primary/5',
        !active  && !disabled && 'border-border bg-card hover:border-primary/40',
        disabled && 'border-border bg-muted opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn('rounded-lg p-2 mt-0.5 shrink-0', active ? 'bg-primary/10 text-primary' : 'bg-muted')}>
        {icon}
      </span>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            {subtitle}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

function GovernanceInfoPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Learn about governance modes"
        >
          <Info size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-sm space-y-3">
        <div className="space-y-1">
          <p className="font-semibold">What is governance mode?</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Governance mode controls how financial decisions are recorded and verified.
          </p>
        </div>
        <div className="space-y-2">
          <div className="bg-muted rounded-lg px-3 py-2.5 space-y-1">
            <p className="font-semibold text-xs flex items-center gap-1.5">
              <Zap size={12} className="text-amber-600" /> Amicable
            </p>
            <p className="text-muted-foreground text-xs">
              Transactions are approved instantly. The other parent is notified.
              Suitable for families with a high level of trust and cooperation.
            </p>
          </div>
          <div className="bg-muted rounded-lg px-3 py-2.5 space-y-1">
            <p className="font-semibold text-xs flex items-center gap-1.5">
              <Scale size={12} className="text-primary" /> Standard
            </p>
            <p className="text-muted-foreground text-xs">
              Every transaction requires a formal second-parent verification before
              it is written to the immutable ledger. This creates a court-admissible
              audit trail where both parties have formally consented.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border-t pt-2">
          You can request a governance change later — it requires consent from both
          custodians and is permanently logged.
        </p>
      </PopoverContent>
    </Popover>
  )
}
