#!/usr/bin/env node

// Generate dist/sitemap.xml and dist/robots.txt at build time.
// Includes: /, /radar, /alerts, /alerts/[state] for every state slug,
// and /storm/[slug] for every JSON file in src/content/storms/.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const STORMS_DIR = path.join(ROOT, 'src', 'content', 'storms');
const CITIES_DIR = path.join(ROOT, 'src', 'content', 'cities');
const BASE_URL = 'https://stormtracking.io';

const STATE_SLUGS = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california',
  'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
  'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new-hampshire', 'new-jersey',
  'new-mexico', 'new-york', 'north-carolina', 'north-dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode-island', 'south-carolina',
  'south-dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west-virginia', 'wisconsin', 'wyoming',
  'district-of-columbia', 'puerto-rico', 'us-virgin-islands', 'guam', 'american-samoa'
];

function loadStorms() {
  if (!fs.existsSync(STORMS_DIR)) return [];
  return fs.readdirSync(STORMS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(STORMS_DIR, f), 'utf-8')))
    .filter(s => s && s.slug);
}

function loadCities() {
  if (!fs.existsSync(CITIES_DIR)) return [];
  return fs.readdirSync(CITIES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .map(f => JSON.parse(fs.readFileSync(path.join(CITIES_DIR, f), 'utf-8')))
    .filter(c => c && c.slug);
}

function urlEntry(loc, { lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildSitemap(storms, cities) {
  const now = new Date().toISOString();

  const stateUrls = STATE_SLUGS.map(slug =>
    urlEntry(`${BASE_URL}/alerts/${slug}`, {
      lastmod: now,
      changefreq: 'hourly',
      priority: '0.7'
    })
  ).join('\n');

  const cityUrls = cities.map(city =>
    urlEntry(`${BASE_URL}/alerts/${city.slug}`, {
      lastmod: now,
      changefreq: 'hourly',
      priority: '0.7'
    })
  ).join('\n');

  const stormUrls = storms.map(storm => {
    const changefreq = storm.status === 'active' ? 'hourly'
      : storm.status === 'forecasted' ? 'daily'
      : 'monthly';
    const priority = storm.status === 'active' ? '0.9'
      : storm.status === 'forecasted' ? '0.8'
      : '0.6';
    return urlEntry(`${BASE_URL}/storm/${storm.slug}`, {
      lastmod: now,
      changefreq,
      priority
    });
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(BASE_URL, { lastmod: now, changefreq: 'daily', priority: '1.0' })}
${urlEntry(`${BASE_URL}/radar`, { lastmod: now, changefreq: 'daily', priority: '0.9' })}
${urlEntry(`${BASE_URL}/alerts`, { lastmod: now, changefreq: 'hourly', priority: '0.8' })}
${stateUrls}
${cityUrls}
${stormUrls}
</urlset>
`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run vite build first.');
    process.exit(1);
  }

  const storms = loadStorms();
  const cities = loadCities();

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), buildSitemap(storms, cities), 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), buildRobotsTxt(), 'utf-8');

  console.log(`Generated dist/sitemap.xml (${STATE_SLUGS.length} states + ${cities.length} cities + ${storms.length} storms)`);
  console.log('Generated dist/robots.txt');
}

main();
