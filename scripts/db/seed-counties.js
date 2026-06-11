#!/usr/bin/env node
/**
 * Seed public.counties from us-atlas county TopoJSON.
 * Upsert conflict key: slug
 */
const { getSupabaseAdmin } = require('./supabase-admin');
const { loadCountiesFromAtlas } = require('./lib/load-sources');
const { batchUpsert } = require('./lib/batch-upsert');
const { printTableCounts } = require('./lib/print-counts');

async function seedCounties() {
  const supabase = getSupabaseAdmin();
  const rows = loadCountiesFromAtlas();
  console.log(`Upserting ${rows.length} counties…`);
  const { count } = await batchUpsert(supabase, 'counties', rows, { onConflict: 'slug' });
  console.log(`Done — ${count} county rows upserted.`);
  await printTableCounts(supabase, ['counties']);
}

seedCounties().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
