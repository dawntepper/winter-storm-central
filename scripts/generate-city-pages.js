#!/usr/bin/env node

// Generate unique static HTML files for each /alerts/[city-slug] route.
// Reads dist/index.html and writes dist/alerts/[city-slug]/index.html with
// city-specific <title>, <meta description>, canonical, OG tags, and JSON-LD.
//
// City data comes from src/content/cities/*.json (excluding index.json).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const CITIES_DIR = path.join(ROOT, 'src', 'content', 'cities');
const BASE_URL = 'https://stormtracking.io';

function loadCities() {
  if (!fs.existsSync(CITIES_DIR)) return [];
  return fs.readdirSync(CITIES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(CITIES_DIR, f), 'utf-8')))
    .filter((c) => c && c.slug && c.city && c.state);
}

function buildHtml(baseHTML, city) {
  let html = baseHTML;

  const url = `${BASE_URL}/alerts/${city.slug}`;
  const st = city.state_abbr;
  const title = `${city.city}, ${st} Weather Alerts — Live Warnings & Radar`;
  const description = `Is ${city.city} under a weather warning right now? Live NWS alerts, current conditions, and radar for ${city.city}, ${st} — updated every few minutes.`;
  const ogImage = `${BASE_URL}/og-image.png`;

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // <meta name="title">
  html = html.replace(
    /(<meta\s+name="title"\s+content=")[^"]*"/,
    `$1${title}"`,
  );

  // <meta name="description">
  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*"/,
      `$1${description}"`,
    );
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${description}" />\n  </head>`);
  }

  // <link rel="canonical">
  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*"/,
      `$1${url}"`,
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${url}" />\n  </head>`);
  }

  // OG tags
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${title}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${description}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${url}"`);
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${ogImage}"`);

  // Twitter
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${title}"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${description}"`);

  // JSON-LD — WebPage + Place + BreadcrumbList
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        description,
        url,
        mainEntity: {
          '@type': 'Place',
          name: `${city.city}, ${city.state}`,
          address: {
            '@type': 'PostalAddress',
            addressLocality: city.city,
            addressRegion: city.state_abbr,
            addressCountry: 'US',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: city.lat,
            longitude: city.lon,
          },
        },
        publisher: {
          '@type': 'Organization',
          name: 'StormTracking.io',
          url: BASE_URL,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'StormTracking.io', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Weather Alerts', item: `${BASE_URL}/alerts` },
          { '@type': 'ListItem', position: 3, name: `${city.state} Alerts`, item: `${BASE_URL}/alerts/${city.state_slug}` },
          { '@type': 'ListItem', position: 4, name: `${city.city} Alerts`, item: url },
        ],
      },
    ],
  }, null, 2);

  if (/<script\s+type="application\/ld\+json">/.test(html)) {
    html = html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n    ${jsonLd}\n    </script>`,
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

  const baseHTML = fs.readFileSync(indexPath, 'utf-8');
  const cities = loadCities();

  let count = 0;
  for (const city of cities) {
    const dir = path.join(DIST_DIR, 'alerts', city.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildHtml(baseHTML, city), 'utf-8');
    count++;
  }

  console.log(`Generated ${count} city page${count === 1 ? '' : 's'} in dist/alerts/`);
}

main();
