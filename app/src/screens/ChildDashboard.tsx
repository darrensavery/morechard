import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ChildDashboard() {
  const navigate = useNavigate()
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7) // 1=Mon … 7=Sun

  return (
    <div className="min-h-svh bg-[#F5F4F0] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#D3D1C7] shadow-[0_1px_4px_rgba(0,0,0,.05)]">
        <div className="max-w-[560px] mx-auto px-3.5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-[7px] h-[7px] rounded-full bg-green-500 shrink-0" />
            <span className="text-[17px] font-extrabold text-[#1C1C1A] tracking-tight">MoneySteps</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg border border-[#D3D1C7] flex items-center justify-center text-[#6b6a66] hover:bg-gray-50 cursor-pointer"
            title="Sign out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[560px] mx-auto w-full px-3.5 py-4 flex flex-col gap-4">
        {/* Earnings card — teal border */}
        <div className="bg-white rounded-2xl border-t-[3px] border-t-teal-600 border border-[#D3D1C7] p-4 shadow-sm">
          <div className="text-[12px] font-semibold text-[#6b6a66] uppercase tracking-wider mb-1">My earnings</div>
          <div className="text-[46px] font-extrabold text-[#1C1C1A] leading-none tracking-tight tabular-nums">£0.00</div>
          <div className="flex gap-4 mt-2">
            <span className="text-[13px] text-[#6b6a66]">This month: <strong className="text-[#1C1C1A]">£0.00</strong></span>
            <span className="text-[13px] text-[#6b6a66]">Pending: <strong className="text-amber-700">£0.00</strong></span>
          </div>
        </div>

        {/* Weekly planner */}
        <div className="bg-white rounded-2xl border border-[#D3D1C7] p-4 shadow-sm">
          <h2 className="text-[15px] font-bold text-[#1C1C1A] mb-3">This week's jobs</h2>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {DAYS.map((day, i) => {
              const dayNum = i + 1
              const isToday = activeDay === dayNum
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(dayNum)}
                  className={`
                    shrink-0 flex flex-col items-center rounded-xl px-2 py-2 min-w-[46px]
                    transition-colors duration-100 cursor-pointer
                    ${isToday ? 'bg-teal-600 text-white' : 'bg-gray-50 text-[#6b6a66] hover:bg-gray-100'}
                  `}
                >
                  <span className="text-[11px] font-semibold">{day}</span>
                  <span className={`text-[9px] mt-1.5 rounded-full w-1.5 h-1.5 ${isToday ? 'bg-teal-300' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
          <div className="mt-3 text-[13px] text-[#6b6a66] text-center py-4">
            No jobs scheduled for this day
          </div>
        </div>

        {/* Savings goal */}
        <div className="bg-white rounded-2xl border border-[#D3D1C7] p-4 shadow-sm">
          <h2 className="text-[15px] font-bold text-[#1C1C1A] mb-3">Savings goal</h2>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[#1C1C1A]">No goal set yet</div>
              <div className="text-[12px] text-[#6b6a66]">Ask a parent to set one for you</div>
            </div>
          </div>
          {/* Progress track */}
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-0 bg-teal-500 rounded-full transition-all duration-500" />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[12px] text-[#6b6a66] tabular-nums">£0.00</span>
            <span className="text-[12px] text-[#6b6a66] tabular-nums">£0.00</span>
          </div>
        </div>
      </main>
    </div>
  )
}
