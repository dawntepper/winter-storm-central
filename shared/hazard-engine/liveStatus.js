/**
 * Deterministic Live Status copy — never from Claude.
 */

import { MAX_STATES_COMPACT, labelForCount } from './hazards.js';

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Compact state list for Live Status sentence / chips.
 * Full list remains in affectedStates for expand/crawlable links.
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

export function buildLiveStatus(config, { activeCount, affectedStates }) {
  const label = labelForCount(config, activeCount);
  const pluralLower = (config.pluralLabel || 'alerts').toLowerCase();
  const singularLower = (config.singularLabel || 'alert').toLowerCase();

  if (activeCount <= 0) {
    return {
      heading: 'Live Status',
      statusHeadline: `No Active ${config.pluralLabel}`,
      statusSentence: config.zeroActiveDescription
        || `There are currently no active ${pluralLower} in the United States.`,
      countLabel: null,
      hasActiveAlerts: false,
      affectedStatesCompact: formatAffectedStatesCompact([]),
    };
  }

  const compact = formatAffectedStatesCompact(affectedStates);
  const countLabel = `${activeCount} ${label} Active`;

  let statusSentence;
  if (compact.compactNames.length > 0) {
    const subject = activeCount === 1
      ? `A ${singularLower} is`
      : `${config.pluralLabel} are`;
    statusSentence = `${subject} currently active across ${compact.displayText}.`;
  } else {
    statusSentence = activeCount === 1
      ? `One ${singularLower} is currently active in the United States.`
      : `${activeCount} ${pluralLower} are currently active in the United States.`;
  }

  return {
    heading: 'Live Status',
    statusHeadline: countLabel,
    statusSentence,
    countLabel,
    hasActiveAlerts: true,
    affectedStatesCompact: compact,
  };
}
