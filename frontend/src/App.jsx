import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import RouteAnalysisResults from './components/RouteAnalysisResults';
import DetectedHazards from './components/DetectedHazards';
import AboutView from './components/AboutView';
import HistoryModal from './components/HistoryModal';
import ReportModal from './components/ReportModal';
import SettingsModal from './components/SettingsModal';
import Footer from './components/Footer';
import MapPickerModal from './components/MapPickerModal';
import { APIProvider } from '@vis.gl/react-google-maps';

import { VEHICLE_DATABASE, DEFAULT_VEHICLE } from './data/vehicles';
import { SAMPLE_ANALYSIS } from './data/sampleRouteData';
import { buildRouteView } from './services/risk';
import { analyzeRouteViaBackend, evaluateDynamicAlternativeRoutes, checkBackend, fetchMapsKey } from './services/routeService';
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
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'about'
  const [darkMode, setDarkMode] = useState(() =>
    loadLocal('rg_dark', window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));

  // Form state
  const [startLocation, setStartLocation] = useState(urlParams.get('from') || SAMPLE_ANALYSIS.startLocation);
  const [destination, setDestination] = useState(urlParams.get('to') || SAMPLE_ANALYSIS.destination);
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
  const [analysis, setAnalysis] = useState(SAMPLE_ANALYSIS);
  const [activeRouteIndex, setActiveRouteIndex] = useState(SAMPLE_ANALYSIS.recommendedRouteIndex);
  const routeData = useMemo(
    () => buildRouteView(analysis, activeRouteIndex, selectedVehicle),
    [analysis, activeRouteIndex, selectedVehicle]
  );

  const [focusedHazard, setFocusedHazard] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(null); // { stage, progress, message }
  const [analysisError, setAnalysisError] = useState('');

  const [historyItems, setHistoryItems] = useState(() => loadLocal('rg_history', []));
  const [apiConfig, setApiConfig] = useState(() => loadLocal('rg_settings', { backendUrl: '', useLiveApi: true }));
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown
  // Google Maps JS key: build-time env wins, else the backend hands out its own key
  const [mapsKey, setMapsKey] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
    if (online && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      const key = await fetchMapsKey(apiConfig.backendUrl);
      if (key) setMapsKey(key);
    }
  }, [apiConfig.backendUrl]);

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
    document.getElementById('results-view')?.scrollIntoView({ behavior: 'smooth' });
  };

  const page = (
    <div className="app-root">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => (tab === 'history' ? setIsHistoryModalOpen(true) : setActiveTab(tab))}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        backendOnline={backendOnline}
        liveMode={apiConfig.useLiveApi}
      />

      <main className="main-content">
        {activeTab === 'about' ? (
          <AboutView onBackToHome={() => setActiveTab('home')} />
        ) : (
          <>
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

            <RouteAnalysisResults
              routeData={routeData}
              selectedVehicle={selectedVehicle}
              focusedHazard={focusedHazard}
              onSelectHazard={setFocusedHazard}
              onOpenReport={() => setIsReportOpen(true)}
              onShareRoute={handleShareRoute}
              onSelectAlternativeRoute={handleSelectAlternativeRoute}
              activeRouteIndex={routeData.activeRouteIndex}
              copiedLink={copiedLink}
              darkMode={darkMode}
              mapsKey={mapsKey}
              isAnalyzing={isAnalyzing}
            />

            <DetectedHazards
              hazards={routeData?.hazards || []}
              onFocusHazard={focusHazardOnMap}
              focusedHazardId={focusedHazard?.id}
            />
          </>
        )}
      </main>

      <Footer onNavHome={() => setActiveTab('home')} onNavAbout={() => setActiveTab('about')} />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectHistoryRoute={handleSelectHistoryRoute}
        onClear={() => setHistoryItems([])}
        historyItems={historyItems}
      />

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
