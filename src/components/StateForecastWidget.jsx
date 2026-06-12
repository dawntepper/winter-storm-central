import { Link } from 'react-router-dom';
import { formatHighLowTemps } from '../hooks/useCityForecastTemps';
import { cityAlertsPath } from '../services/locationCatalogService';
import { trackForecastCityClick } from '../utils/analytics';
import { FORECAST_NAV_ICON, getForecastIcon } from '../utils/getForecastIcon';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

export const forecastCardClassName =
  'group flex items-center gap-3 w-full px-4 py-3 bg-slate-900/60 hover:bg-sky-500/15 border border-slate-700 hover:border-sky-400/70 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/15 cursor-pointer text-sm text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

export const citySelectClass =
  'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 cursor-pointer';

export function formatCityForecastOptionLabel(city, tempsBySlug) {
  const temps = tempsBySlug[city.slug];
  const icon = getForecastIcon(temps?.shortForecast);
  const tempLabel = formatHighLowTemps(temps?.highTemp, temps?.lowTemp);
  const parts = [icon, city.city, tempLabel].filter(Boolean);
  return parts.join(' ');
}

/**
 * Full-width forecast destination card — city or state CTA.
 */
export function ForecastDestinationCard({
  to,
  label,
  icon = FORECAST_NAV_ICON,
  highTemp,
  lowTemp,
  onClick,
}) {
  const tempLabel = formatHighLowTemps(highTemp, lowTemp);

  return (
    <Link to={to} onClick={onClick} className={forecastCardClassName}>
      {icon ? (
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 min-w-0 font-semibold truncate">{label}</span>
      {tempLabel ? (
        <span className="text-slate-400 text-sm tabular-nums flex-shrink-0 whitespace-nowrap">
          {tempLabel}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="text-sm font-semibold text-sky-400 group-hover:text-sky-300 flex-shrink-0 transition-colors ml-auto"
      >
        More →
      </span>
    </Link>
  );
}

export function CityForecastDestinationCard({ city, stateSlug, stateCode, sourcePage, tempsBySlug }) {
  const temps = tempsBySlug[city.slug];
  const icon = getForecastIcon(temps?.shortForecast);
  const hasStaticPage = RICH_CITY_SLUGS.has(city.slug);

  return (
    <ForecastDestinationCard
      to={cityAlertsPath(city.slug, hasStaticPage)}
      label={city.city}
      icon={icon}
      highTemp={temps?.highTemp}
      lowTemp={temps?.lowTemp}
      onClick={() =>
        trackForecastCityClick({
          stateCode,
          stateSlug,
          city: city.city,
          citySlug: city.slug,
          sourcePage,
          destination: 'city_alert_page',
        })
      }
    />
  );
}

