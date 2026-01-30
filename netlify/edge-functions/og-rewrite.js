// Netlify Edge Function: Rewrite OG meta tags for social crawlers
// Intercepts /storm/*, /radar, and /alerts/* requests from bots and injects
// page-specific og:title, og:description, og:image into the HTML

const CRAWLER_AGENTS = [
  'googlebot', 'bingbot', 'twitterbot', 'facebookexternalhit',
  'linkedinbot', 'slackbot', 'discordbot', 'whatsapp', 'telegrambot',
  'pinterest', 'applebot', 'redditbot',
];

const BASE_URL = 'https://stormtracking.io';

// State slug → name for /alerts/* pages (duplicated here since edge functions can't import from Vite bundle)
const SLUG_TO_STATE_NAME = {
  'alabama': 'Alabama', 'alaska': 'Alaska', 'arizona': 'Arizona', 'arkansas': 'Arkansas',
  'california': 'California', 'colorado': 'Colorado', 'connecticut': 'Connecticut', 'delaware': 'Delaware',
  'florida': 'Florida', 'georgia': 'Georgia', 'hawaii': 'Hawaii', 'idaho': 'Idaho',
  'illinois': 'Illinois', 'indiana': 'Indiana', 'iowa': 'Iowa', 'kansas': 'Kansas',
  'kentucky': 'Kentucky', 'louisiana': 'Louisiana', 'maine': 'Maine', 'maryland': 'Maryland',
  'massachusetts': 'Massachusetts', 'michigan': 'Michigan', 'minnesota': 'Minnesota', 'mississippi': 'Mississippi',
  'missouri': 'Missouri', 'montana': 'Montana', 'nebraska': 'Nebraska', 'nevada': 'Nevada',
  'new-hampshire': 'New Hampshire', 'new-jersey': 'New Jersey', 'new-mexico': 'New Mexico', 'new-york': 'New York',
  'north-carolina': 'North Carolina', 'north-dakota': 'North Dakota', 'ohio': 'Ohio', 'oklahoma': 'Oklahoma',
  'oregon': 'Oregon', 'pennsylvania': 'Pennsylvania', 'rhode-island': 'Rhode Island',
  'south-carolina': 'South Carolina', 'south-dakota': 'South Dakota', 'tennessee': 'Tennessee',
  'texas': 'Texas', 'utah': 'Utah', 'vermont': 'Vermont', 'virginia': 'Virginia',
  'washington': 'Washington', 'west-virginia': 'West Virginia', 'wisconsin': 'Wisconsin', 'wyoming': 'Wyoming',
};

function isCrawler(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

async function fetchStormData(slug) {
  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL');
  const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/storm_events?slug=eq.${slug}&select=title,slug,type,status,seo_title,seo_description,affected_states,og_image_url&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await res.json();
    return data?.[0] || null;
  } catch {
    return null;
  }
}

function replaceMeta(html, property, content) {
  // Handle both property="..." and name="..." attributes
  const propRegex = new RegExp(
    `(<meta\\s+(?:property|name)="${property}"\\s+content=")[^"]*"`,
    'i'
  );
  const contentFirstRegex = new RegExp(
    `(<meta\\s+content=")[^"]*("\\s+(?:property|name)="${property}")`,
    'i'
  );

  if (propRegex.test(html)) {
    return html.replace(propRegex, `$1${content}"`);
  }
  if (contentFirstRegex.test(html)) {
    return html.replace(contentFirstRegex, `$1${content}$2`);
  }
  return html;
}

export default async function handler(request, context) {
  const ua = request.headers.get('user-agent') || '';

  // Only rewrite for crawlers
  if (!isCrawler(ua)) {
    return context.next();
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Match routes
  const stormMatch = pathname.match(/^\/storm\/([a-z0-9-]+)$/);
  const alertsMatch = pathname.match(/^\/alerts\/([a-z-]+)$/);
  const isRadar = pathname === '/radar';

  if (!stormMatch && !isRadar && !alertsMatch) {
    return context.next();
  }

  // Get the original HTML response
  const response = await context.next();
  const html = await response.text();

  let ogTitle, ogDescription, ogImage, ogUrl;

  if (stormMatch) {
    const slug = stormMatch[1];
    const storm = await fetchStormData(slug);

    if (!storm) {
      // Can't find storm data, serve unmodified
      return new Response(html, {
        status: response.status,
        headers: response.headers,
      });
    }

    ogTitle =
      storm.seo_title ||
      `${storm.title} Live Radar & Alerts | StormTracking`;
    ogDescription =
      storm.seo_description ||
      `Track ${storm.title} with live weather radar and real-time severe weather alerts. Free NOAA data.`;
    ogImage = storm.og_image_url || `${BASE_URL}/api/og-image/storm/${slug}`;
    ogUrl = `${BASE_URL}/storm/${slug}`;
  } else if (alertsMatch) {
    // /alerts/:state page
    const stateSlug = alertsMatch[1];
    const stateName = SLUG_TO_STATE_NAME[stateSlug];

    if (!stateName) {
      return new Response(html, {
        status: response.status,
        headers: response.headers,
      });
    }

    ogTitle = `${stateName} Weather Alerts | Live NWS Alerts | StormTracking`;
    ogDescription = `Active weather alerts for ${stateName}. Track winter storms, severe weather, flood warnings, and more with live radar and real-time NWS data.`;
    ogImage = `${BASE_URL}/og-image.png`;
    ogUrl = `${BASE_URL}/alerts/${stateSlug}`;
  } else {
    // /radar page
    ogTitle = 'Live Weather Radar Map | Real-Time Storm Tracking | StormTracking';
    ogDescription =
      'Interactive live weather radar map for the United States. Track severe weather, storms, and precipitation in real-time with radar overlay. Free NOAA/NWS radar data.';
    ogImage = `${BASE_URL}/api/og-image/radar`;
    ogUrl = `${BASE_URL}/radar`;
  }

  // Rewrite meta tags
  let rewritten = html;

  // Title tag
  rewritten = rewritten.replace(/<title>[^<]*<\/title>/, `<title>${ogTitle}</title>`);

  // Standard meta tags
  rewritten = replaceMeta(rewritten, 'description', ogDescription);

  // Open Graph
  rewritten = replaceMeta(rewritten, 'og:title', ogTitle);
  rewritten = replaceMeta(rewritten, 'og:description', ogDescription);
  rewritten = replaceMeta(rewritten, 'og:url', ogUrl);
  rewritten = replaceMeta(rewritten, 'og:image', ogImage);

  // Twitter
  rewritten = replaceMeta(rewritten, 'twitter:title', ogTitle);
  rewritten = replaceMeta(rewritten, 'twitter:description', ogDescription);
  rewritten = replaceMeta(rewritten, 'twitter:image', ogImage);

  // Canonical URL
  rewritten = rewritten.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*/,
    `$1${ogUrl}`
  );

  return new Response(rewritten, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'content-type': 'text/html; charset=UTF-8',
    },
  });
}
