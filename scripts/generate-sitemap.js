#!/usr/bin/env node

// Generate dist/sitemap.xml and dist/robots.txt at build time.
// Includes: /, /radar, /alerts, /alerts/[state] for every state slug,
// and /storm/[slug] for every JSON file in src/content/storms/.

const fs = require('fs');
const path = require('path');

const matter = require('gray-matter');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const STORMS_DIR = path.join(ROOT, 'src', 'content', 'storms');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
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

function loadBlogPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8');
      const { data } = matter(raw);
      return {
        slug: data.slug || f.replace(/\.md$/, ''),
        date: data.date || '',
        draft: !!data.draft
      };
    })
    .filter(p => p.slug && !p.draft);
}

function urlEntry(loc, { lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildSitemap(storms, blogPosts) {
  const now = new Date().toISOString();

  const stateUrls = STATE_SLUGS.map(slug =>
    urlEntry(`${BASE_URL}/alerts/${slug}`, {
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

  const blogPostUrls = blogPosts.map(p => {
    const lastmod = p.date ? new Date(p.date + 'T12:00:00Z').toISOString() : now;
    return urlEntry(`${BASE_URL}/blog/${p.slug}`, {
      lastmod,
      changefreq: 'monthly',
      priority: '0.7'
    });
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(BASE_URL, { lastmod: now, changefreq: 'daily', priority: '1.0' })}
${urlEntry(`${BASE_URL}/radar`, { lastmod: now, changefreq: 'daily', priority: '0.9' })}
${urlEntry(`${BASE_URL}/alerts`, { lastmod: now, changefreq: 'hourly', priority: '0.8' })}
${urlEntry(`${BASE_URL}/blog`, { lastmod: now, changefreq: 'weekly', priority: '0.8' })}
${stateUrls}
${stormUrls}
${blogPostUrls}
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
  const blogPosts = loadBlogPosts();

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), buildSitemap(storms, blogPosts), 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), buildRobotsTxt(), 'utf-8');

  console.log(`Generated dist/sitemap.xml (${STATE_SLUGS.length} states + ${storms.length} storms + ${blogPosts.length} blog posts)`);
  console.log('Generated dist/robots.txt');
}

main();
