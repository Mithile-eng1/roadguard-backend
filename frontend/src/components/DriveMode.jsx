import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Volume2, VolumeX, Navigation } from 'lucide-react';
import { useT, SPEECH_LANG } from '../services/i18n';
import { distM } from '../services/risk';
import { hazardsAhead, dueWarnings, safeSpeedKmh, withRouteKm, makeBumpDetector } from '../services/drive';
import { submitReport } from '../services/routeService';

const panel = { position: 'fixed', inset: 0, zIndex: 80, background: '#0b1220', color: '#fff', display: 'flex', flexDirection: 'column', gap: 14, padding: 16, overflowY: 'auto' };
const card = { background: '#16213a', borderRadius: 14, padding: 14 };
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: '1rem', cursor: 'pointer', minHeight: 44 });

// Live help while driving: GPS position on the route, spoken + on-screen warnings, and
// "did you just hit a bump?" from the phone's motion sensor.
export default function DriveMode({ routeData, vehicle, auth, backendUrl, onClose, onReported }) {
  const { t, lang } = useT();
  const line = routeData.routePolyline || [];
  const hazards = useMemo(() => withRouteKm(line, routeData.hazards || []), [routeData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState(true);
  const [kmh, setKmh] = useState(null);
  const [info, setInfo] = useState(null);        // { offRoute, ahead }
  const [sensor, setSensor] = useState('');       // '' | on | unavailable
  const [bump, setBump] = useState(null);         // { lat, lng } while the prompt is open
  const [msg, setMsg] = useState('');
  const [alertText, setAlertText] = useState('');

  const r = useRef({ watch: null, last: null, kmh: null, spoken: new Map(), detector: makeBumpDetector(), wake: null, voice: true, lang, motion: null, t });
  r.current.voice = voice; r.current.lang = lang; r.current.t = t; // always the current language, even mid-drive

  const speak = (text) => {
    if (!r.current.voice || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[r.current.lang] || 'en-IN';
    window.speechSynthesis.speak(u);
  };

  const onPosition = (p) => {
    const here = [p.coords.latitude, p.coords.longitude];
    const now = Date.now();
    let speed = p.coords.speed != null ? p.coords.speed * 3.6 : null;
    const prev = r.current.last;
    if (speed == null && prev && now > prev.t) speed = (distM(prev.pos, here) / ((now - prev.t) / 1000)) * 3.6; // GPS gave no speed: estimate
    r.current.last = { pos: here, t: now };
    r.current.kmh = speed;
    setKmh(speed);

    const res = hazardsAhead(line, hazards, here);
    setInfo(res);
    const clearance = vehicle?.groundClearance || 165;
    for (const w of dueWarnings(res.ahead, r.current.spoken)) {
      const v = safeSpeedKmh(w.h, clearance);
      const tt = r.current.t;
      const type = tt(`type.${w.h.category}`);
      const text = w.stage === 2 ? tt('drive.now', { type, v }) : tt('drive.ahead', { type, m: Math.round(w.distM / 10) * 10, v });
      setAlertText(text);
      speak(text);
    }
  };
  const translateType = (c) => t(`type.${c}`);

  const onMotion = (ev) => {
    if (r.current.detector(ev, r.current.kmh) && r.current.last) {
      setBump({ lat: r.current.last.pos[0], lng: r.current.last.pos[1] });
    }
  };

  const start = async () => {
    setMsg('');
    if (!navigator.geolocation) { setMsg(t('drive.gps')); return; }
    r.current.watch = navigator.geolocation.watchPosition(onPosition, () => setMsg(t('drive.gps')), { enableHighAccuracy: true, maximumAge: 1000 });
    try {
      const DM = window.DeviceMotionEvent;
      if (!DM) throw new Error('none');
      if (typeof DM.requestPermission === 'function' && (await DM.requestPermission()) !== 'granted') throw new Error('denied'); // iPhone
      r.current.motion = onMotion;
      window.addEventListener('devicemotion', onMotion);
      setSensor('on');
    } catch (e) { setSensor(e.message === 'denied' ? 'denied' : 'unavailable'); }
    try { r.current.wake = await navigator.wakeLock?.request('screen'); } catch { /* screen may sleep: fine */ }
    setRunning(true);
  };

  const stop = () => {
    if (r.current.watch != null) navigator.geolocation.clearWatch(r.current.watch);
    r.current.watch = null;
    if (r.current.motion) window.removeEventListener('devicemotion', r.current.motion);
    r.current.motion = null;
    r.current.wake?.release?.().catch?.(() => {});
    window.speechSynthesis?.cancel();
    setRunning(false);
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  return (
    <div style={panel} role="dialog" aria-label={t('drive.title')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Navigation size={20} />
        <h2 style={{ margin: 0, flex: 1 }}>{t('drive.title')}</h2>
        <button type="button" style={{ ...btn('#16213a'), padding: 10 }} aria-label={t('drive.close')} onClick={() => { stop(); onClose(); }}><X size={20} /></button>
      </div>

      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: '3.2rem', fontWeight: 700 }} data-testid="speed">{kmh == null ? '--' : Math.round(kmh)}</div>
        <div style={{ opacity: 0.7 }}>{t('drive.kmh')}</div>
      </div>

      <div style={card} data-testid="drive-status" aria-live="polite">
        {!running ? t('drive.safety')
          : info == null ? t('drive.gps')
          : info.offRoute ? t('drive.offRoute')
          : next ? (
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>{translateType(next.h.category)} · {Math.max(0, next.distM)} m</div>
              <div style={{ opacity: 0.8 }}>{t('drive.now', { type: translateType(next.h.category), v: safeSpeedKmh(next.h, vehicle?.groundClearance || 165) })}</div>
            </div>
          ) : t('drive.nextNone')}
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!running
          ? <button type="button" style={btn('#16a34a')} onClick={start}>{t('drive.start')}</button>
          : <button type="button" style={btn('#b91c1c')} onClick={stop}>{t('drive.stop')}</button>}
        <button type="button" style={btn('#16213a')} onClick={() => { setVoice(!voice); if (voice) window.speechSynthesis?.cancel(); }} aria-pressed={voice}>
          {voice ? <Volume2 size={16} /> : <VolumeX size={16} />} {t('drive.voice')}
        </button>
      </div>
      {running && <div style={{ opacity: 0.7, fontSize: '.85rem' }}>{sensor === 'on' ? t('drive.sensor') : sensor === 'denied' ? t('drive.sensorDenied') : sensor === 'unavailable' ? t('drive.noSensor') : ''}</div>}

      <div style={{ opacity: 0.8 }}>
        <b>{t('drive.hazards')}: {hazards.length}</b>
      </div>
    </div>
  );
}
