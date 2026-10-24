// RoadGuard route analysis: live Python backend (job + polling) and an offline demo engine.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend returned ${res.status}`);
  }
  return res.json();
}

export async function checkBackend(backendUrl = '') {
  const base = backendUrl.replace(/\/$/, '');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base}/api/status`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchMapsKey(backendUrl = '') {
  const base = backendUrl.replace(/\/$/, '');
  try {
    const { google_maps_key } = await readJson(await fetch(`${base}/api/config`));
    return google_maps_key || '';
  } catch {
    return '';
  }
}

// ============================================================
// LIVE BACKEND — POST starts a job, then poll /api/jobs/{id}
// ============================================================
export async function analyzeRouteViaBackend(origin, destination, vehicle, { backendUrl = '', onProgress } = {}) {
  const base = backendUrl.replace(/\/$/, '');

  const { job_id } = await readJson(await fetch(`${base}/api/analyze-routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin,
      destination,
      vehicle: vehicle.name,
      clearance_mm: vehicle.groundClearance,
    }),
  }));

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const job = await readJson(await fetch(`${base}/api/jobs/${job_id}`));
    onProgress?.(job);
    if (job.status === 'done') return transformBackendResult(job.result, base);
    if (job.status === 'error') throw new Error(job.error || 'Analysis failed');
  }
  throw new Error('Analysis timed out after 15 minutes');
}

function transformBackendResult(data, base) {
  const routes = data.routes || [];
  const alternativeRoutes = routes.map((r) => ({
    ...r,
    summary: r.summary || `Route ${r.route_index + 1}`,
    hazards: r.hazards.map((h) => ({
      ...h,
      // older backend returned absolute http://localhost:8000/output/...; new one returns /output/...
      imageUrl: h.imageUrl ? base + h.imageUrl.replace(/^https?:\/\/[^/]+/, '') : null,
    })),
  }));

  return {
    alternativeRoutes,
    recommendedRouteIndex: data.recommended_route_index || 0,
    originAddress: data.origin_address || '',
    destinationAddress: data.destination_address || '',
    analysisTimeSec: data.analysis_time_sec,
    startCoord: alternativeRoutes[0]?.start_coord,
    endCoord: alternativeRoutes[0]?.end_coord,
  };
}


// ============================================================
// OFFLINE DEMO ENGINE — OSRM routing + seeded hazards, no backend needed
// ============================================================

// Curated dictionary for instant geocoding of popular Indian localities & cities
const INDIAN_LOCATIONS = {
  // Ettimadai & Madukkarai & Coimbatore Area
  'ettimadai': [10.9015, 76.8990],
  'ettimadai railway station': [10.9015, 76.8990],
  'lanz mart, ettimadai': [10.9092, 76.9085],
  'lanz mart': [10.9092, 76.9085],
  'amrita university': [10.9038, 76.9004],
  'amrita vishwa vidyapeetham': [10.9038, 76.9004],
  'madukkarai': [10.9038, 76.9634],
  'madukkarai market': [10.9050, 76.9640],
  'madukkarai railway station': [10.9010, 76.9580],
  'gandhipuram': [11.0168, 76.9673],
  'gandhipuram bus stand': [11.0168, 76.9673],
  'gandhipuram bus stand, coimbatore': [11.0168, 76.9673],
  'rs puram': [11.0084, 76.9482],
  'rs puram head post office': [11.0084, 76.9482],
  'coimbatore railway station': [10.9980, 76.9668],
  'coimbatore': [11.0168, 76.9558],
  'saravanampatti': [11.0805, 76.9959],
  'peelamedu': [11.0269, 77.0028],
  'singanallur': [10.9961, 77.0252],
  'ukkadam': [10.9877, 76.9612],
  'thudiyalur': [11.0801, 76.9405],
  'pollachi': [10.6580, 77.0078],
  'kinathukadavu': [10.8202, 77.0195],

  // Bengaluru (Bangalore)
  'bengaluru': [12.9716, 77.5946],
  'bangalore': [12.9716, 77.5946],
  'indiranagar': [12.9784, 77.6408],
  'indiranagar 100ft road': [12.9784, 77.6408],
  'koramangala': [12.9352, 77.6245],
  'koramangala 5th block': [12.9352, 77.6245],
  'whitefield': [12.9698, 77.7499],
  'electronic city': [12.8399, 77.6770],
  'mg road': [12.9756, 77.6066],
  'hsr layout': [12.9121, 77.6446],
  'jayanagar': [12.9308, 77.5838],
  'marathahalli': [12.9591, 77.6974],
  'hebbal': [13.0358, 77.5970],

  // Chennai
  'chennai': [13.0827, 80.2707],
  't nagar': [13.0418, 80.2341],
  'adyar': [13.0012, 80.2565],
  'velachery': [12.9815, 80.2180],
  'anna nagar': [13.0850, 80.2101],
  'guindy': [13.0067, 80.2021],
  'omr': [12.9238, 80.2305],
  'chennai central': [13.0823, 80.2755],

  // Hyderabad
  'hyderabad': [17.3850, 78.4867],
  'gachibowli': [17.4401, 78.3489],
  'hitec city': [17.4435, 78.3772],
  'banjara hills': [17.4156, 78.4357],
  'jubilee hills': [17.4319, 78.4073],
  'madhapur': [17.4483, 78.3915],
  'secunderabad': [17.4399, 78.4983],
  'charminar': [17.3616, 78.4747],

  // Mumbai
  'mumbai': [19.0760, 72.8777],
  'bandra': [19.0596, 72.8295],
  'andheri': [19.1136, 72.8697],
  'colaba': [18.9067, 72.8147],
  'juhu': [19.0988, 72.8264],
  'powai': [19.1176, 72.9060],
  'bkc': [19.0664, 72.8682],

  // Delhi NCR
  'delhi': [28.6139, 77.2090],
  'new delhi': [28.6139, 77.2090],
  'connaught place': [28.6315, 77.2167],
  'india gate': [28.6129, 77.2295],
  'hauz khas': [28.5494, 77.2001],
  'cyber city, gurugram': [28.4952, 77.0891],
  'gurugram': [28.4595, 77.0266],
  'noida': [28.5355, 77.3910],
  'sector 29 market, gurugram': [28.4682, 77.0628],

  // Andhra Pradesh
  'tanguturu': [15.3524, 79.9926],
  'alukurapadu': [15.3211, 80.0345]
};

// 20 Real road hazard images from the dataset
export const REAL_HAZARD_ASSETS = {
  potholes: Array.from({ length: 10 }, (_, i) => `${import.meta.env.BASE_URL}hazards/pothole_${i + 1}.jpg`),
  speedbreakers: Array.from({ length: 10 }, (_, i) => `${import.meta.env.BASE_URL}hazards/speedbreaker_${i + 1}.jpg`),
};

// Helper: Hash string into deterministic integer
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Geocode query to Lat/Lng
export async function geocodeLocation(query) {
  if (!query || typeof query !== 'string') return [10.9015, 76.8990];
  const cleaned = query.trim().toLowerCase();

  // 1. Direct dictionary match
  for (const [key, coords] of Object.entries(INDIAN_LOCATIONS)) {
    if (cleaned === key || cleaned.includes(key) || key.includes(cleaned)) {
      return coords;
    }
  }

  // 2. OpenStreetMap Nominatim Geocoder with 3s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    }
  } catch {
    // Network / abort error - fallback
  }

  // 3. Fallback deterministic offset near Coimbatore region
  const hash = hashString(cleaned);
  const latOffset = ((hash % 120) / 1000) * (hash % 2 === 0 ? 1 : -1);
  const lngOffset = (((hash * 7) % 120) / 1000) * (hash % 3 === 0 ? 1 : -1);
  return [10.9500 + latOffset, 76.9400 + lngOffset];
}

// Fetch driving route polyline from OSRM with fallback
export async function fetchDrivingRoute(startCoord, endCoord) {
  const [startLat, startLng] = startCoord;
  const [endLat, endLng] = endCoord;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationSec = Math.round(route.duration);

        return {
          polyline: coordinates,
          distanceKm: Math.max(0.6, distanceKm),
          durationSec
        };
      }
    }
  } catch {
    // Fallback if network blocked
  }

  // Smooth curved polyline fallback
  const steps = 16;
  const polyline = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = startLat + (endLat - startLat) * t + Math.sin(t * Math.PI) * 0.005;
    const lng = startLng + (endLng - startLng) * t + Math.cos(t * Math.PI) * 0.003;
    polyline.push([lat, lng]);
  }

  const dLat = (endLat - startLat) * 111;
  const dLng = (endLng - startLng) * 111 * Math.cos(startLat * Math.PI / 180);
  const approxDistance = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 1.25 * 10) / 10;

  return {
    polyline,
    distanceKm: Math.max(0.8, approxDistance),
    durationSec: Math.round(approxDistance * 85)
  };
}

// Generate dynamic alternative routes for ANY origin and destination (demo mode)
export async function evaluateDynamicAlternativeRoutes(origin, destination, { onProgress } = {}) {
  const t0 = Date.now();
  onProgress?.({ stage: 0, progress: 5, message: 'Demo mode · geocoding & routing via OSRM...' });
  const [startCoord, endCoord] = await Promise.all([
    geocodeLocation(origin),
    geocodeLocation(destination)
  ]);

  const baseRoute = await fetchDrivingRoute(startCoord, endCoord);
  onProgress?.({ stage: 1, progress: 35, message: 'Demo mode · sampling dataset frames...' });
  await sleep(700);
  onProgress?.({ stage: 2, progress: 65, message: 'Demo mode · seeding hazard detections...' });
  await sleep(700);
  const baseDistance = baseRoute.distanceKm;
  const routeHash = hashString(origin + destination);

  // Generate 2 or 3 alternative routes
  const routeOptions = [
    {
      summary: baseDistance > 4 ? 'Palakkad Main Highway (NH 544)' : 'Primary Arterial Road',
      distanceMult: 1.0,
      durMult: 1.0,
      curveOffset: 0.0,
      hazardFactor: 1.0
    },
    {
      summary: baseDistance > 4 ? 'Bypass & Ring Road' : 'Connecting Bypass Rd',
      distanceMult: 1.08,
      durMult: 1.15,
      curveOffset: 0.006,
      hazardFactor: 0.65 // Often smoother bypass
    },
    {
      summary: baseDistance > 4 ? 'Town Link & Residential Sector' : 'Interior Colony Road',
      distanceMult: 0.94,
      durMult: 1.28,
      curveOffset: -0.005,
      hazardFactor: 1.35 // More inner speed breakers
    }
  ];

  const alternativeRoutes = routeOptions.map((opt, rIdx) => {
    const rDist = Math.round(baseDistance * opt.distanceMult * 10) / 10;
    const rDurMin = Math.round((baseRoute.durationSec * opt.durMult) / 60) || 12;

    // Create slightly varied polyline geometry for each alternative route
    const rPolyline = baseRoute.polyline.map(([lat, lng], ptIdx) => {
      const t = ptIdx / (baseRoute.polyline.length - 1);
      const lateralShift = Math.sin(t * Math.PI) * opt.curveOffset;
      return [lat + lateralShift, lng + lateralShift * 0.7];
    });

    // Generate distinct, route-specific hazards
    const hazards = generateHazardsForRoute(rPolyline, rDist, rIdx, routeHash);

    const potholeCount = hazards.filter(h => h.category === 'pothole').length;
    const speedBreakerCount = hazards.filter(h => h.category === 'speedbreaker').length;

    const avgRisk = hazards.length > 0
      ? hazards.reduce((acc, h) => acc + (h.baseRisk / 280), 0) / hazards.length
      : 0.24;
    const maxRisk = hazards.length > 0
      ? Math.max(...hazards.map(h => h.baseRisk / 280))
      : 0.26;

    return {
      route_index: rIdx,
      summary: opt.summary,
      distance_km: rDist,
      duration_min: rDurMin,
      frames_scanned: Math.round(rDist * 20),
      hazard_count: hazards.length,
      pothole_count: potholeCount,
      speed_breaker_count: speedBreakerCount,
      avg_risk: round(avgRisk, 3),
      max_risk: round(maxRisk, 3),
      overall_score: Math.min(96, Math.max(20, Math.round(avgRisk * 280 + potholeCount * 3))),
      risk_level: avgRisk >= 0.26 ? 'High Risk' : (avgRisk >= 0.24 ? 'Medium Risk' : 'Low Risk'),
      start_coord: startCoord,
      end_coord: endCoord,
      polyline: rPolyline,
      hazards
    };
  });

  // Recommend the safest alternative route (lowest avg risk)
  let bestIdx = 0;
  let lowestScore = 999;
  alternativeRoutes.forEach((alt, idx) => {
    const score = alt.avg_risk * 100 + alt.pothole_count * 5;
    if (score < lowestScore) {
      lowestScore = score;
      bestIdx = idx;
    }
  });

  alternativeRoutes.forEach((alt, idx) => {
    alt.is_recommended = (idx === bestIdx);
  });

  onProgress?.({ stage: 3, progress: 95, message: 'Demo mode · scoring routes...' });
  await sleep(400);

  return {
    startCoord,
    endCoord,
    alternativeRoutes,
    recommendedRouteIndex: bestIdx,
    analysisTimeSec: Math.round((Date.now() - t0) / 100) / 10,
    isDemo: true,
  };
}

function round(val, dec) {
  return Number(Math.round(val + 'e' + dec) + 'e-' + dec);
}

// Generate unique hazards along a specific route polyline
function generateHazardsForRoute(polyline, distanceKm, routeIndex, routeHash) {
  if (!polyline || polyline.length < 2) return [];

  // Determine number of hazards based on distance & route index
  let count = 4;
  if (distanceKm > 10) count = 7;
  else if (distanceKm > 4) count = 5;
  else count = 3;

  if (routeIndex === 1) count = Math.max(2, count - 2); // Bypass has fewer hazards
  if (routeIndex === 2) count = count + 1; // Town link has more humps

  const hazards = [];
  const totalPts = polyline.length;

  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1);
    const ptIdx = Math.min(totalPts - 1, Math.max(0, Math.floor(frac * totalPts)));
    const coord = polyline[ptIdx];

    // Seeded selection using routeHash and index
    const seed = (routeHash + routeIndex * 13 + i * 17);
    const isPothole = (seed % 3 === 0);
    const hType = isPothole ? 'Pothole' : 'Speed Breaker';
    const category = isPothole ? 'pothole' : 'speedbreaker';

    // Unique image selection from real 20 dataset assets
    const imgIndex = (seed % 10);
    const imageUrl = isPothole
      ? REAL_HAZARD_ASSETS.potholes[imgIndex]
      : REAL_HAZARD_ASSETS.speedbreakers[imgIndex];

    const conf = 72 + (seed % 22);
    let severity = 'Medium';
    let baseRisk = 52 + (seed % 24);

    if (isPothole && (seed % 2 === 0)) {
      severity = 'High';
      baseRisk = 76 + (seed % 16);
    } else if (!isPothole && (seed % 4 === 0)) {
      severity = 'Low';
      baseRisk = 32 + (seed % 12);
    }

    const offsetKm = Math.round((distanceKm * frac) * 10) / 10;

    hazards.push({
      id: `haz_r${routeIndex}_${i + 1}_${seed}`,
      type: hType,
      category,
      severity,
      confidence: conf,
      baseRisk,
      adjustedRisk: baseRisk,
      locationOffsetKm: offsetKm,
      coords: coord,
      imageUrl,
      description: isPothole
        ? (severity === 'High' ? 'Deep asphalt depression with fractured road surface.' : 'Mid-depth road surface pothole.')
        : (severity === 'High' ? 'Steep unmarked road hump.' : 'Standard traffic calming speed bump.')
    });
  }

  return hazards;
}
