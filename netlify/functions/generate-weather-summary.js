/**
 * generate-weather-summary
 *
 * Admin-only endpoint that pulls active NWS alerts, filters them, and asks
 * Claude Haiku to produce social-media copy in four formats (newsletter,
 * X/Twitter thread, Instagram caption, Facebook post).
 *
 * Phase 1: generation only — no Blobs persistence yet.
 *
 * Auth: requires x-admin-token header matching process.env.ADMIN_FUNCTION_TOKEN.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY     — Anthropic API key (sk-ant-...)
 *   ADMIN_FUNCTION_TOKEN  — shared secret; frontend sends as x-admin-token
 *
 * Optional (history persistence via Netlify Blobs):
 *   NETLIFY_BLOBS_TOKEN   — Personal Access Token with Blobs scope (app.netlify.com/user/applications)
 *   NETLIFY_SITE_ID       — auto-injected on Netlify; only needed for local `netlify dev` without Blobs context
 *   Without valid Blobs auth, generation still works — only history save/load is skipped.
 *
 * Request body (JSON):
 *   {
 *     "tone_preset":   "standard" | "urgent" | "conversational",
 *     "filter_preset": "all-severe" | "tornado-hurricane-blizzard" | "custom-states",
 *     "custom_states": ["TX", "OK", ...]   // only used when filter_preset === "custom-states"
 *   }
 */

const {
  ALERTS_API,
  NWS_HEADERS,
  extractStateCode,
  extractLocationName,
  MARINE_ZONE_PREFIXES,
} = require('../../shared/nws-alert-parser.js');

const { connectLambda, getStore } = require('@netlify/blobs');
const {
  HAIKU_MODEL,
  getAnthropicApiKey,
  callHaiku,
  parseHaikuJSON,
} = require('./lib/haiku-client');

const BLOB_STORE_NAME = 'weather-summaries';
const INDEX_KEY = 'summaries-index';
const SUMMARY_KEY_PREFIX = 'summary:';
const INDEX_SCHEMA_VERSION = '1.0';

// Cap how many alerts we send to Haiku — keeps input token usage predictable.
// We sort by severity + significance before slicing.
const MAX_ALERTS_TO_LLM = 50;
// Truncate per-alert description to avoid runaway input cost on alerts with
// huge formatted forecast text. Haiku still gets event + headline + areas.
const ALERT_DESC_MAX_CHARS = 400;

const TONE_PRESETS = new Set(['standard', 'urgent', 'conversational']);
const FILTER_PRESETS = new Set(['all-severe', 'tornado-hurricane-blizzard', 'custom-states']);

// Used by the tornado/hurricane/blizzard filter preset. Flash Flood Emergency
// is a sub-tier of Flash Flood Warning detected via the headline string.
const TORNADO_HURRICANE_BLIZZARD_EVENTS = new Set([
  'Tornado Warning',
  'Tornado Watch',
  'Hurricane Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Blizzard Warning',
]);

// Events to drop from the default all-severe preset because they add noise
// without changing the social-media story. (Beach Hazards / Air Quality are
// already excluded by the parser's INCLUDED_EVENTS list, but Frost Advisory
// is included there and we want to drop it for summaries.)
const ROUTINE_NOISE_EVENTS = new Set([
  'Frost Advisory',
]);

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT_BASE = `You are a weather summary writer for StormTracking.io, a free, ad-free storm tracking site. Generate social media summaries based on active National Weather Service alerts.

VOICE AND TONE:
- Factual, calm, helpful — never alarmist
- "Trusted neighbor who watches the weather" — not TV news drama
- Match the StormTracking brand: respectful of the reader's time, ad-free, no fluff
- Never speculate beyond NWS data
- Never invent details, locations, or numbers not present in the alerts
- Don't add safety advice unless it's directly stated in an NWS message

AVOID:
- Hype words: "monster," "killer," "deadly," "catastrophic" (unless NWS uses these exact words)
- Excessive emoji — one or two functional ones at most (🌪️ for tornado, ❄️ for winter, 🔥 for fire)
- Excessive exclamation marks
- Weather jargon without context
- Speculation about damage, casualties, or future development
- All-caps shouting

CRITICAL:
- If unsure about a detail, omit it
- If alerts contradict, note it
- Always include a CTA to stormtracking.io in newsletter format
- For Twitter/X, the first post is the hook — most significant threat first. Each post must fit in 280 characters.
- For Instagram, conversational and accessible to non-weather-watchers
- Output as valid JSON with exact keys: headline, newsletter, twitter_thread (array), instagram_caption, facebook_post, primary_threats (array of slugs), affected_regions (array of state slugs)`;

const TONE_MODIFIERS = {
  standard: '',
  urgent: `\n\nTONE OVERRIDE: Today's alerts include life-threatening situations. Be direct and clear about specific threats and timing without being alarmist. Use shorter sentences. Lead with the most dangerous threat in every format.`,
  conversational: `\n\nTONE OVERRIDE: Use a more personal voice, as if speaking to a friend. First person plural ("we're seeing...") is okay. Slightly longer sentences. Still factual.`,
};

function buildSystemPrompt(tonePreset) {
  return SYSTEM_PROMPT_BASE + (TONE_MODIFIERS[tonePreset] || '');
}

function buildUserPrompt({ tonePreset, filterName, totalCount, filteredAlerts }) {
  const trimmed = filteredAlerts.map((a) => ({
    event: a.event,
    severity: a.severity,
    headline: a.headline,
    description: truncate(a.description || '', ALERT_DESC_MAX_CHARS),
    areas: a.areas,
    expires: a.expires,
  }));
  const today = new Date().toISOString().slice(0, 10);
  return `Tone preset: ${tonePreset}
Date: ${today}
Total active alerts: ${totalCount}
Filtered alerts (${filterName}):

${JSON.stringify(trimmed, null, 2)}

Generate the four social media formats plus structured metadata. Output ONLY valid JSON, no preamble.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function truncate(str, maxChars) {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 1) + '…';
}

function isMarineOnly(alert) {
  const ugcs = alert?.properties?.geocode?.UGC || [];
  if (ugcs.length === 0) return false;
  return ugcs.every((u) => MARINE_ZONE_PREFIXES.includes(String(u).substring(0, 2)));
}

function isTropicalEvent(event) {
  return /Hurricane|Tropical Storm|Storm Surge/i.test(event || '');
}

// Severity rank for sorting. Extreme > Severe > Moderate > Minor > Unknown.
const SEVERITY_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };
function severityRank(s) {
  return SEVERITY_RANK[s] || 0;
}

// ============================================================================
// FILTER PRESETS
// ============================================================================

function applyAllSevereFilter(features) {
  return features.filter((a) => {
    const p = a.properties || {};
    const sev = p.severity;
    if (sev !== 'Severe' && sev !== 'Extreme') return false;
    if (ROUTINE_NOISE_EVENTS.has(p.event)) return false;
    if (isMarineOnly(a) && !isTropicalEvent(p.event)) return false;
    return true;
  });
}

function applyTornadoHurricaneBlizzardFilter(features) {
  return features.filter((a) => {
    const p = a.properties || {};
    if (TORNADO_HURRICANE_BLIZZARD_EVENTS.has(p.event)) return true;
    if (p.event === 'Flash Flood Warning' && /FLASH FLOOD EMERGENCY/i.test(p.headline || '')) {
      return true;
    }
    return false;
  });
}

function applyCustomStatesFilter(features, states) {
  const set = new Set(states.map((s) => String(s).toUpperCase()));
  return features.filter((a) => {
    const state = extractStateCode(a);
    if (!state) return false;
    return set.has(state);
  });
}

function applyFilter(features, filterPreset, customStates) {
  switch (filterPreset) {
    case 'all-severe':
      return applyAllSevereFilter(features);
    case 'tornado-hurricane-blizzard':
      return applyTornadoHurricaneBlizzardFilter(features);
    case 'custom-states':
      return applyCustomStatesFilter(features, customStates || []);
    default:
      return [];
  }
}

// Build the trimmed alert shape we'll send to Haiku (and return to the caller).
function shapeAlertForOutput(alert) {
  const p = alert.properties || {};
  return {
    id: p.id || alert.id,
    event: p.event,
    severity: p.severity,
    urgency: p.urgency,
    headline: p.headline || '',
    description: p.description || '',
    areas: extractLocationName(alert),
    areaDesc: p.areaDesc || '',
    state: extractStateCode(alert),
    expires: p.expires || null,
    onset: p.onset || null,
  };
}

// ============================================================================
// NWS FETCH
// ============================================================================

async function fetchActiveAlerts() {
  const resp = await fetch(ALERTS_API, { headers: NWS_HEADERS });
  if (!resp.ok) {
    throw new Error(`NWS API returned ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  return Array.isArray(data?.features) ? data.features : [];
}

// ============================================================================
// STORAGE (Netlify Blobs)
// ============================================================================

function summariesStore() {
  // Prefer Lambda/deploy context (after connectLambda in the handler). Explicit
  // PAT only outside Netlify runtime — stale tokens in prod 401 every blob op.
  const runningOnNetlify = Boolean(
    process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (!runningOnNetlify) {
    const blobsToken = process.env.NETLIFY_BLOBS_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    if (blobsToken && siteID) {
      return getStore({ name: BLOB_STORE_NAME, siteID, token: blobsToken });
    }
  }
  return getStore(BLOB_STORE_NAME);
}

function storageErrorMessage(err) {
  return err?.message || String(err);
}

function isStorageUnavailableError(err) {
  const msg = storageErrorMessage(err);
  return /401|403|MissingBlobsEnvironment|Unauthorized|internal error/i.test(msg);
}

function summaryKeyForDate(date) {
  return `${SUMMARY_KEY_PREFIX}${date}`;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function emptyIndex() {
  return {
    schema_version: INDEX_SCHEMA_VERSION,
    last_updated: new Date().toISOString(),
    summaries: [],
  };
}

async function readIndex() {
  const store = summariesStore();
  const data = await store.get(INDEX_KEY, { type: 'json' });
  if (!data || !Array.isArray(data.summaries)) return emptyIndex();
  return data;
}

async function writeIndex(index) {
  const store = summariesStore();
  await store.setJSON(INDEX_KEY, index);
}

async function readSummary(date) {
  const store = summariesStore();
  return store.get(summaryKeyForDate(date), { type: 'json' });
}

async function writeSummary(date, summary) {
  const store = summariesStore();
  await store.setJSON(summaryKeyForDate(date), summary);
}

// Build a compact index entry from the full summary record. Stored in the
// summaries-index file so the history list renders without N blob reads.
function indexEntryFromSummary(summary) {
  return {
    date: summary.date,
    headline: summary.headline || '',
    alert_count_total: summary.alert_count?.total ?? 0,
    alert_count_after_filter: summary.alert_count?.after_filter ?? 0,
    primary_threats: Array.isArray(summary.primary_threats) ? summary.primary_threats : [],
    generated_at: summary.generated_at,
  };
}

// Read-modify-write the index. Insert or replace the entry for summary.date,
// then re-sort summaries descending by date so the latest is always first.
async function upsertIndexEntry(summary) {
  const index = await readIndex();
  const entry = indexEntryFromSummary(summary);
  const idx = index.summaries.findIndex((s) => s.date === entry.date);
  if (idx >= 0) {
    index.summaries[idx] = entry;
  } else {
    index.summaries.push(entry);
  }
  index.summaries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  index.last_updated = new Date().toISOString();
  await writeIndex(index);
  return index;
}

// ============================================================================
// HANDLER
// ============================================================================

exports.handler = async (event) => {
  // Lambda-compat mode: Blobs needs credentials from the event.
  try {
    connectLambda(event);
  } catch (err) {
    console.warn('[weather-summary] connectLambda skipped:', err.message);
  }

  // ── Auth (applies to every method) ──────────────────────────────────────
  const expectedToken = process.env.ADMIN_FUNCTION_TOKEN;
  if (!expectedToken) {
    return jsonResponse(500, { error: 'Server is missing ADMIN_FUNCTION_TOKEN env var' });
  }
  const providedToken =
    event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'];
  if (providedToken !== expectedToken) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  switch (event.httpMethod) {
    case 'POST':
      return handleGenerate(event);
    case 'GET':
      return handleGet(event);
    case 'PATCH':
      return handlePatch(event);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
};

// ── POST: generate a new summary + persist ──────────────────────────────────
async function handleGenerate(event) {
  try {
    getAnthropicApiKey();
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid JSON in request body' });
  }

  const tonePreset = body.tone_preset || 'standard';
  const filterPreset = body.filter_preset || 'all-severe';
  const customStates = Array.isArray(body.custom_states) ? body.custom_states : [];

  if (!TONE_PRESETS.has(tonePreset)) {
    return jsonResponse(400, { error: `Invalid tone_preset: ${tonePreset}` });
  }
  if (!FILTER_PRESETS.has(filterPreset)) {
    return jsonResponse(400, { error: `Invalid filter_preset: ${filterPreset}` });
  }
  if (filterPreset === 'custom-states' && customStates.length === 0) {
    return jsonResponse(400, { error: 'custom-states filter requires non-empty custom_states array' });
  }

  // Fetch NWS active alerts.
  let features;
  try {
    features = await fetchActiveAlerts();
  } catch (err) {
    return jsonResponse(502, { error: `NWS fetch failed: ${err.message}` });
  }

  const totalCount = features.length;
  const severeCount = features.filter((a) => a.properties?.severity === 'Severe').length;
  const extremeCount = features.filter((a) => a.properties?.severity === 'Extreme').length;

  const filtered = applyFilter(features, filterPreset, customStates);

  if (filtered.length === 0) {
    return jsonResponse(200, {
      ok: true,
      empty: true,
      message: 'No active severe weather matched the selected filter. No summary generated.',
      alert_count: {
        total: totalCount,
        severe: severeCount,
        extreme: extremeCount,
        after_filter: 0,
      },
    });
  }

  // Sort by severity desc, then by event significance (tornado/hurricane first).
  filtered.sort((a, b) => {
    const sa = severityRank(a.properties?.severity);
    const sb = severityRank(b.properties?.severity);
    if (sa !== sb) return sb - sa;
    const aEvent = a.properties?.event || '';
    const bEvent = b.properties?.event || '';
    const aPri = TORNADO_HURRICANE_BLIZZARD_EVENTS.has(aEvent) ? 1 : 0;
    const bPri = TORNADO_HURRICANE_BLIZZARD_EVENTS.has(bEvent) ? 1 : 0;
    return bPri - aPri;
  });

  const shapedAll = filtered.map(shapeAlertForOutput);
  const shapedForLlm = shapedAll.slice(0, MAX_ALERTS_TO_LLM);

  // Call Haiku.
  const filterNameForPrompt = {
    'all-severe': 'all severe or extreme alerts',
    'tornado-hurricane-blizzard': 'tornado, hurricane, and blizzard alerts only',
    'custom-states': `alerts in ${customStates.join(', ')}`,
  }[filterPreset];

  const systemPrompt = buildSystemPrompt(tonePreset);
  const userPrompt = buildUserPrompt({
    tonePreset,
    filterName: filterNameForPrompt,
    totalCount,
    filteredAlerts: shapedForLlm,
  });

  let haikuResult;
  try {
    haikuResult = await callHaiku({
      systemPrompt,
      userPrompt,
    });
  } catch (err) {
    return jsonResponse(502, { error: `Anthropic call failed: ${err.message}` });
  }

  const { parsed, parseError } = parseHaikuJSON(haikuResult.text);

  if (!parsed) {
    return jsonResponse(502, {
      error: 'Haiku returned unparseable JSON',
      parse_error: parseError,
      raw_text: haikuResult.text,
      usage: haikuResult.usage,
    });
  }

  // Build the canonical summary record we persist.
  const date = todayUTC();
  const summary = {
    id: date,
    date,
    generated_at: new Date().toISOString(),
    generated_by: HAIKU_MODEL,
    tone_preset: tonePreset,
    filter_preset: filterPreset,
    custom_states: filterPreset === 'custom-states' ? customStates : [],
    alert_count: {
      total: totalCount,
      severe: severeCount,
      extreme: extremeCount,
      after_filter: filtered.length,
      sent_to_llm: shapedForLlm.length,
    },
    primary_threats: Array.isArray(parsed.primary_threats) ? parsed.primary_threats : [],
    affected_regions: Array.isArray(parsed.affected_regions) ? parsed.affected_regions : [],
    headline: parsed.headline || '',
    outputs: {
      newsletter: parsed.newsletter || '',
      twitter_thread: Array.isArray(parsed.twitter_thread) ? parsed.twitter_thread : [],
      instagram_caption: parsed.instagram_caption || '',
      facebook_post: parsed.facebook_post || '',
    },
    raw_alerts: shapedAll,
    usage: haikuResult.usage,
    stop_reason: haikuResult.stopReason,
    notes: '',
    used_on_social: [],
  };

  // Persist: write the full summary, then update the index. Either step can
  // fail independently; if it does, still return the generated outputs so
  // the UI can let the user retry the save without burning another Haiku call.
  let storageError = null;
  try {
    // Preserve any existing notes/used_on_social if re-generating on a date
    // that already has a summary. Generation overwrites the outputs but the
    // user's manual annotations carry forward.
    const existing = await readSummary(date);
    if (existing) {
      summary.notes = existing.notes || '';
      summary.used_on_social = Array.isArray(existing.used_on_social)
        ? existing.used_on_social
        : [];
    }
    await writeSummary(date, summary);
    await upsertIndexEntry(summary);
  } catch (err) {
    storageError = err.message || String(err);
  }

  return jsonResponse(200, {
    ok: true,
    empty: false,
    saved: storageError === null,
    storage_error: storageError,
    summary,
  });
}

// ── GET: list index (no query) OR fetch one summary (?date=YYYY-MM-DD) ──────
async function handleGet(event) {
  const date = event.queryStringParameters?.date;
  try {
    if (date) {
      const summary = await readSummary(date);
      if (!summary) {
        return jsonResponse(404, { error: `No summary stored for ${date}` });
      }
      return jsonResponse(200, { ok: true, summary });
    }
    const index = await readIndex();
    return jsonResponse(200, { ok: true, index });
  } catch (err) {
    const storageError = storageErrorMessage(err);
    // History is optional — degrade gracefully so generation still works.
    if (!date) {
      return jsonResponse(200, {
        ok: true,
        index: emptyIndex(),
        storage_unavailable: true,
        storage_error: storageError,
      });
    }
    if (isStorageUnavailableError(err)) {
      return jsonResponse(200, {
        ok: true,
        summary: null,
        storage_unavailable: true,
        storage_error: storageError,
      });
    }
    return jsonResponse(500, { error: `Storage read failed: ${storageError}` });
  }
}

// ── PATCH: update notes/used_on_social on a stored summary ──────────────────
async function handlePatch(event) {
  const date = event.queryStringParameters?.date;
  if (!date) {
    return jsonResponse(400, { error: 'date query parameter is required' });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return jsonResponse(400, { error: 'Invalid JSON in request body' });
  }

  // Only these fields are user-mutable post-generation.
  const allowed = {};
  if (typeof body.notes === 'string') allowed.notes = body.notes;
  if (Array.isArray(body.used_on_social)) {
    // Stringify entries defensively so the UI can't smuggle objects in.
    allowed.used_on_social = body.used_on_social.map(String);
  }
  if (Object.keys(allowed).length === 0) {
    return jsonResponse(400, { error: 'No mutable fields in body (allowed: notes, used_on_social)' });
  }

  let summary;
  try {
    summary = await readSummary(date);
  } catch (err) {
    const storageError = storageErrorMessage(err);
    if (isStorageUnavailableError(err)) {
      return jsonResponse(503, {
        error: 'Summary history storage is unavailable. Set NETLIFY_BLOBS_TOKEN in Netlify env vars.',
        storage_unavailable: true,
        storage_error: storageError,
      });
    }
    return jsonResponse(500, { error: `Storage read failed: ${storageError}` });
  }
  if (!summary) {
    return jsonResponse(404, { error: `No summary stored for ${date}` });
  }

  Object.assign(summary, allowed);

  try {
    await writeSummary(date, summary);
  } catch (err) {
    return jsonResponse(500, { error: `Storage write failed: ${err.message}` });
  }

  return jsonResponse(200, { ok: true, summary });
}
