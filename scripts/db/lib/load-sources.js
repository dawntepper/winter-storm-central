/**
 * Load location seed data from existing repo sources.
 *
 * Counties:  us-atlas/counties-10m.json (3,231 US counties + equivalents)
 * Cities:     src/content/cities/*.json (rich alert pages)
 *             + FORECAST_PICKER_FILL from src/data/cityCatalog.js
 * City↔county: county + county_fips on rich city JSON files
 * ZIP hints:  zippopotam.us at seed time (see seed-zips.js)
 */
const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');
const usCounties = require('us-atlas/counties-10m.json');
const { countySlug } = require('./slug');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CITIES_DIR = path.join(ROOT, 'src', 'content', 'cities');
const STATE_CONFIG_PATH = path.join(ROOT, 'src', 'data', 'stateConfig.js');
const CITY_CATALOG_PATH = path.join(ROOT, 'src', 'data', 'cityCatalog.js');

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

function loadAllCities() {
  const stateNames = loadStateNames();
  const rich = loadRichCities();
  const richSlugs = new Set(rich.map((c) => c.slug));
  const fill = loadForecastPickerFill().filter((c) => !richSlugs.has(c.slug));

  const toRow = (c) => ({
    slug: c.slug,
    name: c.city,
    state_code: c.state_abbr,
    state_name: c.state || stateNames[c.state_abbr] || null,
    lat: Number(c.lat),
    lon: Number(c.lon),
    population: typeof c.population === 'number' ? c.population : null,
    county: c.county || null,
    county_fips: c.county_fips || null,
    source: c.county_fips ? 'rich' : 'fill',
  });

  const bySlug = new Map();
  for (const c of [...rich.map(toRow), ...fill.map(toRow)]) {
    bySlug.set(c.slug, c);
  }
  return [...bySlug.values()];
}

function loadCityCountyLinks(cities) {
  const links = [];
  for (const city of cities) {
    if (!city.county_fips || !city.county) continue;
    links.push({
      city_slug: city.slug,
      county_slug: countySlug(city.county, city.state_code),
      county_fips: String(city.county_fips).padStart(5, '0'),
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
  loadStateNames,
  loadCountiesFromAtlas,
  loadRichCities,
  loadForecastPickerFill,
  loadAllCities,
  loadCityCountyLinks,
  fipsToCountySlug,
};
