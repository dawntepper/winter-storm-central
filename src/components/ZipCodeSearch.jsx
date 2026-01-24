import { useState, useEffect } from 'react';

const STORAGE_KEY = 'winterStorm_userZip';

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
    name: `${place['place name']}, ${place['state abbreviation']}`
  };
}

// Fetch weather data for coordinates (same logic as useWeatherData)
async function fetchWeatherForLocation(lat, lon, name) {
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

    // Get current conditions
    const currentConditions = forecastData?.properties?.periods?.[0] || {};

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
      id: 'user-location',
      name,
      lat,
      lon,
      forecast: { snowfall: forecastSnow, ice: forecastIce },
      observed: { snowfall: observedSnow, ice: observedIce },
      hazardType,
      iceDanger,
      stormPhase: getStormPhase(),
      conditions: {
        shortForecast: currentConditions.shortForecast || 'Unknown',
        temperature: currentConditions.temperature,
        temperatureUnit: currentConditions.temperatureUnit
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

function UserLocationCard({ data, onRemove, stormPhase }) {
  const colors = hazardColors[data.hazardType] || hazardColors.none;
  const hazard = hazardLabels[data.hazardType] || hazardLabels.none;
  const danger = dangerBadges[data.iceDanger];

  return (
    <div className={`rounded-xl p-4 border-2 ${colors} relative`}>
      {/* Your Location badge */}
      <div className="absolute -top-3 left-4">
        <span className="bg-emerald-500 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
          Your Location
        </span>
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
        title="Remove location"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Main content - horizontal layout on larger screens */}
      <div className="mt-2 flex flex-col lg:flex-row lg:items-center lg:gap-6">
        {/* Left: City info */}
        <div className="flex items-center gap-3 mb-3 lg:mb-0 lg:min-w-[200px]">
          <div>
            <h3 className="text-lg font-semibold text-white">{data.name}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${hazard.class}`}>{hazard.text}</span>
              {danger && (
                <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${danger.class}`}>
                  {danger.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Expected totals */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="text-[10px] text-slate-500 font-medium uppercase">Expected</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-sky-300">
                {data.forecast?.snowfall > 0 ? `${data.forecast.snowfall.toFixed(2)}"` : '-'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Snow</p>
            </div>
            <div className="bg-slate-900/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-fuchsia-400">
                {data.forecast?.ice > 0 ? `${data.forecast.ice.toFixed(2)}"` : '-'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ice</p>
            </div>
          </div>
        </div>

        {/* Right: Accumulations */}
        <div className="flex-1 mt-3 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-700/50 lg:pl-6">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] text-slate-500 font-medium uppercase">Accumulations</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-emerald-400">
                {data.observed?.snowfall > 0 ? `${data.observed.snowfall.toFixed(2)}"` : '-'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Snow</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-semibold text-emerald-400">
                {data.observed?.ice > 0 ? `${data.observed.ice.toFixed(2)}"` : '-'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ice</p>
            </div>
          </div>
        </div>

        {/* Far right: Current conditions */}
        {data.conditions?.shortForecast && (
          <div className="mt-3 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-700/50 lg:pl-6 lg:min-w-[150px]">
            <p className="text-[10px] text-slate-500 font-medium uppercase mb-1">Conditions</p>
            <p className="text-sm text-slate-300">{data.conditions.shortForecast}</p>
            {data.conditions.temperature && (
              <p className="text-lg font-semibold text-white mt-1">
                {data.conditions.temperature}°{data.conditions.temperatureUnit}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ZipCodeSearch({ stormPhase }) {
  const [zip, setZip] = useState('');
  const [savedZip, setSavedZip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState(null);

  // Load saved zip on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedZip(stored);
      setZip(stored);
      fetchLocationWeather(stored);
    }
  }, []);

  const fetchLocationWeather = async (zipCode) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Looking up zip code:', zipCode);
      const coords = await getCoordinatesFromZip(zipCode);
      console.log('Got coordinates:', coords);
      const weather = await fetchWeatherForLocation(coords.lat, coords.lon, coords.name);
      console.log('Got weather data:', weather);
      setLocationData(weather);
      setSavedZip(zipCode);
      localStorage.setItem(STORAGE_KEY, zipCode);
    } catch (err) {
      console.error('Zip code search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setLocationData(null);
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

  const handleRemove = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedZip(null);
    setLocationData(null);
    setZip('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Check your location's forecast
        </label>
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Enter zip code"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 transition-colors"
            maxLength={5}
          />
          <button
            type="submit"
            disabled={loading || zip.length !== 5}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              </span>
            ) : (
              'Search'
            )}
          </button>
        </form>
        {error && (
          <p className="text-red-400 text-xs mt-2">{error}</p>
        )}
      </div>

      {/* Result Card - Full Width */}
      {locationData && (
        <UserLocationCard
          data={locationData}
          onRemove={handleRemove}
          stormPhase={stormPhase}
        />
      )}
    </div>
  );
}
