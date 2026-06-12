#!/usr/bin/env node
/**
 * Seed public.cities from rich city JSON + forecast picker fill.
 * Upsert conflict key: slug
 */
const { getSupabaseAdmin } = require('./supabase-admin');
const { loadAllCities } = require('./lib/load-sources');
const { batchUpsert } = require('./lib/batch-upsert');
const { printTableCounts } = require('./lib/print-counts');

async function seedCities() {
  const supabase = getSupabaseAdmin();
  const cities = loadAllCities();
  const rows = cities.map((c) => ({
    slug: c.slug,
    name: c.name,
    state_code: c.state_code,
    state_name: c.state_name,
    lat: c.lat,
    lon: c.lon,
    population: c.population,
    has_static_page: c.has_static_page,
    is_major: c.is_major,
    source: 'catalog',
  }));

  console.log(`Upserting ${rows.length} cities…`);
  const { count } = await batchUpsert(supabase, 'cities', rows, { onConflict: 'slug' });
  console.log(`Done — ${count} city rows upserted.`);
  await printTableCounts(supabase, ['cities']);
}

seedCities().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
