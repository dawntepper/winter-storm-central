/**
 * Fetch current/forecast conditions for an arbitrary lat/lon from the NWS API.
 * Returns the same shape ZipCodeSearch produces for its result card, so the
 * caller can drop the object straight into a location's `conditions` field.
 *
 * Returns null on any error (network, NWS outage, point outside US coverage).
 */

const NWS_HEADERS = {
  'User-Agent': 'WinterStormCentral/1.0 (contact@stormtracking.io)',
  'Accept': 'application/geo+json'
};

export async function fetchCurrentConditions(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  try {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: NWS_HEADERS }
    );
    if (!pointsRes.ok) return null;

    const pointsData = await pointsRes.json();
    const forecastUrl = pointsData?.properties?.forecast;
    if (!forecastUrl) return null;

    const forecastRes = await fetch(forecastUrl, { headers: NWS_HEADERS });
    if (!forecastRes.ok) return null;

    const forecastData = await forecastRes.json();
    const periods = forecastData?.properties?.periods || [];
    if (periods.length === 0) return null;

    const first = periods[0] || {};
    const second = periods[1] || {};

    // NWS returns alternating day/night periods. High = daytime, low = nighttime.
    let highTemp = null;
    let lowTemp = null;
    if (first.isDaytime) {
      highTemp = first.temperature;
      lowTemp = second.temperature ?? null;
    } else {
      lowTemp = first.temperature;
      highTemp = second.temperature ?? null;
    }

    return {
      shortForecast: first.shortForecast || 'Unknown',
      temperature: first.temperature,
      temperatureUnit: first.temperatureUnit || 'F',
      highTemp,
      lowTemp,
      periodName: first.name || 'Today'
    };
  } catch (err) {
    console.warn('fetchCurrentConditions failed:', err.message);
    return null;
  }
}
