/**
 * Open-Meteo current conditions + short-range forecast for a lat/lon.
 *
 * Used by city alert pages to show real-time temp/feels-like/humidity/wind/UV
 * and a 4-day daily forecast alongside live NWS alerts.
 *
 * Public domain data, no API key required.
 * Docs: https://open-meteo.com/en/docs
 *
 * Returns null on any failure (network, parse error, missing fields) so the
 * caller can render a graceful fallback without crashing the page.
 */

const BASE = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes (https://open-meteo.com/en/docs)
const WMO_CODES = {
  0:  { label: 'Clear',                 icon: '☀️' },
  1:  { label: 'Mainly clear',          icon: '🌤️' },
  2:  { label: 'Partly cloudy',         icon: '⛅' },
  3:  { label: 'Overcast',              icon: '☁️' },
  45: { label: 'Fog',                   icon: '🌫️' },
  48: { label: 'Freezing fog',          icon: '🌫️' },
  51: { label: 'Light drizzle',         icon: '🌦️' },
  53: { label: 'Drizzle',               icon: '🌦️' },
  55: { label: 'Heavy drizzle',         icon: '🌦️' },
  56: { label: 'Light freezing drizzle', icon: '🌨️' },
  57: { label: 'Freezing drizzle',      icon: '🌨️' },
  61: { label: 'Light rain',            icon: '🌧️' },
  63: { label: 'Rain',                  icon: '🌧️' },
  65: { label: 'Heavy rain',            icon: '🌧️' },
  66: { label: 'Light freezing rain',   icon: '🌨️' },
  67: { label: 'Freezing rain',         icon: '🌨️' },
  71: { label: 'Light snow',            icon: '🌨️' },
  73: { label: 'Snow',                  icon: '🌨️' },
  75: { label: 'Heavy snow',            icon: '🌨️' },
  77: { label: 'Snow grains',           icon: '🌨️' },
  80: { label: 'Rain showers',          icon: '🌦️' },
  81: { label: 'Heavy rain showers',    icon: '🌧️' },
  82: { label: 'Violent rain showers',  icon: '🌧️' },
  85: { label: 'Snow showers',          icon: '🌨️' },
  86: { label: 'Heavy snow showers',    icon: '🌨️' },
  95: { label: 'Thunderstorm',          icon: '⛈️' },
  96: { label: 'Thunderstorm w/ hail',  icon: '⛈️' },
  99: { label: 'Severe thunderstorm',   icon: '⛈️' },
};

export function describeWeatherCode(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: '❓' };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function degreesToCompass(deg) {
  if (typeof deg !== 'number') return '';
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return COMPASS[idx];
}

export async function fetchOpenMeteoConditions({ lat, lon, timezone = 'auto' } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'is_day', 'precipitation', 'weather_code',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_probability_max', 'wind_speed_10m_max',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone,
    forecast_days: '4',
  });

  try {
    const res = await fetch(`${BASE}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    const daily = data?.daily;
    if (!cur || !daily) return null;

    const days = (daily.time || []).map((iso, i) => ({
      date: iso,
      weatherCode: daily.weather_code?.[i] ?? null,
      tempMax: daily.temperature_2m_max?.[i] ?? null,
      tempMin: daily.temperature_2m_min?.[i] ?? null,
      precipChance: daily.precipitation_probability_max?.[i] ?? null,
    }));

    return {
      fetchedAt: new Date().toISOString(),
      current: {
        temperature: cur.temperature_2m ?? null,
        apparentTemperature: cur.apparent_temperature ?? null,
        humidity: cur.relative_humidity_2m ?? null,
        precipitation: cur.precipitation ?? null,
        weatherCode: cur.weather_code ?? null,
        windSpeed: cur.wind_speed_10m ?? null,
        windDirection: cur.wind_direction_10m ?? null,
        windGusts: cur.wind_gusts_10m ?? null,
        uvIndex: cur.uv_index ?? null,
        isDay: cur.is_day === 1,
      },
      daily: days,
    };
  } catch {
    return null;
  }
}
