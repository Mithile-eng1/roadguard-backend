// "lat,lng" strings are what the Directions API accepts for map-picked points.
const LATLNG_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseLatLng(str) {
  const m = LATLNG_RE.exec(str || '');
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function toLatLngString({ lat, lng }) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Human-friendly label for a form value: address as-is, coordinates shortened.
export function displayPlace(str) {
  const p = parseLatLng(str);
  return p ? `📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : str;
}
