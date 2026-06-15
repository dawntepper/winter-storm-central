import { useEffect, useState } from 'react';
import { citiesForState } from '../components/CitiesInState';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { getCitiesForState, cityAlertsPath } from '../services/locationCatalogService';
import { sortCitiesByName } from '../utils/sortCities';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

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
 * Merged static + catalog city shortcuts for a state page.
 */
export function useStateCityLocations(stateAbbr, stateCode, stateSlug, maxCount = 12) {
  const [locations, setLocations] = useState(() =>
    citiesForState(stateAbbr).slice(0, maxCount).map(mapStaticCity),
  );

  useEffect(() => {
    const staticCities = citiesForState(stateAbbr);
    if (staticCities.length >= 4) {
      setLocations(staticCities.slice(0, maxCount).map(mapStaticCity));
      return;
    }

    let cancelled = false;
    (async () => {
      const catalogFill = getCitiesForStateSlug(stateSlug);
      if (catalogFill.length > 0 && staticCities.length === 0) {
        if (!cancelled) {
          setLocations(catalogFill.slice(0, maxCount).map((c) => ({
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
      const merged = sortCitiesByName([
        ...staticCities.map(mapStaticCity),
        ...catalog
          .filter((c) => c.slug && !seen.has(c.slug))
          .map(mapCatalogCity),
      ]);

      setLocations(merged.slice(0, maxCount));
    })();

    return () => {
      cancelled = true;
    };
  }, [stateAbbr, stateCode, stateSlug, maxCount]);

  return locations;
}
