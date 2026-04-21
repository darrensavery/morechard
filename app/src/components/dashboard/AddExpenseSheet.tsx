// app/src/components/dashboard/AddExpenseSheet.tsx
import { useState } from 'react';

const CATEGORIES = [
  { value: 'education', label: '📚 Education' },
  { value: 'health',    label: '🏥 Health' },
  { value: 'clothing',  label: '👕 Clothing' },
  { value: 'travel',    label: '✈️ Travel' },
  { value: 'activities',label: '⚽ Activities' },
  { value: 'other',     label: '📋 Other' },
];

type Props = {
  defaultSplitBp: number;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AddExpenseSheet({ defaultSplitBp, currency, onClose, onSaved }: Props) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [amountStr, setAmountStr] = useState('');
  const [splitBp, setSplitBp] = useState(defaultSplitBp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';
  const totalPence = Math.round(parseFloat(amountStr || '0') * 100);
  const loggedByAmount = Math.round((totalPence * splitBp) / 10000);
  const otherAmount = totalPence - loggedByAmount;
  const uneven = totalPence > 0 && loggedByAmount !== otherAmount;

  function formatP(p: number) {
    return `${symbol}${(p / 100).toFixed(2)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError('Please enter a description.'); return; }
    if (totalPence <= 0) { setError('Please enter a valid amount.'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/shared-expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category,
          total_amount: totalPence,
          split_bp: splitBp,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error ?? 'Failed to save');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Log shared expense</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. School trip payment"
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total amount ({symbol})
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)] tabular-nums"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Your share — {(splitBp / 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={splitBp}
              onChange={e => setSplitBp(Number(e.target.value))}
              className="w-full mt-2"
            />
            {totalPence > 0 && (
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
                <span>You: {formatP(loggedByAmount)}</span>
                <span>Other parent: {formatP(otherAmount)}</span>
              </div>
            )}
            {uneven && (
              <p className="text-[10px] text-[var(--color-text-muted)] italic mt-1">
                To keep things simple, we've rounded your share to {formatP(loggedByAmount)} and the other parent's to {formatP(otherAmount)}.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--brand-primary)] text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
