// Fastest <-> safest slider. w is 0..1 (0 = only time matters, 1 = only risk matters).
const norm = (xs) => {
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return xs.map((x) => (hi === lo ? 0 : (x - lo) / (hi - lo)));
};

// Index (position in the list) of the route that best fits the slider.
export function pickRoute(routes, w) {
  if (!routes.length) return 0;
  const t = norm(routes.map((r) => r.duration_min ?? 0));
  const s = norm(routes.map((r) => r.overall_score ?? 0));
  let best = 0, bestCost = Infinity;
  routes.forEach((r, i) => {
    const cost = (1 - w) * t[i] + w * s[i];
    // on a tie prefer the quicker route
    if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) <= 1e-9 && (r.duration_min ?? 0) < (routes[best].duration_min ?? 0))) { best = i; bestCost = cost; }
  });
  return best;
}

// What the chosen route costs / saves compared with the fastest one
export function tradeoff(routes, idx) {
  const fastest = routes.reduce((b, r, i) => ((r.duration_min ?? 0) < (routes[b].duration_min ?? 0) ? i : b), 0);
  const a = routes[idx], f = routes[fastest];
  return { fastest, extraMin: (a.duration_min ?? 0) - (f.duration_min ?? 0), riskDrop: (f.overall_score ?? 0) - (a.overall_score ?? 0) };
}
