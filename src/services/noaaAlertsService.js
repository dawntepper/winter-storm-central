/**
 * NOAA Alerts Service
 * Fetches and parses active weather warnings from NOAA Weather.gov API
 *
 * Uses shared parsing logic from shared/nws-alert-parser.js
 * Adds client-side features: coordinate fallbacks, caching, balanced selection
 */

import { getStateCentroid, getCoordinatesFromFIPS } from '../data/stateCentroids';
import {
  ALERTS_API,
  NWS_HEADERS,
  ALERT_CATEGORIES,
  CATEGORY_ORDER,
  MARINE_ZONE_PREFIXES,
  INCLUDED_EVENTS,
  getCategoryForEvent,
  extractLocationName,
  extractStateCode,
  extractGeometryCoordinates,
  filterAlertFeatures,
} from '../../shared/nws-alert-parser';

export { ALERT_CATEGORIES, CATEGORY_ORDER };

const CACHE_KEY = 'stormtracker_noaa_alerts_v3'; // v3: fixed categorized alerts count
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Add small random offset to prevent exact overlaps on the map
 * Spread is in degrees (roughly 0.1 = ~7 miles)
 */
function addJitter(coords, spread = 0.15) {
  return {
    ...coords,
    lat: coords.lat + (Math.random() - 0.5) * spread,
    lon: coords.lon + (Math.random() - 0.5) * spread
  };
}

/**
 * Extract coordinates from alert geometry or use state centroid as fallback.
 * Client-side version with full FIPS/centroid fallback chain for map display.
 */
function extractCoordinates(alert) {
  // Try polygon geometry first (most accurate)
  const geomCoords = extractGeometryCoordinates(alert);
  if (geomCoords) {
    return { ...geomCoords, source: 'geometry' };
  }

  // Check if this is a marine zone (skip these for now)
  const ugcCodes = alert.properties?.geocode?.UGC || [];
  const firstUgc = ugcCodes[0] || '';
  const zonePrefix = firstUgc.substring(0, 2);
  if (MARINE_ZONE_PREFIXES.includes(zonePrefix)) {
    return null; // Skip marine zones
  }

  // Try to get coordinates from SAME/FIPS codes
  // Use all SAME codes to calculate average position (better than single code)
  const sameCodes = alert.properties?.geocode?.SAME || [];
  if (sameCodes.length > 0) {
    const coordsList = sameCodes
      .map(code => getCoordinatesFromFIPS(code))
      .filter(Boolean);

    if (coordsList.length > 0) {
      const avgLat = coordsList.reduce((sum, c) => sum + c.lat, 0) / coordsList.length;
      const avgLon = coordsList.reduce((sum, c) => sum + c.lon, 0) / coordsList.length;
      // Add jitter to spread out alerts that share similar coordinates
      return addJitter({ lat: avgLat, lon: avgLon, source: 'fips' }, 0.2);
    }
  }

  // Try to get from UGC state code with jitter
  if (firstUgc && firstUgc.length >= 2) {
    const stateCode = firstUgc.substring(0, 2);
    const coords = getStateCentroid(stateCode);
    if (coords) {
      // Larger jitter for state-level fallback to spread alerts across state
      return addJitter({ ...coords, source: 'state' }, 0.5);
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

  // Extract state code for filtering
  const state = extractStateCode(alert);

  // Link to weather.gov alerts page - individual alert URLs no longer work
  // The main alerts page shows all active alerts and is the best user experience
  const alertUrl = 'https://www.weather.gov/alerts';

  return {
    id: alert.id || props.id,
    event: eventType,
    category,
    state, // State code (e.g., "PA", "NY")
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
    headers: NWS_HEADERS,
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
    const warnings = filterAlertFeatures(features);

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
