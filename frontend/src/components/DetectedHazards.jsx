import React, { useState } from 'react';
import { MapPin, ImageOff } from 'lucide-react';

const SEVERITY_STYLE = {
  High: { badge: 'badge-high', text: 'text-high' },
  Medium: { badge: 'badge-medium', text: 'text-medium' },
  Low: { badge: 'badge-low', text: 'text-low' },
};

export default function DetectedHazards({ hazards, onFocusHazard, focusedHazardId }) {
  const [filterType, setFilterType] = useState('all');

  const potholes = hazards.filter(h => h.category === 'pothole').length;
  const speedBreakers = hazards.filter(h => h.category === 'speedbreaker').length;
  const filtered = hazards.filter(h => filterType === 'all' || h.category === filterType);

  return (
    <section className="detected-hazards-section">
      <div className="hazards-header-bar">
        <h3 className="hazards-title">Hazards along this route</h3>
        <div className="hazards-filter-tabs" role="tablist">
          {[['all', `All ${hazards.length}`], ['pothole', `Potholes ${potholes}`], ['speedbreaker', `Speed breakers ${speedBreakers}`]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={filterType === key}
              className={`filter-tab-btn ${filterType === key ? 'active' : ''}`} onClick={() => setFilterType(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="hazards-empty-state">
          <div className="hazards-empty-title">
            {hazards.length === 0 ? 'Nothing detected on this route' : `No ${filterType === 'pothole' ? 'potholes' : 'speed breakers'} on this route`}
          </div>
          <div className="hazards-empty-desc">
            {hazards.length === 0
              ? 'No potholes or speed breakers were found in the Street View frames we scanned. Coverage can be patchy on small roads, so stay alert.'
              : 'Try the other filter, or pick a different route above.'}
          </div>
        </div>
      ) : (
        <div className="hazard-cards-grid">
          {filtered.map((hazard) => {
            const severity = hazard.adjustedSeverity || hazard.severity;
            const riskScore = hazard.adjustedRisk ?? hazard.baseRisk;
            const style = SEVERITY_STYLE[severity] || SEVERITY_STYLE.Low;

            return (
              <div key={hazard.id} className={`hazard-card-item ${focusedHazardId === hazard.id ? 'hazard-card-focused' : ''}`}>
                {/* Frame from Street View; the detector already drew the box */}
                <div className="hazard-image-container">
                  <img
                    src={hazard.imageUrl}
                    alt={`${hazard.type} at ${hazard.locationOffsetKm} km`}
                    className="hazard-image-media"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hazard-image-fallback" style={{ display: 'none' }}>
                    <ImageOff size={22} />
                    <span>Frame unavailable</span>
                  </div>
                  <div className={`hazard-risk-badge ${style.badge}`}>{severity} risk</div>
                </div>

                <div className="hazard-body-content">
                  <div className="hazard-type-title">
                    <span className="hazard-type-text">{hazard.type}</span>
                    <span className="hazard-offset">{hazard.locationOffsetKm} km in</span>
                  </div>

                  <dl className="hazard-meta-grid">
                    <div className="meta-cell"><dt>Confidence</dt><dd>{hazard.confidence}%</dd></div>
                    <div className="meta-cell"><dt>Risk</dt><dd className={style.text}>{riskScore} / 100</dd></div>
                    <div className="meta-cell"><dt>Seen in</dt><dd>{hazard.sightings || 1} {hazard.sightings > 1 ? 'frames' : 'frame'}</dd></div>
                  </dl>

                  <button type="button" className="btn-view-on-map" onClick={() => onFocusHazard(hazard)}>
                    <MapPin size={14} />
                    <span>Show on map</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
