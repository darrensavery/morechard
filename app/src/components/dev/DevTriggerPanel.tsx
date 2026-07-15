// app/src/components/dev/DevTriggerPanel.tsx
// Dev-only floating panel for testing celebration overlays and trigger states.
// Mount once in ChildDashboard.tsx: {import.meta.env.DEV && <DevTriggerPanel childId={userId} />}

import { useState, useCallback } from 'react'
import { queueCelebration } from '../celebration'
import type { MilestoneEventType } from '../celebration/types'
import { CONFIGS } from '../celebration/registry'
import { apiUrl, authHeaders } from '../../lib/api'

interface TriggerStatus {
  unlocked:         string[]
  badges:           string[]
  streak:           number
  longestStreak:    number
  lifetimeEarnings: number
  balance:          number
}

const ALL_EVENT_TYPES = Object.keys(CONFIGS) as MilestoneEventType[]

const APPVIEW_OPTIONS = ['ORCHARD', 'CLEAN'] as const
type AppViewOption = typeof APPVIEW_OPTIONS[number]

export function DevTriggerPanel({ childId }: { childId: string }) {
  const [open,     setOpen]     = useState(false)
  const [tab,      setTab]      = useState<'overlays' | 'status'>('overlays')
  const [appView,  setAppView]  = useState<AppViewOption>('ORCHARD')
  const [status,   setStatus]   = useState<TriggerStatus | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const flashFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  const fireOverlay = useCallback((type: MilestoneEventType) => {
    queueCelebration({ type, appView })
    flashFeedback(`Queued: ${type}`)
    // Reload the page so ChildDashboard picks up the queue on next render cycle
    setTimeout(() => window.location.reload(), 100)
  }, [appView])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        apiUrl(`/dev/trigger-status?child_id=${childId}`),
        { headers: await authHeaders() }
      )
      if (!res.ok) throw new Error(`${res.status}`)
      setStatus(await res.json() as TriggerStatus)
      setTab('status')
    } catch (e) {
      flashFeedback(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [childId])

  const runPassive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        apiUrl(`/dev/run-passive?child_id=${childId}`),
        { method: 'POST', headers: await authHeaders() }
      )
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json() as { ok: boolean; newlyUnlocked: string[] }
      flashFeedback(
        data.newlyUnlocked.length
          ? `Unlocked: ${data.newlyUnlocked.join(', ')}`
          : 'No new unlocks'
      )
      await fetchStatus()
    } catch (e) {
      flashFeedback(`Error: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [childId, fetchStatus])

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 12, zIndex: 9999 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev Trigger Panel"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#7c3aed', color: '#fff', fontSize: 18,
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        🔬
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 320, maxHeight: '70vh', overflowY: 'auto',
          background: '#1a1a2e', color: '#e0e0ff',
          borderRadius: 12, padding: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          fontFamily: 'monospace', fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#a78bfa' }}>
            ⚗️ Dev Trigger Panel
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['overlays', 'status'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '4px 0',
                background: tab === t ? '#7c3aed' : '#2d2d4e',
                color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}>
                {t === 'overlays' ? '🎉 Overlays' : '📊 Status'}
              </button>
            ))}
          </div>

          {tab === 'overlays' && (
            <>
              {/* appView toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {APPVIEW_OPTIONS.map(v => (
                  <button key={v} onClick={() => setAppView(v)} style={{
                    flex: 1, padding: '3px 0',
                    background: appView === v ? '#0d9488' : '#2d2d4e',
                    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}>
                    {v}
                  </button>
                ))}
              </div>

              {/* Event buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ALL_EVENT_TYPES.map(type => (
                  <button key={type} onClick={() => fireOverlay(type)} style={{
                    padding: '4px 8px',
                    background: '#2d2d4e', color: '#a78bfa',
                    border: '1px solid #4c4c7f', borderRadius: 6,
                    cursor: 'pointer', fontSize: 11,
                  }}>
                    {type}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'status' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={fetchStatus} disabled={loading} style={{
                  flex: 1, padding: '4px 0',
                  background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                  {loading ? '…' : '↻ Refresh'}
                </button>
                <button onClick={runPassive} disabled={loading} style={{
                  flex: 1, padding: '4px 0',
                  background: '#059669', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                  {loading ? '…' : '▶ Run Passive'}
                </button>
              </div>

              {status ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Balance: </span>
                    £{(status.balance / 100).toFixed(2)}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Lifetime: </span>
                    £{(status.lifetimeEarnings / 100).toFixed(2)}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Streak: </span>
                    {status.streak} (longest: {status.longestStreak})
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Unlocked modules ({status.unlocked.length}): </span>
                    <br />
                    {status.unlocked.length
                      ? status.unlocked.map(m => (
                          <span key={m} style={{
                            display: 'inline-block', margin: '2px',
                            padding: '1px 5px', background: '#064e3b',
                            color: '#6ee7b7', borderRadius: 4,
                          }}>{m}</span>
                        ))
                      : <span style={{ color: '#64748b' }}>none</span>}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Badges ({status.badges.length}): </span>
                    <br />
                    {status.badges.length
                      ? status.badges.map(b => (
                          <span key={b} style={{
                            display: 'inline-block', margin: '2px',
                            padding: '1px 5px', background: '#451a03',
                            color: '#fbbf24', borderRadius: 4,
                          }}>{b}</span>
                        ))
                      : <span style={{ color: '#64748b' }}>none</span>}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Click Refresh to load status</div>
              )}
            </>
          )}

          {feedback && (
            <div style={{
              marginTop: 10, padding: '6px 10px',
              background: '#134e4a', color: '#6ee7b7',
              borderRadius: 6, fontSize: 11,
            }}>
              {feedback}
            </div>
          )}

          <div style={{ marginTop: 10, color: '#475569', fontSize: 10 }}>
            child: {childId.slice(0, 20)}…
          </div>
        </div>
      )}
    </div>
  )
}
