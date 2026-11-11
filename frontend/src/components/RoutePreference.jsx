import React, { useState } from 'react';
import { useT } from '../services/i18n';
import { pickRoute, tradeoff } from '../services/preference';

// Fastest <-> safest slider. Moving it picks the route that best fits and shows what that costs.
export default function RoutePreference({ routes, activeIndex, onSelect }) {
  const { t } = useT();
  const [w, setW] = useState(50);
  if (routes.length < 2) return null;

  const move = (value) => {
    setW(value);
    const idx = pickRoute(routes, value / 100);
    if (idx !== activeIndex) onSelect(idx);
  };
  const tr = tradeoff(routes, activeIndex);

  return (
    <div className="route-preference" style={{ margin: '8px 0 12px' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('pref.title')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '.85rem' }}>{t('pref.fastest')}</span>
        <input type="range" min="0" max="100" step="5" value={w} style={{ flex: 1, minHeight: 32 }}
          aria-label={t('pref.title')} onChange={(e) => move(Number(e.target.value))} />
        <span style={{ fontSize: '.85rem' }}>{t('pref.safest')}</span>
      </div>
      <div style={{ fontSize: '.85rem', opacity: 0.85, marginTop: 4 }} data-testid="pref-result">
        {tr.fastest === activeIndex ? t('pref.same') : t('pref.tradeoff', { min: tr.extraMin, drop: tr.riskDrop })}
      </div>
    </div>
  );
}
