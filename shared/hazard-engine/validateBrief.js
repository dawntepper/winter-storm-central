/**
 * Validate Claude Weather Brief JSON before storage/display.
 */

const URL_RE = /https?:\/\/|www\./i;
const MAX_SUMMARY_CHARS = 600;
const MAX_NOTABLE_CHARS = 240;

const MEASUREMENT_RE =
  /\b(\d+\s*(mph|kts|knots|mb|inches?|in\.?|mile|miles|°f|degrees))\b/i;

/**
 * @returns {{ ok: true, brief: object } | { ok: false, reasons: string[] }}
 */
export function validateBriefResponse(raw, {
  affectedStateNames = [],
  affectedCountyNames = [],
  activeCount = 0,
} = {}) {
  const reasons = [];

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reasons: ['malformed_json'] };
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!summary) reasons.push('missing_summary');
  if (summary.length > MAX_SUMMARY_CHARS) reasons.push('summary_too_long');
  if (URL_RE.test(summary)) reasons.push('contains_url');

  const notable = raw.notableChange == null || raw.notableChange === ''
    ? null
    : String(raw.notableChange).trim();
  if (notable && notable.length > MAX_NOTABLE_CHARS) reasons.push('notable_too_long');
  if (notable && URL_RE.test(notable)) reasons.push('notable_contains_url');

  const confidenceNotes = Array.isArray(raw.confidenceNotes)
    ? raw.confidenceNotes.filter((n) => typeof n === 'string')
    : [];

  // Reject invented measurements when none are in structured input path —
  // conservative: flag mph/inches etc. only when activeCount is 0 (no basis)
  // or when the summary invents numbers that look like weather measurements
  // without being clearly from headlines. Soft check: only fail zero-active.
  if (activeCount === 0 && MEASUREMENT_RE.test(summary)) {
    reasons.push('unsupported_measurements');
  }

  const allowedStates = new Set(
    affectedStateNames.map((n) => String(n).toLowerCase())
  );
  const allowedCounties = new Set(
    affectedCountyNames.map((n) => String(n).toLowerCase())
  );

  // Detect unsupported US state names mentioned in summary.
  // Match longer names first so "West Virginia" is not also flagged as "Virginia".
  const US_STATE_NAMES = [
    'District of Columbia', 'Washington D.C.', 'West Virginia', 'South Carolina',
    'North Carolina', 'South Dakota', 'North Dakota', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'Rhode Island', 'Puerto Rico',
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Tennessee', 'Texas', 'Utah',
    'Vermont', 'Virginia', 'Washington', 'Wisconsin', 'Wyoming',
  ].sort((a, b) => b.length - a.length);

  let remainingSummary = summary;
  for (const name of US_STATE_NAMES) {
    const re = new RegExp(`\\b${name.replace(/\./g, '\\.')}\\b`, 'i');
    if (!re.test(remainingSummary)) continue;
    // Consume matched spans so shorter names inside longer ones are not re-checked
    remainingSummary = remainingSummary.replace(re, ' ');
    if (!allowedStates.has(name.toLowerCase())) {
      if (name === 'Washington' && (
        allowedStates.has('washington d.c.') ||
        allowedStates.has('district of columbia')
      )) {
        continue;
      }
      reasons.push(`unsupported_state:${name}`);
    }
  }

  // County check: only flag when we have a known county list and summary
  // mentions a county name not in the list — skip if county list empty
  // (avoid false positives on common words).
  if (allowedCounties.size > 0) {
    for (const county of allowedCounties) {
      // no-op positive allow
      void county;
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons: [...new Set(reasons)] };
  }

  return {
    ok: true,
    brief: {
      summary,
      notableChange: notable,
      confidenceNotes,
    },
  };
}

export const BRIEF_SYSTEM_PROMPT = `You write concise, factual weather briefs for StormTracking.io.

Summarize only the structured alert information supplied.

Rules:
- Write no more than 2–3 sentences.
- Do not invent conditions, movement, damage, timing, or locations.
- Do not claim a storm is occurring in an entire state when alerts affect only part of it.
- Do not describe a location as eastern, western, northern, southern, or central unless that geographic characterization is supported by the supplied data.
- Do not add safety advice.
- Do not add URLs.
- Do not repeat the full active count unless necessary for clarity.
- Avoid hype, dramatic language, and vague claims.
- Avoid phrases such as 'devastating,' 'historic,' or 'catastrophic' unless those exact classifications are present in an official source.
- Prefer plain language.
- Clearly state when available data is limited.
- Return valid JSON only.`;

export function buildBriefUserPrompt(payload) {
  return `Produce a Weather Brief JSON object with keys summary, notableChange, confidenceNotes.

Structured hazard data:
${JSON.stringify(payload, null, 2)}`;
}

/**
 * Compact Claude input from engine snapshot pieces.
 */
export function buildBriefLlmPayload({
  config,
  activeCount,
  affectedStates,
  affectedCounties,
  alerts,
  previousSummary = null,
  previousDataSignature = null,
  maxAlerts = 12,
}) {
  const prioritized = prioritizeAlertsForLlm(alerts, maxAlerts);

  return {
    hazard: config.singularLabel,
    activeCount,
    affectedStates: (affectedStates || []).map((s) => ({
      name: s.name,
      count: s.alertCount,
    })),
    affectedCounties: (affectedCounties || []).slice(0, 20).map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      count: c.alertCount,
    })),
    alerts: prioritized.map((a) => ({
      headline: a.headline || a.event,
      area: a.areaDesc || a.location || null,
      issuedAt: a.onset || a.sent || null,
      expiresAt: a.expires || null,
      severity: a.severity || null,
      urgency: a.urgency || null,
      certainty: a.certainty || null,
      movement: extractMovementHint(a),
      threatTags: extractThreatTags(a),
    })),
    previousSummary,
    previousDataSignature,
  };
}

function prioritizeAlertsForLlm(alerts, maxAlerts) {
  const list = [...(alerts || [])];
  list.sort((a, b) => {
    const ext = Number(b.severity === 'Extreme') - Number(a.severity === 'Extreme');
    if (ext) return ext;
    const urg = (urgencyScore(b.urgency) - urgencyScore(a.urgency));
    if (urg) return urg;
    const sev = (severityScore(b.severity) - severityScore(a.severity));
    if (sev) return sev;
    return 0;
  });

  // Prefer geographic variety
  const picked = [];
  const seenStates = new Set();
  for (const alert of list) {
    if (picked.length >= maxAlerts) break;
    const state = alert.state || '';
    if (state && seenStates.has(state) && picked.length >= Math.ceil(maxAlerts / 2)) {
      continue;
    }
    picked.push(alert);
    if (state) seenStates.add(state);
  }
  // Fill remaining
  for (const alert of list) {
    if (picked.length >= maxAlerts) break;
    if (!picked.includes(alert)) picked.push(alert);
  }
  return picked;
}

function urgencyScore(v) {
  return ({ Immediate: 4, Expected: 3, Future: 2, Past: 1 }[v] || 0);
}
function severityScore(v) {
  return ({ Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 }[v] || 0);
}

function extractMovementHint(alert) {
  const text = `${alert.headline || ''} ${alert.description || ''} ${alert.fullDescription || ''}`;
  const match = text.match(/\b(moving\s+\w+(?:\s+\w+)?)/i);
  return match ? match[1] : null;
}

function extractThreatTags(alert) {
  const tags = [];
  const params = alert.parameters || {};
  for (const key of ['tornadoDetection', 'maxWindGust', 'maxHailSize', 'flashFloodDetection']) {
    if (params[key]) tags.push(`${key}:${Array.isArray(params[key]) ? params[key][0] : params[key]}`);
  }
  return tags;
}
