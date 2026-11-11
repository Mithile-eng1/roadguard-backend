import React from 'react';
import { FileText, Share2, ArrowRight, Check, Navigation, Mail } from 'lucide-react';
import RoutePreference from './RoutePreference';
import { useT } from '../services/i18n';
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
  isAnalyzing,
  onOpenDrive,
  onOpenAuthority
}) {
  const { t } = useT();
  const alternativeRoutes = routeData.alternativeRoutes || [];
  const meta = [
    routeData.isSample ? 'Example' : routeData.isDemo ? 'Demo mode' : `${routeData.cached ? 'Saved result from' : 'Analyzed'} ${routeData.timestamp}`,
    alternativeRoutes.length > 1 ? `${alternativeRoutes.length} routes compared` : null,
    routeData.routeSummary ? `via ${routeData.routeSummary}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className={`route-results-section ${isAnalyzing ? 'results-stale' : ''}`} id="results-view">
      <div className="results-header-row">
        <div className="results-meta-col">
          <h2 className="results-main-title">{t('res.title')}</h2>
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
            <span>{t('res.report')}</span>
          </button>
          <button type="button" className="btn-action-outline" onClick={onOpenDrive}>
            <Navigation size={16} />
            <span>{t('res.drive')}</span>
          </button>
          <button type="button" className="btn-action-outline" onClick={onOpenAuthority}>
            <Mail size={16} />
            <span>{t('authority.btn')}</span>
          </button>
          <button type="button" className="btn-action-outline" onClick={onShareRoute}>
            {copiedLink ? <><Check size={16} className="text-success" /><span>{t('res.copied')}</span></> : <><Share2 size={16} /><span>{t('res.share')}</span></>}
          </button>
        </div>
      </div>

      <RoutePreference routes={alternativeRoutes} activeIndex={activeRouteIndex} onSelect={onSelectAlternativeRoute} />

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
                  {alt.is_recommended && <span className="recommended-badge"><Check size={12} /> {t('res.recommended')}</span>}
                </div>
                <div className="alt-route-meta-row">
                  <span>{alt.distance_km} km</span>
                  {alt.duration_min != null && <span>{alt.duration_min} min</span>}
                  <span>{t('res.hazards', { n: alt.hazard_count })}</span>
                  <span className={`alt-risk-pill ${score >= 70 ? 'pill-high' : score >= 45 ? 'pill-med' : 'pill-low'}`}>
                    {t('res.risk', { n: score })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="results-caveat" role="note">
        <strong>Heads-up, not a guarantee.</strong> The detector misses some hazards, so "no hazards found"
        does not mean the road is smooth. Check each flagged frame yourself and drive to the conditions.
      </p>

      {routeData.unscanned?.length > 0 && (
        <p className="results-caveat" role="note" data-testid="coverage-note" style={{ borderColor: '#f97316' }}>
          {t('cov.note', { pct: routeData.scannedPct ?? '?', n: routeData.unscanned.length })}
        </p>
      )}
      {routeData.hiddenFixed > 0 && (
        <p className="results-caveat" role="note" data-testid="hidden-note">{t('age.hidden', { n: routeData.hiddenFixed })}</p>
      )}

      <div className="results-dashboard-grid">
        <div className="dashboard-stats-panel">
          <RiskScoreCard routeData={routeData} />
          <VehicleProfileCard vehicle={selectedVehicle} />
        </div>
      </div>
    </section>
  );
}
