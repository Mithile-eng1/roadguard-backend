import React from 'react';
import { X, Clock, MapPin, Car, ArrowRight, Trash2 } from 'lucide-react';
import { VEHICLE_DATABASE, DEFAULT_VEHICLE } from '../data/vehicles';
import { buildRouteView } from '../services/risk';
import { displayPlace } from '../services/geo';

export default function HistoryModal({ isOpen, onClose, onSelectHistoryRoute, onClear, historyItems }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Analysis history">
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <Clock size={20} className="text-primary" />
            <h3 className="modal-title">History</h3>
          </div>
          <div className="modal-actions-inline">
            {historyItems.length > 0 && (
              <button type="button" className="btn-secondary btn-sm" onClick={onClear} title="Clear history">
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            )}
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body-scrollable">
          {historyItems.length === 0 ? (
            <div className="empty-state-notice">
              <p>Nothing yet. Routes you analyse will be listed here.</p>
            </div>
          ) : (
            <div className="history-list-cards">
              {historyItems.map((item) => {
                const vehicle = VEHICLE_DATABASE.find((v) => v.id === item.vehicleId) || DEFAULT_VEHICLE;
                const view = buildRouteView(item, item.recommendedRouteIndex || 0, vehicle);
                if (!view) return null;
                const score = view.overallScore;
                return (
                  <div key={item.id} className="history-card-item">
                    <div className="history-card-header">
                      <span className="history-timestamp">{item.timestamp}{item.isDemo ? ' · Demo' : ''}</span>
                      <span className={`history-risk-pill ${score >= 70 ? 'pill-high' : score >= 45 ? 'pill-med' : 'pill-low'}`}>
                        Risk {score}
                      </span>
                    </div>

                    <div className="history-route-path">
                      <MapPin size={15} className="text-success" />
                      <span className="font-semibold">{item.originAddress || displayPlace(item.startLocation)}</span>
                      <ArrowRight size={14} className="text-muted" />
                      <span className="font-semibold">{item.destinationAddress || displayPlace(item.destination)}</span>
                    </div>

                    <div className="history-meta-row">
                      <div className="history-meta-tag">
                        <Car size={14} />
                        <span>{vehicle.name}</span>
                      </div>
                      <div className="history-meta-tag">
                        <span>{view.distanceKm} km</span>
                      </div>
                      <div className="history-meta-tag">
                        <span>{view.hazards.length} hazards · {item.alternativeRoutes.length} routes</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-load-history"
                      onClick={() => {
                        onSelectHistoryRoute(item);
                        onClose();
                      }}
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
