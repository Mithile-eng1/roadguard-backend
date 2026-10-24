import React, { useState } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { X, MapPin, LocateFixed, RotateCcw, Check, Loader2 } from 'lucide-react';
import { parseLatLng, toLatLngString } from '../services/geo';

const DEFAULT_CENTER = { lat: 10.9015, lng: 76.899 }; // Ettimadai

function Pin({ color }) {
  return (
    <div className="custom-pin-badge" style={{ background: color }}>
      <MapPin size={14} color="#fff" />
    </div>
  );
}

function PanTo({ target }) {
  const map = useMap();
  React.useEffect(() => {
    if (map && target) { map.panTo(target); map.setZoom(Math.max(map.getZoom(), 15)); }
  }, [map, target]);
  return null;
}

// Click once for the start, once for the destination; drag either pin to adjust.
export default function MapPickerModal({ isOpen, onClose, onConfirm, startLocation, destination, darkMode, initialCenter }) {
  if (!isOpen) return null;
  return (
    <PickerDialog
      onClose={onClose}
      onConfirm={onConfirm}
      initialOrigin={parseLatLng(startLocation)}
      initialDest={parseLatLng(destination)}
      darkMode={darkMode}
      initialCenter={initialCenter}
    />
  );
}

function PickerDialog({ onClose, onConfirm, initialOrigin, initialDest, darkMode, initialCenter }) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [dest, setDest] = useState(initialDest);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [panTarget, setPanTarget] = useState(null);

  const center = initialOrigin || initialCenter || DEFAULT_CENTER;

  const handleMapClick = (e) => {
    const p = e.detail?.latLng;
    if (!p) return;
    if (!origin) setOrigin(p);
    else setDest(p);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation is not supported by this browser.'); return; }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(p);
        setPanTarget(p);
        setLocating(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Location permission denied — click the map to set your start instead.' : 'Could not get your location. Click the map to set your start.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const hint = !origin ? 'Click the map to set your START point'
    : !dest ? 'Now click the map to set your DESTINATION'
    : 'Drag a pin to adjust, or confirm';

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div className="modal-dialog-box modal-lg picker-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick origin and destination on map">
        <div className="modal-header-row">
          <div className="modal-title-wrap">
            <MapPin size={20} className="text-success" />
            <div>
              <h3 className="modal-title">Pick on Map</h3>
              <span className="picker-hint">{hint}</span>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="picker-map-wrap">
          <Map
            key={darkMode ? 'dark' : 'light'}
            className="picker-map"
            mapId="DEMO_MAP_ID"
            colorScheme={darkMode ? 'DARK' : 'LIGHT'}
            defaultCenter={center}
            defaultZoom={initialOrigin ? 15 : 13}
            gestureHandling="greedy"
            clickableIcons={false}
            streetViewControl={false}
            onClick={handleMapClick}
          >
            <PanTo target={panTarget} />
            {origin && (
              <AdvancedMarker position={origin} draggable title="Start — drag to adjust"
                onDragEnd={(e) => setOrigin({ lat: e.latLng.lat(), lng: e.latLng.lng() })}>
                <Pin color="#16a34a" />
              </AdvancedMarker>
            )}
            {dest && (
              <AdvancedMarker position={dest} draggable title="Destination — drag to adjust"
                onDragEnd={(e) => setDest({ lat: e.latLng.lat(), lng: e.latLng.lng() })}>
                <Pin color="#ef4444" />
              </AdvancedMarker>
            )}
          </Map>

          <div className="picker-chips">
            <span className={`picker-chip ${origin ? 'set' : ''}`}>
              <span className="legend-dot start-dot"></span>
              {origin ? toLatLngString(origin) : 'Start not set'}
            </span>
            <span className={`picker-chip ${dest ? 'set' : ''}`}>
              <span className="legend-dot end-dot"></span>
              {dest ? toLatLngString(dest) : 'Destination not set'}
            </span>
          </div>
        </div>

        {geoError && <div className="picker-geo-error">{geoError}</div>}

        <div className="picker-footer">
          <button type="button" className="btn-secondary picker-btn" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 size={15} className="icon-spin-subtle" /> : <LocateFixed size={15} />}
            <span>Use my location as start</span>
          </button>
          <div className="picker-footer-right">
            <button type="button" className="btn-secondary picker-btn" onClick={() => { setOrigin(null); setDest(null); }} disabled={!origin && !dest}>
              <RotateCcw size={15} /><span>Reset</span>
            </button>
            <button type="button" className="btn-action-primary" disabled={!origin || !dest}
              onClick={() => onConfirm(toLatLngString(origin), toLatLngString(dest))}>
              <Check size={16} /><span>Use these points</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
