/**
 * Zip → lat/lng → state + county lookup.
 *
 * Two-step chain:
 *   1. zip → lat/lng via Zippopotam.us (already used in the app)
 *   2. lat/lng → state + county + FIPS via the FCC's free Census Block API
 *
 * Both are public, no API key, no auth. Returns null on failure — callers
 * must NOT silently degrade zip signups to state-only tagging (that sends
 * statewide digests to county-intent subscribers).
 */

const NWS_USER_AGENT = 'StormTracking.io (contact@stormtracking.io)';

// Simple in-memory cache so repeat signups for the same zip don't re-fetch.
// Lives only for the function instance's warm life, which is fine for our
// signup volume. Only successful lookups are cached — caching null would
// poison a zip for the warm instance after a single transient API blip.
const zipCache = new Map();
const CACHE_MAX = 200;
const LOOKUP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

function rememberZip(zip, value) {
  if (zipCache.size >= CACHE_MAX) {
    const firstKey = zipCache.keys().next().value;
    zipCache.delete(firstKey);
  }
  zipCache.set(zip, value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function lookupOnce(zip) {
  const coords = await fetchLatLngFromZip(zip);
  if (!coords) return null;
  return fetchCountyFromLatLng(coords.lat, coords.lon);
}

/**
 * Look up { state, county, fips } for a US zip code.
 * Retries transient upstream failures. Returns null only after all attempts
 * fail — callers should reject the signup rather than tag state-only.
 */
async function getLocationFromZip(zip) {
  if (!zip || !/^\d{5}$/.test(String(zip))) return null;
  if (zipCache.has(zip)) return zipCache.get(zip);

  let location = null;
  for (let attempt = 1; attempt <= LOOKUP_ATTEMPTS; attempt++) {
    location = await lookupOnce(zip);
    if (location) break;
    if (attempt < LOOKUP_ATTEMPTS) {
      console.warn(`[zip-to-location] Lookup miss for ${zip} (attempt ${attempt}/${LOOKUP_ATTEMPTS}), retrying`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  if (location) rememberZip(zip, location);
  return location;
}

module.exports = {
  getLocationFromZip,
};
