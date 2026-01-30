// Netlify Function: Generate dynamic Open Graph images
// Composites map tiles + radar tiles + branded text overlay into 1200x630 PNG
//
// Routes (via /api/og-image/* redirect):
//   /api/og-image/radar          → CONUS-wide radar preview
//   /api/og-image/storm/:slug    → Storm-specific map centered on affected area

const sharp = require('sharp');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const TILE_SIZE = 256;
const GRID_COLS = 5; // 5 tiles wide = 1280px
const GRID_ROWS = 3; // 3 tiles tall = 768px

// In-memory cache for warm function invocations
const imageCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// =============================================
// TILE MATH
// =============================================

function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  );
  return { x, y };
}

function getTileGrid(lat, lon, zoom) {
  const center = latLonToTile(lat, lon, zoom);
  const startX = center.x - Math.floor(GRID_COLS / 2);
  const startY = center.y - Math.floor(GRID_ROWS / 2);

  const tiles = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      tiles.push({
        x: startX + col,
        y: startY + row,
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
      });
    }
  }
  return tiles;
}

// =============================================
// DATA FETCHING
// =============================================

async function fetchTile(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function getLatestRadarTimestamp() {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const data = await res.json();
    const latest = data.radar?.past?.slice(-1)[0];
    if (!latest) return null;
    return {
      host: data.host || 'https://tilecache.rainviewer.com',
      path: latest.path,
    };
  } catch {
    return null;
  }
}

async function fetchStormData(slug) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/storm_events?slug=eq.${slug}&select=title,slug,type,status,affected_states,map_center,map_zoom,seo_title,seo_description&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await res.json();
    if (!data || !data[0]) return null;

    const storm = data[0];
    // Parse JSON fields if they're strings
    if (typeof storm.map_center === 'string') {
      try { storm.map_center = JSON.parse(storm.map_center); } catch { storm.map_center = null; }
    }
    if (typeof storm.affected_states === 'string') {
      try { storm.affected_states = JSON.parse(storm.affected_states); } catch { storm.affected_states = []; }
    }
    return storm;
  } catch {
    return null;
  }
}

// =============================================
// IMAGE COMPOSITING
// =============================================

async function compositeMapImage(lat, lon, zoom) {
  const tileGrid = getTileGrid(lat, lon, zoom);

  // Fetch base map tiles and radar tiles in parallel
  const radar = await getLatestRadarTimestamp();

  const fetchPromises = tileGrid.map(async (tile) => {
    const subdomains = ['a', 'b', 'c', 'd'];
    const s = subdomains[(tile.x + tile.y) % subdomains.length];
    const baseUrl = `https://${s}.basemaps.cartocdn.com/dark_all/${zoom}/${tile.x}/${tile.y}.png`;

    const baseBuffer = await fetchTile(baseUrl);

    let radarBuffer = null;
    if (radar) {
      const radarUrl = `${radar.host}${radar.path}/256/${zoom}/${tile.x}/${tile.y}/4/1_1.png`;
      radarBuffer = await fetchTile(radarUrl);
    }

    return { ...tile, baseBuffer, radarBuffer };
  });

  const results = await Promise.all(fetchPromises);

  // Build composite layers
  const baseLayers = results
    .filter(r => r.baseBuffer)
    .map(r => ({ input: r.baseBuffer, left: r.left, top: r.top }));

  const radarLayers = results
    .filter(r => r.radarBuffer)
    .map(r => ({ input: r.radarBuffer, left: r.left, top: r.top }));

  if (baseLayers.length === 0) return null;

  // Composite: dark background → base map tiles → radar tiles
  const gridWidth = GRID_COLS * TILE_SIZE;
  const gridHeight = GRID_ROWS * TILE_SIZE;

  let image = sharp({
    create: {
      width: gridWidth,
      height: gridHeight,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 255 },
    },
  }).composite(baseLayers);

  let mapBuffer = await image.png().toBuffer();

  // Add radar overlay
  if (radarLayers.length > 0) {
    mapBuffer = await sharp(mapBuffer).composite(radarLayers).png().toBuffer();
  }

  // Center-crop to OG dimensions
  const cropLeft = Math.floor((gridWidth - OG_WIDTH) / 2);
  const cropTop = Math.floor((gridHeight - OG_HEIGHT) / 2);

  const cropped = await sharp(mapBuffer)
    .extract({
      left: Math.max(0, cropLeft),
      top: Math.max(0, cropTop),
      width: OG_WIDTH,
      height: OG_HEIGHT,
    })
    .png()
    .toBuffer();

  return cropped;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(str, max) {
  return str.length > max ? str.substring(0, max - 1) + '...' : str;
}

function buildTextOverlay({ title, subtitle, statusText, statusColor, brandingSubtitle }) {
  const escapedTitle = escapeXml(truncate(title, 40));
  const escapedSubtitle = subtitle ? escapeXml(truncate(subtitle, 70)) : '';
  const escapedBrandingSub = escapeXml(brandingSubtitle || 'Live Weather Radar & Alerts');

  // Calculate status badge width based on text length
  const badgeWidth = statusText ? statusText.length * 10 + 32 : 0;

  return Buffer.from(`<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:rgb(15,23,42);stop-opacity:0.92" />
      <stop offset="30%" style="stop-color:rgb(15,23,42);stop-opacity:0.5" />
      <stop offset="60%" style="stop-color:rgb(15,23,42);stop-opacity:0.35" />
      <stop offset="100%" style="stop-color:rgb(15,23,42);stop-opacity:0.88" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />

  <!-- Branding -->
  <text x="48" y="60" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#38bdf8">StormTracking</text>
  <text x="48" y="84" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="14" fill="#94a3b8">${escapedBrandingSub}</text>

  <!-- LIVE indicator -->
  <circle cx="${OG_WIDTH - 76}" cy="52" r="6" fill="#10b981" />
  <text x="${OG_WIDTH - 64}" y="58" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#10b981">LIVE</text>

  ${statusText ? `
  <!-- Status badge -->
  <rect x="48" y="440" width="${badgeWidth}" height="30" rx="6" fill="${statusColor}" fill-opacity="0.9" />
  <text x="${48 + badgeWidth / 2}" y="460" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="white" text-anchor="middle" letter-spacing="0.5">${escapeXml(statusText)}</text>
  ` : ''}

  <!-- Title -->
  <text x="48" y="520" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" font-size="46" font-weight="800" fill="white">${escapedTitle}</text>

  ${escapedSubtitle ? `
  <!-- Subtitle -->
  <text x="48" y="560" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="18" fill="#cbd5e1">${escapedSubtitle}</text>
  ` : ''}

  <!-- Bottom bar -->
  <rect x="0" y="${OG_HEIGHT - 4}" width="${OG_WIDTH}" height="4" fill="#38bdf8" />
</svg>`);
}

// =============================================
// IMAGE GENERATORS
// =============================================

async function generateRadarOgImage() {
  // CONUS center view
  const mapBuffer = await compositeMapImage(39.0, -98.0, 4);

  const overlay = buildTextOverlay({
    title: 'Live Weather Radar',
    subtitle: 'Real-time precipitation, storms & severe weather alerts across the US',
    brandingSubtitle: 'stormtracking.io/radar',
  });

  if (!mapBuffer) {
    // Fallback: dark background with text only
    return sharp({
      create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 255 } },
    })
      .composite([{ input: overlay }])
      .png()
      .toBuffer();
  }

  return sharp(mapBuffer)
    .composite([{ input: overlay }])
    .png({ compressionLevel: 8 })
    .toBuffer();
}

async function generateStormOgImage(slug) {
  const storm = await fetchStormData(slug);

  const title = storm?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const lat = storm?.map_center?.lat ?? 39.0;
  const lon = storm?.map_center?.lon ?? -98.0;
  const zoom = Math.min(storm?.map_zoom ?? 5, 6); // Cap at 6 for OG tiles

  const statusLabels = {
    active: 'ACTIVE NOW',
    forecasted: 'FORECASTED',
    completed: 'COMPLETED',
  };
  const statusColorMap = {
    active: '#10b981',
    forecasted: '#f59e0b',
    completed: '#64748b',
  };

  const statusText = storm?.status ? statusLabels[storm.status] : null;
  const statusColor = storm?.status ? statusColorMap[storm.status] || '#64748b' : null;

  const states = Array.isArray(storm?.affected_states)
    ? storm.affected_states.join(', ')
    : '';
  const subtitle = states ? `Affecting: ${states}` : 'United States';

  const mapBuffer = await compositeMapImage(lat, lon, zoom);

  const overlay = buildTextOverlay({
    title,
    subtitle,
    statusText,
    statusColor,
    brandingSubtitle: 'Live Radar & Real-Time Alerts',
  });

  if (!mapBuffer) {
    return sharp({
      create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 255 } },
    })
      .composite([{ input: overlay }])
      .png()
      .toBuffer();
  }

  return sharp(mapBuffer)
    .composite([{ input: overlay }])
    .png({ compressionLevel: 8 })
    .toBuffer();
}

// =============================================
// HANDLER
// =============================================

exports.handler = async (event) => {
  const path = event.path
    .replace('/.netlify/functions/og-image', '')
    .replace('/api/og-image', '');

  // Check in-memory cache
  const cacheKey = path || '/radar';
  const cached = imageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=900, s-maxage=900',
      },
      body: cached.image,
      isBase64Encoded: true,
    };
  }

  try {
    let imageBuffer;

    const stormMatch = path.match(/^\/storm\/([a-z0-9-]+)\/?$/);
    const isRadar = !path || path === '/' || path === '/radar' || path === '/radar/';

    if (stormMatch) {
      imageBuffer = await generateStormOgImage(stormMatch[1]);
    } else if (isRadar) {
      imageBuffer = await generateRadarOgImage();
    } else {
      return { statusCode: 404, body: 'Not found' };
    }

    const base64 = imageBuffer.toString('base64');

    // Cache in memory
    imageCache.set(cacheKey, { image: base64, timestamp: Date.now() });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=900, s-maxage=900',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('OG image generation error:', err);

    // Return a minimal fallback image
    try {
      const fallback = await sharp({
        create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 255 } },
      })
        .composite([{
          input: buildTextOverlay({
            title: 'StormTracking',
            subtitle: 'Live Weather Radar & Real-Time Storm Alerts',
          }),
        }])
        .png()
        .toBuffer();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
        },
        body: fallback.toString('base64'),
        isBase64Encoded: true,
      };
    } catch {
      return { statusCode: 500, body: 'Image generation failed' };
    }
  }
};
