/**
 * Location catalog — Supabase lookups for county/city/ZIP alert search.
 * Public reads + analytics inserts use the anon Supabase client only.
 */

import { supabase } from '../lib/supabase';
import { citySlug, countySlug } from '../lib/locationSlug';
import { ABBR_TO_SLUG } from '../data/stateConfig';
import {
  trackLocationSearchSuccess,
  trackCountyAlertView as trackCountyAlertViewEvent,
  trackLocationSearchNotFound as trackLocationSearchNotFoundEvent,
} from '../utils/analytics';

const COUNTY_SELECT = 'id, slug, name, state_code, state_name, fips_code, lat, lon';
const CITY_SELECT = 'id, slug, name, state_code, state_name, lat, lon, population';

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
  };
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
    const city = cityName && stateAbbr ? await lookupCity(cityName, stateAbbr) : null;
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
    const city = await lookupCity(cityStateMatch[1], cityStateMatch[2]);
    if (city) {
      const county = await ensureCounty({ city, county: null });
      if (county) {
        return { query: trimmed, matchType: 'city', city, county, zip: null, error: null };
      }
    }
  }

  // City name (scoped to page state when available)
  const city = await lookupCity(trimmed, stateCode);
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
    .eq('state_code', st)
    .order('population', { ascending: false, nullsFirst: false });
  if (error) {
    console.warn('getCitiesForState:', error.message);
    return [];
  }
  return (data || []).map(mapCity).filter(Boolean);
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
  return (data || [])
    .map((row) => mapCity(row.cities))
    .filter(Boolean)
    .sort((a, b) => (b.population || 0) - (a.population || 0));
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
  const { error } = await supabase.from('location_search_events').insert({
    query: query || '',
    match_type: matchType || null,
    state_code: stateCode || null,
    city_id: cityId || null,
    county_id: countyId || null,
    zip_code: zipCode || null,
    page_context: pageContext || null,
    success,
    resolved_type: resolved,
  });
  if (error) console.warn('trackLocationSearch insert:', error.message);
}

/**
 * Persist failed location search (city, ZIP, or county) + Plausible event.
 */
export async function trackLocationSearchNotFound({ query, stateCode, pageContext }) {
  trackLocationSearchNotFoundEvent({
    query,
    stateCode,
  });

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
  const { error } = await supabase.from('county_alert_views').insert({
    county_id: countyId,
    state_code: stateCode || null,
    alert_count: alertCount ?? 0,
    source: source || null,
  });
  if (error) console.warn('trackCountyAlertView insert:', error.message);
}
