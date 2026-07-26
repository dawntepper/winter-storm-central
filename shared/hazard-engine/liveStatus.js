/**
 * Deterministic Current Situation copy — never from Claude.
 * Used as Layer 1 facts above the radar on hazard landing pages.
 */

import { MAX_STATES_COMPACT, labelForCount } from './hazards.js';

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Compact state list for chips / expand control.
 */
export function formatAffectedStatesCompact(affectedStates, { max = MAX_STATES_COMPACT } = {}) {
  const states = affectedStates || [];
  if (states.length === 0) {
    return {
      compactNames: [],
      compactSentence: '',
      remainingCount: 0,
      displayText: '',
    };
  }

  const shown = states.slice(0, max);
  const remainingCount = Math.max(0, states.length - shown.length);
  const compactNames = shown.map((s) => s.name);
  let displayText = joinNames(compactNames);
  if (remainingCount > 0) {
    displayText = `${compactNames.join(', ')}, and ${remainingCount} more state${remainingCount === 1 ? '' : 's'}`;
  }

  return {
    compactNames,
    compactSentence: displayText,
    remainingCount,
    displayText,
  };
}

/**
 * Distribution-aware deterministic summary for Current Situation.
 * Example: "Flood Warnings are currently active across Texas, Georgia,
 * and Kansas, with Texas accounting for 5 of the 7 active warnings.
 * Georgia and Kansas each have one active warning."
 */
export function buildSituationSummary(config, { activeCount, affectedStates }) {
  const pluralLower = (config.pluralLabel || 'alerts').toLowerCase();
  const singularLower = (config.singularLabel || 'alert').toLowerCase();
  const states = affectedStates || [];

  if (activeCount <= 0) {
    return (
      config.zeroActiveDescription
      || `There are currently no active ${pluralLower} in the United States.`
    );
  }

  if (states.length === 0) {
    return activeCount === 1
      ? `One ${singularLower} is currently active in the United States.`
      : `${activeCount} ${pluralLower} are currently active in the United States.`;
  }

  if (activeCount === 1 && states.length === 1) {
    return `One ${singularLower} is currently active in ${states[0].name}.`;
  }

  if (states.length === 1) {
    return `${activeCount} ${pluralLower} are currently active in ${states[0].name}.`;
  }

  const compact = formatAffectedStatesCompact(states);
  const lead = states[0];
  const leadCount = lead.alertCount || 0;

  let summary = `${config.pluralLabel} are currently active across ${compact.displayText}`;

  if (leadCount > 0 && leadCount < activeCount) {
    summary += `, with ${lead.name} accounting for ${leadCount} of the ${activeCount} active ${pluralLower}`;
  }
  summary += '.';

  // Mention next states' counts when small and clear
  const followers = states.slice(1, 3).filter((s) => (s.alertCount || 0) > 0);
  if (followers.length === 1 && followers[0].alertCount === 1) {
    summary += ` ${followers[0].name} has one active ${singularLower}.`;
  } else if (
    followers.length === 2
    && followers.every((s) => s.alertCount === 1)
  ) {
    summary += ` ${followers[0].name} and ${followers[1].name} each have one active ${singularLower}.`;
  } else if (followers.length >= 1 && leadCount > (followers[0].alertCount || 0)) {
    const parts = followers.map((s) => `${s.name} (${s.alertCount})`);
    if (parts.length === 1) {
      summary += ` ${parts[0].replace(/ \((\d+)\)/, ' has $1 active')}.`;
    } else {
      summary += ` ${joinNames(followers.map((s) => s.name))} account for the remaining active ${pluralLower}.`;
    }
  }

  return summary;
}

export function buildLiveStatus(config, { activeCount, affectedStates }) {
  const label = labelForCount(config, activeCount);
  const pluralLower = (config.pluralLabel || 'alerts').toLowerCase();

  if (activeCount <= 0) {
    return {
      heading: 'Current Situation',
      statusHeadline: `No Active ${config.pluralLabel}`,
      statusSentence: buildSituationSummary(config, { activeCount: 0, affectedStates: [] }),
      situationSummary: buildSituationSummary(config, { activeCount: 0, affectedStates: [] }),
      monitoringNote:
        `StormTracking continues to monitor National Weather Service alerts and will update this page when new ${pluralLower} are issued.`,
      countLabel: null,
      hasActiveAlerts: false,
      affectedStatesCompact: formatAffectedStatesCompact([]),
    };
  }

  const compact = formatAffectedStatesCompact(affectedStates);
  const situationSummary = buildSituationSummary(config, { activeCount, affectedStates });
  // Prefer plural label in the headline for scannability ("Active Flood Warnings: 7")
  const headlineLabel = config.pluralLabel || label;

  return {
    heading: 'Current Situation',
    statusHeadline: `Active ${headlineLabel}: ${activeCount}`,
    statusSentence: situationSummary,
    situationSummary,
    monitoringNote: null,
    countLabel: `Active ${headlineLabel}: ${activeCount}`,
    hasActiveAlerts: true,
    affectedStatesCompact: compact,
  };
}
