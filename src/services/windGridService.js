/**
 * CONUS surface wind grid via Open-Meteo GFS (free, no API key).
 * https://open-meteo.com/en/docs/gfs-api
 *
 * Returns { points: [{ lat, lon, speed, direction }], fetchedAt }.
 */

const GFS_WIND_API = 'https://api.open-meteo.com/v1/gfs';
const CACHE_TTL_MS = 15 * 60 * 1000;

const CONUS_LATS = [24, 27.5, 31, 34.5, 38, 41.5, 45, 48.5];
const CONUS_LONS = [-125, -119, -113, -107, -101, -95, -89, -83, -77, -71, -65];

let cache = null;

function buildCoordinatePairs() {
  const latitudes = [];
  const longitudes = [];
  for (const lat of CONUS_LATS) {
    for (const lon of CONUS_LONS) {
      latitudes.push(lat);
      longitudes.push(lon);
    }
  }
  return { latitudes, longitudes };
}

function currentHourIndex(times) {
  const now = Date.now();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const diff = Math.abs(t - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * @returns {Promise<{ points: Array<{ lat: number, lon: number, speed: number, direction: number }>, fetchedAt: number } | null>}
 */
export async function fetchConusWindGrid() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const { latitudes, longitudes } = buildCoordinatePairs();
  const params = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    hourly: 'wind_speed_10m,wind_direction_10m',
    forecast_days: '1',
    models: 'gfs_global',
    wind_speed_unit: 'ms',
  });

  try {
    const response = await fetch(`${GFS_WIND_API}?${params}`);
    if (!response.ok) return null;

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const points = [];
    for (const row of rows) {
      const times = row.hourly?.time;
      const speeds = row.hourly?.wind_speed_10m;
      const directions = row.hourly?.wind_direction_10m;
      if (!times?.length || !speeds?.length || !directions?.length) continue;

      const idx = currentHourIndex(times);
      const speed = speeds[idx];
      const direction = directions[idx];
      if (speed == null || direction == null) continue;

      points.push({
        lat: row.latitude,
        lon: row.longitude,
        speed,
        direction,
      });
    }

    const data = { points, fetchedAt: Date.now() };
    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.error('Wind grid fetch error:', err);
    return null;
  }
}
