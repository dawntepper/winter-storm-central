// Netlify Edge Function: approximate visitor location for the "Weather Near Me"
// headline (Layer 1 / silent detection).
//
// Reads Netlify's built-in `context.geo` — no third-party IP API, no API key,
// no rate limit, and the raw IP is never exposed to the client. Returns only a
// coarse city/region, used purely to personalize the header text. It does NOT
// move the map (the map only re-centers on an explicit GPS tap), so this never
// causes a layout shift on initial load.
//
// Registered at /api/geo in netlify.toml. Edge functions run before the
// /api/* redirect, so this short-circuits before the SPA fallback.
export default async function handler(_request, context) {
  const geo = context.geo || {};

  const body = JSON.stringify({
    city: geo.city || null,
    region: geo.subdivision?.code || null,      // e.g. "TX"
    regionName: geo.subdivision?.name || null,   // e.g. "Texas"
    country: geo.country?.code || null,
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Per-visitor data: browser may cache briefly, shared caches must not.
      'cache-control': 'private, max-age=300',
    },
  });
}
