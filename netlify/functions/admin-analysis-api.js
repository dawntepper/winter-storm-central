/**
 * Admin Analysis API — password-gated read-only analytics using service role.
 * Validates ADMIN_PASSWORD against client-supplied password.
 */

const { getSupabaseAdmin } = require('./lib/supabase-admin');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

function assertAdmin(password) {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD not configured on server');
  }
  if (!password || password !== ADMIN_PASSWORD) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

function getSinceDate(dateRange) {
  const now = new Date();
  switch (dateRange) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
    default:
      return null;
  }
}

function applySince(query, column, since) {
  if (!since) return query;
  return query.gte(column, since);
}

async function fetchReturningVisitors(supabase, since) {
  const { data, error } = await supabase.rpc('admin_returning_visitor_stats', {
    p_since: since,
  });
  if (error) throw error;
  return {
    totalSessions: data?.total_sessions ?? 0,
    uniqueVisitors: data?.unique_visitors ?? 0,
    newVisitors: data?.new_visitors ?? 0,
    returningVisitors: data?.returning_visitors ?? 0,
    returningPct: data?.returning_pct ?? 0,
  };
}

function groupSearchEvents(rows, { successFilter } = {}) {
  const grouped = new Map();
  for (const row of rows || []) {
    if (successFilter != null && row.success !== successFilter) continue;

    const key = `${row.query}::${row.state_code || ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.search_count += 1;
      if (row.created_at && row.created_at > existing.last_searched) {
        existing.last_searched = row.created_at;
      }
    } else {
      grouped.set(key, {
        query: row.query,
        state_context: row.state_code,
        state_code: row.state_code,
        search_count: 1,
        last_searched: row.created_at,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.search_count - a.search_count);
}

async function fetchMissingLocationSearches(supabase, since) {
  let query = supabase
    .from('location_search_events')
    .select('query, state_code, created_at, success')
    .eq('success', false)
    .limit(5000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  return groupSearchEvents(data).slice(0, 50);
}

const LOCATION_SOURCE_BUCKETS = {
  useMyLocation: ['gps', 'use_my_location', 'geolocation'],
  citySearch: ['city'],
  zipSearch: ['zip'],
  savedLocationTap: ['saved_location'],
};

function normalizeLocationSourceType(row) {
  return String(row?.resolved_type || '').toLowerCase();
}

function bucketLocationSource(type) {
  for (const [bucket, types] of Object.entries(LOCATION_SOURCE_BUCKETS)) {
    if (types.includes(type)) return bucket;
  }
  return null;
}

async function fetchLocationSources(supabase, since) {
  let query = supabase
    .from('location_search_events')
    .select('resolved_type')
    .eq('success', true)
    .limit(10000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  const counts = {
    useMyLocation: 0,
    citySearch: 0,
    zipSearch: 0,
    savedLocationTap: 0,
  };

  for (const row of data || []) {
    const bucket = bucketLocationSource(normalizeLocationSourceType(row));
    if (bucket) counts[bucket] += 1;
  }

  return counts;
}

async function fetchLocationSearchPerformance(supabase, since) {
  const { data: stats, error: statsError } = await supabase.rpc(
    'admin_location_search_stats',
    { p_since: since }
  );
  if (statsError) throw statsError;

  let query = supabase
    .from('location_search_events')
    .select('query, state_code, success, created_at')
    .limit(5000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  const topLocations = groupSearchEvents(data, { successFilter: true }).slice(0, 20);
  const topMissing = groupSearchEvents(data, { successFilter: false }).slice(0, 20);

  return {
    totalSearches: stats?.total_searches ?? 0,
    successfulSearches: stats?.successful_searches ?? 0,
    failedSearches: stats?.failed_searches ?? 0,
    successRate: stats?.success_rate ?? 0,
    topLocations,
    topMissing,
  };
}

async function fetchCountyAlertViews(supabase, since) {
  let query = supabase
    .from('county_alert_views')
    .select('county_id, state_code, alert_count, created_at, counties(name, state_code)')
    .limit(5000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  const grouped = new Map();
  for (const row of data || []) {
    const county = row.counties;
    const key = row.county_id;
    const existing = grouped.get(key);
    if (existing) {
      existing.view_count += 1;
      if (row.alert_count != null && row.alert_count > existing.alert_count) {
        existing.alert_count = row.alert_count;
      }
      if (row.created_at > existing.last_viewed) {
        existing.last_viewed = row.created_at;
      }
    } else {
      grouped.set(key, {
        county_name: county?.name || 'Unknown',
        state_code: county?.state_code || row.state_code,
        view_count: 1,
        alert_count: row.alert_count ?? 0,
        last_viewed: row.created_at,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 30);
}

const FUNNEL_DEFINITIONS = {
  alerts_to_save: [
    'homepage_view',
    'state_alert_page_view',
    'location_change',
    'radar_view',
    'save_location',
  ],
  radar_to_forecast: [
    'homepage_view',
    'radar_view',
    'location_change',
    'forecast_view',
  ],
  county_to_radar: [
    'state_alert_page_view',
    'location_search_success',
    'county_alert_view',
    'radar_view',
  ],
};

async function fetchRadarEngagement(supabase, since) {
  const { data, error } = await supabase.rpc('admin_radar_engagement_stats', {
    p_since: since,
  });
  if (error) throw error;
  return {
    totalOpens: data?.totalOpens ?? 0,
    opensByState: data?.opensByState ?? [],
    topRadarTypes: data?.topRadarTypes ?? [],
    topLocations: data?.topLocations ?? [],
  };
}

async function fetchUserJourneys(supabase, since) {
  const funnelEntries = await Promise.all(
    Object.entries(FUNNEL_DEFINITIONS).map(async ([id, steps]) => {
      const { data, error } = await supabase.rpc('admin_product_funnel_stats', {
        p_since: since,
        p_steps: steps,
      });
      if (error) throw error;
      return [id, { ...data, steps }];
    })
  );

  const { data: topPaths, error: pathsError } = await supabase.rpc(
    'admin_top_journey_paths',
    { p_since: since, p_limit: 10 }
  );
  if (pathsError) throw pathsError;

  return {
    funnels: Object.fromEntries(funnelEntries),
    topPaths: topPaths ?? [],
  };
}

async function fetchSavedLocations(supabase, since) {
  const { data: stats, error: statsError } = await supabase.rpc(
    'admin_saved_location_stats',
    { p_since: since }
  );
  if (statsError) throw statsError;

  let query = supabase
    .from('user_locations')
    .select('created_at, locations(name, state)')
    .limit(5000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  const topMap = new Map();
  for (const row of data || []) {
    const loc = row.locations;
    const key = `${loc?.name || 'Unknown'}::${loc?.state || ''}`;
    const existing = topMap.get(key);
    if (existing) {
      existing.save_count += 1;
      if (row.created_at > existing.last_saved) {
        existing.last_saved = row.created_at;
      }
    } else {
      topMap.set(key, {
        location_name: loc?.name || 'Unknown',
        state: loc?.state,
        save_count: 1,
        last_saved: row.created_at,
      });
    }
  }

  const topLocations = Array.from(topMap.values())
    .sort((a, b) => b.save_count - a.save_count)
    .slice(0, 20);

  return {
    totalSaved: stats?.total_saved ?? 0,
    signedInUsers: stats?.signed_in_users ?? 0,
    topLocations,
    note: 'Saved locations are stored for signed-in users only. Anonymous localStorage saves are not tracked in Supabase.',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    assertAdmin(body.password);

    if (body.action === 'validate') {
      return jsonResponse(200, { ok: true });
    }

    const dateRange = body.dateRange || '7d';
    const since = getSinceDate(dateRange);
    const supabase = getSupabaseAdmin();

    const [
      returningVisitors,
      missingLocationSearches,
      locationSearch,
      locationSources,
      countyAlertViews,
      savedLocations,
      radar,
      userJourneys,
    ] = await Promise.all([
      fetchReturningVisitors(supabase, since),
      fetchMissingLocationSearches(supabase, since),
      fetchLocationSearchPerformance(supabase, since),
      fetchLocationSources(supabase, since),
      fetchCountyAlertViews(supabase, since),
      fetchSavedLocations(supabase, since),
      fetchRadarEngagement(supabase, since),
      fetchUserJourneys(supabase, since),
    ]);

    return jsonResponse(200, {
      dateRange,
      since,
      returningVisitors,
      missingLocationSearches,
      locationSearch,
      locationSources,
      countyAlertViews,
      savedLocations,
      radar,
      userJourneys,
    });
  } catch (err) {
    console.error('admin-analysis-api error:', err);
    const status = err.statusCode || 500;
    const message =
      err.statusCode === 401 ? err.message : err.message || 'Internal error';
    return jsonResponse(status, { error: message });
  }
};
