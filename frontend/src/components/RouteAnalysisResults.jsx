import React from 'react';
import { FileText, Share2, ArrowRight, Check } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import RiskScoreCard from './RiskScoreCard';
import VehicleProfileCard from './VehicleProfileCard';
import { displayPlace } from '../services/geo';

export default function RouteAnalysisResults({
  routeData,
  selectedVehicle,
  focusedHazard,
  onSelectHazard,
  onOpenReport,
  onShareRoute,
  onSelectAlternativeRoute,
  activeRouteIndex,
  copiedLink,
  darkMode,
  mapsKey,
  isAnalyzing
}) {
  const alternativeRoutes = routeData.alternativeRoutes || [];
  const meta = [
    routeData.isSample ? 'Example' : routeData.isDemo ? 'Demo mode' : `Analyzed ${routeData.timestamp}`,
    alternativeRoutes.length > 1 ? `${alternativeRoutes.length} routes compared` : null,
    routeData.routeSummary ? `via ${routeData.routeSummary}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className={`route-results-section ${isAnalyzing ? 'results-stale' : ''}`} id="results-view">
      <div className="results-header-row">
        <div className="results-meta-col">
          <h2 className="results-main-title">Results</h2>
          <div className="results-breadcrumbs">
            <span className="location-start-tag" title={routeData.startLocation}>{routeData.originAddress || displayPlace(routeData.startLocation)}</span>
            <ArrowRight size={14} className="breadcrumb-arrow" />
            <span className="location-dest-tag" title={routeData.destination}>{routeData.destinationAddress || displayPlace(routeData.destination)}</span>
          </div>
          <div className="results-timestamp">{meta}</div>
        </div>

        <div className="results-actions-group">
          <button type="button" className="btn-action-outline" onClick={onOpenReport}>
            <FileText size={16} />
            <span>Report</span>
          </button>
          <button type="button" className="btn-action-outline" onClick={onShareRoute}>
            {copiedLink ? <><Check size={16} className="text-success" /><span>Link copied</span></> : <><Share2 size={16} /><span>Share</span></>}
          </button>
        </div>
      </div>

      {alternativeRoutes.length > 1 && (
        <div className="alt-routes-grid" role="tablist" aria-label="Routes">
          {alternativeRoutes.map((alt, idx) => {
            const isSelected = (activeRouteIndex === idx);
            const score = alt.overall_score;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`alt-route-card-btn ${isSelected ? 'alt-route-active' : ''}`}
                onClick={() => onSelectAlternativeRoute(idx)}
              >
                <div className="alt-route-top-row">
                  <div className="alt-route-name">{alt.summary}</div>
                  {alt.is_recommended && <span className="recommended-badge"><Check size={12} /> Recommended</span>}
                </div>
                <div className="alt-route-meta-row">
                  <span>{alt.distance_km} km</span>
                  {alt.duration_min != null && <span>{alt.duration_min} min</span>}
                  <span>{alt.hazard_count} {alt.hazard_count === 1 ? 'hazard' : 'hazards'}</span>
                  <span className={`alt-risk-pill ${score >= 70 ? 'pill-high' : score >= 45 ? 'pill-med' : 'pill-low'}`}>
                    Risk {score}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="results-dashboard-grid">
        <div className="dashboard-map-panel">
          <InteractiveMap
            routeData={routeData}
            focusedHazard={focusedHazard}
            onSelectHazard={onSelectHazard}
            onSelectRoute={onSelectAlternativeRoute}
            darkMode={darkMode}
            mapsKey={mapsKey}
          />
        </div>
        <div className="dashboard-stats-panel">
          <RiskScoreCard routeData={routeData} />
          <VehicleProfileCard vehicle={selectedVehicle} />
        </div>
      </div>
    </section>
  );
}
