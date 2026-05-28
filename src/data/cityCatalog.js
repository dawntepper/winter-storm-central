/**
 * City catalog — built at build time from src/content/cities/*.json via Vite's
 * import.meta.glob. Exports lookup helpers used by the forecast page picker.
 *
 * Two sources merged into one catalog:
 *
 *   1. Rich per-city files in src/content/cities/*.json — used by both the
 *      forecast picker AND CityAlertsPage (which needs the full data:
 *      description, NWS zone, county FIPS, etc.).
 *
 *   2. FORECAST_PICKER_FILL below — minimal supplementary entries (just
 *      slug, city, state_*, lat, lon) for states the rich catalog hasn't
 *      reached yet. The forecast page only needs lat/lon to call NWS, so
 *      these work fine for picker + forecast. They will NOT have working
 *      /alerts/[city-slug] pages until promoted to rich files; the picker
 *      links to /forecast/[state-slug]?city=... which doesn't depend on
 *      CityAlertsPage's CITY_DATA.
 *
 * Goal: every US state + DC has at least one city in the forecast picker so
 * the dropdown is never empty. ZIP entry remains the universal fallback.
 */

const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });

// Strip the index.json (it's a summary, not a city entry) and surface only
// per-city files that have full data (lat, lon, etc.).
const RICH_CITIES = Object.entries(cityModules)
  .filter(([path]) => !path.endsWith('/index.json'))
  .map(([, mod]) => mod.default || mod)
  .filter((c) => c && c.slug && typeof c.lat === 'number' && typeof c.lon === 'number');

// Supplementary picker-only entries — one major city per state/territory not
// already covered by the rich catalog. When a state gets a rich per-city
// file later, the duplicate slug here can be removed (rich files take
// precedence in the merge below).
const FORECAST_PICKER_FILL = [
  // States
  { slug: 'anchorage-ak',       city: 'Anchorage',       state: 'Alaska',         state_abbr: 'AK', state_slug: 'alaska',          lat: 61.2181, lon: -149.9003 },
  { slug: 'phoenix-az',         city: 'Phoenix',         state: 'Arizona',        state_abbr: 'AZ', state_slug: 'arizona',         lat: 33.4484, lon: -112.0740 },
  { slug: 'los-angeles-ca',     city: 'Los Angeles',     state: 'California',     state_abbr: 'CA', state_slug: 'california',      lat: 34.0522, lon: -118.2437 },
  { slug: 'san-francisco-ca',   city: 'San Francisco',   state: 'California',     state_abbr: 'CA', state_slug: 'california',      lat: 37.7749, lon: -122.4194 },
  { slug: 'denver-co',          city: 'Denver',          state: 'Colorado',       state_abbr: 'CO', state_slug: 'colorado',        lat: 39.7392, lon: -104.9903 },
  { slug: 'wilmington-de',      city: 'Wilmington',      state: 'Delaware',       state_abbr: 'DE', state_slug: 'delaware',        lat: 39.7391, lon:  -75.5398 },
  { slug: 'honolulu-hi',        city: 'Honolulu',        state: 'Hawaii',         state_abbr: 'HI', state_slug: 'hawaii',          lat: 21.3069, lon: -157.8583 },
  { slug: 'boise-id',           city: 'Boise',           state: 'Idaho',          state_abbr: 'ID', state_slug: 'idaho',           lat: 43.6150, lon: -116.2023 },
  { slug: 'louisville-ky',      city: 'Louisville',      state: 'Kentucky',       state_abbr: 'KY', state_slug: 'kentucky',        lat: 38.2527, lon:  -85.7585 },
  { slug: 'baltimore-md',       city: 'Baltimore',       state: 'Maryland',       state_abbr: 'MD', state_slug: 'maryland',        lat: 39.2904, lon:  -76.6122 },
  { slug: 'jackson-ms',         city: 'Jackson',         state: 'Mississippi',    state_abbr: 'MS', state_slug: 'mississippi',     lat: 32.2988, lon:  -90.1848 },
  { slug: 'billings-mt',        city: 'Billings',        state: 'Montana',        state_abbr: 'MT', state_slug: 'montana',         lat: 45.7833, lon: -108.5007 },
  { slug: 'las-vegas-nv',       city: 'Las Vegas',       state: 'Nevada',         state_abbr: 'NV', state_slug: 'nevada',          lat: 36.1699, lon: -115.1398 },
  { slug: 'manchester-nh',      city: 'Manchester',      state: 'New Hampshire',  state_abbr: 'NH', state_slug: 'new-hampshire',   lat: 42.9956, lon:  -71.4548 },
  { slug: 'newark-nj',          city: 'Newark',          state: 'New Jersey',     state_abbr: 'NJ', state_slug: 'new-jersey',      lat: 40.7357, lon:  -74.1724 },
  { slug: 'albuquerque-nm',     city: 'Albuquerque',     state: 'New Mexico',     state_abbr: 'NM', state_slug: 'new-mexico',      lat: 35.0844, lon: -106.6504 },
  { slug: 'fargo-nd',           city: 'Fargo',           state: 'North Dakota',   state_abbr: 'ND', state_slug: 'north-dakota',    lat: 46.8772, lon:  -96.7898 },
  { slug: 'portland-or',        city: 'Portland',        state: 'Oregon',         state_abbr: 'OR', state_slug: 'oregon',          lat: 45.5152, lon: -122.6784 },
  { slug: 'sioux-falls-sd',     city: 'Sioux Falls',     state: 'South Dakota',   state_abbr: 'SD', state_slug: 'south-dakota',    lat: 43.5446, lon:  -96.7311 },
  { slug: 'salt-lake-city-ut',  city: 'Salt Lake City',  state: 'Utah',           state_abbr: 'UT', state_slug: 'utah',            lat: 40.7608, lon: -111.8910 },
  { slug: 'seattle-wa',         city: 'Seattle',         state: 'Washington',     state_abbr: 'WA', state_slug: 'washington',      lat: 47.6062, lon: -122.3321 },
  { slug: 'charleston-wv',      city: 'Charleston',      state: 'West Virginia',  state_abbr: 'WV', state_slug: 'west-virginia',   lat: 38.3498, lon:  -81.6326 },
  { slug: 'cheyenne-wy',        city: 'Cheyenne',        state: 'Wyoming',        state_abbr: 'WY', state_slug: 'wyoming',         lat: 41.1400, lon: -104.8202 },
  // DC + territories with NWS coverage
  { slug: 'washington-dc',      city: 'Washington',      state: 'Washington DC',  state_abbr: 'DC', state_slug: 'district-of-columbia', lat: 38.9072, lon: -77.0369 },
  { slug: 'san-juan-pr',        city: 'San Juan',        state: 'Puerto Rico',    state_abbr: 'PR', state_slug: 'puerto-rico',     lat: 18.4655, lon:  -66.1057 },
  { slug: 'charlotte-amalie-vi', city: 'Charlotte Amalie', state: 'US Virgin Islands', state_abbr: 'VI', state_slug: 'us-virgin-islands', lat: 18.3419, lon: -64.9307 },
  { slug: 'hagatna-gu',         city: 'Hagåtña',         state: 'Guam',           state_abbr: 'GU', state_slug: 'guam',            lat: 13.4745, lon:  144.7504 },
  // Note: American Samoa is outside NWS jurisdiction — Pago Pago forecasts
  // return no data from api.weather.gov. Omitted from the picker so users
  // don't hit a confusing "forecast unavailable" message; ZIP entry isn't
  // an option for AS either (no US ZIP codes). The state slug 'american-samoa'
  // will show ZIP-only with a helpful empty-state message.
];

// Rich files take precedence — only add a fill entry if no rich entry
// already covers the same slug.
const richSlugs = new Set(RICH_CITIES.map((c) => c.slug));
const ALL_CITIES = [
  ...RICH_CITIES,
  ...FORECAST_PICKER_FILL.filter((c) => !richSlugs.has(c.slug)),
];

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
