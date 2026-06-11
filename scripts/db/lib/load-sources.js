/**
 * Load location seed data from existing repo sources.
 *
 * Counties:  us-atlas/counties-10m.json (3,231 US counties + equivalents)
 * Cities:     src/content/cities/*.json (rich alert pages)
 *             + FORECAST_PICKER_FILL from src/data/cityCatalog.js
 *             + STATES_AND_CITIES from src/components/ZipCodeSearch.jsx
 *             + scripts/db/data/us-places-top50.json (top 50 by population / state)
 * City↔county: county_fips on rich JSON + population dataset + FCC cache fallback
 * ZIP hints:  primary_zip in population dataset, zip-cache.json, zippopotam.us
 */
const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');
const usCounties = require('us-atlas/counties-10m.json');
const { countySlug, citySlug } = require('./slug');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CITIES_DIR = path.join(ROOT, 'src', 'content', 'cities');
const STATE_CONFIG_PATH = path.join(ROOT, 'src', 'data', 'stateConfig.js');
const CITY_CATALOG_PATH = path.join(ROOT, 'src', 'data', 'cityCatalog.js');
const ZIP_SEARCH_PATH = path.join(ROOT, 'src', 'components', 'ZipCodeSearch.jsx');
const PLACES_PATH = path.join(__dirname, '..', 'data', 'us-places-top50.json');
const COUNTY_CACHE_PATH = path.join(__dirname, '..', 'data', 'city-county-fips-cache.json');

/** How many top-population cities per state get is_major=true (beyond explicit lists). */
const MAJOR_TOP_N = 10;

/** Census state FIPS → 2-letter abbreviation (50 states + DC + territories in us-atlas). */
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};

function loadStateNames() {
  const text = fs.readFileSync(STATE_CONFIG_PATH, 'utf8');
  const names = {};
  for (const m of text.matchAll(/'([a-z-]+)':\s*\{\s*name:\s*'([^']+)',\s*abbr:\s*'([A-Z]{2})'/g)) {
    names[m[3]] = m[2];
  }
  names.DC = 'Washington D.C.';
  names.PR = 'Puerto Rico';
  names.VI = 'US Virgin Islands';
  names.GU = 'Guam';
  names.AS = 'American Samoa';
  names.MP = 'Northern Mariana Islands';
  return names;
}

function bboxCentroid(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2 };
}

function loadCountiesFromAtlas() {
  const stateNames = loadStateNames();
  const collection = feature(usCounties, usCounties.objects.counties);
  const rows = [];

  for (const f of collection.features) {
    const fips = String(f.id).padStart(5, '0');
    const stateFips = fips.slice(0, 2);
    const stateCode = FIPS_TO_STATE[stateFips];
    if (!stateCode) continue;

    const name = f.properties?.name;
    if (!name) continue;

    const { lat, lon } = bboxCentroid(f.geometry);
    rows.push({
      slug: countySlug(name, stateCode),
      name,
      state_code: stateCode,
      state_name: stateNames[stateCode] || null,
      fips_code: fips,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
    });
  }

  return rows;
}

function loadRichCities() {
  if (!fs.existsSync(CITIES_DIR)) return [];
  return fs
    .readdirSync(CITIES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(CITIES_DIR, f), 'utf8')))
    .filter((c) => c?.slug && c?.city && c?.state_abbr && typeof c.lat === 'number' && typeof c.lon === 'number');
}

function loadForecastPickerFill() {
  const text = fs.readFileSync(CITY_CATALOG_PATH, 'utf8');
  const match = text.match(/const FORECAST_PICKER_FILL = (\[[\s\S]*?\n\];)/);
  if (!match) return [];
  const fill = new Function(`return ${match[1].replace(/;$/, '')}`)();
  return fill.filter(
    (c) => c?.slug && c?.city && c?.state_abbr && typeof c.lat === 'number' && typeof c.lon === 'number',
  );
}

/** Major cities per state (3–4 each) — same list as the ZIP search quick-pick UI. */
function loadStatesAndCitiesFill() {
  if (!fs.existsSync(ZIP_SEARCH_PATH)) return [];
  const text = fs.readFileSync(ZIP_SEARCH_PATH, 'utf8');
  const match = text.match(/const STATES_AND_CITIES = (\{[\s\S]*?\n\};)/);
  if (!match) return [];
  const data = new Function(`return ${match[1].replace(/;$/, '')}`)();
  const rows = [];
  for (const [stateCode, st] of Object.entries(data)) {
    if (!st?.cities?.length) continue;
    for (const c of st.cities) {
      if (!c?.name || typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
      rows.push({
        slug: citySlug(c.name, stateCode),
        city: c.name,
        state: st.name,
        state_abbr: stateCode,
        lat: c.lat,
        lon: c.lon,
      });
    }
  }
  return rows;
}

function loadPopulationPlaces() {
  if (!fs.existsSync(PLACES_PATH)) return [];
  const { places } = JSON.parse(fs.readFileSync(PLACES_PATH, 'utf8'));
  return (places || []).filter(
    (c) => c?.slug && c?.city && c?.state_abbr && typeof c.lat === 'number' && typeof c.lon === 'number',
  );
}

function computeMajorSlugs(populationPlaces) {
  const major = new Set();
  for (const c of loadRichCities()) major.add(c.slug);
  for (const c of loadForecastPickerFill()) major.add(c.slug);
  for (const c of loadStatesAndCitiesFill()) major.add(c.slug);

  const byState = new Map();
  for (const c of populationPlaces) {
    if (!byState.has(c.state_abbr)) byState.set(c.state_abbr, []);
    byState.get(c.state_abbr).push(c);
  }
  for (const list of byState.values()) {
    list.sort((a, b) => (b.population || 0) - (a.population || 0));
    for (const c of list.slice(0, MAJOR_TOP_N)) major.add(c.slug);
  }
  return major;
}

function loadAllCities() {
  const stateNames = loadStateNames();
  const rich = loadRichCities();
  const fill = loadForecastPickerFill();
  const catalog = loadStatesAndCitiesFill();
  const population = loadPopulationPlaces();
  const majorSlugs = computeMajorSlugs([...rich, ...fill, ...catalog, ...population]);

  const toRow = (c, source, flags = {}) => ({
    slug: c.slug,
    name: c.city,
    state_code: c.state_abbr,
    state_name: c.state || stateNames[c.state_abbr] || null,
    lat: Number(c.lat),
    lon: Number(c.lon),
    population: typeof c.population === 'number' ? c.population : null,
    county: c.county || null,
    county_fips: c.county_fips ? String(c.county_fips).padStart(5, '0') : null,
    primary_zip: c.primary_zip || null,
    has_static_page: flags.has_static_page || false,
    is_major: flags.is_major ?? majorSlugs.has(c.slug),
    source,
  });

  const mergeInto = (bySlug, c, source, flags) => {
    const existing = bySlug.get(c.slug);
    const row = toRow(c, source, flags);
    if (existing) {
      row.population = row.population ?? existing.population;
      row.county = row.county || existing.county;
      row.county_fips = row.county_fips || existing.county_fips;
      row.primary_zip = row.primary_zip || existing.primary_zip;
      row.has_static_page = row.has_static_page || existing.has_static_page;
      row.is_major = row.is_major || existing.is_major;
    }
    bySlug.set(c.slug, row);
  };

  const bySlug = new Map();
  for (const c of population) mergeInto(bySlug, c, 'population');
  for (const c of catalog) mergeInto(bySlug, c, 'catalog', { is_major: true });
  for (const c of fill) mergeInto(bySlug, c, 'fill', { is_major: true });
  for (const c of rich) mergeInto(bySlug, c, 'rich', { has_static_page: true, is_major: true });

  return [...bySlug.values()];
}

function countyNameFromFips(fips) {
  const padded = String(fips).padStart(5, '0');
  const collection = feature(usCounties, usCounties.objects.counties);
  const found = collection.features.find((f) => String(f.id).padStart(5, '0') === padded);
  return found?.properties?.name || null;
}

function loadCountyCache() {
  if (!fs.existsSync(COUNTY_CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(COUNTY_CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCountyCache(cache) {
  fs.mkdirSync(path.dirname(COUNTY_CACHE_PATH), { recursive: true });
  fs.writeFileSync(COUNTY_CACHE_PATH, JSON.stringify(cache, null, 2));
}

function resolveCountyForCity(city, cache) {
  if (city.county_fips) {
    const county = city.county || countyNameFromFips(city.county_fips);
    if (county) {
      return {
        county_fips: String(city.county_fips).padStart(5, '0'),
        county,
      };
    }
  }
  const cached = cache[city.slug];
  if (cached?.county_fips) {
    return {
      county_fips: String(cached.county_fips).padStart(5, '0'),
      county: cached.county || countyNameFromFips(cached.county_fips),
    };
  }
  return null;
}

function loadCityCountyLinks(cities) {
  const cache = loadCountyCache();
  const links = [];
  for (const city of cities) {
    const resolved = resolveCountyForCity(city, cache);
    if (!resolved?.county_fips || !resolved.county) continue;
    links.push({
      city_slug: city.slug,
      county_slug: countySlug(resolved.county, city.state_code),
      county_fips: resolved.county_fips,
      is_primary: true,
    });
  }
  return links;
}

/** FIPS code → county slug (for resolving city_counties after county seed). */
function fipsToCountySlug(fips) {
  const padded = String(fips).padStart(5, '0');
  const stateCode = FIPS_TO_STATE[padded.slice(0, 2)];
  if (!stateCode) return null;

  const collection = feature(usCounties, usCounties.objects.counties);
  const found = collection.features.find((f) => String(f.id).padStart(5, '0') === padded);
  if (!found?.properties?.name) return null;
  return countySlug(found.properties.name, stateCode);
}

module.exports = {
  ROOT,
  FIPS_TO_STATE,
  COUNTY_CACHE_PATH,
  loadStateNames,
  loadCountiesFromAtlas,
  loadRichCities,
  loadForecastPickerFill,
  loadStatesAndCitiesFill,
  loadPopulationPlaces,
  loadAllCities,
  loadCityCountyLinks,
  loadCountyCache,
  saveCountyCache,
  resolveCountyForCity,
  countyNameFromFips,
  fipsToCountySlug,
};
