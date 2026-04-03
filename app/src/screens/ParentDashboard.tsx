import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Tab = 'jobs' | 'pending' | 'history' | 'insights' | 'settings'

const TABS: { id: Tab; label: string; badge?: number }[] = [
  { id: 'jobs',     label: 'Jobs' },
  { id: 'pending',  label: 'Pending' },
  { id: 'history',  label: 'History' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
]

const MOCK_CHILDREN = ['Alex', 'Mia']

export function ParentDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('jobs')
  const [child, setChild] = useState(MOCK_CHILDREN[0])

  function handleLock() {
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#D3D1C7] shadow-[0_1px_4px_rgba(0,0,0,.05)]">
        <div className="max-w-[560px] mx-auto px-3.5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-[7px] h-[7px] rounded-full bg-green-500 shrink-0" />
            <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">MoneySteps</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6b6a66]">Parent</span>
            <button
              onClick={handleLock}
              className="w-8 h-8 rounded-lg border border-[#D3D1C7] flex items-center justify-center text-[#6b6a66] hover:bg-gray-50 cursor-pointer"
              title="Lock / sign out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Child selector */}
        <div className="max-w-[560px] mx-auto px-3.5 pb-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
          {MOCK_CHILDREN.map(name => (
            <button
              key={name}
              onClick={() => setChild(name)}
              className={`
                shrink-0 px-4 py-1.5 rounded-full text-[14px] font-semibold
                transition-colors duration-100 cursor-pointer
                ${child === name
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-[#6b6a66] hover:bg-gray-200'}
              `}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Tab bar */}
        <div className="max-w-[560px] mx-auto border-t border-[#D3D1C7] flex overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 shrink-0 px-3 py-2.5 text-[14px] font-semibold
                relative flex items-center justify-center gap-1.5
                transition-colors duration-100 cursor-pointer
                ${tab === t.id ? 'text-green-700' : 'text-[#6b6a66] hover:text-[#1C1C1A]'}
              `}
            >
              {t.label}
              {t.badge ? (
                <span className="bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {t.badge}
                </span>
              ) : null}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-green-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[560px] mx-auto w-full px-3.5 py-4">
        {/* Earnings card */}
        <EarningsCard child={child} />

        {tab === 'jobs'     && <JobsTab child={child} />}
        {tab === 'pending'  && <PendingTab />}
        {tab === 'history'  && <HistoryTab />}
        {tab === 'insights' && <InsightsTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}

/* ---- Sub-components ---- */

function EarningsCard({ child }: { child: string }) {
  return (
    <div className="bg-white rounded-2xl border-t-[3px] border-t-green-600 border border-[#D3D1C7] p-4 mb-4 shadow-sm">
      <div className="text-[12px] font-semibold text-[#6b6a66] uppercase tracking-wider mb-1">{child}'s earnings</div>
      <div className="text-[46px] font-extrabold text-[#1C1C1A] leading-none tracking-tight tabular-nums">£0.00</div>
      <div className="flex gap-4 mt-2">
        <span className="text-[13px] text-[#6b6a66]">This month: <strong className="text-[#1C1C1A]">£0.00</strong></span>
        <span className="text-[13px] text-[#6b6a66]">Pending: <strong className="text-amber-700">£0.00</strong></span>
      </div>
    </div>
  )
}

function JobsTab({ child }: { child: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold text-[#1C1C1A]">{child}'s jobs</h2>
        <button className="text-[13px] font-semibold text-teal-700 border border-dashed border-teal-400 rounded-xl px-3 py-1.5 hover:bg-teal-50 cursor-pointer transition-colors">
          + Add job
        </button>
      </div>
      <EmptyState
        icon="📋"
        title="No jobs yet"
        message="Add a job to get started"
      />
    </div>
  )
}

function PendingTab() {
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1C1C1A] mb-3">Approval queue</h2>
      <EmptyState icon="✅" title="All clear" message="No jobs waiting for approval" />
    </div>
  )
}

function HistoryTab() {
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1C1C1A] mb-3">History</h2>
      <EmptyState icon="📜" title="No history yet" message="Approved jobs will appear here" />
    </div>
  )
}

function InsightsTab() {
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1C1C1A] mb-3">Insights</h2>
      <EmptyState icon="📊" title="Not enough data" message="Complete some jobs to see insights" />
    </div>
  )
}

function SettingsTab() {
  const groups = [
    { icon: '👤', color: 'bg-teal-100 text-teal-700', title: 'Profile & Appearance',  sub: 'Name, avatar, dark mode' },
    { icon: '💰', color: 'bg-green-100 text-green-700', title: 'Pocket Money',         sub: 'Allowance, currency, pay day' },
    { icon: '🔒', color: 'bg-amber-100 text-amber-700', title: 'Parental Controls',    sub: 'Limits, approval rules' },
    { icon: '🔑', color: 'bg-red-100 text-red-700',    title: 'Login & Security',      sub: 'PIN, password, sessions' },
    { icon: '👨‍👩‍👧', color: 'bg-purple-100 text-purple-700', title: 'Family & Governance', sub: 'Co-parent, invite codes, mode' },
    { icon: '🌍', color: 'bg-blue-100 text-blue-700',  title: 'Language',              sub: 'App language & locale' },
  ]

  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#1C1C1A] mb-3">Settings</h2>
      <div className="flex flex-col gap-2">
        {groups.map(g => (
          <button
            key={g.title}
            className="bg-white border border-[#D3D1C7] rounded-xl p-3.5 flex items-center gap-3.5 hover:-translate-y-px hover:shadow-md transition-all duration-150 cursor-pointer text-left w-full"
          >
            <div className={`w-[46px] h-[46px] rounded-xl flex items-center justify-center text-xl ${g.color}`}>
              {g.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-bold text-[#1C1C1A]">{g.title}</div>
              <div className="text-[14px] text-[#6b6a66]">{g.sub}</div>
            </div>
            <svg className="text-[#6b6a66] shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#D3D1C7] p-8 flex flex-col items-center text-center gap-2">
      <span className="text-3xl mb-1">{icon}</span>
      <div className="text-[15px] font-bold text-[#1C1C1A]">{title}</div>
      <div className="text-[13px] text-[#6b6a66]">{message}</div>
    </div>
  )
}
