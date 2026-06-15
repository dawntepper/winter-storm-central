import { sortCitiesByPopulation } from './sortCities';
import populationBySlug from '../data/cityPopulationBySlug.json';

/**
 * Normalize catalog place names for UI (e.g. Census "balance" suffixes).
 */
export function formatCityDisplayName(name) {
  if (!name) return '';
  let cleaned = String(name).trim();
  cleaned = cleaned.replace(/^city of\s+/i, '');
  cleaned = cleaned.replace(/\s*\((balance|remainder)\)\s*$/i, '');
  return cleaned.trim() || String(name).trim();
}

export function resolveCityPopulation(slug, ...candidates) {
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fallback = Number(populationBySlug[slug]);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

/**
 * Merge static rich cities + Supabase catalog into deduped popular shortcuts.
 * Sorted by population (largest first) with static/rich entries preferred on ties.
 */
export function buildPopularStateLocations({
  staticCities = [],
  catalogCities = [],
  richCitySlugs,
  populationFromRichJson = {},
  cityAlertsPath,
  maxCount = 8,
}) {
  const bySlug = new Map();

  const upsert = (slug, next) => {
    if (!slug || !next) return;
    const prev = bySlug.get(slug);
    const population = resolveCityPopulation(
      slug,
      next.population,
      prev?.population,
      populationFromRichJson[slug],
    );
    const isRich = Boolean(next.isRich || prev?.isRich);
    const usePrevRich = prev?.isRich && !next.isRich;

    bySlug.set(slug, {
      slug,
      name: formatCityDisplayName(usePrevRich ? prev.name : (next.name || prev?.name)),
      population,
      path: usePrevRich ? prev.path : (next.path || prev?.path),
      isRich,
    });
  };

  for (const city of staticCities) {
    upsert(city.slug, {
      name: city.city,
      population: populationFromRichJson[city.slug],
      path: `/alerts/${city.slug}`,
      isRich: true,
    });
  }

  for (const city of catalogCities) {
    if (!city?.slug) continue;
    const hasRich = city.hasStaticPage || richCitySlugs.has(city.slug);
    upsert(city.slug, {
      name: city.name || city.city,
      population: city.population,
      path: cityAlertsPath(city.slug, hasRich),
      isRich: hasRich,
    });
  }

  return sortCitiesByPopulation([...bySlug.values()]).slice(0, maxCount);
}
