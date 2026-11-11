import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import RouteAnalysisResults from './components/RouteAnalysisResults';
import DetectedHazards from './components/DetectedHazards';
import Directions from './components/Directions';
import AboutView from './components/AboutView';
import HistoryModal from './components/HistoryModal';
import ReportModal from './components/ReportModal';
import SettingsModal from './components/SettingsModal';
import Footer from './components/Footer';
import MapPickerModal from './components/MapPickerModal';
import InteractiveMap from './components/InteractiveMap';
import ReportPage from './components/ReportPage';
import AuthPage, { VerifyNotice } from './components/AuthPage';
import MyReportsPage from './components/MyReportsPage';
import AdminPage from './components/AdminPage';
import DriveMode from './components/DriveMode';
import AuthorityReport from './components/AuthorityReport';
import { APIProvider } from '@vis.gl/react-google-maps';

import { VEHICLE_DATABASE, DEFAULT_VEHICLE } from './data/vehicles';
import { buildRouteView } from './services/risk';
import { loadAuth, saveAuth, fetchMe, verifyEmail, submitReport, fetchReports, analyzeRouteViaBackend, evaluateDynamicAlternativeRoutes, checkBackend, fetchMapsKey } from './services/routeService';
import './App.css';

// localStorage is a convenience only: private windows / blocked storage must not break the app
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const urlParams = new URLSearchParams(window.location.search);
const vehicleFromUrl = VEHICLE_DATABASE.find((v) => v.id === urlParams.get('vehicle'));

function App() {
  const [resetToken, setResetToken] = useState(urlParams.get('reset')); // arrived from the emailed link
  const [activeTab, setActiveTab] = useState(urlParams.get('reset') ? 'login' : 'home'); // 'home' | 'about' | 'login' | 'report'
  const [darkMode, setDarkMode] = useState(() =>
    loadLocal('rg_dark', window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));

  // Form state
  const [startLocation, setStartLocation] = useState(urlParams.get('from') || '');
  const [destination, setDestination] = useState(urlParams.get('to') || '');
  const [baseVehicle, setSelectedVehicle] = useState(vehicleFromUrl || DEFAULT_VEHICLE);
  // Modified / worn cars: the owner measures clearance and it overrides the catalogue value
  const [customClearance, setCustomClearance] = useState(() => {
    const mm = parseInt(urlParams.get('mm'), 10);
    return mm >= 40 && mm <= 400 ? mm : loadLocal('rg_custom_mm', null);
  });
  const selectedVehicle = useMemo(() => customClearance
    ? { ...baseVehicle, groundClearance: customClearance, measured: true }
    : baseVehicle, [baseVehicle, customClearance]);

  // Analysis state: raw result (vehicle-agnostic) + which alternative is selected.
  // Everything shown is derived from these + the vehicle, so switching vehicle is instant.
  const [analysis, setAnalysis] = useState(null); // no route until the user analyses one
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [auth, setAuthState] = useState(loadAuth); // { token, name } | null
  const setAuth = (a) => { saveAuth(a); setAuthState(a); };
  const [reports, setReports] = useState([]); // crowdsourced hazards; they raise the risk of routes they lie on
  const routeData = useMemo(
    () => buildRouteView(analysis, activeRouteIndex, selectedVehicle, reports),
    [analysis, activeRouteIndex, selectedVehicle, reports]
  );

  const [focusedHazard, setFocusedHazard] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null); // { stage, progress, message }
  const [analysisError, setAnalysisError] = useState('');

  const [historyItems, setHistoryItems] = useState(() => loadLocal('rg_history', []));
  const [apiConfig, setApiConfig] = useState(() => loadLocal('rg_settings', { backendUrl: '', useLiveApi: true }));

  const [notice, setNotice] = useState('');
  const [driveOpen, setDriveOpen] = useState(false);
  const [authorityOpen, setAuthorityOpen] = useState(false);
  const reloadReports = () => fetchReports(apiConfig.backendUrl).then(setReports);

  // account details (verified / admin) come from the server, never from localStorage
  const meSeq = useRef(0); // only the newest /api/me answer may change state
  const refreshMe = useCallback(() => {
    if (!auth?.token) return Promise.resolve();
    const mine = ++meSeq.current;
    return fetchMe(apiConfig.backendUrl, auth.token)
      .then((m) => { if (mine === meSeq.current) setAuthState((a) => a && { ...a, ...m }); })
      .catch((e) => { if (e.status === 401 && mine === meSeq.current) { saveAuth(null); setAuthState(null); } });
  }, [auth?.token, apiConfig.backendUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refreshMe(); }, [refreshMe]);

  // arrived from the emailed verification link
  useEffect(() => {
    const v = urlParams.get('verify');
    if (!v) return;
    window.history.replaceState({}, '', window.location.pathname);
    verifyEmail(apiConfig.backendUrl, v)
      .then(() => { setNotice('Email verified. You can now report hazards.'); refreshMe(); })
      .catch((e) => setNotice(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "I see this too" / "It's fixed" from a map popup
  const handleVote = async (c, status) => {
    if (!auth) { setActiveTab('login'); throw new Error('Log in to vote'); }
    if (auth.verified === false) { setActiveTab('report'); throw new Error('Verify your email first'); }
    try {
      await submitReport(apiConfig.backendUrl, { lat: c.lat, lng: c.lng, category: c.category, status }, auth.token);
    } catch (e) { if (e.status === 401) setAuth(null); throw e; }
    await reloadReports();
  };
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown
  // Google Maps JS key: build-time env wins, else the backend hands out its own key
  const [mapsKey, setMapsKey] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true); // phone bottom sheet

  useEffect(() => {
    if (darkMode) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    saveLocal('rg_dark', darkMode);
  }, [darkMode]);

  useEffect(() => { saveLocal('rg_history', historyItems); }, [historyItems]);
  useEffect(() => { saveLocal('rg_settings', apiConfig); }, [apiConfig]);
  useEffect(() => { saveLocal('rg_custom_mm', customClearance); }, [customClearance]);

  // Backend heartbeat so the UI can say why an analysis would fail before the user waits on it
  const pingBackend = useCallback(async () => {
    const online = await checkBackend(apiConfig.backendUrl);
    setBackendOnline(online);
    if (online) fetchReports(apiConfig.backendUrl).then(setReports);
    if (online && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      const key = await fetchMapsKey(apiConfig.backendUrl);
      if (key) setMapsKey(key);
    }
  }, [apiConfig.backendUrl]);

  useEffect(() => { if (activeTab === 'home') pingBackend(); }, [activeTab]); // refresh after submitting a report

  useEffect(() => {
    pingBackend();
    const t = setInterval(pingBackend, 30000);
    return () => clearInterval(t);
  }, [pingBackend]);

  const handleAnalyzeRoute = async () => {
    if (isAnalyzing) return;
    const startQuery = startLocation.trim();
    const destQuery = destination.trim();
    if (!startQuery || !destQuery) return;

    setIsAnalyzing(true);
    setFocusedHazard(null);
    setAnalysisError('');
    setProgress({ stage: 0, progress: 0, message: 'Connecting to backend...' });

    const useLive = apiConfig.useLiveApi;
    try {
      const result = useLive
        ? await analyzeRouteViaBackend(startQuery, destQuery, selectedVehicle, {
            backendUrl: apiConfig.backendUrl, onProgress: setProgress })
        : await evaluateDynamicAlternativeRoutes(startQuery, destQuery, { onProgress: setProgress });

      const now = new Date();
      const newAnalysis = {
        ...result,
        id: 'route_' + now.getTime(),
        startLocation: startQuery,
        destination: destQuery,
        timestamp: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          + ', ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        vehicleId: selectedVehicle.id,
        clearanceMm: selectedVehicle.groundClearance,
      };

      setAnalysis(newAnalysis);
      setActiveRouteIndex(newAnalysis.recommendedRouteIndex || 0);
      setHistoryItems((prev) => [newAnalysis, ...prev.filter((h) => h.id !== newAnalysis.id)].slice(0, 10));
      if (useLive) setBackendOnline(true);

      setTimeout(() => document.getElementById('results-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Analysis error:', err);
      const hint = useLive && !(await checkBackend(apiConfig.backendUrl))
        ? ' Backend is unreachable — start `python api_server.py` or switch to Demo mode in Settings.'
        : '';
      setAnalysisError(`${err.message}.${hint}`);
      if (useLive) pingBackend();
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  const handleSelectAlternativeRoute = (index) => {
    setActiveRouteIndex(index);
    setFocusedHazard(null);
  };

  const handleShareRoute = async () => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      from: routeData.startLocation, to: routeData.destination, vehicle: selectedVehicle.id,
      ...(selectedVehicle.measured ? { mm: selectedVehicle.groundClearance } : {}),
    }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      window.prompt('Copy this link', url.toString());
    }
  };

  const handleSelectHistoryRoute = (item) => {
    setStartLocation(item.startLocation);
    setDestination(item.destination);
    const v = VEHICLE_DATABASE.find((x) => x.id === item.vehicleId);
    if (v) {
      setSelectedVehicle(v);
      setCustomClearance(item.clearanceMm && item.clearanceMm !== v.groundClearance ? item.clearanceMm : null);
    }
    setAnalysis(item);
    setActiveRouteIndex(item.recommendedRouteIndex || 0);
    setFocusedHazard(null);
    setActiveTab('home');
    setTimeout(() => document.getElementById('results-view')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const focusHazardOnMap = (hazard) => {
    setFocusedHazard(hazard);
    setSheetOpen(false); // phone: drop the sheet so the map is visible
  };

  const page = (
    <div className={`app-root ${activeTab === 'home' ? 'gm-fixed' : ''}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => (tab === 'history' ? setIsHistoryModalOpen(true) : setActiveTab(tab))}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        user={auth}
        onLogout={() => setAuth(null)}
        backendOnline={backendOnline}
        liveMode={apiConfig.useLiveApi}
      />

      {notice && (
        <div role="status" style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, padding: '10px 16px', borderRadius: 10, background: '#111', color: '#fff', display: 'flex', gap: 12 }}>
          {notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <main className={`main-content ${activeTab === 'home' ? 'gm-main' : ''}`}>
        {activeTab === 'about' ? (
          <AboutView onBackToHome={() => setActiveTab('home')} />
        ) : activeTab === 'login' || (['report', 'mine', 'admin'].includes(activeTab) && !auth) ? (
          <AuthPage backendUrl={apiConfig.backendUrl} onBack={() => setActiveTab('home')}
            resetToken={resetToken}
            onResetDone={() => { setResetToken(null); window.history.replaceState({}, '', window.location.pathname); }}
            onAuth={(a) => { setAuth(a); if (activeTab === 'login') setActiveTab('home'); }}
            reason={activeTab === 'login' ? '' : 'auth.loginToContinue'} />
        ) : activeTab === 'mine' ? (
          <MyReportsPage backendUrl={apiConfig.backendUrl} token={auth.token} onBack={() => setActiveTab('home')} onChanged={reloadReports} onAuthExpired={() => setAuth(null)} />
        ) : activeTab === 'admin' ? (
          auth.isAdmin
            ? <AdminPage backendUrl={apiConfig.backendUrl} token={auth.token} onBack={() => setActiveTab('home')} onChanged={reloadReports} />
            : <div style={{ padding: 24 }}>Admins only.</div>
        ) : activeTab === 'report' && auth.verified === false ? (
          <VerifyNotice backendUrl={apiConfig.backendUrl} token={auth.token} email={auth.email} onRefresh={refreshMe} onBack={() => setActiveTab('home')} />
        ) : activeTab === 'report' ? (
          mapsKey
            ? <ReportPage token={auth.token} onAuthExpired={() => setAuth(null)} backendUrl={apiConfig.backendUrl} darkMode={darkMode} onBack={() => setActiveTab('home')} initialCenter={routeData?.startCoord ? { lat: routeData.startCoord[0], lng: routeData.startCoord[1] } : undefined} />
            : <div style={{ padding: 24 }}>Google Maps key not available. Start the backend with GOOGLE_MAPS_API_KEY set.</div>
        ) : (
          <div className="gm-shell">
            <div className="gm-map">
              <InteractiveMap
                routeData={routeData}
                focusedHazard={focusedHazard}
                onSelectHazard={(h) => { setFocusedHazard(h); }}
                onSelectRoute={handleSelectAlternativeRoute}
                darkMode={darkMode}
                mapsKey={mapsKey}
                reports={reports}
                onOpenReport={() => setActiveTab('report')}
                onVote={handleVote}
              />
            </div>
            <aside className={`gm-panel ${sheetOpen ? '' : 'collapsed'}`}>
              <button type="button" className="gm-handle" onClick={() => setSheetOpen(!sheetOpen)} aria-label={sheetOpen ? 'Show map' : 'Show details'} aria-expanded={sheetOpen}><span /></button>
            <HeroSection
              startLocation={startLocation}
              setStartLocation={setStartLocation}
              destination={destination}
              setDestination={setDestination}
              selectedVehicle={selectedVehicle}
              setSelectedVehicle={setSelectedVehicle}
              customClearance={customClearance}
              setCustomClearance={setCustomClearance}
              historyItems={historyItems}
              reports={reports}
              onOpenHistoryItem={handleSelectHistoryRoute}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onAnalyze={handleAnalyzeRoute}
              isAnalyzing={isAnalyzing}
              progress={progress}
              analysisError={analysisError}
              liveMode={apiConfig.useLiveApi}
              backendOnline={backendOnline}
              onOpenPicker={() => setIsPickerOpen(true)}
              canPick={!!mapsKey}
            />

            {routeData && <RouteAnalysisResults
              routeData={routeData}
              selectedVehicle={selectedVehicle}
              focusedHazard={focusedHazard}
              onSelectHazard={setFocusedHazard}
              onOpenReport={() => setIsReportOpen(true)}
              onOpenDrive={() => setDriveOpen(true)}
              onOpenAuthority={() => setAuthorityOpen(true)}
              onShareRoute={handleShareRoute}
              onSelectAlternativeRoute={handleSelectAlternativeRoute}
              activeRouteIndex={routeData.activeRouteIndex}
              copiedLink={copiedLink}
              darkMode={darkMode}
              mapsKey={mapsKey}
              isAnalyzing={isAnalyzing}
            />}

            <Directions
              steps={routeData?.alternativeRoutes?.[routeData.activeRouteIndex]?.steps}
              hazards={routeData?.hazards || []}
              onFocusHazard={focusHazardOnMap}
            />

            <DetectedHazards
              hazards={routeData?.hazards || []}
              onFocusHazard={focusHazardOnMap}
              focusedHazardId={focusedHazard?.id}
            />
            </aside>
          </div>
        )}
      </main>

      {activeTab !== 'home' && <Footer onNavHome={() => setActiveTab('home')} onNavAbout={() => setActiveTab('about')} />}

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectHistoryRoute={handleSelectHistoryRoute}
        onClear={() => setHistoryItems([])}
        historyItems={historyItems}
        reports={reports}
      />

      {driveOpen && routeData && (
        <DriveMode routeData={routeData} vehicle={selectedVehicle} auth={auth} backendUrl={apiConfig.backendUrl}
          onClose={() => setDriveOpen(false)} onReported={reloadReports} />
      )}
      {authorityOpen && routeData && <AuthorityReport routeData={routeData} onClose={() => setAuthorityOpen(false)} />}

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        routeData={routeData}
        vehicle={selectedVehicle}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiConfig={apiConfig}
        setApiConfig={setApiConfig}
        backendOnline={backendOnline}
        onTestConnection={pingBackend}
      />

      <MapPickerModal
        isOpen={isPickerOpen && !!mapsKey}
        onClose={() => setIsPickerOpen(false)}
        onConfirm={(from, to) => {
          setStartLocation(from);
          setDestination(to);
          setIsPickerOpen(false);
        }}
        startLocation={startLocation}
        destination={destination}
        darkMode={darkMode}
        initialCenter={routeData?.startCoord ? { lat: routeData.startCoord[0], lng: routeData.startCoord[1] } : null}
      />
    </div>
  );

  // One Maps loader for the whole app (results map + picker). Without a key the page
  // still works; the map panels show how to add one.
  return mapsKey ? <APIProvider apiKey={mapsKey}>{page}</APIProvider> : page;
}

export default App;
