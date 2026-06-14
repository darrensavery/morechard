// app/src/components/dashboard/ChoreGuideSheet.tsx
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMarketRates } from '../../hooks/useMarketRates';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { createSuggestion, suggestChore, getSuggestions } from '../../lib/api';
import type { MarketRate, Suggestion } from '../../lib/api';
import { currencySymbol } from '../../lib/locale';

interface NewChoreForm {
  title: string;
  amount: string;
  dueDate: string;
  reason: string;
}

const TIER_ORDER = ['oaks', 'saplings', 'seeds', 'discoverable'] as const;
const TIER_HEADINGS: Record<string, string> = {
  oaks:         '🌳 Great Oaks',
  saplings:     '🌿 Growing Saplings',
  seeds:        '🌱 Small Seeds',
  discoverable: '🔍 Discoverable',
};

function formatAmount(amount: number | null, symbol: string): string {
  if (amount == null) return '—';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass when used in child context — enables suggest-to-parent flow */
  familyId?: string;
  /** Optional: module slug passed when navigating from a Learning Lab module */
  context?: string | null;
  currency?: string;
}

export function ChoreGuideSheet({ open, onClose, familyId, context = null, currency = 'GBP' }: Props) {
  const { rates, loading, error } = useMarketRates(currency);

  const symbol      = currencySymbol(currency);
  const regionLabel = currency === 'PLN' ? 'Poland' : currency === 'USD' ? 'the US' : 'your area';

  // List-level state
  const [suggested, setSuggested] = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  // My suggestions (child context — loads all statuses to show feedback)
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!open || !familyId) return;
    Promise.all([
      getSuggestions(familyId, 'pending'),
      getSuggestions(familyId, 'approved'),
      getSuggestions(familyId, 'rejected'),
    ]).then(([p, a, r]) => {
      setMySuggestions([...p.suggestions, ...a.suggestions, ...r.suggestions]
        .sort((x, y) => y.submitted_at - x.submitted_at));
    }).catch(() => { /* degrade silently */ });
  }, [open, familyId]);

  // New chore suggestion state (child context only)
  const [newChoreOpen, setNewChoreOpen] = useState(false);
  const [newChore, setNewChore] = useState<NewChoreForm>({ title: '', amount: '', dueDate: '', reason: '' });
  const [newChoreBusy, setNewChoreBusy] = useState(false);
  const [newChoreError, setNewChoreError] = useState<string | null>(null);

  // Amount-edit sheet state
  const [editRate,   setEditRate]   = useState<MarketRate | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editBusy,   setEditBusy]   = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);

  useAndroidBack(open && !editRate && !newChoreOpen, onClose);
  useAndroidBack(!!editRate, () => { setEditRate(null); setEditError(null); });
  useAndroidBack(newChoreOpen && !editRate, () => setNewChoreOpen(false));

  async function handleNewChoreSuggest() {
    if (!familyId) return;
    const title = newChore.title.trim();
    if (!title) { setNewChoreError('Please enter a chore name.'); return; }
    const pence = Math.round(parseFloat(newChore.amount) * 100);
    if (!newChore.amount || isNaN(pence) || pence <= 0) { setNewChoreError('Please enter how much it should pay.'); return; }
    setNewChoreBusy(true);
    setNewChoreError(null);
    try {
      await createSuggestion({
        family_id:       familyId,
        title,
        proposed_amount: pence,
        due_date:        newChore.dueDate || undefined,
        reason:          newChore.reason.trim() || undefined,
      });
      setNewChoreOpen(false);
      setNewChore({ title: '', amount: '', dueDate: '', reason: '' });
      setSuccess(true);
    } catch {
      setNewChoreError('Something went wrong — please try again.');
    } finally {
      setNewChoreBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, MarketRate[]> = {};
    for (const tier of TIER_ORDER) map[tier] = [];
    for (const rate of rates) map[rate.value_tier]?.push(rate);
    return map;
  }, [rates]);

  function openEdit(rate: MarketRate) {
    setEditRate(rate);
    setEditAmount(rate.median_amount != null ? (rate.median_amount / 100).toFixed(2) : '');
    setEditReason('');
    setEditError(null);
  }

  async function handleConfirmSuggest() {
    if (!editRate) return;
    const pence = Math.round(parseFloat(editAmount) * 100);
    if (!editAmount || isNaN(pence) || pence <= 0) {
      setEditError('Please enter a valid amount.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      if (familyId) {
        // Child-to-parent suggestion flow
        await createSuggestion({
          family_id:       familyId,
          title:           editRate.canonical_name,
          proposed_amount: pence,
          reason:          editReason.trim() || undefined,
        });
      } else {
        // Fallback: market-rate feedback only (parent context / no familyId)
        await suggestChore({
          canonical_name: editRate.canonical_name,
          median_amount:  pence,
          currency,
          context,
        });
      }
      setSuggested(editRate.id);
      setEditRate(null);
      setSuccess(true);
    } catch {
      setEditError('Something went wrong — please try again.');
    } finally {
      setEditBusy(false);
    }
  }

  if (!open) return null;

  // Success state
  if (success) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-bg)] px-8 text-center">
        <p className="text-5xl mb-4">🌳</p>
        <h2 className="text-xl font-semibold text-[--color-text] mb-2">Proposal sent!</h2>
        <p className="text-sm text-[--color-text-muted] mb-8">
          Your parent will see that you're ready to grow some Great Oaks.
        </p>
        <button
          onClick={() => { setSuccess(false); onClose(); }}
          className="rounded-xl bg-[--brand-primary] text-[--color-text-on-brand] px-6 py-3 text-sm font-semibold"
        >
          Done
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-[--color-border]">
        <h2 className="text-lg font-semibold text-[--color-text]">Chore Guide</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && <p className="py-8 text-center text-sm text-[--color-text-muted]">Loading…</p>}
        {error   && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
        {!loading && !error && TIER_ORDER.map(tier => {
          const tierRates = grouped[tier];
          if (!tierRates.length) return null;
          return (
            <div key={tier} className="mt-6">
              <h3 className="text-sm font-bold text-[--color-text-muted] uppercase tracking-wider mb-3">
                {TIER_HEADINGS[tier]}
              </h3>
              {tierRates.map(rate => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between py-3 border-b border-[--color-border] last:border-0"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-[--color-text] truncate">{rate.canonical_name}</p>
                    {!rate.median_is_local && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        We're still learning what this is worth in {regionLabel} — you could be the first!
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-[--color-text]">
                      {formatAmount(rate.median_amount, symbol)}
                    </span>
                    <button
                      disabled={suggested === rate.id}
                      onClick={() => openEdit(rate)}
                      className="rounded-lg bg-[--brand-primary] text-[--color-text-on-brand] px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-opacity cursor-pointer"
                    >
                      {suggested === rate.id ? '✓' : 'Suggest'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* My suggestions — child context only */}
        {familyId && !loading && !error && mySuggestions.length > 0 && (
          <div className="mt-8 border-t border-[--color-border] pt-6">
            <h3 className="text-[11px] font-bold text-[--color-text-muted] uppercase tracking-wider mb-3">My suggestions</h3>
            <div className="space-y-2.5">
              {mySuggestions.map(s => {
                const isPending  = s.status === 'pending';
                const isApproved = s.status === 'approved';
                return (
                  <div key={s.id} className={`rounded-xl border px-3.5 py-3 ${
                    isPending  ? 'border-[--color-border] bg-[var(--color-surface-alt)]' :
                    isApproved ? 'border-green-500/30 bg-green-500/8' :
                                 'border-red-400/30 bg-red-500/5'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[--color-text] truncate">{s.title}</p>
                        <p className="text-[12px] text-[--color-text-muted] tabular-nums mt-0.5">
                          {symbol}{(s.proposed_amount / 100).toFixed(2)}
                          {s.due_date && <> · by {s.due_date}</>}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        isPending  ? 'bg-amber-500/15 text-amber-300' :
                        isApproved ? 'bg-green-500/15 text-green-400' :
                                     'bg-red-500/15 text-red-400'
                      }`}>
                        {isPending ? 'Waiting' : isApproved ? 'Approved ✓' : 'Declined'}
                      </span>
                    </div>
                    {!isPending && !isApproved && s.rejection_note && (
                      <p className="text-[12px] text-[--color-text-muted] mt-2 pt-2 border-t border-red-400/20 italic">
                        "{s.rejection_note}"
                      </p>
                    )}
                    {isApproved && (
                      <p className="text-[11px] text-green-400 mt-1.5">Added to your chores! 🌱</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggest a new chore — child context only */}
        {familyId && !loading && !error && (
          <div className="mt-6 border-t border-[--color-border] pt-6">
            {!newChoreOpen ? (
              <div className="text-center">
                <p className="text-[13px] text-[--color-text-muted] mb-3">
                  Don't see the chore you want to do?
                </p>
                <button
                  onClick={() => setNewChoreOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--brand-primary)] text-[var(--brand-primary)] text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] transition-colors cursor-pointer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Suggest a new chore
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] font-bold text-[--color-text] mb-0.5">Suggest a new chore</p>
                  <p className="text-[12px] text-[--color-text-muted]">Tell your parent what you'd like to do and how much it should pay.</p>
                </div>
                {newChoreError && <p className="text-[13px] text-red-600">{newChoreError}</p>}
                <div>
                  <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                    Chore name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Clean the bathroom"
                    value={newChore.title}
                    onChange={e => setNewChore(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-[14px] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                    How much should it pay? <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-text-muted)]">{symbol}</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={newChore.amount}
                      onChange={e => setNewChore(f => ({ ...f, amount: e.target.value }))}
                      className="w-full border border-[var(--color-border)] rounded-xl pl-7 pr-3 py-2.5 text-[14px] font-semibold bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                    When do you want to do it by? <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={newChore.dueDate}
                    onChange={e => setNewChore(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-[13px] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                    Why should this be a chore? <span className="font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. I could do this every Saturday morning"
                    value={newChore.reason}
                    onChange={e => setNewChore(f => ({ ...f, reason: e.target.value }))}
                    className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-[13px] resize-none bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setNewChoreOpen(false); setNewChoreError(null); }}
                    className="flex-1 border border-[var(--color-border)] rounded-xl py-2.5 text-[13px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNewChoreSuggest}
                    disabled={newChoreBusy}
                    className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-2.5 text-[13px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    {newChoreBusy ? 'Sending…' : 'Send to parent →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Amount-edit bottom sheet */}
      {editRate && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setEditRate(null); setEditError(null); }} />
          <div className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4">
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <div>
              <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Suggest this chore</p>
              <p className="text-[16px] font-bold text-[var(--color-text)]">{editRate.canonical_name}</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                Market rate: {formatAmount(editRate.median_amount, symbol)} — change the amount if you think it's worth more or less.
              </p>
            </div>

            {editError && <p className="text-[13px] text-red-600">{editError}</p>}

            {/* Amount input */}
            <div>
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                How much should it pay?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-text-muted)]">
                  {symbol}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full border border-[var(--color-border)] rounded-xl pl-7 pr-3 py-3 text-[15px] font-semibold bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            {/* Optional reason */}
            <div>
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                Why should this be a chore? <span className="font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. I could do this every week after school"
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-[13px] resize-none bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setEditRate(null); setEditError(null); }}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuggest}
                disabled={editBusy}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all"
              >
                {editBusy ? 'Sending…' : 'Send to parent →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
