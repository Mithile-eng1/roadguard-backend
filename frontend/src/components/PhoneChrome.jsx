import React from 'react';
import { Search, Settings, Compass, Clock, Info, PlusCircle } from 'lucide-react';
import { useT } from '../services/i18n';

// Phone-only chrome (hidden on laptops by CSS): a floating search pill on the map and a bottom tab bar,
// like Google Maps. The laptop keeps the normal top navbar.
export function PhoneSearch({ routeData, user, onOpenPlan, onOpenSettings }) {
  const { t } = useT();
  const label = routeData
    ? `${routeData.originAddress || routeData.startLocation} → ${routeData.destinationAddress || routeData.destination}`
    : t('hero.plan');
  return (
    <div className="phone-search">
      <button type="button" className="phone-search-field" onClick={onOpenPlan} aria-label={label}>
        <Search size={18} /><span>{label}</span>
      </button>
      <button type="button" className="phone-avatar" onClick={onOpenSettings} aria-label="Settings">
        {user ? user.name.slice(0, 1).toUpperCase() : <Settings size={18} />}
      </button>
    </div>
  );
}

export function PhoneTabs({ activeTab, onHome, onHistory, onReport, onAbout }) {
  const { t } = useT();
  const tabs = [
    [Compass, t('nav.home'), onHome, activeTab === 'home'],
    [Clock, t('nav.history'), onHistory, false],
    [PlusCircle, t('map.reportBtn').replace(/^\S*\s/, ''), onReport, activeTab === 'report'],
    [Info, t('nav.about'), onAbout, activeTab === 'about'],
  ];
  return (
    <nav className="phone-tabs" aria-label="Main">
      {tabs.map(([Icon, label, fn, on]) => (
        <button key={label} type="button" className={on ? 'on' : ''} onClick={fn}><Icon size={22} /><span>{label}</span></button>
      ))}
    </nav>
  );
}
