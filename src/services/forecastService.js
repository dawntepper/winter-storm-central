/**
 * NWS Forecast Service
 *
 * Fetches forecast data from api.weather.gov. Two-step chain because NWS
 * requires /points/{lat},{lon} first to discover the gridpoint + region URLs.
 *
 *   1. GET /points/{lat},{lon}                  →  { forecast, forecastHourly, timeZone, ... }
 *   2. GET forecast (7-day, 12-hour periods)    →  { periods: [...] }
 *      GET forecastHourly (~6.5d, hourly)       →  { periods: [...] }  (parallel with #2)
 *
 * Cache: 60-minute in-memory cache keyed by rounded coords (~3 decimal places,
 * roughly 100m precision — fine for forecast use, NWS gridpoints are coarser).
 * NWS updates forecasts hourly; longer cache TTL would serve stale data.
 *
 * "Current conditions" derives from the first hourly period rather than a
 * separate observations endpoint — NWS observations require a station ID
 * lookup we're not doing yet, and first-hour forecast is accurate enough.
 */

import { NWS_HEADERS } from '../../shared/nws-alert-parser';

const POINTS_API = 'https://api.weather.gov/points';
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes
const cache = new Map(); // key: "lat,lon" rounded, value: { data, fetchedAt }

function cacheKey(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: NWS_HEADERS });
  if (!response.ok) {
    throw new Error(`NWS ${response.status} from ${url}`);
  }
  return response.json();
}

/**
 * Returns {
 *   location: { city, state, timeZone },
 *   current: { temperature, temperatureUnit, shortForecast, icon, windSpeed, windDirection, isDaytime },
 *   hourly:  [ { startTime, endTime, temperature, temperatureUnit, shortForecast, icon, windSpeed, windDirection, isDaytime, probabilityOfPrecipitation }, ... ]  (~156 periods, ~6.5 days)
 *   daily:   [ { name, startTime, endTime, temperature, temperatureUnit, shortForecast, detailedForecast, icon, windSpeed, windDirection, isDaytime }, ... ]    (~14 periods over 7 days, day/night pairs)
 * }
 *
 * Throws on NWS errors (4xx/5xx, network) — caller should handle.
 */
export async function getForecastForCoords(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid coordinates');
  }

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  // Step 1: resolve the gridpoint
  const points = await fetchJson(`${POINTS_API}/${lat.toFixed(4)},${lon.toFixed(4)}`);
  const props = points?.properties || {};
  const forecastUrl = props.forecast;
  const hourlyUrl = props.forecastHourly;
  const timeZone = props.timeZone || null;
  const locationName = props.relativeLocation?.properties?.city || null;
  const stateAbbr = props.relativeLocation?.properties?.state || null;

  if (!forecastUrl || !hourlyUrl) {
    throw new Error('NWS points response missing forecast URLs (location may be outside NWS coverage)');
  }

  // Step 2: parallel fetch of daily + hourly
  const [forecastResp, hourlyResp] = await Promise.all([
    fetchJson(forecastUrl),
    fetchJson(hourlyUrl),
  ]);

  const daily = forecastResp?.properties?.periods || [];
  const hourly = hourlyResp?.properties?.periods || [];
  const current = hourly[0] || daily[0] || null;

  const data = {
    location: { city: locationName, state: stateAbbr, timeZone },
    current,
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

import { lookupZip, isValidZipFormat } from './zipLookupService';

/**
 * Free Zippopotam.us lookup — delegates to zipLookupService (shared session cache).
 * Returns { lat, lon, place, state, stateAbbr } or throws on lookup failure.
 */
export async function lookupZipCoords(zip) {
  if (!isValidZipFormat(zip)) {
    throw new Error('ZIP must be exactly 5 digits');
  }
  const result = await lookupZip(zip);
  if (!result) {
    throw new Error('ZIP not found');
  }
  return {
    lat: result.lat,
    lon: result.lon,
    place: result.city,
    state: result.state,
    stateAbbr: result.stateAbbr,
  };
}
