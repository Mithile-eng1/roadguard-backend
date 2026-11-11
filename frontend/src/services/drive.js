// Drive mode helpers: what is ahead on the route, when to warn, safe speeds, bump detection.
import { alongRoute } from './risk.js';

// Compass direction (0-360, 0 = north) of travel from point a to point b, both [lat, lng]
export function bearing(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const y = Math.sin(r(b[1] - a[1])) * Math.cos(r(b[0]));
  const x = Math.cos(r(a[0])) * Math.sin(r(b[0])) - Math.sin(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Suggested speed over a hazard. Lower ground clearance and worse hazards mean slower.
export function safeSpeedKmh(h, clearanceMm = 165) {
  const band = clearanceMm < 140 ? 0 : clearanceMm < 165 ? 1 : 2;
  const base = (h.category === 'speedbreaker' ? [10, 15, 20] : [15, 20, 25])[band];
  return (h.adjustedSeverity || h.severity) === 'High' ? Math.max(10, base - 5) : base;
}

// Position of each hazard along the route, computed once per route
export const withRouteKm = (line, hazards) => hazards.map((h) => ({ ...h, routeKm: alongRoute(line, h.coords).km }));

// Hazards ahead of the driver within maxM metres, nearest first. offRoute = more than 80 m from the line.
export function hazardsAhead(line, hazards, pos, maxM = 400) {
  const me = alongRoute(line, pos);
  if (me.d > 80) return { offRoute: true, ahead: [] };
  const ahead = hazards
    .map((h) => ({ h, distM: Math.round(((h.routeKm ?? alongRoute(line, h.coords).km) - me.km) * 1000) }))
    .filter((x) => x.distM >= -15 && x.distM <= maxM)
    .sort((a, b) => a.distM - b.distM);
  return { offRoute: false, ahead, doneKm: me.km };
}

// Each hazard is announced twice: first inside `far` m (default 300), again inside `near` m (default 120). spoken: Map(id -> stage), mutated.
export function dueWarnings(ahead, spoken, far = 300, near = 120) {
  const out = [];
  for (const { h, distM } of ahead) {
    const stage = distM <= near ? 2 : distM <= far ? 1 : 0;
    if (stage > (spoken.get(h.id) || 0)) { spoken.set(h.id, stage); out.push({ h, distM: Math.max(0, distM), stage }); }
  }
  return out;
}

// Phone-jolt detector. Call it for every devicemotion event with the current GPS speed (km/h); it returns
// true once per jolt. Uses linear acceleration when the phone gives it, else gravity-corrected magnitude.
export function makeBumpDetector({ threshold = 4.5, cooldownMs = 6000, minKmh = 8, maxKmh = 90 } = {}) {
  let last = -Infinity;
  return (ev, kmh, now = Date.now()) => {
    const a = ev?.acceleration && ev.acceleration.x != null ? ev.acceleration : null;
    let mag;
    if (a) mag = Math.hypot(a.x, a.y, a.z);
    else {
      const g = ev?.accelerationIncludingGravity;
      if (!g || g.x == null) return false;
      mag = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
    }
    if (mag < threshold || kmh == null || kmh < minKmh || kmh > maxKmh || now - last < cooldownMs) return false;
    last = now;
    return true;
  };
}
