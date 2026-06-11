#!/usr/bin/env node
/**
 * Resolve county FIPS for catalog cities missing county data via FCC Census Block API.
 * Writes scripts/db/data/city-county-fips-cache.json for offline seed runs.
 *
 * Flags:
 *   --offline   Skip network; report gaps only
 */
const fs = require('fs');
const {
  loadAllCities,
  loadCountyCache,
  saveCountyCache,
  resolveCountyForCity,
  COUNTY_CACHE_PATH,
} = require('./lib/load-sources');

const FETCH_DELAY_MS = 150;
const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCountyFips(lat, lon) {
  const url = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&censusYear=2020&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const county = data?.results?.[0];
  if (!county?.county_fips) return null;
  return {
    county_fips: String(county.county_fips).padStart(5, '0'),
    county: county.county_name?.replace(/\s+(County|Parish|Borough)$/i, '').trim() || null,
  };
}

async function main() {
  const cities = loadAllCities();
  const cache = loadCountyCache();
  const missing = cities.filter((c) => !resolveCountyForCity(c, cache));

  console.log(`${cities.length} catalog cities — ${missing.length} need county resolution`);

  if (offline) {
    if (missing.length) {
      console.warn('Gaps (run without --offline to resolve via FCC):');
      for (const c of missing.slice(0, 20)) console.warn(`  - ${c.slug}`);
      if (missing.length > 20) console.warn(`  … and ${missing.length - 20} more`);
    }
    return;
  }

  let resolved = 0;
  for (const city of missing) {
    if (cache[city.slug]?.county_fips) continue;
    const hit = await fetchCountyFips(city.lat, city.lon);
    if (hit) {
      cache[city.slug] = hit;
      resolved++;
    }
    await sleep(FETCH_DELAY_MS);
  }

  saveCountyCache(cache);
  console.log(`Resolved ${resolved} new counties → ${COUNTY_CACHE_PATH}`);

  const stillMissing = cities.filter((c) => !resolveCountyForCity(c, cache));
  if (stillMissing.length) {
    console.warn(`${stillMissing.length} cities still without county FIPS`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
