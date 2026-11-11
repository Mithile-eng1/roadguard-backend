import React, { useState } from 'react';
import { authRequest, resendVerification } from '../services/routeService';

const TITLE = { login: 'Log in', signup: 'Create account', forgot: 'Forgot password', reset: 'Choose a new password' };

// modes: login | signup | forgot (asks for the email) | reset (arrived via the emailed link)
export default function AuthPage({ backendUrl, onAuth, onBack, reason, resetToken, onResetDone }) {
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // plain HTTP on a real host (localhost is fine): passwords would travel unencrypted
  const insecure = window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  const go = (m) => { setMode(m); setErr(''); setInfo(''); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setInfo('');
    try {
      if (mode === 'forgot') {
        const r = await authRequest(backendUrl, 'forgot', { email: f.email });
        setInfo(r.message);
      } else if (mode === 'reset') {
        await authRequest(backendUrl, 'reset', { token: resetToken, password: f.password });
        onResetDone();
        setF({ ...f, password: '' });
        go('login');
        setInfo('Password changed. Log in with your new password.');
      } else {
        const { token, name } = await authRequest(backendUrl, mode, f);
        onAuth({ token, name });
      }
    } catch (ex) {
      setErr(ex.message === 'Failed to fetch' ? 'Cannot reach the server. Is the backend running?' : ex.message);
    }
    setBusy(false);
  };

  const needsPw = mode !== 'forgot';
  const newPw = mode === 'signup' || mode === 'reset';
  return (
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 380, margin: '40px auto', display: 'grid', gap: 12, padding: 24, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--bg-card)' }}>
      <h2 style={{ margin: 0 }}>{TITLE[mode]}</h2>
      {reason && mode === 'login' && <div style={{ fontSize: '.9rem' }}>{reason}</div>}
      {insecure && mode !== 'forgot' && (
        <div role="note" style={{ fontSize: '.85rem', padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,.15)', border: '1px solid #f59e0b' }}>
          ⚠ This demo link is not encrypted (HTTP). Use a throwaway password you do not use anywhere else.
        </div>
      )}
      {mode === 'forgot' && <div style={{ fontSize: '.9rem' }}>Enter your account email and we will send a reset link.</div>}
      {mode === 'signup' && <input className="form-input" placeholder="Name" value={f.name} onChange={set('name')} required maxLength={50} autoComplete="name" />}
      {mode !== 'reset' && <input className="form-input" type="email" placeholder="Email" value={f.email} onChange={set('email')} required autoComplete="email" />}
      {needsPw && <input className="form-input" type="password" placeholder={newPw ? 'New password (8+ characters)' : 'Password'} value={f.password} onChange={set('password')} required minLength={newPw ? 8 : undefined} autoComplete={newPw ? 'new-password' : 'current-password'} />}
      {err && <div role="alert" style={{ color: '#ef4444', fontSize: '.9rem' }}>{err}</div>}
      {info && <div role="status" style={{ color: '#16a34a', fontSize: '.9rem' }}>{info}</div>}
      <button type="submit" className="btn-action-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Save new password' : TITLE[mode]}</button>
      {mode === 'login' && <button type="button" className="btn-secondary" onClick={() => go('forgot')}>Forgot password?</button>}
      {(mode === 'login' || mode === 'signup') && (
        <button type="button" className="btn-secondary" onClick={() => go(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? 'Have an account? Log in' : 'New here? Create an account'}
        </button>
      )}
      {mode === 'forgot' && <button type="button" className="btn-secondary" onClick={() => go('login')}>Back to log in</button>}
      <button type="button" className="btn-secondary" onClick={onBack}>Cancel</button>
    </form>
  );
}

// Shown instead of the report page until the emailed link has been opened
export function VerifyNotice({ backendUrl, token, email, onRefresh, onBack }) {
  const [msg, setMsg] = React.useState('');
  const resend = async () => {
    try { setMsg((await resendVerification(backendUrl, token)).message); } catch (e) { setMsg(e.message); }
  };
  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '40px auto', display: 'grid', gap: 12, padding: 24, border: '1px solid var(--border-color)', borderRadius: 16, background: 'var(--bg-card)' }}>
      <h2 style={{ margin: 0 }}>Verify your email</h2>
      <div>We sent a link to <b>{email || 'your email'}</b>. Open it, then come back and press the button below. Only verified accounts can report hazards.</div>
      {msg && <div role="status" style={{ fontSize: '.9rem' }}>{msg}</div>}
      <button type="button" className="btn-action-primary" onClick={onRefresh}>I have verified</button>
      <button type="button" className="btn-secondary" onClick={resend}>Resend email</button>
      <button type="button" className="btn-secondary" onClick={onBack}>Back</button>
    </div>
  );
}
