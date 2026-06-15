import { useEffect, useState } from 'react';
import { citiesForState } from '../components/CitiesInState';
import { getCitiesForState, cityAlertsPath } from '../services/locationCatalogService';
import { buildPopularStateLocations } from '../utils/popularStateCities';
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

function buildLocations(staticCities, catalogCities, maxCount) {
  return buildPopularStateLocations({
    staticCities,
    catalogCities,
    richCitySlugs: RICH_CITY_SLUGS,
    populationFromRichJson: POPULATION_BY_SLUG,
    cityAlertsPath,
    maxCount,
  });
}

/**
 * Merged static + catalog city shortcuts for a state page.
 * Sorted by population (largest first); city_demand is admin-only so not used here.
 */
export function useStateCityLocations(stateAbbr, stateCode, stateSlug, maxCount = 8) {
  const staticCities = citiesForState(stateAbbr);
  const [locations, setLocations] = useState(() =>
    buildLocations(staticCities, [], maxCount),
  );

  useEffect(() => {
    const staticList = citiesForState(stateAbbr);
    setLocations(buildLocations(staticList, [], maxCount));

    let cancelled = false;
    (async () => {
      const catalog = await getCitiesForState(stateCode);
      if (cancelled) return;
      setLocations(buildLocations(staticList, catalog, maxCount));
    })();

    return () => {
      cancelled = true;
    };
  }, [stateAbbr, stateCode, stateSlug, maxCount]);

  return locations;
}
