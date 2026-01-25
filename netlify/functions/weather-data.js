// Netlify serverless function to cache NOAA weather data
// Prevents rate limiting and speeds up client load times

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

const STORM_START = new Date('2026-01-24T00:00:00Z');
const STORM_END = new Date('2026-01-27T00:00:00Z');

// City configuration - same as frontend, with NOAA observation station IDs
const cities = {
  dallas: { lat: 32.7767, lon: -96.7970, name: "Dallas, TX", iceOrder: 1, snowOrder: 1, stationId: "KDFW" },
  memphis: { lat: 35.1495, lon: -90.0490, name: "Memphis, TN", iceOrder: 2, snowOrder: 2, stationId: "KMEM" },
  atlanta: { lat: 33.7490, lon: -84.3880, name: "Atlanta, GA", iceOrder: 3, snowOrder: null, stationId: "KATL" },
  raleigh: { lat: 35.7796, lon: -78.6382, name: "Raleigh, NC", iceOrder: 4, snowOrder: null, stationId: "KRDU" },
  stLouis: { lat: 38.6270, lon: -90.1994, name: "St. Louis, MO", iceOrder: null, snowOrder: 3, stationId: "KSTL" },
  indianapolis: { lat: 39.7684, lon: -86.1581, name: "Indianapolis, IN", iceOrder: null, snowOrder: 4, stationId: "KIND" },
  cincinnati: { lat: 39.1031, lon: -84.5120, name: "Cincinnati, OH", iceOrder: null, snowOrder: 5, stationId: "KCVG" },
  dc: { lat: 38.9072, lon: -77.0369, name: "Washington, DC", iceOrder: 6, snowOrder: 6, stationId: "KDCA" },
  baltimore: { lat: 39.2904, lon: -76.6122, name: "Baltimore, MD", iceOrder: null, snowOrder: 7, stationId: "KBWI" },
  philly: { lat: 39.9526, lon: -75.1652, name: "Philadelphia, PA", iceOrder: 5, snowOrder: 8, stationId: "KPHL" },
  nyc: { lat: 40.7128, lon: -74.0060, name: "New York, NY", iceOrder: null, snowOrder: 9, stationId: "KJFK" },
  boston: { lat: 42.3601, lon: -71.0589, name: "Boston, MA", iceOrder: null, snowOrder: 10, stationId: "KBOS" }
};

// In-memory cache (persists across warm function invocations)
let cache = {
  data: null,
  timestamp: null,
  lastSuccessfulUpdate: null
};

// Determine storm phase
const getStormPhase = () => {
  const now = new Date();
  if (now < STORM_START) return 'pre-storm';
  if (now >= STORM_START && now < STORM_END) return 'active';
  return 'post-storm';
};

// Parse NOAA time series data to get accumulation totals
const parseAccumulation = (data, property, onlyPast = false) => {
  if (!data?.properties?.[property]?.values) {
    return 0;
  }

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

// Get current conditions from forecast
const parseConditions = (forecastData) => {
  if (!forecastData?.properties?.periods?.[0]) {
    return { shortForecast: 'Unknown', temperature: null };
  }

  const current = forecastData.properties.periods[0];
  return {
    shortForecast: current.shortForecast,
    temperature: current.temperature,
    temperatureUnit: current.temperatureUnit,
    windSpeed: current.windSpeed,
    icon: current.icon
  };
};

// Determine hazard type
const getHazardType = (snow, ice) => {
  if (ice > 0.25 && snow > 2) return 'mixed';
  if (ice > 0.1) return 'ice';
  if (snow > 0) return 'snow';
  return 'none';
};

// Fetch latest observation from NOAA weather station
const fetchStationObservation = async (stationId) => {
  try {
    const url = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!response.ok) {
      console.log(`Station ${stationId} observation error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const props = data.properties;

    // Convert values from metric to imperial
    const tempC = props.temperature?.value;
    const tempF = tempC !== null && tempC !== undefined ? Math.round(tempC * 9/5 + 32) : null;

    // Snow depth is in meters, convert to inches
    const snowDepthM = props.snowDepth?.value;
    const snowDepthIn = snowDepthM !== null && snowDepthM !== undefined ? Math.round(snowDepthM * 39.3701 * 10) / 10 : null;

    // Wind speed is in m/s, convert to mph
    const windMs = props.windSpeed?.value;
    const windMph = windMs !== null && windMs !== undefined ? Math.round(windMs * 2.237) : null;

    // Get precipitation amounts if available (in mm, convert to inches)
    const precipMm = props.precipitationLastHour?.value;
    const precipIn = precipMm !== null && precipMm !== undefined ? Math.round(precipMm * 0.0393701 * 100) / 100 : null;

    const timestamp = props.timestamp;
    const observationAge = timestamp ? (Date.now() - new Date(timestamp).getTime()) / (1000 * 60) : null;

    return {
      temperature: tempF,
      snowDepth: snowDepthIn,
      windSpeed: windMph,
      precipitation: precipIn,
      conditions: props.textDescription || null,
      timestamp: timestamp,
      isRecent: observationAge !== null && observationAge < 60, // Less than 1 hour old
      ageMinutes: observationAge ? Math.round(observationAge) : null,
      stationId: stationId
    };
  } catch (error) {
    console.error(`Error fetching observation for ${stationId}:`, error.message);
    return null;
  }
};

// Fetch weather data for a single city
const fetchCityWeather = async (cityId, cityData) => {
  try {
    const pointsUrl = `https://api.weather.gov/points/${cityData.lat},${cityData.lon}`;
    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointsResponse.ok) {
      throw new Error(`Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastGridDataUrl = pointsData.properties.forecastGridData;
    const forecastUrl = pointsData.properties.forecast;

    // Fetch grid data, forecast, and station observation in parallel
    const [gridResponse, forecastResponse, observation] = await Promise.all([
      fetch(forecastGridDataUrl, {
        headers: {
          'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
          'Accept': 'application/geo+json'
        }
      }),
      fetch(forecastUrl, {
        headers: {
          'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
          'Accept': 'application/geo+json'
        }
      }),
      cityData.stationId ? fetchStationObservation(cityData.stationId) : Promise.resolve(null)
    ]);

    if (!gridResponse.ok) {
      throw new Error(`Grid API error: ${gridResponse.status}`);
    }

    const gridData = await gridResponse.json();
    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;

    // Parse data
    const forecastSnow = parseAccumulation(gridData, 'snowfallAmount', false);
    const forecastIce = parseAccumulation(gridData, 'iceAccumulation', false);
    const observedSnow = parseAccumulation(gridData, 'snowfallAmount', true);
    const observedIce = parseAccumulation(gridData, 'iceAccumulation', true);

    const conditions = parseConditions(forecastData);
    const hazardType = getHazardType(forecastSnow, forecastIce);

    let iceDanger = 'safe';
    if (forecastIce >= 0.5) iceDanger = 'catastrophic';
    else if (forecastIce >= 0.25) iceDanger = 'dangerous';
    else if (forecastIce > 0) iceDanger = 'caution';

    return {
      id: cityId,
      name: cityData.name,
      lat: cityData.lat,
      lon: cityData.lon,
      snowOrder: cityData.snowOrder,
      iceOrder: cityData.iceOrder,
      stationId: cityData.stationId,
      forecast: {
        snowfall: forecastSnow,
        ice: forecastIce
      },
      observed: {
        snowfall: observedSnow,
        ice: observedIce
      },
      // Real-time observation from weather station
      observation: observation ? {
        temperature: observation.temperature,
        snowDepth: observation.snowDepth,
        windSpeed: observation.windSpeed,
        conditions: observation.conditions,
        timestamp: observation.timestamp,
        isRecent: observation.isRecent,
        ageMinutes: observation.ageMinutes
      } : null,
      hazardType,
      iceDanger,
      conditions,
      lastUpdated: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    console.error(`Error fetching weather for ${cityData.name}:`, error.message);
    return {
      id: cityId,
      name: cityData.name,
      lat: cityData.lat,
      lon: cityData.lon,
      snowOrder: cityData.snowOrder,
      iceOrder: cityData.iceOrder,
      stationId: cityData.stationId,
      forecast: { snowfall: 0, ice: 0 },
      observed: { snowfall: 0, ice: 0 },
      observation: null,
      hazardType: 'none',
      iceDanger: 'safe',
      conditions: { shortForecast: 'Data unavailable' },
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
  }
};

// Fetch all cities
const fetchAllCities = async () => {
  console.log('Fetching fresh data from NOAA...');

  const cityEntries = Object.entries(cities);
  const results = await Promise.all(
    cityEntries.map(([id, data]) => fetchCityWeather(id, data))
  );

  const dataMap = {};
  results.forEach(result => {
    dataMap[result.id] = result;
  });

  return dataMap;
};

// Main handler
exports.handler = async (event, context) => {
  // CORS and cache control headers - prevent mobile browser caching
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const now = Date.now();
    const cacheAge = cache.timestamp ? now - cache.timestamp : Infinity;
    const isCacheValid = cache.data && cacheAge < CACHE_DURATION;

    // Check if force refresh requested
    const forceRefresh = event.queryStringParameters?.refresh === 'true';

    if (isCacheValid && !forceRefresh) {
      console.log(`Returning cached data (age: ${Math.round(cacheAge / 1000)}s)`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: cache.data,
          stormPhase: getStormPhase(),
          cached: true,
          cacheAge: Math.round(cacheAge / 1000),
          lastUpdated: cache.timestamp,
          lastSuccessfulUpdate: cache.lastSuccessfulUpdate
        })
      };
    }

    // Fetch fresh data
    const weatherData = await fetchAllCities();

    // Update cache
    cache = {
      data: weatherData,
      timestamp: now,
      lastSuccessfulUpdate: new Date().toISOString()
    };

    console.log('Fresh data fetched and cached');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: weatherData,
        stormPhase: getStormPhase(),
        cached: false,
        cacheAge: 0,
        lastUpdated: now,
        lastSuccessfulUpdate: cache.lastSuccessfulUpdate
      })
    };

  } catch (error) {
    console.error('Function error:', error);

    // If we have cached data, return it even if stale
    if (cache.data) {
      console.log('Returning stale cache due to error');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: cache.data,
          stormPhase: getStormPhase(),
          cached: true,
          stale: true,
          cacheAge: cache.timestamp ? Math.round((Date.now() - cache.timestamp) / 1000) : null,
          lastUpdated: cache.timestamp,
          lastSuccessfulUpdate: cache.lastSuccessfulUpdate,
          error: 'Using cached data - NOAA API temporarily unavailable'
        })
      };
    }

    // No cache available
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Weather data temporarily unavailable. Please try again in a few minutes.',
        message: error.message
      })
    };
  }
};
