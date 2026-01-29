// Netlify serverless function to generate dynamic sitemap.xml
// Fetches all storm events from Supabase and builds XML sitemap

const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'https://stormtracking.io';

function generateSitemap(storms) {
  const now = new Date().toISOString();

  const stormUrls = storms.map(storm => {
    const changefreq = storm.status === 'active' ? 'hourly' :
                       storm.status === 'forecasted' ? 'daily' : 'monthly';
    const priority = storm.status === 'active' ? '0.9' :
                     storm.status === 'forecasted' ? '0.8' : '0.6';
    const lastmod = storm.updated_at ? new Date(storm.updated_at).toISOString() : now;

    return `  <url>
    <loc>${BASE_URL}/storm/${storm.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${stormUrls}
</urlset>`;
}

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600'
  };

  try {
    let storms = [];

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('storm_events')
        .select('slug, status, updated_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        storms = data;
      } else {
        console.error('Supabase error fetching storms for sitemap:', error);
      }
    } else {
      console.warn('Supabase not configured for sitemap generation');
    }

    return {
      statusCode: 200,
      headers,
      body: generateSitemap(storms)
    };
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return a minimal sitemap with just the homepage
    return {
      statusCode: 200,
      headers,
      body: generateSitemap([])
    };
  }
};
