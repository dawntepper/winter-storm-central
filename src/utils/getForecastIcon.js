/** Neutral icon for navigation-only forecast links with no condition text. */
export const FORECAST_NAV_ICON = '📍';

/**
 * Map NWS shortForecast text (or similar condition string) to a weather emoji.
 * Order matters: severe/specific terms are checked before generic ones.
 *
 * @param {string|null|undefined} forecastText
 * @param {string} [fallback=FORECAST_NAV_ICON] - returned when text is empty or unrecognized
 * @returns {string}
 */
export function getForecastIcon(forecastText, fallback = FORECAST_NAV_ICON) {
  if (!forecastText || typeof forecastText !== 'string') return fallback;
  const c = forecastText.toLowerCase().trim();
  if (!c) return fallback;

  if (c.includes('hurricane') || c.includes('tropical')) return '🌀';

  if (c.includes('thunder') || c.includes('t-storm') || c.includes('tstorm')) return '⛈️';

  if (c.includes('snow') || c.includes('flurr') || c.includes('winter') || c.includes('blizzard')) {
    return '❄️';
  }

  if (c.includes('storm')) return '⛈️';

  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';

  if (c.includes('fog') || c.includes('mist') || c.includes('haze') || c.includes('haz')) return '🌫️';

  if (c.includes('hot') || c.includes('heat')) return '🌡️';

  if (c.includes('wind') || c.includes('breez')) return '💨';

  if (c.includes('partly') || c.includes('mostly sunny') || c.includes('mostly clear')) return '🌤️';

  if (c.includes('cloudy') || c.includes('overcast')) return '☁️';

  if (c.includes('sunny') || c.includes('clear') || c.includes('fair')) return '☀️';

  return fallback;
}
