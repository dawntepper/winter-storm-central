#!/usr/bin/env node

/**
 * Generate static HTML shells for /severe-weather/:hazardSlug pages.
 * Meta is stable (no live counts in titles). Body includes crawlable
 * intro + educational headings; live status hydrates client-side.
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const BASE_URL = 'https://stormtracking.io';

// Keep in sync with shared/hazard-engine/hazards.js launch:true entries
const HAZARDS = [
  {
    slug: 'tornado-warning',
    title: 'Tornado Warnings Today: Live Radar & Active Alerts | StormTracking',
    description: 'Track active tornado warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Tornado Warnings Today',
    intro: 'Track active tornado warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'tornado-watch',
    title: 'Tornado Watches Today: Live Radar & Active Watches | StormTracking',
    description: 'Track active tornado watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    h1: 'Tornado Watches Today',
    intro: 'Track active tornado watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
  },
  {
    slug: 'severe-thunderstorm-warning',
    title: 'Severe Thunderstorm Warnings Today & Live Radar | StormTracking',
    description: 'Track active severe thunderstorm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Severe Thunderstorm Warnings Today',
    intro: 'Track active severe thunderstorm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'severe-thunderstorm-watch',
    title: 'Severe Thunderstorm Watches Today & Live Radar | StormTracking',
    description: 'Track active severe thunderstorm watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    h1: 'Severe Thunderstorm Watches Today',
    intro: 'Track active severe thunderstorm watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
  },
  {
    slug: 'flash-flood-warning',
    title: 'Flash Flood Warnings Today & Live Radar | StormTracking',
    description: 'Track active flash flood warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Flash Flood Warnings Today',
    intro: 'Track active flash flood warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'flash-flood-watch',
    title: 'Flash Flood Watches Today & Live Radar | StormTracking',
    description: 'Track active flash flood watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    h1: 'Flash Flood Watches Today',
    intro: 'Track active flash flood watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
  },
  {
    slug: 'flood-warning',
    title: 'Flood Warnings Today & Live Radar | StormTracking',
    description: 'Track active flood warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Flood Warnings Today',
    intro: 'Track active flood warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'flood-watch',
    title: 'Flood Watches Today: Live Radar & Active Watches | StormTracking',
    description: 'Track active flood watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    h1: 'Flood Watches Today',
    intro: 'Track active flood watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
  },
  {
    slug: 'hurricane-warning',
    title: 'Hurricane Warnings Today, Alerts & Live Radar | StormTracking',
    description: 'Track active hurricane warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Hurricane Warnings Today',
    intro: 'Track active hurricane warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'tropical-storm-warning',
    title: 'Tropical Storm Warnings Today & Live Radar | StormTracking',
    description: 'Track active tropical storm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Tropical Storm Warnings Today',
    intro: 'Track active tropical storm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'storm-surge-warning',
    title: 'Storm Surge Warnings Today & Live Radar | StormTracking',
    description: 'Track active storm surge warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Storm Surge Warnings Today',
    intro: 'Track active storm surge warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'extreme-wind-warning',
    title: 'Extreme Wind Warnings Today & Live Radar | StormTracking',
    description: 'Track active extreme wind warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Extreme Wind Warnings Today',
    intro: 'Track active extreme wind warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'blizzard-warning',
    title: 'Blizzard Warnings Today & Live Radar | StormTracking',
    description: 'Track active blizzard warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Blizzard Warnings Today',
    intro: 'Track active blizzard warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'winter-storm-warning',
    title: 'Winter Storm Warnings & Advisories Today | StormTracking',
    description: 'Track active Winter Storm Warnings and Winter Weather Advisories across the United States, including Alaska and Hawaii, with live radar, affected states, and current National Weather Service alerts.',
    h1: 'Winter Storm Warnings & Advisories Today',
    intro: 'Track active Winter Storm Warnings and Winter Weather Advisories across the United States — including Alaska and Hawaii — with live radar, affected areas, alert details, and links to current state alerts.',
  },
  {
    slug: 'ice-storm-warning',
    title: 'Ice Storm Warnings Today & Live Radar | StormTracking',
    description: 'Track active ice storm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'Ice Storm Warnings Today',
    intro: 'Track active ice storm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'high-wind-warning',
    title: 'High Wind Warnings Today & Live Radar | StormTracking',
    description: 'Track active high wind warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    h1: 'High Wind Warnings Today',
    intro: 'Track active high wind warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'excessive-heat-warning',
    title: 'Extreme Heat Warnings Today | StormTracking',
    description: 'Track active Extreme Heat Warnings and Excessive Heat Warnings across the United States with affected states, warning details, and current National Weather Service alerts.',
    h1: 'Extreme Heat Warnings Today',
    intro: 'Track active Extreme Heat Warnings and Excessive Heat Warnings across the United States with affected areas, warning details, and links to current state alerts.',
  },
  {
    slug: 'red-flag-warning',
    title: 'Red Flag Warnings Today | StormTracking',
    description: 'Track active red flag warnings across the United States with affected states, warning details, and current National Weather Service alerts.',
    h1: 'Red Flag Warnings Today',
    intro: 'Track active red flag warnings across the United States with affected areas, warning details, and links to current state alerts.',
  },
];

function generateHTML(baseHTML, page) {
  let html = baseHTML;
  const pageUrl = `${BASE_URL}/severe-weather/${page.slug}`;

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

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${page.title}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${page.description}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${pageUrl}"`);
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${page.title}"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${page.description}"`);

  const jsonLd = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.h1,
      description: page.description,
      url: pageUrl,
      isPartOf: { '@type': 'WebSite', name: 'StormTracking', url: BASE_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: pageUrl },
      ],
    },
  ], null, 2);

  if (/<script\s+type="application\/ld\+json">/.test(html)) {
    html = html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n    ${jsonLd}\n    </script>`
    );
  } else {
    html = html.replace('</head>', `  <script type="application/ld+json">\n    ${jsonLd}\n    </script>\n  </head>`);
  }

  // Crawlable body snippet (hidden from visual layout; React replaces on hydrate)
  const snippet = `
  <div id="seo-severe-weather-snippet" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
    <h1>${page.h1}</h1>
    <p>${page.intro}</p>
    <h2>Current Situation</h2>
    <p>Live National Weather Service status for ${page.h1.replace(' Today', '').toLowerCase()} — including an active-count headline, concise weather briefing, and affected states — updates on this page from structured alert data.</p>
    <h2>Related Severe Weather</h2>
    <ul>
      <li><a href="${BASE_URL}/severe-weather/tornado-warning">Tornado Warnings Today</a></li>
      <li><a href="${BASE_URL}/severe-weather/tornado-watch">Tornado Watches Today</a></li>
      <li><a href="${BASE_URL}/severe-weather/severe-thunderstorm-warning">Severe Thunderstorm Warnings Today</a></li>
      <li><a href="${BASE_URL}/alerts">Live Weather Alerts</a></li>
      <li><a href="${BASE_URL}/radar">Live Weather Radar</a></li>
    </ul>
  </div>`;

  if (/<div id="root"><\/div>/.test(html)) {
    html = html.replace('<div id="root"></div>', `<div id="root"></div>\n${snippet}`);
  }

  return html;
}

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('dist/index.html missing — run vite build first');
    process.exit(1);
  }
  const baseHTML = fs.readFileSync(indexPath, 'utf-8');

  for (const page of HAZARDS) {
    const dir = path.join(DIST_DIR, 'severe-weather', page.slug);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, 'index.html');
    fs.writeFileSync(out, generateHTML(baseHTML, page));
    console.log(`Wrote ${out}`);
  }
}

main();
