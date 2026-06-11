#!/usr/bin/env node
/**
 * Seed public.city_counties from county + county_fips on rich city JSON files.
 * Upsert conflict key: (city_id, county_id)
 */
const { getSupabaseAdmin } = require('./supabase-admin');
const { loadAllCities, loadCityCountyLinks } = require('./lib/load-sources');
const { batchUpsert } = require('./lib/batch-upsert');
const { printTableCounts } = require('./lib/print-counts');

async function fetchIdMap(supabase, table, slugs) {
  const map = new Map();
  const chunk = 200;
  for (let i = 0; i < slugs.length; i += chunk) {
    const slice = slugs.slice(i, i + chunk);
    const { data, error } = await supabase.from(table).select('id, slug').in('slug', slice);
    if (error) throw new Error(`${table} lookup failed: ${error.message}`);
    for (const row of data || []) map.set(row.slug, row.id);
  }
  return map;
}

async function seedCityCounties() {
  const supabase = getSupabaseAdmin();
  const cities = loadAllCities();
  const links = loadCityCountyLinks(cities);

  const citySlugs = [...new Set(links.map((l) => l.city_slug))];
  const countyFips = [...new Set(links.map((l) => l.county_fips))];

  const cityIds = await fetchIdMap(supabase, 'cities', citySlugs);

  const countyIdByFips = new Map();
  const fipsChunk = 200;
  for (let i = 0; i < countyFips.length; i += fipsChunk) {
    const slice = countyFips.slice(i, i + fipsChunk);
    const { data, error } = await supabase.from('counties').select('id, fips_code').in('fips_code', slice);
    if (error) throw new Error(`counties fips lookup failed: ${error.message}`);
    for (const row of data || []) countyIdByFips.set(row.fips_code, row.id);
  }

  const rows = [];
  const missing = { cities: [], counties: [] };

  for (const link of links) {
    const cityId = cityIds.get(link.city_slug);
    const countyId = countyIdByFips.get(link.county_fips);
    if (!cityId) missing.cities.push(link.city_slug);
    if (!countyId) missing.counties.push(`fips ${link.county_fips} (${link.county_slug})`);
    if (!cityId || !countyId) continue;
    rows.push({ city_id: cityId, county_id: countyId, is_primary: link.is_primary });
  }

  if (missing.cities.length) {
    console.warn(`Warning: ${missing.cities.length} cities missing from DB (run db:seed:cities first)`);
  }
  if (missing.counties.length) {
    console.warn(`Warning: ${missing.counties.length} counties missing from DB:`);
    for (const c of missing.counties.slice(0, 10)) console.warn(`  - ${c}`);
    if (missing.counties.length > 10) console.warn(`  … and ${missing.counties.length - 10} more`);
  }

  console.log(`Upserting ${rows.length} city_counties links (${links.length} source links)…`);
  const { count } = await batchUpsert(supabase, 'city_counties', rows, {
    onConflict: 'city_id,county_id',
  });
  console.log(`Done — ${count} city_counties rows upserted.`);
  await printTableCounts(supabase, ['city_counties']);
}

seedCityCounties().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
