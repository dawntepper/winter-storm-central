/**
 * Admin Analysis API — password-gated read-only analytics using service role.
 * Validates ADMIN_PASSWORD against client-supplied password.
 */

const { getSupabaseAdmin } = require('./lib/supabase-admin');
const {
  callHaikuForJSON,
  describeAnthropicKeyConfig,
} = require('./lib/haiku-client');
const {
  buildAnalysisPayload,
  MORNING_BRIEF_SYSTEM,
  MORNING_BRIEF_SYSTEM_COMPACT,
  OPERATIONS_CENTER_SYSTEM,
  OPERATIONS_CENTER_SYSTEM_COMPACT,
  buildMorningBriefPrompt,
  buildOperationsCenterPrompt,
} = require('./lib/analysis-ai-payload');
const {
  computeTrend,
  getPreviousPeriodBounds,
} = require('../../shared/admin-metric-trends');

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

const PERIOD_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  all: 'All Time',
};

function getSinceDate(dateRange) {
  const now = new Date();
  switch (dateRange) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case 'yesterday': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 1);
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

function applyUntil(query, column, until) {
  if (!until) return query;
  return query.lt(column, until);
}

function applyPeriod(query, column, since, until) {
  let q = applySince(query, column, since);
  q = applyUntil(q, column, until);
  return q;
}

async function countRowsSince(supabase, table, since) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  query = applySince(query, 'created_at', since);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function fetchAnalyticsHealth(supabase) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const anthropic = describeAnthropicKeyConfig();

  const [visitorCount, radarCount, searchCount, countyCount] = await Promise.all([
    countRowsSince(supabase, 'visitor_sessions', since24h),
    countRowsSince(supabase, 'radar_events', since24h),
    countRowsSince(supabase, 'location_search_events', since24h),
    countRowsSince(supabase, 'county_alert_views', since24h),
  ]);

  const checks = [
    {
      id: 'visitor_tracking',
      label: 'Visitor tracking',
      count: visitorCount,
      status: visitorCount > 0 ? 'healthy' : 'warning',
      message:
        visitorCount > 0
          ? `${visitorCount.toLocaleString()} sessions in last 24h`
          : 'No visitor sessions recorded in the last 24 hours',
    },
    {
      id: 'radar_events',
      label: 'Radar events',
      count: radarCount,
      status: radarCount > 0 ? 'healthy' : 'warning',
      message:
        radarCount > 0
          ? `${radarCount.toLocaleString()} radar events in last 24h`
          : 'No radar events recorded in the last 24 hours',
    },
    {
      id: 'location_searches',
      label: 'Location searches',
      count: searchCount,
      status: searchCount > 0 ? 'healthy' : 'warning',
      message:
        searchCount > 0
          ? `${searchCount.toLocaleString()} searches in last 24h`
          : 'No location searches recorded in the last 24 hours',
    },
    {
      id: 'county_alert_views',
      label: 'County alert views',
      count: countyCount,
      status: countyCount > 0 ? 'healthy' : 'warning',
      message:
        countyCount > 0
          ? `${countyCount.toLocaleString()} county views in last 24h`
          : 'No county alert views recorded in the last 24 hours',
    },
    {
      id: 'morning_brief',
      label: 'AI Morning Brief',
      count: null,
      status: anthropic.configured && anthropic.looksValid ? 'healthy' : 'issue',
      message:
        anthropic.configured && anthropic.looksValid
          ? 'Anthropic API key configured for brief generation'
          : 'Anthropic API key missing or invalid — Morning Brief will fail',
    },
  ];

  const issueCount = checks.filter((c) => c.status === 'issue').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  let overall = 'healthy';
  if (issueCount > 0) overall = 'issue';
  else if (warningCount > 0) overall = 'warning';

  return { overall, checks, checkedAt: new Date().toISOString() };
}

async function fetchPreviousPeriodMetrics(supabase, dateRange) {
  const bounds = getPreviousPeriodBounds(dateRange);
  if (!bounds) return null;

  const { since, until } = bounds;

  let visitorQuery = supabase
    .from('visitor_sessions')
    .select('*', { count: 'exact', head: true });
  visitorQuery = applyPeriod(visitorQuery, 'created_at', since, until);

  let searchQuery = supabase
    .from('location_search_events')
    .select('*', { count: 'exact', head: true });
  searchQuery = applyPeriod(searchQuery, 'created_at', since, until);

  let saveQuery = supabase
    .from('user_locations')
    .select('*', { count: 'exact', head: true });
  saveQuery = applyPeriod(saveQuery, 'created_at', since, until);

  let countyQuery = supabase
    .from('county_alert_views')
    .select('*', { count: 'exact', head: true });
  countyQuery = applyPeriod(countyQuery, 'created_at', since, until);

  let forecastClicksQuery = supabase
    .from('product_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'forecast_link_click');
  forecastClicksQuery = applyPeriod(forecastClicksQuery, 'created_at', since, until);

  const [
    visitorsRes,
    searchesRes,
    savesRes,
    countiesRes,
    forecastClicksRes,
    radarRes,
    returningRes,
    searchStatsRes,
  ] = await Promise.all([
    visitorQuery,
    searchQuery,
    saveQuery,
    countyQuery,
    forecastClicksQuery,
    supabase.rpc('admin_radar_engagement_stats', { p_since: since, p_until: until }),
    supabase.rpc('admin_returning_visitor_stats', { p_since: since, p_until: until }),
    supabase.rpc('admin_location_search_stats', { p_since: since, p_until: until }),
  ]);

  if (visitorsRes.error) throw visitorsRes.error;
  if (searchesRes.error) throw searchesRes.error;
  if (savesRes.error) throw savesRes.error;
  if (countiesRes.error) throw countiesRes.error;
  if (forecastClicksRes.error) throw forecastClicksRes.error;
  if (radarRes.error) throw radarRes.error;
  if (returningRes.error) throw returningRes.error;
  if (searchStatsRes.error) throw searchStatsRes.error;

  return {
    radarOpens: radarRes.data?.totalOpens ?? 0,
    forecastClicks: forecastClicksRes.count ?? 0,
    returningVisitors: returningRes.data?.returning_visitors ?? 0,
    locationSearches: searchesRes.count ?? 0,
    savedLocations: savesRes.count ?? 0,
    countyAlertViews: countiesRes.count ?? 0,
    totalSessions: visitorsRes.count ?? 0,
    uniqueVisitors: returningRes.data?.unique_visitors ?? 0,
    returningPct: returningRes.data?.returning_pct ?? 0,
    searchSuccessRate: searchStatsRes.data?.success_rate ?? 0,
  };
}

function buildMetricTrends(current, previous) {
  if (!previous) {
    return {
      radarOpens: null,
      returningVisitors: null,
      locationSearches: null,
      savedLocations: null,
      countyAlertViews: null,
      totalSessions: null,
      uniqueVisitors: null,
      returningPct: null,
      searchSuccessRate: null,
      forecastClicks: null,
    };
  }

  return {
    radarOpens: computeTrend(current.radarOpens, previous.radarOpens),
    forecastClicks: computeTrend(current.forecastClicks, previous.forecastClicks),
    returningVisitors: computeTrend(
      current.returningVisitors,
      previous.returningVisitors
    ),
    locationSearches: computeTrend(
      current.locationSearches,
      previous.locationSearches
    ),
    savedLocations: computeTrend(
      current.savedLocations,
      previous.savedLocations
    ),
    countyAlertViews: computeTrend(
      current.countyAlertViews,
      previous.countyAlertViews
    ),
    totalSessions: computeTrend(current.totalSessions, previous.totalSessions),
    uniqueVisitors: computeTrend(current.uniqueVisitors, previous.uniqueVisitors),
    returningPct: computeTrend(current.returningPct, previous.returningPct),
    searchSuccessRate: computeTrend(
      current.searchSuccessRate,
      previous.searchSuccessRate
    ),
  };
}

function suggestExpansionAction(row) {
  const query = String(row.query || row.label || '').toLowerCase();
  const state = row.state || row.state_context || row.state_code;
  if (query.includes('county') || query.includes(' co')) {
    return 'Expand county coverage';
  }
  if (query.includes('forecast') || query.includes('weather')) {
    return 'Add forecast link';
  }
  return 'Add city page';
}

function generateExpansionOpportunities({
  missingLocationSearches,
  locationSearch,
  countyAlertViews,
  locationSources,
  cityDemand,
}) {
  const failedSearches = (missingLocationSearches?.searches || []).slice(0, 10).map((row) => ({
    query: row.query,
    state: row.state_context || row.state_code || null,
    searchCount: row.search_count,
    lastSearched: row.last_searched,
    suggestion: suggestExpansionAction(row),
  }));

  const topCities = (missingLocationSearches?.recommendedCities || [])
    .slice(0, 8)
    .map((city) => ({
      ...city,
      suggestion: suggestExpansionAction(city),
    }));

  const topSuccessfulCities = (locationSearch?.topLocations || [])
    .slice(0, 5)
    .map((row) => ({
      query: row.query,
      state: row.state_code || null,
      searchCount: row.search_count,
    }));

  const lowTrafficCounties = (countyAlertViews?.topViewed || [])
    .filter((c) => c.view_count <= 2)
    .slice(0, 5)
    .map((row) => ({
      county: row.county_name,
      state: row.state_code,
      views: row.view_count,
      suggestion: 'Promote county alerts on state page',
    }));

  return {
    totalFailed: missingLocationSearches?.totalFailed ?? 0,
    failedSearches,
    topCities,
    topSuccessfulCities,
    lowTrafficCounties,
    citySearchCount: locationSources?.citySearch ?? 0,
    countySearchCount: locationSources?.countySearch ?? 0,
    totalCountyViews: countyAlertViews?.totalViews ?? 0,
    cityDemand: (cityDemand?.topDemand || []).slice(0, 12).map((row) => ({
      label: `${row.city_name}, ${row.state_code}`,
      cityName: row.city_name,
      stateCode: row.state_code,
      searchCount: row.search_count ?? 0,
      saveCount: row.save_count ?? 0,
      totalDemand: row.total_demand ?? ((row.search_count ?? 0) + (row.save_count ?? 0)),
      inCatalog: row.in_catalog ?? false,
      citySource: row.city_source || (row.in_catalog ? 'catalog' : 'missing'),
      hasStaticPage: row.has_static_page ?? false,
      slug: row.slug || null,
      lastSource: row.last_source || null,
      lastRequestedAt: row.last_requested_at || null,
      promotable: ((row.search_count ?? 0) + (row.save_count ?? 0)) >= 25,
      suggestion: row.in_catalog
        ? (row.has_static_page ? 'Has static page' : 'Promote to static page')
        : 'Auto-create pending / verify geocode',
    })),
    totalCityDemandRows: cityDemand?.total_rows ?? 0,
  };
}

function computeReturningVisitorExtras(dailyBreakdown, returningPct) {
  const days = dailyBreakdown || [];
  const daysWithPct = days.map((d) => {
    const total = d.newVisitors + d.returningVisitors;
    return {
      ...d,
      returningPct:
        total > 0
          ? Math.round((100 * d.returningVisitors) / total * 10) / 10
          : 0,
    };
  });

  const avgReturningPct =
    daysWithPct.length > 0
      ? Math.round(
          (daysWithPct.reduce((sum, d) => sum + d.returningPct, 0) /
            daysWithPct.length) *
            10
        ) / 10
      : returningPct ?? 0;

  const highestReturningDay = daysWithPct.reduce(
    (best, d) => (!best || d.returningPct > best.returningPct ? d : best),
    null
  );

  let returningTrend = { direction: 'flat', changePct: 0 };
  if (daysWithPct.length >= 4) {
    const mid = Math.floor(daysWithPct.length / 2);
    const firstHalf = daysWithPct.slice(0, mid);
    const secondHalf = daysWithPct.slice(mid);
    const avgFirst =
      firstHalf.reduce((sum, d) => sum + d.returningPct, 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((sum, d) => sum + d.returningPct, 0) / secondHalf.length;
    const change = Math.round((avgSecond - avgFirst) * 10) / 10;
    returningTrend = {
      direction: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
      changePct: change,
    };
  }

  return { avgReturningPct, highestReturningDay, returningTrend };
}

async function fetchReturningVisitors(supabase, since) {
  const { data, error } = await supabase.rpc('admin_returning_visitor_stats', {
    p_since: since,
  });
  if (error) throw error;

  let dailyQuery = supabase
    .from('visitor_sessions')
    .select('created_at, is_returning')
    .order('created_at', { ascending: true })
    .limit(10000);
  dailyQuery = applySince(dailyQuery, 'created_at', since);
  const { data: sessions, error: dailyError } = await dailyQuery;
  if (dailyError) throw dailyError;

  const dayMap = new Map();
  for (const row of sessions || []) {
    const day = row.created_at?.slice(0, 10);
    if (!day) continue;
    const existing = dayMap.get(day) || {
      day,
      newVisitors: 0,
      returningVisitors: 0,
    };
    if (row.is_returning) {
      existing.returningVisitors += 1;
    } else {
      existing.newVisitors += 1;
    }
    dayMap.set(day, existing);
  }

  const dailyBreakdown = Array.from(dayMap.values()).sort((a, b) =>
    a.day.localeCompare(b.day)
  );

  const returningPct = data?.returning_pct ?? 0;
  const extras = computeReturningVisitorExtras(dailyBreakdown, returningPct);

  return {
    totalSessions: data?.total_sessions ?? 0,
    uniqueVisitors: data?.unique_visitors ?? 0,
    newVisitors: data?.new_visitors ?? 0,
    returningVisitors: data?.returning_visitors ?? 0,
    returningPct,
    dailyBreakdown,
    ...extras,
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

function buildRecommendedCities(searches) {
  return (searches || []).slice(0, 8).map((row) => {
    const state = row.state_context || row.state_code;
    const label = state ? `${row.query}, ${state}` : row.query;
    return {
      label,
      query: row.query,
      state: state || null,
      searchCount: row.search_count,
    };
  });
}

function normalizeMissingSearchKey(query, stateCode) {
  return `${String(query || '').trim().toLowerCase()}::${String(stateCode || '').trim().toUpperCase()}`;
}

const DISMISSED_MISSING_SEARCHES_MIGRATION_HINT =
  'Apply supabase/migrations/016_dismissed_missing_searches_and_rpc_until.sql in the Supabase SQL editor (or run migration 016 via Supabase CLI).';

function isDismissedMissingSearchesTableMissing(error) {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return String(error.message || '').includes('dismissed_missing_searches');
}

async function fetchDismissedMissingSearchKeys(supabase) {
  const { data, error } = await supabase
    .from('dismissed_missing_searches')
    .select('query, state_code');
  if (error) {
    if (isDismissedMissingSearchesTableMissing(error)) {
      console.warn(
        'dismissed_missing_searches table not found; expansion dismissals disabled until migration 016 is applied'
      );
      return new Set();
    }
    throw error;
  }
  return new Set(
    (data || []).map((row) => normalizeMissingSearchKey(row.query, row.state_code))
  );
}

function filterDismissedMissingSearches(rows, dismissedKeys) {
  if (!dismissedKeys?.size) return rows;
  return (rows || []).filter(
    (row) =>
      !dismissedKeys.has(
        normalizeMissingSearchKey(row.query, row.state_context || row.state_code)
      )
  );
}

async function dismissMissingSearch(supabase, { query, stateCode }) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedState = String(stateCode || '').trim().toUpperCase();
  if (!normalizedQuery) {
    const err = new Error('query is required');
    err.statusCode = 400;
    throw err;
  }

  const { error } = await supabase.from('dismissed_missing_searches').upsert(
    {
      query: normalizedQuery,
      state_code: normalizedState,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: 'query,state_code' }
  );
  if (error) {
    if (isDismissedMissingSearchesTableMissing(error)) {
      const err = new Error(
        `Dismiss is unavailable until migration 016 is applied. ${DISMISSED_MISSING_SEARCHES_MIGRATION_HINT}`
      );
      err.statusCode = 503;
      throw err;
    }
    throw error;
  }
  return { ok: true };
}

async function fetchMissingLocationSearches(supabase, since) {
  const dismissedKeys = await fetchDismissedMissingSearchKeys(supabase);
  let rows;

  // missing_location_searches view groups failed searches by query + state_code.
  // Apply date filter on base table when a range is selected (view is all-time).
  if (since) {
    let query = supabase
      .from('location_search_events')
      .select('query, state_code, created_at, success')
      .eq('success', false)
      .limit(5000);
    query = applySince(query, 'created_at', since);
    const { data, error } = await query;
    if (error) throw error;
    rows = groupSearchEvents(data).slice(0, 50);
  } else {
    const { data, error } = await supabase
      .from('missing_location_searches')
      .select('query, state_context, search_count, last_searched')
      .limit(50);
    if (error) throw error;

    rows = (data || []).map((row) => ({
      query: row.query,
      state_context: row.state_context,
      state_code: row.state_context,
      search_count: Number(row.search_count) || 0,
      last_searched: row.last_searched,
    }));
  }

  rows = filterDismissedMissingSearches(rows, dismissedKeys);

  return {
    searches: rows,
    totalFailed: rows.reduce((sum, r) => sum + (r.search_count || 0), 0),
    recommendedCities: buildRecommendedCities(rows),
  };
}

async function fetchCityDemand(supabase, since) {
  const { data, error } = await supabase.rpc('admin_city_demand_stats', {
    p_since: since,
  });
  if (error) throw error;
  return {
    total_rows: data?.total_rows ?? 0,
    topDemand: Array.isArray(data?.topDemand) ? data.topDemand : [],
  };
}

const LOCATION_SOURCE_BUCKETS = {
  useMyLocation: ['gps', 'use_my_location', 'geolocation'],
  citySearch: ['city'],
  countySearch: ['county'],
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

const SEARCH_SOURCE_BUCKETS = {
  Homepage: ['homepage', 'homepage-hero', 'homepage-saved-locations'],
  'Radar Page': ['radar', 'radar-hero', 'radar-compact'],
  'County Page': ['county-page', 'county-page-search', 'state-page-search'],
};

function bucketSearchSourcePage(sourcePage) {
  const normalized = String(sourcePage || '').toLowerCase().trim();
  if (!normalized) return 'Other';

  for (const [bucket, values] of Object.entries(SEARCH_SOURCE_BUCKETS)) {
    if (values.includes(normalized)) return bucket;
    if (bucket === 'Homepage' && normalized.startsWith('homepage')) return bucket;
    if (bucket === 'Radar Page' && normalized.startsWith('radar')) return bucket;
    if (bucket === 'County Page' && normalized.includes('county')) return bucket;
  }

  // State slugs (legacy) and merged-card search sources
  if (/^state_search_(zip|city|county)$/.test(normalized)) {
    return 'State Page';
  }
  if (/^[a-z][a-z-]+$/.test(normalized) && !normalized.includes('page')) {
    return 'State Page';
  }

  return 'Other';
}

const LOCATION_PREFERENCE_META = [
  { key: 'useMyLocation', label: 'Use My Location (GPS)' },
  { key: 'citySearch', label: 'City Search' },
  { key: 'zipSearch', label: 'ZIP Search' },
  { key: 'countySearch', label: 'County Search' },
  { key: 'savedLocationTap', label: 'Saved Location Clicks' },
];

async function fetchLocationSourceCounts(supabase, since, until = null) {
  let query = supabase
    .from('location_search_events')
    .select('resolved_type')
    .eq('success', true)
    .limit(10000);

  query = applyPeriod(query, 'created_at', since, until);

  const { data, error } = await query;
  if (error) throw error;

  const counts = {
    useMyLocation: 0,
    citySearch: 0,
    countySearch: 0,
    zipSearch: 0,
    savedLocationTap: 0,
  };

  for (const row of data || []) {
    const bucket = bucketLocationSource(normalizeLocationSourceType(row));
    if (bucket) counts[bucket] += 1;
  }

  return counts;
}

async function fetchLocationSources(supabase, since) {
  return fetchLocationSourceCounts(supabase, since);
}

function buildLocationPreferenceSources(counts, previousCounts) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const sources = LOCATION_PREFERENCE_META.map(({ key, label }) => {
    const count = counts[key] ?? 0;
    const pct = total > 0 ? Math.round((100 * count) / total * 10) / 10 : 0;
    const trend = previousCounts
      ? computeTrend(count, previousCounts[key] ?? 0)
      : null;
    return { key, label, count, pct, trend };
  }).sort((a, b) => b.count - a.count);

  return { total, sources };
}

function buildLocationPreferenceFallback(sources, total) {
  if (total === 0) {
    return 'No location interactions recorded in this period.';
  }

  const byKey = Object.fromEntries(sources.map((s) => [s.key, s]));
  const cityPct = byKey.citySearch?.pct ?? 0;
  const countyPct = byKey.countySearch?.pct ?? 0;
  const zipPct = byKey.zipSearch?.pct ?? 0;
  const gpsPct = byKey.useMyLocation?.pct ?? 0;
  const savedPct = byKey.savedLocationTap?.pct ?? 0;

  const parts = [];

  if (cityPct > countyPct * 2 && cityPct >= 25) {
    parts.push(
      `Users strongly prefer city search (${cityPct}%) over county search (${countyPct}%) — suggests cities are the default mental model for location.`
    );
  } else if (countyPct > cityPct && countyPct >= 15) {
    parts.push(
      `County search (${countyPct}%) leads city search (${cityPct}%) — users may already think in county terms.`
    );
  } else {
    parts.push(
      `City search is ${cityPct}% of location changes vs ${countyPct}% for county — mixed preference.`
    );
  }

  if (zipPct >= 20) {
    parts.push(`ZIP search is heavily used at ${zipPct}%.`);
  }
  if (gpsPct >= 20) {
    parts.push(`"Use My Location" (GPS) accounts for ${gpsPct}% of changes.`);
  }
  if (savedPct >= 15) {
    parts.push(`Saved location clicks drive ${savedPct}% of interactions.`);
  }

  return parts.join(' ');
}

async function generateLocationPreferenceInsight(sources, total) {
  const fallback = buildLocationPreferenceFallback(sources, total);
  const anthropic = describeAnthropicKeyConfig();
  if (!anthropic.configured || !anthropic.looksValid || total === 0) {
    return { blurb: fallback, generatedBy: 'rule-based' };
  }

  const summary = sources.map((s) => ({
    source: s.label,
    count: s.count,
    pct: s.pct,
  }));

  try {
    const haikuResult = await callHaikuForJSON({
      systemPrompt: `You analyze location preference for a storm-tracking admin dashboard.
Return ONLY JSON: { "blurb": string } — one or two sentences under 200 chars on whether users prefer cities vs counties, ZIP, GPS, or saved locations. No PII.`,
      userPrompt: `Location preference (${total} total interactions): ${JSON.stringify(summary)}. Write the blurb JSON.`,
      maxTokens: 200,
    });

    if (haikuResult.parsed?.blurb) {
      return { blurb: haikuResult.parsed.blurb, generatedBy: haikuResult.model };
    }
  } catch (err) {
    console.warn('Location preference insight generation failed:', err.message);
  }

  return { blurb: fallback, generatedBy: 'rule-based' };
}

async function fetchLocationPreference(supabase, dateRange) {
  const since = getSinceDate(dateRange);
  const bounds = getPreviousPeriodBounds(dateRange);

  const [currentCounts, previousCounts] = await Promise.all([
    fetchLocationSourceCounts(supabase, since),
    bounds
      ? fetchLocationSourceCounts(supabase, bounds.since, bounds.until)
      : Promise.resolve(null),
  ]);

  const { total, sources } = buildLocationPreferenceSources(
    currentCounts,
    previousCounts
  );
  const insight = await generateLocationPreferenceInsight(sources, total);

  return { total, sources, insight };
}

async function fetchCountyDiscoveryMetrics(supabase, since, until = null) {
  let stateQuery = supabase
    .from('product_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'state_alert_page_view');
  stateQuery = applyPeriod(stateQuery, 'created_at', since, until);

  let countySearchQuery = supabase
    .from('location_search_events')
    .select('*', { count: 'exact', head: true })
    .eq('resolved_type', 'county');
  countySearchQuery = applyPeriod(countySearchQuery, 'created_at', since, until);

  let countyPageQuery = supabase
    .from('product_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'county_alert_view');
  countyPageQuery = applyPeriod(countyPageQuery, 'created_at', since, until);

  let countyAlertQuery = supabase
    .from('county_alert_views')
    .select('*', { count: 'exact', head: true });
  countyAlertQuery = applyPeriod(countyAlertQuery, 'created_at', since, until);

  const [stateRes, searchRes, pageRes, alertRes] = await Promise.all([
    stateQuery,
    countySearchQuery,
    countyPageQuery,
    countyAlertQuery,
  ]);

  if (stateRes.error) throw stateRes.error;
  if (searchRes.error) throw searchRes.error;
  if (pageRes.error) throw pageRes.error;
  if (alertRes.error) throw alertRes.error;

  return {
    statePageViews: stateRes.count ?? 0,
    countySearchAttempts: searchRes.count ?? 0,
    countyPageViews: pageRes.count ?? 0,
    countyAlertViews: alertRes.count ?? 0,
  };
}

function buildCountyDiscoveryFunnel(metrics) {
  const steps = [
    { step: 1, eventName: 'State Page Views', sessions: metrics.statePageViews },
    {
      step: 2,
      eventName: 'County Search Attempts',
      sessions: metrics.countySearchAttempts,
    },
    { step: 3, eventName: 'County Page Views', sessions: metrics.countyPageViews },
    {
      step: 4,
      eventName: 'County Alert Views',
      sessions: metrics.countyAlertViews,
    },
  ];

  const base = steps[0].sessions || 1;

  return steps.map((s, i) => {
    const prevSessions = i === 0 ? s.sessions : steps[i - 1].sessions;
    const dropoffPct =
      i === 0
        ? 0
        : prevSessions > 0
          ? Math.round((1 - s.sessions / prevSessions) * 1000) / 10
          : 0;
    const completionPct =
      base > 0 ? Math.round((s.sessions / base) * 1000) / 10 : 0;
    return { ...s, completionPct, dropoffPct };
  });
}

function buildCountyDiscoveryConclusion(metrics) {
  const { statePageViews, countySearchAttempts, countyPageViews } = metrics;

  if (statePageViews < 5) {
    return {
      code: 'insufficient_data',
      blurb:
        'Not enough state page traffic to assess county discovery patterns in this period.',
    };
  }

  const searchRate =
    statePageViews > 0 ? countySearchAttempts / statePageViews : 0;
  const pageReachRate =
    countySearchAttempts > 0 ? countyPageViews / countySearchAttempts : 0;

  const LOW_SEARCH_RATE = 0.05;
  const LOW_PAGE_REACH = 0.35;

  if (searchRate < LOW_SEARCH_RATE) {
    return {
      code: 'not_attempting',
      blurb:
        'Users are not attempting county workflows — county searches are low relative to state page views.',
      searchRatePct: Math.round(searchRate * 1000) / 10,
      pageReachPct: Math.round(pageReachRate * 1000) / 10,
    };
  }

  if (pageReachRate < LOW_PAGE_REACH) {
    return {
      code: 'abandoning',
      blurb:
        'Users are attempting county workflows but abandoning before reaching county pages.',
      searchRatePct: Math.round(searchRate * 1000) / 10,
      pageReachPct: Math.round(pageReachRate * 1000) / 10,
    };
  }

  return {
    code: 'healthy',
    blurb:
      'County discovery funnel looks healthy — users who search for counties often reach county pages.',
    searchRatePct: Math.round(searchRate * 1000) / 10,
    pageReachPct: Math.round(pageReachRate * 1000) / 10,
  };
}

async function generateCountyDiscoveryInsight(metrics, conclusion) {
  const fallback = conclusion.blurb;
  const anthropic = describeAnthropicKeyConfig();
  if (!anthropic.configured || !anthropic.looksValid) {
    return { ...conclusion, generatedBy: 'rule-based' };
  }

  try {
    const haikuResult = await callHaikuForJSON({
      systemPrompt: `You analyze county discovery funnels for a storm admin dashboard.
Return ONLY JSON: { "blurb": string } — one sentence under 180 chars distinguishing:
(A) users not attempting county workflows vs (B) attempting but abandoning before county pages.
Use the provided conclusion code as guidance. No PII.`,
      userPrompt: `Funnel: state views=${metrics.statePageViews}, county searches=${metrics.countySearchAttempts}, county pages=${metrics.countyPageViews}, county alert views=${metrics.countyAlertViews}. Rule conclusion: ${conclusion.code} — "${fallback}". Write blurb JSON.`,
      maxTokens: 200,
    });

    if (haikuResult.parsed?.blurb) {
      return {
        ...conclusion,
        blurb: haikuResult.parsed.blurb,
        generatedBy: haikuResult.model,
      };
    }
  } catch (err) {
    console.warn('County discovery insight generation failed:', err.message);
  }

  return { ...conclusion, generatedBy: 'rule-based' };
}

async function fetchCountyDiscovery(supabase, dateRange) {
  const since = getSinceDate(dateRange);
  const metrics = await fetchCountyDiscoveryMetrics(supabase, since);
  const funnel = buildCountyDiscoveryFunnel(metrics);
  const ruleConclusion = buildCountyDiscoveryConclusion(metrics);
  const conclusion = await generateCountyDiscoveryInsight(metrics, ruleConclusion);

  return { metrics, funnel, conclusion };
}

async function fetchLocationSearchPerformance(supabase, since) {
  const { data: stats, error: statsError } = await supabase.rpc(
    'admin_location_search_stats',
    { p_since: since }
  );
  if (statsError) throw statsError;

  let query = supabase
    .from('location_search_events')
    .select('query, state_code, success, created_at, source_page')
    .limit(5000);

  query = applySince(query, 'created_at', since);

  const { data, error } = await query;
  if (error) throw error;

  const topLocations = groupSearchEvents(data, { successFilter: true }).slice(0, 20);
  const topMissing = groupSearchEvents(data, { successFilter: false }).slice(0, 20);

  const dayMap = new Map();
  const sourceMap = new Map();
  for (const row of data || []) {
    const day = row.created_at?.slice(0, 10);
    if (day) {
      const existing = dayMap.get(day) || {
        day,
        total: 0,
        successful: 0,
      };
      existing.total += 1;
      if (row.success) existing.successful += 1;
      dayMap.set(day, existing);
    }

    const bucket = bucketSearchSourcePage(row.source_page);
    sourceMap.set(bucket, (sourceMap.get(bucket) || 0) + 1);
  }

  const successRateTrend = Array.from(dayMap.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: d.day,
      successRate:
        d.total > 0 ? Math.round((100 * d.successful) / d.total * 10) / 10 : 0,
      totalSearches: d.total,
    }));

  const searchesBySource = Array.from(sourceMap.entries())
    .map(([source, search_count]) => ({ source, search_count }))
    .sort((a, b) => b.search_count - a.search_count);

  return {
    totalSearches: stats?.total_searches ?? 0,
    successfulSearches: stats?.successful_searches ?? 0,
    failedSearches: stats?.failed_searches ?? 0,
    successRate: stats?.success_rate ?? 0,
    topLocations,
    topMissing,
    successRateTrend,
    searchesBySource,
  };
}

async function fetchCountiesGeneratingRadar(supabase, since) {
  let query = supabase
    .from('product_events')
    .select('session_id, event_name, metadata, created_at')
    .in('event_name', ['county_alert_view', 'radar_view'])
    .limit(10000);
  query = applySince(query, 'created_at', since);
  const { data, error } = await query;
  if (error) throw error;

  const sessionEvents = new Map();
  for (const row of data || []) {
    const list = sessionEvents.get(row.session_id) || [];
    list.push(row);
    sessionEvents.set(row.session_id, list);
  }

  const countyMap = new Map();
  for (const events of sessionEvents.values()) {
    const sorted = [...events].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    let lastCounty = null;
    for (const event of sorted) {
      if (event.event_name === 'county_alert_view') {
        lastCounty = {
          county_id: event.metadata?.county_id,
          county_name: event.metadata?.county_name,
          state_code: event.state_code,
        };
      } else if (event.event_name === 'radar_view' && lastCounty?.county_id) {
        const key = lastCounty.county_id;
        const existing = countyMap.get(key) || {
          county_id: key,
          county_name: lastCounty.county_name || 'Unknown',
          state_code: lastCounty.state_code,
          radar_view_count: 0,
        };
        existing.radar_view_count += 1;
        if (lastCounty.county_name) {
          existing.county_name = lastCounty.county_name;
        }
        countyMap.set(key, existing);
      }
    }
  }

  return Array.from(countyMap.values())
    .sort((a, b) => b.radar_view_count - a.radar_view_count)
    .slice(0, 15);
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
        county_id: key,
        county_name: county?.name || 'Unknown',
        state_code: county?.state_code || row.state_code,
        view_count: 1,
        alert_count: row.alert_count ?? 0,
        last_viewed: row.created_at,
      });
    }
  }

  const counties = Array.from(grouped.values());
  const topViewed = [...counties]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 15);
  const highestAlertCounts = [...counties]
    .sort((a, b) => b.alert_count - a.alert_count)
    .slice(0, 15);
  const generatingRadar = await fetchCountiesGeneratingRadar(supabase, since);

  return {
    topViewed,
    highestAlertCounts,
    generatingRadar,
    totalViews: counties.reduce((sum, c) => sum + c.view_count, 0),
  };
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

function shouldShowRadarTypes(topRadarTypes) {
  const types = topRadarTypes || [];
  if (types.length === 0) return false;
  if (types.length === 1) return false;
  const total = types.reduce((sum, t) => sum + (t.event_count || 0), 0);
  if (total === 0) return false;
  const topShare = (types[0].event_count || 0) / total;
  return topShare < 0.95;
}

function computeRadarInsights(radar, totalSessions) {
  const topState = radar.opensByState?.[0];
  const topLocation = radar.topLocations?.[0];
  return {
    topState: topState
      ? { stateCode: topState.state_code, openCount: topState.open_count }
      : null,
    topLocation: topLocation
      ? { stateCode: topLocation.state_code, viewCount: topLocation.view_count }
      : null,
    totalOpens: radar.totalOpens ?? 0,
    avgOpensPerSession:
      totalSessions > 0
        ? Math.round((radar.totalOpens / totalSessions) * 10) / 10
        : 0,
    showRadarTypes: shouldShowRadarTypes(radar.topRadarTypes),
  };
}

async function fetchRadarEngagement(supabase, since) {
  const { data, error } = await supabase.rpc('admin_radar_engagement_stats', {
    p_since: since,
  });
  if (error) throw error;

  const base = {
    totalOpens: data?.totalOpens ?? 0,
    opensByState: data?.opensByState ?? [],
    topRadarTypes: data?.topRadarTypes ?? [],
    topLocations: data?.topLocations ?? [],
  };

  const { data: sessionData } = await supabase.rpc('admin_returning_visitor_stats', {
    p_since: since,
  });
  const totalSessions = sessionData?.total_sessions ?? 0;

  return {
    ...base,
    insights: computeRadarInsights(base, totalSessions),
  };
}

const RADAR_RESOLUTION_SOURCE_LABELS = {
  gps: 'GPS',
  search: 'Search',
  deep_link: 'Deep Link',
  saved_location: 'Saved Location',
  manual_state_select: 'Manual State Selection',
};

const ALERT_VIEW_EVENTS = new Set(['state_alert_page_view', 'county_alert_view']);

function buildRadarAttributionFunnel(sessionEvents) {
  const radarOpenedSessions = new Set();
  for (const row of sessionEvents) {
    if (row.kind === 'radar_opened') radarOpenedSessions.add(row.session_id);
  }

  const base = radarOpenedSessions.size || 1;
  const steps = [
    { step: 1, eventName: 'radar_opened', label: 'Radar Opened' },
    { step: 2, eventName: 'radar_state_resolved', label: 'State Resolved' },
    { step: 3, eventName: 'alert_viewed', label: 'Alert Viewed' },
    { step: 4, eventName: 'save_location', label: 'Location Saved' },
  ];

  const counts = steps.map((step, index) => {
    let sessions = 0;
    if (index === 0) {
      sessions = radarOpenedSessions.size;
    } else {
      for (const sessionId of radarOpenedSessions) {
        const events = sessionEvents
          .filter((row) => row.session_id === sessionId)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const openedAt = events.find((row) => row.kind === 'radar_opened')?.created_at;
        if (!openedAt) continue;
        const openedMs = new Date(openedAt).getTime();
        const hasStep = events.some((row) => {
          if (new Date(row.created_at).getTime() < openedMs) return false;
          if (step.eventName === 'radar_state_resolved') return row.kind === 'radar_state_resolved';
          if (step.eventName === 'alert_viewed') return ALERT_VIEW_EVENTS.has(row.kind);
          if (step.eventName === 'save_location') return row.kind === 'save_location';
          return false;
        });
        if (hasStep) sessions += 1;
      }
    }
    return { ...step, sessions };
  });

  return counts.map((step, index) => {
    const prevSessions = index === 0 ? step.sessions : counts[index - 1].sessions;
    const dropoffPct =
      index === 0
        ? 0
        : prevSessions > 0
          ? Math.round((1 - step.sessions / prevSessions) * 1000) / 10
          : 0;
    const completionPct = base > 0 ? Math.round((step.sessions / base) * 1000) / 10 : 0;
    return { ...step, completionPct, dropoffPct };
  });
}

async function fetchRadarAttributionAnalytics(supabase, since) {
  let radarOpensQuery = supabase
    .from('radar_events')
    .select('session_id, visitor_id, state_code, created_at')
    .eq('event_type', 'radar_opened')
    .limit(10000);
  radarOpensQuery = applySince(radarOpensQuery, 'created_at', since);

  let productQuery = supabase
    .from('product_events')
    .select('session_id, visitor_id, event_name, created_at, metadata')
    .in('event_name', [
      'radar_view',
      'radar_state_resolved',
      'state_alert_page_view',
      'county_alert_view',
      'save_location',
    ])
    .limit(10000);
  productQuery = applySince(productQuery, 'created_at', since);

  const [radarOpensRes, productRes] = await Promise.all([radarOpensQuery, productQuery]);
  if (radarOpensRes.error) throw radarOpensRes.error;
  if (productRes.error) throw productRes.error;

  const radarOpens = radarOpensRes.data || [];
  const productEvents = productRes.data || [];

  const visitorIds = new Set();
  const resolvedSessions = new Set();
  const unresolvedUsSessions = new Set();
  const sourceCounts = new Map();

  const sessionEvents = [];

  for (const row of radarOpens) {
    visitorIds.add(row.visitor_id);
    sessionEvents.push({
      session_id: row.session_id,
      visitor_id: row.visitor_id,
      kind: 'radar_opened',
      created_at: row.created_at,
    });
    if ((row.state_code || 'US') === 'US') {
      unresolvedUsSessions.add(row.session_id);
    }
  }

  for (const row of productEvents) {
    if (row.event_name === 'radar_view') {
      visitorIds.add(row.visitor_id);
    }
    if (row.event_name === 'radar_state_resolved') {
      resolvedSessions.add(row.session_id);
      unresolvedUsSessions.delete(row.session_id);
      const source = row.metadata?.source || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      sessionEvents.push({
        session_id: row.session_id,
        visitor_id: row.visitor_id,
        kind: 'radar_state_resolved',
        created_at: row.created_at,
      });
    } else {
      sessionEvents.push({
        session_id: row.session_id,
        visitor_id: row.visitor_id,
        kind: row.event_name,
        created_at: row.created_at,
      });
    }
  }

  const resolvedCount = resolvedSessions.size;
  const unresolvedCount = unresolvedUsSessions.size;
  const resolutionDenominator = resolvedCount + unresolvedCount;
  const resolutionRatePct =
    resolutionDenominator > 0
      ? Math.round((resolvedCount / resolutionDenominator) * 1000) / 10
      : null;

  const sourceBreakdown = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({
      source,
      label: RADAR_RESOLUTION_SOURCE_LABELS[source] || source.replace(/_/g, ' '),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const funnel = buildRadarAttributionFunnel(sessionEvents);

  return {
    radarVisitors: visitorIds.size,
    radarOpens: radarOpens.length,
    resolvedSessions: resolvedCount,
    unresolvedSessions: unresolvedCount,
    resolutionRatePct,
    sourceBreakdown,
    funnel,
  };
}

const STATE_PAGE_FORECAST_SOURCES = new Set([
  'forecasts_conditions_card',
  'weather_forecast_card',
  'popular_forecasts',
  'popular_forecasts_section',
  'state_alert_page',
  'state_forecast_list',
  'state_forecast_cta',
  'state_search_zip',
  'state_search_city',
  'state_search_county',
  'state-page-widget',
  'state-page-search',
]);

function isStatePageForecastClick(row) {
  const meta = row?.metadata || {};
  if (meta.source_page && STATE_PAGE_FORECAST_SOURCES.has(meta.source_page)) {
    return true;
  }
  const legacy = meta.source;
  return legacy === 'state-page-widget' || legacy === 'state-page-search';
}

async function fetchForecastEngagement(supabase, since) {
  let clicksQuery = supabase
    .from('product_events')
    .select('metadata, state_code, page_path')
    .eq('event_name', 'forecast_link_click')
    .limit(10000);
  clicksQuery = applySince(clicksQuery, 'created_at', since);

  let stateViewsQuery = supabase
    .from('product_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'state_alert_page_view');
  stateViewsQuery = applySince(stateViewsQuery, 'created_at', since);

  let cityViewsQuery = supabase
    .from('product_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'city_weather_page_view');
  cityViewsQuery = applySince(cityViewsQuery, 'created_at', since);

  const [clicksRes, stateViewsRes, cityViewsRes] = await Promise.all([
    clicksQuery,
    stateViewsQuery,
    cityViewsQuery,
  ]);
  if (clicksRes.error) throw clicksRes.error;
  if (stateViewsRes.error) throw stateViewsRes.error;
  if (cityViewsRes.error) throw cityViewsRes.error;

  const clicks = clicksRes.data || [];
  const cityCounts = new Map();
  const stateClickCounts = new Map();
  let statePageClicks = 0;
  let cityAlertPageClicks = 0;

  for (const row of clicks) {
    if (isStatePageForecastClick(row)) {
      statePageClicks += 1;
    }
    if (row.metadata?.destination === 'city_alert_page') {
      cityAlertPageClicks += 1;
    }
    const stateKey = row.state_code || row.metadata?.destination_state || null;
    if (stateKey) {
      stateClickCounts.set(stateKey, (stateClickCounts.get(stateKey) || 0) + 1);
    }
    const city = row.metadata?.city;
    if (city) {
      const key = `${city}|${row.state_code || ''}`;
      const entry = cityCounts.get(key) || {
        city,
        state_code: row.state_code || null,
        click_count: 0,
      };
      entry.click_count += 1;
      cityCounts.set(key, entry);
    }
  }

  const statePageViews = stateViewsRes.count ?? 0;
  const cityPageViews = cityViewsRes.count ?? 0;
  const statePageCtr =
    statePageViews > 0
      ? Math.round((statePageClicks / statePageViews) * 1000) / 10
      : null;
  const cityPageCtr =
    cityPageViews > 0
      ? Math.round((cityAlertPageClicks / cityPageViews) * 1000) / 10
      : null;

  const topCities = Array.from(cityCounts.values())
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 10);

  const clicksByState = Array.from(stateClickCounts.entries())
    .map(([state_code, click_count]) => ({ state_code, click_count }))
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 15);

  return {
    totalClicks: clicks.length,
    statePageClicks,
    statePageViews,
    statePageCtr,
    cityAlertPageClicks,
    cityPageViews,
    cityPageCtr,
    topCities,
    clicksByState,
  };
}

function computeFunnelDropOff(funnel) {
  const stepStats = Array.isArray(funnel?.stepStats)
    ? funnel.stepStats
    : funnel?.stepStats
      ? Object.values(funnel.stepStats)
      : [];

  if (stepStats.length < 2) {
    return { biggestDropOff: null, overallCompletionPct: funnel?.overallCompletionPct ?? 0 };
  }

  let biggestDropOff = null;
  for (let i = 1; i < stepStats.length; i += 1) {
    const step = stepStats[i];
    if (!biggestDropOff || (step.dropoffPct ?? 0) > biggestDropOff.dropoffPct) {
      biggestDropOff = {
        step: step.step,
        eventName: step.eventName,
        dropoffPct: step.dropoffPct ?? 0,
        fromEvent: stepStats[i - 1]?.eventName,
        sessionsLost:
          (stepStats[i - 1]?.sessions ?? 0) - (step.sessions ?? 0),
      };
    }
  }

  return {
    biggestDropOff,
    overallCompletionPct: funnel?.overallCompletionPct ?? 0,
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
      const funnel = { ...data, steps };
      return [id, { ...funnel, ...computeFunnelDropOff(funnel) }];
    })
  );

  const { data: topPaths, error: pathsError } = await supabase.rpc(
    'admin_top_journey_paths',
    { p_since: since, p_limit: 10 }
  );
  if (pathsError) throw pathsError;

  const funnels = Object.fromEntries(funnelEntries);
  const mainFunnel = funnels.alerts_to_save;

  return {
    funnels,
    topPaths: topPaths ?? [],
    mainJourney: {
      id: 'alerts_to_save',
      overallCompletionPct: mainFunnel?.overallCompletionPct ?? 0,
      biggestDropOff: mainFunnel?.biggestDropOff ?? null,
    },
  };
}

function formatRadarStateLabel(stateCode) {
  const code = stateCode;
  if (!code || code === 'unknown' || code === 'US') return 'Unresolved Location';
  return code;
}

const PAGE_VIEW_EVENTS = [
  'homepage_view',
  'state_alert_page_view',
  'forecast_view',
  'city_weather_page_view',
  'county_alert_view',
  'radar_view',
];

function pageViewLabel(eventName, stateCode) {
  switch (eventName) {
    case 'homepage_view':
      return 'Homepage';
    case 'state_alert_page_view':
      return stateCode && stateCode !== 'unknown'
        ? `State Alerts (${stateCode})`
        : 'State Alert Pages';
    case 'forecast_view':
      return 'Forecast';
    case 'city_weather_page_view':
      return stateCode && stateCode !== 'unknown'
        ? `City Weather (${stateCode})`
        : 'City Weather Pages';
    case 'county_alert_view':
      return 'County Alert Pages';
    case 'radar_view':
      return 'Radar';
    default:
      return String(eventName || 'Unknown').replace(/_/g, ' ');
  }
}

async function fetchMostVisitedPages(supabase, dateRange = '7d') {
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('product_events')
    .select('event_name, state_code, created_at')
    .in('event_name', PAGE_VIEW_EVENTS)
    .order('created_at', { ascending: false })
    .limit(10000);
  query = applySince(query, 'created_at', since60d);

  const { data, error } = await query;
  if (error) throw error;

  const now = Date.now();
  const sinceTodayMs = new Date().setHours(0, 0, 0, 0);
  const sinceYesterdayMs = sinceTodayMs - 24 * 60 * 60 * 1000;
  const since7dMs = now - 7 * 24 * 60 * 60 * 1000;
  const since14dMs = now - 14 * 24 * 60 * 60 * 1000;
  const since30dMs = now - 30 * 24 * 60 * 60 * 1000;
  const since60dMs = now - 60 * 24 * 60 * 60 * 1000;

  const map = new Map();
  for (const row of data || []) {
    const label = pageViewLabel(row.event_name, row.state_code);
    const key = `${row.event_name}::${row.state_code || ''}`;
    const existing = map.get(key) || {
      page: label,
      eventName: row.event_name,
      stateCode: row.state_code || null,
      viewsToday: 0,
      viewsYesterday: 0,
      views7d: 0,
      viewsPrev7d: 0,
      views30d: 0,
      viewsPrev30d: 0,
    };
    const ts = new Date(row.created_at).getTime();
    if (ts >= since30dMs) existing.views30d += 1;
    if (ts >= since60dMs && ts < since30dMs) existing.viewsPrev30d += 1;
    if (ts >= since7dMs) existing.views7d += 1;
    if (ts >= since14dMs && ts < since7dMs) existing.viewsPrev7d += 1;
    if (ts >= sinceTodayMs) existing.viewsToday += 1;
    if (ts >= sinceYesterdayMs && ts < sinceTodayMs) existing.viewsYesterday += 1;
    map.set(key, existing);
  }

  const trendPairs = {
    today: ['viewsToday', 'viewsYesterday'],
    yesterday: ['viewsToday', 'viewsYesterday'],
    '7d': ['views7d', 'viewsPrev7d'],
    '30d': ['views30d', 'viewsPrev30d'],
    all: ['views30d', 'viewsPrev30d'],
  };
  const [currentKey, prevKey] = trendPairs[dateRange] || trendPairs['7d'];

  const pages = Array.from(map.values())
    .map((row) => ({
      ...row,
      trend: computeTrend(row[currentKey] ?? 0, row[prevKey] ?? 0),
    }))
    .sort((a, b) => (b[currentKey] ?? 0) - (a[currentKey] ?? 0))
    .slice(0, 20);

  return { pages };
}

async function fetchCountyAlertOpportunities(supabase, since) {
  let stateViewsQuery = supabase
    .from('product_events')
    .select('state_code')
    .eq('event_name', 'state_alert_page_view')
    .limit(10000);
  stateViewsQuery = applySince(stateViewsQuery, 'created_at', since);

  let countySearchQuery = supabase
    .from('location_search_events')
    .select('state_code, resolved_type')
    .eq('success', true)
    .limit(10000);
  countySearchQuery = applySince(countySearchQuery, 'created_at', since);

  let countyViewsQuery = supabase
    .from('county_alert_views')
    .select('state_code')
    .limit(10000);
  countyViewsQuery = applySince(countyViewsQuery, 'created_at', since);

  const [stateViewsRes, countySearchRes, countyViewsRes] = await Promise.all([
    stateViewsQuery,
    countySearchQuery,
    countyViewsQuery,
  ]);

  if (stateViewsRes.error) throw stateViewsRes.error;
  if (countySearchRes.error) throw countySearchRes.error;
  if (countyViewsRes.error) throw countyViewsRes.error;

  const stateMap = new Map();

  function ensureState(code) {
    const state = code && code !== 'unknown' ? code : null;
    if (!state) return null;
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        stateCode: state,
        statePageViews: 0,
        countySearches: 0,
        countyPageViews: 0,
        opportunityScore: 0,
      });
    }
    return stateMap.get(state);
  }

  for (const row of stateViewsRes.data || []) {
    const entry = ensureState(row.state_code);
    if (entry) entry.statePageViews += 1;
  }

  for (const row of countySearchRes.data || []) {
    const type = String(row.resolved_type || '').toLowerCase();
    if (type !== 'county') continue;
    const entry = ensureState(row.state_code);
    if (entry) entry.countySearches += 1;
  }

  for (const row of countyViewsRes.data || []) {
    const entry = ensureState(row.state_code);
    if (entry) entry.countyPageViews += 1;
  }

  const opportunities = Array.from(stateMap.values())
    .filter((s) => s.statePageViews >= 5)
    .map((s) => {
      const countyEngagement = s.countyPageViews + s.countySearches * 0.5;
      const ratio = s.statePageViews / Math.max(countyEngagement, 1);
      s.opportunityScore = Math.round(ratio * 10) / 10;
      s.countyEngagementGap =
        s.statePageViews > 0
          ? Math.round(
              (100 * Math.max(0, s.statePageViews - countyEngagement)) /
                s.statePageViews
            )
          : 0;
      return s;
    })
    .filter((s) => s.opportunityScore >= 2)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 12);

  return { opportunities, totalStates: stateMap.size };
}

function buildRadarWeatherFallback(radar) {
  const topStates = (radar?.opensByState || []).slice(0, 3);
  if (topStates.length === 0) return null;
  const leader = topStates[0];
  const label = formatRadarStateLabel(leader.state_code);
  const others =
    topStates.length > 1
      ? ` followed by ${topStates
          .slice(1)
          .map((s) => formatRadarStateLabel(s.state_code))
          .join(', ')}`
      : '';
  return `${label} radar opens lead at ${leader.open_count.toLocaleString()}${others} — likely driven by active weather in those regions.`;
}

async function generateRadarWeatherContext(radar) {
  const fallback = buildRadarWeatherFallback(radar);
  if (!fallback) return null;

  const anthropic = describeAnthropicKeyConfig();
  if (!anthropic.configured || !anthropic.looksValid) {
    return { blurb: fallback, generatedBy: 'rule-based' };
  }

  const topStates = (radar?.opensByState || []).slice(0, 6).map((s) => ({
    state: formatRadarStateLabel(s.state_code),
    opens: s.open_count,
  }));

  try {
    const haikuResult = await callHaikuForJSON({
      systemPrompt: `You explain radar engagement spikes for a storm tracking admin dashboard.
Return ONLY JSON: { "blurb": string } — one sentence under 120 chars linking state radar opens to likely weather drivers (storms, warnings, tornadoes). No PII.`,
      userPrompt: `Radar opens by state: ${JSON.stringify(topStates)}. Total opens: ${radar?.totalOpens ?? 0}. Write the blurb JSON.`,
      maxTokens: 200,
    });

    if (haikuResult.parsed?.blurb) {
      return {
        blurb: haikuResult.parsed.blurb,
        generatedBy: haikuResult.model,
      };
    }
  } catch (err) {
    console.warn('Radar weather context generation failed:', err.message);
  }

  return { blurb: fallback, generatedBy: 'rule-based' };
}

function generateNeedsAttention({
  countyAlertViews,
  returningVisitors,
  locationSearch,
  metricTrends,
  radar,
}) {
  const items = [];

  if (
    (countyAlertViews?.totalViews ?? 0) < 10 &&
    (returningVisitors?.totalSessions ?? 0) > 20
  ) {
    items.push({
      id: 'county-low-traffic',
      priority: 'medium',
      text: `County alert pages have low traffic (${countyAlertViews.totalViews} views vs ${returningVisitors.totalSessions} sessions).`,
    });
  }

  const searchTrend = metricTrends?.searchSuccessRate;
  if (
    searchTrend?.direction === 'down' &&
    Math.abs(searchTrend.changePct) >= 15
  ) {
    items.push({
      id: 'search-failures',
      priority: 'high',
      text: `Search success rate dropped ${Math.abs(searchTrend.changePct)}% vs prior period (now ${locationSearch?.successRate ?? '—'}%).`,
    });
  } else if (
    (locationSearch?.failedSearches ?? 0) > 0 &&
    locationSearch?.successRate != null &&
    locationSearch.successRate < 80
  ) {
    items.push({
      id: 'search-failures',
      priority: 'medium',
      text: `Search success rate is ${locationSearch.successRate}% with ${locationSearch.failedSearches} failed searches.`,
    });
  }

  const returningTrend = metricTrends?.returningVisitors;
  if (
    returningTrend?.direction === 'down' &&
    Math.abs(returningTrend.changePct) >= 15
  ) {
    items.push({
      id: 'returning-decline',
      priority: 'high',
      text: `Returning visitors down ${Math.abs(returningTrend.changePct)}% vs prior period.`,
    });
  }

  const topState = radar?.opensByState?.[0];
  const secondState = radar?.opensByState?.[1];
  if (
    topState &&
    secondState &&
    topState.open_count > Math.max(secondState.open_count * 2, 5)
  ) {
    items.push({
      id: 'state-spike',
      priority: 'medium',
      text: `${formatRadarStateLabel(topState.state_code)} has unusually high radar engagement (${topState.open_count} opens, 2×+ next state).`,
    });
  }

  return items.slice(0, 4);
}

function generateExecutiveSummary({
  returningVisitors,
  radar,
  forecastEngagement,
  locationSearch,
  countyAlertOpportunities,
  metricTrends,
}) {
  const metrics = [];

  metrics.push({
    id: 'sessions',
    label: 'Sessions',
    value: (returningVisitors?.totalSessions ?? 0).toLocaleString(),
    trend: metricTrends?.totalSessions ?? null,
  });

  metrics.push({
    id: 'visitors',
    label: 'Visitors',
    value: (returningVisitors?.uniqueVisitors ?? 0).toLocaleString(),
    trend: metricTrends?.uniqueVisitors ?? null,
  });

  metrics.push({
    id: 'returning-pct',
    label: 'Returning %',
    value: `${returningVisitors?.returningPct ?? 0}%`,
    trend: metricTrends?.returningPct ?? null,
  });

  metrics.push({
    id: 'search-success',
    label: 'Search Success',
    value:
      locationSearch?.totalSearches > 0
        ? `${locationSearch.successRate}%`
        : '—',
    trend: metricTrends?.searchSuccessRate ?? null,
  });

  metrics.push({
    id: 'radar-opens',
    label: 'Radar Opens',
    value: (radar?.totalOpens ?? 0).toLocaleString(),
    trend: metricTrends?.radarOpens ?? null,
  });

  metrics.push({
    id: 'forecast-clicks',
    label: 'Forecast Clicks',
    value: (forecastEngagement?.totalClicks ?? 0).toLocaleString(),
    trend: metricTrends?.forecastClicks ?? null,
    detail:
      forecastEngagement?.statePageCtr != null
        ? `${forecastEngagement.statePageCtr}% CTR from state pages`
        : undefined,
  });

  const topOpp = countyAlertOpportunities?.opportunities?.[0];
  metrics.push({
    id: 'opportunity-score',
    label: 'Opportunity Score',
    value: topOpp ? String(topOpp.opportunityScore) : '—',
    detail: topOpp ? `${topOpp.stateCode} county gap` : undefined,
  });

  return { metrics };
}

/** @deprecated use executiveSummary */
function generateTopInsights(args) {
  return generateExecutiveSummary(args).metrics;
}

function generateRecommendedActions({
  missingLocationSearches,
  userJourneys,
  countyAlertViews,
  savedLocations,
  radar,
  locationSearch,
  returningVisitors,
}) {
  const actions = [];

  const recommended = missingLocationSearches?.recommendedCities?.[0];
  if (recommended) {
    actions.push({
      id: 'add-cities',
      priority: 'high',
      title: 'Add city coverage',
      description: `Users searched for "${recommended.label}" ${recommended.searchCount} times without a match. Add this location to improve search success.`,
    });
  }

  const mainDrop = userJourneys?.mainJourney?.biggestDropOff;
  if (mainDrop && mainDrop.dropoffPct >= 20) {
    actions.push({
      id: 'improve-funnel',
      priority: 'high',
      title: 'Improve funnel conversion',
      description: `Largest drop-off at "${String(mainDrop.eventName).replace(/_/g, ' ')}" (${mainDrop.dropoffPct}% lost). Review UX at this step.`,
    });
  }

  const radarToSave = userJourneys?.funnels?.alerts_to_save;
  const saveStep = Array.isArray(radarToSave?.stepStats)
    ? radarToSave.stepStats.find((s) => s.eventName === 'save_location')
    : null;
  const radarStep = Array.isArray(radarToSave?.stepStats)
    ? radarToSave.stepStats.find((s) => s.eventName === 'radar_view')
    : null;
  if (
    radarStep?.sessions > 0 &&
    saveStep &&
    saveStep.completionPct != null &&
    saveStep.completionPct < 30
  ) {
    actions.push({
      id: 'radar-to-save',
      priority: 'medium',
      title: 'Improve radar → save conversion',
      description: `Only ${saveStep.completionPct}% of users who reach radar go on to save a location. Consider prompting saves after radar use.`,
    });
  }

  if ((countyAlertViews?.totalViews ?? 0) < 10 && (returningVisitors?.totalSessions ?? 0) > 20) {
    actions.push({
      id: 'expand-counties',
      priority: 'medium',
      title: 'Expand county coverage',
      description: 'County alert pages have low traffic relative to overall sessions. Promote county-level alerts on state pages.',
    });
  }

  if (
    (savedLocations?.totalSaved ?? 0) < 5 &&
    (returningVisitors?.returningVisitors ?? 0) > 3
  ) {
    actions.push({
      id: 'promote-saves',
      priority: 'medium',
      title: 'Promote saved locations',
      description: 'Returning visitors are coming back but few are saving locations. Highlight save benefits on radar and alert pages.',
    });
  }

  if (locationSearch?.successRate != null && locationSearch.successRate < 80) {
    actions.push({
      id: 'search-quality',
      priority: 'medium',
      title: 'Improve search quality',
      description: `Search success rate is ${locationSearch.successRate}%. Review failed queries and expand the location catalog.`,
    });
  }

  if (radar?.totalOpens > 0 && (savedLocations?.totalSaved ?? 0) === 0) {
    actions.push({
      id: 'radar-engagement',
      priority: 'low',
      title: 'Convert radar viewers',
      description: 'Users are opening radar but not saving locations. Add a save CTA on the radar page.',
    });
  }

  return actions.slice(0, 6);
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

  const stateMap = new Map();
  for (const row of data || []) {
    const state = row.locations?.state || 'Unknown';
    stateMap.set(state, (stateMap.get(state) || 0) + 1);
  }
  const savesByState = Array.from(stateMap.entries())
    .map(([state, save_count]) => ({ state, save_count }))
    .sort((a, b) => b.save_count - a.save_count);

  return {
    totalSaved: stats?.total_saved ?? 0,
    signedInUsers: stats?.signed_in_users ?? 0,
    topLocations,
    savesByState,
    note: 'Saved locations are stored for signed-in users only. Anonymous localStorage saves are not tracked in Supabase.',
  };
}

const STORM_PRODUCT_EVENT_NAMES = [
  'storm_banner_viewed',
  'storm_banner_clicked',
  'storm_page_viewed',
  'storm_radar_opened',
  'storm_alerts_clicked',
  'storm_location_saved',
  'storm_signin_started',
];

function humanizeStormSlug(slug) {
  if (!slug) return 'Unknown Storm';
  return String(slug)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function bucketStormTrafficSource(referrer, metadata = {}) {
  const ref = String(referrer || metadata.source || '').toLowerCase().trim();
  if (!ref || ref === '(direct)' || ref === 'direct') return 'Direct';
  if (ref.includes('bing.')) return 'Bing';
  if (ref.includes('google.')) return 'Google';
  if (ref.includes('chatgpt.') || ref.includes('openai.') || ref.includes('copilot.')) {
    return 'ChatGPT';
  }
  const socials = ['instagram.', 'facebook.', 'twitter.', 'x.com', 't.co', 'threads.', 'linkedin.', 'reddit.'];
  if (socials.some((s) => ref.includes(s))) return 'Social';
  if (ref.includes('stormtracking')) return 'Internal';
  return 'Other';
}

function bucketRadarSourcePageValue(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'homepage' || s.includes('homepage')) return 'homepage';
  if (s === 'storm_page' || s.includes('storm_page')) return 'storm_page';
  if (s === 'state' || s.includes('state')) return 'state';
  if (s === 'city' || s.includes('city')) return 'city';
  if (s === 'county' || s.includes('county')) return 'county';
  return 'other';
}

function buildStormFunnel(globalHomepageViews, stormEventCounts) {
  const steps = [
    { step: 1, eventName: 'homepage_view', label: 'Homepage' },
    { step: 2, eventName: 'storm_banner_viewed', label: 'Banner Viewed' },
    { step: 3, eventName: 'storm_banner_clicked', label: 'Banner Clicked' },
    { step: 4, eventName: 'storm_page_viewed', label: 'Storm Page Viewed' },
    { step: 5, eventName: 'storm_radar_opened', label: 'Radar Opened' },
    { step: 6, eventName: 'storm_location_saved', label: 'Location Saved' },
  ];

  const counts = steps.map((step) => ({
    ...step,
    sessions:
      step.eventName === 'homepage_view'
        ? globalHomepageViews
        : stormEventCounts[step.eventName] || 0,
  }));

  const base = counts[0]?.sessions || 1;
  return counts.map((s, i) => {
    const prevSessions = i === 0 ? s.sessions : counts[i - 1].sessions;
    const dropoffPct =
      i === 0
        ? 0
        : prevSessions > 0
          ? Math.round((1 - s.sessions / prevSessions) * 1000) / 10
          : 0;
    const completionPct = base > 0 ? Math.round((s.sessions / base) * 1000) / 10 : 0;
    return { ...s, completionPct, dropoffPct };
  });
}

function computeStormRetention(firstStormVisitByVisitor, sessions) {
  const sameDay = new Set();
  const nextDay = new Set();
  const sevenDay = new Set();

  for (const [visitorId, firstAt] of firstStormVisitByVisitor) {
    const firstDate = firstAt.slice(0, 10);
    for (const session of sessions) {
      if (session.visitor_id !== visitorId) continue;
      if (session.created_at <= firstAt) continue;
      const sessionDate = session.created_at.slice(0, 10);
      const dayDiff = Math.round(
        (new Date(`${sessionDate}T12:00:00Z`).getTime() - new Date(`${firstDate}T12:00:00Z`).getTime()) /
          86400000
      );
      if (dayDiff === 0) sameDay.add(visitorId);
      if (dayDiff === 1) nextDay.add(visitorId);
      if (dayDiff >= 1 && dayDiff <= 7) sevenDay.add(visitorId);
    }
  }

  const total = firstStormVisitByVisitor.size || 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return {
    totalStormVisitors: total,
    sameDay: sameDay.size,
    sameDayPct: pct(sameDay.size),
    nextDay: nextDay.size,
    nextDayPct: pct(nextDay.size),
    sevenDay: sevenDay.size,
    sevenDayPct: pct(sevenDay.size),
  };
}

async function fetchStormEventsAnalytics(supabase, since, until = null) {
  const eventNames = [...STORM_PRODUCT_EVENT_NAMES, 'homepage_view', 'radar_view'];

  let eventsQuery = supabase
    .from('product_events')
    .select('visitor_id, session_id, event_name, metadata, page_path, created_at')
    .in('event_name', eventNames)
    .limit(20000);
  eventsQuery = applyPeriod(eventsQuery, 'created_at', since, until);

  let sessionsQuery = supabase
    .from('visitor_sessions')
    .select('visitor_id, session_id, landing_page, referrer, is_returning, first_seen, last_seen, created_at')
    .like('landing_page', '/storm/%')
    .limit(20000);
  sessionsQuery = applyPeriod(sessionsQuery, 'created_at', since, until);

  let allSessionsQuery = supabase
    .from('visitor_sessions')
    .select('visitor_id, created_at')
    .limit(50000);
  allSessionsQuery = applyPeriod(allSessionsQuery, 'created_at', since, until);

  const [eventsRes, stormSessionsRes, allSessionsRes, stormsRes] = await Promise.all([
    eventsQuery,
    sessionsQuery,
    allSessionsQuery,
    supabase.from('storms').select('slug, title, type, status'),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (stormSessionsRes.error) throw stormSessionsRes.error;
  if (allSessionsRes.error) throw allSessionsRes.error;

  const stormsBySlug = new Map((stormsRes.data || []).map((row) => [row.slug, row]));
  const events = eventsRes.data || [];
  const globalHomepageViews = events.filter((r) => r.event_name === 'homepage_view').length;

  const stormStats = new Map();
  function ensureStorm(slug) {
    const key = slug || '_unknown';
    if (!stormStats.has(key)) {
      const dbStorm = stormsBySlug.get(slug);
      stormStats.set(key, {
        stormSlug: slug || 'unknown',
        stormName: dbStorm?.title || humanizeStormSlug(slug),
        stormType: dbStorm?.type || null,
        events: {},
        visitors: new Set(),
        returningVisitors: new Set(),
        lastActivity: null,
      });
    }
    return stormStats.get(key);
  }

  for (const row of events) {
    if (!STORM_PRODUCT_EVENT_NAMES.includes(row.event_name)) continue;
    const meta = row.metadata || {};
    const slug = meta.storm_slug;
    const storm = ensureStorm(slug);
    storm.events[row.event_name] = (storm.events[row.event_name] || 0) + 1;
    if (row.visitor_id) {
      storm.visitors.add(row.visitor_id);
      if (meta.visitor_type === 'returning' || row.metadata?.visitor_type === 'returning') {
        storm.returningVisitors.add(row.visitor_id);
      }
    }
    if (!storm.lastActivity || row.created_at > storm.lastActivity) {
      storm.lastActivity = row.created_at;
    }
  }

  const topStorms = Array.from(stormStats.values())
    .map((s) => ({
      stormSlug: s.stormSlug,
      stormName: s.stormName,
      stormType: s.stormType,
      views: s.events.storm_page_viewed || 0,
      radarOpens: s.events.storm_radar_opened || 0,
      saves: s.events.storm_location_saved || 0,
      returningVisitors: s.returningVisitors.size,
      lastActivity: s.lastActivity,
    }))
    .sort((a, b) => b.views - a.views || (b.lastActivity || '').localeCompare(a.lastActivity || ''));

  const focusStorm = topStorms[0] || null;
  const focusSlug = focusStorm?.stormSlug;
  const focus = focusSlug ? ensureStorm(focusSlug) : null;

  const stormLandingSessions = (stormSessionsRes.data || []).filter(
    (s) => !focusSlug || s.landing_page?.includes(`/storm/${focusSlug}`)
  );

  let avgTimeOnPageSeconds = null;
  if (stormLandingSessions.length > 0) {
    const durations = stormLandingSessions
      .map((s) => {
        const start = new Date(s.first_seen).getTime();
        const end = new Date(s.last_seen).getTime();
        return Math.max(0, (end - start) / 1000);
      })
      .filter((d) => d > 0);
    if (durations.length > 0) {
      avgTimeOnPageSeconds = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }

  const overview = {
    pageViews: focus?.events.storm_page_viewed || 0,
    uniqueVisitors: focus?.visitors.size || 0,
    returningVisitors: focus?.returningVisitors.size || 0,
    returningRate:
      focus && focus.visitors.size > 0
        ? Math.round((focus.returningVisitors.size / focus.visitors.size) * 1000) / 10
        : 0,
    avgTimeOnPageSeconds,
    radarOpens: focus?.events.storm_radar_opened || 0,
    alertClicks: focus?.events.storm_alerts_clicked || 0,
    locationSaves: focus?.events.storm_location_saved || 0,
    signIns: focus?.events.storm_signin_started || 0,
    bannerViews: focus?.events.storm_banner_viewed || 0,
    bannerClicks: focus?.events.storm_banner_clicked || 0,
  };

  const trafficMap = new Map();
  for (const session of stormLandingSessions) {
    const bucket = bucketStormTrafficSource(session.referrer);
    trafficMap.set(bucket, (trafficMap.get(bucket) || 0) + 1);
  }
  const trafficTotal = Array.from(trafficMap.values()).reduce((a, b) => a + b, 0) || 1;
  const trafficSources = Array.from(trafficMap.entries())
    .map(([source, count]) => ({
      source,
      count,
      pct: Math.round((count / trafficTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  const funnel = buildStormFunnel(globalHomepageViews, focus?.events || {});

  const radarSourceMap = new Map();
  for (const row of events) {
    if (row.event_name === 'storm_radar_opened') {
      radarSourceMap.set('storm_page', (radarSourceMap.get('storm_page') || 0) + 1);
    } else if (row.event_name === 'radar_view') {
      const bucket = bucketRadarSourcePageValue(row.metadata?.source_page || row.metadata?.source);
      radarSourceMap.set(bucket, (radarSourceMap.get(bucket) || 0) + 1);
    }
  }
  const radarOpensBySource = Array.from(radarSourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const firstStormVisitByVisitor = new Map();
  for (const row of events) {
    if (row.event_name !== 'storm_page_viewed' || !row.visitor_id) continue;
    const slug = row.metadata?.storm_slug;
    if (focusSlug && slug !== focusSlug) continue;
    const existing = firstStormVisitByVisitor.get(row.visitor_id);
    if (!existing || row.created_at < existing) {
      firstStormVisitByVisitor.set(row.visitor_id, row.created_at);
    }
  }

  const retention = computeStormRetention(firstStormVisitByVisitor, allSessionsRes.data || []);

  const activeStorm = focusStorm
    ? {
        slug: focusStorm.stormSlug,
        name: focusStorm.stormName,
        type: focusStorm.stormType,
      }
    : null;

  const summary = activeStorm
    ? `${activeStorm.name} generated ${overview.uniqueVisitors} visitors, ${overview.radarOpens} radar opens, ${overview.locationSaves} saved locations, and a returning visitor rate of ${overview.returningRate}%.`
    : null;

  return {
    activeStorm,
    focusSlug,
    overview,
    trafficSources,
    funnel,
    radarOpensBySource,
    topStorms,
    retention,
    summary,
    note: avgTimeOnPageSeconds == null
      ? 'Avg time on page estimated from visitor_sessions first_seen/last_seen when storm page is the landing page.'
      : null,
  };
}

async function fetchAllAnalytics(supabase, dateRange) {
  const since = getSinceDate(dateRange);

  const [
    returningVisitors,
    missingLocationSearches,
    locationSearch,
    locationSources,
    locationPreference,
    countyDiscovery,
    countyAlertViews,
    savedLocations,
    radarBase,
    radarAttribution,
    userJourneys,
    analyticsHealth,
    previousMetrics,
    mostVisitedPages,
    countyAlertOpportunities,
    forecastEngagement,
    cityDemand,
    stormEventsBase,
  ] = await Promise.all([
    fetchReturningVisitors(supabase, since),
    fetchMissingLocationSearches(supabase, since),
    fetchLocationSearchPerformance(supabase, since),
    fetchLocationSources(supabase, since),
    fetchLocationPreference(supabase, dateRange),
    fetchCountyDiscovery(supabase, dateRange),
    fetchCountyAlertViews(supabase, since),
    fetchSavedLocations(supabase, since),
    fetchRadarEngagement(supabase, since),
    fetchRadarAttributionAnalytics(supabase, since),
    fetchUserJourneys(supabase, since),
    fetchAnalyticsHealth(supabase),
    fetchPreviousPeriodMetrics(supabase, dateRange),
    fetchMostVisitedPages(supabase, dateRange),
    fetchCountyAlertOpportunities(supabase, since),
    fetchForecastEngagement(supabase, since),
    fetchCityDemand(supabase, since),
    fetchStormEventsAnalytics(supabase, since),
  ]);

  const bounds = getPreviousPeriodBounds(dateRange);
  const stormEventsPrevious = bounds
    ? await fetchStormEventsAnalytics(supabase, bounds.since, bounds.until)
    : null;

  const stormEvents = {
    ...stormEventsBase,
    trends: stormEventsPrevious
      ? {
          pageViews: computeTrend(stormEventsBase.overview?.pageViews, stormEventsPrevious.overview?.pageViews),
          uniqueVisitors: computeTrend(
            stormEventsBase.overview?.uniqueVisitors,
            stormEventsPrevious.overview?.uniqueVisitors
          ),
          radarOpens: computeTrend(stormEventsBase.overview?.radarOpens, stormEventsPrevious.overview?.radarOpens),
          locationSaves: computeTrend(
            stormEventsBase.overview?.locationSaves,
            stormEventsPrevious.overview?.locationSaves
          ),
        }
      : null,
  };

  const weatherContext = await generateRadarWeatherContext(radarBase);
  const radar = {
    ...radarBase,
    weatherContext,
  };

  const currentMetrics = {
    radarOpens: radar.totalOpens ?? 0,
    forecastClicks: forecastEngagement.totalClicks ?? 0,
    returningVisitors: returningVisitors.returningVisitors ?? 0,
    locationSearches: locationSearch.totalSearches ?? 0,
    savedLocations: savedLocations.totalSaved ?? 0,
    countyAlertViews: countyAlertViews.totalViews ?? 0,
    totalSessions: returningVisitors.totalSessions ?? 0,
    uniqueVisitors: returningVisitors.uniqueVisitors ?? 0,
    returningPct: returningVisitors.returningPct ?? 0,
    searchSuccessRate: locationSearch.successRate ?? 0,
  };

  const metricTrends = buildMetricTrends(currentMetrics, previousMetrics);

  const recommendedActions = generateRecommendedActions({
    missingLocationSearches,
    userJourneys,
    countyAlertViews,
    savedLocations,
    radar,
    locationSearch,
    returningVisitors,
  });

  const executiveSummary = generateExecutiveSummary({
    returningVisitors,
    radar,
    forecastEngagement,
    locationSearch,
    countyAlertOpportunities,
    metricTrends,
  });

  const needsAttention = generateNeedsAttention({
    countyAlertViews,
    returningVisitors,
    locationSearch,
    metricTrends,
    radar,
  });

  const topInsights = executiveSummary.metrics;

  const expansionOpportunities = generateExpansionOpportunities({
    missingLocationSearches,
    locationSearch,
    countyAlertViews,
    locationSources,
    cityDemand,
  });

  return {
    dateRange,
    since,
    analyticsHealth,
    metricTrends,
    expansionOpportunities,
    executiveSummary,
    topInsights,
    recommendedActions,
    mostVisitedPages,
    countyAlertOpportunities,
    needsAttention,
    returningVisitors: {
      ...returningVisitors,
      trend: metricTrends.returningVisitors,
    },
    missingLocationSearches,
    cityDemand,
    locationSearch: {
      ...locationSearch,
      trend: metricTrends.searchSuccessRate,
    },
    locationSources,
    locationPreference,
    countyDiscovery,
    countyAlertViews: {
      ...countyAlertViews,
      trend: metricTrends.countyAlertViews,
    },
    savedLocations: {
      ...savedLocations,
      trend: metricTrends.savedLocations,
    },
    radar: {
      ...radar,
      trend: metricTrends.radarOpens,
      attribution: radarAttribution,
    },
    forecastEngagement: {
      ...forecastEngagement,
      trend: metricTrends.forecastClicks,
    },
    userJourneys,
    stormEvents,
  };
}

function fallbackMorningBrief(parseWarning) {
  return {
    headline: 'Morning brief could not be generated',
    bullets: ['Click Refresh Brief to try again.'],
    generated_at_note: parseWarning || 'AI response was not valid JSON',
  };
}

function normalizeOperationsAnalysis(parsed) {
  return {
    what_changed: parsed?.what_changed || [],
    opportunities: parsed?.opportunities || [],
    risks: parsed?.risks || [],
    attention_needed: parsed?.attention_needed || [],
    weather_drivers: parsed?.weather_drivers || [],
    retention_signals: parsed?.retention_signals || [],
    recommended_actions: (parsed?.recommended_actions || []).slice(0, 1),
    wins: parsed?.wins || [],
  };
}

function fallbackOperationsAnalysis(parseWarning) {
  return {
    what_changed: [],
    opportunities: [],
    risks: [
      {
        priority: 'medium',
        text: 'Operations analysis could not be fully generated. Click Refresh Analysis to retry.',
      },
    ],
    attention_needed: [],
    weather_drivers: [],
    retention_signals: [],
    recommended_actions: [],
    wins: [],
    parseWarning: parseWarning || 'AI response was not valid JSON',
  };
}

async function generateMorningBrief(analytics, period) {
  const periodLabel = PERIOD_LABELS[period] || period;
  const payload = buildAnalysisPayload({
    periodLabel,
    ...analytics,
  });

  const haikuResult = await callHaikuForJSON({
    systemPrompt: MORNING_BRIEF_SYSTEM,
    userPrompt: buildMorningBriefPrompt(payload),
    maxTokens: 1200,
    retry: {
      systemPrompt: MORNING_BRIEF_SYSTEM_COMPACT,
      maxTokens: 1200,
    },
  });

  const partial = !haikuResult.parsed;
  if (partial) {
    console.error('Morning brief JSON parse failed:', haikuResult.parseError);
  }

  return {
    brief: partial ? fallbackMorningBrief(haikuResult.parseError) : haikuResult.parsed,
    partial,
    parseWarning: haikuResult.parseWarning || (partial ? haikuResult.parseError : null),
    generatedAt: new Date().toISOString(),
    generatedBy: haikuResult.model,
    usage: haikuResult.usage,
  };
}

async function generateOperationsCenter(analytics, period, morningBrief) {
  const periodLabel = PERIOD_LABELS[period] || period;
  const payload = buildAnalysisPayload({
    periodLabel,
    morningBrief,
    ...analytics,
  });

  const haikuResult = await callHaikuForJSON({
    systemPrompt: OPERATIONS_CENTER_SYSTEM,
    userPrompt: buildOperationsCenterPrompt(payload),
    maxTokens: 4096,
    retry: {
      systemPrompt: OPERATIONS_CENTER_SYSTEM_COMPACT,
      maxTokens: 3000,
    },
  });

  const partial = !haikuResult.parsed;
  if (partial) {
    console.error('Operations center JSON parse failed:', haikuResult.parseError);
  }

  const analysis = partial
    ? fallbackOperationsAnalysis(haikuResult.parseError)
    : normalizeOperationsAnalysis(haikuResult.parsed);

  return {
    analysis,
    partial,
    parseWarning: haikuResult.parseWarning || (partial ? haikuResult.parseError : null),
    generatedAt: new Date().toISOString(),
    generatedBy: haikuResult.model,
    usage: haikuResult.usage,
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

    if (body.action === 'anthropic-health') {
      return jsonResponse(200, describeAnthropicKeyConfig());
    }

    const supabase = getSupabaseAdmin();

    if (body.action === 'morning-brief') {
      const period = body.period || '7d';
      const analytics = await fetchAllAnalytics(supabase, period);
      const result = await generateMorningBrief(analytics, period);
      return jsonResponse(200, result);
    }

    if (body.action === 'operations-center') {
      const period = body.period || '7d';
      const analytics = await fetchAllAnalytics(supabase, period);
      const morningBrief = body.morningBrief || null;
      const result = await generateOperationsCenter(analytics, period, morningBrief);
      return jsonResponse(200, result);
    }

    if (body.action === 'dismiss-missing-search') {
      const result = await dismissMissingSearch(supabase, {
        query: body.query,
        stateCode: body.stateCode,
      });
      return jsonResponse(200, result);
    }

    const dateRange = body.dateRange || '7d';
    const analytics = await fetchAllAnalytics(supabase, dateRange);
    return jsonResponse(200, analytics);
  } catch (err) {
    console.error('admin-analysis-api error:', err);
    const status = err.statusCode || 500;
    const message =
      err.statusCode === 401 ? err.message : err.message || 'Internal error';
    return jsonResponse(status, { error: message });
  }
};
