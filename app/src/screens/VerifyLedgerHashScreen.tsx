import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FullLogo } from '../components/ui/Logo'

type Phase = 'input' | 'checking' | 'valid' | 'invalid' | 'not_found' | 'error'

interface ValidResult {
  entryCount: number
  chainHeadHash: string
  verifiedAt: string
}

function isValidHash(v: string) {
  return /^[a-f0-9]{64}$/.test(v.trim())
}

async function runVerify(hash: string): Promise<{
  phase: Exclude<Phase, 'input' | 'checking'>
  result?: ValidResult
  brokenAt?: number | null
}> {
  const res = await fetch(`/api/verify/${hash}`)
  const data = await res.json() as Record<string, unknown>
  if (res.status === 404) return { phase: 'not_found' }
  if (!res.ok)           return { phase: 'error' }
  if (data.valid === true) {
    return {
      phase: 'valid',
      result: {
        entryCount:    data.entryCount as number,
        chainHeadHash: data.chainHeadHash as string,
        verifiedAt:    data.verifiedAt as string,
      },
    }
  }
  return { phase: 'invalid', brokenAt: data.brokenAt as number | null }
}

export function VerifyLedgerHashScreen() {
  const { hash: urlHash } = useParams<{ hash?: string }>()
  const navigate = useNavigate()
  const [phase, setPhase]     = useState<Phase>(urlHash ? 'checking' : 'input')
  const [input, setInput]     = useState(urlHash ?? '')
  const [result, setResult]   = useState<ValidResult | null>(null)
  const [brokenAt, setBrokenAt] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!urlHash) return
    if (!isValidHash(urlHash)) { setPhase('error'); return }
    runVerify(urlHash)
      .then(r => { setResult(r.result ?? null); setBrokenAt(r.brokenAt ?? null); setPhase(r.phase) })
      .catch(() => setPhase('error'))
  }, [urlHash])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const h = input.trim().toLowerCase()
    if (!isValidHash(h)) {
      inputRef.current?.focus()
      return
    }
    navigate(`/verify/${h}`)
  }

  function handleReset() {
    setInput('')
    setPhase('input')
    navigate('/verify')
  }

  const showInput = phase === 'input'

  return (
    <div className="min-h-svh flex flex-col items-center justify-center bg-[var(--color-bg)] px-5 py-10">
      <div className="max-w-lg w-full space-y-6">

        <div className="flex justify-center">
          <FullLogo iconSize={24} />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-7 shadow-sm space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">Ledger verification</h1>
            {showInput && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Enter the chain-head hash from a Morechard PDF export to confirm the record is untampered.
              </p>
            )}
          </div>

          {/* ── Input form ── */}
          {showInput && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={3}
                placeholder="Paste the 64-character hash here…"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 font-mono text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
                autoFocus
                spellCheck={false}
              />
              {input.trim().length > 0 && !isValidHash(input) && (
                <p className="text-xs text-amber-500">Hash must be exactly 64 lowercase hexadecimal characters.</p>
              )}
              <button
                type="submit"
                disabled={!isValidHash(input)}
                className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                Verify
              </button>
            </form>
          )}

          {/* ── Checking spinner ── */}
          {phase === 'checking' && (
            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent flex-shrink-0" />
              <span className="text-sm">Verifying chain integrity…</span>
            </div>
          )}

          {/* ── Valid ── */}
          {phase === 'valid' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 flex-shrink-0">
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">Chain intact</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Every entry in this ledger is untampered.</p>
                </div>
              </div>
              <dl className="divide-y divide-[var(--color-border)] text-sm">
                <div className="flex justify-between py-2.5">
                  <dt className="text-[var(--color-text-muted)]">Entries verified</dt>
                  <dd className="font-medium tabular-nums">{result.entryCount}</dd>
                </div>
                <div className="flex justify-between py-2.5 gap-4">
                  <dt className="text-[var(--color-text-muted)] flex-shrink-0">Chain-head hash</dt>
                  <dd className="font-mono text-xs break-all text-right">{result.chainHeadHash}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-[var(--color-text-muted)]">Verified at</dt>
                  <dd className="font-medium tabular-nums">{new Date(result.verifiedAt).toLocaleString()}</dd>
                </div>
              </dl>
              <button onClick={handleReset} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2">
                Verify another hash
              </button>
            </div>
          )}

          {/* ── Invalid ── */}
          {phase === 'invalid' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text)]">Chain broken</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    One or more entries in this ledger have been modified.
                    {brokenAt !== null && <> The chain breaks at entry <span className="font-mono font-medium">#{brokenAt}</span>.</>}
                  </p>
                </div>
              </div>
              <button onClick={handleReset} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2">
                Verify another hash
              </button>
            </div>
          )}

          {/* ── Not found ── */}
          {phase === 'not_found' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text)]">Hash not found</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No ledger matching this hash exists in Morechard. Check that the hash was copied in full from the export.
                  </p>
                </div>
              </div>
              <button onClick={handleReset} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2">
                Try again
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {phase === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text)]">Verification failed</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Something went wrong. Please check the hash and try again.
                  </p>
                </div>
              </div>
              <button onClick={handleReset} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2">
                Try again
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] leading-relaxed">
          This page confirms only that the cryptographic chain of the exported ledger is intact.
          Acceptance of this record in legal proceedings depends on the rules of the relevant jurisdiction.
        </p>

      </div>
    </div>
  )
}
