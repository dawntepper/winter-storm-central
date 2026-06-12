/**
 * Generate src/data/countyCentroids.json from us-atlas county geometries.
 * Run: node scripts/generate-county-centroids.js
 */
const fs = require('fs');
const path = require('path');
const usCounties = require('us-atlas/counties-10m.json');
const { feature } = require('topojson-client');

function bboxCentroid(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function walk(coords) {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return;
    }
    coords.forEach(walk);
  }

  if (geometry.type === 'Polygon') walk(geometry.coordinates);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((p) => walk(p));

  return { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2 };
}

const collection = feature(usCounties, usCounties.objects.counties);
const map = {};

for (const f of collection.features) {
  const fips = String(f.id).padStart(5, '0');
  const c = bboxCentroid(f.geometry);
  map[fips] = [Number(c.lat.toFixed(5)), Number(c.lon.toFixed(5))];
}

const outPath = path.join(__dirname, '..', 'src', 'data', 'countyCentroids.json');
fs.writeFileSync(outPath, JSON.stringify(map));
console.log(`Wrote ${Object.keys(map).length} county centroids to ${outPath}`);
