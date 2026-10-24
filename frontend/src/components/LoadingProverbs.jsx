import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  'Fetching routes from Google Directions',
  'Downloading Street View frames',
  'Scanning frames for potholes and speed breakers',
  'Scoring routes for your vehicle',
];

// Progress panel while a job runs. `progress` comes straight from the backend job:
// { stage: 0-3, progress: 0-100, message }
export default function LoadingProverbs({ progress }) {
  const stage = progress?.stage ?? 0;
  const pct = Math.max(2, Math.min(100, Math.round(progress?.progress ?? 0)));

  return (
    <div className="progress-panel" aria-live="polite">
      <div className="progress-panel-head">
        <span className="progress-panel-title">Analyzing…</span>
        <span className="progress-panel-pct">{pct}%</span>
      </div>
      <div className="loading-progress-track">
        <div className="loading-progress-fill" style={{ width: `${pct}%` }}></div>
      </div>

      <ol className="progress-steps">
        {STEPS.map((label, i) => (
          <li key={i} className={i < stage ? 'done' : i === stage ? 'active' : ''}>
            <span className="progress-step-mark">{i < stage ? <Check size={12} /> : i + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className="progress-panel-status">
        <span className="spinner-ring"></span>
        <span>{progress?.message || 'Connecting to the analysis server…'}</span>
      </div>
    </div>
  );
}
