#!/usr/bin/env node

/**
 * Generate raster favicon files from the Twemoji satellite dish (📡 / 1f4e1).
 *
 * The previous favicon was an inline data-URI SVG using the emoji as a text
 * element. Browsers render that fine in tabs, but search engines (Bing,
 * Google) often fail to index it for SERP listings — they want real raster
 * image files at standard sizes referenced via `<link rel="icon" sizes="...">`.
 *
 * This script fetches the Twemoji SVG vector (clean, no emoji-font dependency,
 * MIT licensed) and renders it to PNG at each common favicon size, then wraps
 * the 32×32 PNG in an ICO container for legacy browsers.
 *
 * Run with: npm run generate-favicons
 * Output: public/favicon.ico, public/favicon-{32,48,96,144,180}x{...}.png
 *
 * Re-run if we ever change the emoji — only thing to swap is the SVG URL
 * below. Output files are committed to the repo so production deploys don't
 * need to fetch from a third-party CDN at build time.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TWEMOJI_SVG_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@v14.0.2/assets/svg/1f4e1.svg';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public');
const SIZES = [32, 48, 96, 144, 180]; // 180 = apple-touch-icon

async function fetchSvg() {
  console.log(`Fetching Twemoji SVG from ${TWEMOJI_SVG_URL}`);
  const res = await fetch(TWEMOJI_SVG_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Twemoji SVG: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Pack a single PNG into an ICO container.
 *
 * ICO format (single-image):
 *   - 6-byte header: reserved(2) + type=1(2) + image-count=1(2)
 *   - 16-byte directory entry: width(1) + height(1) + colors(1) + reserved(1)
 *     + planes(2) + bitcount(2) + size(4) + offset(4)
 *   - PNG byte stream
 *
 * Width/height fields hold values in the range 0–255 where 0 represents 256.
 * For our 32×32 PNG those literal values fit fine.
 */
function buildIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);            // width
  entry.writeUInt8(32, 1);            // height
  entry.writeUInt8(0, 2);             // color-palette size (0 = no palette)
  entry.writeUInt8(0, 3);             // reserved
  entry.writeUInt16LE(1, 4);          // color planes
  entry.writeUInt16LE(32, 6);         // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // size of PNG data
  entry.writeUInt32LE(6 + 16, 12);    // byte offset to PNG data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  const svgBuffer = await fetchSvg();

  // Sharp renders the SVG to a transparent PNG at the requested size via
  // librsvg. Twemoji vectors render cleanly at any size — no rasterization
  // artifacts from upscaling a fixed bitmap.
  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `favicon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`  ✓ ${path.relative(process.cwd(), outputPath)}`);
  }

  // ICO container wraps the 32×32 PNG — legacy browsers that ignore the PNG
  // link tags still get a valid icon at /favicon.ico.
  const png32 = await sharp(svgBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const icoBuffer = buildIco(png32);
  const icoPath = path.join(OUTPUT_DIR, 'favicon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  ✓ ${path.relative(process.cwd(), icoPath)}`);

  console.log('\nFavicons generated. Update index.html link tags to reference them.');
}

main().catch((err) => {
  console.error('Favicon generation failed:', err);
  process.exit(1);
});
