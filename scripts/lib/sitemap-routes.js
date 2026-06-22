/**
 * Shared prerender route list and sitemap XML builders.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
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
  'district-of-columbia', 'puerto-rico', 'us-virgin-islands', 'guam', 'american-samoa',
];

const CORE_ROUTES = ['/', '/radar', '/alerts', '/prep', '/add-to-home', '/privacy', '/terms'];

function loadCities() {
  if (!fs.existsSync(CITIES_DIR)) return [];
  return fs
    .readdirSync(CITIES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(CITIES_DIR, f), 'utf-8')))
    .filter((c) => c && c.slug);
}

function collectPrerenderRoutes(storms, cities = loadCities()) {
  const routes = [...CORE_ROUTES];

  for (const slug of STATE_SLUGS) {
    routes.push(`/alerts/${slug}`);
    routes.push(`/forecast/${slug}`);
  }

  for (const city of cities) {
    routes.push(`/alerts/${city.slug}`);
  }

  for (const storm of storms) {
    if (storm?.slug) routes.push(`/storm/${storm.slug}`);
  }

  return [...new Set(routes)].sort((a, b) => a.localeCompare(b));
}

function urlEntry(loc, { lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function stormLastmod(storm, lastmodBySlug, fallback) {
  if (lastmodBySlug?.get(storm.slug)) {
    return new Date(lastmodBySlug.get(storm.slug)).toISOString();
  }
  return fallback;
}

function buildSitemap(storms, cities, { lastmodBySlug } = {}) {
  const now = new Date().toISOString();

  const stateUrls = STATE_SLUGS.map((slug) =>
    urlEntry(`${BASE_URL}/alerts/${slug}`, {
      lastmod: now,
      changefreq: 'hourly',
      priority: '0.7',
    })
  ).join('\n');

  const forecastUrls = STATE_SLUGS.map((slug) =>
    urlEntry(`${BASE_URL}/forecast/${slug}`, {
      lastmod: now,
      changefreq: 'hourly',
      priority: '0.7',
    })
  ).join('\n');

  const cityUrls = cities
    .map((city) =>
      urlEntry(`${BASE_URL}/alerts/${city.slug}`, {
        lastmod: now,
        changefreq: 'hourly',
        priority: '0.7',
      })
    )
    .join('\n');

  const stormUrls = storms
    .filter((s) => s?.slug)
    .map((storm) => {
      const changefreq =
        storm.status === 'active'
          ? 'hourly'
          : storm.status === 'forecasted'
            ? 'daily'
            : 'monthly';
      const priority =
        storm.status === 'active'
          ? '0.9'
          : storm.status === 'forecasted'
            ? '0.8'
            : '0.6';
      return urlEntry(`${BASE_URL}/storm/${storm.slug}`, {
        lastmod: stormLastmod(storm, lastmodBySlug, now),
        changefreq,
        priority,
      });
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(BASE_URL, { lastmod: now, changefreq: 'daily', priority: '1.0' })}
${urlEntry(`${BASE_URL}/radar`, { lastmod: now, changefreq: 'daily', priority: '0.9' })}
${urlEntry(`${BASE_URL}/alerts`, { lastmod: now, changefreq: 'hourly', priority: '0.8' })}
${urlEntry(`${BASE_URL}/prep`, { lastmod: now, changefreq: 'weekly', priority: '0.9' })}
${urlEntry(`${BASE_URL}/add-to-home`, { lastmod: now, changefreq: 'monthly', priority: '0.5' })}
${urlEntry(`${BASE_URL}/privacy`, { lastmod: now, changefreq: 'yearly', priority: '0.3' })}
${urlEntry(`${BASE_URL}/terms`, { lastmod: now, changefreq: 'yearly', priority: '0.3' })}
${stateUrls}
${forecastUrls}
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

module.exports = {
  ROOT,
  BASE_URL,
  STATE_SLUGS,
  CORE_ROUTES,
  loadCities,
  collectPrerenderRoutes,
  buildSitemap,
  buildRobotsTxt,
};
