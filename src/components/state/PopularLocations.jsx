import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { citiesForState } from '../CitiesInState';
import { getCitiesForStateSlug } from '../../data/cityCatalog';
import { getCitiesForState, cityAlertsPath } from '../../services/locationCatalogService';
import { trackPopularLocationClicked } from '../../utils/analytics';
import citiesIndex from '../../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));
const MAX_PILLS = 8;

function mapStaticCity(c) {
  return {
    slug: c.slug,
    name: c.city,
    path: `/alerts/${c.slug}`,
  };
}

function mapCatalogCity(c) {
  const hasRich = c.hasStaticPage || RICH_CITY_SLUGS.has(c.slug);
  return {
    slug: c.slug,
    name: c.name || c.city,
    path: cityAlertsPath(c.slug, hasRich),
  };
}

/**
 * State-specific popular location pills above the city directory.
 */
export default function PopularLocations({ stateAbbr, stateCode, stateSlug, stateName }) {
  const [locations, setLocations] = useState(() =>
    citiesForState(stateAbbr).slice(0, MAX_PILLS).map(mapStaticCity),
  );

  useEffect(() => {
    const staticCities = citiesForState(stateAbbr);
    if (staticCities.length >= 4) {
      setLocations(staticCities.slice(0, MAX_PILLS).map(mapStaticCity));
      return;
    }

    let cancelled = false;
    (async () => {
      const catalogFill = getCitiesForStateSlug(stateSlug);
      if (catalogFill.length > 0 && staticCities.length === 0) {
        if (!cancelled) {
          setLocations(catalogFill.slice(0, MAX_PILLS).map((c) => ({
            slug: c.slug,
            name: c.city,
            path: RICH_CITY_SLUGS.has(c.slug) ? `/alerts/${c.slug}` : cityAlertsPath(c.slug, false),
          })));
        }
        return;
      }

      const catalog = await getCitiesForState(stateCode);
      if (cancelled) return;

      const seen = new Set(staticCities.map((c) => c.slug));
      const merged = [
        ...staticCities.map(mapStaticCity),
        ...catalog
          .filter((c) => c.slug && !seen.has(c.slug))
          .sort((a, b) => (b.population || 0) - (a.population || 0))
          .map(mapCatalogCity),
      ];

      setLocations(merged.slice(0, MAX_PILLS));
    })();

    return () => {
      cancelled = true;
    };
  }, [stateAbbr, stateCode, stateSlug]);

  if (locations.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">
        Popular Locations in {stateName}
      </h2>
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            to={loc.path}
            onClick={() =>
              trackPopularLocationClicked({ state: stateCode, city: loc.name })
            }
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-sky-500/50 rounded-full text-sm font-medium text-white hover:text-sky-300 transition-colors"
          >
            {loc.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
