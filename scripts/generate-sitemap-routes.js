#!/usr/bin/env node

// Build-time prerender route manifest + early sitemap with DB-backed storm lastmod.
// Runs after vite build so dist/ exists; prerender generators run afterward.
// Final sitemap is rewritten by generate-sitemap.js at end of build.

const fs = require('fs');
const path = require('path');

const { loadStormsWithMeta } = require('./lib/load-storms');
const {
  ROOT,
  loadCities,
  collectPrerenderRoutes,
  buildSitemap,
} = require('./lib/sitemap-routes');

const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function writeSitemap(filePath, xml) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, xml, 'utf-8');
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run vite build first.');
    process.exit(1);
  }

  const cities = loadCities();
  const { storms, lastmodBySlug } = await loadStormsWithMeta();
  const routes = collectPrerenderRoutes(storms, cities);
  const sitemap = buildSitemap(storms, cities, { lastmodBySlug });

  writeJson(path.join(PUBLIC_DIR, 'prerender-routes.json'), routes);
  writeJson(path.join(DIST_DIR, 'prerender-routes.json'), routes);
  writeSitemap(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);

  const liveCount = storms.filter((s) => s._source === 'db').length;
  console.log(
    `Wrote public/prerender-routes.json (${routes.length} routes, ${storms.length} storms, ${liveCount} live from Supabase)`
  );
  console.log(`Wrote public/sitemap.xml (early; finalized by generate-sitemap.js)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
