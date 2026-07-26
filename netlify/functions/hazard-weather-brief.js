/**
 * hazard-weather-brief
 *
 * Weather Intelligence Layer API for hazard Weather Briefs.
 *
 * Public:
 *   GET ?hazard=tornado-warning
 *     → Hazard Engine snapshot + resolved brief (may regenerate server-side)
 *
 * Admin (x-admin-token):
 *   GET ?hazard=…&history=1
 *   POST { action: "generate"|"set_override"|"clear_override", hazard, ... }
 *
 * Stores editorial content only in Supabase — never NWS alert payloads.
 */

const {
  ALERTS_API,
  NWS_HEADERS,
  extractStateCode,
  extractLocationName,
  extractGeometryCoordinates,
  getCategoryForEvent,
  filterAlertFeatures,
} = require('../../shared/nws-alert-parser.js');

const {
  hazardEngine,
  get: getHazardSnapshot,
} = require('../../shared/hazard-engine/index.js');

const {
  HAIKU_MODEL,
  callHaikuForJSON,
} = require('./lib/haiku-client');

const { getSupabaseAdmin } = require('./lib/supabase-admin');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

function requireAdmin(event) {
  const expected = process.env.ADMIN_FUNCTION_TOKEN;
  const token = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (!expected || !token || token !== expected) {
    return false;
  }
  return true;
}

function parseAlertForEngine(rawAlert) {
  const props = rawAlert.properties || {};
  const eventType = props.event || '';
  const category = getCategoryForEvent(eventType);
  if (!category) return null;

  const coords = extractGeometryCoordinates(rawAlert);

  return {
    id: rawAlert.id || props.id,
    event: eventType,
    category,
    state: extractStateCode(rawAlert),
    ugc: props.geocode?.UGC || [],
    location: extractLocationName(rawAlert),
    lat: coords?.lat || null,
    lon: coords?.lon || null,
    headline: props.headline || eventType,
    description: props.description?.substring(0, 400) || '',
    fullDescription: props.description || '',
    severity: props.severity,
    urgency: props.urgency,
    certainty: props.certainty || null,
    onset: props.onset,
    effective: props.effective || null,
    sent: props.sent || null,
    expires: props.expires,
    areaDesc: props.areaDesc,
    instruction: props.instruction || null,
    senderName: props.senderName || null,
    parameters: props.parameters || null,
  };
}

async function fetchActiveAlerts() {
  const response = await fetch(ALERTS_API, { headers: NWS_HEADERS });
  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status}`);
  }
  const data = await response.json();
  const features = filterAlertFeatures(data.features || []);
  return {
    alerts: features.map(parseAlertForEngine).filter(Boolean),
    fetchedAt: new Date().toISOString(),
  };
}

async function loadCachedBrief(supabase, hazardSlug) {
  const { data, error } = await supabase
    .from('hazard_weather_briefs')
    .select('*')
    .eq('hazard_slug', hazardSlug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadBriefHistory(supabase, hazardSlug, limit = 20) {
  const { data, error } = await supabase
    .from('hazard_weather_brief_history')
    .select('*')
    .eq('hazard_slug', hazardSlug)
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function appendHistory(supabase, row) {
  const { error } = await supabase.from('hazard_weather_brief_history').insert({
    hazard_slug: row.hazard_slug,
    summary: row.summary,
    active_count: row.active_count ?? 0,
    affected_state_codes: row.affected_state_codes || [],
    source_alert_ids: row.source_alert_ids || [],
    model: row.model || null,
    prompt_version: row.prompt_version || null,
    generated_at: row.generated_at || new Date().toISOString(),
  });
  if (error) throw error;
}

async function upsertBrief(supabase, payload) {
  const existing = await loadCachedBrief(supabase, payload.hazard_slug);

  // Archive previous version when replacing a real summary
  if (existing?.summary && payload.archive_previous !== false) {
    await appendHistory(supabase, existing);
  }

  const row = {
    hazard_slug: payload.hazard_slug,
    summary: payload.summary,
    notable_change: payload.notable_change ?? null,
    active_count: payload.active_count ?? 0,
    affected_state_codes: payload.affected_state_codes || [],
    source_alert_ids: payload.source_alert_ids || [],
    data_signature: payload.data_signature || null,
    model: payload.model || null,
    prompt_version: payload.prompt_version || null,
    generated_at: payload.generated_at || new Date().toISOString(),
    expires_at: payload.expires_at || null,
    status: payload.status || 'valid',
    // Preserve manual override fields unless explicitly changed
    manual_summary: payload.manual_summary !== undefined
      ? payload.manual_summary
      : (existing?.manual_summary ?? null),
    manual_override: payload.manual_override !== undefined
      ? payload.manual_override
      : (existing?.manual_override ?? false),
  };

  const { data, error } = await supabase
    .from('hazard_weather_briefs')
    .upsert(row, { onConflict: 'hazard_slug' })
    .select('*')
    .single();
  if (error) throw error;

  return data;
}

async function generateClaudeBrief(snapshot) {
  const llmPayload = hazardEngine.buildBriefLlmPayload({
    config: snapshot.config,
    activeCount: snapshot.activeCount,
    affectedStates: snapshot.affectedStates,
    affectedCounties: snapshot.affectedCounties,
    alerts: snapshot.alerts,
    previousSummary: snapshot.weatherBrief?.source === 'cached'
      ? snapshot.weatherBrief.summary
      : null,
    previousDataSignature: snapshot.dataSignature,
    maxAlerts: hazardEngine.MAX_ALERTS_TO_LLM,
  });

  const { parsed: raw, parseError } = await callHaikuForJSON({
    systemPrompt: hazardEngine.BRIEF_SYSTEM_PROMPT,
    userPrompt: hazardEngine.buildBriefUserPrompt(llmPayload),
    maxTokens: 800,
  });

  if (!raw) {
    return {
      raw: null,
      validation: { ok: false, reasons: [parseError ? `parse_error:${parseError}` : 'malformed_json'] },
      llmPayload,
    };
  }

  const validation = hazardEngine.validateBriefResponse(raw, {
    affectedStateNames: snapshot.affectedStates.map((s) => s.name),
    affectedCountyNames: snapshot.affectedCounties.map((c) => c.name),
    activeCount: snapshot.activeCount,
  });

  return { raw, validation, llmPayload };
}

function publicSnapshot(snapshot, { regenerationAttempted = false, regenerationError = null } = {}) {
  // Strip bulky alert bodies for public payload; keep list essentials
  const alerts = (snapshot.alerts || []).map((a) => ({
    id: a.id,
    event: a.event,
    headline: a.headline,
    areaDesc: a.areaDesc,
    location: a.location,
    state: a.state,
    severity: a.severity,
    urgency: a.urgency,
    certainty: a.certainty,
    onset: a.onset,
    expires: a.expires,
    lat: a.lat,
    lon: a.lon,
    description: a.description,
    category: a.category,
  }));

  return {
    ok: snapshot.ok,
    hazardSlug: snapshot.hazardSlug,
    hazardLabel: snapshot.hazardLabel,
    pluralLabel: snapshot.pluralLabel,
    pageTitle: snapshot.pageTitle,
    shortLabel: snapshot.shortLabel,
    intro: snapshot.intro,
    icon: snapshot.icon,
    severityColor: snapshot.severityColor,
    radarFilter: snapshot.radarFilter,
    radarCategory: snapshot.radarCategory,
    nwsEvents: snapshot.nwsEvents,
    seoTitle: snapshot.seoTitle,
    seoDescription: snapshot.seoDescription,
    educationalContentKey: snapshot.educationalContentKey,
    href: snapshot.href,
    radarHref: snapshot.radarHref,
    alertsHref: snapshot.alertsHref,
    fullRadarHref: snapshot.fullRadarHref,
    activeCount: snapshot.activeCount,
    alerts,
    affectedStates: snapshot.affectedStates,
    affectedCounties: snapshot.affectedCounties.slice(0, 40),
    stateLinks: snapshot.stateLinks,
    newestIssuedAt: snapshot.newestIssuedAt,
    latestSourceUpdateAt: snapshot.latestSourceUpdateAt,
    earliestExpirationAt: snapshot.earliestExpirationAt,
    highestSeverity: snapshot.highestSeverity,
    highestUrgency: snapshot.highestUrgency,
    highestCertainty: snapshot.highestCertainty,
    hasExtremeAlert: snapshot.hasExtremeAlert,
    sourceAlertIds: snapshot.sourceAlertIds,
    dataSignature: snapshot.dataSignature,
    liveStatus: snapshot.liveStatus,
    weatherBrief: snapshot.weatherBrief,
    relatedHazards: snapshot.relatedHazards,
    freshness: snapshot.freshness,
    confidence: snapshot.confidence,
    updatedAt: snapshot.updatedAt,
    regeneration: {
      ...snapshot.regeneration,
      attempted: regenerationAttempted,
      error: regenerationError,
    },
  };
}

async function buildAndMaybeRegenerate({
  hazardSlug,
  force = false,
  allowGenerate = true,
}) {
  const supabase = getSupabaseAdmin();
  let alerts = [];
  let fetchedAt = null;
  let dataAvailable = true;

  try {
    const feed = await fetchActiveAlerts();
    alerts = feed.alerts;
    fetchedAt = feed.fetchedAt;
  } catch (err) {
    console.error('[hazard-weather-brief] NWS fetch failed:', err.message);
    dataAvailable = false;
  }

  const relatedCounts = hazardEngine.getRelatedCounts(alerts);
  let cachedBrief = null;
  try {
    cachedBrief = await loadCachedBrief(supabase, hazardSlug);
  } catch (err) {
    console.error('[hazard-weather-brief] brief load failed:', err.message);
  }

  let snapshot = getHazardSnapshot(hazardSlug, alerts, {
    cachedBrief,
    relatedCounts,
    latestSourceUpdateAt: fetchedAt,
    dataAvailable,
  });

  if (!snapshot.ok) {
    return { snapshot, cachedBrief };
  }

  const shouldRun = allowGenerate && (
    force ||
    (dataAvailable && snapshot.regeneration.shouldRegenerate && !cachedBrief?.manual_override)
  );

  let regenerationAttempted = false;
  let regenerationError = null;

  if (shouldRun) {
    regenerationAttempted = true;
    try {
      // Serve fallback immediately in snapshot; update cache after generation
      const { validation } = await generateClaudeBrief(snapshot);
      if (!validation.ok) {
        regenerationError = `rejected:${validation.reasons.join(',')}`;
        await upsertBrief(supabase, {
          hazard_slug: hazardSlug,
          summary: cachedBrief?.summary || null,
          notable_change: null,
          active_count: snapshot.activeCount,
          affected_state_codes: snapshot.affectedStates.map((s) => s.code),
          source_alert_ids: snapshot.sourceAlertIds,
          data_signature: snapshot.dataSignature,
          model: HAIKU_MODEL,
          prompt_version: hazardEngine.PROMPT_VERSION,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (snapshot.activeCount > 0 ? 20 : 120) * 60 * 1000).toISOString(),
          status: 'failed',
          archive_previous: false,
        });
      } else {
        const expiresAt = new Date(
          Date.now() + (snapshot.activeCount > 0 ? 20 : 120) * 60 * 1000
        ).toISOString();
        cachedBrief = await upsertBrief(supabase, {
          hazard_slug: hazardSlug,
          summary: validation.brief.summary,
          notable_change: validation.brief.notableChange,
          active_count: snapshot.activeCount,
          affected_state_codes: snapshot.affectedStates.map((s) => s.code),
          source_alert_ids: snapshot.sourceAlertIds,
          data_signature: snapshot.dataSignature,
          model: HAIKU_MODEL,
          prompt_version: hazardEngine.PROMPT_VERSION,
          generated_at: new Date().toISOString(),
          expires_at: expiresAt,
          status: 'valid',
        });
        snapshot = getHazardSnapshot(hazardSlug, alerts, {
          cachedBrief,
          relatedCounts,
          latestSourceUpdateAt: fetchedAt,
          dataAvailable,
        });
      }
    } catch (err) {
      console.error('[hazard-weather-brief] generation failed:', err.message);
      regenerationError = err.message;
      try {
        await upsertBrief(supabase, {
          hazard_slug: hazardSlug,
          summary: cachedBrief?.summary || null,
          active_count: snapshot.activeCount,
          affected_state_codes: snapshot.affectedStates.map((s) => s.code),
          source_alert_ids: snapshot.sourceAlertIds,
          data_signature: snapshot.dataSignature,
          model: HAIKU_MODEL,
          prompt_version: hazardEngine.PROMPT_VERSION,
          generated_at: new Date().toISOString(),
          status: 'failed',
          archive_previous: false,
        });
      } catch (e) {
        console.error('[hazard-weather-brief] failed status write:', e.message);
      }
    }
  }

  return {
    snapshot,
    cachedBrief,
    regenerationAttempted,
    regenerationError,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const hazardSlug = params.hazard;
      if (!hazardSlug || !hazardEngine.getConfig(hazardSlug)) {
        return json(404, { ok: false, error: 'unknown_hazard' });
      }

      const isAdmin = requireAdmin(event);

      if (params.history === '1') {
        if (!isAdmin) return json(401, { ok: false, error: 'unauthorized' });
        const supabase = getSupabaseAdmin();
        const [brief, history] = await Promise.all([
          loadCachedBrief(supabase, hazardSlug),
          loadBriefHistory(supabase, hazardSlug),
        ]);
        return json(200, { ok: true, brief, history });
      }

      // Public GET: return snapshot; regenerate only when needed (and not on every bot hit if disabled)
      const skipGenerate = params.skipGenerate === '1';
      const force = isAdmin && params.force === '1';
      const result = await buildAndMaybeRegenerate({
        hazardSlug,
        force,
        allowGenerate: !skipGenerate,
      });

      const body = publicSnapshot(result.snapshot, {
        regenerationAttempted: result.regenerationAttempted,
        regenerationError: result.regenerationError,
      });

      if (isAdmin) {
        body.cachedBrief = result.cachedBrief;
        body.fallbackPreview = hazardEngine.buildFallbackBrief(
          result.snapshot.config,
          {
            activeCount: result.snapshot.activeCount,
            affectedStates: result.snapshot.affectedStates,
          }
        );
      }

      return json(200, body);
    }

    if (event.httpMethod === 'POST') {
      if (!requireAdmin(event)) {
        return json(401, { ok: false, error: 'unauthorized' });
      }

      const body = JSON.parse(event.body || '{}');
      const hazardSlug = body.hazard;
      if (!hazardSlug || !hazardEngine.getConfig(hazardSlug)) {
        return json(404, { ok: false, error: 'unknown_hazard' });
      }

      const supabase = getSupabaseAdmin();
      const action = body.action || 'generate';

      if (action === 'set_override') {
        const manualSummary = String(body.manual_summary || '').trim();
        if (!manualSummary) {
          return json(400, { ok: false, error: 'manual_summary_required' });
        }
        const existing = await loadCachedBrief(supabase, hazardSlug);
        const { data, error } = await supabase
          .from('hazard_weather_briefs')
          .upsert({
            hazard_slug: hazardSlug,
            summary: existing?.summary || null,
            manual_summary: manualSummary,
            manual_override: true,
            status: existing?.status || 'valid',
            active_count: existing?.active_count || 0,
            affected_state_codes: existing?.affected_state_codes || [],
            source_alert_ids: existing?.source_alert_ids || [],
            data_signature: existing?.data_signature || null,
            model: existing?.model || null,
            prompt_version: existing?.prompt_version || null,
            generated_at: existing?.generated_at || null,
            expires_at: existing?.expires_at || null,
          }, { onConflict: 'hazard_slug' })
          .select('*')
          .single();
        if (error) throw error;
        return json(200, { ok: true, brief: data });
      }

      if (action === 'clear_override') {
        const existing = await loadCachedBrief(supabase, hazardSlug);
        if (!existing) {
          return json(404, { ok: false, error: 'no_brief' });
        }
        const { data, error } = await supabase
          .from('hazard_weather_briefs')
          .update({ manual_override: false })
          .eq('hazard_slug', hazardSlug)
          .select('*')
          .single();
        if (error) throw error;
        return json(200, { ok: true, brief: data });
      }

      if (action === 'generate') {
        const result = await buildAndMaybeRegenerate({
          hazardSlug,
          force: true,
          allowGenerate: true,
        });
        return json(200, {
          ...publicSnapshot(result.snapshot, {
            regenerationAttempted: result.regenerationAttempted,
            regenerationError: result.regenerationError,
          }),
          cachedBrief: result.cachedBrief,
          fallbackPreview: hazardEngine.buildFallbackBrief(result.snapshot.config, {
            activeCount: result.snapshot.activeCount,
            affectedStates: result.snapshot.affectedStates,
          }),
        });
      }

      return json(400, { ok: false, error: 'unknown_action' });
    }

    return json(405, { ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[hazard-weather-brief]', err);
    return json(500, { ok: false, error: err.message || 'server_error' });
  }
};
