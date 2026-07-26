/**
 * Alert normalization for the Hazard Engine.
 *
 * Active/expired rules:
 * - Prefer alerts already from NWS /alerts/active (feed is active-only).
 * - Additionally drop alerts whose expires timestamp is in the past when parseable.
 * - Drop alerts with unparseable expires only when expires is present and invalid
 *   AND we are doing client-side expiry checks (malformed → treat as unknown, keep
 *   if from active feed; drop if expires is clearly past).
 *
 * Deduplication rules:
 * - Key by NWS alert id (alert.id).
 * - If the same id appears more than once, keep the newest by onset/sent/expires.
 * - Do not count old versions of the same NWS alert as separate warnings.
 *
 * Event matching:
 * - Exact match against hazard config nwsEvents (case-sensitive NWS event strings).
 */

import { MARINE_ZONE_PREFIXES } from '../nws-alert-parser.js';
import { getStateAlertsHref, getStateName, getStateSlug, STATE_BY_ABBR } from './stateLookup.js';

const SEVERITY_RANK = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
};

const URGENCY_RANK = {
  Immediate: 4,
  Expected: 3,
  Future: 2,
  Past: 1,
  Unknown: 0,
};

const CERTAINTY_RANK = {
  Observed: 4,
  Likely: 3,
  Possible: 2,
  Unlikely: 1,
  Unknown: 0,
};

export function severityRank(value) {
  return SEVERITY_RANK[value] ?? 0;
}

export function urgencyRank(value) {
  return URGENCY_RANK[value] ?? 0;
}

export function certaintyRank(value) {
  return CERTAINTY_RANK[value] ?? 0;
}

export function isAlertExpired(alert, now = Date.now()) {
  if (!alert?.expires) return false;
  const ms = new Date(alert.expires).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms <= now;
}

export function matchesHazardEvent(alert, config) {
  if (!alert?.event || !config?.nwsEvents?.length) return false;
  return config.nwsEvents.includes(alert.event);
}

/**
 * Extract all land-state codes from an alert.
 * Uses UGC codes + areaDesc ", ST" patterns. Skips marine zone prefixes.
 */
export function extractAffectedStateCodes(alert) {
  const states = new Set();

  const ugcs = alert?.ugc || alert?.geocode?.UGC || alert?.properties?.geocode?.UGC || [];
  for (const ugc of ugcs) {
    if (typeof ugc !== 'string' || ugc.length < 2) continue;
    const code = ugc.substring(0, 2).toUpperCase();
    if (MARINE_ZONE_PREFIXES.includes(code)) continue;
    if (STATE_BY_ABBR[code]) states.add(code);
  }

  if (alert?.state && STATE_BY_ABBR[alert.state]) {
    states.add(alert.state);
  }

  const areaDesc = alert?.areaDesc || alert?.properties?.areaDesc || '';
  if (areaDesc) {
    const matches = areaDesc.match(/,\s*([A-Z]{2})\b/g);
    if (matches) {
      for (const match of matches) {
        const code = match.replace(/,\s*/, '');
        if (STATE_BY_ABBR[code] && !MARINE_ZONE_PREFIXES.includes(code)) {
          states.add(code);
        }
      }
    }
  }

  return [...states];
}

/**
 * Best-effort county extraction from areaDesc segments like "County, ST".
 */
export function extractAffectedCounties(alert) {
  const areaDesc = alert?.areaDesc || alert?.properties?.areaDesc || '';
  if (!areaDesc) return [];

  const counties = [];
  const parts = areaDesc.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.+?),\s*([A-Z]{2})$/);
    if (!match) continue;
    const rawName = match[1].trim();
    const stateCode = match[2];
    if (!STATE_BY_ABBR[stateCode]) continue;
    // Skip pure marine/offshore phrasing
    if (/^(coastal waters|open waters|nearshore)/i.test(rawName)) continue;
    counties.push({
      name: rawName,
      stateCode,
      stateName: getStateName(stateCode),
    });
  }
  return counties;
}

function alertRecencyMs(alert) {
  const candidates = [alert.onset, alert.sent, alert.effective, alert.expires];
  for (const c of candidates) {
    if (!c) continue;
    const ms = new Date(c).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

/**
 * Deduplicate by NWS id, keeping the newest version.
 */
export function dedupeAlertsById(alerts) {
  const byId = new Map();
  for (const alert of alerts) {
    const id = alert?.id;
    if (!id) {
      // Keep id-less alerts under a synthetic key so they are not dropped silently
      const synthetic = `anon:${alert.event}:${alert.areaDesc}:${alert.onset}:${alert.expires}`;
      if (!byId.has(synthetic)) byId.set(synthetic, alert);
      continue;
    }
    const existing = byId.get(id);
    if (!existing || alertRecencyMs(alert) >= alertRecencyMs(existing)) {
      byId.set(id, alert);
    }
  }
  return [...byId.values()];
}

export function sortHazardAlerts(alerts) {
  return [...alerts].sort((a, b) => {
    const u = urgencyRank(b.urgency) - urgencyRank(a.urgency);
    if (u !== 0) return u;
    const s = severityRank(b.severity) - severityRank(a.severity);
    if (s !== 0) return s;
    return alertRecencyMs(b) - alertRecencyMs(a);
  });
}

function highestField(alerts, field, rankFn) {
  let best = null;
  let bestRank = -1;
  for (const alert of alerts) {
    const value = alert[field] || 'Unknown';
    const rank = rankFn(value);
    if (rank > bestRank) {
      bestRank = rank;
      best = value;
    }
  }
  return best;
}

/**
 * Filter + normalize alerts for a hazard config.
 */
export function filterAlertsForHazard(alerts, config, { now = Date.now() } = {}) {
  const matched = (alerts || []).filter(
    (a) => matchesHazardEvent(a, config) && !isAlertExpired(a, now)
  );
  return sortHazardAlerts(dedupeAlertsById(matched));
}

/**
 * Build affected state objects sorted by alert count desc, then name.
 */
export function buildAffectedStates(alerts) {
  const counts = new Map();

  for (const alert of alerts) {
    const codes = extractAffectedStateCodes(alert);
    // If no state could be extracted, skip rather than inventing
    for (const code of codes) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }

  const states = [...counts.entries()].map(([code, alertCount]) => ({
    code,
    name: getStateName(code),
    slug: getStateSlug(code),
    href: getStateAlertsHref(code),
    alertCount,
  }));

  states.sort((a, b) => {
    if (b.alertCount !== a.alertCount) return b.alertCount - a.alertCount;
    return (a.name || '').localeCompare(b.name || '');
  });

  return states;
}

/**
 * Aggregate counties across alerts (best-effort).
 */
export function buildAffectedCounties(alerts) {
  const counts = new Map();

  for (const alert of alerts) {
    for (const county of extractAffectedCounties(alert)) {
      const key = `${county.stateCode}|${county.name.toLowerCase()}`;
      const existing = counts.get(key);
      if (existing) {
        existing.alertCount += 1;
      } else {
        counts.set(key, { ...county, alertCount: 1 });
      }
    }
  }

  return [...counts.values()].sort((a, b) => {
    if (b.alertCount !== a.alertCount) return b.alertCount - a.alertCount;
    return a.name.localeCompare(b.name);
  });
}

export function summarizeAlertTimestamps(alerts) {
  let newestIssuedAt = null;
  let earliestExpirationAt = null;
  let newestIssuedMs = -1;
  let earliestExpMs = Number.POSITIVE_INFINITY;

  for (const alert of alerts) {
    const issuedMs = alertRecencyMs(alert);
    if (issuedMs > newestIssuedMs) {
      newestIssuedMs = issuedMs;
      newestIssuedAt = alert.onset || alert.sent || alert.effective || null;
    }
    if (alert.expires) {
      const expMs = new Date(alert.expires).getTime();
      if (Number.isFinite(expMs) && expMs < earliestExpMs) {
        earliestExpMs = expMs;
        earliestExpirationAt = alert.expires;
      }
    }
  }

  return {
    newestIssuedAt,
    earliestExpirationAt: Number.isFinite(earliestExpMs) ? earliestExpirationAt : null,
  };
}

export function buildHazardAlertStats(alerts) {
  return {
    highestSeverity: highestField(alerts, 'severity', severityRank),
    highestUrgency: highestField(alerts, 'urgency', urgencyRank),
    highestCertainty: highestField(alerts, 'certainty', certaintyRank),
    hasExtremeAlert: alerts.some((a) => a.severity === 'Extreme'),
    ...summarizeAlertTimestamps(alerts),
  };
}
