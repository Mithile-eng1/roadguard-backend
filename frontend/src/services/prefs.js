// Personal preferences, kept in this browser (localStorage). Unknown or damaged values fall back to defaults.
export const DEFAULT_PREFS = { textSize: 'normal', voice: true, warnDist: 300, bump: true, sens: 'normal' };

export const TEXT_SIZES = { normal: '100%', large: '112.5%', xl: '125%' };   // scales every rem-based size
export const WARN_DISTANCES = [200, 300, 500];                               // metres before a hazard
export const SENSITIVITY = { low: 6, normal: 4.5, high: 3.5 };               // jolt threshold in m/s2

export function cleanPrefs(raw) {
  const p = { ...DEFAULT_PREFS, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    textSize: p.textSize in TEXT_SIZES ? p.textSize : DEFAULT_PREFS.textSize,
    voice: typeof p.voice === 'boolean' ? p.voice : DEFAULT_PREFS.voice,
    warnDist: WARN_DISTANCES.includes(p.warnDist) ? p.warnDist : DEFAULT_PREFS.warnDist,
    bump: typeof p.bump === 'boolean' ? p.bump : DEFAULT_PREFS.bump,
    sens: p.sens in SENSITIVITY ? p.sens : DEFAULT_PREFS.sens,
  };
}

export function loadPrefs() {
  try { return cleanPrefs(JSON.parse(localStorage.getItem('rg_prefs'))); } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p) {
  try { localStorage.setItem('rg_prefs', JSON.stringify(p)); } catch { /* storage blocked: preferences last for this visit only */ }
}
