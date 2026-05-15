import citiesIndex from '../content/cities/index.json';

// Build a name → slug lookup once. User-location names are formatted as
// "City, ST" (see ZipCodeSearch); we match case-insensitively.
const CITY_SLUG_BY_NAME = {};
for (const c of citiesIndex.cities || []) {
  if (!c?.city || !c?.state_abbr || !c?.slug) continue;
  CITY_SLUG_BY_NAME[`${c.city}, ${c.state_abbr}`.toLowerCase()] = c.slug;
}

export function getCitySlugForLocation(name) {
  if (!name || typeof name !== 'string') return null;
  return CITY_SLUG_BY_NAME[name.toLowerCase()] || null;
}
