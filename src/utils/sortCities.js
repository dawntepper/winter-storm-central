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
