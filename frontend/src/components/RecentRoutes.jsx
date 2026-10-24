import React from 'react';
import { ArrowRight, Clock, Route } from 'lucide-react';
import { VEHICLE_DATABASE, DEFAULT_VEHICLE } from '../data/vehicles';
import { PRESET_ROUTES } from '../data/sampleRouteData';
import { buildRouteView } from '../services/risk';
import { displayPlace } from '../services/geo';

// Fills the space under the intro: your last few analyses (one click to reopen),
// or example routes when there is no history yet.
export default function RecentRoutes({ historyItems, onOpenHistoryItem, onPreset, onOpenHistory }) {
  const recent = historyItems.slice(0, 4);

  if (recent.length === 0) {
    return (
      <div className="recent-routes">
        <div className="recent-head">
          <span className="recent-title"><Route size={15} /> Try an example route</span>
        </div>
        <ul className="recent-list">
          {PRESET_ROUTES.map((p) => (
            <li key={p.start + p.destination}>
              <button type="button" className="recent-row" onClick={() => onPreset(p)}>
                <span className="recent-path">
                  <span>{p.start}</span>
                  <ArrowRight size={12} />
                  <span>{p.destination}</span>
                </span>
                <span className="recent-meta">{p.distanceKm} km</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="recent-foot">Fills the form; press Analyze route to run it.</div>
      </div>
    );
  }

  return (
    <div className="recent-routes">
      <div className="recent-head">
        <span className="recent-title"><Clock size={15} /> Recent routes</span>
        {historyItems.length > recent.length && (
          <button type="button" className="recent-link" onClick={onOpenHistory}>All {historyItems.length}</button>
        )}
      </div>
      <ul className="recent-list">
        {recent.map((item) => {
          const vehicle = VEHICLE_DATABASE.find((v) => v.id === item.vehicleId) || DEFAULT_VEHICLE;
          const v = item.clearanceMm ? { ...vehicle, groundClearance: item.clearanceMm } : vehicle;
          const view = buildRouteView(item, item.recommendedRouteIndex || 0, v);
          if (!view) return null;
          const score = view.overallScore;
          return (
            <li key={item.id}>
              <button type="button" className="recent-row" onClick={() => onOpenHistoryItem(item)} title="Open this analysis">
                <span className="recent-path">
                  <span>{item.originAddress?.split(',')[0] || displayPlace(item.startLocation)}</span>
                  <ArrowRight size={12} />
                  <span>{item.destinationAddress?.split(',')[0] || displayPlace(item.destination)}</span>
                </span>
                <span className="recent-meta">
                  <span>{view.distanceKm} km</span>
                  <span>{view.hazards.length} {view.hazards.length === 1 ? 'hazard' : 'hazards'}</span>
                  <span className={`alt-risk-pill ${score >= 70 ? 'pill-high' : score >= 45 ? 'pill-med' : 'pill-low'}`}>Risk {score}</span>
                </span>
                <span className="recent-sub">{vehicle.name} · {item.timestamp}{item.isDemo ? ' · demo' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
