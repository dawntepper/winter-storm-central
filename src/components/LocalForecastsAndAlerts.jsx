import { Link } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { cityAlertsPath } from '../services/locationCatalogService';
import {
  FORECAST_SOURCE_PAGES,
  trackForecastCityClick,
} from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

/**
 * Compact forecast shortcut on state alert pages — links to the primary city
 * forecast instead of duplicating the full picker widget (Find Local Weather).
 */
export default function LocalForecastsAndAlerts({
  stateSlug,
  stateCode,
}) {
  const cities = getCitiesForStateSlug(stateSlug);
  const primaryCity = cities[0];
  if (!primaryCity) return null;

  const hasStaticPage = RICH_CITY_SLUGS.has(primaryCity.slug);

  return (
    <section aria-label="Local forecast shortcut">
      <Link
        to={cityAlertsPath(primaryCity.slug, hasStaticPage)}
        onClick={() =>
          trackForecastCityClick({
            stateCode,
            stateSlug,
            city: primaryCity.city,
            citySlug: primaryCity.slug,
            sourcePage: FORECAST_SOURCE_PAGES.STATE_FORECAST_CTA,
            destination: 'city_alert_page',
          })
        }
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
      >
        View {primaryCity.city} forecast
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
