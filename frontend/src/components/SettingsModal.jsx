import React, { useState } from 'react';
import { X, Settings, Server, Check, Wifi, WifiOff, Loader2, Download, Trash2, RotateCcw, LogOut, FileText } from 'lucide-react';
import { checkBackend } from '../services/routeService';
import { useT, LANGS } from '../services/i18n';
import { WARN_DISTANCES } from '../services/prefs';

export default function SettingsModal(props) {
  // Remount on open (see App: rendered only when open) so the connection fields start from the saved config
  if (!props.isOpen) return null;
  return <SettingsForm {...props} />;
}

function Section({ title, children }) {
  return (
    <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 14 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.7 }}>{title}</h4>
      <div style={{ display: 'grid', gap: 14 }}>{children}</div>
    </section>
  );
}

function Switch({ checked, onChange, label, help, disabled }) {
  return (
    <div className="toggle-row-item">
      <div className="toggle-text">
        <strong>{label}</strong>
        {help && <p>{help}</p>}
      </div>
      <label className="switch-control">
        <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="slider round"></span>
      </label>
    </div>
  );
}

// A row of buttons where exactly one is selected (text size, sensitivity, warning distance)
function Choice({ label, value, options, onChange }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} className={`filter-tab-btn ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function SettingsForm({
  onClose, apiConfig, setApiConfig, backendOnline, onTestConnection,
  prefs, setPref, resetPrefs, darkMode, setDarkMode, auth, onLogout, onOpenMine, onOpenLogin,
  historyCount, onClearHistory, canInstall, installed, onInstall,
}) {
  const { t, lang, setLang } = useT();
  const [backendUrl, setBackendUrl] = useState(apiConfig.backendUrl || '');
  const [useLiveApi, setUseLiveApi] = useState(apiConfig.useLiveApi ?? true);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState(null); // null | 'testing' | true | false

  const handleTest = async () => {
    setTestState('testing');
    setTestState(await checkBackend(backendUrl));
  };

  const saveConnection = () => {
    setApiConfig({ backendUrl: backendUrl.trim(), useLiveApi });
    setSaved(true);
    setTimeout(() => { setSaved(false); onTestConnection?.(); }, 800);
  };

  const status = testState ?? backendOnline;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('set.title')}>
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <Settings size={20} className="text-primary" />
            <h3 className="modal-title">{t('set.title')}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label={t('drive.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-scrollable" style={{ paddingBottom: 8 }}>
          <Section title={t('set.sec.look')}>
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>{t('set.language')}</strong>
              <select className="form-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('set.language')}>
                {LANGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <Switch label={t('set.dark')} checked={darkMode} onChange={setDarkMode} />
            <Choice label={t('set.textSize')} value={prefs.textSize} onChange={(v) => setPref('textSize', v)}
              options={[['normal', t('set.size.normal')], ['large', t('set.size.large')], ['xl', t('set.size.xl')]]} />
          </Section>

          <Section title={t('set.sec.drive')}>
            <Switch label={t('set.voice')} help={t('set.voiceHelp')} checked={prefs.voice} onChange={(v) => setPref('voice', v)} />
            <Choice label={t('set.warnDist')} value={prefs.warnDist} onChange={(v) => setPref('warnDist', v)}
              options={WARN_DISTANCES.map((m) => [m, `${m} m`])} />
            <Switch label={t('set.bump')} help={t('set.bumpHelp')} checked={prefs.bump} onChange={(v) => setPref('bump', v)} />
            <Choice label={t('set.sens')} value={prefs.sens} onChange={(v) => setPref('sens', v)}
              options={[['low', t('set.sens.low')], ['normal', t('set.sens.normal')], ['high', t('set.sens.high')]]} />
          </Section>

          <Section title={t('set.sec.account')}>
            {auth ? (
              <>
                <div data-testid="settings-account">
                  <strong>{auth.name}</strong>
                  {auth.email && <div style={{ opacity: 0.8 }}>{auth.email}</div>}
                  {auth.verified !== undefined && (
                    <div style={{ fontSize: '.85rem', color: auth.verified === false ? '#b45309' : '#15803d' }}>
                      {auth.verified === false ? t('set.unverified') : t('set.verified')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary btn-sm" onClick={onOpenMine}><FileText size={14} /> {t('nav.myReports')}</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={onLogout}><LogOut size={14} /> {t('nav.logout')}</button>
                </div>
              </>
            ) : (
              <>
                <div>{t('set.notLoggedIn')}</div>
                <div><button type="button" className="btn-secondary btn-sm" onClick={onOpenLogin}>{t('nav.login')}</button></div>
              </>
            )}
          </Section>

          <Section title={t('set.sec.app')}>
            {installed ? <div data-testid="install-status">✓ {t('set.installed')}</div>
              : canInstall ? <div><button type="button" className="btn-action-primary btn-sm" onClick={onInstall}><Download size={14} /> {t('set.install')}</button></div>
              : <div data-testid="install-status" style={{ opacity: 0.8, fontSize: '.9rem' }}>{t('set.installHint')}</div>}
          </Section>

          <Section title={t('set.sec.data')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary btn-sm" disabled={historyCount === 0}
                onClick={() => { if (window.confirm(t('set.confirmClear'))) onClearHistory(); }}>
                <Trash2 size={14} /> {t('set.clearHistory', { n: historyCount })}
              </button>
              <button type="button" className="btn-secondary btn-sm"
                onClick={() => { if (window.confirm(t('set.confirmReset'))) resetPrefs(); }}>
                <RotateCcw size={14} /> {t('set.resetAll')}
              </button>
            </div>
          </Section>

          <Section title={t('set.sec.conn')}>
            <div className="toggle-row-item">
              <div className="toggle-text">
                <strong>{t('set.useServer')}</strong>
                <p>On: real Street View frames and detection (needs api_server.py running). Off: instant demo with sample frames, no server needed.</p>
              </div>
              <label className="switch-control">
                <input type="checkbox" role="switch" aria-label={t('set.useServer')} checked={useLiveApi} onChange={(e) => setUseLiveApi(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="backend-url">
                <Server size={16} className="text-muted" />
                {t('set.serverUrl')}
              </label>
              <div className="input-row-with-btn">
                <input
                  id="backend-url"
                  type="url"
                  className="form-input"
                  value={backendUrl}
                  onChange={(e) => { setBackendUrl(e.target.value); setTestState(null); }}
                  placeholder="Leave empty to use the dev proxy (localhost:8000)"
                  disabled={!useLiveApi}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={handleTest} disabled={!useLiveApi || testState === 'testing'}>
                  {testState === 'testing' ? <Loader2 size={14} className="icon-spin-subtle" /> : <Wifi size={14} />}
                  <span>{t('set.test')}</span>
                </button>
              </div>
              <span className={`input-helper-text conn-status ${status === true ? 'conn-ok' : status === false ? 'conn-bad' : ''}`}>
                {status === 'testing' ? 'Checking…'
                  : status === true ? <><Wifi size={12} /> Connected</>
                  : status === false ? <><WifiOff size={12} /> Not reachable — run <code>python api_server.py</code></>
                  : 'Leave empty when the server runs on this machine.'}
              </span>
            </div>
            <div>
              <button type="button" className="btn-action-primary btn-sm" onClick={saveConnection}>
                {saved ? <><Check size={14} /> {t('set.saved')}</> : t('set.saveConn')}
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
