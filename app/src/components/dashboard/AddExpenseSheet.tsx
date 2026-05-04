// app/src/components/dashboard/AddExpenseSheet.tsx
import { useState } from 'react';
import { createSharedExpense, uploadReceipt } from '../../lib/api';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import type { ExpensePreset, ExpenseCategory } from '../../lib/sharedExpensePresets';
import {
  PRESETS,
  getPresetsForRegion, localiseName, fuzzyMatchPreset
} from '../../lib/sharedExpensePresets';
import { ReceiptPicker } from './ReceiptPicker';

type ExpenseRegion = 'UK' | 'US' | 'PL';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'education',  label: '📚 Education' },
  { value: 'health',     label: '🏥 Health' },
  { value: 'clothing',   label: '👕 Clothing' },
  { value: 'travel',     label: '✈️ Travel' },
  { value: 'activities', label: '⚽ Activities' },
  { value: 'childcare',  label: '🧒 Childcare' },
  { value: 'food',       label: '🍱 Food' },
  { value: 'tech',       label: '💻 Tech' },
  { value: 'gifts',      label: '🎁 Gifts' },
  { value: 'other',      label: '📋 Other' },
];

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label.split(' ')[0]])
);

const TILE_PRESETS = PRESETS.filter(p => p.is_top_8);

type Props = {
  defaultSplitBp: number;
  currency: string;
  parentingMode: 'single' | 'co-parenting';
  region?: ExpenseRegion;
  onClose: () => void;
  onSaved: () => void;
};

export function AddExpenseSheet({ defaultSplitBp, currency, parentingMode, region = 'UK', onClose, onSaved }: Props) {
  const isCoParenting = parentingMode === 'co-parenting';
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : 'zł';

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [amountStr, setAmountStr] = useState('');
  const [splitBp, setSplitBp] = useState(isCoParenting ? defaultSplitBp : 10000);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryOverride, setShowCategoryOverride] = useState(false);

  useAndroidBack(true, onClose);

  const regionPresets = getPresetsForRegion(region);
  const searchResults = searchQuery.trim()
    ? regionPresets.filter(p => fuzzyMatchPreset(p, searchQuery)).slice(0, 6)
    : [];

  function selectPreset(preset: ExpensePreset) {
    setDescription(localiseName(preset, 'en'));
    setCategory(preset.category);
    setSearchQuery('');
    if (preset.legally_distinguishable) {
      setNoteOpen(true);
    }
  }

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
      const result = await createSharedExpense({
        description: description.trim(),
        category,
        total_amount: totalPence,
        split_bp: isCoParenting ? splitBp : undefined,
        expense_date: expenseDate,
        note: note.trim() || undefined,
      });

      if (receiptFile) {
        try {
          await uploadReceipt(result.id, receiptFile);
        } catch {
          // Non-blocking: expense saved, receipt failed
          setReceiptError('Expense saved, but receipt upload failed. You can retry from the expense list.');
          onSaved();
          return;
        }
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const selectedCategoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[560px] bg-[var(--color-surface)] rounded-t-2xl p-6 pb-10 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Log shared expense</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Quick Pick tiles */}
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Quick pick
            </label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {TILE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center text-[10px] font-medium transition-colors
                    ${description === localiseName(preset, 'en')
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text)]'
                    }`}
                >
                  <span className="text-xl">{CATEGORY_EMOJI[preset.category]}</span>
                  <span className="leading-tight">{localiseName(preset, 'en')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Or search all expenses
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. tutoring, ballet, school photos…"
              className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)]"
            />
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
                {searchResults.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-surface-raised)] flex items-center gap-2"
                  >
                    <span>{CATEGORY_EMOJI[preset.category]}</span>
                    <div>
                      <span className="font-medium">{localiseName(preset, 'en')}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2 capitalize">{preset.category}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
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

          {/* Filed under chip */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Filed under:</span>
            <button
              type="button"
              onClick={() => setShowCategoryOverride(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-sm font-medium"
            >
              {selectedCategoryLabel} <span className="text-xs opacity-60">✏️</span>
            </button>
          </div>

          {/* Category override popover */}
          {showCategoryOverride && (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => { setCategory(c.value); setShowCategoryOverride(false); }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors
                    ${category === c.value
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text)]'
                    }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Date + Amount row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-3 py-3 text-sm bg-[var(--color-surface-raised)]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Amount ({symbol})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full border border-[var(--color-border)] rounded-xl px-3 py-3 text-sm bg-[var(--color-surface-raised)] tabular-nums"
              />
            </div>
          </div>

          {/* Co-parent split slider */}
          {isCoParenting && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Your share — {(splitBp / 100).toFixed(0)}%
              </label>
              <input
                type="range" min={0} max={10000} step={100}
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
                  Rounded to {formatP(loggedByAmount)} / {formatP(otherAmount)}.
                </p>
              )}
            </div>
          )}

          {/* Note collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setNoteOpen(v => !v)}
              className="text-sm font-medium text-[var(--brand-primary)]"
            >
              {noteOpen ? '▾ Note' : '▸ + Add note'}
            </button>
            {noteOpen && (
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. why this expense was incurred"
                rows={3}
                className="mt-2 w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm bg-[var(--color-surface-raised)] resize-none"
              />
            )}
          </div>

          {/* Receipt collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setReceiptOpen(v => !v)}
              className="text-sm font-medium text-[var(--brand-primary)]"
            >
              {receiptOpen ? '▾ Receipt' : '▸ + Attach receipt'}
            </button>
            {receiptOpen && (
              <div className="mt-2">
                <ReceiptPicker
                  onFile={f => { setReceiptFile(f); setReceiptError(null); }}
                  onError={msg => setReceiptError(msg)}
                />
                {receiptFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Receipt ready to upload</p>
                )}
                {receiptError && (
                  <p className="text-xs text-red-500 mt-1">{receiptError}</p>
                )}
              </div>
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
