import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { fetchMyReports, deleteReport } from '../services/routeService';

const TTL_DAYS = 60; // keep in step with REPORT_TTL_DAYS on the server
const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' };

export default function MyReportsPage({ backendUrl, token, onBack, onChanged, onAuthExpired }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = () => fetchMyReports(backendUrl, token).then((r) => setRows(r.sort((a, b) => b.ts - a.ts)))
    .catch((e) => (e.status === 401 ? onAuthExpired() : setErr(e.message)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try { await deleteReport(backendUrl, token, id); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };

  const base = backendUrl.replace(/\/$/, '');
  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <h2 style={{ margin: 0 }}>My reports</h2>
      </div>
      {err && <div role="alert" style={{ color: '#ef4444' }}>{err}</div>}
      {rows === null ? <div>Loading…</div> : rows.length === 0 ? <div>You have not reported anything yet.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead><tr><th style={cell}>Date</th><th style={cell}>What</th><th style={cell}>Where</th><th style={cell}>Note</th><th style={cell}>Photo</th><th style={cell}></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const expired = Date.now() / 1000 - r.ts > TTL_DAYS * 86400;
                return (
                  <tr key={r.id} style={expired ? { opacity: 0.55 } : undefined}>
                    <td data-label="Date" style={cell}>{new Date(r.ts * 1000).toLocaleDateString()}{expired ? ' (expired)' : ''}</td>
                    <td data-label="What" style={cell}>{r.category === 'pothole' ? 'Pothole' : 'Speed breaker'} · {r.status === 'gone' ? 'fixed' : 'present'}</td>
                    <td data-label="Where" style={cell}><a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</a></td>
                    <td data-label="Note" style={cell}>{r.note || '—'}</td>
                    <td data-label="Photo" style={cell}>{r.photo ? <a href={base + r.photo} target="_blank" rel="noreferrer"><img src={base + r.photo} alt="" style={{ height: 36, borderRadius: 4 }} /></a> : '—'}</td>
                    <td data-label="" style={cell}><button type="button" className="btn-secondary btn-sm" onClick={() => remove(r.id)} title="Delete"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
