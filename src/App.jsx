import { useState } from 'react';
import { useWeatherData } from './hooks/useWeatherData';
import { useExtremeWeather } from './hooks/useExtremeWeather';
import Header from './components/Header';
import ZipCodeSearch from './components/ZipCodeSearch';
import StormMap from './components/StormMap';
import ExtremeWeatherSection from './components/ExtremeWeatherSection';

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4 text-slate-400">📡</div>
        <h2 className="text-xl font-semibold text-white mb-2">Loading Weather Information</h2>
        <p className="text-slate-500 text-sm">Fetching from NOAA Weather Service</p>
        <div className="mt-4 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-slate-500 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 max-w-md w-full">
        <div className="text-3xl mb-4 text-slate-400">📡</div>
        <h2 className="text-lg font-semibold text-white mb-2">Error Loading Data</h2>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, defaultExpanded = false, children }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors cursor-pointer"
      >
        <div>
          <h3 className="text-base font-semibold text-white text-left">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 text-left">{subtitle}</p>}
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

function StaleDataBanner({ isStale, lastSuccessfulUpdate, error }) {
  if (!isStale && !error) return null;

  const formatTime = (date) => {
    if (!date) return 'Unknown';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">&#9888;</span>
          <span className="text-slate-300 font-medium text-sm">
            {error || 'Using cached data - NOAA API temporarily unavailable'}
          </span>
        </div>
        {lastSuccessfulUpdate && (
          <p className="text-slate-400 text-xs">
            Last successful update: {formatTime(lastSuccessfulUpdate)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const {
    weatherData,
    loading,
    error,
    lastRefresh,
    lastSuccessfulUpdate,
    stormPhase,
    isStale,
    refresh,
    getSnowLeaderboard,
    getIceLeaderboard,
    getCitiesGeoOrdered
  } = useWeatherData();

  const [searchLocations, setSearchLocations] = useState([]); // From ZipCodeSearch
  const [alertLocations, setAlertLocations] = useState([]); // From alert "Add to Map"
  const [mapCenterOn, setMapCenterOn] = useState(null);
  const [viewedLocations, setViewedLocations] = useState([]); // Track locations user has clicked
  const [previewCity, setPreviewCity] = useState(null); // City being previewed

  // Combine search and alert locations for the map
  const userLocations = [...searchLocations, ...alertLocations];

  // Extreme weather alerts (for when no active storm event)
  const {
    loading: alertsLoading,
    error: alertsError,
    lastUpdated: alertsLastUpdated,
    isStale: alertsIsStale,
    refresh: refreshAlerts,
    getAlertsByCategory,
    hasActiveAlerts
  } = useExtremeWeather(true);

  // Handle alert tap - center map on that location and track for re-clicking
  const handleAlertTap = (alert) => {
    if (alert.lat && alert.lon) {
      setMapCenterOn({ lat: alert.lat, lon: alert.lon, id: Date.now() });

      // Add to viewed locations if not already there
      setViewedLocations(prev => {
        const exists = prev.some(loc => loc.id === alert.id);
        if (!exists) {
          return [...prev, { ...alert, viewedAt: Date.now() }].slice(-10); // Keep last 10
        }
        return prev;
      });

      // Track alert interaction
      if (window.plausible) {
        window.plausible('Alert Tapped', { props: { category: alert.category, event: alert.event } });
      }
    }
  };

  // Handle adding alert location to map (separate from search locations)
  const handleAddAlertToMap = (alert) => {
    if (!alert.lat || !alert.lon) return;

    // Create a user location object from the alert
    const newLocation = {
      id: `alert-${alert.id}`,
      name: alert.location,
      lat: alert.lat,
      lon: alert.lon,
      forecast: { snowfall: 0, ice: 0 },
      hazardType: alert.category === 'winter' ? 'snow' :
                  alert.category === 'heat' ? 'none' :
                  alert.category === 'flood' ? 'none' : 'none',
      conditions: {
        shortForecast: alert.event,
        temperature: null
      },
      alertInfo: {
        event: alert.event,
        headline: alert.headline,
        category: alert.category
      }
    };

    // Add to alert locations (separate state)
    setAlertLocations(prev => {
      const exists = prev.some(loc => loc.name === alert.location);
      if (!exists) {
        return [...prev, newLocation];
      }
      return prev;
    });

    // Center map on the added location
    setMapCenterOn({ lat: alert.lat, lon: alert.lon, id: Date.now() });

    // On mobile, scroll to the map so user can see the added location
    const isMobile = window.innerWidth < 1024; // lg breakpoint
    if (isMobile) {
      setTimeout(() => {
        document.querySelector('#storm-map-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    // Track
    if (window.plausible) {
      window.plausible('Alert Added to Map', { props: { category: alert.category } });
    }
  };

  // Handle removing an alert location from map
  const handleRemoveAlertLocation = (locationId) => {
    setAlertLocations(prev => prev.filter(loc => loc.id !== locationId));
  };

  // Handle removing a search location from map (and localStorage)
  const handleRemoveSearchLocation = (locationId) => {
    // Remove from state
    setSearchLocations(prev => prev.filter(loc => loc.id !== locationId));

    // Also update localStorage to keep ZipCodeSearch in sync
    const LOCATIONS_KEY = 'winterStorm_userLocations';
    try {
      const stored = localStorage.getItem(LOCATIONS_KEY);
      if (stored) {
        const savedLocations = JSON.parse(stored);
        // Find and remove the location by matching the id
        const locationKey = locationId.replace('user-', '');
        if (savedLocations[locationKey]) {
          delete savedLocations[locationKey];
          localStorage.setItem(LOCATIONS_KEY, JSON.stringify(savedLocations));
        }
      }
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
  };

  // Handle clicking a viewed location to re-center map and show marker
  const handleViewedLocationClick = (location) => {
    if (location.lat && location.lon) {
      setMapCenterOn({ lat: location.lat, lon: location.lon, id: Date.now() });
      // Show preview marker with the location name
      setPreviewCity({
        id: location.id,
        name: location.name || location.location, // alerts use 'location', cities use 'name'
        lat: location.lat,
        lon: location.lon
      });

      // On mobile, scroll to the map so user can see the location
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      if (isMobile) {
        setTimeout(() => {
          document.querySelector('#storm-map-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  };

  // Scroll to location search
  const handleAddLocation = () => {
    document.querySelector('#location-search')?.scrollIntoView({ behavior: 'smooth' });
  };

  const hasData = Object.keys(weatherData).length > 0;

  if (loading && !hasData) {
    return <LoadingState />;
  }

  if (error && !hasData) {
    return <ErrorState error={error} onRetry={refresh} />;
  }

  return (
    <div className="min-h-screen">
      <Header
        lastRefresh={lastRefresh}
        lastSuccessfulUpdate={lastSuccessfulUpdate}
        onRefresh={refresh}
        loading={loading}
        stormPhase={stormPhase}
        isStale={isStale}
      />

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stale Data Warning */}
        <StaleDataBanner isStale={isStale} lastSuccessfulUpdate={lastSuccessfulUpdate} error={error && hasData ? error : null} />

        {/* ========== MOBILE LAYOUT ========== */}
        <div className="lg:hidden space-y-4">
          {/* 1. Your Locations (if any) - TOP on mobile */}
          {userLocations.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl border border-emerald-500/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-500/20">
                <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                  <span>&#9733;</span> Your Locations ({userLocations.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {searchLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between px-4 hover:bg-slate-700/30 transition-colors"
                    style={{ minHeight: '48px' }}
                  >
                    <button
                      onClick={() => handleViewedLocationClick(loc)}
                      className="flex-1 flex items-center gap-2 py-3 text-sm text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer text-left"
                    >
                      <span>📍</span>
                      <span>{loc.name}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveSearchLocation(loc.id)}
                      className="ml-6 p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove from map"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {alertLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between px-4 hover:bg-slate-700/30 transition-colors"
                    style={{ minHeight: '48px' }}
                  >
                    <button
                      onClick={() => handleViewedLocationClick(loc)}
                      className="flex-1 flex items-center gap-2 py-3 text-sm text-amber-400 hover:text-amber-300 hover:underline cursor-pointer text-left"
                    >
                      <span>📍</span>
                      <span>{loc.name}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveAlertLocation(loc.id)}
                      className="ml-6 p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove from map"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 text-center">Tap location to view on map</p>
              </div>
            </div>
          )}

          {/* 2. EXTREME WEATHER - KEY FEATURE on mobile */}
          <ExtremeWeatherSection
            categories={getAlertsByCategory()}
            loading={alertsLoading}
            error={alertsError}
            lastUpdated={alertsLastUpdated}
            isStale={alertsIsStale}
            onRefresh={refreshAlerts}
            onAlertTap={handleAlertTap}
            onAddToMap={handleAddAlertToMap}
            onAddLocation={handleAddLocation}
          />

          {/* 3. Check Your Location - Above map on mobile */}
          <div id="location-search-mobile">
            <ZipCodeSearch stormPhase={stormPhase} onLocationsChange={setSearchLocations} />
          </div>

          {/* 4. Storm Coverage Map on mobile */}
          <div id="storm-map-mobile">
            <StormMap
              weatherData={weatherData}
              stormPhase={stormPhase}
              userLocations={userLocations}
              isHero
              centerOn={mapCenterOn}
              previewLocation={previewCity}
            />
          </div>
        </div>

        {/* ========== DESKTOP LAYOUT ========== */}
        <section className="hidden lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-4 lg:gap-6">
          {/* Left Column: Search + Map */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Check Your Location - Above map on desktop */}
            <div id="location-search">
              <ZipCodeSearch stormPhase={stormPhase} onLocationsChange={setSearchLocations} />
            </div>

            {/* Storm Map - Below search on desktop */}
            <div className="lg:min-h-[500px]">
              <StormMap
                weatherData={weatherData}
                stormPhase={stormPhase}
                userLocations={userLocations}
                isHero
                isSidebar
                centerOn={mapCenterOn}
                previewLocation={previewCity}
              />
            </div>
          </div>

          {/* Right Column: Your Locations + Extreme Weather */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Your Locations (if any) */}
            {userLocations.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl border border-emerald-500/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-emerald-500/20">
                  <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    <span>&#9733;</span> Your Locations ({userLocations.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {searchLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-700/30 transition-colors"
                    >
                      <button
                        onClick={() => handleViewedLocationClick(loc)}
                        className="flex-1 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer text-left"
                      >
                        <span>📍</span>
                        <span>{loc.name}</span>
                      </button>
                      <button
                        onClick={() => handleRemoveSearchLocation(loc.id)}
                        className="ml-6 p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from map"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {alertLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-700/30 transition-colors"
                    >
                      <button
                        onClick={() => handleViewedLocationClick(loc)}
                        className="flex-1 flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 hover:underline cursor-pointer text-left"
                      >
                        <span>📍</span>
                        <span>{loc.name}</span>
                      </button>
                      <button
                        onClick={() => handleRemoveAlertLocation(loc.id)}
                        className="ml-6 p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from map"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 text-center">Tap location to view on map</p>
                </div>
              </div>
            )}

            {/* Recently Viewed Locations */}
            {viewedLocations.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Recently Viewed</h3>
                <div className="flex flex-wrap gap-2">
                  {viewedLocations.slice().reverse().map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleViewedLocationClick(loc)}
                      className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {loc.location}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EXTREME WEATHER - KEY FEATURE */}
            <ExtremeWeatherSection
              categories={getAlertsByCategory()}
              loading={alertsLoading}
              error={alertsError}
              lastUpdated={alertsLastUpdated}
              isStale={alertsIsStale}
              onRefresh={refreshAlerts}
              onAlertTap={handleAlertTap}
              onAddToMap={handleAddAlertToMap}
              onAddLocation={handleAddLocation}
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-800 space-y-4">
          {/* Ko-fi Support */}
          <a
            href="https://ko-fi.com/dawntepper"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-400 text-sm transition-colors border border-slate-700 hover:border-amber-500/30 cursor-pointer"
          >
            <span className="text-lg">&#9749;</span>
            <span>Support StormTracking</span>
          </a>

          <p className="text-slate-500 text-xs max-w-2xl mx-auto px-4">
            <span className="font-medium text-slate-400">Disclaimer:</span> StormTracking uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
            <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline cursor-pointer">weather.gov</a>
            {' '}and follow local emergency management guidance. Not affiliated with NOAA or NWS.
          </p>
        </footer>
      </main>
    </div>
  );
}
