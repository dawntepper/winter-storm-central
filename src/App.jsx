import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useExtremeWeather } from './hooks/useExtremeWeather';
import { useLocationParam } from './hooks/useLocationParam';
import { getActiveStormEvents } from './services/stormEventsService';
import { STATE_CENTROIDS } from './data/stateCentroids';
import { US_STATES, STATE_NAMES, ABBR_TO_SLUG } from './data/stateConfig';
import Header from './components/Header';
import ZipCodeSearch from './components/ZipCodeSearch';
import StormMap from './components/StormMap';
import ExtremeWeatherSection from './components/ExtremeWeatherSection';
import AlertTimeline from './components/AlertTimeline';
import StateHeatmap from './components/StateHeatmap';
import MostImpactedStates from './components/MostImpactedStates';
import AlertSignupBar from './components/AlertSignupBar';
import {
  startSessionTracking,
  stopSessionTracking,
  trackLocationCountChanged,
  trackAlertTapped,
  trackAlertAddedToMap,
  trackLocationViewedOnMap,
  trackLocationRemoved,
  trackStormBannerClick,
  trackRadarLinkClick,
  trackBrowseByStateClick
} from './utils/analytics';

// Weather condition to icon mapping
const getWeatherIcon = (condition) => {
  if (!condition) return '⛅';
  const c = condition.toLowerCase();

  // Snow
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '❄️';
  // Thunderstorms
  if (c.includes('thunder') || c.includes('tstorm') || c.includes('storm')) return '⛈️';
  // Rain
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
  // Fog/Mist
  if (c.includes('fog') || c.includes('mist') || c.includes('haz')) return '🌫️';
  // Windy
  if (c.includes('wind') || c.includes('breez')) return '💨';
  // Cloudy
  if (c.includes('cloudy') || c.includes('overcast')) {
    if (c.includes('partly') || c.includes('mostly sunny')) return '⛅';
    return '☁️';
  }
  // Clear/Sunny
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return '☀️';
  // Partly conditions
  if (c.includes('partly')) return '⛅';

  return '⛅'; // Default
};

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

// Event type icons
const stormTypeIcons = {
  winter_storm: '❄️',
  hurricane: '🌀',
  severe_weather: '⛈️',
  flooding: '🌊',
  heat_wave: '🌡️',
  wildfire: '🔥',
  default: '⚠️'
};

// Status badge colors
const statusBadgeColors = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  forecasted: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
};

// Active Storm Event Banner - fetches from Supabase
function StormEventBanner() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await getActiveStormEvents();
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  // Don't show anything while loading or if no active events
  if (loading || events.length === 0) return null;

  // Show the most important event (active first, then forecasted by date)
  const sortedEvents = [...events].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return new Date(a.startDate) - new Date(b.startDate);
  });

  const primaryEvent = sortedEvents[0];
  const icon = stormTypeIcons[primaryEvent.type] || stormTypeIcons.default;
  const statusColor = statusBadgeColors[primaryEvent.status] || statusBadgeColors.forecasted;
  const statusLabel = primaryEvent.status === 'active' ? 'Active Now' : 'Forecasted';

  // Format date range
  const startDate = new Date(primaryEvent.startDate + 'T12:00:00');
  const endDate = new Date(primaryEvent.endDate + 'T12:00:00');
  const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <Link
      to={`/storm/${primaryEvent.slug}`}
      onClick={() => trackStormBannerClick({
        stormSlug: primaryEvent.slug,
        stormName: primaryEvent.title,
        source: 'homepage_banner'
      })}
      className={`block border transition-all ${
        primaryEvent.status === 'active'
          ? 'bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border-emerald-500/30 hover:border-emerald-400/50'
          : 'bg-gradient-to-r from-sky-900/80 to-indigo-900/80 border-sky-500/30 hover:border-sky-400/50'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm sm:text-base">
                  {primaryEvent.status === 'active' ? 'Live: ' : 'Tracking: '}{primaryEvent.title}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-sky-200/70 text-xs sm:text-sm">
                {dateRange} • {primaryEvent.affectedStates?.slice(0, 5).join(', ')}{primaryEvent.affectedStates?.length > 5 ? '...' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sky-300 text-sm font-medium">
            <span className="hidden sm:inline">View Tracker</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function App() {

  const [searchLocations, setSearchLocations] = useState([]); // From ZipCodeSearch
  const [alertLocations, setAlertLocations] = useState([]); // From alert "Add to Map"
  const [mapCenterOn, setMapCenterOn] = useState(null);
  const [viewedLocations, setViewedLocations] = useState([]); // Track locations user has clicked
  const [previewCity, setPreviewCity] = useState(null); // City being previewed
  const [yourLocationsExpanded, setYourLocationsExpanded] = useState(true); // Your Locations section collapsed state
  const [highlightedAlertId, setHighlightedAlertId] = useState(null); // Alert ID to highlight on map (hover)
  const [selectedAlertId, setSelectedAlertId] = useState(null); // Alert ID for selected/clicked state (green marker)
  const [selectedStateCode, setSelectedStateCode] = useState(null); // State code to highlight in alert cards
  const [initialLocation, setInitialLocation] = useState(null); // From ?location= URL param
  const [alertFilter, setAlertFilter] = useState(null); // null = national, "PA" = state filter

  // Handle ?location= URL parameter
  const handleLocationParam = useCallback((locationData) => {
    setInitialLocation(locationData);
  }, []);
  useLocationParam(handleLocationParam);

  // Combine search and alert locations for the map
  const userLocations = [...searchLocations, ...alertLocations];

  // Start session tracking on mount
  useEffect(() => {
    startSessionTracking();
    return () => stopSessionTracking();
  }, []);

  // Track location count changes
  useEffect(() => {
    trackLocationCountChanged(userLocations.length);
  }, [userLocations.length]);

  // Extreme weather alerts (for when no active storm event)
  const {
    alerts: alertsData,
    loading: alertsLoading,
    error: alertsError,
    lastUpdated: alertsLastUpdated,
    isStale: alertsIsStale,
    refresh: refreshAlerts,
    getAlertsByCategory,
    hasActiveAlerts
  } = useExtremeWeather(true);

  // Get all categorized alerts for map display
  // Uses byCategory which has ALL alerts per category (matches card badge totals)
  const mapAlerts = alertsData?.byCategory
    ? Object.values(alertsData.byCategory).flat()
    : [];

  // Handle alert tap - center map on that location and track for re-clicking
  const handleAlertTap = (alert) => {
    if (alert.lat && alert.lon) {
      setMapCenterOn({ lat: alert.lat, lon: alert.lon, id: Date.now() });
      setSelectedAlertId(alert.id); // Mark this alert as selected (green marker)
      setSelectedStateCode(null); // Clear any selected state

      // Add to viewed locations if not already there
      setViewedLocations(prev => {
        const exists = prev.some(loc => loc.id === alert.id);
        if (!exists) {
          return [...prev, { ...alert, viewedAt: Date.now() }].slice(-10); // Keep last 10
        }
        return prev;
      });

      // Scroll to map on mobile
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setTimeout(() => {
          document.querySelector('#storm-map-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }

      // Track alert interaction
      trackAlertTapped(alert.category, alert.event);
    }
  };

  // Handle adding alert location to map (separate from search locations)
  const handleAddAlertToMap = (alert) => {
    if (!alert.lat || !alert.lon) return;

    // Create a user location object from the alert
    // Note: conditions are null - we don't have weather data from alerts
    const newLocation = {
      id: `alert-${alert.id}`,
      name: alert.location,
      lat: alert.lat,
      lon: alert.lon,
      forecast: { snowfall: 0, ice: 0 },
      hazardType: alert.category === 'winter' ? 'snow' :
                  alert.category === 'heat' ? 'none' :
                  alert.category === 'flood' ? 'none' : 'none',
      conditions: null, // No weather data from alerts - only alert info
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
    trackAlertAddedToMap(alert.category);
  };

  // Handle removing an alert location from map
  const handleRemoveAlertLocation = (locationId) => {
    const location = alertLocations.find(loc => loc.id === locationId);
    if (location) {
      trackLocationRemoved(location.name);
    }
    setAlertLocations(prev => prev.filter(loc => loc.id !== locationId));
  };

  // Handle removing a search location from map (and localStorage)
  const handleRemoveSearchLocation = (locationId) => {
    // Find location name for tracking before removing
    const location = searchLocations.find(loc => loc.id === locationId);
    if (location) {
      trackLocationRemoved(location.name);
    }

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

      // Track location viewed on map
      trackLocationViewedOnMap(location.name || location.location);

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

  // Handle hovering over an alert in the sidebar (highlight on map)
  const handleHoverAlert = (alertId) => {
    setHighlightedAlertId(alertId);
  };

  // Handle leaving hover on alert
  const handleLeaveAlert = () => {
    setHighlightedAlertId(null);
  };

  // Handle clicking a searched location name to zoom map
  const handleSearchLocationClick = (locationData) => {
    if (locationData.lat && locationData.lon) {
      setMapCenterOn({ lat: locationData.lat, lon: locationData.lon, id: Date.now() });
      // Show preview marker
      setPreviewCity({
        id: locationData.id || `search-${Date.now()}`,
        name: locationData.name,
        lat: locationData.lat,
        lon: locationData.lon
      });

      // Track
      trackLocationViewedOnMap(locationData.name);

      // On mobile, scroll to the map
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setTimeout(() => {
          document.querySelector('#storm-map-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  };

  // Handle state zoom - center map on state centroid
  const handleStateZoom = (stateCode) => {
    const coords = STATE_CENTROIDS[stateCode];
    if (coords) {
      setMapCenterOn({ lat: coords.lat, lon: coords.lon, zoom: 5, id: Date.now() });
      setSelectedStateCode(stateCode);  // Highlight state in alert cards
      setSelectedAlertId(null);  // Clear any selected alert
    }
  };

  const handleMapResetView = () => {
    setSelectedStateCode(null);
    setSelectedAlertId(null);
  };

  return (
    <div className="min-h-screen">
      <Header
        lastRefresh={alertsLastUpdated}
        lastSuccessfulUpdate={alertsLastUpdated}
        onRefresh={refreshAlerts}
        loading={alertsLoading}
        stormPhase="active"
        isStale={alertsIsStale}
      />

      {/* Inline loading/error banners (non-blocking — page still renders) */}
      {alertsLoading && !alertsData && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 text-center">
          <p className="text-sm text-slate-400">Loading weather alerts from NOAA...</p>
        </div>
      )}
      {alertsError && !alertsData && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 text-center">
          <p className="text-sm text-slate-400">
            Unable to load weather data.{' '}
            <button onClick={refreshAlerts} className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer">Try again</button>
          </p>
        </div>
      )}

      {/* Active Storm Event Banner */}
      <StormEventBanner />

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stale Data Warning */}
        <StaleDataBanner isStale={alertsIsStale} lastSuccessfulUpdate={alertsLastUpdated} error={alertsError && alertsData ? alertsError : null} />

        {/* ========== MOBILE LAYOUT ========== */}
        <div className="lg:hidden space-y-4">
          {/* 1. Check Location - TOP on mobile */}
          <div id="location-search-mobile" className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a3d2e', border: '1px solid antiquewhite' }}>
            <ZipCodeSearch stormPhase="active" onLocationsChange={setSearchLocations} onLocationClick={handleSearchLocationClick} initialLocation={initialLocation} />
          </div>

          {/* 2. Your Locations (if any) - Below Check Location - COLLAPSIBLE */}
          {userLocations.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '2px solid #10b981' }}>
              {/* Collapsible Header - dark gray background */}
              <button
                onClick={() => setYourLocationsExpanded(!yourLocationsExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                style={{ minHeight: '48px' }}
              >
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'antiquewhite' }}>
                  <span className="text-emerald-400">&#9733;</span> Your Locations ({userLocations.length})
                </h3>
                <svg
                  className={`w-5 h-5 text-white transition-transform ${yourLocationsExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expandable Content */}
              {yourLocationsExpanded && (
                <>
                  <div>
                    {searchLocations.map((loc, index) => (
                      <div
                        key={loc.id}
                        className={`px-4 py-2.5 hover:bg-slate-600/50 transition-colors border-t border-white/5 ${
                          index % 2 === 1 ? 'bg-slate-700/40' : 'bg-slate-800/30'
                        }`}
                      >
                        {/* Line 1: Icon + City • Alert Status + × */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button
                              onClick={() => handleViewedLocationClick(loc)}
                              className="text-sm text-gray-200 hover:text-emerald-300 cursor-pointer text-left font-semibold flex items-center gap-1.5 truncate"
                            >
                              <span className="flex-shrink-0">{getWeatherIcon(loc.conditions?.shortForecast)}</span>
                              <span className="truncate">{loc.name}</span>
                            </button>
                            <span className="text-slate-500 flex-shrink-0">•</span>
                            {loc.alertInfo ? (
                              <span className="text-xs text-orange-400 truncate flex-shrink-0">⚠️ {loc.alertInfo.event}</span>
                            ) : (
                              <span className="text-xs text-cyan-500 flex-shrink-0">✅ No alerts</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveSearchLocation(loc.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                            title="Remove from map"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Line 2: High/Low · Condition (indented) */}
                        <div className="mt-1 text-xs text-slate-400 pl-6">
                          {loc.conditions?.highTemp != null || loc.conditions?.lowTemp != null ? (
                            <span>
                              {loc.conditions.highTemp != null && <span>H: {loc.conditions.highTemp}°</span>}
                              {loc.conditions.highTemp != null && loc.conditions.lowTemp != null && ' / '}
                              {loc.conditions.lowTemp != null && <span>L: {loc.conditions.lowTemp}°</span>}
                              {' · '}{loc.conditions.shortForecast || 'No data'}
                            </span>
                          ) : loc.conditions?.temperature ? (
                            <span>{loc.conditions.temperature}°{loc.conditions.temperatureUnit || 'F'} · {loc.conditions.shortForecast || 'No data'}</span>
                          ) : (
                            <span>Loading weather data...</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {alertLocations.map((loc, index) => (
                      <div
                        key={loc.id}
                        className={`px-4 py-2.5 hover:bg-slate-600/50 transition-colors border-t border-white/5 ${
                          (searchLocations.length + index) % 2 === 1 ? 'bg-slate-700/40' : 'bg-slate-800/30'
                        }`}
                      >
                        {/* Line 1: Icon + City • Alert Status + × */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button
                              onClick={() => handleViewedLocationClick(loc)}
                              className="text-sm text-gray-200 hover:text-amber-300 cursor-pointer text-left font-semibold flex items-center gap-1.5 truncate"
                            >
                              <span className="flex-shrink-0">{getWeatherIcon(loc.conditions?.shortForecast)}</span>
                              <span className="truncate">{loc.name}</span>
                            </button>
                            <span className="text-slate-500 flex-shrink-0">•</span>
                            <span className="text-xs text-orange-400 truncate flex-shrink-0">⚠️ {loc.alertInfo?.event || 'Weather Alert'}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveAlertLocation(loc.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                            title="Remove from map"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Line 2: High/Low · Condition (indented) */}
                        <div className="mt-1 text-xs text-slate-400 pl-6">
                          {loc.conditions?.highTemp != null || loc.conditions?.lowTemp != null ? (
                            <span>
                              {loc.conditions.highTemp != null && <span>H: {loc.conditions.highTemp}°</span>}
                              {loc.conditions.highTemp != null && loc.conditions.lowTemp != null && ' / '}
                              {loc.conditions.lowTemp != null && <span>L: {loc.conditions.lowTemp}°</span>}
                              {' · '}{loc.conditions.shortForecast || 'No data'}
                            </span>
                          ) : loc.conditions?.temperature ? (
                            <span>{loc.conditions.temperature}°{loc.conditions.temperatureUnit || 'F'} · {loc.conditions.shortForecast || 'No data'}</span>
                          ) : (
                            <span>Loading weather data...</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 text-center">Tap location to view on map · Tap × to remove</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 3. Storm Coverage Map on mobile - Below Your Locations */}
          <div id="storm-map-mobile">
            <StormMap
              weatherData={{}}
              stormPhase="active"
              userLocations={userLocations}
              alerts={mapAlerts}
              isHero
              centerOn={mapCenterOn}
              previewLocation={previewCity}
              highlightedAlertId={highlightedAlertId}
              selectedAlertId={selectedAlertId}
              selectedStateCode={selectedStateCode}
              onResetView={handleMapResetView}
            />
          </div>

          {/* Live Weather Radar section */}
          <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h2 className="text-base font-semibold text-slate-200 mb-2">Live Weather Radar Map</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Track severe weather in real-time with our interactive weather radar map.
              Switch between precipitation radar, satellite infrared, and forecast views
              with multiple color schemes on the full Radar Maps page.
            </p>
            <Link to="/radar" onClick={() => trackRadarLinkClick('homepage_mobile')} className="text-sm text-sky-400 hover:text-sky-300 font-medium">
              Explore Radar Maps →
            </Link>
          </section>

          {/* Quick nav for visualizations (mobile) */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-2">
            <a href="#top-states" className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors">
              Top States
            </a>
            <a href="#alert-heatmap" className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-colors">
              Alert Heatmap
            </a>
            <a href="#extreme-weather" className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition-colors">
              All Alerts
            </a>
          </div>

          {/* Visualizations */}
          <MostImpactedStates alerts={alertsData} loading={alertsLoading} onStateZoom={handleStateZoom} />
          <StateHeatmap alerts={alertsData} loading={alertsLoading} onStateZoom={handleStateZoom} />
          {/* 4. EXTREME WEATHER on mobile */}
          <div id="extreme-weather">
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
            onHoverAlert={handleHoverAlert}
            onLeaveAlert={handleLeaveAlert}
            onStateZoom={handleStateZoom}
            selectedStateCode={selectedStateCode}
          />
          </div>
        </div>

        {/* ========== DESKTOP LAYOUT ========== */}
        <section className="hidden lg:grid lg:grid-cols-[1fr_minmax(0,420px)] xl:grid-cols-[1fr_minmax(0,480px)] gap-4 lg:gap-6 overflow-hidden">
          {/* Left Column: Search + Map */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Check Your Location - Above map on desktop */}
            <div id="location-search">
              <ZipCodeSearch stormPhase="active" onLocationsChange={setSearchLocations} onLocationClick={handleSearchLocationClick} initialLocation={initialLocation} />
            </div>

            {/* Storm Map - Below search on desktop */}
            <div className="lg:min-h-[500px]">
              <StormMap
                weatherData={{}}
                stormPhase="active"
                userLocations={userLocations}
                alerts={mapAlerts}
                isHero
                isSidebar
                centerOn={mapCenterOn}
                previewLocation={previewCity}
                highlightedAlertId={highlightedAlertId}
                selectedAlertId={selectedAlertId}
                selectedStateCode={selectedStateCode}
                onResetView={handleMapResetView}
              />
            </div>

            {/* Live Weather Radar section */}
            <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h2 className="text-base font-semibold text-slate-200 mb-2">Live Weather Radar Map</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-2">
                Track severe weather in real-time with our interactive weather radar map.
                Switch between precipitation radar, satellite infrared, and forecast views.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                Choose from 9 color schemes on the full Radar Maps page. Perfect for tracking
                winter storms, hurricanes, thunderstorms, and other extreme weather events.
              </p>
              <Link to="/radar" onClick={() => trackRadarLinkClick('homepage_desktop')} className="text-sm text-sky-400 hover:text-sky-300 font-medium">
                Explore Radar Maps →
              </Link>
            </section>
          </div>

          {/* Right Column: Your Locations + Extreme Weather */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Your Locations (if any) - COLLAPSIBLE */}
            {userLocations.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 overflow-hidden">
                {/* Collapsible Header - dark gray background */}
                <button
                  onClick={() => setYourLocationsExpanded(!yourLocationsExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'antiquewhite' }}>
                    <span className="text-emerald-400">&#9733;</span> Your Locations ({userLocations.length})
                  </h3>
                  <svg
                    className={`w-5 h-5 text-white transition-transform ${yourLocationsExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expandable Content */}
                {yourLocationsExpanded && (
                  <>
                    <div>
                      {searchLocations.map((loc, index) => (
                        <div
                          key={loc.id}
                          className={`px-4 py-2.5 hover:bg-slate-600/50 transition-colors border-t border-white/5 ${
                            index % 2 === 1 ? 'bg-slate-700/40' : 'bg-slate-800/30'
                          }`}
                        >
                          {/* Line 1: Icon + City • Alert Status + × */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <button
                                onClick={() => handleViewedLocationClick(loc)}
                                className="text-sm text-gray-200 hover:text-emerald-300 cursor-pointer text-left font-semibold flex items-center gap-1.5 truncate"
                              >
                                <span className="flex-shrink-0">{getWeatherIcon(loc.conditions?.shortForecast)}</span>
                                <span className="truncate">{loc.name}</span>
                              </button>
                              <span className="text-slate-500 flex-shrink-0">•</span>
                              {loc.alertInfo ? (
                                <span className="text-xs text-orange-400 truncate flex-shrink-0">⚠️ {loc.alertInfo.event}</span>
                              ) : (
                                <span className="text-xs text-cyan-500 flex-shrink-0">✅ No alerts</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveSearchLocation(loc.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                              title="Remove from map"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Line 2: High/Low · Condition (indented) */}
                          <div className="mt-1 text-xs text-slate-400 pl-6">
                            {loc.conditions?.highTemp != null || loc.conditions?.lowTemp != null ? (
                              <span>
                                {loc.conditions.highTemp != null && <span>H: {loc.conditions.highTemp}°</span>}
                                {loc.conditions.highTemp != null && loc.conditions.lowTemp != null && ' / '}
                                {loc.conditions.lowTemp != null && <span>L: {loc.conditions.lowTemp}°</span>}
                                {' · '}{loc.conditions.shortForecast || 'No data'}
                              </span>
                            ) : loc.conditions?.temperature ? (
                              <span>{loc.conditions.temperature}°{loc.conditions.temperatureUnit || 'F'} · {loc.conditions.shortForecast || 'No data'}</span>
                            ) : (
                              <span>Loading weather data...</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {alertLocations.map((loc, index) => (
                        <div
                          key={loc.id}
                          className={`px-4 py-2.5 hover:bg-slate-600/50 transition-colors border-t border-white/5 ${
                            (searchLocations.length + index) % 2 === 1 ? 'bg-slate-700/40' : 'bg-slate-800/30'
                          }`}
                        >
                          {/* Line 1: Icon + City • Alert Status + × */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <button
                                onClick={() => handleViewedLocationClick(loc)}
                                className="text-sm text-gray-200 hover:text-amber-300 cursor-pointer text-left font-semibold flex items-center gap-1.5 truncate"
                              >
                                <span className="flex-shrink-0">{getWeatherIcon(loc.conditions?.shortForecast)}</span>
                                <span className="truncate">{loc.name}</span>
                              </button>
                              <span className="text-slate-500 flex-shrink-0">•</span>
                              <span className="text-xs text-orange-400 truncate flex-shrink-0">⚠️ {loc.alertInfo?.event || 'Weather Alert'}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveAlertLocation(loc.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                              title="Remove from map"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Line 2: High/Low · Condition (indented) */}
                          <div className="mt-1 text-xs text-slate-400 pl-6">
                            {loc.conditions?.highTemp != null || loc.conditions?.lowTemp != null ? (
                              <span>
                                {loc.conditions.highTemp != null && <span>H: {loc.conditions.highTemp}°</span>}
                                {loc.conditions.highTemp != null && loc.conditions.lowTemp != null && ' / '}
                                {loc.conditions.lowTemp != null && <span>L: {loc.conditions.lowTemp}°</span>}
                                {' · '}{loc.conditions.shortForecast || 'No data'}
                              </span>
                            ) : loc.conditions?.temperature ? (
                              <span>{loc.conditions.temperature}°{loc.conditions.temperatureUnit || 'F'} · {loc.conditions.shortForecast || 'No data'}</span>
                            ) : (
                              <span>Loading weather data...</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 text-center">Tap location to view on map · Tap × to remove</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Visualizations: Most Impacted → Timeline → Risk Index */}
            <MostImpactedStates alerts={alertsData} loading={alertsLoading} onStateZoom={handleStateZoom} />
            <StateHeatmap alerts={alertsData} loading={alertsLoading} onStateZoom={handleStateZoom} />
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
              onHoverAlert={handleHoverAlert}
              onLeaveAlert={handleLeaveAlert}
              onStateZoom={handleStateZoom}
              selectedStateCode={selectedStateCode}
            />
          </div>
        </section>

        {/* Browse by State */}
        <section id="browse-states" className="mt-8 pt-6 border-t border-slate-800">
          <h2 className="text-lg font-semibold text-white mb-1">State Weather Tracker</h2>
          <p className="text-sm text-slate-400 mb-4">Track weather alerts and live radar for your state</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {Object.entries(US_STATES).map(([slug, state]) => {
              const count = alertsData?.allAlerts
                ? alertsData.allAlerts.filter(a => a.state === state.abbr).length
                : 0;
              return (
                <Link
                  key={slug}
                  to={`/alerts/${slug}`}
                  onClick={() => trackBrowseByStateClick({ stateCode: state.abbr, source: 'homepage_grid' })}
                  className="flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm"
                >
                  <span className="text-slate-200 font-medium truncate">{state.name}</span>
                  {count > 0 && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold flex-shrink-0">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-800 space-y-6">
          {/* Footer Links */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link to="/radar" className="text-slate-400 hover:text-sky-400 transition-colors">Weather Radar</Link>
            <span className="text-slate-600">|</span>
            <a href="https://x.com/dawntepper_" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 transition-colors">Contact</a>
          </div>

          {/* SEO Content */}
          <section className="max-w-3xl mx-auto px-4">
            <p className="text-slate-500 text-xs leading-relaxed">
              StormTracking provides live weather radar and real-time severe weather alerts from the National Weather
              Service. Track winter storms, hurricanes, tornadoes, severe thunderstorms, floods, and heat waves
              with interactive radar maps and instant NWS notifications.
            </p>
          </section>

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

      {/* Sticky email signup bar */}
      <AlertSignupBar />
    </div>
  );
}
