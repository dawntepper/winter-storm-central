/**
 * Shared storm loader for prerender, sitemap, and IndexNow build scripts.
 * Merges src/content/storms/*.json with live Supabase rows (status=live).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STORMS_DIR = path.join(ROOT, 'src', 'content', 'storms');

function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;
  return { url, key };
}

function loadJsonStorms() {
  if (!fs.existsSync(STORMS_DIR)) return [];
  return fs
    .readdirSync(STORMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const filePath = path.join(STORMS_DIR, f);
      const storm = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        ...storm,
        _source: 'json',
        _updated_at: fs.statSync(filePath).mtime.toISOString(),
        _content: storm.content || {},
      };
    });
}

/** Convert a live Supabase storms row to the JSON shape prerender scripts expect. */
function dbRowToJsonStorm(row) {
  const content = row.content || {};
  const mapCenter = content.map_center || content.mapCenter || {};
  const publicStatus = content.public_status || content.publicStatus || 'active';
  return {
    slug: row.slug,
    title: row.title,
    type: row.storm_type,
    type_label: content.type_label || content.typeLabel || row.storm_type,
    status: row.status === 'archived' ? 'completed' : publicStatus,
    start_date: row.start_date,
    end_date: row.end_date,
    description: row.summary || content.description || '',
    impacts: content.impacts || [],
    affected_states: content.affected_states || content.affectedStates || [],
    alert_categories: content.alert_categories || content.alertCategories || [],
    map_center: {
      latitude: mapCenter.latitude ?? mapCenter.lat ?? 39,
      longitude: mapCenter.longitude ?? mapCenter.lon ?? -98,
      zoom: mapCenter.zoom ?? 5,
    },
    seo: {
      title: row.seo_title || content.seo_title || '',
      description: row.seo_description || content.seo_description || '',
      og_image_url: content.og_image_url || content.ogImageUrl || '',
      keywords: content.keywords || [],
    },
    peak_alert_count: content.peak_alert_count ?? content.peakAlertCount ?? null,
    total_alerts_issued: content.total_alerts_issued ?? content.totalAlertsIssued ?? null,
    show_emergency_info_panel:
      content.show_emergency_info_panel ?? content.showEmergencyInfoPanel ?? false,
    emergency_summary: row.emergency_summary || content.emergency_summary || null,
    location_label: row.location_label || content.location_label || null,
    _source: 'db',
    _updated_at: row.updated_at || row.published_at || null,
    _content: content,
  };
}

async function fetchLiveStormRows() {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/storms?status=eq.live&select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      console.warn('Supabase storms fetch failed:', res.status, await res.text());
      return [];
    }
    const rows = await res.json();
    return rows || [];
  } catch (err) {
    console.warn('Supabase storms fetch error:', err.message);
    return [];
  }
}

async function loadLiveStormsFromSupabase() {
  const rows = await fetchLiveStormRows();
  return rows.map(dbRowToJsonStorm);
}

/**
 * Merged storm list (JSON + live DB; DB wins on slug collision).
 */
async function loadStorms() {
  const jsonStorms = loadJsonStorms();
  const dbStorms = await loadLiveStormsFromSupabase();
  const bySlug = new Map(jsonStorms.filter((s) => s.slug).map((s) => [s.slug, s]));
  for (const storm of dbStorms) {
    if (storm.slug) bySlug.set(storm.slug, storm);
  }
  return [...bySlug.values()];
}

/**
 * Storms plus lastmod map keyed by slug (DB updated_at preferred over JSON mtime).
 */
async function loadStormsWithMeta() {
  const jsonStorms = loadJsonStorms();
  const dbRows = await fetchLiveStormRows();
  const dbStorms = dbRows.map(dbRowToJsonStorm);

  const bySlug = new Map(jsonStorms.filter((s) => s.slug).map((s) => [s.slug, s]));
  const lastmodBySlug = new Map(
    jsonStorms.filter((s) => s.slug).map((s) => [s.slug, s._updated_at])
  );

  for (const storm of dbStorms) {
    if (!storm.slug) continue;
    bySlug.set(storm.slug, storm);
    if (storm._updated_at) lastmodBySlug.set(storm.slug, storm._updated_at);
  }

  return {
    storms: [...bySlug.values()],
    lastmodBySlug,
  };
}

module.exports = {
  ROOT,
  STORMS_DIR,
  getSupabaseCredentials,
  loadJsonStorms,
  dbRowToJsonStorm,
  fetchLiveStormRows,
  loadLiveStormsFromSupabase,
  loadStorms,
  loadStormsWithMeta,
};
