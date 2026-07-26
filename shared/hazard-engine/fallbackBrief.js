/**
 * Deterministic Weather Brief fallback — used when Haiku is unavailable,
 * rejected, disabled, or stale. Delegates to the Current Situation brief
 * so Layer 1 and fallback stay aligned (UI still hides fallback duplicates).
 */

import { buildSituationBrief } from './liveStatus.js';

export function buildFallbackBrief(config, {
  activeCount,
  affectedStates,
  affectedCounties = [],
  alerts = [],
} = {}) {
  const summary = buildSituationBrief(config, {
    activeCount,
    affectedStates,
    countyCount: Array.isArray(affectedCounties) ? affectedCounties.length : 0,
    alerts,
  });

  return {
    summary,
    notableChange: null,
    source: 'fallback',
  };
}
