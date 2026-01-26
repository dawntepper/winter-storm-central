/**
 * NOAA Alerts Service
 * Fetches and parses active weather warnings from NOAA Weather.gov API
 */

import { getStateCentroid, getCoordinatesFromFIPS } from '../data/stateCentroids';

const ALERTS_API = 'https://api.weather.gov/alerts/active';
const CACHE_KEY = 'stormtracker_noaa_alerts_v2'; // v2: expanded event types + state centroids
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Event types to include - Warnings, Watches, and significant Advisories
const INCLUDED_EVENTS = [
  // Tornado/Severe
  'Tornado Warning', 'Tornado Watch',
  'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch',
  // Flooding
  'Flash Flood Warning', 'Flash Flood Watch',
  'Flood Warning', 'Flood Watch', 'Flood Advisory',
  'Coastal Flood Warning', 'Coastal Flood Watch',
  // Winter Weather
  'Blizzard Warning', 'Blizzard Watch',
  'Ice Storm Warning',
  'Winter Storm Warning', 'Winter Storm Watch',
  'Winter Weather Advisory',
  'Extreme Cold Warning', 'Extreme Cold Watch',
  'Wind Chill Warning', 'Wind Chill Watch', 'Wind Chill Advisory',
  'Heavy Snow Warning',
  'Lake Effect Snow Warning', 'Lake Effect Snow Watch', 'Lake Effect Snow Advisory',
  'Freeze Warning', 'Freeze Watch',
  'Frost Advisory',
  'Cold Weather Advisory',
  // Heat
  'Excessive Heat Warning', 'Excessive Heat Watch',
  'Heat Advisory',
  // Tropical
  'Hurricane Warning', 'Hurricane Watch',
  'Tropical Storm Warning', 'Tropical Storm Watch',
  'Storm Surge Warning', 'Storm Surge Watch',
  // Fire
  'Red Flag Warning', 'Fire Weather Watch',
  'Fire Warning',
  // Wind
  'High Wind Warning', 'High Wind Watch',
  'Wind Advisory'
];

// Category definitions
export const ALERT_CATEGORIES = {
  winter: {
    id: 'winter',
    name: 'Winter Weather',
    icon: '❄️',
    color: '#3b82f6', // blue
    events: [
      'Blizzard', 'Ice Storm', 'Winter Storm', 'Winter Weather',
      'Extreme Cold', 'Wind Chill', 'Heavy Snow', 'Lake Effect Snow',
      'Freeze', 'Frost', 'Cold Weather'
    ]
  },
  severe: {
    id: 'severe',
    name: 'Severe Storms',
    icon: '⛈️',
    color: '#ef4444', // red
    events: ['Tornado', 'Severe Thunderstorm', 'High Wind', 'Wind Advisory']
  },
  heat: {
    id: 'heat',
    name: 'Extreme Heat',
    icon: '🌡️',
    color: '#f97316', // orange
    events: ['Excessive Heat', 'Heat Advisory']
  },
  flood: {
    id: 'flood',
    name: 'Flooding',
    icon: '🌊',
    color: '#a855f7', // purple
    events: ['Flash Flood', 'Flood', 'Coastal Flood']
  },
  fire: {
    id: 'fire',
    name: 'Fire Weather',
    icon: '🔥',
    color: '#92400e', // brown
    events: ['Red Flag', 'Fire Weather', 'Fire Warning']
  },
  tropical: {
    id: 'tropical',
    name: 'Tropical',
    icon: '🌀',
    color: '#1e3a8a', // dark blue
    events: ['Hurricane', 'Tropical Storm', 'Storm Surge']
  }
};

// Category order for display
export const CATEGORY_ORDER = ['winter', 'severe', 'heat', 'flood', 'fire', 'tropical'];

/**
 * Get category for an alert event type
 */
function getCategoryForEvent(eventType) {
  for (const [categoryId, category] of Object.entries(ALERT_CATEGORIES)) {
    // Check if any category event keyword is found in the event type
    if (category.events.some(keyword => eventType.includes(keyword))) {
      return categoryId;
    }
  }
  return null;
}

/**
 * Extract city/location name from alert area description
 */
function extractLocationName(alert) {
  // Try to get a clean location name from areaDesc
  const areaDesc = alert.properties?.areaDesc || '';

  // areaDesc often contains multiple areas separated by semicolons
  // Take the first one and clean it up
  const firstArea = areaDesc.split(';')[0].trim();

  // Remove common suffixes like "County", "Parish", etc.
  let location = firstArea
    .replace(/\s+(County|Parish|Borough|Municipality|City and Borough)/gi, '')
    .trim();

  // Check if location already ends with a state abbreviation (e.g., "Attala, MS")
  const hasStateAbbrev = /,\s*[A-Z]{2}$/.test(location);

  // If we have geocode info, try to get state (only if not already present)
  if (!hasStateAbbrev) {
    const state = alert.properties?.geocode?.UGC?.[0]?.substring(0, 2) || '';
    if (location && state) {
      return `${location}, ${state}`;
    }
  }

  return location || 'Unknown Location';
}

/**
 * Marine zone prefixes - these are for ocean/coastal areas, not land
 */
const MARINE_ZONE_PREFIXES = [
  'AM', 'AN', 'GM', 'LE', 'LM', 'LO', 'LS', 'LH', 'LC', 'LZ',
  'PH', 'PK', 'PM', 'PS', 'PZ', 'SL'
];

/**
 * Extract coordinates from alert geometry or use state centroid as fallback
 */
function extractCoordinates(alert) {
  // Try to get from geometry first (most accurate)
  if (alert.geometry?.type === 'Polygon' && alert.geometry?.coordinates?.[0]) {
    const coords = alert.geometry.coordinates[0];
    const lats = coords.map(c => c[1]);
    const lons = coords.map(c => c[0]);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length,
      source: 'geometry'
    };
  }

  // Check if this is a marine zone (skip these for now)
  const ugc = alert.properties?.geocode?.UGC?.[0] || '';
  const zonePrefix = ugc.substring(0, 2);
  if (MARINE_ZONE_PREFIXES.includes(zonePrefix)) {
    return null; // Skip marine zones
  }

  // Try to get coordinates from SAME/FIPS code (state centroid)
  const sameCode = alert.properties?.geocode?.SAME?.[0];
  if (sameCode) {
    const coords = getCoordinatesFromFIPS(sameCode);
    if (coords) {
      return { ...coords, source: 'fips' };
    }
  }

  // Try to get from UGC state code
  if (ugc && ugc.length >= 2) {
    const stateCode = ugc.substring(0, 2);
    const coords = getStateCentroid(stateCode);
    if (coords) {
      return { ...coords, source: 'state' };
    }
  }

  return null;
}

/**
 * Parse NOAA alert into our format
 */
function parseAlert(alert) {
  const props = alert.properties || {};
  const eventType = props.event || '';
  const category = getCategoryForEvent(eventType);

  if (!category) return null;

  const coords = extractCoordinates(alert);
  if (!coords) return null; // Skip alerts without coordinates

  // Link to weather.gov alerts page - individual alert URLs no longer work
  // The main alerts page shows all active alerts and is the best user experience
  const alertUrl = 'https://www.weather.gov/alerts';

  return {
    id: alert.id || props.id,
    event: eventType,
    category,
    location: extractLocationName(alert),
    lat: coords.lat,
    lon: coords.lon,
    headline: props.headline || eventType,
    description: props.description?.substring(0, 200) || '',
    fullDescription: props.description || '',
    severity: props.severity,
    urgency: props.urgency,
    onset: props.onset,
    expires: props.expires,
    areaDesc: props.areaDesc,
    url: alertUrl
  };
}

/**
 * Fetch alerts from NOAA API
 */
async function fetchAlertsFromAPI() {
  const response = await fetch(ALERTS_API, {
    headers: {
      'User-Agent': 'StormTracking.io (contact@stormtracking.io)',
      'Accept': 'application/geo+json'
    }
  });

  if (!response.ok) {
    throw new Error(`NOAA Alerts API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get cached alerts if still valid
 */
function getCachedAlerts() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < CACHE_TTL) {
      return { data, age, fromCache: true };
    }
  } catch (e) {
    console.error('Error reading alerts cache:', e);
  }
  return null;
}

/**
 * Save alerts to cache
 */
function cacheAlerts(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Error caching alerts:', e);
  }
}

/**
 * Select up to N cities from each category for balanced display
 */
function selectBalancedAlerts(alerts, perCategory = 5, maxTotal = 20) {
  const byCategory = {};

  // Group by category
  for (const alert of alerts) {
    if (!byCategory[alert.category]) {
      byCategory[alert.category] = [];
    }
    byCategory[alert.category].push(alert);
  }

  // Select up to perCategory from each, respecting maxTotal
  const selected = [];

  for (const categoryId of CATEGORY_ORDER) {
    if (!byCategory[categoryId]) continue;

    const categoryAlerts = byCategory[categoryId].slice(0, perCategory);
    selected.push(...categoryAlerts);

    if (selected.length >= maxTotal) break;
  }

  return selected.slice(0, maxTotal);
}

/**
 * Main function: Fetch and process NOAA alerts
 */
export async function fetchExtremeWeather(forceRefresh = false) {
  // Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedAlerts();
    if (cached) {
      console.log('Using cached NOAA alerts, age:', Math.round(cached.age / 1000 / 60), 'min');
      return {
        ...cached.data,
        fromCache: true,
        cacheAge: cached.age
      };
    }
  }

  console.log('Fetching fresh NOAA alerts...');

  try {
    const response = await fetchAlertsFromAPI();
    const features = response.features || [];

    // Filter to only included event types
    const warnings = features.filter(f => {
      const event = f.properties?.event || '';
      return INCLUDED_EVENTS.some(e => event.includes(e));
    });

    // Parse alerts
    const parsed = warnings
      .map(parseAlert)
      .filter(Boolean); // Remove nulls

    // Group by category
    const byCategory = {};
    for (const categoryId of CATEGORY_ORDER) {
      byCategory[categoryId] = parsed.filter(a => a.category === categoryId);
    }

    // Select balanced set for display
    const selected = selectBalancedAlerts(parsed);

    const result = {
      allAlerts: parsed,
      byCategory,
      selected,
      totalCount: parsed.length,
      lastUpdated: new Date().toISOString(),
      fromCache: false
    };

    // Cache the result
    cacheAlerts(result);

    return result;

  } catch (error) {
    console.error('Error fetching NOAA alerts:', error);

    // Try to return stale cache on error
    const staleCache = getCachedAlerts();
    if (staleCache) {
      return {
        ...staleCache.data,
        fromCache: true,
        stale: true,
        error: error.message
      };
    }

    throw error;
  }
}

export default {
  fetchExtremeWeather,
  ALERT_CATEGORIES,
  CATEGORY_ORDER
};
