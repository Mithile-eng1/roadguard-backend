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
    potholeCount: adjusted.filter((h) => h.category === 'pothole').length,
    speedBreakerCount: adjusted.filter((h) => h.category === 'speedbreaker').length,
  };
}

// analysis: { alternativeRoutes, recommendedRouteIndex, ...meta } -> everything the results UI needs
export function buildRouteView(analysis, activeRouteIndex, vehicle) {
  if (!analysis?.alternativeRoutes?.length) return null;
  const multiplier = clearanceMultiplier(vehicle?.groundClearance || 165);

  const alternativeRoutes = analysis.alternativeRoutes.map((alt) => {
    const s = scoreHazards(alt.hazards || [], multiplier);
    return { ...alt, hazards: s.hazards, overall_score: s.overallScore, risk_level: s.riskLevel };
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
    vehicleMultiplier: multiplier,
  };
}
