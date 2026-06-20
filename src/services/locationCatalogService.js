/**
 * Location catalog — Supabase lookups for county/city/ZIP alert search.
 * Public reads + analytics inserts use the anon Supabase client only.
 */

import { supabase } from '../lib/supabase';
import { citySlug, countySlug } from '../lib/locationSlug';
import { ABBR_TO_SLUG, STATE_NAMES } from '../data/stateConfig';
import { reverseGeocode } from './geoLocationService';
import { getCitySlugForLocation } from '../utils/cityLookup';
import { getAllCities } from '../data/cityCatalog';
import { sortCitiesByName } from '../utils/sortCities';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

/** Great-circle distance in miles (for nearest-city fallback). */
export function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityPagePath(slug, hasStaticPage = false) {
  return cityAlertsPath(slug, hasStaticPage || RICH_CITY_SLUGS.has(slug));
}

async function collectCityCandidates(stateCode) {
  const bySlug = new Map();

  if (stateCode) {
    const catalogCities = await getCitiesForState(stateCode);
    for (const city of catalogCities) {
      if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) continue;
      bySlug.set(city.slug, {
        citySlug: city.slug,
        cityName: city.name,
        stateCode: city.stateCode,
        lat: city.lat,
        lon: city.lon,
        hasRichPage: Boolean(city.hasStaticPage || RICH_CITY_SLUGS.has(city.slug)),
      });
    }
  }

  for (const city of getAllCities()) {
    if (stateCode && city.state_abbr !== stateCode) continue;
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) continue;
    if (!RICH_CITY_SLUGS.has(city.slug)) continue;
    bySlug.set(city.slug, {
      citySlug: city.slug,
      cityName: city.city,
      stateCode: city.state_abbr,
      lat: city.lat,
      lon: city.lon,
      hasRichPage: true,
    });
  }

  return [...bySlug.values()];
}

async function findNearestCityWithPage(lat, lon, stateCode) {
  const candidates = await collectCityCandidates(stateCode);
  if (candidates.length === 0) return null;

  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = haversineMiles(lat, lon, candidate.lat, candidate.lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  if (!best) return null;
  return {
    path: cityPagePath(best.citySlug, best.hasRichPage),
    citySlug: best.citySlug,
    cityName: best.cityName,
    stateCode: best.stateCode,
    displayName: `${best.cityName}, ${best.stateCode}`,
    distanceMiles: bestDist,
  };
}
import { getOrCreateVisitorIds } from '../utils/visitorIds';
import {
  trackLocationSearchSuccess,
  trackCountyAlertView as trackCountyAlertViewEvent,
  trackLocationSearchNotFound as trackLocationSearchNotFoundEvent,
} from '../utils/analytics';

/** Optional signed-in user id for analytics rows (null for anonymous). */
async function getOptionalUserId() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function analyticsIdentityFields(ids, userId) {
  const fields = {};
  if (ids?.visitorId) fields.visitor_id = ids.visitorId;
  if (userId) fields.user_id = userId;
  return fields;
}

/** Combined search+save demand above this → candidate for static SEO page promotion. */
export const CITY_PROMOTION_THRESHOLD = 25;

const COUNTY_SELECT = 'id, slug, name, state_code, state_name, fips_code, lat, lon';
const CITY_SELECT = 'id, slug, name, state_code, state_name, lat, lon, population, source, has_static_page';

const CENSUS_GEOCODE_URL =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

function normalizeStateCode(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

function normalizeFips(fips) {
  if (!fips) return null;
  const digits = String(fips).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(5, '0');
}

function mapCounty(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    stateCode: row.state_code,
    stateName: row.state_name,
    fipsCode: row.fips_code,
    lat: row.lat != null ? Number(row.lat) : null,
    lon: row.lon != null ? Number(row.lon) : null,
  };
}

function mapCity(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    stateCode: row.state_code,
    stateName: row.state_name,
    lat: Number(row.lat),
    lon: Number(row.lon),
    population: row.population,
    source: row.source || 'catalog',
    hasStaticPage: row.has_static_page ?? false,
  };
}

/** Parse `/alerts/city/{slug}` slug into city name + state code. */
export function parseSlugCityState(slug) {
  if (!slug) return null;
  const match = String(slug).match(/^(.+)-([a-z]{2})$/i);
  if (!match) return null;
  const name = match[1]
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
  return { name, stateCode: match[2].toUpperCase() };
}

/** Parse "City, ST" labels from saved locations and search results. */
export function parseCityStateLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const match = label.trim().match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (!match) return null;
  return { name: match[1].trim(), stateCode: match[2].toUpperCase() };
}

/** Record save demand from a "City, ST" location label. */
export async function recordSaveDemandFromLocationLabel(label) {
  await ensureCityFromSavedLocation({ label });
}

/**
 * On save of a city-shaped location: ensure a catalog row exists (user-generated
 * when needed), record uncataloged demand, return slug/path for linking.
 * Returns null for non-city labels (e.g. GPS "Near me") or when creation fails.
 */
export async function ensureCityFromSavedLocation({ name, stateCode, lat, lon, label }) {
  let cityName = name;
  let st = stateCode ? normalizeStateCode(stateCode) : null;

  if ((!cityName || !st) && label) {
    const parsed = parseCityStateLabel(label);
    if (parsed) {
      cityName = parsed.name;
      st = parsed.stateCode;
    }
  }

  if (!cityName || !st) return null;

  let city = await lookupCity(cityName, st);

  if (!city) {
    await recordCityDemand({ cityName, stateCode: st, source: 'save' });
    const latNum = lat != null ? Number(lat) : NaN;
    const lonNum = lon != null ? Number(lon) : NaN;
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      city = await ensureUserGeneratedCity({
        name: cityName,
        stateCode: st,
        lat: latNum,
        lon: lonNum,
      });
    } else {
      city = await autoCreateCityFromGeocode(cityName, st);
    }
  }

  if (!city) return null;

  return {
    slug: city.slug,
    path: cityAlertsPath(city.slug, city.hasStaticPage),
    hasStaticPage: city.hasStaticPage,
  };
}

/** Resolve a city alerts page path for a saved location object. */
export function savedLocationAlertsPath(loc) {
  if (loc?.cityAlertsPath) return loc.cityAlertsPath;
  const richSlug = getCitySlugForLocation(loc?.name);
  if (richSlug) return cityAlertsPath(richSlug, true);
  if (loc?.citySlug) return cityAlertsPath(loc.citySlug, false);
  const parsed = parseCityStateLabel(loc?.name);
  if (parsed) {
    const slug = citySlug(parsed.name, parsed.stateCode);
    if (slug) return cityAlertsPath(slug, false);
  }
  return null;
}

function myLocationLinkLabel(loc) {
  if (loc?.name && parseCityStateLabel(loc.name)) return loc.name;
  if (loc?.city && loc?.region) return `${loc.city}, ${loc.region}`;
  if (loc?.name) return loc.name;
  return 'My Location';
}

function firstSavedLocationAlertsLink(locs) {
  for (const loc of locs) {
    const path = savedLocationAlertsPath(loc);
    if (path) return { path, label: myLocationLinkLabel(loc) };
  }
  return null;
}

/**
 * Resolve the user's city alerts page from known location sources.
 * Priority: preview pin → GPS/hero label → saved pins (props) → device storage.
 * Independent of map hover — same path resolution as saved-location name links.
 *
 * @returns {{ path: string, label: string } | null}
 */
export function resolveMyLocationAlertsLink({
  previewLocation = null,
  resolvedLocation = null,
  userLocations = [],
  storedLocations = [],
} = {}) {
  const candidates = [];
  if (previewLocation) candidates.push(previewLocation);
  if (resolvedLocation?.city && resolvedLocation?.region) {
    candidates.push({ name: `${resolvedLocation.city}, ${resolvedLocation.region}` });
  } else if (resolvedLocation?.city) {
    candidates.push({ name: resolvedLocation.city });
  }
  if (userLocations?.length) candidates.push(...userLocations);

  return firstSavedLocationAlertsLink(candidates)
    || firstSavedLocationAlertsLink(storedLocations);
}

/** Record alert signup demand from a ZIP code (resolves city via Zippopotam). */
export async function recordAlertRequestDemandFromZip(zip) {
  if (!/^\d{5}$/.test(String(zip || ''))) return;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return;
    const data = await res.json();
    const place = data?.places?.[0];
    const cityName = place?.['place name'];
    const stateCode = place?.['state abbreviation'];
    if (!cityName || !stateCode) return;
    await recordCityDemandIfUncataloged({
      cityName,
      stateCode,
      source: 'alert_request',
    });
  } catch (err) {
    console.warn('recordAlertRequestDemandFromZip:', err.message);
  }
}

/**
 * Record uncataloged city demand (search, save, alert_request).
 * Uses Supabase RPC — anon client has execute but not SELECT on city_demand.
 */
export async function recordCityDemand({ cityName, stateCode, source = 'search' }) {
  if (!supabase || !cityName || !stateCode) return;
  const st = normalizeStateCode(stateCode);
  if (!st) return;
  const trimmed = String(cityName).trim();
  if (!trimmed) return;

  const { error } = await supabase.rpc('record_city_demand', {
    p_city_name: trimmed,
    p_state_code: st,
    p_event_source: source,
  });
  if (error) {
    console.warn('recordCityDemand:', error.message);
  }
}

/** Record demand only when the city is not already in the catalog. */
export async function recordCityDemandIfUncataloged({ cityName, stateCode, source = 'search' }) {
  const existing = await lookupCity(cityName, stateCode);
  if (existing) return;
  await recordCityDemand({ cityName, stateCode, source });
}

/** Forward-geocode a US city via Census geocoder (no API key, CORS-friendly). */
export async function forwardGeocodeCity(cityName, stateCode) {
  const st = normalizeStateCode(stateCode);
  const trimmed = String(cityName || '').trim();
  if (!trimmed || !st) return null;

  try {
    const address = encodeURIComponent(`${trimmed}, ${st}`);
    const url = `${CENSUS_GEOCODE_URL}?address=${address}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;

    const lat = Number(match.coordinates.y);
    const lon = Number(match.coordinates.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const matchedState = String(match.addressComponents?.state || '').toUpperCase();
    if (matchedState && matchedState !== st) return null;

    return { name: trimmed, stateCode: st, lat, lon };
  } catch (err) {
    console.warn('forwardGeocodeCity:', err.message);
    return null;
  }
}

/** Insert or fetch a user-generated city row after successful geocode. */
export async function ensureUserGeneratedCity({ name, stateCode, lat, lon, stateName }) {
  if (!supabase || !name || !stateCode || lat == null || lon == null) return null;
  const st = normalizeStateCode(stateCode);
  if (!st) return null;

  const { data: cityId, error } = await supabase.rpc('ensure_user_generated_city', {
    p_name: String(name).trim(),
    p_state_code: st,
    p_lat: lat,
    p_lon: lon,
    p_state_name: stateName || STATE_NAMES[st] || null,
  });
  if (error) {
    console.warn('ensureUserGeneratedCity:', error.message);
    return null;
  }
  if (!cityId) return null;
  return fetchCityById(cityId);
}

/**
 * Geocode + NWS verify + auto-create catalog row for uncataloged cities.
 * Returns mapped city or null when resolution fails.
 */
export async function autoCreateCityFromGeocode(cityName, stateCode) {
  const geocoded = await forwardGeocodeCity(cityName, stateCode);
  if (!geocoded) return null;

  const nws = await reverseGeocode(geocoded.lat, geocoded.lon);
  const resolvedName = nws?.city || geocoded.name;
  const resolvedState = normalizeStateCode(nws?.region) || geocoded.stateCode;

  if (resolvedState !== geocoded.stateCode) return null;

  const existing = await lookupCity(resolvedName, resolvedState);
  if (existing) return existing;

  return ensureUserGeneratedCity({
    name: resolvedName,
    stateCode: resolvedState,
    lat: geocoded.lat,
    lon: geocoded.lon,
  });
}

/**
 * Admin one-click catalog city creation from missing-search recommendations.
 * Uses Census geocode + ensure_user_generated_city RPC (same path as search/save).
 */
export async function createCatalogCityFromAdmin({ cityName, stateCode }) {
  const st = normalizeStateCode(stateCode);
  const trimmed = String(cityName || '').trim();
  if (!trimmed || !st) {
    return { ok: false, error: 'City name and state are required' };
  }
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const existing = await lookupCity(trimmed, st);
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      city: existing,
      path: cityAlertsPath(existing.slug, existing.hasStaticPage),
    };
  }

  const city = await autoCreateCityFromGeocode(trimmed, st);
  if (!city) {
    return {
      ok: false,
      error: `Could not geocode "${trimmed}, ${st}". Check the city name and state.`,
    };
  }

  return {
    ok: true,
    alreadyExists: false,
    city,
    path: cityAlertsPath(city.slug, city.hasStaticPage),
  };
}

/** Load city by slug, auto-creating from slug parse + geocode when missing. */
export async function getCityBySlugWithFallback(slug) {
  const fromDb = await getCityBySlug(slug);
  if (fromDb) return fromDb;

  const parsed = parseSlugCityState(slug);
  if (!parsed) return null;
  return autoCreateCityFromGeocode(parsed.name, parsed.stateCode);
}

async function fetchCityById(cityId) {
  if (!supabase || !cityId) return null;
  const { data, error } = await supabase
    .from('cities')
    .select(CITY_SELECT)
    .eq('id', cityId)
    .maybeSingle();
  if (error) {
    console.warn('fetchCityById:', error.message);
    return null;
  }
  return mapCity(data);
}

async function fetchCountyById(countyId) {
  if (!supabase || !countyId) return null;
  const { data, error } = await supabase
    .from('counties')
    .select(COUNTY_SELECT)
    .eq('id', countyId)
    .maybeSingle();
  if (error) {
    console.warn('fetchCountyById:', error.message);
    return null;
  }
  return mapCounty(data);
}

async function fetchCountyBySlug(slug) {
  if (!supabase || !slug) return null;
  const { data, error } = await supabase
    .from('counties')
    .select(COUNTY_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('fetchCountyBySlug:', error.message);
    return null;
  }
  return mapCounty(data);
}

async function fetchCountyByFips(fips) {
  if (!supabase || !fips) return null;
  const { data, error } = await supabase
    .from('counties')
    .select(COUNTY_SELECT)
    .eq('fips_code', normalizeFips(fips))
    .maybeSingle();
  if (error) {
    console.warn('fetchCountyByFips:', error.message);
    return null;
  }
  return mapCounty(data);
}

/** FCC Census Block API — resolves lat/lon to a catalog county via FIPS. */
async function lookupCountyFromCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const url = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&censusYear=2020&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const fips = data?.results?.[0]?.county_fips;
    return fips ? fetchCountyByFips(fips) : null;
  } catch (err) {
    console.warn('lookupCountyFromCoords:', err.message);
    return null;
  }
}

/**
 * Fill in county when city_counties or zip_locations.county_id is missing
 * (common for FORECAST_PICKER_FILL cities like Baltimore).
 */
async function ensureCounty({ city, county, lat, lon }) {
  if (county) return county;
  if (city) {
    let resolved = await fetchPrimaryCountyForCity(city.id);
    if (resolved) return resolved;
    resolved = await lookupCounty(city.name, city.stateCode);
    if (resolved) return resolved;
    if (city.lat != null && city.lon != null) {
      resolved = await lookupCountyFromCoords(city.lat, city.lon);
      if (resolved) return resolved;
    }
  }
  if (lat != null && lon != null) {
    return lookupCountyFromCoords(lat, lon);
  }
  return null;
}

async function fetchPrimaryCountyForCity(cityId) {
  if (!supabase || !cityId) return null;
  const { data, error } = await supabase
    .from('city_counties')
    .select(`is_primary, counties (${COUNTY_SELECT})`)
    .eq('city_id', cityId)
    .order('is_primary', { ascending: false });
  if (error) {
    console.warn('fetchPrimaryCountyForCity:', error.message);
    return null;
  }
  const rows = data || [];
  const primary = rows.find((r) => r.is_primary) || rows[0];
  return mapCounty(primary?.counties);
}

async function lookupZip(zip, stateContext) {
  if (!supabase) return null;
  let q = supabase
    .from('zip_locations')
    .select(`zip_code, state_code, lat, lon, city_id, county_id, counties (${COUNTY_SELECT}), cities (${CITY_SELECT})`)
    .eq('zip_code', zip);
  const st = normalizeStateCode(stateContext);
  if (st) q = q.eq('state_code', st);
  const { data, error } = await q.limit(5);
  if (error) {
    console.warn('lookupZip:', error.message);
    return null;
  }
  const row = (data || [])[0];
  if (!row) return null;

  let county = mapCounty(row.counties);
  let city = mapCity(row.cities);

  if (!county && row.county_id) county = await fetchCountyById(row.county_id);
  if (!city && row.city_id) {
    const { data: cityRow } = await supabase
      .from('cities')
      .select(CITY_SELECT)
      .eq('id', row.city_id)
      .maybeSingle();
    city = mapCity(cityRow);
  }
  if (!county) {
    county = await ensureCounty({
      city,
      county,
      lat: row.lat != null ? Number(row.lat) : null,
      lon: row.lon != null ? Number(row.lon) : null,
    });
  }

  return { zip: row.zip_code, city, county, matchType: 'zip' };
}

/** Zippopotam.us fallback when ZIP is not in zip_locations (~82 seeded ZIPs). */
async function lookupZipExternal(zip, stateContext) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;

    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);
    const stateAbbr = String(place['state abbreviation'] || '').toUpperCase();
    const st = normalizeStateCode(stateContext);
    if (st && stateAbbr && stateAbbr !== st) {
      return { mismatch: true, actualState: stateAbbr };
    }

    const cityName = place['place name'];
    let city = cityName && stateAbbr ? await lookupCity(cityName, stateAbbr) : null;
    if (!city && cityName && stateAbbr && Number.isFinite(lat) && Number.isFinite(lon)) {
      city = await ensureUserGeneratedCity({
        name: cityName,
        stateCode: stateAbbr,
        lat,
        lon,
      });
      if (city) {
        await recordCityDemand({ cityName: city.name, stateCode: city.stateCode, source: 'search' });
      }
    }
    const county = await ensureCounty({ city, county: null, lat, lon });

    return { zip, city, county, lat, lon, matchType: 'zip' };
  } catch (err) {
    console.warn('lookupZipExternal:', err.message);
    return null;
  }
}

async function lookupCity(name, stateCode) {
  if (!supabase || !name) return null;
  const st = normalizeStateCode(stateCode);
  const slug = st ? citySlug(name, st) : null;

  if (slug) {
    const { data } = await supabase
      .from('cities')
      .select(CITY_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    if (data) return mapCity(data);
  }

  const trimmed = name.trim();
  let q = supabase.from('cities').select(CITY_SELECT).ilike('name', trimmed);
  if (st) q = q.eq('state_code', st);
  const { data: exactRows, error } = await q
    .order('population', { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) {
    console.warn('lookupCity:', error.message);
    return null;
  }
  if (exactRows?.[0]) return mapCity(exactRows[0]);

  let partialQ = supabase.from('cities').select(CITY_SELECT).ilike('name', `%${trimmed}%`);
  if (st) partialQ = partialQ.eq('state_code', st);
  const { data: partialRows, error: partialError } = await partialQ
    .order('population', { ascending: false, nullsFirst: false })
    .limit(5);
  if (partialError) {
    console.warn('lookupCity partial:', partialError.message);
    return null;
  }
  return mapCity((partialRows || [])[0]);
}

async function lookupCounty(name, stateCode) {
  if (!supabase || !name) return null;
  const cleaned = String(name)
    .replace(/\s+(county|parish|borough)$/i, '')
    .trim();
  const st = normalizeStateCode(stateCode);
  const slug = st ? countySlug(cleaned, st) : null;

  if (slug) {
    const { data } = await supabase
      .from('counties')
      .select(COUNTY_SELECT)
      .eq('slug', slug)
      .maybeSingle();
    if (data) return mapCounty(data);
  }

  let exactQ = supabase.from('counties').select(COUNTY_SELECT).ilike('name', cleaned);
  if (st) exactQ = exactQ.eq('state_code', st);
  const { data: exactRows, error: exactError } = await exactQ.limit(1);
  if (exactError) {
    console.warn('lookupCounty:', exactError.message);
    return null;
  }
  if (exactRows?.[0]) return mapCounty(exactRows[0]);

  let partialQ = supabase.from('counties').select(COUNTY_SELECT).ilike('name', `%${cleaned}%`);
  if (st) partialQ = partialQ.eq('state_code', st);
  const { data: rows, error } = await partialQ.order('name').limit(5);
  if (error) {
    console.warn('lookupCounty partial:', error.message);
    return null;
  }
  return mapCounty((rows || [])[0]);
}

/**
 * Resolve a user search query to catalog city/county records.
 * @param {string} query
 * @param {string} [stateContext] — 2-letter state code from the current state page
 * @returns {Promise<{ query, matchType, city, county, zip, error }>}
 */
export async function resolveLocationSearch(query, stateContext) {
  const trimmed = String(query || '').trim();
  const empty = { query: trimmed, matchType: null, city: null, county: null, zip: null, error: null };

  if (!trimmed) return { ...empty, error: 'Enter a ZIP, city, or county' };
  if (!supabase) return { ...empty, error: 'Location search is unavailable' };

  const stateCode = normalizeStateCode(stateContext);

  // 5-digit ZIP
  if (/^\d{5}$/.test(trimmed)) {
    let zipResult = await lookupZip(trimmed, stateCode);
    if (!zipResult) zipResult = await lookupZipExternal(trimmed, stateCode);
    if (zipResult?.mismatch) {
      return {
        ...empty,
        error: `ZIP ${trimmed} is in ${zipResult.actualState}, not ${stateCode}`,
      };
    }
    if (!zipResult) {
      const hint = stateCode
        ? `ZIP ${trimmed} not found in ${stateCode}`
        : `ZIP ${trimmed} not found`;
      return { ...empty, error: hint };
    }
    if (!zipResult.county) {
      return { ...empty, error: `ZIP ${trimmed} found but county could not be resolved` };
    }
    return {
      query: trimmed,
      matchType: 'zip',
      city: zipResult.city,
      county: zipResult.county,
      zip: zipResult.zip,
      error: null,
    };
  }

  // "City, ST"
  const cityStateMatch = trimmed.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (cityStateMatch) {
    let city = await lookupCity(cityStateMatch[1], cityStateMatch[2]);
    if (!city) {
      city = await autoCreateCityFromGeocode(cityStateMatch[1], cityStateMatch[2]);
      if (city) {
        await recordCityDemand({ cityName: city.name, stateCode: city.stateCode, source: 'search' });
      }
    }
    if (city) {
      const county = await ensureCounty({ city, county: null });
      if (county) {
        return { query: trimmed, matchType: 'city', city, county, zip: null, error: null };
      }
    }
  }

  // City name (scoped to page state when available)
  let city = await lookupCity(trimmed, stateCode);
  if (!city && stateCode) {
    city = await autoCreateCityFromGeocode(trimmed, stateCode);
    if (city) {
      await recordCityDemand({ cityName: city.name, stateCode: city.stateCode, source: 'search' });
    }
  }
  if (city) {
    const county = await ensureCounty({ city, county: null });
    if (county) {
      return { query: trimmed, matchType: 'city', city, county, zip: null, error: null };
    }
  }

  // County name
  const county = await lookupCounty(trimmed, stateCode);
  if (county) {
    return { query: trimmed, matchType: 'county', city: null, county, zip: null, error: null };
  }

  const notFoundMsg = stateCode
    ? `No city or county in ${stateCode} matched "${trimmed}"`
    : `No matching city or county found`;
  return { ...empty, error: notFoundMsg };
}

/**
 * Returns true when an NWS alert's issuing state matches the catalog county.
 */
function alertStateMatchesCounty(alert, county) {
  const countyState = normalizeStateCode(county?.stateCode);
  if (!countyState) return true;
  if (!alert?.state) return true;
  return alert.state === countyState;
}

/**
 * areaDesc fallback when SAME/FIPS codes are absent — requires state in each segment.
 * NWS format: "Lee, FL; Hendry, FL" or "Lee County, FL".
 */
function areaDescMatchesCounty(alert, county) {
  const countyState = normalizeStateCode(county?.stateCode);
  const countyName = String(county?.name || '').trim();
  if (!countyState || !countyName) return false;
  if (!alertStateMatchesCounty(alert, county)) return false;

  const area = String(alert.areaDesc || alert.location || '');
  const nameLower = countyName.toLowerCase();
  const stPattern = new RegExp(`,\\s*${countyState}\\b`, 'i');

  for (const segment of area.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed || !stPattern.test(trimmed)) continue;
    const base = trimmed.replace(/,\s*[A-Z]{2}.*$/i, '').trim().toLowerCase();
    const normalized = base
      .replace(/\s+(county|parish|borough)$/i, '')
      .trim();
    if (normalized === nameLower || normalized.startsWith(`${nameLower} `)) return true;
  }
  return false;
}

/**
 * Returns true when an NWS alert affects the given county.
 * Matches by FIPS (SAME codes) first; never matches county name across states.
 */
export function alertMatchesCounty(alert, county) {
  if (!alert || !county) return false;
  if (!alertStateMatchesCounty(alert, county)) return false;

  const fips = normalizeFips(county.fipsCode);
  const sameCodes = Array.isArray(alert.sameCodes) ? alert.sameCodes : [];

  if (fips && sameCodes.length > 0) {
    for (const code of sameCodes) {
      if (normalizeFips(code) === fips) return true;
    }
    return false;
  }

  return areaDescMatchesCounty(alert, county);
}

/**
 * Returns true when an NWS alert affects a catalog city (county FIPS scope).
 */
export function alertMatchesCity(alert, city, county) {
  if (!alert || !city) return false;
  if (county) return alertMatchesCounty(alert, county);

  const cityState = normalizeStateCode(city.stateCode);
  if (cityState && alert.state && alert.state !== cityState) return false;

  const cityName = String(city.name || '').toLowerCase();
  if (!cityName) return false;
  const area = String(alert.areaDesc || alert.location || '').toLowerCase();
  return area.includes(cityName);
}

/**
 * Filter active NWS alerts for a county (by FIPS / area description).
 * @param {string} countyId
 * @param {object[]} allAlerts — parsed alerts from useExtremeWeather
 */
export async function getCountyAlerts(countyId, allAlerts = []) {
  const county = await fetchCountyById(countyId);
  if (!county) return { county: null, alerts: [] };
  const alerts = (allAlerts || []).filter((a) => alertMatchesCounty(a, county));
  return { county, alerts };
}

/**
 * All counties in a state (for state-scoped dropdowns).
 */
export async function getCountiesForState(stateCode) {
  if (!supabase) return [];
  const st = normalizeStateCode(stateCode);
  if (!st) return [];
  const { data, error } = await supabase
    .from('counties')
    .select(COUNTY_SELECT)
    .eq('state_code', st)
    .order('name');
  if (error) {
    console.warn('getCountiesForState:', error.message);
    return [];
  }
  return (data || []).map(mapCounty).filter(Boolean);
}

/**
 * All cities in a state (for state-scoped dropdowns).
 */
export async function getCitiesForState(stateCode) {
  if (!supabase) return [];
  const st = normalizeStateCode(stateCode);
  if (!st) return [];
  const { data, error } = await supabase
    .from('cities')
    .select(CITY_SELECT)
    .eq('state_code', st);
  if (error) {
    console.warn('getCitiesForState:', error.message);
    return [];
  }
  return sortCitiesByName((data || []).map(mapCity).filter(Boolean));
}

/**
 * Resolve a county dropdown selection to county + filtered alerts.
 */
export async function resolveCountySelection(countyId, allAlerts = []) {
  const county = await fetchCountyById(countyId);
  if (!county) return { error: 'County not found', county: null, city: null, zip: null, alerts: [] };
  const { alerts } = await getCountyAlerts(countyId, allAlerts);
  return { county, city: null, zip: null, matchType: 'county', alerts, error: null };
}

/**
 * Resolve a typed city name within a state (catalog lookup only — no county/ZIP fallback).
 * @returns {Promise<{ query, matchType, city, county, zip, error }>}
 */
export async function resolveCityByName(name, stateCode, allAlerts = []) {
  const trimmed = String(name || '').trim();
  const empty = { query: trimmed, matchType: null, city: null, county: null, zip: null, error: null };

  if (!trimmed) return { ...empty, error: 'Enter a city name' };
  if (!supabase) return { ...empty, error: 'Location search is unavailable' };

  const city = await lookupCity(trimmed, stateCode);
  if (!city) {
    const created = await autoCreateCityFromGeocode(trimmed, stateCode);
    if (created) {
      await recordCityDemand({ cityName: created.name, stateCode: created.stateCode, source: 'search' });
      const county = await ensureCounty({ city: created, county: null });
      if (!county) {
        return {
          ...empty,
          city: created,
          matchType: 'not_found',
          error: `City "${created.name}" found but county could not be resolved`,
        };
      }
      const { alerts } = await getCountyAlerts(county.id, allAlerts);
      return {
        query: trimmed,
        matchType: 'city',
        city: created,
        county,
        zip: null,
        alerts,
        error: null,
      };
    }

    return {
      ...empty,
      matchType: 'not_found',
      error: `No city in ${stateCode || 'this state'} matched "${trimmed}"`,
    };
  }

  const county = await ensureCounty({ city, county: null });
  if (!county) {
    return {
      ...empty,
      city,
      matchType: 'not_found',
      error: `City "${city.name}" found but county could not be resolved`,
    };
  }

  const { alerts } = await getCountyAlerts(county.id, allAlerts);
  return {
    query: trimmed,
    matchType: 'city',
    city,
    county,
    zip: null,
    alerts,
    error: null,
  };
}

/**
 * Resolve a city dropdown selection to city, county, and filtered alerts.
 */
export async function resolveCitySelection(cityId, allAlerts = []) {
  const city = await fetchCityById(cityId);
  if (!city) return { error: 'City not found', county: null, city: null, zip: null, alerts: [] };
  const county = await ensureCounty({ city, county: null });
  if (!county) {
    return { error: 'Could not resolve county for this city', county: null, city, zip: null, alerts: [] };
  }
  const { alerts } = await getCountyAlerts(county.id, allAlerts);
  return { county, city, zip: null, matchType: 'city', alerts, error: null };
}

/**
 * Cities linked to a county via city_counties.
 */
export async function getCitiesForCounty(countyId) {
  if (!supabase || !countyId) return [];
  const { data, error } = await supabase
    .from('city_counties')
    .select(`is_primary, cities (${CITY_SELECT})`)
    .eq('county_id', countyId)
    .order('is_primary', { ascending: false });
  if (error) {
    console.warn('getCitiesForCounty:', error.message);
    return [];
  }
  return sortCitiesByName(
    (data || [])
      .map((row) => mapCity(row.cities))
      .filter(Boolean),
  );
}

/**
 * Load a catalog city by slug.
 */
export async function getCityBySlug(slug) {
  if (!supabase || !slug) return null;
  const { data, error } = await supabase
    .from('cities')
    .select(CITY_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('getCityBySlug:', error.message);
    return null;
  }
  return mapCity(data);
}

export { fetchCountyBySlug, fetchPrimaryCountyForCity as getPrimaryCountyForCity };

export function getStateSlugForCode(stateCode) {
  return ABBR_TO_SLUG[stateCode] || null;
}

export function cityAlertsPath(citySlug, hasRichPage) {
  return hasRichPage ? `/alerts/${citySlug}` : `/alerts/city/${citySlug}`;
}

/**
 * Resolve a city weather page from GPS coordinates.
 * Creates catalog cities when supported; falls back to nearest supported city.
 */
export async function resolveCityPageFromCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      navigationSuccess: false,
      path: null,
      citySlug: null,
      cityName: null,
      stateCode: null,
      lat,
      lon,
      displayName: 'Your current location',
      resolvedVia: 'none',
      fallbackMessage: 'We found your location, but a city page is not available yet.',
    };
  }

  const place = await reverseGeocode(lat, lon);
  const stateCode = place?.region ? normalizeStateCode(place.region) : null;

  if (place?.city && stateCode) {
    const richSlug = getCitySlugForLocation(`${place.city}, ${stateCode}`);
    if (richSlug) {
      return {
        navigationSuccess: true,
        path: cityPagePath(richSlug, true),
        citySlug: richSlug,
        cityName: place.city,
        stateCode,
        lat,
        lon,
        displayName: `${place.city}, ${stateCode}`,
        resolvedVia: 'static_index',
        fallbackMessage: null,
      };
    }

    let city = await lookupCity(place.city, stateCode);
    if (!city) {
      await recordCityDemand({ cityName: place.city, stateCode, source: 'search' });
      city = await ensureUserGeneratedCity({
        name: place.city,
        stateCode,
        lat,
        lon,
      });
    }

    if (city) {
      return {
        navigationSuccess: true,
        path: cityPagePath(city.slug, city.hasStaticPage),
        citySlug: city.slug,
        cityName: city.name,
        stateCode: city.stateCode,
        lat,
        lon,
        displayName: `${city.name}, ${city.stateCode}`,
        resolvedVia: 'catalog',
        fallbackMessage: null,
      };
    }
  }

  const nearest = await findNearestCityWithPage(lat, lon, stateCode);
  if (nearest) {
    return {
      navigationSuccess: true,
      path: nearest.path,
      citySlug: nearest.citySlug,
      cityName: nearest.cityName,
      stateCode: nearest.stateCode,
      lat,
      lon,
      displayName: nearest.displayName,
      resolvedVia: 'nearest',
      fallbackMessage: null,
    };
  }

  return {
    navigationSuccess: false,
    path: null,
    citySlug: null,
    cityName: place?.city || null,
    stateCode,
    lat,
    lon,
    displayName: place?.city && stateCode
      ? `${place.city}, ${stateCode}`
      : 'Your current location',
    resolvedVia: 'none',
    fallbackMessage: 'We found your location, but a city page is not available yet.',
  };
}

/**
 * Persist search analytics + Plausible event.
 */
export async function trackLocationSearch(event) {
  const {
    query,
    matchType,
    stateCode,
    cityId,
    countyId,
    zipCode,
    pageContext,
    resultCount,
    success = true,
    resolvedType,
  } = event || {};

  const resolved = resolvedType || matchType || (success ? 'none' : 'not_found');

  if (success) {
    trackLocationSearchSuccess({
      query,
      stateCode: stateCode || null,
      resolvedType: resolved,
    });
  }

  if (!supabase) return;
  // No .select() — anon has INSERT but not SELECT RLS; RETURNING would fail.
  const [ids, userId] = await Promise.all([getOrCreateVisitorIds(), getOptionalUserId()]);
  const payload = {
    query: query || '',
    state_code: stateCode || null,
    source_page: pageContext || null,
    resolved_city_id: cityId || null,
    resolved_county_id: countyId || null,
    resolved_zip: zipCode || null,
    success,
    resolved_type: resolved,
    ...analyticsIdentityFields(ids, userId),
  };

  const { error } = await supabase.from('location_search_events').insert(payload);
  if (error) {
    console.warn('trackLocationSearch insert:', error.message);
    return;
  }

  if (import.meta.env.DEV) {
    console.log('[locationSearch] inserted', {
      query: (query || '').slice(0, 40),
      stateCode: stateCode || null,
      searchType: resolved,
      success,
    });
  }
}

/**
 * Persist failed location search (city, ZIP, or county) + Plausible event.
 */
export async function trackLocationSearchNotFound({ query, stateCode, pageContext }) {
  trackLocationSearchNotFoundEvent({
    query,
    stateCode,
  });

  const parsed = parseCityStateLabel(query) || (stateCode ? { name: query, stateCode } : null);
  if (parsed?.name && parsed?.stateCode) {
    await recordCityDemandIfUncataloged({
      cityName: parsed.name,
      stateCode: parsed.stateCode,
      source: 'search',
    });
  }

  await trackLocationSearch({
    query,
    matchType: 'not_found',
    stateCode,
    pageContext,
    resultCount: 0,
    success: false,
    resolvedType: 'not_found',
  });
}

/**
 * Persist county view analytics + Plausible event.
 */
export async function trackCountyAlertView(event) {
  const { countyId, stateCode, alertCount, source, countyName } = event || {};

  const recorded = trackCountyAlertViewEvent({
    countyId,
    stateCode,
    alertCount: alertCount ?? 0,
    source: source || 'unknown',
    countyName,
  });

  if (!recorded || !supabase || !countyId) return;

  const [ids, userId] = await Promise.all([getOrCreateVisitorIds(), getOptionalUserId()]);
  const { error } = await supabase.from('county_alert_views').insert({
    county_id: countyId,
    state_code: stateCode || null,
    alert_count: alertCount ?? 0,
    source_page: source || null,
    ...analyticsIdentityFields(ids, userId),
  });
  if (error) {
    console.warn('trackCountyAlertView insert:', error.message);
    return;
  }

  if (import.meta.env.DEV) {
    console.log('[countyAlertView] inserted', {
      countyId,
      stateCode: stateCode || null,
      source: source || null,
    });
  }
}
