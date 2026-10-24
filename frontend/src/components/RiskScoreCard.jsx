import React from 'react';

export default function RiskScoreCard({ routeData }) {
  const score = routeData.overallScore ?? 0;
  const riskLevel = routeData.riskLevel || 'Low Risk';

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let strokeColor = '#dc2626';
  let badgeClass = 'risk-badge-high';
  if (score < 45) {
    strokeColor = '#16a34a';
    badgeClass = 'risk-badge-low';
  } else if (score < 70) {
    strokeColor = '#d97706';
    badgeClass = 'risk-badge-med';
  }

  const t = routeData.analysisTimeSec;
  const timeLabel = t == null ? '—' : t >= 60 ? `${Math.floor(t / 60)} min ${Math.round(t % 60)} s` : `${t} s`;

  const rows = [
    ['Distance', routeData.distanceKm != null ? `${routeData.distanceKm} km` : '—'],
    routeData.durationMin != null && ['Drive time', `${routeData.durationMin} min`],
    ['Potholes', routeData.potholeCount ?? 0],
    ['Speed breakers', routeData.speedBreakerCount ?? 0],
    routeData.framesScanned != null && ['Frames scanned', routeData.framesScanned],
    ['Analysis took', timeLabel],
  ].filter(Boolean);

  return (
    <div className="risk-score-card">
      <div className="card-section-title">Risk for your vehicle</div>

      <div className="risk-score-layout">
        <div className="circular-gauge-wrapper">
          <svg className="circular-gauge-svg" width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
            <circle className="gauge-track" cx="65" cy="65" r={radius} strokeWidth="10" />
            <circle
              className="gauge-value"
              cx="65" cy="65" r={radius} strokeWidth="10"
              stroke={strokeColor}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 65 65)"
            />
          </svg>
          <div className="gauge-center-content">
            <span className="gauge-score-number">{score}</span>
            <span className="gauge-score-total">of 100</span>
          </div>
          <div className={`gauge-risk-status ${badgeClass}`}>{riskLevel.replace(' Risk', ' risk')}</div>
        </div>

        <dl className="risk-metrics-list">
          {rows.map(([label, value]) => (
            <div className="metric-row-item" key={label}>
              <dt className="metric-label">{label}</dt>
              <dd className="metric-val">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
