// app/src/components/dashboard/PoolTab.tsx
import { useEffect, useState } from 'react';
import type { SharedExpense } from '../../lib/api';
import { apiUrl, authHeaders, getSharedExpenses } from '../../lib/api';
import { VoidExpenseSheet } from './VoidExpenseSheet';

function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'education':  return <svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
    case 'health':     return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'clothing':   return <svg {...p}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>;
    case 'travel':     return <svg {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c0 0-1 0-3 1.5L8 9.2l-4.7-1.2c-.7-.2-1.3.6-.9 1.2l4 5.9c.4.6 1.2.8 1.8.4l1.9-1.2 2.5 2.5-1.2 1.9c-.4.6-.2 1.4.4 1.8l5.9 4c.6.4 1.4-.2 1.2-.9L17.8 19.2z"/></svg>;
    case 'activities': return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>;
    case 'childcare':  return <svg {...p}><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5.5 4.5 1.4"/><path d="M12 3c0 0 0 2-2 3"/></svg>;
    case 'food':       return <svg {...p}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
    case 'tech':       return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>;
    case 'gifts':      return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>;
    default:           return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
  }
}

function formatAmount(pence: number, currency: string): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  return `${symbol}${(pence / 100).toFixed(2)}`;
}

function ledgerNote(
  expense: SharedExpense,
  _currentUserId: string,
): string {
  const loggedByName = expense.logged_by_name ?? 'Unknown';
  const authorisedByName = expense.authorised_by_name ?? '';
  if (expense.verification_status === 'committed_manual') {
    return `Logged by ${loggedByName}, Verified by ${authorisedByName}`;
  }
  if (expense.verification_status === 'pending') {
    return `Logged by ${loggedByName}, awaiting approval`;
  }
  return `Logged by ${loggedByName}`;
}

type Props = {
  familyId: string;
  currentUserId: string;
  parentingMode: 'single' | 'co-parenting';
  onAddClick: () => void;
  onReconcileClick: (expenses: SharedExpense[]) => void;
};

export function PoolTab({ familyId, currentUserId, parentingMode, onAddClick, onReconcileClick }: Props) {
  const isCoParenting = parentingMode === 'co-parenting';
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidingExpense, setVoidingExpense] = useState<SharedExpense | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getSharedExpenses();
      setExpenses(data.expenses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [familyId]);

  async function handleApprove(id: number) {
    await fetch(apiUrl(`/api/shared-expenses/${id}/approve`), { method: 'POST', headers: authHeaders() });
    load();
  }

  async function handleReject(id: number) {
    await fetch(apiUrl(`/api/shared-expenses/${id}/reject`), { method: 'POST', headers: authHeaders() });
    load();
  }

  async function handleRemove(id: number) {
    if (!confirm('Remove this flagged expense?')) return;
    await fetch(apiUrl(`/api/shared-expenses/${id}`), { method: 'DELETE', headers: authHeaders() });
    load();
  }

  if (loading) return <div className="p-6 text-center text-[var(--color-text-muted)] text-sm">Loading…</div>;
  if (error) return <div className="p-6 text-center text-red-500 text-sm">{error}</div>;

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const openExpenses = expenses.filter(
    e => !e.settlement_period && ['committed_auto', 'committed_manual'].includes(e.verification_status)
  );
  const pendingExpenses = expenses.filter(e => e.verification_status === 'pending');
  const flaggedExpenses = expenses.filter(e => e.verification_status === 'rejected');
  const voidedExpenses = expenses.filter(e => e.verification_status === 'voided');
  const history = expenses.filter(e => e.settlement_period);

  let netPence = 0;
  for (const e of openExpenses) {
    const loggedByAmount = Math.round((e.total_amount * e.split_bp) / 10000);
    const otherAmount = e.total_amount - loggedByAmount;
    if (e.logged_by === currentUserId) {
      netPence -= otherAmount;
    } else {
      netPence += loggedByAmount;
    }
  }

  const currency = expenses[0]?.currency ?? 'GBP';

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Running balance / month summary chip */}
      {openExpenses.length > 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">This month</p>
            {isCoParenting ? (
              <p className={`text-2xl font-bold tabular-nums ${netPence < 0 ? 'text-green-600' : netPence > 0 ? 'text-red-500' : 'text-[var(--color-text)]'}`}>
                {netPence === 0 ? 'You are square' : netPence < 0
                  ? `You are owed ${formatAmount(Math.abs(netPence), currency)}`
                  : `You owe ${formatAmount(netPence, currency)}`}
              </p>
            ) : (
              <p className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
                {formatAmount(openExpenses.reduce((s, e) => s + e.total_amount, 0), currency)}
              </p>
            )}
          </div>
          {isCoParenting && (
            <button
              onClick={() => onReconcileClick(openExpenses)}
              className="text-sm font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)] rounded-lg px-3 py-1.5"
            >
              Reconcile
            </button>
          )}
        </div>
      )}

      {/* Add expense button */}
      <div className="px-4">
        <button
          onClick={onAddClick}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-sm py-3 rounded-xl"
        >
          {isCoParenting ? '+ Log shared expense' : '+ Log household expense'}
        </button>
      </div>

      {/* Pending approvals — only relevant in co-parenting mode */}
      {isCoParenting && pendingExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Needs your approval
          </h3>
          <div className="flex flex-col gap-2">
            {pendingExpenses.filter(e => e.logged_by !== currentUserId).map(e => (
              <div key={e.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm"><span className="inline-flex items-center gap-1.5"><CategoryIcon category={e.category} />{e.description}</span></p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ledgerNote(e, currentUserId)}</p>
                    <p className="text-sm font-bold tabular-nums mt-1">{formatAmount(e.total_amount, e.currency)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(e.id)}
                    className="flex-1 bg-green-600 text-white text-sm font-semibold py-1.5 rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(e.id)}
                    className="flex-1 border border-red-400 text-red-600 text-sm font-semibold py-1.5 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingExpenses.filter(e => e.logged_by === currentUserId).map(e => (
              <div key={e.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 opacity-70">
                <p className="font-semibold text-sm"><span className="inline-flex items-center gap-1.5"><CategoryIcon category={e.category} />{e.description}</span></p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Awaiting other parent's approval</p>
                <p className="text-sm font-bold tabular-nums mt-1">{formatAmount(e.total_amount, e.currency)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flagged (rejected) expenses */}
      {flaggedExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Flagged</h3>
          <div className="flex flex-col gap-2">
            {flaggedExpenses.map(e => (
              <div key={e.id} className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 opacity-80">
                <p className="font-semibold text-sm line-through text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon category={e.category} />{e.description}</span>
                </p>
                <p className="text-xs text-red-500 mt-0.5">Rejected — please discuss and re-submit if agreed</p>
                <p className="text-sm font-bold tabular-nums mt-1 text-[var(--color-text-muted)]">
                  {formatAmount(e.total_amount, e.currency)}
                </p>
                {e.logged_by === currentUserId && (
                  <button
                    onClick={() => handleRemove(e.id)}
                    className="mt-2 text-xs text-red-600 underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Open period committed expenses */}
      {openExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Open — {currentPeriod}
          </h3>
          <div className="flex flex-col gap-2">
            {openExpenses.map(e => {
              const loggedByAmount = Math.round((e.total_amount * e.split_bp) / 10000);
              const otherAmount = e.total_amount - loggedByAmount;
              const myAmount = e.logged_by === currentUserId ? loggedByAmount : otherAmount;
              const uneven = loggedByAmount !== otherAmount;
              return (
                <div key={e.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm"><span className="inline-flex items-center gap-1.5"><CategoryIcon category={e.category} />{e.description}</span></p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ledgerNote(e, currentUserId)}</p>
                      {isCoParenting && uneven && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 italic">
                          To keep things simple, we've rounded your share to {formatAmount(myAmount, e.currency)}.
                        </p>
                      )}
                      {e.logged_by === currentUserId && (
                        <button
                          onClick={() => setVoidingExpense(e)}
                          className="text-xs text-red-500 border border-red-300 rounded px-2 py-0.5 mt-1"
                        >
                          Void
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-bold tabular-nums">{formatAmount(e.total_amount, e.currency)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Voided expenses — only relevant in co-parenting mode */}
      {isCoParenting && voidedExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Voided</h3>
          <div className="flex flex-col gap-2">
            {voidedExpenses.map(e => (
              <div key={e.id} className="rounded-xl border border-[var(--color-border)] p-4 opacity-60">
                <p className="text-sm line-through text-[var(--color-text-muted)]">{e.description}</p>
                {e.note && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 italic">{e.note}</p>}
                {e.voided_at && <p className="text-xs text-[var(--color-text-muted)]">Voided {new Date(e.voided_at * 1000).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reconciled history */}
      {history.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">History</h3>
          {[...new Set(history.map(e => e.settlement_period))].map(period => (
            <div key={period} className="rounded-xl border border-[var(--color-border)] p-3 mb-2">
              <p className="text-sm font-semibold">{period}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {history.filter(e => e.settlement_period === period).length} expenses reconciled
              </p>
            </div>
          ))}
        </section>
      )}

      {expenses.length === 0 && (
        <div className="px-4 pt-8 text-center text-[var(--color-text-muted)] text-sm">
          {isCoParenting
            ? 'No shared expenses yet. Log one to get started.'
            : 'No household expenses yet. Log one to keep a record of your spending.'}
        </div>
      )}

      {voidingExpense && (
        <VoidExpenseSheet
          expenseId={voidingExpense.id}
          description={voidingExpense.description}
          onClose={() => setVoidingExpense(null)}
          onVoided={() => { setVoidingExpense(null); load(); }}
        />
      )}
    </div>
  );
}
