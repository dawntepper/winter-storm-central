/**
 * Location detection for the "Weather Near Me" headline.
 *
 * Two layers, intentionally kept separate so the silent path can never disrupt
 * the initial render (protecting the low bounce rate):
 *
 *   Layer 1 — fetchApproxLocation() (silent):
 *     Reads Netlify's edge geo via /api/geo. Free, no API key, no rate limit,
 *     no IP exposed to the client. Used ONLY to personalize the header text —
 *     it never moves the map.
 *
 *   Layer 2 — reverseGeocode() (explicit):
 *     Turns precise GPS coordinates into a "City, ST" label via the NWS points
 *     endpoint — the same National Weather Service API the rest of the app
 *     already uses. Triggered only when the user taps "Find Weather Near Me".
 *
 * Both resolve to null on any failure so callers can fall back gracefully
 * (the header simply keeps its generic phrase).
 */

// Layer 1: coarse city/region from Netlify edge geo. Returns null in local dev
// (the Vite server has no /api/geo and serves index.html, which we detect via
// the content-type guard below) and on any network/parse error.
export async function fetchApproxLocation() {
  try {
    const res = await fetch('/api/geo', { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const data = await res.json();
    if (!data?.city) return null;
    return { city: data.city, region: data.region || null };
  } catch {
    return null;
  }
}

// Layer 2: reverse-geocode exact GPS coords to { city, region } via NWS.
// api.weather.gov is CORS-enabled and already used client-side elsewhere
// (see src/utils/cityLookup.js / ZipCodeSearch).
export async function reverseGeocode(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const rel = data?.properties?.relativeLocation?.properties;
    if (!rel?.city) return null;
    return { city: rel.city, region: rel.state || null };
  } catch {
    return null;
  }
}

function normalizeFips(fips) {
  if (!fips) return null;
  const digits = String(fips).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(5, '0');
}

/** NWS county zone id, e.g. FIPS 12057 + FL → FLC057 */
export function fipsToNwsCountyZone(fips, stateCode) {
  const normalized = normalizeFips(fips);
  const st = String(stateCode || '').trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(st)) return null;
  return `${st}C${normalized.slice(2)}`;
}

function geometryBboxCentroid(geometry) {
  if (!geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2 };
}

function zoneToFeature(zoneData) {
  if (!zoneData?.geometry) return null;
  return {
    type: 'Feature',
    geometry: zoneData.geometry,
    properties: {
      name: zoneData.properties?.name || null,
      state: zoneData.properties?.state || null,
    },
  };
}

/** County polygon by catalog FIPS — avoids reverse-geocode picking the wrong state. */
export async function fetchCountyGeoJSONByFips(fips, stateCode) {
  const zoneId = fipsToNwsCountyZone(fips, stateCode);
  if (!zoneId) return null;
  try {
    const zoneRes = await fetch(`https://api.weather.gov/zones/county/${zoneId}`, {
      headers: { Accept: 'application/geo+json' },
    });
    if (!zoneRes.ok) return null;
    const zoneData = await zoneRes.json();
    return zoneToFeature(zoneData);
  } catch {
    return null;
  }
}

// Fetch the user's county polygon as a GeoJSON Feature for "your area"
// highlighting. NWS issues alerts by county/zone, so the county is the
// meaningful unit (ZIP/ZCTA boundaries aren't available from NWS).
//
// Two hops, both on the CORS-enabled api.weather.gov: /points → county zone
// URL → the zone's geometry. Returns null on any miss so the caller can skip
// the overlay silently. The returned Feature carries properties.name (county).
export async function fetchCountyGeoJSON(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const ptUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const ptRes = await fetch(ptUrl, { headers: { Accept: 'application/geo+json' } });
    if (!ptRes.ok) return null;
    const ptData = await ptRes.json();
    const countyUrl = ptData?.properties?.county;
    if (!countyUrl) return null;

    const zoneRes = await fetch(countyUrl, { headers: { Accept: 'application/geo+json' } });
    if (!zoneRes.ok) return null;
    const zoneData = await zoneRes.json();
    return zoneToFeature(zoneData);
  } catch {
    return null;
  }
}

/**
 * County highlight for catalog selections. Prefers FIPS → NWS zone (authoritative);
 * falls back to lat/lon reverse geocode for GPS / ZIP-only flows.
 * @returns {Promise<{ feature: object|null, lat: number|null, lon: number|null }>}
 */
export async function fetchCountyHighlight({ fipsCode, stateCode, lat, lon } = {}) {
  if (fipsCode && stateCode) {
    const feature = await fetchCountyGeoJSONByFips(fipsCode, stateCode);
    if (feature) {
      const centroid = geometryBboxCentroid(feature.geometry);
      return {
        feature,
        lat: centroid?.lat ?? (Number.isFinite(lat) ? lat : null),
        lon: centroid?.lon ?? (Number.isFinite(lon) ? lon : null),
      };
    }
  }
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const feature = await fetchCountyGeoJSON(lat, lon);
    return { feature, lat, lon };
  }
  return { feature: null, lat: null, lon: null };
}
