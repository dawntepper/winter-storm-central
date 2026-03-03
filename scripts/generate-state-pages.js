#!/usr/bin/env node

// Generate unique static HTML files for each /alerts/[state] route
// Reads dist/index.html and creates dist/alerts/[state]/index.html with
// unique <title>, <meta description>, canonical, OG tags, and JSON-LD

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const BASE_URL = 'https://stormtracking.io';

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

function generateStateHTML(baseHTML, state) {
  let html = baseHTML;
  const { slug, name } = state;
  const pageUrl = `${BASE_URL}/alerts/${slug}`;

  const title = `${name} Weather Alerts — Live Severe Weather Warnings | StormTracking`;
  const description = `Live ${name} severe weather alerts from the National Weather Service. Real-time warnings, watches, and advisories for storms, hurricanes, tornadoes, flooding, and winter weather. Updated every 30 minutes.`;

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Replace meta name="title"
  html = html.replace(
    /(<meta\s+name="title"\s+content=")[^"]*"/,
    `$1${title}"`
  );

  // Replace or insert meta name="description"
  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(
      /(<meta\s+name="description"\s+content=")[^"]*"/,
      `$1${description}"`
    );
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${description}" />\n  </head>`);
  }

  // Replace canonical
  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*"/,
      `$1${pageUrl}"`
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${pageUrl}" />\n  </head>`);
  }

  // Replace OG tags
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${name} Weather Alerts | StormTracking"`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1Live severe weather alerts for ${name}. Real-time NWS warnings and watches updated every 30 minutes."`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${pageUrl}"`);

  // Replace Twitter tags
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${name} Weather Alerts | StormTracking"`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1Live severe weather alerts for ${name}. Real-time NWS warnings and watches updated every 30 minutes."`);

  // Replace existing JSON-LD with page-specific one
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': `${name} Weather Alerts`,
    'description': `Live severe weather alerts for ${name}`,
    'url': pageUrl,
    'isPartOf': {
      '@type': 'WebSite',
      'name': 'StormTracking',
      'url': BASE_URL,
    },
  }, null, 2);

  // Insert JSON-LD before </head> (after replacing existing one or adding new)
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
    const dir = path.join(DIST_DIR, 'alerts', state.slug);
    fs.mkdirSync(dir, { recursive: true });

    const stateHTML = generateStateHTML(baseHTML, state);
    fs.writeFileSync(path.join(dir, 'index.html'), stateHTML, 'utf-8');
    count++;
  }

  console.log(`Generated ${count} state pages in dist/alerts/`);
}

main();
