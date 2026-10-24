import React from 'react';
import { X, Printer, Shield } from 'lucide-react';
import { displayPlace } from '../services/geo';

function buildRecommendations(routeData, vehicle) {
  const hazards = routeData.hazards || [];
  const sev = (h) => h.adjustedSeverity || h.severity;
  const km = (h) => `km ${h.locationOffsetKm}`;
  const tips = [];

  const high = hazards.filter((h) => sev(h) === 'High');
  if (high.length) {
    tips.push(<><strong>Slow down:</strong> reduce speed to under 20 km/h at {high.map(km).join(', ')} — high-risk {high.length === 1 ? 'hazard' : 'hazards'} for a {vehicle.groundClearance} mm vehicle.</>);
  }

  const humps = hazards.filter((h) => h.category === 'speedbreaker' && sev(h) !== 'Low');
  if (humps.length) {
    tips.push(<><strong>Speed breakers:</strong> approach at an angle and crawl over the {humps.length === 1 ? 'hump' : 'humps'} at {humps.map(km).join(', ')} to avoid scraping the sump.</>);
  }

  const potholes = hazards.filter((h) => h.category === 'pothole');
  if (potholes.length) {
    tips.push(<><strong>Potholes:</strong> {potholes.length} detected — keep to the centre of the lane and avoid braking inside the depression.</>);
  }

  const rec = (routeData.alternativeRoutes || []).find((r) => r.is_recommended);
  if (rec && rec.route_index !== routeData.activeRouteIndex) {
    tips.push(<><strong>Safer alternative:</strong> Route {rec.route_index + 1} ({rec.summary}) scored {rec.overall_score}/100 with {rec.hazard_count} hazards.</>);
  }

  if (!hazards.length) {
    tips.push(<><strong>Clear road:</strong> no potholes or speed breakers were detected in the scanned frames. Drive normally.</>);
  }

  tips.push(<><strong>Method:</strong> {routeData.isDemo || routeData.isSample ? 'Illustrative data — ' : ''}YOLOv8 detection on Google Street View frames sampled every 10 m (every panorama), personalised for {vehicle.name} ({vehicle.groundClearance} mm clearance).</>);
  return tips;
}

export default function ReportModal({ isOpen, onClose, routeData, vehicle }) {
  if (!isOpen || !routeData) return null;

  const scoreClass = routeData.overallScore >= 70 ? 'text-danger' : routeData.overallScore >= 45 ? 'text-warning' : 'text-success';

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box modal-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Assessment report">
        <div className="modal-header-row no-print">
          <div className="modal-title-wrap">
            <Shield size={20} className="text-success" />
            <h3 className="modal-title">Report</h3>
          </div>
          <div className="modal-actions-inline">
            <button type="button" className="btn-action-primary btn-sm" onClick={() => window.print()}>
              <Printer size={15} />
              <span>Print or save as PDF</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="printable-report-content" id="printable-report-area">
          <div className="report-doc-header">
            <div className="report-brand">
              <h2>RoadGuard</h2>
              <p>Route hazard report</p>
            </div>
            <div className="report-doc-meta">
              <div><strong>Date:</strong> {routeData.timestamp}</div>
              <div><strong>Report ID:</strong> RG-{String(routeData.id || 'sample').replace(/^route_/, '').toUpperCase()}</div>
            </div>
          </div>

          <hr className="report-divider" />

          <div className="report-section">
            <h4 className="report-section-title">1. Route and vehicle</h4>
            <div className="report-table-grid">
              <div className="report-grid-cell">
                <span className="report-cell-label">Start Origin:</span>
                <span className="report-cell-value">{routeData.originAddress || displayPlace(routeData.startLocation)}</span>
              </div>
              <div className="report-grid-cell">
                <span className="report-cell-label">Destination:</span>
                <span className="report-cell-value">{routeData.destinationAddress || displayPlace(routeData.destination)}</span>
              </div>
              <div className="report-grid-cell">
                <span className="report-cell-label">Route:</span>
                <span className="report-cell-value">{routeData.routeSummary || '—'} · {routeData.distanceKm} km{routeData.durationMin != null ? ` · ${routeData.durationMin} min` : ''}</span>
              </div>
              <div className="report-grid-cell">
                <span className="report-cell-label">Assessed Vehicle:</span>
                <span className="report-cell-value">{vehicle.name} ({vehicle.groundClearance} mm clearance{vehicle.measured ? ', owner-measured' : ''})</span>
              </div>
              <div className="report-grid-cell">
                <span className="report-cell-label">Overall Risk Score:</span>
                <span className={`report-cell-value font-bold ${scoreClass}`}>{routeData.overallScore} / 100 ({routeData.riskLevel})</span>
              </div>
              <div className="report-grid-cell">
                <span className="report-cell-label">Total Hazards:</span>
                <span className="report-cell-value">{routeData.hazards?.length || 0} ({routeData.potholeCount} Potholes, {routeData.speedBreakerCount} Speed Breakers)</span>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h4 className="report-section-title">2. Hazards</h4>
            {routeData.hazards?.length ? (
              <table className="report-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Hazard Type</th>
                    <th>Severity</th>
                    <th>Confidence</th>
                    <th>Risk</th>
                    <th>Offset</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {routeData.hazards.map((h, i) => {
                    const sev = h.adjustedSeverity || h.severity;
                    return (
                      <tr key={h.id}>
                        <td>{i + 1}</td>
                        <td><strong>{h.type}</strong></td>
                        <td><span className={`report-severity-tag ${sev.toLowerCase()}`}>{sev}</span></td>
                        <td>{h.confidence}%</td>
                        <td>{h.adjustedRisk ?? h.baseRisk}/100</td>
                        <td>{h.locationOffsetKm} km</td>
                        <td>{h.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="report-empty-note">No hazards were detected on this route.</p>
            )}
          </div>

          <div className="report-section report-recommendations">
            <h4 className="report-section-title">3. Advice</h4>
            <ul>
              {buildRecommendations(routeData, vehicle).map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
