import React, { useState } from 'react';
import { MapPin, ImageOff, Trash2 } from 'lucide-react';
import { useT } from '../services/i18n';
import { frameAge, distM } from '../services/risk';
import BoxedImage from './BoxedImage';

// When the Street View image was taken; old images may no longer match the road
function StreetViewAge({ ym }) {
  const { t, lang } = useT();
  const age = frameAge(ym);
  const date = new Date(`${ym}-01`).toLocaleString(lang, { month: 'short', year: 'numeric' });
  return (
    <div data-testid="frame-age" style={{ fontSize: '.8rem', opacity: 0.85, color: age > 3 ? '#b45309' : undefined }}>
      {t('age.line', { date })}{age > 3 ? ` · ⚠ ${t('age.old', { n: Math.round(age) })}` : ''}
    </div>
  );
}

const SEVERITY_STYLE = {
  High: { badge: 'badge-high', text: 'text-high' },
  Medium: { badge: 'badge-medium', text: 'text-medium' },
  Low: { badge: 'badge-low', text: 'text-low' },
};

const NEEDED = 5; // different voters that remove a detection

export default function DetectedHazards({ hazards, onFocusHazard, focusedHazardId, isAdmin, onRemove, votes = [], onVoteRemove }) {
  const [filterType, setFilterType] = useState('all');
  const [voteMsg, setVoteMsg] = useState({}); // hazard id -> answer after voting
  const tally = (h) => votes.find((v) => v.category === h.category && distM(h.coords, [v.lat, v.lng]) <= 20)?.count || 0;
  const vote = async (h) => {
    try {
      const r = await onVoteRemove(h);
      setVoteMsg((m) => ({ ...m, [h.id]: r.removed ? 'Removed by voters' : r.already ? `You already voted (${r.count}/${r.needed})` : `Thanks, ${r.count}/${r.needed} votes` }));
    } catch (e) { setVoteMsg((m) => ({ ...m, [h.id]: e.message })); }
  };

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
                <div className="hazard-image-container" style={hazard.boxes?.length ? { height: 'auto', minHeight: 155 } : undefined}>
                  {hazard.imageUrl && hazard.boxes?.length > 0 && (
                    <BoxedImage src={hazard.imageUrl} boxes={hazard.boxes} alt={`${hazard.type} at ${hazard.locationOffsetKm} km`} />
                  )}
                  {hazard.imageUrl && !hazard.boxes?.length && <img
                    src={hazard.imageUrl}
                    alt={`${hazard.type} at ${hazard.locationOffsetKm} km`}
                    className="hazard-image-media"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />}
                  <div className="hazard-image-fallback" style={{ display: hazard.imageUrl ? 'none' : 'flex' }}>
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

                  {!hazard.crowd && hazard.capturedAt && <StreetViewAge ym={hazard.capturedAt} />}
                  {hazard.boxes?.length > 0 && <div style={{ fontSize: '.8rem', opacity: 0.85 }}>🟩 Green box: marked by the admin</div>}

                  <dl className="hazard-meta-grid">
                    <div className="meta-cell"><dt>{hazard.crowd ? 'Source' : 'Confidence'}</dt><dd>{hazard.crowd ? `${hazard.sightings} users` : `${hazard.confidence}%`}</dd></div>
                    <div className="meta-cell"><dt>Risk</dt><dd className={style.text}>{riskScore} / 100</dd></div>
                    {hazard.crowd
                      ? <div className="meta-cell"><dt>Note</dt><dd>{hazard.notes?.[hazard.notes.length - 1] || '—'}</dd></div>
                      : <div className="meta-cell"><dt>Seen in</dt><dd>{hazard.sightings || 1} {hazard.sightings > 1 ? 'frames' : 'frame'}</dd></div>}
                  </dl>

                  <button type="button" className="btn-view-on-map" onClick={() => onFocusHazard(hazard)}>
                    <MapPin size={14} />
                    <span>Show on map</span>
                  </button>
                  {!hazard.crowd && hazard.coords && onVoteRemove && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => vote(hazard)}>
                        👎 No obstacle here ({tally(hazard)}/{NEEDED})
                      </button>
                      {isAdmin && (
                        <button type="button" className="btn-secondary btn-sm"
                          onClick={() => window.confirm('Remove this detection now? It will stop counting in all scores.') && onRemove(hazard)}>
                          <Trash2 size={13} /> Remove now (admin)
                        </button>
                      )}
                      {voteMsg[hazard.id] && <small data-testid="vote-msg">{voteMsg[hazard.id]}</small>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
