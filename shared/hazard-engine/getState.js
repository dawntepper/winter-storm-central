/**
 * State-level Weather Intelligence — normalized view of NWS alerts for one state.
 * Complements hazardEngine.get(hazardSlug) for national hazard pages.
 */

import {
  ALERT_CATEGORIES,
  CATEGORY_ORDER,
} from '../nws-alert-parser.js';
import {
  extractAffectedStateCodes,
  extractAffectedCounties,
  buildAffectedCounties,
  dedupeAlertsById,
  isAlertExpired,
  sortHazardAlerts,
} from './normalize.js';
import {
  STATE_BY_ABBR,
  getStateName,
  getStateSlug,
  getStateAlertsHref,
} from './stateLookup.js';
import { getHazardConfig, getLaunchHazardSlugs, hazardHref } from './hazards.js';

/** Prefer these launch hazard pages when linking from a category chip. */
const CATEGORY_PRIMARY_HAZARD = {
  tornado: 'tornado-warning',
  severe: 'severe-thunderstorm-warning',
  flood: 'flash-flood-warning',
  tropical: 'hurricane-warning',
  heat: 'excessive-heat-warning',
  winter: 'winter-storm-warning',
  fire: 'red-flag-warning',
};

export function alertAffectsState(alert, stateCode) {
  if (!alert || !stateCode) return false;
  if (alert.state === stateCode) return true;
  return extractAffectedStateCodes(alert).includes(stateCode);
}

function resolveHazardPage(categoryId) {
  const preferred = CATEGORY_PRIMARY_HAZARD[categoryId];
  if (preferred) {
    const cfg = getHazardConfig(preferred);
    if (cfg?.launch) {
      return { slug: preferred, href: hazardHref(preferred), label: cfg.pluralLabel };
    }
  }
  // Fallback: first launch hazard in this radar category
  for (const slug of getLaunchHazardSlugs()) {
    const cfg = getHazardConfig(slug);
    if (cfg?.radarCategory === categoryId) {
      return { slug, href: hazardHref(slug), label: cfg.pluralLabel };
    }
  }
  return { slug: null, href: null, label: null };
}

export function buildStateHazards(alerts) {
  const counts = {};
  for (const id of CATEGORY_ORDER) counts[id] = 0;
  for (const alert of alerts) {
    if (alert.category && counts[alert.category] !== undefined) {
      counts[alert.category] += 1;
    }
  }

  return CATEGORY_ORDER
    .filter((id) => counts[id] > 0)
    .map((id) => {
      const cat = ALERT_CATEGORIES[id];
      const page = resolveHazardPage(id);
      return {
        id,
        slug: id,
        label: cat?.name || id,
        icon: cat?.icon || '⚠️',
        color: cat?.color || '#64748b',
        activeCount: counts[id],
        hazardPageSlug: page.slug,
        href: page.href,
        hazardPageLabel: page.label,
      };
    })
    .sort((a, b) => b.activeCount - a.activeCount);
}

/**
 * Attach per-county hazard category breakdown (best-effort from areaDesc).
 */
export function enrichCountiesWithHazards(counties, alerts) {
  return (counties || []).map((county) => {
    const keyName = county.name.toLowerCase();
    const categoryCounts = {};

    for (const alert of alerts || []) {
      const matches = extractAffectedCounties(alert).some(
        (c) =>
          c.stateCode === county.stateCode
          && c.name.toLowerCase() === keyName
      );
      if (!matches) continue;
      const cat = alert.category;
      if (!cat) continue;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const hazards = CATEGORY_ORDER
      .filter((id) => categoryCounts[id] > 0)
      .map((id) => {
        const cat = ALERT_CATEGORIES[id];
        return {
          id,
          slug: id,
          label: cat?.name || id,
          icon: cat?.icon || '⚠️',
          color: cat?.color || '#64748b',
          activeCount: categoryCounts[id],
        };
      });

    return {
      ...county,
      activeCount: county.alertCount,
      hazards,
    };
  });
}

function hazardAlertPhrase(count, label) {
  const unit = count === 1 ? 'alert' : 'alerts';
  return `${count} ${label} ${unit}`;
}

/**
 * Deterministic state Current Situation summary (no Claude).
 * Avoids repeating the status headline count — focuses on primary concern.
 */
export function buildStateSituationSummary({
  stateName,
  activeCount,
  hazards = [],
}) {
  if (activeCount <= 0) {
    return `There are currently no active National Weather Service alerts for ${stateName}.`;
  }

  if (hazards.length === 0) {
    return `Active National Weather Service alerts are in effect across ${stateName}.`;
  }

  const primary = hazards[0];
  const primaryAlerts = primary.activeCount === 1 ? 'alert' : 'alerts';
  const lead = `${primary.label} is the primary concern with ${primary.activeCount} ${primaryAlerts}`;

  if (hazards.length === 1) {
    return `${lead}.`;
  }

  const rest = hazards.slice(1);
  if (rest.length === 1) {
    return `${lead}, plus ${hazardAlertPhrase(rest[0].activeCount, rest[0].label)}.`;
  }

  const parts = rest.map((h) => hazardAlertPhrase(h.activeCount, h.label));
  if (parts.length === 2) {
    return `${lead}, plus ${parts[0]} and ${parts[1]}.`;
  }
  return `${lead}, plus ${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;
}

/**
 * hazardEngine.getState(stateCode, alerts, options)
 *
 * @param {string} stateCode - e.g. "CO"
 * @param {Array} alerts - national normalized alert collection
 * @param {object} [options]
 */
export function getState(stateCode, alerts = [], options = {}) {
  const code = String(stateCode || '').toUpperCase();
  if (!code || !STATE_BY_ABBR[code]) {
    return { ok: false, error: 'unknown_state', stateCode: code };
  }
  const stateName = getStateName(code);

  const {
    latestSourceUpdateAt = null,
    dataAvailable = true,
    now = Date.now(),
  } = options;

  const filtered = dataAvailable
    ? sortHazardAlerts(
      dedupeAlertsById(
        (alerts || []).filter(
          (a) => alertAffectsState(a, code) && !isAlertExpired(a, now)
        )
      )
    )
    : [];

  const hazards = buildStateHazards(filtered);
  const affectedCounties = enrichCountiesWithHazards(
    buildAffectedCounties(filtered).filter((c) => c.stateCode === code),
    filtered
  );

  const activeCount = filtered.length;
  const deterministicSummary = dataAvailable
    ? buildStateSituationSummary({ stateName, activeCount, hazards })
    : 'Live alert data is temporarily unavailable.';

  const statusHeadline = !dataAvailable
    ? 'Live alert data temporarily unavailable'
    : activeCount === 0
      ? `No Active Weather Alerts in ${stateName}`
      : `${activeCount} Weather Alert${activeCount === 1 ? '' : 's'} Active in ${stateName}`;

  return {
    ok: true,
    stateCode: code,
    stateName,
    stateSlug: getStateSlug(code),
    href: getStateAlertsHref(code),
    activeCount,
    alerts: filtered,
    hazards,
    affectedCounties,
    deterministicSummary,
    situationSummary: deterministicSummary,
    monitoringNote:
      activeCount === 0 && dataAvailable
        ? `StormTracking continues to monitor conditions and will update this page when new alerts are issued for ${stateName}.`
        : null,
    liveStatus: {
      heading: 'Current Situation',
      statusHeadline,
      situationSummary: deterministicSummary,
      hasActiveAlerts: activeCount > 0,
      monitoringNote:
        activeCount === 0 && dataAvailable
          ? `StormTracking continues to monitor conditions and will update this page when new alerts are issued for ${stateName}.`
          : null,
    },
    updatedAt: latestSourceUpdateAt,
    latestSourceUpdateAt,
    freshness: {
      latestSourceUpdateAt,
      dataAvailable,
    },
    // Reserved for future cached state briefs
    weatherBrief: null,
  };
}
