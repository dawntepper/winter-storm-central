/**
 * City catalog — built at build time from src/content/cities/*.json via Vite's
 * import.meta.glob. Exports lookup helpers used by the forecast page picker.
 *
 * Catalog coverage is sparse (~30 cities total, not per state) — most users
 * outside major metros will need to fall back to ZIP entry. The dropdown is
 * useful for the cities we do have; the ZIP path is universal.
 */

const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });

// Strip the index.json (it's a summary, not a city entry) and surface only
// per-city files that have full data (lat, lon, etc.).
const ALL_CITIES = Object.entries(cityModules)
  .filter(([path]) => !path.endsWith('/index.json'))
  .map(([, mod]) => mod.default || mod)
  .filter((c) => c && c.slug && typeof c.lat === 'number' && typeof c.lon === 'number');

const BY_SLUG = new Map(ALL_CITIES.map((c) => [c.slug, c]));
const BY_STATE_SLUG = ALL_CITIES.reduce((acc, c) => {
  if (!c.state_slug) return acc;
  if (!acc[c.state_slug]) acc[c.state_slug] = [];
  acc[c.state_slug].push(c);
  return acc;
}, {});

// Sort each state's city list alphabetically by display name for stable dropdowns.
for (const list of Object.values(BY_STATE_SLUG)) {
  list.sort((a, b) => a.city.localeCompare(b.city));
}

export function getCityBySlug(slug) {
  return BY_SLUG.get(slug) || null;
}

export function getCitiesForStateSlug(stateSlug) {
  return BY_STATE_SLUG[stateSlug] || [];
}

export function getAllCities() {
  return ALL_CITIES;
}
