/**
 * Zip → lat/lng → state + county lookup.
 *
 * Two-step chain:
 *   1. zip → lat/lng via Zippopotam.us (already used in the app)
 *   2. lat/lng → state + county + FIPS via the FCC's free Census Block API
 *
 * Both are public, no API key, no auth. Either failing returns null so the
 * caller can gracefully degrade to state-only tagging without breaking signup.
 */

const NWS_USER_AGENT = 'StormTracking.io (contact@stormtracking.io)';

// Simple in-memory cache so repeat signups for the same zip don't re-fetch.
// Lives only for the function instance's warm life, which is fine for our
// signup volume.
const zipCache = new Map();
const CACHE_MAX = 200;

function rememberZip(zip, value) {
  if (zipCache.size >= CACHE_MAX) {
    const firstKey = zipCache.keys().next().value;
    zipCache.delete(firstKey);
  }
  zipCache.set(zip, value);
}

async function fetchLatLngFromZip(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (err) {
    console.warn(`[zip-to-location] Zippopotam.us failed for ${zip}:`, err.message);
    return null;
  }
}

async function fetchCountyFromLatLng(lat, lon) {
  try {
    const url = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&censusYear=2020&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': NWS_USER_AGENT }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;

    // FCC returns state_code as "FL", county_name as "Lee County", county_fips as "12071"
    const state = result.state_code || null;
    const fips = result.county_fips || null;
    let county = result.county_name || null;
    // Strip the trailing " County" / " Parish" / " Borough" suffix for clean tag slugs.
    if (county) {
      county = county.replace(/\s+(County|Parish|Borough|Municipio|Census Area|Municipality|City and Borough)$/i, '').trim();
    }
    if (!state || !county) return null;
    return { state, county, fips };
  } catch (err) {
    console.warn(`[zip-to-location] FCC API failed for ${lat},${lon}:`, err.message);
    return null;
  }
}

/**
 * Look up { state, county, fips } for a US zip code.
 * Returns null on any failure — callers should fall back to state-only tagging.
 */
async function getLocationFromZip(zip) {
  if (!zip || !/^\d{5}$/.test(String(zip))) return null;
  if (zipCache.has(zip)) return zipCache.get(zip);

  const coords = await fetchLatLngFromZip(zip);
  if (!coords) {
    rememberZip(zip, null);
    return null;
  }

  const location = await fetchCountyFromLatLng(coords.lat, coords.lon);
  rememberZip(zip, location); // cache the null case too — don't retry on repeat
  return location;
}

module.exports = {
  getLocationFromZip,
};
