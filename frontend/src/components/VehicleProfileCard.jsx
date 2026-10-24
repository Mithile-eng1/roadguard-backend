import React from 'react';

export default function VehicleProfileCard({ vehicle }) {
  const mm = vehicle.groundClearance || 165;
  const note = mm < 165
    ? 'Below 165 mm. Tall speed breakers and deep potholes can touch the sump or exhaust — slow right down at the marked spots.'
    : mm > 190
      ? 'Above 190 mm. Most road hazards clear the underbody; the risk score is scaled down accordingly.'
      : 'Typical clearance for a city car. Normal caution at the marked spots is enough.';

  return (
    <div className="vehicle-profile-card">
      <div className="card-section-title">Your vehicle</div>

      <div className="vehicle-info-row">
        <div className="vehicle-car-visual">
          <div className="car-vector-badge">
            <svg viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg" className="car-vector-svg" aria-hidden="true">
              <path d="M12 28L18 16C19 14 22 12 26 12H68C72 12 75 14 77 16L86 28H94C96 28 98 30 98 32V36H2V32C2 30 4 28 6 28H12Z" fill="#94A3B8" />
              <path d="M22 15L25 24H48V15H25C23.5 15 22.5 15 22 15Z" fill="#E2E8F0" />
              <path d="M52 15V24H73L69 15H52Z" fill="#E2E8F0" />
              <circle cx="22" cy="36" r="7" fill="#334155" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="76" cy="36" r="7" fill="#334155" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="22" cy="36" r="3" fill="#94A3B8" />
              <circle cx="76" cy="36" r="3" fill="#94A3B8" />
            </svg>
          </div>
        </div>
        <div className="vehicle-details-col">
          <div className="vehicle-name-heading">{vehicle.name}</div>
          <div className="vehicle-spec-clearance">{vehicle.category} · ground clearance <span className="highlight-val">{mm} mm</span>{vehicle.measured ? ' (measured by you)' : ''}</div>
        </div>
      </div>

      <p className="vehicle-note">{note}</p>
    </div>
  );
}
