import { useState, useEffect } from 'react';

const LOCATIONS_KEY = 'winterStorm_userLocations';

// States and cities in the storm-affected region
const STATES_AND_CITIES = {
  'TX': {
    name: 'Texas',
    cities: [
      { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
      { name: 'Fort Worth', lat: 32.7555, lon: -97.3308 },
      { name: 'Austin', lat: 30.2672, lon: -97.7431 },
      { name: 'Houston', lat: 29.7604, lon: -95.3698 },
      { name: 'San Antonio', lat: 29.4241, lon: -98.4936 },
    ]
  },
  'TN': {
    name: 'Tennessee',
    cities: [
      { name: 'Memphis', lat: 35.1495, lon: -90.0490 },
      { name: 'Nashville', lat: 36.1627, lon: -86.7816 },
      { name: 'Knoxville', lat: 35.9606, lon: -83.9207 },
      { name: 'Chattanooga', lat: 35.0456, lon: -85.3097 },
    ]
  },
  'GA': {
    name: 'Georgia',
    cities: [
      { name: 'Atlanta', lat: 33.7490, lon: -84.3880 },
      { name: 'Savannah', lat: 32.0809, lon: -81.0912 },
      { name: 'Augusta', lat: 33.4735, lon: -82.0105 },
      { name: 'Macon', lat: 32.8407, lon: -83.6324 },
    ]
  },
  'NC': {
    name: 'North Carolina',
    cities: [
      { name: 'Raleigh', lat: 35.7796, lon: -78.6382 },
      { name: 'Charlotte', lat: 35.2271, lon: -80.8431 },
      { name: 'Greensboro', lat: 36.0726, lon: -79.7920 },
      { name: 'Durham', lat: 35.9940, lon: -78.8986 },
      { name: 'Wilmington', lat: 34.2257, lon: -77.9447 },
    ]
  },
  'SC': {
    name: 'South Carolina',
    cities: [
      { name: 'Columbia', lat: 34.0007, lon: -81.0348 },
      { name: 'Charleston', lat: 32.7765, lon: -79.9311 },
      { name: 'Greenville', lat: 34.8526, lon: -82.3940 },
    ]
  },
  'VA': {
    name: 'Virginia',
    cities: [
      { name: 'Richmond', lat: 37.5407, lon: -77.4360 },
      { name: 'Virginia Beach', lat: 36.8529, lon: -75.9780 },
      { name: 'Norfolk', lat: 36.8508, lon: -76.2859 },
      { name: 'Arlington', lat: 38.8816, lon: -77.0910 },
    ]
  },
  'DC': {
    name: 'Washington DC',
    cities: [
      { name: 'Washington', lat: 38.9072, lon: -77.0369 },
    ]
  },
  'MD': {
    name: 'Maryland',
    cities: [
      { name: 'Baltimore', lat: 39.2904, lon: -76.6122 },
      { name: 'Bethesda', lat: 38.9847, lon: -77.0947 },
      { name: 'Rockville', lat: 39.0840, lon: -77.1528 },
      { name: 'Annapolis', lat: 38.9784, lon: -76.4922 },
    ]
  },
  'PA': {
    name: 'Pennsylvania',
    cities: [
      { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
      { name: 'Pittsburgh', lat: 40.4406, lon: -79.9959 },
      { name: 'Harrisburg', lat: 40.2732, lon: -76.8867 },
      { name: 'Allentown', lat: 40.6084, lon: -75.4902 },
    ]
  },
  'NJ': {
    name: 'New Jersey',
    cities: [
      { name: 'Newark', lat: 40.7357, lon: -74.1724 },
      { name: 'Jersey City', lat: 40.7178, lon: -74.0431 },
      { name: 'Trenton', lat: 40.2206, lon: -74.7597 },
      { name: 'Atlantic City', lat: 39.3643, lon: -74.4229 },
    ]
  },
  'NY': {
    name: 'New York',
    cities: [
      { name: 'New York City', lat: 40.7128, lon: -74.0060 },
      { name: 'Buffalo', lat: 42.8864, lon: -78.8784 },
      { name: 'Albany', lat: 42.6526, lon: -73.7562 },
      { name: 'Syracuse', lat: 43.0481, lon: -76.1474 },
      { name: 'Rochester', lat: 43.1566, lon: -77.6088 },
    ]
  },
  'CT': {
    name: 'Connecticut',
    cities: [
      { name: 'Hartford', lat: 41.7658, lon: -72.6734 },
      { name: 'New Haven', lat: 41.3083, lon: -72.9279 },
      { name: 'Stamford', lat: 41.0534, lon: -73.5387 },
    ]
  },
  'MA': {
    name: 'Massachusetts',
    cities: [
      { name: 'Boston', lat: 42.3601, lon: -71.0589 },
      { name: 'Worcester', lat: 42.2626, lon: -71.8023 },
      { name: 'Springfield', lat: 42.1015, lon: -72.5898 },
      { name: 'Cambridge', lat: 42.3736, lon: -71.1097 },
    ]
  },
  'OH': {
    name: 'Ohio',
    cities: [
      { name: 'Columbus', lat: 39.9612, lon: -82.9988 },
      { name: 'Cleveland', lat: 41.4993, lon: -81.6944 },
      { name: 'Cincinnati', lat: 39.1031, lon: -84.5120 },
      { name: 'Toledo', lat: 41.6528, lon: -83.5379 },
    ]
  },
  'IN': {
    name: 'Indiana',
    cities: [
      { name: 'Indianapolis', lat: 39.7684, lon: -86.1581 },
      { name: 'Fort Wayne', lat: 41.0793, lon: -85.1394 },
      { name: 'Evansville', lat: 37.9716, lon: -87.5711 },
    ]
  },
  'MO': {
    name: 'Missouri',
    cities: [
      { name: 'St. Louis', lat: 38.6270, lon: -90.1994 },
      { name: 'Kansas City', lat: 39.0997, lon: -94.5786 },
      { name: 'Springfield', lat: 37.2090, lon: -93.2923 },
    ]
  },
  'KY': {
    name: 'Kentucky',
    cities: [
      { name: 'Louisville', lat: 38.2527, lon: -85.7585 },
      { name: 'Lexington', lat: 38.0406, lon: -84.5037 },
      { name: 'Bowling Green', lat: 36.9685, lon: -86.4808 },
    ]
  },
  'WV': {
    name: 'West Virginia',
    cities: [
      { name: 'Charleston', lat: 38.3498, lon: -81.6326 },
      { name: 'Huntington', lat: 38.4192, lon: -82.4452 },
      { name: 'Morgantown', lat: 39.6295, lon: -79.9559 },
    ]
  },
};

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

function UserLocationCard({ data, isOnMap, onToggleMap, onRemove, onDismiss, stormPhase }) {
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

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isOnMap && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
            title="Close card (stays on map)"
          >
            Close
          </button>
        )}
        <button
          onClick={onRemove}
          className="text-slate-500 hover:text-red-400 transition-colors"
          title="Remove location"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

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
            {/* Add to Map checkbox */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isOnMap}
                onChange={(e) => onToggleMap(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
              />
              <span className="text-xs text-slate-400">Add to Map</span>
              {isOnMap && (
                <span className="text-[10px] text-emerald-400">(on map)</span>
              )}
            </label>
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

export default function ZipCodeSearch({ stormPhase, onLocationsChange }) {
  const [zip, setZip] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchMode, setSearchMode] = useState('city'); // 'city' or 'zip'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [isCardDismissed, setIsCardDismissed] = useState(false);

  // Store all saved locations with their map visibility
  const [savedLocations, setSavedLocations] = useState({}); // { id: { data, onMap } }

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

    const cityId = `${cityData.name}-${stateCode}`.toLowerCase().replace(/\s+/g, '-');
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
    } catch (err) {
      console.error('City search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setCurrentLocationData(null);
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

    const locationId = currentLocationData.zip || currentLocationData.id?.replace('user-', '');
    const newLocations = { ...savedLocations };
    delete newLocations[locationId];

    updateSavedLocations(newLocations);
    setCurrentLocationData(null);
    setZip('');
    setSelectedCity('');
  };

  const handleDismissCard = () => {
    setIsCardDismissed(true);
  };

  const handleCitySelect = () => {
    if (!selectedState || !selectedCity) return;
    const stateData = STATES_AND_CITIES[selectedState];
    const cityData = stateData?.cities.find(c => c.name === selectedCity);
    if (cityData) {
      fetchCityWeather(selectedState, cityData);
    }
  };

  const currentLocationId = currentLocationData?.zip || currentLocationData?.id?.replace('user-', '');
  const isCurrentOnMap = currentLocationData
    ? savedLocations[currentLocationId]?.onMap || false
    : false;

  const availableCities = selectedState ? STATES_AND_CITIES[selectedState]?.cities || [] : [];

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-300">
            Check Your Location
          </label>
          {/* Search mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
            <button
              type="button"
              onClick={() => setSearchMode('city')}
              className={`px-2.5 py-1 transition-colors ${
                searchMode === 'city'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              By City
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('zip')}
              className={`px-2.5 py-1 transition-colors ${
                searchMode === 'zip'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              By Zip
            </button>
          </div>
        </div>

        {searchMode === 'city' ? (
          /* City/State dropdowns */
          <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedCity('');
              }}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="">Select State</option>
              {Object.entries(STATES_AND_CITIES)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([code, state]) => (
                  <option key={code} value={code}>{state.name}</option>
                ))}
            </select>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedState}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select City</option>
              {availableCities.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCitySelect}
              disabled={loading || !selectedState || !selectedCity}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                'Check'
              )}
            </button>
          </div>
        ) : (
          /* Zip code input */
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
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                'Search'
              )}
            </button>
          </form>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-2">{error}</p>
        )}

        {/* Show count of locations on map */}
        {Object.values(savedLocations).filter(l => l.onMap).length > 0 && (
          <p className="text-emerald-400 text-xs mt-2">
            {Object.values(savedLocations).filter(l => l.onMap).length} location(s) added to map
          </p>
        )}
      </div>

      {/* Result Card - Full Width, can be dismissed */}
      {currentLocationData && !isCardDismissed && (
        <UserLocationCard
          data={currentLocationData}
          isOnMap={isCurrentOnMap}
          onToggleMap={(checked) => handleToggleMap(currentLocationId, checked)}
          onRemove={handleRemove}
          onDismiss={handleDismissCard}
          stormPhase={stormPhase}
        />
      )}
    </div>
  );
}
