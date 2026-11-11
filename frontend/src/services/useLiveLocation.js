import { useEffect, useState } from 'react';
import { distM } from './risk.js';
import { bearing } from './drive.js';

// One GPS feed for the whole app (the moving dot on the map AND drive-mode warnings).
// fix = { lat, lng, acc (m), speed (km/h or null), heading (deg or null), t (ms) }
export function useLiveLocation(active) {
  const [fix, setFix] = useState(null);
  const [error, setError] = useState('');   // '' | denied | unavailable

  useEffect(() => {
    if (!active) { setFix(null); setError(''); return undefined; }
    if (!navigator.geolocation) { setError('unavailable'); return undefined; }
    let last = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        const pos = [p.coords.latitude, p.coords.longitude];
        const moved = last ? distM(last.pos, pos) : 0;
        // the phone often gives no speed/heading: work them out from the last two positions
        let speed = p.coords.speed != null ? p.coords.speed * 3.6 : null;
        if (speed == null && last && now > last.t) speed = (moved / ((now - last.t) / 1000)) * 3.6;
        if (speed != null && speed > 250) speed = null; // a GPS jump, not real driving: do not show or use it
        let heading = p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null;
        if (heading == null && last && moved > 3) heading = bearing(last.pos, pos);
        else if (heading == null && last?.heading != null) heading = last.heading; // standing still: keep pointing the same way
        last = { pos, t: now, heading };
        setFix({ lat: pos[0], lng: pos[1], acc: p.coords.accuracy, speed, heading, t: now });
        setError('');
      },
      (e) => setError(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return { fix, error };
}
