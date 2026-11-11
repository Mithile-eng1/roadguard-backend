// Client-side vehicle personalization. Runs instantly on vehicle change without re-analysing.

function clearanceMultiplier(clearance) {
  if (clearance < 100) return 1.45;
  if (clearance < 140) return 1.30;
  if (clearance < 165) return 1.12;
  if (clearance <= 175) return 1.0;
  if (clearance <= 200) return 0.88;
  return 0.75;
}

function severityFor(score) {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

// distance from point p to segment a-b in metres (local flat approximation, fine at route scale),
// plus how far along the segment the closest point is (0..1) and the segment length
function segInfo(p, a, b) {
  const k = 111320, c = Math.cos(p[0] * Math.PI / 180);
  const [px, py, ax, ay, bx, by] = [p[1] * k * c, p[0] * k, a[1] * k * c, a[0] * k, b[1] * k * c, b[0] * k];
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t, len: Math.hypot(dx, dy) };
}
export const distM = (p, q) => segInfo(p, q, q).d;

// Closest approach of a point to a polyline: {d metres, km from the start of the route}
export function alongRoute(line, p) {
  let best = { d: Infinity, km: 0 }, run = 0;
  for (let i = 1; i < line.length; i++) {
    const g = segInfo(p, line[i - 1], line[i]);
    if (g.d < best.d) best = { d: g.d, km: (run + g.t * g.len) / 1000 };
    run += g.len;
  }
  return best;
}

// Reports of the same type within 30 m are one hazard. Each user's LATEST vote counts ("present" =
// I see it, "gone" = it was fixed). Confirmed = 3+ different users still say present (and more
// than say gone); fixed = 2+ users say gone. Only confirmed hazards touch scores and lists.
// ponytail: greedy clustering, O(n^2); use a grid index past ~5k reports.
export const CONFIRM_AT = 3;
export const FIXED_AT = 2;
export function clusterReports(reports) {
  const clusters = [];
  for (const r of [...reports].sort((x, y) => (x.ts || 0) - (y.ts || 0))) {
    let c = clusters.find((k) => k.category === r.category && distM([r.lat, r.lng], [k.lat, k.lng]) <= 30);
    if (!c) { c = { id: r.id, lat: r.lat, lng: r.lng, category: r.category, votes: new Map(), notes: [], photo: '' }; clusters.push(c); }
    c.votes.set(r.uid || r.id, { s: r.status || 'present', ts: r.ts || 0 });
    if (r.note) c.notes.push(r.note);
    if (r.photo) c.photo = r.photo;
  }
  return clusters.map(({ votes, notes, ...k }) => {
    const v = [...votes.values()];
    const count = v.filter((x) => x.s === 'present').length;
    const gone = v.length - count;
    const fixedAt = Math.max(0, ...v.filter((x) => x.s === 'gone').map((x) => x.ts)); // newest "it's fixed" vote
    return { ...k, notes: notes.slice(-3), count, gone, fixedAt, fixed: gone >= FIXED_AT && gone >= count, confirmed: count >= CONFIRM_AT && count > gone };
  });
}

// Street View capture month ("YYYY-MM") -> unix seconds, or 0 when unknown (treated as old)
export const captureTs = (ym) => (ym ? Date.parse(ym.length === 7 ? `${ym}-01` : ym) / 1000 || 0 : 0);
// Age of a Street View frame in years (null when the date is unknown)
export function frameAge(ym, now = Date.now()) {
  const t = captureTs(ym);
  return t ? (now / 1000 - t) / (365.25 * 86400) : null;
}

// Confirmed hazards within 50 m of a route become ordinary hazards (list, directions, counts, score),
// unless the detector already found the same thing there.
function crowdHazards(confirmed, line, found) {
  return confirmed.flatMap((c) => {
    const { d, km } = alongRoute(line, [c.lat, c.lng]);
    if (d > 50 || found.some((h) => h.category === c.category && h.coords && distM(h.coords, [c.lat, c.lng]) <= 30)) return [];
    return [{
      id: `crowd_${c.id}`, clusterId: c.id, crowd: true, category: c.category,
      type: c.category === 'pothole' ? 'Pothole' : 'Speed Breaker',
      severity: 'Medium', baseRisk: 55 + Math.min(20, (c.count - CONFIRM_AT) * 5),
      confidence: null, sightings: c.count, locationOffsetKm: Math.round(km * 10) / 10,
      coords: [c.lat, c.lng], imageUrl: c.photo || null, notes: c.notes,
      description: `Reported by ${c.count} different users.`,
    }];
  });
}

function scoreHazards(hazards, multiplier) {
  const adjusted = hazards.map((h) => {
    const typeImpact = h.category === 'pothole' ? multiplier * 1.05 : multiplier * 0.95;
    const adjustedRisk = Math.min(99, Math.max(15, Math.round((h.baseRisk || 50) * typeImpact)));
    return { ...h, adjustedRisk, adjustedSeverity: severityFor(adjustedRisk) };
  });

  // No hazards found = genuinely low-risk road, not "unknown"
  let overallScore = 8;
  if (adjusted.length) {
    const avg = adjusted.reduce((a, h) => a + h.adjustedRisk, 0) / adjusted.length;
    const high = adjusted.filter((h) => h.adjustedSeverity === 'High').length;
    overallScore = Math.min(96, Math.max(18, Math.round(avg * 1.05 + high * 4)));
  }

  return {
    hazards: adjusted,
    overallScore,
    riskLevel: `${severityFor(overallScore)} Risk`,
    crowdCount: adjusted.filter((h) => h.crowd).length,
    potholeCount: adjusted.filter((h) => h.category === 'pothole').length,
    speedBreakerCount: adjusted.filter((h) => h.category === 'speedbreaker').length,
  };
}

// analysis: { alternativeRoutes, recommendedRouteIndex, ...meta } -> everything the results UI needs
export function buildRouteView(analysis, activeRouteIndex, vehicle, reports = []) {
  if (!analysis?.alternativeRoutes?.length) return null;
  const multiplier = clearanceMultiplier(vehicle?.groundClearance || 165);
  const clusters = clusterReports(reports);
  const confirmed = clusters.filter((c) => c.confirmed);
  const fixed = clusters.filter((c) => c.fixed);
  // Newer driver reports outrank old images: a detected hazard whose Street View frame is OLDER than
  // drivers' "it's fixed" votes at the same spot is dropped from the score and the list.
  const outranked = (h) => !h.crowd && h.coords && fixed.some((c) => c.category === h.category
    && distM(h.coords, [c.lat, c.lng]) <= 30 && c.fixedAt > captureTs(h.capturedAt));
  const withCrowd = (alt) => {
    const own = alt.hazards || [];
    const kept = own.filter((h) => !outranked(h));
    return {
      list: [...kept, ...crowdHazards(confirmed, alt.polyline || [], kept)].sort((x, y) => x.locationOffsetKm - y.locationOffsetKm),
      hidden: own.length - kept.length,
    };
  };

  const alternativeRoutes = analysis.alternativeRoutes.map((alt) => {
    const w = withCrowd(alt);
    const s = scoreHazards(w.list, multiplier);
    return { ...alt, hazards: s.hazards, overall_score: s.overallScore, risk_level: s.riskLevel, hidden_fixed: w.hidden };
  });

  const idx = Math.min(activeRouteIndex, alternativeRoutes.length - 1);
  const active = alternativeRoutes[idx];
  const scored = scoreHazards(active.hazards, multiplier);

  return {
    ...analysis,
    alternativeRoutes,
    activeRouteIndex: idx,
    routeSummary: active.summary,
    distanceKm: active.distance_km,
    durationMin: active.duration_min,
    framesScanned: active.frames_scanned,
    routePolyline: active.polyline,
    startCoord: active.start_coord || analysis.startCoord,
    endCoord: active.end_coord || analysis.endCoord,
    ...scored,
    hiddenFixed: active.hidden_fixed || 0,
    unscanned: active.unscanned || [],
    scannedPct: active.scanned_pct ?? null,
    vehicleMultiplier: multiplier,
  };
}
