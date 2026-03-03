#!/usr/bin/env node

// Generate static robots.txt in dist/
// The dynamic sitemap.xml is handled by the Netlify function (which includes storm events)
// This script generates robots.txt as a build artifact

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

function generateRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: https://stormtracking.io/sitemap.xml
`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run vite build first.');
    process.exit(1);
  }

  // Write robots.txt
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), generateRobotsTxt(), 'utf-8');
  console.log('Generated dist/robots.txt');
}

main();
