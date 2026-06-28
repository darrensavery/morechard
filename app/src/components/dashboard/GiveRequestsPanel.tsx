import { useEffect, useRef, useState } from 'react';
import { getGiveRequests, patchGiveRequest, type GiveRequest } from '../../lib/api';

interface Props {
  familyId:      string;
  onCountChange?: (n: number) => void;
}

function fmt(pence: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}

function fmtDate(epochSec: number) {
  return new Date(epochSec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function GiveRequestsPanel({ familyId, onCountChange }: Props) {
  const [requests,    setRequests]    = useState<GiveRequest[]>([]);
  const [history,     setHistory]     = useState<GiveRequest[]>([]);
  const [noteMap,     setNoteMap]     = useState<Record<number, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy,        setBusy]        = useState<number | null>(null);
  const onCountChangeRef              = useRef(onCountChange);
  useEffect(() => { onCountChangeRef.current = onCountChange; }, [onCountChange]);

  function refresh() {
    getGiveRequests(familyId, 'requested').then(({ give_requests }) => {
      setRequests(give_requests);
      onCountChangeRef.current?.(give_requests.length);
    }).catch(() => {});
    getGiveRequests(familyId, 'all').then(({ give_requests }) =>
      setHistory(give_requests.filter(r => r.status !== 'requested'))
    ).catch(() => {});
  }

  useEffect(() => {
    refresh();
    const t = setInterval(() => refresh(), 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  async function resolve(id: number, action: 'fulfil' | 'decline') {
    setBusy(id);
    try {
      await patchGiveRequest(id, action, noteMap[id]);
    } catch { /* non-fatal */ }
    finally {
      // BUG-043 fix: always refresh in finally so a failed PATCH (co-parent beat us,
      // network error) still removes the stale card rather than leaving it frozen.
      setBusy(null);
      refresh();
    }
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 24, fontFamily: 'Manrope' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Gift requests
      </div>

      {requests.length === 0 ? (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', padding: '12px 0' }}>No pending gift requests.</div>
      ) : (
        requests.map(r => (
          <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{r.child_name}</span>
              <span style={{ color: '#d97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount, r.currency)}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 4 }}>"{r.cause}"</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 }}>{fmtDate(r.requested_at)}</div>
            <input
              type="text" placeholder="Add a note (optional)"
              value={noteMap[r.id] ?? ''}
              onChange={e => setNoteMap(prev => ({ ...prev, [r.id]: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => resolve(r.id, 'fulfil')} disabled={busy === r.id}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: '#d97706', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>
                {busy === r.id ? '…' : 'Done — donated'}
              </button>
              <button onClick={() => resolve(r.id, 'decline')} disabled={busy === r.id}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', fontSize: 13, cursor: 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>
                Decline
              </button>
            </div>
          </div>
        ))
      )}

      {history.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', padding: '8px 0', fontFamily: 'Manrope' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: historyOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
            History ({history.length})
          </button>
          {historyOpen && history.map(r => (
            <div key={r.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)', opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{r.child_name}</span>
                <span style={{ color: r.status === 'fulfilled' ? '#34d399' : '#f87171', fontSize: 12, fontWeight: 600 }}>
                  {r.status === 'fulfilled' ? 'Donated' : 'Declined'}
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>"{r.cause}" · {fmt(r.amount, r.currency)}</div>
              {r.parent_note && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>Note: {r.parent_note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
