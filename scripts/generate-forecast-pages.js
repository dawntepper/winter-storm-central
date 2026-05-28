#!/usr/bin/env node

// Generate unique static HTML files for each /forecast/[state-slug] route.
// Reads dist/index.html and writes dist/forecast/[state-slug]/index.html with
// unique <title>, <meta description>, canonical, OG tags, and JSON-LD per
// state.
//
// Important: ?city= query-param variants (e.g. /forecast/california?city=
// san-francisco-ca) all resolve to the same dist/forecast/[state]/index.html
// via the SPA fallback — they share the state-level canonical. This is
// intentional: consolidates indexing to one canonical URL per state forecast
// instead of multiplying near-duplicate "city forecast" pages in the index.
// Client-side JS still updates the tab title to include the city for UX,
// but the static meta locks the canonical to /forecast/[state].

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const BASE_URL = 'https://stormtracking.io';

// Mirrors the slug list in generate-state-pages.js + the SPA's US_STATES.
// If we ever extract this to scripts/lib/states.js, update all three callers.
const states = [
  { slug: 'alabama', name: 'Alabama' },
  { slug: 'alaska', name: 'Alaska' },
  { slug: 'arizona', name: 'Arizona' },
  { slug: 'arkansas', name: 'Arkansas' },
  { slug: 'california', name: 'California' },
  { slug: 'colorado', name: 'Colorado' },
  { slug: 'connecticut', name: 'Connecticut' },
  { slug: 'delaware', name: 'Delaware' },
  { slug: 'florida', name: 'Florida' },
  { slug: 'georgia', name: 'Georgia' },
  { slug: 'hawaii', name: 'Hawaii' },
  { slug: 'idaho', name: 'Idaho' },
  { slug: 'illinois', name: 'Illinois' },
  { slug: 'indiana', name: 'Indiana' },
  { slug: 'iowa', name: 'Iowa' },
  { slug: 'kansas', name: 'Kansas' },
  { slug: 'kentucky', name: 'Kentucky' },
  { slug: 'louisiana', name: 'Louisiana' },
  { slug: 'maine', name: 'Maine' },
  { slug: 'maryland', name: 'Maryland' },
  { slug: 'massachusetts', name: 'Massachusetts' },
  { slug: 'michigan', name: 'Michigan' },
  { slug: 'minnesota', name: 'Minnesota' },
  { slug: 'mississippi', name: 'Mississippi' },
  { slug: 'missouri', name: 'Missouri' },
  { slug: 'montana', name: 'Montana' },
  { slug: 'nebraska', name: 'Nebraska' },
  { slug: 'nevada', name: 'Nevada' },
  { slug: 'new-hampshire', name: 'New Hampshire' },
  { slug: 'new-jersey', name: 'New Jersey' },
  { slug: 'new-mexico', name: 'New Mexico' },
  { slug: 'new-york', name: 'New York' },
  { slug: 'north-carolina', name: 'North Carolina' },
  { slug: 'north-dakota', name: 'North Dakota' },
  { slug: 'ohio', name: 'Ohio' },
  { slug: 'oklahoma', name: 'Oklahoma' },
  { slug: 'oregon', name: 'Oregon' },
  { slug: 'pennsylvania', name: 'Pennsylvania' },
  { slug: 'rhode-island', name: 'Rhode Island' },
  { slug: 'south-carolina', name: 'South Carolina' },
  { slug: 'south-dakota', name: 'South Dakota' },
  { slug: 'tennessee', name: 'Tennessee' },
  { slug: 'texas', name: 'Texas' },
  { slug: 'utah', name: 'Utah' },
  { slug: 'vermont', name: 'Vermont' },
  { slug: 'virginia', name: 'Virginia' },
  { slug: 'washington', name: 'Washington' },
  { slug: 'west-virginia', name: 'West Virginia' },
  { slug: 'wisconsin', name: 'Wisconsin' },
  { slug: 'wyoming', name: 'Wyoming' },
  { slug: 'district-of-columbia', name: 'District of Columbia' },
  { slug: 'puerto-rico', name: 'Puerto Rico' },
  { slug: 'us-virgin-islands', name: 'U.S. Virgin Islands' },
  { slug: 'guam', name: 'Guam' },
  { slug: 'american-samoa', name: 'American Samoa' },
];

function generateForecastHTML(baseHTML, state) {
  let html = baseHTML;
  const { slug, name } = state;
  const pageUrl = `${BASE_URL}/forecast/${slug}`;

  const title = `${name} Weather Forecast — Hourly & 7-Day Outlook | StormTracking`;
  const description = `Hourly and 7-day weather forecast for ${name}. Live radar, NWS data, severe weather tracking. Free, no ads.`;
  const ogTitle = `${name} Weather Forecast | StormTracking`;
  const ogDescription = `Hourly and 7-day forecast for ${name} from NWS. Live radar and current conditions.`;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /(<meta\s+name="title"\s+content=")[^"]*"/,
    `$1${title}"`
  );

  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*"/,
      `$1${description}"`
    );
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${description}" />\n  </head>`);
  }

  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*"/,
      `$1${pageUrl}"`
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${pageUrl}" />\n  </head>`);
  }

  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${ogTitle}"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${ogDescription}"`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${pageUrl}"`);

  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${ogTitle}"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${ogDescription}"`);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': `${name} Weather Forecast`,
    'description': `Hourly and 7-day forecast for ${name}`,
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

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('Error: dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  const baseHTML = fs.readFileSync(indexPath, 'utf-8');
  let count = 0;
  for (const state of states) {
    const dir = path.join(DIST_DIR, 'forecast', state.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), generateForecastHTML(baseHTML, state), 'utf-8');
    count++;
  }
  console.log(`Generated ${count} forecast pages in dist/forecast/`);
}

main();
