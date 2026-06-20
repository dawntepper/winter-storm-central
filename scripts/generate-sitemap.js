#!/usr/bin/env node

// Generate dist/sitemap.xml, public/sitemap.xml, and dist/robots.txt at build time.
// Uses merged JSON + live Supabase storms (status=live) with DB lastmod for storm URLs.

const fs = require('fs');
const path = require('path');

const { loadStormsWithMeta } = require('./lib/load-storms');
const {
  ROOT,
  STATE_SLUGS,
  loadCities,
  buildSitemap,
  buildRobotsTxt,
} = require('./lib/sitemap-routes');

const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run vite build first.');
    process.exit(1);
  }

  const cities = loadCities();
  const { storms, lastmodBySlug } = await loadStormsWithMeta();
  const sitemap = buildSitemap(storms, cities, { lastmodBySlug });
  const robots = buildRobotsTxt();

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap, 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots, 'utf-8');

  const liveCount = storms.filter((s) => s._source === 'db').length;
  console.log(
    `Generated dist/sitemap.xml + public/sitemap.xml (${STATE_SLUGS.length} states + ${cities.length} cities + ${storms.length} storms, ${liveCount} live from Supabase)`
  );
  console.log('Generated dist/robots.txt');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
