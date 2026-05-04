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
  { value: 'education',  label: 'Education' },
  { value: 'health',     label: 'Health' },
  { value: 'clothing',   label: 'Clothing' },
  { value: 'travel',     label: 'Travel' },
  { value: 'activities', label: 'Activities' },
  { value: 'childcare',  label: 'Childcare' },
  { value: 'food',       label: 'Food' },
  { value: 'tech',       label: 'Tech' },
  { value: 'gifts',      label: 'Gifts' },
  { value: 'other',      label: 'Other' },
];

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'education':
      return <svg {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
    case 'health':
      return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'clothing':
      return <svg {...props}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>;
    case 'travel':
      return <svg {...props}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c0 0-1 0-3 1.5L8 9.2l-4.7-1.2c-.7-.2-1.3.6-.9 1.2l4 5.9c.4.6 1.2.8 1.8.4l1.9-1.2 2.5 2.5-1.2 1.9c-.4.6-.2 1.4.4 1.8l5.9 4c.6.4 1.4-.2 1.2-.9L17.8 19.2z"/></svg>;
    case 'activities':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>;
    case 'childcare':
      return <svg {...props}><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5.5 4.5 1.4"/><path d="M12 3c0 0 0 2-2 3"/></svg>;
    case 'food':
      return <svg {...props}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
    case 'tech':
      return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>;
    case 'gifts':
      return <svg {...props}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>;
    default: // other
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
  }
}

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
                  <CategoryIcon category={preset.category} size={22} />
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
                    <CategoryIcon category={preset.category} size={16} />
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
              <CategoryIcon category={category} size={14} />
              {selectedCategoryLabel}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors
                    ${category === c.value
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text)]'
                    }`}
                >
                  <CategoryIcon category={c.value} size={13} />
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
