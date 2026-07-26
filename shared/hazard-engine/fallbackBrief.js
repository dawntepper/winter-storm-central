/**
 * Deterministic Weather Brief fallback — used when Haiku is unavailable,
 * rejected, disabled, or stale. Never invents locations beyond structured data.
 */

export function buildFallbackBrief(config, { activeCount, affectedStates }) {
  const pluralLower = (config.pluralLabel || 'alerts').toLowerCase();
  const singularLower = (config.singularLabel || 'alert').toLowerCase();
  const states = affectedStates || [];

  if (activeCount <= 0) {
    return {
      summary: `No ${pluralLower} are currently active in the United States. This page will update when new ${pluralLower} are issued.`,
      notableChange: null,
      source: 'fallback',
    };
  }

  if (activeCount === 1 && states.length === 1) {
    return {
      summary: `One ${singularLower} is currently active in ${states[0].name}. Review the warning details and live radar for the latest affected area and expiration time.`,
      notableChange: null,
      source: 'fallback',
    };
  }

  if (states.length === 0) {
    return {
      summary: `${activeCount} ${activeCount === 1 ? singularLower : pluralLower} ${activeCount === 1 ? 'is' : 'are'} currently active. Review the alert list and live radar for affected areas and expiration times.`,
      notableChange: null,
      source: 'fallback',
    };
  }

  if (states.length === 1) {
    return {
      summary: `${activeCount} ${pluralLower} are currently active in ${states[0].name}. Review the alert details and live radar for the latest affected areas.`,
      notableChange: null,
      source: 'fallback',
    };
  }

  const top = states.slice(0, 3).map((s) => s.name);
  const lead = top[0];
  const followers = top.slice(1);
  let followText = '';
  if (followers.length === 1) followText = `, followed by ${followers[0]}`;
  if (followers.length === 2) followText = `, followed by ${followers[0]} and ${followers[1]}`;

  return {
    summary: `${config.pluralLabel} are currently active in ${states.length} states. ${lead} has the largest number of active ${pluralLower}${followText}.`,
    notableChange: null,
    source: 'fallback',
  };
}
