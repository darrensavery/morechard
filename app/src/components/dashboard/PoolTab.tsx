// app/src/components/dashboard/PoolTab.tsx
import { useEffect, useState } from 'react';

type VerificationStatus =
  | 'committed_auto'
  | 'committed_manual'
  | 'pending'
  | 'rejected'
  | 'voided'
  | 'reversed';

type SharedExpense = {
  id: number;
  logged_by: string;
  logged_by_name: string;
  authorised_by: string | null;
  authorised_by_name: string | null;
  description: string;
  category: string;
  total_amount: number;
  split_bp: number;
  currency: string;
  verification_status: VerificationStatus;
  attachment_key: string | null;
  settlement_period: string | null;
  reconciled_at: number | null;
  created_at: number;
  deleted_at: number | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  education: '📚', health: '🏥', clothing: '👕',
  travel: '✈️', activities: '⚽', other: '📋',
};

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
  onAddClick: () => void;
  onReconcileClick: (expenses: SharedExpense[]) => void;
};

export function PoolTab({ familyId, currentUserId, onAddClick, onReconcileClick }: Props) {
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/shared-expenses', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { expenses: SharedExpense[] };
      setExpenses(data.expenses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [familyId]);

  async function handleApprove(id: number) {
    await fetch(`/api/shared-expenses/${id}/approve`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handleReject(id: number) {
    await fetch(`/api/shared-expenses/${id}/reject`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handleRemove(id: number) {
    if (!confirm('Remove this flagged expense?')) return;
    await fetch(`/api/shared-expenses/${id}`, { method: 'DELETE', credentials: 'include' });
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

      {/* Running balance chip */}
      {openExpenses.length > 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">This month</p>
            <p className={`text-2xl font-bold tabular-nums ${netPence < 0 ? 'text-green-600' : netPence > 0 ? 'text-red-500' : 'text-[var(--color-text)]'}`}>
              {netPence === 0 ? 'You are square' : netPence < 0
                ? `You are owed ${formatAmount(Math.abs(netPence), currency)}`
                : `You owe ${formatAmount(netPence, currency)}`}
            </p>
          </div>
          <button
            onClick={() => onReconcileClick(openExpenses)}
            className="text-sm font-semibold text-[var(--brand-primary)] border border-[var(--brand-primary)] rounded-lg px-3 py-1.5"
          >
            Reconcile
          </button>
        </div>
      )}

      {/* Add expense button */}
      <div className="px-4">
        <button
          onClick={onAddClick}
          className="w-full bg-[var(--brand-primary)] text-white font-semibold text-sm py-3 rounded-xl"
        >
          + Log shared expense
        </button>
      </div>

      {/* Pending approvals */}
      {pendingExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
            Needs your approval
          </h3>
          <div className="flex flex-col gap-2">
            {pendingExpenses.filter(e => e.logged_by !== currentUserId).map(e => (
              <div key={e.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
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
                <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
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
                  {CATEGORY_EMOJI[e.category]} {e.description}
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
                      <p className="font-semibold text-sm">{CATEGORY_EMOJI[e.category]} {e.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ledgerNote(e, currentUserId)}</p>
                      {uneven && (
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 italic">
                          To keep things simple, we've rounded your share to {formatAmount(myAmount, e.currency)}.
                        </p>
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

      {/* Voided expenses */}
      {voidedExpenses.length > 0 && (
        <section className="px-4">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Voided</h3>
          <div className="flex flex-col gap-2">
            {voidedExpenses.map(e => (
              <div key={e.id} className="rounded-xl border border-[var(--color-border)] p-4 opacity-50">
                <p className="text-sm line-through">{e.description}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Voided — co-parent removed</p>
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
          No shared expenses yet. Log one to get started.
        </div>
      )}
    </div>
  );
}
