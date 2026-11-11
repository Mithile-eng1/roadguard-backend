import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Volume2, VolumeX, Navigation } from 'lucide-react';
import { useT, SPEECH_LANG } from '../services/i18n';
import { hazardsAhead, dueWarnings, safeSpeedKmh, withRouteKm, makeBumpDetector } from '../services/drive';
import { submitReport } from '../services/routeService';

// A sheet at the bottom so the map (with your moving dot) stays visible above it.
const sheet = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80, maxHeight: '48vh', overflowY: 'auto', background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 16px rgba(0,0,0,.4)' };
const card = { background: '#16213a', borderRadius: 12, padding: 12 };
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: '1rem', cursor: 'pointer', minHeight: 44 });

// Warnings while driving. The GPS position comes from the app-wide live feed (the same one that moves the
// dot on the map); this adds spoken + on-screen hazard warnings and "did you just hit a bump?" from the
// phone's motion sensor.
export default function DriveMode({ routeData, vehicle, auth, backendUrl, live, gpsError, tracking, onStartTracking, onStopTracking, onClose, onReported }) {
  const { t, lang } = useT();
  const line = routeData.routePolyline || [];
  const hazards = useMemo(() => withRouteKm(line, routeData.hazards || []), [routeData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState(true);
  const [info, setInfo] = useState(null);        // { offRoute, ahead, doneKm }
  const [sensor, setSensor] = useState('');       // '' | on | denied | unavailable
  const [bump, setBump] = useState(null);         // { lat, lng } while the prompt is open
  const [msg, setMsg] = useState('');
  const [alertText, setAlertText] = useState('');

  const r = useRef({ last: null, kmh: null, spoken: new Map(), detector: makeBumpDetector(), wake: null, voice: true, lang, motion: null, t });
  r.current.voice = voice; r.current.lang = lang; r.current.t = t; // always the current language, even mid-drive

  const speak = (text) => {
    if (!r.current.voice || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[r.current.lang] || 'en-IN';
    window.speechSynthesis.speak(u);
  };

  const onMotion = (ev) => {
    if (r.current.detector(ev, r.current.kmh) && r.current.last) setBump({ lat: r.current.last[0], lng: r.current.last[1] });
  };

  // every new GPS fix while driving: what is ahead, and anything to say
  useEffect(() => {
    if (!running || !live) return;
    const here = [live.lat, live.lng];
    r.current.kmh = live.speed;
    r.current.last = here;
    const res = hazardsAhead(line, hazards, here);
    setInfo(res);
    const clearance = vehicle?.groundClearance || 165;
    const tt = r.current.t;
    for (const w of dueWarnings(res.ahead, r.current.spoken)) {
      const v = safeSpeedKmh(w.h, clearance);
      const type = tt(`type.${w.h.category}`);
      const text = w.stage === 2 ? tt('drive.now', { type, v }) : tt('drive.ahead', { type, m: Math.round(w.distM / 10) * 10, v });
      setAlertText(text);
      speak(text);
    }
  }, [live, running]); // eslint-disable-line react-hooks/exhaustive-deps

  const release = () => {
    if (r.current.motion) window.removeEventListener('devicemotion', r.current.motion);
    r.current.motion = null;
    r.current.wake?.release?.().catch?.(() => {});
    r.current.wake = null;
    window.speechSynthesis?.cancel();
  };

  const start = async () => {
    setMsg('');
    onStartTracking();
    try {
      const DM = window.DeviceMotionEvent;
      if (!DM) throw new Error('none');
      if (typeof DM.requestPermission === 'function' && (await DM.requestPermission()) !== 'granted') throw new Error('denied'); // iPhone / new Chrome
      r.current.motion = onMotion;
      window.addEventListener('devicemotion', onMotion);
      setSensor('on');
    } catch (e) { setSensor(e.message === 'denied' ? 'denied' : 'unavailable'); }
    try { r.current.wake = await navigator.wakeLock?.request('screen'); } catch { /* screen may sleep: fine */ }
    setRunning(true);
  };

  const stop = () => { release(); onStopTracking(); setRunning(false); setInfo(null); };

  // tracking switched off from the map button: drive warnings stop too
  useEffect(() => { if (!tracking && running) { release(); setRunning(false); setInfo(null); } }, [tracking]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendBump = async (category) => {
    const spot = bump; setBump(null);
    if (!category) return;
    if (!auth || auth.verified === false) { setMsg(t('drive.needLogin')); return; }
    try {
      await submitReport(backendUrl, { lat: spot.lat, lng: spot.lng, category, status: 'present', note: 'phone jolt' }, auth.token);
      setMsg(t('drive.sent'));
      onReported?.();
    } catch (e) { setMsg(e.message); }
  };

  const next = info?.ahead?.[0];
  const kmh = live?.speed;
  const left = info && !info.offRoute && routeData.distanceKm != null ? Math.max(0, routeData.distanceKm - info.doneKm).toFixed(1) : null;
  const tType = (c) => t(`type.${c}`);

  return (
    <div style={sheet} role="dialog" aria-label={t('drive.title')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Navigation size={18} />
        <strong style={{ flex: 1 }}>{t('drive.title')}</strong>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700 }} data-testid="speed">{kmh == null ? '--' : Math.round(kmh)}</span>
          <span style={{ opacity: 0.7 }}> {t('drive.kmh')}</span>
        </div>
        <button type="button" style={{ ...btn('#16213a'), padding: 8, minHeight: 36 }} aria-label={t('drive.close')} onClick={() => { stop(); onClose(); }}><X size={18} /></button>
      </div>

      <div style={card} data-testid="drive-status" aria-live="polite">
        {gpsError ? t('map.gpsDenied')
          : !running ? t('drive.safety')
          : info == null ? t('drive.gps')
          : info.offRoute ? t('drive.offRoute')
          : next ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{tType(next.h.category)} · {Math.max(0, next.distM)} m</div>
              <div style={{ opacity: 0.8 }}>{t('drive.now', { type: tType(next.h.category), v: safeSpeedKmh(next.h, vehicle?.groundClearance || 165) })}</div>
            </div>
          ) : t('drive.nextNone')}
        {left != null && <div style={{ opacity: 0.7, marginTop: 4 }} data-testid="km-left">{t('drive.left', { km: left })}</div>}
      </div>

      {alertText && running && <div style={{ ...card, background: '#7c2d12' }} role="alert" data-testid="last-warning">{alertText}</div>}

      {bump && (
        <div style={{ ...card, background: '#1e3a8a' }} role="alertdialog" data-testid="bump-prompt">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('drive.bump')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn('#d97706')} onClick={() => sendBump('speedbreaker')}>{t('drive.bumpSb')}</button>
            <button type="button" style={btn('#dc2626')} onClick={() => sendBump('pothole')}>{t('drive.bumpPh')}</button>
            <button type="button" style={btn('#475569')} onClick={() => sendBump(null)}>{t('drive.bumpNone')}</button>
          </div>
        </div>
      )}
      {msg && <div style={card} role="status">{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!running
          ? <button type="button" style={btn('#16a34a')} onClick={start}>{t('drive.start')}</button>
          : <button type="button" style={btn('#b91c1c')} onClick={stop}>{t('drive.stop')}</button>}
        <button type="button" style={btn('#16213a')} onClick={() => { setVoice(!voice); if (voice) window.speechSynthesis?.cancel(); }} aria-pressed={voice}>
          {voice ? <Volume2 size={16} /> : <VolumeX size={16} />} {t('drive.voice')}
        </button>
        <span style={{ opacity: 0.7, fontSize: '.85rem' }}>{running ? (sensor === 'on' ? t('drive.sensor') : sensor === 'denied' ? t('drive.sensorDenied') : sensor === 'unavailable' ? t('drive.noSensor') : '') : ''}</span>
      </div>
    </div>
  );
}
