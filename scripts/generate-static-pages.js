#!/usr/bin/env node

// Generate unique static HTML files for the singleton routes that don't
// have per-record meta (/alerts, /radar, /prep). Each gets its own canonical
// + title + description so view-source returns the right meta to crawlers
// and social bots, instead of the SPA fallback to dist/index.html (which
// serves the homepage's homepage-canonical meta to every URL).
//
// Mirrors the pattern in generate-state-pages.js / generate-city-pages.js /
// generate-forecast-pages.js. New singleton routes go in PAGES below.

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const BASE_URL = 'https://stormtracking.io';

const PAGES = [
  {
    route: 'alerts',
    title: 'Live Weather Alerts — Real-Time NWS Warnings | StormTracking',
    description: 'All active National Weather Service alerts ranked by severity. Live radar, real-time NWS data, severe weather tracking across the United States.',
    ogTitle: 'Live Weather Alerts | StormTracking',
    ogDescription: 'All active NWS weather alerts ranked by severity. Live radar and real-time data.',
    schemaName: 'Live Weather Alerts',
    schemaDescription: 'All active NWS weather alerts ranked by severity',
  },
  {
    route: 'radar',
    title: 'NWS Live Radar Map — NOAA Precipitation & Storms',
    description: 'Interactive US weather radar with precipitation, satellite, and forecast layers. Radar refreshes every 5 minutes; NWS alert overlays every 10 minutes (2 min during urgent warnings).',
    ogTitle: 'NWS Live Radar Map — NOAA Precipitation & Storms',
    ogDescription: 'Interactive US weather radar with precipitation, satellite, and forecast layers. Radar refreshes every 5 minutes; NWS alert overlays every 10 minutes (2 min during urgent warnings).',
    schemaName: 'NWS Live Radar Map',
    schemaDescription: 'Interactive US weather radar with precipitation, satellite, and forecast layers',
  },
  {
    route: 'prep',
    title: 'Extreme Weather Prep — Storm Preparedness Gear We Recommend | StormTracking',
    description: 'What to have ready for hurricanes, tornadoes, and severe weather. Gear we actually own and use, from a Fort Myers indie dev.',
    ogTitle: 'Storm Preparedness Gear | StormTracking',
    ogDescription: 'Honest gear recommendations for hurricane season, severe weather, and extended outages.',
    schemaName: 'Storm Preparedness Guide',
    schemaDescription: 'Recommended gear for hurricane season, severe weather, and extended outages',
  },
  {
    route: 'add-to-home',
    title: 'Add StormTracking to Your Home Screen | StormTracking',
    description: 'Install stormtracking.io on your iPhone or Android home screen for quick access to live weather radar and NWS alerts.',
    ogTitle: 'Add StormTracking to Your Home Screen',
    ogDescription: 'Pin StormTracking to your phone for one-tap access to live radar and severe weather alerts.',
    schemaName: 'Add to Home Screen Guide',
    schemaDescription: 'How to add StormTracking to your mobile home screen on iOS and Android',
  },
];

function generateStaticHTML(baseHTML, page) {
  let html = baseHTML;
  const pageUrl = `${BASE_URL}/${page.route}`;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);
  html = html.replace(/(<meta\s+name="title"\s+content=")[^"]*"/, `$1${page.title}"`);

  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${page.description}"`);
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${page.description}" />\n  </head>`);
  }

  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*"/, `$1${pageUrl}"`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${pageUrl}" />\n  </head>`);
  }

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${page.ogTitle}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${page.ogDescription}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${pageUrl}"`);

  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${page.ogTitle}"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${page.ogDescription}"`);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': page.schemaName,
    'description': page.schemaDescription,
    'url': pageUrl,
    'isPartOf': {
      '@type': 'WebSite',
      'name': 'StormTracking',
      'url': BASE_URL,
    },
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

function applyHomepageMetaToHTML(html, meta) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`);
  out = out.replace(/(<meta\s+name="title"\s+content=")[^"]*"/, `$1${meta.title}"`);
  out = out.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${meta.description}"`);
  out = out.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${meta.ogTitle}"`);
  out = out.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${meta.ogDescription}"`);
  out = out.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${meta.twitterTitle}"`);
  out = out.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${meta.twitterDescription}"`);
  return out;
}

async function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Error: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  const { getSeasonalHomepageMeta } = await import('../src/data/homepageMeta.js');
  const homepageMeta = getSeasonalHomepageMeta();
  let baseHTML = fs.readFileSync(indexPath, 'utf-8');
  baseHTML = applyHomepageMetaToHTML(baseHTML, homepageMeta);
  fs.writeFileSync(indexPath, baseHTML, 'utf-8');
  console.log(`Homepage meta (${homepageMeta.season}): ${homepageMeta.title}`);

  let count = 0;
  for (const page of PAGES) {
    const dir = path.join(DIST_DIR, page.route);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateStaticHTML(baseHTML, page), 'utf-8');
    count++;
  }
  console.log(`Generated ${count} static pages: ${PAGES.map((p) => '/' + p.route).join(', ')}`);
}

main();
