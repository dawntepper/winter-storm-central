/**
 * NWS Alert Parser — Shared Module
 *
 * Pure parsing logic for NWS weather alerts, shared between:
 * - Client-side: src/services/noaaAlertsService.js (map display, caching)
 * - Server-side: netlify/functions/process-weather-alerts.js (Kit email broadcasts)
 *
 * This module has NO external dependencies (no browser APIs, no Node-specific code).
 */

export const ALERTS_API = 'https://api.weather.gov/alerts/active';

export const NWS_HEADERS = {
  'User-Agent': 'StormTracking.io (contact@stormtracking.io)',
  'Accept': 'application/geo+json',
};

// Event types to include — Warnings, Watches, and significant Advisories
export const INCLUDED_EVENTS = [
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
  'Wind Advisory',
];

// Category definitions with display metadata
export const ALERT_CATEGORIES = {
  winter: {
    id: 'winter',
    name: 'Winter Weather',
    icon: '❄️',
    color: '#3b82f6',
    events: [
      'Blizzard', 'Ice Storm', 'Winter Storm', 'Winter Weather',
      'Extreme Cold', 'Wind Chill', 'Heavy Snow', 'Lake Effect Snow',
      'Freeze', 'Frost', 'Cold Weather',
    ],
  },
  severe: {
    id: 'severe',
    name: 'Severe Storms',
    icon: '⛈️',
    color: '#ef4444',
    events: ['Tornado', 'Severe Thunderstorm', 'High Wind', 'Wind Advisory'],
  },
  heat: {
    id: 'heat',
    name: 'Extreme Heat',
    icon: '🌡️',
    color: '#f97316',
    events: ['Excessive Heat', 'Heat Advisory'],
  },
  flood: {
    id: 'flood',
    name: 'Flooding',
    icon: '🌊',
    color: '#a855f7',
    events: ['Flash Flood', 'Flood', 'Coastal Flood'],
  },
  fire: {
    id: 'fire',
    name: 'Fire Weather',
    icon: '🔥',
    color: '#92400e',
    events: ['Red Flag', 'Fire Weather', 'Fire Warning'],
  },
  tropical: {
    id: 'tropical',
    name: 'Tropical',
    icon: '🌀',
    color: '#1e3a8a',
    events: ['Hurricane', 'Tropical Storm', 'Storm Surge'],
  },
};

// Category order for display
export const CATEGORY_ORDER = ['winter', 'severe', 'heat', 'flood', 'fire', 'tropical'];

// Marine zone prefixes — ocean/coastal areas, not land
export const MARINE_ZONE_PREFIXES = [
  'AM', 'AN', 'GM', 'LE', 'LM', 'LO', 'LS', 'LH', 'LC', 'LZ',
  'PH', 'PK', 'PM', 'PS', 'PZ', 'SL',
];

/**
 * Get category ID for an alert event type
 */
export function getCategoryForEvent(eventType) {
  for (const [categoryId, category] of Object.entries(ALERT_CATEGORIES)) {
    if (category.events.some((keyword) => eventType.includes(keyword))) {
      return categoryId;
    }
  }
  return null;
}

/**
 * Extract city/location name from a raw NWS alert feature
 */
export function extractLocationName(alert) {
  const areaDesc = alert.properties?.areaDesc || '';
  const firstArea = areaDesc.split(';')[0].trim();

  let location = firstArea
    .replace(/\s+(County|Parish|Borough|Municipality|City and Borough)/gi, '')
    .trim();

  const hasStateAbbrev = /,\s*[A-Z]{2}$/.test(location);

  if (!hasStateAbbrev) {
    const state = alert.properties?.geocode?.UGC?.[0]?.substring(0, 2) || '';
    if (location && state) {
      return `${location}, ${state}`;
    }
  }

  return location || 'Unknown Location';
}

/**
 * Extract state code from a raw NWS alert feature
 */
export function extractStateCode(alert) {
  const ugc = alert.properties?.geocode?.UGC?.[0] || '';
  if (ugc && ugc.length >= 2) {
    const stateCode = ugc.substring(0, 2);
    if (!MARINE_ZONE_PREFIXES.includes(stateCode)) {
      return stateCode;
    }
  }
  return null;
}

/**
 * Extract coordinates from alert polygon geometry (centroid).
 * Returns { lat, lon } or null if no polygon geometry exists.
 * This is the basic extraction — the client-side adds FIPS/centroid fallbacks.
 */
export function extractGeometryCoordinates(alert) {
  if (alert.geometry?.type === 'Polygon' && alert.geometry?.coordinates?.[0]) {
    const coords = alert.geometry.coordinates[0];
    const lats = coords.map((c) => c[1]);
    const lons = coords.map((c) => c[0]);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length,
    };
  }
  return null;
}

/**
 * Filter raw NWS alert features to only included event types
 */
export function filterAlertFeatures(features) {
  return features.filter((f) => {
    const event = f.properties?.event || '';
    return INCLUDED_EVENTS.some((e) => event.includes(e));
  });
}
