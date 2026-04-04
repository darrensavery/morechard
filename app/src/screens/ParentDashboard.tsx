import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChildRecord } from '../lib/api'
import { getChildren, getCompletions } from '../lib/api'
import { getDeviceIdentity } from '../lib/deviceIdentity'
import { AvatarSVG } from '../lib/avatars'
import { JobsTab }     from '../components/dashboard/JobsTab'
import { PendingTab }  from '../components/dashboard/PendingTab'
import { HistoryTab }  from '../components/dashboard/HistoryTab'
import { InsightsTab } from '../components/dashboard/InsightsTab'
import { ParentSettingsTab } from '../components/dashboard/ParentSettingsTab'

type Tab = 'jobs' | 'pending' | 'history' | 'insights' | 'settings'

export function ParentDashboard() {
  const navigate   = useNavigate()
  const familyId   = getDeviceIdentity()?.family_id ?? ''

  const [tab,        setTab]        = useState<Tab>('jobs')
  const [children,   setChildren]   = useState<ChildRecord[]>([])
  const [activeChild, setActiveChild] = useState<ChildRecord | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [online,     setOnline]     = useState(navigator.onLine)

  // Load children on mount
  useEffect(() => {
    if (!familyId) { navigate('/'); return }
    getChildren().then(r => {
      setChildren(r.children)
      if (r.children.length > 0 && !activeChild) setActiveChild(r.children[0])
    }).catch(() => navigate('/'))
  }, [familyId])

  // Track online status
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Poll pending count
  useEffect(() => {
    if (!familyId || !activeChild) return
    const load = () => getCompletions({ family_id: familyId, child_id: activeChild.id, status: 'pending' })
      .then(r => setPendingCount(r.completions.length))
      .catch(() => {})
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [familyId, activeChild])

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'jobs',     label: 'Jobs' },
    { id: 'pending',  label: 'Pending', badge: pendingCount || undefined },
    { id: 'history',  label: 'History' },
    { id: 'insights', label: 'Insights' },
    { id: 'settings', label: 'Settings' },
  ]

  function handleLock() {
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#D3D1C7] shadow-[0_1px_4px_rgba(0,0,0,.05)]">
        <div className="max-w-[560px] mx-auto px-3.5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${online ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">Morechard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6b6a66]">{getDeviceIdentity()?.display_name ?? 'Parent'}</span>
            <button
              onClick={handleLock}
              className="w-8 h-8 rounded-lg border border-[#D3D1C7] flex items-center justify-center text-[#6b6a66] hover:bg-gray-50 cursor-pointer"
              title="Lock"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Child selector */}
        {children.length > 1 && (
          <div className="max-w-[560px] mx-auto px-3.5 pb-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setActiveChild(child)}
                className={`
                  shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold
                  transition-colors duration-100 cursor-pointer
                  ${activeChild?.id === child.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-[#6b6a66] hover:bg-gray-200'}
                `}
              >
                <AvatarSVG id={child.avatar_id ?? 'bot'} size={20} />
                {child.display_name}
              </button>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="max-w-[560px] mx-auto border-t border-[#D3D1C7] flex overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex-1 shrink-0 px-3 py-2.5 text-[13px] font-semibold
                relative flex items-center justify-center gap-1.5
                transition-colors duration-100 cursor-pointer
                ${tab === t.id ? 'text-green-700' : 'text-[#6b6a66] hover:text-[#1C1C1A]'}
              `}
            >
              {t.label}
              {t.badge ? (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
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
        {activeChild ? (
          <>
            {tab === 'jobs'     && <JobsTab     familyId={familyId} child={activeChild} />}
            {tab === 'pending'  && <PendingTab  familyId={familyId} child={activeChild} onCountChange={setPendingCount} />}
            {tab === 'history'  && <HistoryTab  familyId={familyId} child={activeChild} />}
            {tab === 'insights' && <InsightsTab familyId={familyId} child={activeChild} />}
            {tab === 'settings' && <ParentSettingsTab familyId={familyId} onChildrenChange={setChildren} />}
          </>
        ) : tab === 'settings' ? (
          <ParentSettingsTab familyId={familyId} onChildrenChange={setChildren} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-teal-50 border-2 border-teal-100 flex items-center justify-center text-4xl">
              👧
            </div>
            <div>
              <h2 className="text-[18px] font-extrabold text-[#1C1C1A] tracking-tight mb-1.5">
                Add your first child
              </h2>
              <p className="text-[13px] text-[#6b6a66] leading-relaxed max-w-[260px] mx-auto">
                Once you add a child, you can set up chores, track their pocket money, and watch their savings grow.
              </p>
            </div>
            <button
              onClick={() => setTab('settings')}
              className="h-12 px-6 bg-teal-600 text-white font-semibold text-[14px] rounded-2xl cursor-pointer hover:bg-teal-700 active:scale-[0.98] transition-all shadow-md"
            >
              Add a child →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
