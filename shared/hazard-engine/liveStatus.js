/**
 * Deterministic Current Situation briefing — never from Claude.
 * Layer 1 facts above the radar on hazard landing pages.
 *
 * Structured presentation:
 *   headline · brief · changeSummary · affectedStatesCompact
 */

import { MAX_STATES_COMPACT, labelForCount, resolveDisplayLabels } from './hazards.js';

const SMALL_WORDS = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
};

/** Phenomenon-first openers where they read naturally. */
const HAZARD_VOICE = {
  'tornado-warning': { kind: 'alerts', opener: 'Tornado warnings' },
  'tornado-watch': { kind: 'alerts', opener: 'Tornado watches' },
  'severe-thunderstorm-warning': { kind: 'phenomenon', opener: 'Severe thunderstorms' },
  'severe-thunderstorm-watch': { kind: 'alerts', opener: 'Severe thunderstorm watches' },
  'flash-flood-warning': { kind: 'threat', opener: 'Flooding threats' },
  'flash-flood-watch': { kind: 'alerts', opener: 'Flash flood watches' },
  'flood-warning': { kind: 'threat', opener: 'Flooding threats' },
  'flood-watch': { kind: 'alerts', opener: 'Flood watches' },
  'hurricane-warning': { kind: 'phenomenon', opener: 'Hurricane conditions' },
  'tropical-storm-warning': { kind: 'phenomenon', opener: 'Tropical storm conditions' },
  'blizzard-warning': { kind: 'phenomenon', opener: 'Blizzard conditions' },
  'winter-storm-warning': { kind: 'phenomenon', opener: 'Winter weather alerts' },
  'ice-storm-warning': { kind: 'phenomenon', opener: 'Ice storm conditions' },
  'high-wind-warning': { kind: 'alerts', opener: 'High wind warnings' },
  'excessive-heat-warning': { kind: 'mass', opener: 'Extreme heat' },
  'red-flag-warning': { kind: 'phenomenon', opener: 'Critical fire-weather conditions' },
  'storm-surge-warning': { kind: 'threat', opener: 'Storm surge threats' },
  'extreme-wind-warning': { kind: 'alerts', opener: 'Extreme wind warnings' },
};

function joinNames(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function proseCount(n) {
  return SMALL_WORDS[n] || String(n);
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getVoice(config) {
  return HAZARD_VOICE[config?.slug] || {
    kind: 'alerts',
    opener: config?.pluralLabel || 'Alerts',
  };
}

function stateAlertSum(states) {
  return (states || []).reduce((sum, s) => sum + (s.alertCount || 0), 0);
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
 * Cluster expiration times into a short, reliable timing phrase.
 */
export function buildTimingPhrase(alerts, { now = Date.now() } = {}) {
  const expiresMs = [];
  for (const alert of alerts || []) {
    if (!alert?.expires) continue;
    const ms = new Date(alert.expires).getTime();
    if (!Number.isFinite(ms) || ms <= now) continue;
    expiresMs.push(ms);
  }
  if (expiresMs.length === 0) return null;

  expiresMs.sort((a, b) => a - b);
  const earliest = expiresMs[0];
  const latest = expiresMs[expiresMs.length - 1];

  const dayKey = (ms) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  };

  const byDay = new Map();
  for (const ms of expiresMs) {
    const key = dayKey(ms);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }

  const formatDay = (ms) => {
    const d = new Date(ms);
    const hour = d.getUTCHours();
    const hoursOut = (ms - now) / (60 * 60 * 1000);

    if (hoursOut < 18) {
      if (hour >= 17 || hour < 4) return 'this evening';
      if (hour < 12) return 'this morning';
      return 'today';
    }
    if (hoursOut < 42) {
      if (hour < 12) return 'tomorrow morning';
      if (hour >= 17) return 'tomorrow evening';
      return 'tomorrow';
    }

    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  const earliestLabel = formatDay(earliest);
  const latestLabel = formatDay(latest);

  if (byDay.size === 1 || earliestLabel === latestLabel) {
    if (expiresMs.length === 1) return `The warning expires ${earliestLabel}.`;
    return `Most warnings expire ${earliestLabel}.`;
  }

  let majorityDay = null;
  let majorityCount = 0;
  for (const [key, count] of byDay) {
    if (count > majorityCount) {
      majorityCount = count;
      majorityDay = key;
    }
  }
  const majorityMs = expiresMs.find((ms) => dayKey(ms) === majorityDay) || earliest;
  const majorityLabel = formatDay(majorityMs);

  if (majorityCount / expiresMs.length >= 0.55) {
    return `Most warnings expire ${majorityLabel}, with some continuing through ${latestLabel}.`;
  }

  return `Warnings remain in effect through ${latestLabel}.`;
}

/** "61 Excessive Heat Warnings Active" / "No Tornado Warnings Active" */
export function buildSituationHeadline(displayConfig, activeCount) {
  const plural = displayConfig.pluralLabel || 'Alerts';
  if (activeCount <= 0) return `No ${plural} Active`;
  const label = labelForCount(displayConfig, activeCount);
  return `${activeCount} ${label} Active`;
}

function appendTiming(text, timing) {
  if (!timing) return text;
  const base = text.replace(/\s+$/, '').replace(/\.$/, '');
  return `${base}. ${timing}`;
}

function briefSingleState({
  voice, activeCount, state, countyCount, pluralLower, singularLower, timing,
}) {
  const n = proseCount(activeCount);
  let brief;

  if (activeCount === 1) {
    if (voice.kind === 'mass') {
      brief = `${voice.opener} remains concentrated in ${state.name}, with one ${singularLower} in effect.`;
    } else if (voice.kind === 'phenomenon' || voice.kind === 'threat') {
      brief = `${voice.opener} ${voice.kind === 'threat' ? 'remain' : 'remain'} concentrated in ${state.name}, with one ${singularLower} in effect.`;
      if (voice.kind === 'phenomenon' && /conditions$/i.test(voice.opener)) {
        brief = `${voice.opener} remain a concern in ${state.name}, with one ${singularLower} in effect.`;
      }
    } else {
      brief = `One ${singularLower} is currently active in ${state.name}.`;
    }
  } else if (countyCount > 0 && countyCount !== activeCount) {
    if (voice.kind === 'mass') {
      brief = `${voice.opener} remains concentrated in ${state.name}, with ${n} ${pluralLower} affecting ${proseCount(countyCount)} counties.`;
    } else {
      brief = `${capitalize(pluralLower)} are concentrated in ${state.name}, with ${n} warnings affecting ${proseCount(countyCount)} counties.`;
    }
  } else if (voice.kind === 'mass') {
    brief = `${voice.opener} remains concentrated in ${state.name}, with ${n} ${pluralLower} in effect.`;
  } else {
    brief = `${capitalize(pluralLower)} are concentrated in ${state.name}, with ${n} ${pluralLower} in effect.`;
  }

  return appendTiming(brief, timing);
}

function briefSmallMulti({
  activeCount, states, pluralLower, singularLower, timing,
}) {
  const lead = states[0];
  const leadCount = lead.alertCount || 0;
  const others = states.slice(1);
  const sum = stateAlertSum(states);
  const reconciled = sum === activeCount;

  const sentences = [];

  if (reconciled && leadCount > 0 && leadCount < activeCount) {
    sentences.push(
      `${capitalize(pluralLower)} are concentrated in ${lead.name}, which accounts for ${proseCount(leadCount)} of the ${proseCount(activeCount)} active ${pluralLower}.`
    );

    if (others.every((s) => (s.alertCount || 0) === 1)) {
      sentences.push(
        others.length === 1
          ? `${others[0].name} has one ${singularLower}.`
          : `${joinNames(others.map((s) => s.name))} each have one ${singularLower}.`
      );
    } else {
      // Explicit per-state clauses — never "the remaining"
      const bits = others.map((s) => {
        const n = s.alertCount || 0;
        return n === 1
          ? `${s.name} has one ${singularLower}`
          : `${s.name} has ${proseCount(n)} ${pluralLower}`;
      });
      sentences.push(`${joinNames(bits)}.`);
    }
  } else {
    sentences.push(
      `${proseCount(activeCount)} ${pluralLower} are active across ${joinNames(states.map((s) => s.name))}.`
    );
  }

  return appendTiming(sentences.join(' '), timing);
}

function briefLargeMulti({
  voice, activeCount, states, countyCount, pluralLower, timing,
}) {
  const stateCount = states.length;
  const top = states.slice(0, 4);
  const lead = top[0];
  const leadCount = lead.alertCount || 0;
  const dominant = leadCount > 0 && leadCount >= Math.ceil(activeCount * 0.15);

  let sentence1;
  if (voice.kind === 'mass') {
    const scale = countyCount > 0
      ? `with warnings across ${stateCount} states and ${countyCount} counties`
      : `with warnings across ${stateCount} states`;
    sentence1 = `${voice.opener} is affecting a broad area of the U.S., ${scale}.`;
  } else if (voice.kind === 'phenomenon' || voice.kind === 'threat') {
    const scale = countyCount > 0
      ? `across ${stateCount} states and ${countyCount} counties`
      : `across ${stateCount} states`;
    sentence1 = `${voice.opener} are affecting a broad area of the U.S., with ${pluralLower} ${scale}.`;
  } else {
    sentence1 = `${capitalize(pluralLower)} extend across ${stateCount} states${countyCount > 0 ? ` and ${countyCount} counties` : ''}.`;
  }

  let sentence2 = null;
  if (dominant && top.length >= 2) {
    const clustered = top.length >= 3
      && (top[1].alertCount || 0) >= Math.max(1, Math.floor(leadCount * 0.6));
    if (clustered) {
      sentence2 = `The greatest concentration is in ${joinNames(top.map((s) => s.name))}.`;
    } else {
      sentence2 = `The greatest concentration is in ${lead.name}.`;
    }
  }

  return [sentence1, sentence2, timing].filter(Boolean).join(' ');
}

/**
 * Size-adaptive 1–2 sentence weather brief.
 * Does not enumerate the Affected States list.
 */
export function buildSituationBrief(displayConfig, {
  activeCount,
  affectedStates = [],
  countyCount = 0,
  alerts = [],
  now = Date.now(),
} = {}) {
  const pluralLower = (displayConfig.pluralLabel || 'alerts').toLowerCase();
  const singularLower = (displayConfig.singularLabel || 'alert').toLowerCase();
  const states = affectedStates || [];
  const voice = getVoice(displayConfig);
  const timing = buildTimingPhrase(alerts, { now });

  if (activeCount <= 0) {
    return (
      displayConfig.zeroActiveDescription
      || `There are currently no active ${pluralLower} in the United States.`
    );
  }

  if (states.length === 0) {
    const base = activeCount === 1
      ? `One ${singularLower} is currently active in the United States.`
      : `${activeCount} ${pluralLower} are currently active in the United States.`;
    return appendTiming(base, timing);
  }

  if (states.length === 1) {
    return briefSingleState({
      voice,
      activeCount,
      state: states[0],
      countyCount,
      pluralLower,
      singularLower,
      timing,
    });
  }

  if (states.length <= 4) {
    return briefSmallMulti({
      activeCount,
      states,
      pluralLower,
      singularLower,
      timing,
    });
  }

  return briefLargeMulti({
    voice,
    activeCount,
    states,
    countyCount,
    pluralLower,
    timing,
  });
}

/**
 * Deterministic "What's changed" — only when a prior snapshot exists.
 */
export function buildChangeSummary({
  activeCount,
  affectedStates = [],
  previousSnapshot = null,
  pluralLabel = 'alerts',
  singularLabel = 'alert',
} = {}) {
  if (!previousSnapshot || typeof previousSnapshot.activeCount !== 'number') {
    return null;
  }

  const prevCount = previousSnapshot.activeCount;
  const prevCodes = new Set(
    (previousSnapshot.stateCodes || previousSnapshot.affectedStateCodes || [])
      .map((c) => String(c).toUpperCase())
  );
  const currCodes = new Set((affectedStates || []).map((s) => String(s.code).toUpperCase()));
  const pluralLower = (pluralLabel || 'alerts').toLowerCase();
  const singularLower = (singularLabel || 'alert').toLowerCase();

  const added = [...currCodes].filter((c) => !prevCodes.has(c));
  const removed = [...prevCodes].filter((c) => !currCodes.has(c));
  const delta = activeCount - prevCount;

  if (delta === 0 && added.length === 0 && removed.length === 0) {
    return null;
  }

  const prevNames = previousSnapshot.stateNames || {};
  const nameFor = (code) => {
    const hit = (affectedStates || []).find((s) => s.code === code);
    return hit?.name || prevNames[code] || code;
  };

  if (prevCount === 0 && activeCount > 0) {
    const scale = currCodes.size > 0
      ? ` across ${currCodes.size} state${currCodes.size === 1 ? '' : 's'}`
      : '';
    return `${capitalize(pluralLower)} are now active${scale}, replacing a period with no active ${pluralLower}.`;
  }

  if (activeCount === 0 && prevCount > 0) {
    return `Active ${pluralLower} have ended since the previous update.`;
  }

  const chunks = [];

  if (delta > 0) {
    let chunk = `${proseCount(delta)} additional ${delta === 1 ? singularLower : pluralLower} ${delta === 1 ? 'has' : 'have'} been issued since the previous update`;
    if (added.length > 0 && added.length <= 4) {
      chunk += `, including new warnings in ${joinNames(added.map(nameFor))}`;
    }
    chunks.push(chunk);
  } else if (delta < 0) {
    chunks.push(
      `The warning count has fallen from ${prevCount} to ${activeCount} as alerts expired`
    );
  }

  if (delta <= 0 && added.length > 0 && added.length <= 4) {
    chunks.push(
      `${capitalize(pluralLower)} have expanded into ${joinNames(added.map(nameFor))}`
    );
  } else if (delta === 0 && removed.length > 0 && removed.length <= 3) {
    chunks.push(`Alerts ended in ${joinNames(removed.map(nameFor))}`);
  }

  if (chunks.length === 0) return null;
  let text = chunks.join(', ');
  if (!/[.!?]$/.test(text)) text += '.';
  return capitalize(text);
}

/** @deprecated Prefer buildSituationBrief */
export function buildSituationSummary(config, args) {
  return buildSituationBrief(config, {
    activeCount: args.activeCount,
    affectedStates: args.affectedStates,
    countyCount: args.countyCount || args.affectedCounties?.length || 0,
    alerts: args.alerts || [],
    now: args.now,
  });
}

/**
 * Full Layer-1 Current Situation object.
 */
export function buildLiveStatus(config, {
  activeCount,
  affectedStates = [],
  affectedCounties = [],
  alerts = [],
  previousSnapshot = null,
  now = Date.now(),
} = {}) {
  const labels = resolveDisplayLabels(config, alerts);
  const displayConfig = {
    ...config,
    singularLabel: labels.singularLabel || config.singularLabel,
    pluralLabel: labels.pluralLabel || config.pluralLabel,
  };

  const countyCount = Array.isArray(affectedCounties)
    ? affectedCounties.length
    : (Number(affectedCounties) || 0);

  const compactMax = (affectedStates?.length || 0) >= 5 ? 4 : MAX_STATES_COMPACT;
  const compact = formatAffectedStatesCompact(affectedStates, { max: compactMax });
  const headline = buildSituationHeadline(displayConfig, activeCount);
  const brief = buildSituationBrief(displayConfig, {
    activeCount,
    affectedStates,
    countyCount,
    alerts,
    now,
  });
  const changeSummary = buildChangeSummary({
    activeCount,
    affectedStates,
    previousSnapshot,
    pluralLabel: displayConfig.pluralLabel,
    singularLabel: displayConfig.singularLabel,
  });
  const hasPreviousSnapshot = Boolean(
    previousSnapshot && typeof previousSnapshot.activeCount === 'number'
  );

  if (activeCount <= 0) {
    const pluralLower = (displayConfig.pluralLabel || 'alerts').toLowerCase();
    return {
      heading: 'Current Situation',
      statusHeadline: headline,
      statusSentence: brief,
      situationSummary: brief,
      brief,
      changeSummary,
      monitoringNote:
        `StormTracking continues to monitor National Weather Service alerts and will update this page when new ${pluralLower} are issued.`,
      countLabel: null,
      hasActiveAlerts: false,
      hasPreviousSnapshot,
      affectedStatesCompact: formatAffectedStatesCompact([]),
      countyCount: 0,
    };
  }

  return {
    heading: 'Current Situation',
    statusHeadline: headline,
    statusSentence: brief,
    situationSummary: brief,
    brief,
    changeSummary,
    monitoringNote: null,
    countLabel: headline,
    hasActiveAlerts: true,
    hasPreviousSnapshot,
    affectedStatesCompact: compact,
    countyCount,
  };
}
