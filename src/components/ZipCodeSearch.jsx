import { useState, useEffect, useRef, useCallback } from 'react';
import { trackLocationAdded, trackLocationRemoved, trackGeolocationUsed, SAVE_TRIGGERS } from '../utils/analytics';
import { STATE_NAMES } from '../data/stateConfig';
import { getCitiesForState, resolveCityByName } from '../services/locationCatalogService';
import { reverseGeocode } from '../services/geoLocationService';

const LOCATIONS_KEY = 'winterStorm_userLocations';

const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));


// Fetch coordinates from zip code using Zippopotam.us (free, CORS-friendly)
async function getCoordinatesFromZip(zip) {
  const url = `https://api.zippopotam.us/us/${zip}`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Zip code not found');
    }
    throw new Error('Geocoding service unavailable');
  }

  const data = await response.json();
  const place = data.places?.[0];

  if (!place) {
    throw new Error('Zip code not found');
  }

  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    name: `${place['place name']}, ${place['state abbreviation']}`,
    zip
  };
}

// Fetch weather data for coordinates (same logic as useWeatherData)
async function fetchWeatherForLocation(lat, lon, name, zip) {
  const STORM_START = new Date('2026-01-24T00:00:00Z');
  const STORM_END = new Date('2026-01-27T00:00:00Z');

  const getStormPhase = () => {
    const now = new Date();
    if (now < STORM_START) return 'pre-storm';
    if (now >= STORM_START && now < STORM_END) return 'active';
    return 'post-storm';
  };

  const parseAccumulation = (data, property, onlyPast = false) => {
    if (!data?.properties?.[property]?.values) return 0;
    const values = data.properties[property].values;
    const now = new Date();
    let total = 0;
    for (const entry of values) {
      const [timeStr] = entry.validTime.split('/');
      const entryTime = new Date(timeStr);
      if (entryTime >= STORM_START && entryTime < STORM_END) {
        if (onlyPast && entryTime > now) continue;
        const valueInInches = entry.value ? entry.value * 0.0393701 : 0;
        total += valueInInches;
      }
    }
    return Math.round(total * 100) / 100;
  };

  try {
    // Get NOAA grid point
    const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    console.log('Fetching NOAA data for:', pointsUrl);

    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        'User-Agent': 'WinterStormCentral/1.0 (contact@example.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointsResponse.ok) {
      const errorText = await pointsResponse.text();
      console.error('NOAA points API error:', pointsResponse.status, errorText);
      if (pointsResponse.status === 404) {
        throw new Error('Location outside NOAA coverage area');
      }
      throw new Error(`NOAA service error (${pointsResponse.status})`);
    }

    const pointsData = await pointsResponse.json();
    const forecastGridDataUrl = pointsData.properties.forecastGridData;
    const forecastUrl = pointsData.properties.forecast;

    // Fetch grid data and forecast
    const [gridResponse, forecastResponse] = await Promise.all([
      fetch(forecastGridDataUrl, {
        headers: { 'User-Agent': 'WinterStormCentral/1.0', 'Accept': 'application/geo+json' }
      }),
      fetch(forecastUrl, {
        headers: { 'User-Agent': 'WinterStormCentral/1.0', 'Accept': 'application/geo+json' }
      })
    ]);

    if (!gridResponse.ok) {
      throw new Error('Weather data unavailable');
    }

    const gridData = await gridResponse.json();
    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;

    // Parse accumulation data
    const forecastSnow = parseAccumulation(gridData, 'snowfallAmount', false);
    const forecastIce = parseAccumulation(gridData, 'iceAccumulation', false);
    const observedSnow = parseAccumulation(gridData, 'snowfallAmount', true);
    const observedIce = parseAccumulation(gridData, 'iceAccumulation', true);

    // Get forecast conditions (first two periods for high/low)
    const periods = forecastData?.properties?.periods || [];
    const firstPeriod = periods[0] || {};
    const secondPeriod = periods[1] || {};

    // Extract high and low temps from day/night periods
    let highTemp = null;
    let lowTemp = null;

    if (firstPeriod.isDaytime) {
      highTemp = firstPeriod.temperature;
      lowTemp = secondPeriod.temperature;
    } else {
      lowTemp = firstPeriod.temperature;
      highTemp = secondPeriod.temperature;
    }

    // Determine hazard type
    let hazardType = 'none';
    if (forecastIce > 0.25 && forecastSnow > 2) hazardType = 'mixed';
    else if (forecastIce > 0.1) hazardType = 'ice';
    else if (forecastSnow > 0) hazardType = 'snow';

    // Determine ice danger level
    let iceDanger = 'safe';
    if (forecastIce >= 0.5) iceDanger = 'catastrophic';
    else if (forecastIce >= 0.25) iceDanger = 'dangerous';
    else if (forecastIce > 0) iceDanger = 'caution';

    return {
      id: `user-${zip}`,
      zip,
      name,
      lat,
      lon,
      forecast: { snowfall: forecastSnow, ice: forecastIce },
      observed: { snowfall: observedSnow, ice: observedIce },
      hazardType,
      iceDanger,
      stormPhase: getStormPhase(),
      conditions: {
        shortForecast: firstPeriod.shortForecast || 'Unknown',
        temperature: firstPeriod.temperature,
        temperatureUnit: firstPeriod.temperatureUnit || 'F',
        highTemp,
        lowTemp,
        periodName: firstPeriod.name || 'Today'
      },
      lastUpdated: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    throw error;
  }
}

// Color configs (matching CityCards)
const hazardColors = {
  snow: 'border-sky-300/30 bg-slate-800',
  ice: 'border-fuchsia-400/30 bg-slate-800',
  mixed: 'border-slate-400/30 bg-slate-800',
  none: 'border-slate-700 bg-slate-800/50'
};

const hazardLabels = {
  snow: { text: 'Snow', class: 'text-sky-300' },
  ice: { text: 'Ice', class: 'text-fuchsia-400' },
  mixed: { text: 'Mixed', class: 'text-slate-400' },
  none: { text: 'Clear', class: 'text-slate-500' }
};

const dangerBadges = {
  catastrophic: { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  dangerous: { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  caution: { label: 'Caution', class: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  safe: null
};

// Weather icon helper
const getWeatherIcon = (condition) => {
  if (!condition) return '⛅';
  const c = condition.toLowerCase();
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '❄️';
  if (c.includes('cold') || c.includes('freez')) return '🥶';
  if (c.includes('thunder') || c.includes('tstorm') || c.includes('storm')) return '⛈️';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haz')) return '🌫️';
  if (c.includes('wind') || c.includes('breez')) return '💨';
  if (c.includes('cloudy') || c.includes('overcast')) {
    if (c.includes('partly') || c.includes('mostly sunny')) return '⛅';
    return '☁️';
  }
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return '☀️';
  if (c.includes('partly')) return '⛅';
  return '⛅';
};

function UserLocationCard({ data, isOnMap, onToggleMap, onRemove, onDismiss, stormPhase }) {
  return (
    <div className="rounded-xl px-4 py-3 border border-slate-700 bg-slate-800">
      {/* Single-line layout: City • Alert • Forecast • Add to Map • X */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="font-semibold text-white whitespace-nowrap">
          {getWeatherIcon(data.conditions?.shortForecast)} {data.name}
        </span>
        <span className="text-slate-500">•</span>
        {data.alertInfo ? (
          <span className="text-xs text-orange-400 whitespace-nowrap">⚠️ {data.alertInfo.event}</span>
        ) : (
          <span className="text-xs text-cyan-500 whitespace-nowrap">✓ No active alerts</span>
        )}
        <span className="text-slate-500">•</span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {data.conditions?.temperature ? (
            <>{data.conditions.temperature}°{data.conditions.temperatureUnit || 'F'} · {data.conditions.shortForecast || ''}</>
          ) : (
            <>Loading...</>
          )}
        </span>
        <span className="text-slate-500">•</span>
        <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={isOnMap}
            onChange={(e) => onToggleMap(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
          />
          <span className="text-xs text-slate-300">Add to Map</span>
        </label>
        <button
          onClick={isOnMap ? onDismiss : onRemove}
          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 ml-auto flex-shrink-0"
          title={isOnMap ? "Close card" : "Remove"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ZipCodeSearch({
  stormPhase,
  totalLocationCount = 0,
  onLocationsChange,
  onLocationClick,
  initialLocation,
  onLocate,
  onResolveState,
  onLocationResolved,
  variant = 'default',
}) {
  const isCompact = variant === 'compact';
  const [zip, setZip] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [catalogCities, setCatalogCities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchMode, setSearchMode] = useState('zip'); // 'city' or 'zip' — zip is the default so users can find their location fastest; URL initial location handlers below override based on the incoming type ('zip' / 'search')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [isCardDismissed, setIsCardDismissed] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityDropdownShowAll, setCityDropdownShowAll] = useState(false);
  const cityInputRef = useRef(null);
  const cityDropdownRef = useRef(null);
  const suppressCityDropdownOpenRef = useRef(false);

  // Mobile collapse state - collapsed by default on mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isExpanded, setIsExpanded] = useState(false);

  // Track whether we've processed the initial location
  const [initialProcessed, setInitialProcessed] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | locating | denied | unsupported | error

  // Store all saved locations with their map visibility
  const [savedLocations, setSavedLocations] = useState({}); // { id: { data, onMap } }

  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load saved locations on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCATIONS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedLocations(parsed);

        // Notify parent of locations that are on the map
        if (onLocationsChange) {
          const onMapLocations = Object.values(parsed)
            .filter(loc => loc.onMap)
            .map(loc => loc.data);
          onLocationsChange(onMapLocations);
        }
      } catch (e) {
        console.error('Error loading saved locations:', e);
      }
    }
  }, []);

  // Re-hydrate when another part of the app mutates saved locations (e.g. the
  // "Your Locations" widget removing a pin). Without this, our in-memory copy
  // goes stale and a later add here merges onto it — resurrecting locations the
  // user already deleted.
  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem(LOCATIONS_KEY);
        setSavedLocations(stored ? JSON.parse(stored) : {});
      } catch (e) {
        console.error('Error re-reading saved locations:', e);
      }
    };
    window.addEventListener('savedLocationsChanged', handler);
    return () => window.removeEventListener('savedLocationsChanged', handler);
  }, []);

  // Expand when hero "Change Location" scrolls here (App.jsx dispatches this).
  useEffect(() => {
    const handler = () => setIsExpanded(true);
    window.addEventListener('checkLocationExpand', handler);
    return () => window.removeEventListener('checkLocationExpand', handler);
  }, []);

  // Load catalog cities when a state is selected (same source as state alert pages).
  useEffect(() => {
    if (!selectedState) {
      setCatalogCities([]);
      return undefined;
    }
    let cancelled = false;
    setCatalogLoading(true);
    getCitiesForState(selectedState).then((rows) => {
      if (!cancelled) {
        setCatalogCities(rows);
        setCatalogLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  // Close city dropdown when clicking outside
  useEffect(() => {
    if (!cityDropdownOpen) return undefined;
    const handleClickOutside = (e) => {
      if (cityDropdownRef.current?.contains(e.target)) return;
      setCityDropdownOpen(false);
      setCityDropdownShowAll(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cityDropdownOpen]);

  const resolveStateCode = (stateInput) => {
    const upper = String(stateInput || '').trim().toUpperCase();
    if (STATE_NAMES[upper]) return upper;
    const match = STATE_OPTIONS.find(([, name]) => name.toLowerCase() === upper.toLowerCase());
    return match ? match[0] : null;
  };

  // Handle initial location from URL parameter
  useEffect(() => {
    if (!initialLocation || initialProcessed) return;
    setInitialProcessed(true);

    if (initialLocation.type === 'zip') {
      setIsExpanded(true);
      setSearchMode('zip');
      setZip(initialLocation.value);
      fetchLocationWeather(initialLocation.value);
    } else if (initialLocation.type === 'search') {
      const value = initialLocation.value;
      const parts = value.split(',').map((s) => s.trim());

      if (parts.length === 2) {
        const cityName = parts[0];
        const stateCode = resolveStateCode(parts[1]);

        if (stateCode) {
          setIsExpanded(true);
          setSearchMode('city');
          setSelectedState(stateCode);
          setCityQuery(cityName);

          resolveCityByName(cityName, stateCode, []).then(async (resolved) => {
            if (resolved.city) {
              const weather = await fetchCityWeather(stateCode, resolved.city);
              if (weather && onLocationClick) {
                onLocationClick(weather);
              }
            }
          });
        }
      }
    }
  }, [initialLocation, initialProcessed]);

  // Save to localStorage whenever savedLocations changes
  const updateSavedLocations = (newLocations) => {
    setSavedLocations(newLocations);
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(newLocations));

    // Notify parent of locations that are on the map
    if (onLocationsChange) {
      const onMapLocations = Object.values(newLocations)
        .filter(loc => loc.onMap)
        .map(loc => loc.data);
      onLocationsChange(onMapLocations);
    }
  };

  const fetchLocationWeather = async (zipCode) => {
    setLoading(true);
    setError(null);
    setIsCardDismissed(false);

    try {
      console.log('Looking up zip code:', zipCode);
      const coords = await getCoordinatesFromZip(zipCode);
      console.log('Got coordinates:', coords);
      const weather = await fetchWeatherForLocation(coords.lat, coords.lon, coords.name, zipCode);
      console.log('Got weather data:', weather);

      setCurrentLocationData(weather);

      if (onLocationClick) onLocationClick(weather);
      const zipParts = weather.name?.split(', ');
      if (zipParts?.length >= 2) {
        onLocationResolved?.({ city: zipParts[0], region: zipParts[1] });
        onResolveState?.(zipParts[1]);
      }

      // Check if this zip already exists in saved locations
      const existingLocation = savedLocations[zipCode];
      if (existingLocation) {
        // Update the data but keep the onMap setting
        const newLocations = {
          ...savedLocations,
          [zipCode]: { ...existingLocation, data: weather }
        };
        updateSavedLocations(newLocations);
      }
    } catch (err) {
      console.error('Zip code search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setCurrentLocationData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCityWeather = async (stateCode, cityData) => {
    setLoading(true);
    setError(null);
    setIsCardDismissed(false);

    const cityId = cityData.slug
      || `${cityData.name}-${stateCode}`.toLowerCase().replace(/\s+/g, '-');
    const cityName = `${cityData.name}, ${stateCode}`;

    try {
      console.log('Looking up city:', cityName);
      const weather = await fetchWeatherForLocation(cityData.lat, cityData.lon, cityName, cityId);
      weather.id = `user-${cityId}`;
      console.log('Got weather data:', weather);

      setCurrentLocationData(weather);

      // Check if this city already exists in saved locations
      const existingLocation = savedLocations[cityId];
      if (existingLocation) {
        const newLocations = {
          ...savedLocations,
          [cityId]: { ...existingLocation, data: weather }
        };
        updateSavedLocations(newLocations);
      }

      return weather;
    } catch (err) {
      console.error('City search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setCurrentLocationData(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanZip = zip.trim();

    if (!/^\d{5}$/.test(cleanZip)) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    fetchLocationWeather(cleanZip);
  };

  const handleToggleMap = (locationId, checked) => {
    const locationData = (currentLocationData?.zip === locationId || currentLocationData?.id === `user-${locationId}`)
      ? currentLocationData
      : savedLocations[locationId]?.data;

    if (!locationData) return;

    if (checked) {
      trackLocationAdded({
        trigger: SAVE_TRIGGERS.CHECK_LOCATION_BUTTON,
        locationName: locationData.name,
        previousCount: totalLocationCount
      });
    } else {
      trackLocationRemoved({
        trigger: SAVE_TRIGGERS.CHECK_LOCATION_BUTTON,
        locationName: locationData.name,
        remainingCount: totalLocationCount - 1
      });
    }

    const newLocations = {
      ...savedLocations,
      [locationId]: { data: locationData, onMap: checked }
    };

    // If unchecking and it's not the current search, remove it entirely
    const currentId = currentLocationData?.zip || currentLocationData?.id?.replace('user-', '');
    if (!checked && locationId !== currentId) {
      delete newLocations[locationId];
    }

    updateSavedLocations(newLocations);
  };

  const handleRemove = () => {
    if (!currentLocationData) return;

    if (isCurrentOnMap) {
      trackLocationRemoved({
        trigger: SAVE_TRIGGERS.CHECK_LOCATION_BUTTON,
        locationName: currentLocationData.name,
        remainingCount: totalLocationCount - 1
      });
    }

    const locationId = currentLocationData.zip || currentLocationData.id?.replace('user-', '');
    const newLocations = { ...savedLocations };
    delete newLocations[locationId];

    updateSavedLocations(newLocations);
    setCurrentLocationData(null);
    setZip('');
    setCityQuery('');
  };

  const handleDismissCard = () => {
    setIsCardDismissed(true);
  };

  const handleCitySelect = async (e) => {
    e?.preventDefault?.();
    setError(null);
    const trimmed = cityQuery.trim();
    if (!selectedState || !trimmed) {
      setError('Select a state and enter a city name');
      return;
    }

    try {
      const resolved = await resolveCityByName(trimmed, selectedState, []);
      if (!resolved.city) {
        setError(`City "${trimmed}" not found in ${STATE_NAMES[selectedState] || selectedState}`);
        return;
      }
      setCityQuery(resolved.city.name);
      suppressCityDropdownOpenRef.current = true;
      closeCityDropdown();
      const weather = await fetchCityWeather(selectedState, resolved.city);
      if (weather) {
        onLocationClick?.(weather);
        onLocationResolved?.({ city: resolved.city.name, region: selectedState });
        onResolveState?.(selectedState);
      }
    } catch (err) {
      console.error('City search error:', err);
      setError('Failed to look up city');
    }
  };

  const currentLocationId = currentLocationData?.zip || currentLocationData?.id?.replace('user-', '');
  const isCurrentOnMap = currentLocationData
    ? savedLocations[currentLocationId]?.onMap || false
    : false;

  const filteredCities = cityDropdownShowAll || !cityQuery.trim()
    ? catalogCities
    : catalogCities.filter((city) =>
        city.name.toLowerCase().includes(cityQuery.trim().toLowerCase())
      );

  const closeCityDropdown = () => {
    setCityDropdownOpen(false);
    setCityDropdownShowAll(false);
  };

  const handleCityPick = (cityName) => {
    setCityQuery(cityName);
    suppressCityDropdownOpenRef.current = true;
    closeCityDropdown();
    setError(null);
  };

  const toggleCityDropdown = () => {
    if (!selectedState || catalogLoading) return;
    if (cityDropdownOpen) {
      suppressCityDropdownOpenRef.current = true;
      closeCityDropdown();
    } else {
      setCityDropdownShowAll(true);
      setCityDropdownOpen(true);
      cityInputRef.current?.focus();
    }
  };

  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setGpsStatus('locating');
    if (!isCompact) setIsExpanded(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        trackGeolocationUsed();
        onLocate?.({
          lat: latitude,
          lon: longitude,
          zoom: 9,
          id: `nearme-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
        });
        const place = await reverseGeocode(latitude, longitude);
        if (place?.city) {
          const resolved = { city: place.city, region: place.region || null };
          onLocationResolved?.(resolved);
          if (place.region) onResolveState?.(place.region);
        }
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [onLocate, onResolveState, onLocationResolved, isCompact]);

  const gpsButton = (
    <button
      type="button"
      onClick={handleUseMyLocation}
      disabled={gpsStatus === 'locating'}
      aria-label="Use my device location"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-300 hover:text-sky-200 border border-sky-500/30 hover:border-sky-500/50 rounded-md bg-sky-500/10 hover:bg-sky-500/15 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
    >
      <span aria-hidden="true">🎯</span>
      {gpsStatus === 'locating' ? 'Locating…' : 'Use My Location'}
    </button>
  );

  const gpsStatusMessage = gpsStatus === 'unsupported' ? (
    <span className="text-[11px] text-amber-400">Geolocation unavailable on this device.</span>
  ) : gpsStatus === 'error' ? (
    <span className="text-[11px] text-amber-400">Couldn&apos;t get your location — try again.</span>
  ) : gpsStatus === 'denied' ? (
    <span className="text-[11px] text-amber-400">Location access blocked in browser settings.</span>
  ) : null;

  const modeToggle = (
    <div className={`flex items-center gap-1 text-xs shrink-0 ${isCompact ? '' : 'ml-auto'}`}>
      <button
        type="button"
        onClick={() => setSearchMode('city')}
        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
          searchMode === 'city'
            ? 'bg-sky-600 text-white'
            : 'text-slate-400 hover:text-slate-300'
        }`}
      >
        By City
      </button>
      <span className="text-slate-600">/</span>
      <button
        type="button"
        onClick={() => setSearchMode('zip')}
        className={`px-2 py-1 rounded transition-colors cursor-pointer ${
          searchMode === 'zip'
            ? 'bg-sky-600 text-white'
            : 'text-slate-400 hover:text-slate-300'
        }`}
      >
        By Zip
      </button>
    </div>
  );

  const cityFormClass = isCompact
    ? 'flex flex-wrap items-center gap-2 min-w-0'
    : 'flex flex-col sm:flex-row gap-2 max-w-lg';
  const zipFormClass = isCompact ? 'flex items-center gap-2 min-w-0' : 'flex gap-2 max-w-md';
  const submitButtonClass = isCompact
    ? 'px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer shrink-0'
    : 'px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg transition-colors cursor-pointer';
  const inputClass = isCompact
    ? 'bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 transition-colors'
    : 'flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 transition-colors';

  const locationResult = currentLocationData && !isCardDismissed ? (
    <div className={isCompact ? 'mt-2 pt-2 border-t border-slate-700/50' : 'mt-3 pt-3 border-t border-slate-700/50'}>
      <div className="flex items-center gap-3 overflow-x-auto">
        <button
          onClick={() => {
            if (onLocationClick && currentLocationData.lat && currentLocationData.lon) {
              onLocationClick(currentLocationData);
            }
          }}
          className="font-semibold text-white whitespace-nowrap hover:text-emerald-300 transition-colors cursor-pointer"
        >
          {getWeatherIcon(currentLocationData.conditions?.shortForecast)} {currentLocationData.name}
        </button>
        <span className="text-slate-500">•</span>
        {currentLocationData.alertInfo ? (
          <span className="text-xs text-orange-400 whitespace-nowrap">⚠️ {currentLocationData.alertInfo.event}</span>
        ) : (
          <span className="text-xs text-cyan-500 whitespace-nowrap">✓ No active alerts</span>
        )}
        <span className="text-slate-500">•</span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {currentLocationData.conditions?.highTemp != null || currentLocationData.conditions?.lowTemp != null ? (
            <>
              {currentLocationData.conditions.highTemp != null && <span>H: {currentLocationData.conditions.highTemp}°</span>}
              {currentLocationData.conditions.highTemp != null && currentLocationData.conditions.lowTemp != null && ' / '}
              {currentLocationData.conditions.lowTemp != null && <span>L: {currentLocationData.conditions.lowTemp}°</span>}
              {' · '}{currentLocationData.conditions.shortForecast || ''}
            </>
          ) : currentLocationData.conditions?.temperature ? (
            <>{currentLocationData.conditions.temperature}°{currentLocationData.conditions.temperatureUnit || 'F'} · {currentLocationData.conditions.shortForecast || ''}</>
          ) : (
            <>Loading...</>
          )}
        </span>
        <button
          onClick={isCurrentOnMap ? handleDismissCard : handleRemove}
          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 ml-auto flex-shrink-0"
          title={isCurrentOnMap ? 'Close' : 'Remove'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isCurrentOnMap}
            onChange={(e) => handleToggleMap(currentLocationId, e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
          />
          <span className="text-xs text-slate-300">Save Location</span>
        </label>
      </div>
    </div>
  ) : null;

  const searchForms = searchMode === 'city' ? (
          <form onSubmit={handleCitySelect} className={cityFormClass}>
            <select
              value={selectedState}
              onChange={(e) => {
                const nextState = e.target.value;
                if (nextState === selectedState) return;
                setSelectedState(nextState);
                setCityQuery('');
                closeCityDropdown();
                setError(null);
              }}
              className={`${isCompact ? 'w-36' : 'flex-1'} bg-slate-900 border border-slate-600 rounded-lg ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'} text-white text-sm focus:outline-none focus:border-sky-500 transition-colors`}
            >
              <option value="">Select State</option>
              {STATE_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <div className={`relative ${isCompact ? 'w-40 sm:w-48' : 'flex-1'} min-w-0 overflow-visible`} ref={cityDropdownRef}>
              <div
                className={`flex items-center gap-1 w-full bg-slate-900 border border-slate-600 rounded-lg ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'} text-white text-sm focus-within:border-sky-500 transition-colors ${
                  !selectedState || catalogLoading ? 'opacity-50' : ''
                }`}
              >
                <input
                  ref={cityInputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={cityDropdownOpen}
                  aria-autocomplete="list"
                  aria-controls="homepage-city-listbox"
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value);
                    setCityDropdownShowAll(false);
                    setError(null);
                    if (selectedState && !catalogLoading) setCityDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (suppressCityDropdownOpenRef.current) {
                      suppressCityDropdownOpenRef.current = false;
                      return;
                    }
                    if (selectedState && !catalogLoading && catalogCities.length > 0) {
                      setCityDropdownShowAll(true);
                      setCityDropdownOpen(true);
                    }
                  }}
                  disabled={!selectedState || catalogLoading}
                  placeholder={catalogLoading ? 'Loading cities…' : 'Search city…'}
                  aria-label="City name"
                  className="flex-1 min-w-0 bg-transparent border-0 p-0 text-white text-sm placeholder-slate-500 focus:outline-none disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={toggleCityDropdown}
                  disabled={!selectedState || catalogLoading}
                  aria-label={cityDropdownOpen ? 'Close city list' : 'Show all cities in state'}
                  aria-expanded={cityDropdownOpen}
                  className="shrink-0 p-0 text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {cityDropdownOpen && selectedState && !catalogLoading && (
                <ul
                  id="homepage-city-listbox"
                  role="listbox"
                  className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-slate-600 bg-slate-900 shadow-lg"
                >
                  {filteredCities.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">No matching cities</li>
                  ) : (
                    filteredCities.map((city) => (
                      <li key={city.id} role="option" aria-selected={cityQuery === city.name}>
                        <button
                          type="button"
                          onClick={() => handleCityPick(city.name)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                            cityQuery === city.name
                              ? 'bg-sky-600/30 text-white'
                              : 'text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          {city.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || catalogLoading || !selectedState || !cityQuery.trim()}
              className={submitButtonClass}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                isCompact ? 'Search' : 'Check'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className={zipFormClass}>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Enter zip code"
              className={`${isCompact ? 'w-28 sm:w-32' : 'flex-1'} ${inputClass}`}
              maxLength={5}
            />
            <button
              type="submit"
              disabled={loading || zip.length !== 5}
              className={submitButtonClass}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                'Search'
              )}
            </button>
          </form>
        );

  const searchControls = (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${isCompact ? 'justify-end' : 'gap-3 pt-3 mb-3'}`}>
        {gpsButton}
        {gpsStatusMessage}
        {modeToggle}
        {isCompact && searchForms}
      </div>
      {!isCompact && searchForms}
      {error && (
        <p className={`text-red-400 text-xs ${isCompact ? 'text-right' : ''} mt-2`}>{error}</p>
      )}
      {locationResult}
    </>
  );

  if (isCompact) {
    return (
      <div id="radar-location-search" className="jump-scroll-target space-y-2">
        {searchControls}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-600 shadow-lg">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full px-4 py-2.5 flex items-center justify-between cursor-pointer bg-slate-700 hover:bg-slate-600 transition-all ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm" role="img" aria-label="location">📍</span>
            <label className="text-sm font-medium cursor-pointer" style={{ color: 'antiquewhite' }}>
              Check Location
            </label>
            {!isExpanded && Object.values(savedLocations).filter(l => l.onMap).length > 0 && (
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full">
                {Object.values(savedLocations).filter(l => l.onMap).length} on map
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 py-6 bg-slate-800 border-t border-slate-600 rounded-b-lg overflow-visible">
            {searchControls}
          </div>
        )}
      </div>
    </div>
  );
}
