import React, { useEffect, useRef, useState } from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { LocateFixed, Search, ArrowLeft, Send } from 'lucide-react';
import { submitReport } from '../services/routeService';

const DEFAULT_CENTER = { lat: 10.9015, lng: 76.899 };
const box = { border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card)' };

// Shrink a phone photo to a ~1024 px JPEG data URL (the server accepts JPEG up to 500 KB)
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  for (const q of [0.8, 0.6, 0.4]) {
    const d = cv.toDataURL('image/jpeg', q);
    if (d.length < 600000) return d;
  }
  throw new Error('Photo is too large');
}

function PanTo({ target }) {
  const map = useMap();
  useEffect(() => { if (map && target) { map.panTo(target); map.setZoom(17); } }, [map, target]);
  return null;
}

// Street View at the chosen point; says so when Google has no imagery nearby
function StreetViewPane({ pos }) {
  const lib = useMapsLibrary('streetView');
  const el = useRef(null);
  const pano = useRef(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!lib || !el.current || !pos) return;
    if (!pano.current) pano.current = new lib.StreetViewPanorama(el.current, { addressControl: false, visible: false });
    let stale = false;
    setStatus('Looking for Street View…');
    new lib.StreetViewService().getPanorama({ location: pos, radius: 200, preference: 'nearest', source: 'outdoor' }, (data, st) => {
      if (stale) return;
      if (st === 'OK') {
        const c = data.location.latLng;
        // face the clicked point from the nearest panorama
        const heading = (Math.atan2((pos.lng - c.lng()) * Math.cos(pos.lat * Math.PI / 180), pos.lat - c.lat()) * 180) / Math.PI;
        pano.current.setPano(data.location.pano);
        pano.current.setPov({ heading, pitch: 0 });
        pano.current.setVisible(true);
        setStatus('');
      } else {
        pano.current.setVisible(false);
        setStatus('No Street View imagery within 200 m of this point.');
      }
    });
    return () => { stale = true; };
  }, [lib, pos]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={el} style={{ width: '100%', height: '100%' }} />
      {(status || !pos) && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16, textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text-body)' }}>
          {pos ? status : 'Pick a location to see Street View'}
        </div>
      )}
    </div>
  );
}

export default function ReportPage({ backendUrl, darkMode, onBack, initialCenter, token, onAuthExpired }) {
  const geocoding = useMapsLibrary('geocoding');
  const [pos, setPos] = useState(null);
  const [mode, setMode] = useState('');           // 'gps' | 'place'
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('pothole');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const useGps = () => {
    setMode('gps');
    if (!navigator.geolocation) { setMsg('This browser has no GPS. Use "Choose another place".'); return; }
    setMsg('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setMsg(`Located (±${Math.round(p.coords.accuracy)} m). Drag the pin if it is off.`); },
      (e) => setMsg(e.code === 1 ? 'Location permission denied. Turn GPS on / allow it, or choose another place.' : 'Could not get your location. Choose another place.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim() || !geocoding) return;
    setMsg('Searching…');
    try {
      const { results } = await new geocoding.Geocoder().geocode({ address: query });
      const l = results[0].geometry.location;
      setPos({ lat: l.lat(), lng: l.lng() });
      setMsg(`Found: ${results[0].formatted_address}. Drag the pin to the exact spot.`);
    } catch {
      setMsg('Place not found (or Geocoding API is not enabled on your key). You can also click the map.');
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      await submitReport(backendUrl, { ...pos, category, note, photo }, token);
      onBack(); // home refreshes reports on return
    } catch (e) {
      if (e.status === 401) onAuthExpired(); // token expired: back to the login form
      else setMsg(e.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn-secondary" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <h2 style={{ margin: 0 }}>Report a road hazard</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={mode === 'gps' ? 'btn-action-primary' : 'btn-secondary'} onClick={useGps}>
          <LocateFixed size={15} /> Use my current location
        </button>
        <button type="button" className={mode === 'place' ? 'btn-action-primary' : 'btn-secondary'} onClick={() => setMode('place')}>
          Choose another place
        </button>
        {mode === 'place' && (
          <form onSubmit={search} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 220 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Search a place or address" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="btn-secondary"><Search size={15} /></button>
          </form>
        )}
      </div>
      {msg && <div style={{ fontSize: '.9rem' }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ ...box, height: 380 }}>
          <Map className="picker-map" style={{ width: '100%', height: '100%' }} mapId="DEMO_MAP_ID" colorScheme={darkMode ? 'DARK' : 'LIGHT'}
            defaultCenter={initialCenter || DEFAULT_CENTER} defaultZoom={14} gestureHandling="greedy" clickableIcons={false}
            onClick={(e) => { if (e.detail?.latLng) { setPos(e.detail.latLng); if (!mode) setMode('place'); } }}>
            <PanTo target={pos} />
            {pos && (
              <AdvancedMarker position={pos} draggable title="Hazard location — drag to adjust"
                onDragEnd={(e) => setPos({ lat: e.latLng.lat(), lng: e.latLng.lng() })}>
                <div className="custom-pin-badge" style={{ background: '#8b5cf6' }} />
              </AdvancedMarker>
            )}
          </Map>
        </div>
        <div style={{ ...box, height: 380 }}><StreetViewPane pos={pos} /></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="pothole">Pothole</option>
          <option value="speedbreaker">Speed breaker</option>
        </select>
        <input className="form-input" style={{ flex: 1, minWidth: 200 }} maxLength={200} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {photo ? <img src={photo} alt="" style={{ height: 22, borderRadius: 3 }} /> : '📷'} {photo ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" capture="environment" hidden
            onChange={async (e) => { try { setPhoto(e.target.files[0] ? await shrink(e.target.files[0]) : ''); } catch (x) { setMsg(x.message); } }} />
        </label>
        <button type="button" className="btn-action-primary" disabled={!pos || busy} onClick={send}><Send size={15} /> Submit report</button>
      </div>
    </div>
  );
}
