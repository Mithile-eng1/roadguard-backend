import React, { useEffect, useState } from 'react';
import { Map, AdvancedMarker, InfoWindow, Polyline, ControlPosition, useMap } from '@vis.gl/react-google-maps';
import { ExternalLink } from 'lucide-react';
import { clusterReports, CONFIRM_AT } from '../services/risk';
import { useT } from '../services/i18n';

const SEVERITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
const toLatLng = ([lat, lng]) => ({ lat, lng });

// Dashed line = Google's icon-repeat trick (a real dash style doesn't exist)
const DASHED = {
  strokeOpacity: 0,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.55, scale: 3 }, offset: '0', repeat: '14px' }],
};

function PinIcon({ type }) {
  if (type === 'start') return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8" /></svg>;
  if (type === 'end') return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>;
}

function Pin({ type, severity }) {
  const bg = type === 'start' ? '#16a34a' : type === 'end' ? '#ef4444' : (SEVERITY_COLOR[severity] || SEVERITY_COLOR.Low);
  return <div className="custom-pin-badge" style={{ background: bg }}><PinIcon type={type} /></div>;
}

// Fit the route on change; fly to a focused hazard
function MapController({ polyline, focusCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !polyline || polyline.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    polyline.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    // keep the route clear of the floating panel (left on desktop, bottom sheet on phone)
    const pad = window.innerWidth > 768
      ? { left: 450, top: 60, right: 60, bottom: 60 }
      : { left: 30, top: 60, right: 30, bottom: Math.round(window.innerHeight * 0.5) };
    map.fitBounds(bounds, pad);
  }, [map, polyline]);

  useEffect(() => {
    if (!map || !focusCoords) return;
    map.panTo(toLatLng(focusCoords));
    map.setZoom(17);
  }, [map, focusCoords]);

  return null;
}

// Confirm / "fixed" votes on a crowdsourced hazard
function VoteButtons({ cluster, onVote }) {
  const { t } = useT();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const vote = async (status) => {
    setBusy(true);
    try { await onVote(cluster, status); setMsg(status === 'present' ? t('vote.thanks') : t('vote.thanksFixed')); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => vote('present')}>{t('vote.see')}</button>
        <button type="button" disabled={busy} onClick={() => vote('gone')}>{t('vote.fixed')}</button>
      </div>
      {msg && <div style={{ marginTop: 4, fontSize: 12 }}>{msg}</div>}
    </div>
  );
}

function streetViewLink([lat, lng]) {
  return `https://www.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}`;
}

export default function InteractiveMap({ routeData, focusedHazard, onSelectHazard, onSelectRoute, darkMode, mapsKey, reports = [], onOpenReport, onVote }) {
  const { t } = useT();
  const [openId, setOpenId] = useState(null); // hazard id | 'start' | 'end'

  // "View on Map" from the hazard grid opens that hazard's popup
  useEffect(() => { setOpenId(focusedHazard?.id ?? null); }, [focusedHazard]);


  if (!mapsKey) {
    return (
      <div className="map-view-wrapper">
        <div className="map-key-missing">
          <strong>Google Maps key not available</strong>
          <span>Put <code>GOOGLE_MAPS_API_KEY</code> in the backend <code>.env</code> (served via <code>/api/config</code>) or <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code>, and enable “Maps JavaScript API” on it.</span>
        </div>
      </div>
    );
  }

  const center = routeData?.startCoord || [10.9015, 76.8990];
  const polyline = !routeData ? [] : routeData.routePolyline?.length
    ? routeData.routePolyline
    : (routeData.startCoord && routeData.endCoord ? [routeData.startCoord, routeData.endCoord] : [center]);
  const alternatives = (routeData?.alternativeRoutes || []).filter((_, i) => i !== routeData.activeRouteIndex);
  const openHazard = routeData?.hazards?.find((h) => h.id === openId);
  const clusters = clusterReports(reports);
  const unscanned = routeData?.unscanned || [];
  const onRoute = new Set((routeData?.hazards || []).filter((h) => h.crowd).map((h) => h.clusterId));
  const openCluster = clusters.find((c) => `c_${c.id}` === openId);
  const clusterOf = (h) => clusters.find((c) => c.id === h.clusterId);

  return (
    <div className="map-view-wrapper">
      {routeData && <div className="map-legend-overlay">
        <div className="legend-item"><span className="legend-dot start-dot"></span><span>Start</span></div>
        <div className="legend-item"><span className="legend-dot end-dot"></span><span>End</span></div>
        <div className="legend-item"><span className="legend-triangle high-triangle">▲</span><span>High Risk</span></div>
        <div className="legend-item"><span className="legend-triangle med-triangle">▲</span><span>Medium Risk</span></div>
        <div className="legend-item"><span className="legend-triangle low-triangle">▲</span><span>Low Risk</span></div>
        {alternatives.length > 0 && (
          <div className="legend-item"><span className="legend-alt-line"></span><span>Other routes</span></div>
        )}
        {unscanned.length > 0 && (
          <div className="legend-item"><span style={{ display: 'inline-block', width: 22, borderTop: '3px dashed #f97316' }}></span><span>{t('cov.legend')}</span></div>
        )}
      </div>}

      <button type="button" onClick={onOpenReport}
        style={{ position: 'absolute', top: 56, right: 12, zIndex: 5, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fff', color: '#111', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>
        {t('map.reportBtn')}
      </button>

      {/* colorScheme is init-only, hence the key. DEMO_MAP_ID is Google's public id
          (needed for AdvancedMarker); create your own Map ID in Cloud Console for custom styling. */}
        <Map
          key={darkMode ? 'dark' : 'light'}
          className="google-road-map"
          mapId="DEMO_MAP_ID"
          colorScheme={darkMode ? 'DARK' : 'LIGHT'}
          defaultCenter={toLatLng(center)}
          defaultZoom={14}
          gestureHandling="greedy"
          mapTypeControlOptions={{ position: ControlPosition.TOP_RIGHT }}
          onClick={() => setOpenId(null)}
        >
          <MapController polyline={polyline} focusCoords={focusedHazard?.coords} />

          {/* Non-selected alternatives: dashed, click to compare */}
          {alternatives.map((alt) => (
            <Polyline
              key={`alt_${alt.route_index}`}
              path={alt.polyline.map(toLatLng)}
              strokeColor={darkMode ? '#94a3b8' : '#64748b'}
              strokeWeight={5}
              zIndex={1}
              clickable
              onClick={() => onSelectRoute?.(alt.route_index)}
              {...DASHED}
            />
          ))}

          {/* Active route: glow + core stroke */}
          {polyline.length > 1 && <><Polyline path={polyline.map(toLatLng)} strokeColor="#1d4ed8" strokeOpacity={0.5} strokeWeight={9} zIndex={2} clickable={false} />
          <Polyline path={polyline.map(toLatLng)} strokeColor="#3b82f6" strokeOpacity={1} strokeWeight={4.5} zIndex={3} clickable={false} /></>}

          {/* stretches with no Street View: unknown, not safe */}
          {unscanned.map((s, i) => (
            <Polyline key={`gap_${i}`} path={s.path.map(toLatLng)} strokeColor="#f97316" strokeWeight={6} zIndex={4} clickable={false} {...DASHED} />
          ))}

          {routeData?.startCoord && (
            <AdvancedMarker position={toLatLng(routeData.startCoord)} title="Start" onClick={() => setOpenId('start')} zIndex={10}>
              <Pin type="start" />
            </AdvancedMarker>
          )}
          {routeData?.endCoord && (
            <AdvancedMarker position={toLatLng(routeData.endCoord)} title="Destination" onClick={() => setOpenId('end')} zIndex={10}>
              <Pin type="end" />
            </AdvancedMarker>
          )}

          {routeData?.hazards?.map((haz) => (
            <AdvancedMarker
              key={haz.id}
              position={toLatLng(haz.coords)}
              title={`${haz.type} · ${haz.adjustedSeverity || haz.severity} risk`}
              zIndex={20}
              onClick={() => { setOpenId(haz.id); onSelectHazard?.(haz); }}
            >
              <Pin type="hazard" severity={haz.adjustedSeverity || haz.severity} />
            </AdvancedMarker>
          ))}

          {clusters.filter((c) => !c.fixed && c.count > 0 && !onRoute.has(c.id)).map((c) => (
            <AdvancedMarker key={c.id} position={{ lat: c.lat, lng: c.lng }} zIndex={c.confirmed ? 18 : 12}
              onClick={() => setOpenId(`c_${c.id}`)}
              title={c.confirmed
                ? `Confirmed ${c.category} · reported by ${c.count} users (counts toward route risk)`
                : `Unconfirmed ${c.category} · ${c.count}/${CONFIRM_AT} reports`}>
              <div className="custom-pin-badge" style={{ background: '#8b5cf6', opacity: c.confirmed ? 1 : 0.45 }}><PinIcon type="hazard" /></div>
            </AdvancedMarker>
          ))}

          {openCluster && (
            <InfoWindow position={{ lat: openCluster.lat, lng: openCluster.lng }} pixelOffset={[0, -30]} onCloseClick={() => setOpenId(null)}>
              <div className="map-popup-card">
                {openCluster.photo && <img src={openCluster.photo} alt="" className="map-popup-image" onError={(e) => { e.target.style.display = 'none'; }} />}
                <strong>{openCluster.category === 'pothole' ? 'Pothole' : 'Speed breaker'} · reported by users</strong>
                <div className="popup-meta">
                  {openCluster.confirmed ? t('vote.confirmed', { n: openCluster.count }) : t('vote.needed', { n: openCluster.count, k: CONFIRM_AT })}
                </div>
                {openCluster.notes.map((n, i) => <div key={i} className="popup-location">“{n}”</div>)}
                <VoteButtons cluster={openCluster} onVote={onVote} />
              </div>
            </InfoWindow>
          )}
          {openId === 'start' && routeData?.startCoord && (
            <InfoWindow position={toLatLng(routeData.startCoord)} pixelOffset={[0, -30]} onCloseClick={() => setOpenId(null)}>
              <div className="map-popup-card"><strong>🟢 Start Point</strong><div>{routeData.startLocation}</div></div>
            </InfoWindow>
          )}
          {openId === 'end' && routeData?.endCoord && (
            <InfoWindow position={toLatLng(routeData.endCoord)} pixelOffset={[0, -30]} onCloseClick={() => setOpenId(null)}>
              <div className="map-popup-card"><strong>🔴 Destination</strong><div>{routeData.destination}</div></div>
            </InfoWindow>
          )}
          {openHazard && (
            <InfoWindow position={toLatLng(openHazard.coords)} pixelOffset={[0, -30]} onCloseClick={() => setOpenId(null)}>
              <div className="map-popup-card">
                {openHazard.imageUrl && (
                  <img src={openHazard.imageUrl} alt={openHazard.type} className="map-popup-image" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <div className="popup-badge" data-severity={openHazard.adjustedSeverity || openHazard.severity}>
                  {openHazard.adjustedSeverity || openHazard.severity} Risk
                </div>
                <strong>{openHazard.type}</strong>
                <div className="popup-meta">
                  <span>{openHazard.crowd ? 'Crowd-reported' : `Confidence: ${openHazard.confidence}%`}</span> • <span>Risk: {openHazard.adjustedRisk ?? openHazard.baseRisk}/100</span>
                </div>
                <div className="popup-location">{openHazard.locationOffsetKm} km along route</div>
                {openHazard.crowd && <>
                  <div className="popup-location">Reported by {openHazard.sightings} users</div>
                  {openHazard.notes?.map((n, i) => <div key={i} className="popup-location">“{n}”</div>)}
                  {clusterOf(openHazard) && <VoteButtons cluster={clusterOf(openHazard)} onVote={onVote} />}
                </>}
                <a className="popup-link" href={streetViewLink(openHazard.coords)} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} /> Open in Google Street View
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
    </div>
  );
}
