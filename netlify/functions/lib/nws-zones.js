/**
 * NWS County Zones cache.
 *
 * NWS alerts identify affected geography via UGC codes (e.g., "FLC071"). The
 * letter following the state abbreviation is "C" for a county UGC or "Z" for
 * a forecast/fire/marine zone. For Phase 1 county matching we only resolve
 * "*C*" codes and ignore "*Z*" entries.
 *
 * To map UGC → county name we fetch the full county-zone catalog from NWS
 * once at function cold start (~3300 zones, a few hundred KB) and keep it in
 * module scope. If the fetch fails, lookups return null and the alert send
 * path falls back to state-level matching.
 */

const NWS_HEADERS = {
  'User-Agent': 'StormTracking.io (contact@stormtracking.io)',
  Accept: 'application/geo+json',
};

const ZONES_URL = 'https://api.weather.gov/zones?type=county';

let zonesPromise = null;

async function loadZones() {
  try {
    const res = await fetch(ZONES_URL, { headers: NWS_HEADERS });
    if (!res.ok) {
      console.warn(`[nws-zones] NWS zones fetch failed: ${res.status}`);
      return new Map();
    }
    const data = await res.json();
    const map = new Map();
    for (const feature of data.features || []) {
      const props = feature.properties || {};
      const id = props.id;
      const name = props.name;
      if (id && name) map.set(id, name);
    }
    console.log(`[nws-zones] Loaded ${map.size} county zones`);
    return map;
  } catch (err) {
    console.warn('[nws-zones] Failed to load zones:', err.message);
    return new Map();
  }
}

function getZonesPromise() {
  if (!zonesPromise) zonesPromise = loadZones();
  return zonesPromise;
}

/**
 * Resolve a UGC code (e.g., "FLC071") to a county name (e.g., "Lee").
 * Returns null for non-county UGCs or unknown codes.
 */
async function getCountyNameFromUGC(ugc) {
  if (!ugc || !/^[A-Z]{2}C\d{3}$/.test(ugc)) return null;
  const zones = await getZonesPromise();
  return zones.get(ugc) || null;
}

/**
 * Resolve an array of UGCs in parallel. Returns a Map<ugc, name>.
 */
async function getCountyNamesForUGCs(ugcs) {
  if (!ugcs?.length) return new Map();
  const zones = await getZonesPromise();
  const result = new Map();
  for (const ugc of ugcs) {
    if (/^[A-Z]{2}C\d{3}$/.test(ugc)) {
      const name = zones.get(ugc);
      if (name) result.set(ugc, name);
    }
  }
  return result;
}

module.exports = {
  getCountyNameFromUGC,
  getCountyNamesForUGCs,
};
