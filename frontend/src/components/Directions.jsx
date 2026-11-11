import React from 'react';
import { ArrowUp, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, RotateCw, Flag, Navigation, AlertTriangle } from 'lucide-react';

const ICON = {
  'turn-left': ArrowLeft, 'turn-sharp-left': ArrowLeft, 'turn-slight-left': ArrowLeft, 'ramp-left': ArrowLeft, 'fork-left': ArrowLeft, 'keep-left': ArrowLeft,
  'turn-right': ArrowRight, 'turn-sharp-right': ArrowRight, 'turn-slight-right': ArrowRight, 'ramp-right': ArrowRight, 'fork-right': ArrowRight, 'keep-right': ArrowRight,
  'uturn-left': CornerUpLeft, 'uturn-right': CornerUpRight,
  'roundabout-left': RotateCw, 'roundabout-right': RotateCw,
};

const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const WARN = {
  speedbreaker: 'Speed breaker ahead — slow down to about 20 km/h',
  pothole: 'Pothole ahead — slow down and steer carefully',
};

// Hazard offsets were laid out evenly along the route, so match them to steps by
// cumulative distance (ponytail: approximate; snap to step polylines if it ever matters).
export default function Directions({ steps, hazards, onFocusHazard }) {
  if (!steps?.length) {
    return (
      <section className="directions-card">
        <h3 className="directions-title">Directions</h3>
        <p className="directions-empty">Directions aren't available for this result. Press Analyze route again to load them.</p>
      </section>
    );
  }

  let start = 0;
  const rows = steps.map((s) => {
    const row = { ...s, start };
    start += s.distance_m;
    return row;
  });
  const total = start;
  const perStep = rows.map((r) => hazards
    .filter((h) => {
      const at = Math.min(h.locationOffsetKm * 1000, total - 1);
      return at >= r.start && at < r.start + r.distance_m;
    })
    .map((h) => ({ h, after: Math.max(0, Math.round(h.locationOffsetKm * 1000 - r.start)) })));

  return (
    <section className="directions-card">
      <h3 className="directions-title">Directions <span>{fmt(total)} · {hazards.length} {hazards.length === 1 ? 'hazard' : 'hazards'}</span></h3>
      <ol className="directions-list">
        {rows.map((r, i) => {
          const Icon = ICON[r.maneuver] || ArrowUp;
          return (
            <li key={i} className="direction-step">
              <span className="direction-icon">{i === 0 ? <Navigation size={16} /> : <Icon size={16} />}</span>
              <div className="direction-body">
                <div className="direction-text">{r.instruction}</div>
                <div className="direction-dist">{fmt(r.distance_m)}</div>
                {perStep[i].map(({ h, after }) => {
                  const sev = h.adjustedSeverity || h.severity;
                  return (
                    <button key={h.id} type="button" className={`direction-hazard sev-${sev}`} onClick={() => onFocusHazard(h)}>
                      <AlertTriangle size={14} />
                      <span>{after > 0 ? `In ${fmt(after)}: ` : ''}{WARN[h.category] || `${h.type} ahead — slow down`} <em>({sev} risk)</em></span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
        <li className="direction-step">
          <span className="direction-icon"><Flag size={16} /></span>
          <div className="direction-body"><div className="direction-text">You have arrived</div></div>
        </li>
      </ol>
    </section>
  );
}
