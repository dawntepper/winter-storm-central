import citiesIndex from '../content/cities/index.json';

// Build a name → slug lookup once. User-location names are formatted as
// "City, ST" (see ZipCodeSearch); we match case-insensitively.
const CITY_SLUG_BY_NAME = {};
const CITIES_BY_STATE_ABBR = {};
for (const c of citiesIndex.cities || []) {
  if (!c?.city || !c?.state_abbr || !c?.slug) continue;
  CITY_SLUG_BY_NAME[`${c.city}, ${c.state_abbr}`.toLowerCase()] = c.slug;
  if (!CITIES_BY_STATE_ABBR[c.state_abbr]) CITIES_BY_STATE_ABBR[c.state_abbr] = [];
  CITIES_BY_STATE_ABBR[c.state_abbr].push(c);
}
// Sort within each state by city name length descending so longer names
// match first (e.g. "Fort Worth" before "Fort Myers" when scanning text).
for (const abbr of Object.keys(CITIES_BY_STATE_ABBR)) {
  CITIES_BY_STATE_ABBR[abbr].sort((a, b) => b.city.length - a.city.length);
}

export function getCitySlugForLocation(name) {
  if (!name || typeof name !== 'string') return null;
  return CITY_SLUG_BY_NAME[name.toLowerCase()] || null;
}

// Scan a free-text string for any supported city name within the given state.
// Used to surface a city-page link when an NWS alert's location string is
// county-formatted (e.g. "Miami-Dade, FL" or "Coastal Miami Dade County, FL").
// Returns the city slug of the longest match, or null.
export function findCitySlugInText(text, stateAbbr) {
  if (!text || !stateAbbr) return null;
  const candidates = CITIES_BY_STATE_ABBR[stateAbbr] || [];
  if (candidates.length === 0) return null;
  const haystack = text.toLowerCase();
  for (const c of candidates) {
    if (haystack.includes(c.city.toLowerCase())) return c.slug;
  }
  return null;
}
