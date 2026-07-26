/**
 * Stable data signature for regeneration decisions.
 * Based on meaningful hazard conditions — not relative "updated N minutes ago" text.
 */

export function buildDataSignature({
  hazardSlug,
  activeCount,
  affectedStateCodes = [],
  sourceAlertIds = [],
  highestSeverity = null,
  highestUrgency = null,
  hasExtremeAlert = false,
}) {
  const states = [...affectedStateCodes].map(String).sort().join(',');
  const ids = [...sourceAlertIds].map(String).sort().join(',');
  return [
    hazardSlug || '',
    `c:${activeCount ?? 0}`,
    `s:${states}`,
    `sev:${highestSeverity || ''}`,
    `urg:${highestUrgency || ''}`,
    `ext:${hasExtremeAlert ? 1 : 0}`,
    `ids:${ids}`,
  ].join('|');
}
