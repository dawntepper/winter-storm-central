/**
 * Admin Analysis API — password-gated read-only analytics using service role.
 * Validates ADMIN_PASSWORD against client-supplied password.
 */

const { getSupabaseAdmin } = require('./lib/supabase-admin');
const { callHaiku, parseHaikuJSON } = require('./lib/haiku-client');
const {
  buildAnalysisPayload,
  MORNING_BRIEF_SYSTEM,
  OPERATIONS_CENTER_SYSTEM,
  buildMorningBriefPrompt,
  buildOperationsCenterPrompt,
} = require('./lib/analysis-ai-payload');

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

async function fetchMissingLocationSearches(supabase, since) {
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

  return {
    searches: rows,
    totalFailed: rows.reduce((sum, r) => sum + (r.search_count || 0), 0),
    recommendedCities: buildRecommendedCities(rows),
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

  // State slugs from CheckAlertsNearYou (e.g. "colorado", "illinois")
  if (/^[a-z][a-z-]+$/.test(normalized) && !normalized.includes('page')) {
    return 'State Page';
  }

  return 'Other';
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
  if (!code || code === 'unknown' || code === 'US') return 'National';
  return code;
}

function generateTopInsights({
  returningVisitors,
  radar,
  locationSearch,
  savedLocations,
  userJourneys,
  missingLocationSearches,
  countyAlertViews,
}) {
  const insights = [];

  if (radar?.insights?.topState) {
    insights.push({
      id: 'top-radar-state',
      label: 'Most viewed radar state',
      value: formatRadarStateLabel(radar.insights.topState.stateCode),
      detail: `${radar.insights.topState.openCount.toLocaleString()} opens`,
    });
  }

  if (returningVisitors?.returningVisitors > 0) {
    insights.push({
      id: 'returning-visitors',
      label: 'Returning visitors',
      value: returningVisitors.returningVisitors.toLocaleString(),
      detail: `${returningVisitors.returningPct}% of sessions`,
    });
  }

  const topPath = userJourneys?.topPaths?.[0];
  if (topPath?.path) {
    insights.push({
      id: 'common-journey',
      label: 'Most common journey',
      value: topPath.session_count.toLocaleString() + ' sessions',
      detail: topPath.path.replace(/_/g, ' ').slice(0, 80),
    });
  }

  if (userJourneys?.mainJourney?.overallCompletionPct != null) {
    insights.push({
      id: 'main-conversion',
      label: 'Homepage → Save conversion',
      value: `${userJourneys.mainJourney.overallCompletionPct}%`,
      detail: 'Main product funnel completion',
    });
  }

  if (radar?.totalOpens > 0) {
    insights.push({
      id: 'radar-opens',
      label: 'Total radar opens',
      value: radar.totalOpens.toLocaleString(),
      detail: radar.insights?.avgOpensPerSession
        ? `${radar.insights.avgOpensPerSession} avg per session`
        : undefined,
    });
  }

  if (locationSearch?.successRate != null && locationSearch.totalSearches > 0) {
    insights.push({
      id: 'search-success',
      label: 'Location search success',
      value: `${locationSearch.successRate}%`,
      detail: `${locationSearch.totalSearches.toLocaleString()} total searches`,
    });
  }

  const topSaveState = savedLocations?.savesByState?.[0];
  if (topSaveState) {
    insights.push({
      id: 'top-save-state',
      label: 'Top saved state',
      value: topSaveState.state,
      detail: `${topSaveState.save_count} saves`,
    });
  }

  if (missingLocationSearches?.totalFailed > 0) {
    insights.push({
      id: 'missing-searches',
      label: 'Failed location searches',
      value: missingLocationSearches.totalFailed.toLocaleString(),
      detail: `${missingLocationSearches.searches?.length ?? 0} unique queries`,
    });
  }

  if (countyAlertViews?.totalViews > 0) {
    const topCounty = countyAlertViews.topViewed?.[0];
    insights.push({
      id: 'county-views',
      label: 'County alert views',
      value: countyAlertViews.totalViews.toLocaleString(),
      detail: topCounty
        ? `Top: ${topCounty.county_name}, ${topCounty.state_code}`
        : undefined,
    });
  }

  return insights.slice(0, 8);
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

async function fetchAllAnalytics(supabase, dateRange) {
  const since = getSinceDate(dateRange);

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

  const topInsights = generateTopInsights({
    returningVisitors,
    radar,
    locationSearch,
    savedLocations,
    userJourneys,
    missingLocationSearches,
    countyAlertViews,
  });

  const recommendedActions = generateRecommendedActions({
    missingLocationSearches,
    userJourneys,
    countyAlertViews,
    savedLocations,
    radar,
    locationSearch,
    returningVisitors,
  });

  return {
    dateRange,
    since,
    topInsights,
    recommendedActions,
    returningVisitors,
    missingLocationSearches,
    locationSearch,
    locationSources,
    countyAlertViews,
    savedLocations,
    radar,
    userJourneys,
  };
}

async function generateMorningBrief(analytics, period) {
  const periodLabel = PERIOD_LABELS[period] || period;
  const payload = buildAnalysisPayload({
    periodLabel,
    ...analytics,
  });

  const haikuResult = await callHaiku({
    systemPrompt: MORNING_BRIEF_SYSTEM,
    userPrompt: buildMorningBriefPrompt(payload),
    maxTokens: 800,
  });

  const { parsed, parseError } = parseHaikuJSON(haikuResult.text);
  if (!parsed) {
    throw new Error(`Haiku returned unparseable JSON: ${parseError}`);
  }

  return {
    brief: parsed,
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

  const haikuResult = await callHaiku({
    systemPrompt: OPERATIONS_CENTER_SYSTEM,
    userPrompt: buildOperationsCenterPrompt(payload),
    maxTokens: 1500,
  });

  const { parsed, parseError } = parseHaikuJSON(haikuResult.text);
  if (!parsed) {
    throw new Error(`Haiku returned unparseable JSON: ${parseError}`);
  }

  return {
    analysis: {
      attention_needed: parsed.attention_needed || [],
      opportunities: parsed.opportunities || [],
      weather_drivers: parsed.weather_drivers || [],
      retention_signals: parsed.retention_signals || [],
      recommended_actions: (parsed.recommended_actions || []).slice(0, 3),
      wins: parsed.wins || [],
    },
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
