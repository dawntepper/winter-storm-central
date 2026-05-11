#!/usr/bin/env node

// Generate unique static HTML files for each /storm/[slug] route.
// Reads dist/index.html and src/content/storms/*.json, then writes
// dist/storm/[slug]/index.html with unique <title>, <meta description>,
// canonical, OG tags, and JSON-LD per storm.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const STORMS_DIR = path.join(ROOT, 'src', 'content', 'storms');
const BASE_URL = 'https://stormtracking.io';

function loadStorms() {
  if (!fs.existsSync(STORMS_DIR)) return [];
  return fs.readdirSync(STORMS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(STORMS_DIR, f), 'utf-8')));
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildKeywords(storm, defaults) {
  const k = storm?.seo?.keywords;
  const arr = Array.isArray(k)
    ? k
    : typeof k === 'string'
      ? k.split(',').map(s => s.trim()).filter(Boolean)
      : [];
  return [...arr, ...defaults].join(', ');
}

function generateStormHTML(baseHTML, storm) {
  const slug = storm.slug;
  const pageUrl = `${BASE_URL}/storm/${slug}`;
  const year = storm.start_date
    ? new Date(storm.start_date + 'T12:00:00').getFullYear()
    : new Date().getFullYear();

  const titleWithYear = `${storm.title} ${year}`;
  const title = storm.seo?.title || `${titleWithYear} Tracker | Live Radar & Updates | StormTracking`;
  const description = storm.seo?.description
    || `Track ${titleWithYear} with live radar and real-time updates. Current forecasts, weather alerts, and conditions. Updated continuously.`;
  const ogImage = storm.seo?.og_image_url || `${BASE_URL}/api/og-image/storm/${slug}`;

  const titleLower = String(storm.title || '').toLowerCase();
  const defaultKeywords = [
    `${titleLower} ${year}`,
    `${titleLower} tracker`,
    `${titleLower} ${year} tracker`,
    `${titleLower} update`,
    'live radar',
    'real-time alerts',
    'storm tracking'
  ];
  const keywords = buildKeywords(storm, defaultKeywords);

  let html = baseHTML;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);

  html = html.replace(
    /(<meta\s+name="title"\s+content=")[^"]*"/,
    `$1${escapeAttr(title)}"`
  );

  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*"/,
      `$1${escapeAttr(description)}"`
    );
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${escapeAttr(description)}" />\n  </head>`);
  }

  if (/<meta\s+name="keywords"/.test(html)) {
    html = html.replace(
      /(<meta\s+name="keywords"\s+content=")[^"]*"/,
      `$1${escapeAttr(keywords)}"`
    );
  } else {
    html = html.replace('</head>', `  <meta name="keywords" content="${escapeAttr(keywords)}" />\n  </head>`);
  }

  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*"/,
      `$1${pageUrl}"`
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${pageUrl}" />\n  </head>`);
  }

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${escapeAttr(title)}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${escapeAttr(description)}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${pageUrl}"`);
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${escapeAttr(ogImage)}"`);

  html = html.replace(/(<meta\s+(?:name|property)="twitter:title"\s+content=")[^"]*"/, `$1${escapeAttr(title)}"`);
  html = html.replace(/(<meta\s+(?:name|property)="twitter:description"\s+content=")[^"]*"/, `$1${escapeAttr(description)}"`);
  html = html.replace(/(<meta\s+(?:name|property)="twitter:image"\s+content=")[^"]*"/, `$1${escapeAttr(ogImage)}"`);

  const states = Array.isArray(storm.affected_states) ? storm.affected_states.join(', ') : '';
  const schemaStatus = storm.status === 'completed'
    ? 'https://schema.org/EventEnded'
    : 'https://schema.org/EventScheduled';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${storm.title} ${year}`,
    description: storm.description,
    startDate: storm.start_date,
    endDate: storm.end_date,
    eventStatus: schemaStatus,
    location: {
      '@type': 'Place',
      name: 'United States',
      address: {
        '@type': 'PostalAddress',
        addressRegion: states
      }
    },
    organizer: {
      '@type': 'Organization',
      name: 'National Weather Service'
    },
    url: pageUrl,
    image: ogImage
  }, null, 2);

  if (/<script\s+type="application\/ld\+json">/.test(html)) {
    html = html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n    ${jsonLd}\n    </script>`
    );
  } else {
    html = html.replace('</head>', `  <script type="application/ld+json">\n    ${jsonLd}\n    </script>\n  </head>`);
  }

  return html;
}

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('Error: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  const storms = loadStorms();

  // Always emit storm-data.json so the og-image function and og-rewrite edge
  // function have a public, same-origin lookup table — even if storms is empty.
  const byslug = Object.fromEntries(
    storms.filter(s => s && s.slug).map(s => [s.slug, s])
  );
  fs.writeFileSync(
    path.join(DIST_DIR, 'storm-data.json'),
    JSON.stringify(byslug, null, 2),
    'utf-8'
  );
  console.log(`Wrote dist/storm-data.json (${Object.keys(byslug).length} storms)`);

  if (storms.length === 0) {
    console.log('No storms found in src/content/storms/');
    return;
  }

  const baseHTML = fs.readFileSync(indexPath, 'utf-8');
  let count = 0;

  for (const storm of storms) {
    if (!storm.slug) {
      console.warn('Skipping storm without slug:', storm.title);
      continue;
    }
    const dir = path.join(DIST_DIR, 'storm', storm.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateStormHTML(baseHTML, storm), 'utf-8');
    count++;
  }

  console.log(`Generated ${count} storm pages in dist/storm/`);
}

main();
