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
  URGENT_EVENT_TYPES,
  getCategoryForEvent,
  extractLocationName,
  extractStateCode,
  extractGeometryCoordinates,
  filterAlertFeatures,
} from '../../shared/nws-alert-parser';
// Dev-only fixture for verifying tornado UI without waiting for a real
// Warning to fire (see src/test/tornadoFixture.js for full rationale).
// Vite tree-shakes this import from prod bundles — the only call site is
// gated on import.meta.env.DEV.
import { makeTornadoFixtures } from '../test/tornadoFixture.js';
// Dev-only fixture for verifying tropical UI (hurricane/tropical storm/storm
// surge) on the main radar and per-state radars without waiting for a real
// system (see src/test/tropicalFixture.js). Tree-shaken from prod — the only
// call site is gated on import.meta.env.DEV.
import { makeTropicalFixtures } from '../test/tropicalFixture.js';

export { ALERT_CATEGORIES, CATEGORY_ORDER };

// True when the dev server is running AND the URL has ?test-tornado. Used
// to bypass the cache and inject fixture tornado alerts end-to-end (cards,
// map dots/pills, hover popups, state pages, homepage widget all see them).
function isTornadoTestActive() {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('test-tornado')
  );
}

// True when the dev server is running AND the URL has ?test-tropical. Same
// mechanism as isTornadoTestActive() — injects fixture tropical alerts
// (hurricane/tropical storm/storm surge) end-to-end so the main radar,
// per-state radars, cards, and homepage widget all see them.
function isTropicalTestActive() {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('test-tropical')
  );
}

const CACHE_KEY = 'stormtracker_noaa_alerts_v3'; // v3: fixed categorized alerts count

// Adaptive refresh: short fuse when an urgent warning is active in the
// payload, slower cadence otherwise. Cache TTL matches the polling interval
// at each cadence — without that, a faster poll would just hit a stale cache
// and do nothing. The hook (useExtremeWeather) picks its interval from the
// REFRESH_INTERVAL_* constants; the service picks its cache TTL by inspecting
// the cached payload's content.
export const REFRESH_INTERVAL_NORMAL = 10 * 60 * 1000; // 10 minutes
export const REFRESH_INTERVAL_FAST = 2 * 60 * 1000;    //  2 minutes
const CACHE_TTL_NORMAL = REFRESH_INTERVAL_NORMAL;
const CACHE_TTL_FAST = REFRESH_INTERVAL_FAST;

/**
 * Returns true when the alert payload contains any urgent (action-required)
 * Warning that warrants 2-minute refresh cadence. Single source of truth for
 * the urgent set is URGENT_EVENT_TYPES in shared/nws-alert-parser.js — same
 * Set drives the server-side urgent email pipeline.
 */
export function hasUrgentAlert(allAlerts) {
  if (!Array.isArray(allAlerts)) return false;
  return allAlerts.some((a) => URGENT_EVENT_TYPES.has(a?.event));
}

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

  const sameCodes = props.geocode?.SAME || [];

  return {
    id: alert.id || props.id,
    event: eventType,
    category,
    state, // State code (e.g., "PA", "NY")
    sameCodes,
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
 * Read the localStorage cache entry without TTL filtering.
 */
function readAlertsCacheEntry() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    return { data, age: Date.now() - timestamp, fromCache: true };
  } catch (e) {
    console.error('Error reading alerts cache:', e);
    return null;
  }
}

/**
 * Get cached alerts if still valid. TTL is dynamic: 2 min when the cached
 * payload contains an urgent warning (Tornado / Flash Flood), 10 min
 * otherwise. This pairs with the hook's adaptive polling so fast cycles
 * don't get swallowed by a stale long-lived cache.
 */
function getCachedAlerts() {
  const entry = readAlertsCacheEntry();
  if (!entry) return null;

  const ttl = hasUrgentAlert(entry.data?.allAlerts) ? CACHE_TTL_FAST : CACHE_TTL_NORMAL;
  if (entry.age < ttl) {
    return entry;
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
  // Bypass cache entirely when a dev-fixture is active, so the fixture is
  // regenerated each call (fresh timestamps) and a stale cache from a
  // previous session can't poison the page when ?test-tornado=1 or
  // ?test-tropical=1 is set/unset.
  const tornadoTest = isTornadoTestActive();
  const tropicalTest = isTropicalTestActive();

  // Check cache first (unless forcing refresh or smoke-testing)
  if (!forceRefresh && !tornadoTest && !tropicalTest) {
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

    // Prepend dev-only fixtures (tornado and/or tropical) so they appear in
    // allAlerts AND byCategory AND the selected/map flow, end-to-end.
    const allAlerts = [
      ...(tornadoTest ? makeTornadoFixtures() : []),
      ...(tropicalTest ? makeTropicalFixtures() : []),
      ...parsed,
    ];

    // Group by category
    const byCategory = {};
    for (const categoryId of CATEGORY_ORDER) {
      byCategory[categoryId] = allAlerts.filter(a => a.category === categoryId);
    }

    // Select balanced set for display
    const selected = selectBalancedAlerts(allAlerts);

    const result = {
      allAlerts,
      byCategory,
      selected,
      totalCount: allAlerts.length,
      lastUpdated: new Date().toISOString(),
      fromCache: false
    };

    // Cache the real result (skip when the dev fixture is active so removing
    // the URL param returns to clean real-NWS data on the next load).
    if (!tornadoTest) {
      cacheAlerts(result);
    }

    return result;

  } catch (error) {
    console.error('Error fetching NOAA alerts:', error);

    // Try to return any cached payload on error, even past TTL — better than
    // leaving the UI on React state that may be hours old with no stale flag.
    const staleCache = readAlertsCacheEntry();
    if (staleCache) {
      return {
        ...staleCache.data,
        fromCache: true,
        stale: true,
        cacheAge: staleCache.age,
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
