// app/src/components/dashboard/SpendGuideSheet.tsx
// Full-screen spend guide — mirrors ChoreGuideSheet structure.
// Child browses categorised spend items, taps one, enters the actual
// amount they paid, then saves to /api/spending.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { logSpend } from '../../lib/api'
import { useAndroidBack } from '../../hooks/useAndroidBack'
import { currencySymbol } from '../../lib/locale'

// ── Category icon ────────────────────────────────────────────────────────────
const P = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function CategoryIcon({ id, size = 16 }: { id: string; size?: number }) {
  const p = { ...P, width: size, height: size }
  switch (id) {
    case 'food':
      return <svg {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>
    case 'games':
      return <svg {...p}><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
    case 'entertainment':
      return <svg {...p}><path d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0"/><path d="M12 8v4l3 3"/></svg>
    case 'clothes':
      return <svg {...p}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
    case 'stationery':
      return <svg {...p}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
    case 'toys':
      return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    case 'tech':
      return <svg {...p}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
    case 'books':
      return <svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    case 'gifts':
      return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
  }
}

// ── Spend items data ─────────────────────────────────────────────────────────
interface SpendItem {
  id:       string
  category: string
  label:    string
}

const CATEGORIES: { id: string; heading: string }[] = [
  { id: 'food',          heading: 'Food & Treats' },
  { id: 'games',         heading: 'Games & Apps' },
  { id: 'entertainment', heading: 'Entertainment' },
  { id: 'clothes',       heading: 'Clothes & Style' },
  { id: 'stationery',    heading: 'Stationery & School' },
  { id: 'toys',          heading: 'Toys & Hobbies' },
  { id: 'tech',          heading: 'Tech & Gadgets' },
  { id: 'books',         heading: 'Books & Reading' },
  { id: 'gifts',         heading: 'Gifts' },
]

const SPEND_ITEMS: SpendItem[] = [
  // Food & Treats
  { id: 'tuck-shop',     category: 'food',          label: 'Tuck shop / school canteen' },
  { id: 'fast-food',     category: 'food',          label: "McDonald's / fast food" },
  { id: 'bubble-tea',    category: 'food',          label: 'Bubble tea / smoothie' },
  { id: 'ice-cream',     category: 'food',          label: 'Ice cream' },
  { id: 'sweets',        category: 'food',          label: 'Sweets & snacks' },
  { id: 'coffee-shop',   category: 'food',          label: 'Coffee shop (Costa, Starbucks)' },
  { id: 'takeaway',      category: 'food',          label: 'Takeaway pizza / kebab' },
  { id: 'vending',       category: 'food',          label: 'Vending machine' },
  // Games & Apps
  { id: 'robux',         category: 'games',         label: 'Roblox Robux' },
  { id: 'v-bucks',       category: 'games',         label: 'Fortnite V-Bucks' },
  { id: 'minecraft',     category: 'games',         label: 'Minecraft / in-game item' },
  { id: 'app-purchase',  category: 'games',         label: 'App Store / Google Play' },
  { id: 'steam-game',    category: 'games',         label: 'Steam / PC game' },
  { id: 'console-game',  category: 'games',         label: 'Console game or DLC' },
  { id: 'music-sub',     category: 'games',         label: 'Spotify / music subscription' },
  { id: 'gaming-sub',    category: 'games',         label: 'Nintendo Online / Game Pass' },
  // Entertainment
  { id: 'cinema',        category: 'entertainment', label: 'Cinema ticket' },
  { id: 'bowling',       category: 'entertainment', label: 'Bowling' },
  { id: 'arcade',        category: 'entertainment', label: 'Arcade / laser tag' },
  { id: 'escape-room',   category: 'entertainment', label: 'Escape room' },
  { id: 'trampoline',    category: 'entertainment', label: 'Trampoline park' },
  { id: 'mini-golf',     category: 'entertainment', label: 'Mini golf' },
  { id: 'swimming',      category: 'entertainment', label: 'Swimming pool / leisure centre' },
  { id: 'theme-park',    category: 'entertainment', label: 'Theme park / fairground' },
  // Clothes & Style
  { id: 'trainers',      category: 'clothes',       label: 'Trainers / shoes' },
  { id: 'tshirt-hoodie', category: 'clothes',       label: 'T-shirt / hoodie' },
  { id: 'cap-hat',       category: 'clothes',       label: 'Cap / hat' },
  { id: 'bag',           category: 'clothes',       label: 'Bag / backpack' },
  { id: 'sunglasses',    category: 'clothes',       label: 'Sunglasses' },
  { id: 'socks',         category: 'clothes',       label: 'Socks / underwear' },
  // Stationery & School
  { id: 'pens',          category: 'stationery',    label: 'Pens / pencils' },
  { id: 'notebook',      category: 'stationery',    label: 'Notebook / diary' },
  { id: 'art-supplies',  category: 'stationery',    label: 'Art supplies / paints' },
  { id: 'ruler-etc',     category: 'stationery',    label: 'Ruler, scissors, glue' },
  { id: 'school-trip',   category: 'stationery',    label: 'School trip contribution' },
  { id: 'revision-book', category: 'stationery',    label: 'Revision book / workbook' },
  // Toys & Hobbies
  { id: 'lego',          category: 'toys',          label: 'LEGO set' },
  { id: 'trading-cards', category: 'toys',          label: 'Trading cards (Pokémon, etc.)' },
  { id: 'action-figure', category: 'toys',          label: 'Action figure / doll' },
  { id: 'board-game',    category: 'toys',          label: 'Board game / puzzle' },
  { id: 'craft-kit',     category: 'toys',          label: 'Craft kit / science kit' },
  { id: 'sports-eq',     category: 'toys',          label: 'Sports equipment' },
  // Tech & Gadgets
  { id: 'phone-case',    category: 'tech',          label: 'Phone case / screen protector' },
  { id: 'earphones',     category: 'tech',          label: 'Earphones / headphones' },
  { id: 'phone-topup',   category: 'tech',          label: 'Phone top-up / credit' },
  { id: 'usb-cable',     category: 'tech',          label: 'USB cable / charger' },
  { id: 'power-bank',    category: 'tech',          label: 'Power bank' },
  // Books & Reading
  { id: 'novel',         category: 'books',         label: 'Novel / fiction book' },
  { id: 'comic',         category: 'books',         label: 'Comic / graphic novel' },
  { id: 'magazine',      category: 'books',         label: 'Magazine' },
  { id: 'audiobook',     category: 'books',         label: 'Audiobook / e-book' },
  // Gifts
  { id: 'gift-friend',   category: 'gifts',         label: 'Birthday gift for a friend' },
  { id: 'gift-wrap',     category: 'gifts',         label: 'Gift wrap / card' },
  { id: 'xmas-gift',     category: 'gifts',         label: 'Christmas / holiday gift' },
  { id: 'charity',       category: 'gifts',         label: 'Charity donation' },
]

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  open:      boolean
  familyId:  string
  currency:  string
  onClose:   () => void
  onSaved:   () => void
}

interface EntryState {
  title:     string
  amountStr: string
  note:      string
  noteOpen:  boolean
  custom:    boolean   // true = custom title field is editable
}

export function SpendGuideSheet({ open, familyId, currency, onClose, onSaved }: Props) {
  const symbol = currencySymbol(currency)

  const [entry,   setEntry]   = useState<EntryState | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useAndroidBack(open && !entry, onClose)
  useAndroidBack(!!entry,        () => { setEntry(null); setSaveErr(null) })

  function openItem(item: SpendItem) {
    setEntry({ title: item.label, amountStr: '', note: '', noteOpen: false, custom: false })
    setSaveErr(null)
  }

  function openCustom() {
    setEntry({ title: '', amountStr: '', note: '', noteOpen: false, custom: true })
    setSaveErr(null)
  }

  async function handleSave() {
    if (!entry) return
    const title = entry.title.trim()
    if (!title) { setSaveErr('Please add a description.'); return }
    const pence = Math.round(parseFloat(entry.amountStr || '0') * 100)
    if (!pence || pence <= 0) { setSaveErr('Please enter an amount.'); return }

    setSaving(true)
    setSaveErr(null)
    try {
      await logSpend({
        family_id: familyId,
        title,
        amount:    pence,
        currency,
        note:      entry.note.trim() || undefined,
      })
      setEntry(null)
      setSuccess(true)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  if (success) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-bg)] px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)]/15 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Spend logged!</h2>
        <p className="text-[14px] text-[var(--color-text-muted)] mb-8">Your balance has been updated.</p>
        <button
          onClick={() => { setSuccess(false); onSaved() }}
          className="rounded-xl bg-[var(--brand-primary)] text-white px-8 py-3 text-[14px] font-bold"
        >
          Done
        </button>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--color-bg)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-[17px] font-bold text-[var(--color-text)]">Spend Guide</h2>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">What did you buy?</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable item list ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {CATEGORIES.map(cat => {
          const items = SPEND_ITEMS.filter(i => i.category === cat.id)
          return (
            <div key={cat.id} className="mt-6">
              <h3 className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                <CategoryIcon id={cat.id} size={14} />
                {cat.heading}
              </h3>
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0"
                >
                  <p className="text-[14px] text-[var(--color-text)] flex-1 mr-3">{item.label}</p>
                  <button
                    onClick={() => openItem(item)}
                    className="rounded-lg bg-[var(--brand-primary)] text-white px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90 cursor-pointer shrink-0"
                  >
                    Log
                  </button>
                </div>
              ))}
            </div>
          )
        })}

        {/* ── Custom entry ── */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center">
          <p className="text-[13px] text-[var(--color-text-muted)] mb-3">
            Don't see what you spent money on?
          </p>
          <button
            onClick={openCustom}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--brand-primary)] text-[var(--brand-primary)] text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] transition-colors cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add a custom spend
          </button>
        </div>
      </div>

      {/* ── Amount entry sub-sheet ── */}
      {entry && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setEntry(null); setSaveErr(null) }} />
          <div className="relative bg-[var(--color-surface)] rounded-t-2xl px-5 pt-2 pb-8 space-y-4">

            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
            </div>

            <div>
              <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">
                Log a spend
              </p>
              {entry.custom ? (
                <input
                  type="text"
                  value={entry.title}
                  onChange={e => setEntry(v => v && ({ ...v, title: e.target.value }))}
                  placeholder="What did you buy?"
                  autoFocus
                  className="w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[15px] font-semibold bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] mt-1"
                />
              ) : (
                <p className="text-[17px] font-bold text-[var(--color-text)]">{entry.title}</p>
              )}
            </div>

            {saveErr && <p className="text-[13px] text-red-500">{saveErr}</p>}

            {/* Amount */}
            <div>
              <label className="text-[12px] font-semibold text-[var(--color-text-muted)] block mb-1.5">
                How much did you spend?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[var(--color-text-muted)]">
                  {symbol}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  autoFocus={!entry.custom}
                  value={entry.amountStr}
                  onChange={e => setEntry(v => v && ({ ...v, amountStr: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-[var(--color-border)] rounded-xl pl-8 pr-3 py-3 text-[20px] font-bold tabular-nums bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            {/* Optional note */}
            <div>
              <button
                type="button"
                onClick={() => setEntry(v => v && ({ ...v, noteOpen: !v.noteOpen }))}
                className="text-[13px] font-semibold text-[var(--brand-primary)] cursor-pointer"
              >
                {entry.noteOpen ? '▾ Remove note' : '▸ Add a note'}
              </button>
              {entry.noteOpen && (
                <textarea
                  value={entry.note}
                  onChange={e => setEntry(v => v && ({ ...v, note: e.target.value }))}
                  placeholder="e.g. birthday money treat"
                  rows={2}
                  className="mt-2 w-full border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[13px] resize-none bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setEntry(null); setSaveErr(null) }}
                className="flex-1 border border-[var(--color-border)] rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[var(--brand-primary)] text-white rounded-xl py-3 text-[14px] font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving…' : 'Save spend →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
