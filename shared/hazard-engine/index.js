/**
 * Hazard Engine — StormTracking Weather Intelligence Layer
 *
 * Single source of truth for normalized hazard snapshots.
 * Pages, radar, homepage, admin, and future API/iOS clients should
 * consume `hazardEngine.get(...)` output rather than re-implementing
 * alert math.
 *
 * Does NOT fetch NWS or call Claude. Callers supply alerts + optional
 * cached brief; server functions handle I/O.
 */

import {
  getHazardConfig,
  getAllHazardSlugs,
  getLaunchHazardSlugs,
  hazardHref,
  HAZARD_CONFIGS,
  PROMPT_VERSION,
  MAX_ALERTS_TO_LLM,
} from './hazards.js';
import {
  filterAlertsForHazard,
  buildAffectedStates,
  buildAffectedCounties,
  buildHazardAlertStats,
} from './normalize.js';
import { buildLiveStatus } from './liveStatus.js';
import { buildFallbackBrief } from './fallbackBrief.js';
import { buildDataSignature } from './dataSignature.js';
import { shouldRegenerateBrief } from './regeneration.js';
import {
  buildBriefLlmPayload,
  buildBriefUserPrompt,
  BRIEF_SYSTEM_PROMPT,
  validateBriefResponse,
} from './validateBrief.js';
import {
  getState,
  alertAffectsState,
  buildStateHazards,
  buildStateSituationSummary,
} from './getState.js';

/**
 * Resolve displayed weather brief text from cache + override rules.
 */
export function resolveWeatherBrief(config, statsContext, cachedBrief = null) {
  const fallback = buildFallbackBrief(config, statsContext);

  if (cachedBrief?.manual_override && cachedBrief.manual_summary) {
    return {
      summary: cachedBrief.manual_summary,
      notableChange: cachedBrief.notable_change || null,
      source: 'manual',
      status: cachedBrief.status || 'valid',
      generatedAt: cachedBrief.generated_at || null,
      model: cachedBrief.model || null,
      promptVersion: cachedBrief.prompt_version || null,
      confidence: 'editorial',
    };
  }

  if (cachedBrief?.summary && cachedBrief.status !== 'failed') {
    return {
      summary: cachedBrief.summary,
      notableChange: cachedBrief.notable_change || null,
      source: 'cached',
      status: cachedBrief.status || 'valid',
      generatedAt: cachedBrief.generated_at || null,
      model: cachedBrief.model || null,
      promptVersion: cachedBrief.prompt_version || null,
      confidence: 'model',
    };
  }

  return {
    summary: fallback.summary,
    notableChange: fallback.notableChange,
    source: 'fallback',
    status: 'valid',
    generatedAt: null,
    model: null,
    promptVersion: null,
    confidence: 'deterministic',
  };
}

/**
 * Build related hazard link objects from config.
 */
export function buildRelatedHazards(config, relatedCounts = {}) {
  return (config.relatedHazards || [])
    .map((slug) => {
      const related = getHazardConfig(slug);
      if (!related?.launch) return null;
      return {
        slug: related.slug,
        href: hazardHref(related.slug),
        label: related.pluralLabel,
        pageTitle: related.pageTitle,
        description: related.intro,
        activeCount: relatedCounts[slug] ?? null,
        icon: related.icon,
        severityColor: related.severityColor,
      };
    })
    .filter(Boolean);
}

/**
 * Core API: hazardEngine.get(slug, alerts, options)
 *
 * @param {string} slug
 * @param {Array} alerts - Normalized alert collection (from noaaAlertsService or server parse)
 * @param {object} [options]
 * @param {object|null} [options.cachedBrief]
 * @param {object} [options.relatedCounts] - optional live counts for related hazards
 * @param {string|null} [options.latestSourceUpdateAt]
 * @param {boolean} [options.dataAvailable=true] - false when NWS feed failed
 * @param {number} [options.now]
 */
export function get(slug, alerts = [], options = {}) {
  const config = getHazardConfig(slug);
  if (!config) {
    return {
      ok: false,
      error: 'unknown_hazard',
      hazardSlug: slug,
    };
  }

  const {
    cachedBrief = null,
    relatedCounts = {},
    latestSourceUpdateAt = null,
    dataAvailable = true,
    now = Date.now(),
  } = options;

  const filtered = dataAvailable
    ? filterAlertsForHazard(alerts, config, { now })
    : [];

  const affectedStates = buildAffectedStates(filtered);
  const affectedCounties = buildAffectedCounties(filtered);
  const stats = buildHazardAlertStats(filtered);
  const sourceAlertIds = filtered.map((a) => a.id).filter(Boolean);
  const affectedStateCodes = affectedStates.map((s) => s.code);

  const dataSignature = buildDataSignature({
    hazardSlug: config.slug,
    activeCount: filtered.length,
    affectedStateCodes,
    sourceAlertIds,
    highestSeverity: stats.highestSeverity,
    highestUrgency: stats.highestUrgency,
    hasExtremeAlert: stats.hasExtremeAlert,
  });

  const liveStatus = dataAvailable
    ? buildLiveStatus(config, {
      activeCount: filtered.length,
      affectedStates,
      alerts: filtered,
    })
    : {
      heading: 'Live Status',
      statusHeadline: 'Live alert data temporarily unavailable',
      statusSentence: 'Live alert data is temporarily unavailable. Radar, related links, and safety information remain available below.',
      countLabel: null,
      hasActiveAlerts: false,
      affectedStatesCompact: { compactNames: [], displayText: '', remainingCount: 0 },
    };

  const statsContext = {
    activeCount: filtered.length,
    affectedStates,
  };

  const weatherBrief = resolveWeatherBrief(config, statsContext, cachedBrief);

  const regen = shouldRegenerateBrief({
    cachedBrief,
    currentSignature: dataSignature,
    currentActiveCount: filtered.length,
    currentStateCodes: affectedStateCodes,
    currentHighestSeverity: stats.highestSeverity,
    currentHighestUrgency: stats.highestUrgency,
    currentHasExtreme: stats.hasExtremeAlert,
    now,
  });

  const freshness = {
    latestSourceUpdateAt,
    newestIssuedAt: stats.newestIssuedAt,
    earliestExpirationAt: stats.earliestExpirationAt,
    briefGeneratedAt: weatherBrief.generatedAt,
    dataSignature,
    isStale: Boolean(cachedBrief?.status === 'stale'),
    dataAvailable,
  };

  return {
    ok: true,
    hazardSlug: config.slug,
    hazardLabel: config.singularLabel,
    pluralLabel: config.pluralLabel,
    pageTitle: config.pageTitle,
    shortLabel: config.shortLabel,
    intro: config.intro,
    icon: config.icon,
    severityColor: config.severityColor,
    radarFilter: config.radarFilter,
    radarCategory: config.radarCategory,
    nwsEvents: config.nwsEvents,
    seoTitle: config.seoTitle,
    seoDescription: config.seoDescription,
    educationalContentKey: config.educationalContentKey,
    href: hazardHref(config.slug),
    radarHref: `/radar`,
    alertsHref: `#current-alerts`,
    fullRadarHref: `/radar`,

    activeCount: filtered.length,
    alerts: filtered,
    affectedStates,
    affectedCounties,
    stateLinks: affectedStates.filter((s) => s.href),

    newestIssuedAt: stats.newestIssuedAt,
    latestSourceUpdateAt,
    earliestExpirationAt: stats.earliestExpirationAt,
    highestSeverity: stats.highestSeverity,
    highestUrgency: stats.highestUrgency,
    highestCertainty: stats.highestCertainty,
    hasExtremeAlert: stats.hasExtremeAlert,

    sourceAlertIds,
    dataSignature,
    liveStatus,
    weatherBrief,
    relatedHazards: buildRelatedHazards(config, relatedCounts),

    freshness,
    confidence: weatherBrief.confidence,
    updatedAt: latestSourceUpdateAt || stats.newestIssuedAt || new Date(now).toISOString(),

    regeneration: regen,
    config,
  };
}

/**
 * Convenience: compute related counts for all launch hazards from one alert set.
 */
export function getRelatedCounts(alerts, slugs = getLaunchHazardSlugs()) {
  const counts = {};
  for (const slug of slugs) {
    const config = getHazardConfig(slug);
    if (!config) continue;
    counts[slug] = filterAlertsForHazard(alerts, config).length;
  }
  return counts;
}

export {
  getState,
  alertAffectsState,
  buildStateHazards,
  buildStateSituationSummary,
};

export const hazardEngine = {
  get,
  getState,
  getConfig: getHazardConfig,
  getAllSlugs: getAllHazardSlugs,
  getLaunchSlugs: getLaunchHazardSlugs,
  getRelatedCounts,
  href: hazardHref,
  shouldRegenerateBrief,
  buildFallbackBrief,
  buildLiveStatus,
  buildDataSignature,
  validateBriefResponse,
  buildBriefLlmPayload,
  buildBriefUserPrompt,
  BRIEF_SYSTEM_PROMPT,
  PROMPT_VERSION,
  MAX_ALERTS_TO_LLM,
  HAZARD_CONFIGS,
};

export default hazardEngine;
