import React, { useState } from 'react';
import { X, Settings, Server, Check, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { checkBackend } from '../services/routeService';

export default function SettingsModal({ isOpen, onClose, apiConfig, setApiConfig, backendOnline, onTestConnection }) {
  // Remount on open (see App: rendered only when open) so local state starts from saved config
  if (!isOpen) return null;
  return <SettingsForm onClose={onClose} apiConfig={apiConfig} setApiConfig={setApiConfig} backendOnline={backendOnline} onTestConnection={onTestConnection} />;
}

function SettingsForm({ onClose, apiConfig, setApiConfig, backendOnline, onTestConnection }) {
  const [backendUrl, setBackendUrl] = useState(apiConfig.backendUrl || '');
  const [useLiveApi, setUseLiveApi] = useState(apiConfig.useLiveApi ?? true);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState(null); // null | 'testing' | true | false

  const handleTest = async () => {
    setTestState('testing');
    setTestState(await checkBackend(backendUrl));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setApiConfig({ backendUrl: backendUrl.trim(), useLiveApi });
    setSaved(true);
    setTimeout(() => {
      onTestConnection?.();
      onClose();
    }, 600);
  };

  const status = testState ?? backendOnline;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <Settings size={20} className="text-primary" />
            <h3 className="modal-title">Settings</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-form-body">
          <div className="toggle-row-item">
            <div className="toggle-text">
              <strong>Use the analysis server</strong>
              <p>On: real Street View frames and detection (needs api_server.py running). Off: instant demo with sample frames, no server needed.</p>
            </div>
            <label className="switch-control">
              <input type="checkbox" checked={useLiveApi} onChange={(e) => setUseLiveApi(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="backend-url">
              <Server size={16} className="text-muted" />
              Server URL
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
                <span>Test</span>
              </button>
            </div>
            <span className={`input-helper-text conn-status ${status === true ? 'conn-ok' : status === false ? 'conn-bad' : ''}`}>
              {status === 'testing' ? 'Checking…'
                : status === true ? <><Wifi size={12} /> Connected</>
                : status === false ? <><WifiOff size={12} /> Not reachable — run <code>python api_server.py</code></>
                : 'Leave empty when the server runs on this machine.'}
            </span>
          </div>

          <div className="modal-actions-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-action-primary">
              {saved ? <><Check size={16} /><span>Saved!</span></> : <span>Save Settings</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
