/**
 * DemoRegisterScreen — professional entry point for the Thomson demo account.
 * Accessible from the welcome screen via a small text link.
 * No password required. Collects name + email + marketing consent,
 * then issues a demo JWT and navigates to the parent dashboard.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FullLogo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'
import { apiUrl, setToken } from '@/lib/api'

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

export default function DemoRegisterScreen() {
  const navigate = useNavigate()

  const [name,              setName]              = useState('')
  const [email,             setEmail]             = useState('')
  const [marketingConsent,  setMarketingConsent]  = useState<boolean | null>(null)
  const [submitting,        setSubmitting]        = useState(false)
  const [error,             setError]             = useState('')
  const [submitted,         setSubmitted]         = useState(false)

  const nameOk    = name.trim().length >= 2
  const emailOk   = isValidEmail(email.trim())
  const consentOk = marketingConsent !== null
  const canSubmit = nameOk && emailOk && consentOk

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(apiUrl('/auth/demo/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          marketing_consent: marketingConsent,
        }),
      })

      const data = await res.json() as { token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')

      setToken(data.token!)
      localStorage.setItem('mc_role', 'parent')
      localStorage.setItem('mc_family_id', 'demo-family-thomson')
      localStorage.setItem('mc_demo_user_type', 'professional')
      window.location.href = '/parent'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-svh bg-[var(--color-bg)] flex flex-col overflow-y-auto">

      <header className="safe-top sticky top-0 bg-[var(--color-surface)]/80 backdrop-blur border-b border-[var(--color-border)] px-4 py-3 flex items-center">
        <FullLogo iconSize={28} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-5 max-w-md mx-auto w-full py-8">

        {/* Heading */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Professional Demo
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            You'll get instant access to a fully populated demo account — the Thomson family —
            complete with chore history, ledger entries, and a downloadable forensic PDF report.
            The account is shared and resets to its original state every night at midnight.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700" htmlFor="demo-name">
              Full name
            </label>
            <input
              id="demo-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className={cn(
                'h-12 rounded-xl border px-4 text-sm bg-white outline-none transition-all duration-150',
                submitted && !nameOk
                  ? 'border-red-400 focus:ring-2 focus:ring-red-300'
                  : 'border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200',
              )}
            />
            {submitted && !nameOk && (
              <p className="text-xs text-red-500 font-medium pl-1">Full name required</p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700" htmlFor="demo-email">
              Email address
            </label>
            <input
              id="demo-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(
                'h-12 rounded-xl border px-4 text-sm bg-white outline-none transition-all duration-150',
                submitted && !emailOk
                  ? 'border-red-400 focus:ring-2 focus:ring-red-300'
                  : 'border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200',
              )}
            />
            {submitted && !emailOk && (
              <p className="text-xs text-red-500 font-medium pl-1">Valid email required</p>
            )}
          </div>

          {/* Marketing consent — radio checkbox, pre-unchecked */}
          <fieldset>
            <legend className={cn(
              'text-sm font-semibold mb-3',
              submitted && !consentOk ? 'text-red-500' : 'text-gray-700',
            )}>
              Morechard may contact me with product updates and feedback questions. Unsubscribe any time.
            </legend>
            <div className="flex flex-col gap-2">
              {([
                { value: true,  label: "Yes, that's fine" },
                { value: false, label: 'No thanks' },
              ] as const).map(({ value, label }) => (
                <label
                  key={String(value)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all duration-150',
                    marketingConsent === value
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="demo_marketing_consent"
                    value={String(value)}
                    checked={marketingConsent === value}
                    onChange={() => setMarketingConsent(value)}
                    className="accent-teal-600 w-4 h-4 shrink-0"
                  />
                  <span className={cn(
                    'text-sm font-medium',
                    marketingConsent === value ? 'text-teal-700' : 'text-gray-500',
                  )}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {submitted && !consentOk && (
              <p className="text-xs text-red-500 font-medium pl-1 mt-1.5">Please select an option</p>
            )}
          </fieldset>

          {error && (
            <p className="text-sm text-red-500 font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'w-full h-12 rounded-xl font-semibold text-sm transition-all duration-150',
              'bg-teal-600 hover:bg-teal-700 text-white shadow-sm active:scale-[0.98] cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
              submitting && 'opacity-70 cursor-not-allowed',
            )}
          >
            {submitting ? 'Entering demo…' : 'Enter Demo'}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-center"
          >
            Back
          </button>

        </form>
      </main>
    </div>
  )
}
