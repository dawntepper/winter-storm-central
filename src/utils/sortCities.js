/**
 * Case-insensitive alphabetical sort for city list items.
 * Accepts either `.name` (Supabase catalog) or `.city` (static JSON).
 */
export function compareCityNames(a, b) {
  const nameA = (a?.name ?? a?.city ?? '').toString();
  const nameB = (b?.name ?? b?.city ?? '').toString();
  return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
}

export function sortCitiesByName(cities) {
  return [...cities].sort(compareCityNames);
}

/** Descending by population; ties fall back to name order. */
export function compareCitiesByPopulation(a, b) {
  const popA = Number(a?.population) || 0;
  const popB = Number(b?.population) || 0;
  if (popB !== popA) return popB - popA;
  return compareCityNames(a, b);
}

export function sortCitiesByPopulation(cities) {
  return [...cities].sort(compareCitiesByPopulation);
}
