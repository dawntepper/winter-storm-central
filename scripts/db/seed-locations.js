#!/usr/bin/env node
/**
 * Seed all location catalog tables in dependency order.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'seed-counties.js',
  'seed-cities.js',
  'seed-city-counties.js',
  'seed-zips.js',
];

for (const script of scripts) {
  console.log(`\n=== ${script} ===\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const { getSupabaseAdmin } = require('./supabase-admin');
const { printTableCounts, printStateBreakdown } = require('./lib/print-counts');

(async () => {
  console.log('\n=== Final counts ===');
  const supabase = getSupabaseAdmin();
  await printTableCounts(supabase);
  await printStateBreakdown(supabase);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
