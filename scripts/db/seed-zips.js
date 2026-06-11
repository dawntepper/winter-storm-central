#!/usr/bin/env node
/**
 * Seed public.zip_locations with one primary ZIP per catalog city.
 *
 * Uses api.zippopotam.us (same pattern as netlify/functions/lib/zip-to-location.js)
 * and caches responses under scripts/db/data/zip-cache.json for repeat runs.
 *
 * Upsert conflict key: (zip_code, state_code)
 *
 * Flags:
 *   --offline   Use cache only; skip network fetches
 *   --refresh   Ignore cache and re-fetch all cities
 */
const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin } = require('./supabase-admin');
const { loadAllCities, loadCountyCache, resolveCountyForCity } = require('./lib/load-sources');
const { batchUpsert } = require('./lib/batch-upsert');
const { printTableCounts } = require('./lib/print-counts');

const CACHE_PATH = path.join(__dirname, 'data', 'zip-cache.json');
const FETCH_DELAY_MS = 120;

/** Cities where zippopotam city search fails — downtown / capital ZIPs. */
const MANUAL_PRIMARY_ZIPS = {
  'st-louis-mo': { zip_code: '63101', lat: 38.627, lon: -90.1994 },
  'san-juan-pr': { zip_code: '00901', lat: 18.4655, lon: -66.1057 },
  'charlotte-amalie-vi': { zip_code: '00802', lat: 18.3419, lon: -64.9307 },
  'hagatna-gu': { zip_code: '96910', lat: 13.4745, lon: 144.7504 },
};

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const refresh = args.has('--refresh');

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function zippopotamCityPath(city, stateCode) {
  const state = String(stateCode).toLowerCase();
  const place = encodeURIComponent(String(city).toLowerCase());
  return `https://api.zippopotam.us/us/${state}/${place}`;
}

async function fetchPrimaryZip(city) {
  if (MANUAL_PRIMARY_ZIPS[city.slug]) return MANUAL_PRIMARY_ZIPS[city.slug];

  const url = zippopotamCityPath(city.name, city.state_code);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const places = data?.places || [];
  if (!places.length) return null;

  let best = null;
  let bestDist = Infinity;
  for (const p of places) {
    const zip = p['post code'];
    const lat = parseFloat(p.latitude);
    const lon = parseFloat(p.longitude);
    if (!zip || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const dist = haversineMiles(city.lat, city.lon, lat, lon);
    if (dist < bestDist) {
      bestDist = dist;
      best = { zip_code: zip, lat, lon };
    }
  }
  return best;
}

async function fetchIdMaps(supabase, cities) {
  const citySlugs = cities.map((c) => c.slug);
  const cityMap = new Map();
  const chunk = 200;
  for (let i = 0; i < citySlugs.length; i += chunk) {
    const { data, error } = await supabase
      .from('cities')
      .select('id, slug')
      .in('slug', citySlugs.slice(i, i + chunk));
    if (error) throw new Error(`cities lookup failed: ${error.message}`);
    for (const row of data || []) cityMap.set(row.slug, row.id);
  }
  return cityMap;
}

async function fetchCountyIdMap(supabase, fipsList) {
  const map = new Map();
  const chunk = 200;
  for (let i = 0; i < fipsList.length; i += chunk) {
    const slice = fipsList.slice(i, i + chunk);
    const { data, error } = await supabase.from('counties').select('id, fips_code').in('fips_code', slice);
    if (error) throw new Error(`county fips lookup failed: ${error.message}`);
    for (const row of data || []) map.set(row.fips_code, row.id);
  }
  return map;
}

function dedupeZipRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.zip_code}:${row.state_code}`;
    const existing = byKey.get(key);
    if (!existing || (row.population || 0) > (existing.population || 0)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].map(({ population, ...row }) => row);
}

async function seedZips() {
  const supabase = getSupabaseAdmin();
  const cities = loadAllCities();
  const countyFipsCache = loadCountyCache();
  const zipCache = refresh ? {} : loadCache();
  const cityIdMap = await fetchIdMaps(supabase, cities);

  const pending = [];
  const gaps = [];

  console.log(
    `Resolving primary ZIP for ${cities.length} cities` +
      (offline ? ' (offline/cache only)' : '') +
      '…',
  );

  for (const city of cities) {
    let zip = null;

    if (city.primary_zip) {
      zip = { zip_code: city.primary_zip, lat: city.lat, lon: city.lon };
    } else if (!refresh && zipCache[city.slug]) {
      zip = zipCache[city.slug];
    } else if (!offline) {
      zip = await fetchPrimaryZip(city);
      if (zip) zipCache[city.slug] = zip;
      await sleep(FETCH_DELAY_MS);
    }

    if (!zip) {
      gaps.push(city.slug);
      continue;
    }

    const resolved = resolveCountyForCity(city, countyFipsCache);
    pending.push({
      zip_code: zip.zip_code,
      state_code: city.state_code,
      lat: Number(zip.lat.toFixed(6)),
      lon: Number(zip.lon.toFixed(6)),
      city_id: cityIdMap.get(city.slug) || null,
      county_fips: resolved?.county_fips || null,
      population: city.population || 0,
    });
  }

  const fipsList = [...new Set(pending.map((r) => r.county_fips).filter(Boolean))];
  const countyIdMap = await fetchCountyIdMap(supabase, fipsList);

  const rows = dedupeZipRows(
    pending.map(({ county_fips, population, ...row }) => ({
      ...row,
      county_id: county_fips ? countyIdMap.get(county_fips) || null : null,
      population,
    })),
  );

  if (!offline) saveCache(zipCache);

  console.log(`Upserting ${rows.length} zip_locations (${pending.length} cities, deduped)…`);
  if (gaps.length) {
    console.warn(`ZIP gaps (${gaps.length} cities — no zippopotam match):`);
    for (const slug of gaps.slice(0, 15)) console.warn(`  - ${slug}`);
    if (gaps.length > 15) console.warn(`  … and ${gaps.length - 15} more`);
  }

  const { count } = await batchUpsert(supabase, 'zip_locations', rows, {
    onConflict: 'zip_code,state_code',
  });
  console.log(`Done — ${count} zip_locations rows upserted.`);
  await printTableCounts(supabase, ['zip_locations']);
}

seedZips().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
