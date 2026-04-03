import { useState, useEffect, useCallback } from 'react'
import type { Chore, Suggestion, Plan, ChildRecord } from '../../lib/api'
import {
  getChores, createChore, archiveChore, restoreChore,
  getSuggestions, getPlans, createPlan, deletePlan,
  formatCurrency, getMondayISO,
} from '../../lib/api'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CURRENCY = 'GBP'

interface Props {
  familyId: string
  child: ChildRecord
}

interface NewChoreForm {
  title: string
  reward_amount: string
  frequency: string
  description: string
  is_priority: boolean
  is_flash: boolean
  flash_deadline: string
  due_date: string
}

const BLANK_FORM: NewChoreForm = {
  title: '', reward_amount: '', frequency: 'one-off',
  description: '', is_priority: false, is_flash: false,
  flash_deadline: '', due_date: '',
}

export function JobsTab({ familyId, child }: Props) {
  const [chores, setChores]           = useState<Chore[]>([])
  const [archived, setArchived]       = useState<Chore[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [plans, setPlans]             = useState<Plan[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm]               = useState<NewChoreForm>(BLANK_FORM)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const weekStart = getMondayISO()

  const load = useCallback(async () => {
    setLoading(true)
    const [c, a, s, p] = await Promise.all([
      getChores({ family_id: familyId, child_id: child.id }).then(r => r.chores),
      getChores({ family_id: familyId, child_id: child.id, archived: true }).then(r => r.chores),
      getSuggestions(familyId, 'pending').then(r => r.suggestions.filter(s => s.child_id === child.id)),
      getPlans(familyId, child.id, weekStart).then(r => r.plans),
    ])
    setChores(c)
    setArchived(a)
    setSuggestions(s)
    setPlans(p)
    setLoading(false)
  }, [familyId, child.id, weekStart])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim() || !form.reward_amount) return
    setSaving(true)
    setError(null)
    try {
      await createChore({
        family_id: familyId,
        assigned_to: child.id,
        title: form.title.trim(),
        reward_amount: Math.round(parseFloat(form.reward_amount) * 100),
        currency: CURRENCY,
        frequency: form.frequency,
        description: form.description || undefined,
        is_priority: form.is_priority,
        is_flash: form.is_flash,
        flash_deadline: form.flash_deadline || undefined,
        due_date: form.due_date || undefined,
      })
      setForm(BLANK_FORM)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(id: string) {
    await archiveChore(id)
    await load()
  }

  async function handleRestore(id: string) {
    await restoreChore(id)
    await load()
  }

  async function togglePlan(chore: Chore, dayIndex: number) {
    const existing = plans.find(p => p.chore_id === chore.id && p.day_of_week === dayIndex + 1)
    if (existing) {
      await deletePlan(existing.id)
    } else {
      await createPlan({ family_id: familyId, chore_id: chore.id, child_id: child.id, day_of_week: dayIndex + 1, week_start: weekStart })
    }
    await load()
  }

  if (loading) return <div className="py-10 text-center text-[14px] text-[#6b6a66]">Loading…</div>

  return (
    <div className="space-y-4">
      {/* Suggestions banner */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
          <p className="text-[13px] font-semibold text-blue-700 mb-2">
            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} from {child.display_name}
          </p>
          {suggestions.map(s => (
            <div key={s.id} className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-[#1C1C1A]">{s.title}</span>
              <span className="text-[13px] font-semibold text-blue-700">{formatCurrency(s.proposed_amount, CURRENCY)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active chores */}
      {chores.length === 0 ? (
        <div className="bg-white border border-[#D3D1C7] rounded-xl p-6 text-center">
          <p className="text-[14px] text-[#6b6a66]">No active jobs for {child.display_name}.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {chores.map(chore => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              plans={plans.filter(p => p.chore_id === chore.id)}
              onArchive={() => handleArchive(chore.id)}
              onTogglePlan={(day) => togglePlan(chore, day)}
            />
          ))}
        </div>
      )}

      {/* Add job button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full border-2 border-dashed border-[#D3D1C7] rounded-xl py-3.5 text-[14px] font-semibold text-[#6b6a66] hover:border-green-600 hover:text-green-700 transition-colors cursor-pointer"
        >
          + Add job
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-[#D3D1C7] rounded-xl p-4 space-y-3">
          <p className="text-[15px] font-bold text-[#1C1C1A]">New job</p>

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          <input
            className="w-full border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="Job title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6b6a66]">£</span>
              <input
                className="w-full border border-[#D3D1C7] rounded-lg pl-7 pr-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="0.00"
                type="number" min="0.01" step="0.01"
                value={form.reward_amount}
                onChange={e => setForm(f => ({ ...f, reward_amount: e.target.value }))}
                required
              />
            </div>
            <select
              className="border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            >
              <option value="one-off">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <textarea
            className="w-full border border-[#D3D1C7] rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[13px] text-[#1C1C1A] cursor-pointer select-none">
              <input type="checkbox" checked={form.is_priority} onChange={e => setForm(f => ({ ...f, is_priority: e.target.checked }))} className="w-4 h-4 accent-amber-600" />
              Priority
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[#1C1C1A] cursor-pointer select-none">
              <input type="checkbox" checked={form.is_flash} onChange={e => setForm(f => ({ ...f, is_flash: e.target.checked }))} className="w-4 h-4 accent-red-600" />
              Flash job
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(BLANK_FORM); setError(null) }}
              className="flex-1 border border-[#D3D1C7] rounded-xl py-2.5 text-[14px] font-semibold text-[#6b6a66] hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-700 text-white rounded-xl py-2.5 text-[14px] font-semibold hover:bg-green-800 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving…' : 'Add job'}
            </button>
          </div>
        </form>
      )}

      {/* Archived toggle */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(v => !v)}
            className="text-[13px] font-semibold text-[#6b6a66] hover:text-[#1C1C1A] cursor-pointer"
          >
            {showArchived ? '▲' : '▼'} Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2">
              {archived.map(chore => (
                <div key={chore.id} className="bg-white border border-[#D3D1C7] rounded-xl px-4 py-3 flex items-center justify-between opacity-60">
                  <div>
                    <p className="text-[14px] font-semibold text-[#1C1C1A]">{chore.title}</p>
                    <p className="text-[12px] text-[#6b6a66]">{formatCurrency(chore.reward_amount, chore.currency)}</p>
                  </div>
                  <button onClick={() => handleRestore(chore.id)} className="text-[13px] font-semibold text-green-700 hover:underline cursor-pointer">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChoreCard({ chore, plans, onArchive, onTogglePlan }: {
  chore: Chore
  plans: Plan[]
  onArchive: () => void
  onTogglePlan: (dayIndex: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isOverdue = chore.due_date && new Date(chore.due_date) < new Date()
  const plannedDays = plans.map(p => p.day_of_week - 1)

  const borderClass = chore.is_flash
    ? 'border-red-500 border-l-4'
    : chore.is_priority
    ? 'border-amber-500 border-l-4'
    : isOverdue
    ? 'border-red-300 border-l-4'
    : ''

  const bgClass = isOverdue && !chore.is_flash
    ? 'bg-red-50'
    : chore.is_priority && !chore.is_flash
    ? 'bg-amber-50'
    : 'bg-white'

  return (
    <div className={`${bgClass} border border-[#D3D1C7] ${borderClass} rounded-xl overflow-hidden`}>
      <button
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            {chore.is_flash && <span className="text-[11px] font-bold text-red-600 bg-red-100 rounded px-1.5 py-0.5">FLASH</span>}
            {chore.is_priority && !chore.is_flash && <span className="text-[11px] font-bold text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">PRIORITY</span>}
            <span className="text-[15px] font-semibold text-[#1C1C1A]">{chore.title}</span>
          </div>
          <p className="text-[13px] text-[#6b6a66] mt-0.5">
            {formatCurrency(chore.reward_amount, chore.currency)}
            {chore.frequency !== 'one-off' && <span className="ml-1">· {chore.frequency}</span>}
          </p>
        </div>
        <span className="text-[#6b6a66] text-[18px] leading-none">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#D3D1C7] pt-3">
          {chore.description && (
            <p className="text-[13px] text-[#6b6a66]">{chore.description}</p>
          )}

          {/* Weekly planner strip */}
          <div>
            <p className="text-[12px] font-semibold text-[#6b6a66] mb-1.5">Plan this week</p>
            <div className="flex gap-1.5">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => onTogglePlan(i)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer
                    ${plannedDays.includes(i)
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-100 text-[#6b6a66] hover:bg-gray-200'
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onArchive}
            className="text-[13px] font-semibold text-red-600 hover:underline cursor-pointer"
          >
            Archive job
          </button>
        </div>
      )}
    </div>
  )
}