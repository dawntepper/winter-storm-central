/**
 * Build anonymized, aggregated stats for AI analysis — no PII.
 */

function formatEventName(name) {
  if (!name) return 'unknown';
  return String(name).replace(/_/g, ' ');
}

function buildAnalysisPayload({
  periodLabel,
  returningVisitors,
  missingLocationSearches,
  locationSearch,
  locationSources,
  countyAlertViews,
  savedLocations,
  radar,
  userJourneys,
  topInsights,
  recommendedActions,
  morningBrief,
  metricTrends,
  analyticsHealth,
  expansionOpportunities,
}) {
  const mainJourney = userJourneys?.mainJourney;
  const mainDrop = mainJourney?.biggestDropOff;

  return {
    period: periodLabel,
    analyticsHealth: analyticsHealth || null,
    metricTrends: metricTrends || null,
    expansionOpportunities: expansionOpportunities || null,
    visitors: {
      totalSessions: returningVisitors?.totalSessions ?? 0,
      uniqueVisitors: returningVisitors?.uniqueVisitors ?? 0,
      newVisitors: returningVisitors?.newVisitors ?? 0,
      returningVisitors: returningVisitors?.returningVisitors ?? 0,
      returningPct: returningVisitors?.returningPct ?? 0,
      returningTrend: returningVisitors?.returningTrend ?? null,
      periodTrend: returningVisitors?.trend ?? metricTrends?.returningVisitors ?? null,
      avgReturningPct: returningVisitors?.avgReturningPct ?? 0,
    },
    locationSearch: {
      totalSearches: locationSearch?.totalSearches ?? 0,
      successfulSearches: locationSearch?.successfulSearches ?? 0,
      failedSearches: locationSearch?.failedSearches ?? 0,
      successRate: locationSearch?.successRate ?? 0,
      periodTrend: locationSearch?.trend ?? metricTrends?.locationSearches ?? null,
      topLocations: (locationSearch?.topLocations || []).slice(0, 8).map((r) => ({
        query: r.query,
        state: r.state_code || null,
        count: r.search_count,
      })),
      topMissing: (locationSearch?.topMissing || []).slice(0, 8).map((r) => ({
        query: r.query,
        state: r.state_code || null,
        count: r.search_count,
      })),
      searchesBySource: (locationSearch?.searchesBySource || []).slice(0, 6),
    },
    locationSources: locationSources || {},
    missingSearches: {
      totalFailed: missingLocationSearches?.totalFailed ?? 0,
      recommendedCities: (missingLocationSearches?.recommendedCities || []).slice(0, 8),
      topQueries: (missingLocationSearches?.searches || []).slice(0, 8).map((r) => ({
        query: r.query,
        state: r.state_context || r.state_code || null,
        count: r.search_count,
      })),
    },
    countyAlertViews: {
      totalViews: countyAlertViews?.totalViews ?? 0,
      periodTrend: countyAlertViews?.trend ?? metricTrends?.countyAlertViews ?? null,
      topViewed: (countyAlertViews?.topViewed || []).slice(0, 8).map((r) => ({
        county: r.county_name,
        state: r.state_code,
        views: r.view_count,
      })),
      generatingRadar: (countyAlertViews?.generatingRadar || []).slice(0, 5).map((r) => ({
        county: r.county_name,
        state: r.state_code,
        radarViews: r.radar_view_count,
      })),
    },
    savedLocations: {
      totalSaved: savedLocations?.totalSaved ?? 0,
      signedInUsers: savedLocations?.signedInUsers ?? 0,
      periodTrend: savedLocations?.trend ?? metricTrends?.savedLocations ?? null,
      topStates: (savedLocations?.savesByState || []).slice(0, 6),
      topLocations: (savedLocations?.topLocations || []).slice(0, 6).map((r) => ({
        location: r.location_name,
        state: r.state || null,
        saves: r.save_count,
      })),
    },
    radar: {
      totalOpens: radar?.totalOpens ?? 0,
      periodTrend: radar?.trend ?? metricTrends?.radarOpens ?? null,
      avgOpensPerSession: radar?.insights?.avgOpensPerSession ?? 0,
      topState: radar?.insights?.topState ?? null,
      topLocation: radar?.insights?.topLocation ?? null,
      opensByState: (radar?.opensByState || []).slice(0, 8),
      topRadarTypes: (radar?.topRadarTypes || []).slice(0, 5),
    },
    userJourneys: {
      mainJourneyConversion: mainJourney?.overallCompletionPct ?? 0,
      biggestDropOff: mainDrop
        ? {
            step: mainDrop.step,
            event: formatEventName(mainDrop.eventName),
            dropoffPct: mainDrop.dropoffPct,
            sessionsLost: mainDrop.sessionsLost,
          }
        : null,
      topPaths: (userJourneys?.topPaths || []).slice(0, 5).map((r) => ({
        path: (r.path || '').replace(/_/g, ' '),
        sessions: r.session_count,
      })),
      funnelCompletions: Object.fromEntries(
        Object.entries(userJourneys?.funnels || {}).map(([id, funnel]) => [
          id,
          funnel?.overallCompletionPct ?? 0,
        ])
      ),
    },
    topInsights: (topInsights || []).slice(0, 8),
    ruleBasedActions: (recommendedActions || []).slice(0, 6),
    morningBrief: morningBrief || null,
  };
}

const MORNING_BRIEF_SYSTEM = `You are a product analytics assistant for StormTracking.io, a free storm-tracking site.

Write a concise "Morning Brief" for the admin team based on aggregated analytics only. No PII, no individual users.

VOICE: Direct, operational, calm. Action-oriented bullets.

FOCUS ON CHANGE, NOT JUST SUMMARY:
- Lead with what changed vs the previous equivalent period (metricTrends, periodTrend fields show % change).
- Call out state-level spikes in radar opens or location searches when opensByState or topLocations shift.
- Highlight returning visitor changes (returningPct, periodTrend, returningTrend).
- Note failed searches and expansion opportunities when relevant.
- If analyticsHealth shows warnings, mention tracking gaps briefly.

Output valid JSON with keys:
- headline (string, one sentence — the single most important CHANGE or takeaway)
- bullets (array of 3-5 short strings, each emphasizing change, spike, or action — include % changes when available)
- generated_at_note (string, brief note about the period covered and comparison baseline)`;

const OPERATIONS_CENTER_SYSTEM = `You are an operations analyst for StormTracking.io admin dashboard.

Analyze aggregated product analytics and produce an operations briefing. Use only the data provided — no speculation about weather not implied by traffic patterns. No PII.

Focus on actionability over raw statistics. Short bullet items only — no paragraphs.
Use metricTrends and periodTrend fields to explain what changed vs the prior equivalent period.

Output valid JSON with these exact keys:
- what_changed (array of { text: string } — key metric shifts with % change vs prior period, max 5)
- opportunities (array of { text: string } — city/county expansion, forecast links, growth areas, max 5)
- risks (array of { priority: "high"|"medium"|"low", text: string } — funnel drop-offs, tracking gaps, declining metrics, max 5)
- attention_needed (array of { priority: "high"|"medium"|"low", text: string } — issues needing admin attention, max 5)
- weather_drivers (array of { text: string } — hypotheses for why traffic is changing based on geography/engagement patterns, max 4)
- retention_signals (array of { text: string } — habit formation, returning visitors, saves, max 4)
- recommended_actions (array of exactly 3 { title: string, detail: string } — top 3 concrete next steps)
- wins (array of { text: string } — positive progress to celebrate, max 4)`;

function buildMorningBriefPrompt(payload) {
  return `Period: ${payload.period}

Compare current period metrics against metricTrends (previous equivalent period). Explain CHANGE, not just levels.

Aggregated analytics (no PII):
${JSON.stringify(payload, null, 2)}

Write the morning brief JSON. Each bullet should highlight a change, spike, or actionable shift.`;
}

function buildOperationsCenterPrompt(payload) {
  return `Period: ${payload.period}

Use metricTrends and periodTrend to populate what_changed with % shifts. Use expansionOpportunities for opportunities. Flag risks from declining trends, funnel drop-offs, or analyticsHealth warnings.

Aggregated analytics (no PII):
${JSON.stringify(payload, null, 2)}

Produce the operations center briefing JSON. Prioritize risks and attention_needed by severity. recommended_actions must have exactly 3 items.`;
}

module.exports = {
  buildAnalysisPayload,
  MORNING_BRIEF_SYSTEM,
  OPERATIONS_CENTER_SYSTEM,
  buildMorningBriefPrompt,
  buildOperationsCenterPrompt,
};
