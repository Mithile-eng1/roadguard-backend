import React from 'react';
import { Moon, Sun, Settings } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode, onOpenSettings, backendOnline, liveMode }) {
  const statusClass = !liveMode ? 'demo' : backendOnline === null ? 'unknown' : backendOnline ? 'online' : 'offline';
  const statusLabel = !liveMode ? 'Demo mode' : backendOnline === null ? 'Checking server…' : backendOnline ? 'Server online' : 'Server offline';

  return (
    <header className="navbar-container">
      <div className="navbar-content">
        <a className="navbar-brand" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="road-logo-svg" aria-hidden="true">
            <path d="M16 2L3 28H13L15 16L16 8L17 16L19 28H29L16 2Z" fill="#16A34A" />
            <line x1="16" y1="10" x2="16" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="17" x2="16" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="25" x2="16" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="brand-name">RoadGuard</span>
        </a>

        <nav className="navbar-nav">
          <button className={`nav-link-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Home</button>
          <button className="nav-link-btn" onClick={() => setActiveTab('history')}>History</button>
          <button className={`nav-link-btn ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About</button>
        </nav>

        <div className="navbar-actions">
          <button type="button" className={`backend-status-chip status-${statusClass}`} onClick={onOpenSettings} title="Open settings">
            <span className="status-dot"></span>
            <span className="status-label">{statusLabel}</span>
          </button>
          <button className="action-icon-btn" title="Settings" onClick={onOpenSettings} aria-label="Settings">
            <Settings size={18} />
          </button>
          <button className="action-icon-btn theme-toggle-btn" onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
