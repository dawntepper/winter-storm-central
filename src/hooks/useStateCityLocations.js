import { useEffect, useState } from 'react';
import { citiesForState } from '../components/CitiesInState';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { getCitiesForState, cityAlertsPath } from '../services/locationCatalogService';
import { sortCitiesByPopulation } from '../utils/sortCities';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });
const POPULATION_BY_SLUG = {};
for (const [path, mod] of Object.entries(cityModules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match && match[1] !== 'index') {
    const data = mod.default || mod;
    if (typeof data?.population === 'number') {
      POPULATION_BY_SLUG[match[1]] = data.population;
    }
  }
}

function mapStaticCity(c) {
  return {
    slug: c.slug,
    name: c.city,
    population: POPULATION_BY_SLUG[c.slug] ?? 0,
    path: `/alerts/${c.slug}`,
  };
}

function mapCatalogCity(c) {
  const hasRich = c.hasStaticPage || RICH_CITY_SLUGS.has(c.slug);
  return {
    slug: c.slug,
    name: c.name || c.city,
    population: Number(c.population) || 0,
    path: cityAlertsPath(c.slug, hasRich),
  };
}

function mapCatalogFillCity(c) {
  return {
    slug: c.slug,
    name: c.city,
    population: POPULATION_BY_SLUG[c.slug] ?? 0,
    path: RICH_CITY_SLUGS.has(c.slug) ? `/alerts/${c.slug}` : cityAlertsPath(c.slug, false),
  };
}

/**
 * Merged static + catalog city shortcuts for a state page.
 * Sorted by population (largest first); city_demand is admin-only so not used here.
 */
export function useStateCityLocations(stateAbbr, stateCode, stateSlug, maxCount = 8) {
  const [locations, setLocations] = useState(() =>
    sortCitiesByPopulation(citiesForState(stateAbbr).map(mapStaticCity)).slice(0, maxCount),
  );

  useEffect(() => {
    const staticCities = citiesForState(stateAbbr);
    if (staticCities.length >= 4) {
      setLocations(
        sortCitiesByPopulation(staticCities.map(mapStaticCity)).slice(0, maxCount),
      );
      return;
    }

    let cancelled = false;
    (async () => {
      const catalogFill = getCitiesForStateSlug(stateSlug);
      if (catalogFill.length > 0 && staticCities.length === 0) {
        if (!cancelled) {
          setLocations(
            sortCitiesByPopulation(catalogFill.map(mapCatalogFillCity)).slice(0, maxCount),
          );
        }
        return;
      }

      const catalog = await getCitiesForState(stateCode);
      if (cancelled) return;

      const seen = new Set(staticCities.map((c) => c.slug));
      const merged = sortCitiesByPopulation([
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
