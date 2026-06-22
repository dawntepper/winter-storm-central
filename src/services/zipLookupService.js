/**
 * US ZIP validation and Zippopotam.us lookup with per-tab session cache.
 */

const ZIP_API = 'https://api.zippopotam.us/us';

/** Friendly inline error for invalid format or unknown ZIP. */
export const INVALID_ZIP_MESSAGE = "That doesn't look like a valid US ZIP code";

const zipCache = new Map();
const CACHE_MAX = 500;

function rememberZip(zip, value) {
  if (zipCache.size >= CACHE_MAX) {
    const firstKey = zipCache.keys().next().value;
    zipCache.delete(firstKey);
  }
  zipCache.set(zip, value);
}

/** True when input is exactly 5 digits (after trim). */
export function isValidZipFormat(input) {
  return /^\d{5}$/.test(String(input || '').trim());
}

/**
 * Look up a US ZIP via Zippopotam.us.
 * @returns {Promise<{ zip, city, state, stateAbbr, lat, lon } | null>}
 */
export async function lookupZip(zip) {
  const clean = String(zip || '').trim();
  if (!isValidZipFormat(clean)) return null;

  if (zipCache.has(clean)) {
    return zipCache.get(clean);
  }

  try {
    const res = await fetch(`${ZIP_API}/${clean}`);
    if (!res.ok) {
      rememberZip(clean, null);
      return null;
    }

    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) {
      rememberZip(clean, null);
      return null;
    }

    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      rememberZip(clean, null);
      return null;
    }

    const result = {
      zip: clean,
      city: place['place name'],
      state: place.state,
      stateAbbr: String(place['state abbreviation'] || '').toUpperCase(),
      lat,
      lon,
    };
    rememberZip(clean, result);
    return result;
  } catch (err) {
    console.warn('lookupZip:', err.message);
    return null;
  }
}

/** @internal — reset cache for tests */
export function _clearZipLookupCache() {
  zipCache.clear();
}
