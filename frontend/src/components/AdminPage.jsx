import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { adminReports, adminUsers, adminBan, deleteReport } from '../services/routeService';
import { clusterReports } from '../services/risk';

const cell = { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' };
const stat = { padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--bg-card)' };

// Moderation: every report (with the reporter's email), every account, delete + block controls.
export default function AdminPage({ backendUrl, token, onBack, onChanged }) {
  const [reports, setReports] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('reports');
  const [err, setErr] = useState('');

  const load = () => Promise.all([adminReports(backendUrl, token), adminUsers(backendUrl, token)])
    .then(([r, u]) => { setReports(r.sort((a, b) => b.ts - a.ts)); setUsers(u); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn) => { try { await fn(); await load(); onChanged(); } catch (e) { setErr(e.message); } };
  const base = backendUrl.replace(/\/$/, '');

  const blocked = new Set(users.filter((u) => u.banned).map((u) => u.email));
  const live = (reports || []).filter((r) => !blocked.has(r.email) && Date.now() / 1000 - r.ts < 60 * 86400);
  const clusters = clusterReports(live);

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <h2 style={{ margin: 0 }}>Admin</h2>
      </div>
      {err && <div role="alert" style={{ color: '#ef4444' }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div style={stat}><b>{users.length}</b><div>accounts</div></div>
        <div style={stat}><b>{users.filter((u) => !u.verified).length}</b><div>unverified</div></div>
        <div style={stat}><b>{blocked.size}</b><div>blocked</div></div>
        <div style={stat}><b>{reports?.length ?? '…'}</b><div>reports stored</div></div>
        <div style={stat}><b>{clusters.filter((c) => c.confirmed).length}</b><div>confirmed hazards</div></div>
        <div style={stat}><b>{clusters.filter((c) => c.fixed).length}</b><div>marked fixed</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={tab === 'reports' ? 'btn-action-primary' : 'btn-secondary'} onClick={() => setTab('reports')}>Reports</button>
        <button type="button" className={tab === 'users' ? 'btn-action-primary' : 'btn-secondary'} onClick={() => setTab('users')}>Users</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {tab === 'reports' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead><tr><th style={cell}>Date</th><th style={cell}>User</th><th style={cell}>What</th><th style={cell}>Where</th><th style={cell}>Note</th><th style={cell}>Photo</th><th style={cell}></th></tr></thead>
            <tbody>
              {(reports || []).map((r) => (
                <tr key={r.id} style={blocked.has(r.email) ? { opacity: 0.5 } : undefined}>
                  <td style={cell}>{new Date(r.ts * 1000).toLocaleString()}</td>
                  <td style={cell}>{r.email}</td>
                  <td style={cell}>{r.category === 'pothole' ? 'Pothole' : 'Speed breaker'} · {r.status === 'gone' ? 'fixed' : 'present'}</td>
                  <td style={cell}><a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</a></td>
                  <td style={cell}>{r.note || '—'}</td>
                  <td style={cell}>{r.photo ? <a href={base + r.photo} target="_blank" rel="noreferrer"><img src={base + r.photo} alt="" style={{ height: 36, borderRadius: 4 }} /></a> : '—'}</td>
                  <td style={cell}><button type="button" className="btn-secondary btn-sm" title="Delete report"
                    onClick={() => window.confirm('Delete this report?') && act(() => deleteReport(backendUrl, token, r.id))}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead><tr><th style={cell}>Name</th><th style={cell}>Email</th><th style={cell}>Verified</th><th style={cell}>Reports</th><th style={cell}>Status</th><th style={cell}></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td style={cell}>{u.name}{u.isAdmin ? ' (admin)' : ''}</td>
                  <td style={cell}>{u.email}</td>
                  <td style={cell}>{u.verified ? 'yes' : 'no'}</td>
                  <td style={cell}>{u.reports}</td>
                  <td style={cell}>{u.banned ? 'blocked' : 'active'}</td>
                  <td style={cell}>{!u.isAdmin && (
                    <button type="button" className="btn-secondary btn-sm"
                      onClick={() => act(() => adminBan(backendUrl, token, u.email, !u.banned))}>{u.banned ? 'Unblock' : 'Block'}</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
