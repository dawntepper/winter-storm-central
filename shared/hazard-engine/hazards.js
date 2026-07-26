/**
 * Centralized severe-weather hazard configuration.
 * Page text, routes, radar filters, and SEO are driven from this file.
 */

import { ALERT_CATEGORIES } from '../nws-alert-parser.js';

const tornado = ALERT_CATEGORIES.tornado;
const severe = ALERT_CATEGORIES.severe;
const flood = ALERT_CATEGORIES.flood;
const tropical = ALERT_CATEGORIES.tropical;

/**
 * @typedef {object} HazardConfig
 * @property {string} slug
 * @property {string[]} nwsEvents - Exact NWS event names
 * @property {string} singularLabel
 * @property {string} pluralLabel
 * @property {string} pageTitle - H1
 * @property {string} shortLabel
 * @property {string} intro
 * @property {string} icon
 * @property {string} severityColor
 * @property {string} radarCategory - StormMap category id
 * @property {string} radarFilter - Engine radar filter key (event-level)
 * @property {string} seoTitle
 * @property {string} seoDescription
 * @property {string} zeroActiveDescription
 * @property {string[]} relatedHazards
 * @property {string} educationalContentKey
 * @property {boolean} [launch] - Fully wired in initial release
 */

/** @type {Record<string, HazardConfig>} */
export const HAZARD_CONFIGS = {
  'tornado-warning': {
    slug: 'tornado-warning',
    nwsEvents: ['Tornado Warning'],
    singularLabel: 'Tornado Warning',
    pluralLabel: 'Tornado Warnings',
    pageTitle: 'Tornado Warnings Today',
    shortLabel: 'Tornado',
    intro:
      'Track active tornado warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: tornado.icon,
    severityColor: tornado.color,
    radarCategory: 'tornado',
    radarFilter: 'tornado-warning',
    seoTitle: 'Tornado Warnings Today: Live Radar & Active Alerts | StormTracking',
    seoDescription:
      'Track active tornado warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active tornado warnings in the United States.',
    relatedHazards: ['tornado-watch', 'severe-thunderstorm-warning', 'flash-flood-warning'],
    educationalContentKey: 'tornado-warning',
    launch: true,
  },
  'tornado-watch': {
    slug: 'tornado-watch',
    nwsEvents: ['Tornado Watch'],
    singularLabel: 'Tornado Watch',
    pluralLabel: 'Tornado Watches',
    pageTitle: 'Tornado Watches Today',
    shortLabel: 'Tornado Watch',
    intro:
      'Track active tornado watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
    icon: tornado.icon,
    severityColor: tornado.color,
    radarCategory: 'tornado',
    radarFilter: 'tornado-watch',
    seoTitle: 'Tornado Watches Today: Live Radar & Active Watches | StormTracking',
    seoDescription:
      'Track active tornado watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active tornado watches in the United States.',
    relatedHazards: ['tornado-warning', 'severe-thunderstorm-watch', 'severe-thunderstorm-warning'],
    educationalContentKey: 'tornado-watch',
    launch: true,
  },
  'severe-thunderstorm-warning': {
    slug: 'severe-thunderstorm-warning',
    nwsEvents: ['Severe Thunderstorm Warning'],
    singularLabel: 'Severe Thunderstorm Warning',
    pluralLabel: 'Severe Thunderstorm Warnings',
    pageTitle: 'Severe Thunderstorm Warnings Today',
    shortLabel: 'Severe Thunderstorm',
    intro:
      'Track active severe thunderstorm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: severe.icon,
    severityColor: severe.color,
    radarCategory: 'severe',
    radarFilter: 'severe-thunderstorm-warning',
    seoTitle: 'Severe Thunderstorm Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active severe thunderstorm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active severe thunderstorm warnings in the United States.',
    relatedHazards: ['severe-thunderstorm-watch', 'tornado-warning', 'flash-flood-warning'],
    educationalContentKey: 'severe-thunderstorm-warning',
    launch: true,
  },
  'severe-thunderstorm-watch': {
    slug: 'severe-thunderstorm-watch',
    nwsEvents: ['Severe Thunderstorm Watch'],
    singularLabel: 'Severe Thunderstorm Watch',
    pluralLabel: 'Severe Thunderstorm Watches',
    pageTitle: 'Severe Thunderstorm Watches Today',
    shortLabel: 'Severe Thunderstorm Watch',
    intro:
      'Track active severe thunderstorm watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
    icon: severe.icon,
    severityColor: severe.color,
    radarCategory: 'severe',
    radarFilter: 'severe-thunderstorm-watch',
    seoTitle: 'Severe Thunderstorm Watches Today & Live Radar | StormTracking',
    seoDescription:
      'Track active severe thunderstorm watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active severe thunderstorm watches in the United States.',
    relatedHazards: ['severe-thunderstorm-warning', 'tornado-watch', 'tornado-warning'],
    educationalContentKey: 'severe-thunderstorm-watch',
    launch: true,
  },
  'flash-flood-warning': {
    slug: 'flash-flood-warning',
    nwsEvents: ['Flash Flood Warning'],
    singularLabel: 'Flash Flood Warning',
    pluralLabel: 'Flash Flood Warnings',
    pageTitle: 'Flash Flood Warnings Today',
    shortLabel: 'Flash Flood',
    intro:
      'Track active flash flood warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: flood.icon,
    severityColor: flood.color,
    radarCategory: 'flood',
    radarFilter: 'flash-flood-warning',
    seoTitle: 'Flash Flood Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active flash flood warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active flash flood warnings in the United States.',
    relatedHazards: ['flood-watch', 'severe-thunderstorm-warning', 'tornado-warning'],
    educationalContentKey: 'flash-flood-warning',
    launch: true,
  },
  'flood-watch': {
    slug: 'flood-watch',
    nwsEvents: ['Flood Watch'],
    singularLabel: 'Flood Watch',
    pluralLabel: 'Flood Watches',
    pageTitle: 'Flood Watches Today',
    shortLabel: 'Flood Watch',
    intro:
      'Track active flood watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
    icon: flood.icon,
    severityColor: flood.color,
    radarCategory: 'flood',
    radarFilter: 'flood-watch',
    seoTitle: 'Flood Watches Today: Live Radar & Active Watches | StormTracking',
    seoDescription:
      'Track active flood watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active flood watches in the United States.',
    relatedHazards: ['flash-flood-warning', 'severe-thunderstorm-watch', 'hurricane-warning'],
    educationalContentKey: 'flood-watch',
    launch: true,
  },
  'hurricane-warning': {
    slug: 'hurricane-warning',
    nwsEvents: ['Hurricane Warning'],
    singularLabel: 'Hurricane Warning',
    pluralLabel: 'Hurricane Warnings',
    pageTitle: 'Hurricane Warnings Today',
    shortLabel: 'Hurricane',
    intro:
      'Track active hurricane warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: tropical.icon,
    severityColor: tropical.color,
    radarCategory: 'tropical',
    radarFilter: 'hurricane-warning',
    seoTitle: 'Hurricane Warnings Today, Alerts & Live Radar | StormTracking',
    seoDescription:
      'Track active hurricane warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active hurricane warnings in the United States.',
    relatedHazards: ['tropical-storm-warning', 'flash-flood-warning', 'flood-watch'],
    educationalContentKey: 'hurricane-warning',
    launch: true,
  },
  'tropical-storm-warning': {
    slug: 'tropical-storm-warning',
    nwsEvents: ['Tropical Storm Warning'],
    singularLabel: 'Tropical Storm Warning',
    pluralLabel: 'Tropical Storm Warnings',
    pageTitle: 'Tropical Storm Warnings Today',
    shortLabel: 'Tropical Storm',
    intro:
      'Track active tropical storm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: tropical.icon,
    severityColor: tropical.color,
    radarCategory: 'tropical',
    radarFilter: 'tropical-storm-warning',
    seoTitle: 'Tropical Storm Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active tropical storm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active tropical storm warnings in the United States.',
    relatedHazards: ['hurricane-warning', 'flood-watch', 'flash-flood-warning'],
    educationalContentKey: 'tropical-storm-warning',
    launch: true,
  },

  'flash-flood-watch': {
    slug: 'flash-flood-watch',
    nwsEvents: ['Flash Flood Watch'],
    singularLabel: 'Flash Flood Watch',
    pluralLabel: 'Flash Flood Watches',
    pageTitle: 'Flash Flood Watches Today',
    shortLabel: 'Flash Flood Watch',
    intro:
      'Track active flash flood watches across the United States with live radar, affected areas, watch details, and links to current state alerts.',
    icon: flood.icon,
    severityColor: flood.color,
    radarCategory: 'flood',
    radarFilter: 'flash-flood-watch',
    seoTitle: 'Flash Flood Watches Today & Live Radar | StormTracking',
    seoDescription:
      'Track active flash flood watches across the United States with live radar, affected states, watch details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active flash flood watches in the United States.',
    relatedHazards: ['flash-flood-warning', 'flood-watch', 'flood-warning'],
    educationalContentKey: 'flash-flood-watch',
    launch: true,
  },
  'flood-warning': {
    slug: 'flood-warning',
    nwsEvents: ['Flood Warning'],
    singularLabel: 'Flood Warning',
    pluralLabel: 'Flood Warnings',
    pageTitle: 'Flood Warnings Today',
    shortLabel: 'Flood',
    intro:
      'Track active flood warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: flood.icon,
    severityColor: flood.color,
    radarCategory: 'flood',
    radarFilter: 'flood-warning',
    seoTitle: 'Flood Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active flood warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active flood warnings in the United States.',
    relatedHazards: ['flash-flood-warning', 'flood-watch', 'severe-thunderstorm-warning'],
    educationalContentKey: 'flood-warning',
    launch: true,
  },
  'blizzard-warning': {
    slug: 'blizzard-warning',
    nwsEvents: ['Blizzard Warning'],
    singularLabel: 'Blizzard Warning',
    pluralLabel: 'Blizzard Warnings',
    pageTitle: 'Blizzard Warnings Today',
    shortLabel: 'Blizzard',
    intro:
      'Track active blizzard warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: ALERT_CATEGORIES.winter.icon,
    severityColor: ALERT_CATEGORIES.winter.color,
    radarCategory: 'winter',
    radarFilter: 'blizzard-warning',
    seoTitle: 'Blizzard Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active blizzard warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active blizzard warnings in the United States.',
    relatedHazards: ['winter-storm-warning', 'ice-storm-warning'],
    educationalContentKey: 'blizzard-warning',
    launch: true,
  },
  'winter-storm-warning': {
    slug: 'winter-storm-warning',
    nwsEvents: ['Winter Storm Warning'],
    singularLabel: 'Winter Storm Warning',
    pluralLabel: 'Winter Storm Warnings',
    pageTitle: 'Winter Storm Warnings Today',
    shortLabel: 'Winter Storm',
    intro:
      'Track active winter storm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: ALERT_CATEGORIES.winter.icon,
    severityColor: ALERT_CATEGORIES.winter.color,
    radarCategory: 'winter',
    radarFilter: 'winter-storm-warning',
    seoTitle: 'Winter Storm Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active winter storm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active winter storm warnings in the United States.',
    relatedHazards: ['blizzard-warning', 'ice-storm-warning'],
    educationalContentKey: 'winter-storm-warning',
    launch: true,
  },
  'ice-storm-warning': {
    slug: 'ice-storm-warning',
    nwsEvents: ['Ice Storm Warning'],
    singularLabel: 'Ice Storm Warning',
    pluralLabel: 'Ice Storm Warnings',
    pageTitle: 'Ice Storm Warnings Today',
    shortLabel: 'Ice Storm',
    intro:
      'Track active ice storm warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: ALERT_CATEGORIES.winter.icon,
    severityColor: ALERT_CATEGORIES.winter.color,
    radarCategory: 'winter',
    radarFilter: 'ice-storm-warning',
    seoTitle: 'Ice Storm Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active ice storm warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active ice storm warnings in the United States.',
    relatedHazards: ['winter-storm-warning', 'blizzard-warning'],
    educationalContentKey: 'ice-storm-warning',
    launch: true,
  },
  'high-wind-warning': {
    slug: 'high-wind-warning',
    nwsEvents: ['High Wind Warning'],
    singularLabel: 'High Wind Warning',
    pluralLabel: 'High Wind Warnings',
    pageTitle: 'High Wind Warnings Today',
    shortLabel: 'High Wind',
    intro:
      'Track active high wind warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: severe.icon,
    severityColor: severe.color,
    radarCategory: 'severe',
    radarFilter: 'high-wind-warning',
    seoTitle: 'High Wind Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active high wind warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active high wind warnings in the United States.',
    relatedHazards: ['severe-thunderstorm-warning', 'red-flag-warning'],
    educationalContentKey: 'high-wind-warning',
    launch: true,
  },
  'excessive-heat-warning': {
    slug: 'excessive-heat-warning',
    // Exact NWS event strings — include both current Extreme and legacy Excessive names.
    // Display copy prefers Extreme Heat (current NWS product + ALERT_CATEGORIES.heat).
    nwsEvents: ['Extreme Heat Warning', 'Excessive Heat Warning'],
    singularLabel: 'Extreme Heat Warning',
    pluralLabel: 'Extreme Heat Warnings',
    pageTitle: 'Extreme Heat Warnings Today',
    shortLabel: 'Extreme Heat',
    intro:
      'Track active Extreme Heat Warnings and Excessive Heat Warnings across the United States with affected areas, warning details, and links to current state alerts.',
    icon: ALERT_CATEGORIES.heat.icon,
    severityColor: ALERT_CATEGORIES.heat.color,
    radarCategory: 'heat',
    radarFilter: 'excessive-heat-warning',
    seoTitle: 'Extreme Heat Warnings Today | StormTracking',
    seoDescription:
      'Track active Extreme Heat Warnings and Excessive Heat Warnings across the United States with affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription:
      'There are currently no active Extreme Heat Warnings or Excessive Heat Warnings in the United States.',
    relatedHazards: ['red-flag-warning', 'high-wind-warning'],
    educationalContentKey: 'excessive-heat-warning',
    launch: true,
  },
  'red-flag-warning': {
    slug: 'red-flag-warning',
    nwsEvents: ['Red Flag Warning'],
    singularLabel: 'Red Flag Warning',
    pluralLabel: 'Red Flag Warnings',
    pageTitle: 'Red Flag Warnings Today',
    shortLabel: 'Red Flag',
    intro:
      'Track active red flag warnings across the United States with affected areas, warning details, and links to current state alerts.',
    icon: ALERT_CATEGORIES.fire.icon,
    severityColor: ALERT_CATEGORIES.fire.color,
    radarCategory: 'fire',
    radarFilter: 'red-flag-warning',
    seoTitle: 'Red Flag Warnings Today | StormTracking',
    seoDescription:
      'Track active red flag warnings across the United States with affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active red flag warnings in the United States.',
    relatedHazards: ['high-wind-warning', 'excessive-heat-warning'],
    educationalContentKey: 'red-flag-warning',
    launch: true,
  },
  'storm-surge-warning': {
    slug: 'storm-surge-warning',
    nwsEvents: ['Storm Surge Warning'],
    singularLabel: 'Storm Surge Warning',
    pluralLabel: 'Storm Surge Warnings',
    pageTitle: 'Storm Surge Warnings Today',
    shortLabel: 'Storm Surge',
    intro:
      'Track active storm surge warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: tropical.icon,
    severityColor: tropical.color,
    radarCategory: 'tropical',
    radarFilter: 'storm-surge-warning',
    seoTitle: 'Storm Surge Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active storm surge warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active storm surge warnings in the United States.',
    relatedHazards: ['hurricane-warning', 'tropical-storm-warning', 'extreme-wind-warning'],
    educationalContentKey: 'storm-surge-warning',
    launch: true,
  },
  'extreme-wind-warning': {
    slug: 'extreme-wind-warning',
    nwsEvents: ['Extreme Wind Warning'],
    singularLabel: 'Extreme Wind Warning',
    pluralLabel: 'Extreme Wind Warnings',
    pageTitle: 'Extreme Wind Warnings Today',
    shortLabel: 'Extreme Wind',
    intro:
      'Track active extreme wind warnings across the United States with live radar, affected areas, warning details, and links to current state alerts.',
    icon: tropical.icon,
    severityColor: tropical.color,
    radarCategory: 'tropical',
    radarFilter: 'extreme-wind-warning',
    seoTitle: 'Extreme Wind Warnings Today & Live Radar | StormTracking',
    seoDescription:
      'Track active extreme wind warnings across the United States with live radar, affected states, warning details, and current National Weather Service alerts.',
    zeroActiveDescription: 'There are currently no active extreme wind warnings in the United States.',
    relatedHazards: ['hurricane-warning', 'tropical-storm-warning', 'storm-surge-warning'],
    educationalContentKey: 'extreme-wind-warning',
    launch: true,
  },
};

export const PROMPT_VERSION = 'hazard-brief-v1';

export const BRIEF_MAX_AGE_ACTIVE_MS = 20 * 60 * 1000;
export const BRIEF_MAX_AGE_INACTIVE_MS = 2 * 60 * 60 * 1000;
export const COUNT_CHANGE_THRESHOLD = 3;
export const MAX_STATES_COMPACT = 3;
export const MAX_ALERTS_TO_LLM = 12;

export function getHazardConfig(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return HAZARD_CONFIGS[slug] || null;
}

export function getLaunchHazardSlugs() {
  return Object.values(HAZARD_CONFIGS)
    .filter((h) => h.launch)
    .map((h) => h.slug);
}

export function getAllHazardSlugs() {
  return Object.keys(HAZARD_CONFIGS);
}

export function hazardHref(slug) {
  return `/severe-weather/${slug}`;
}

export function labelForCount(config, count) {
  if (!config) return 'alerts';
  return count === 1 ? config.singularLabel : config.pluralLabel;
}

/** Pluralize a single NWS event name for headlines ("Extreme Heat Warning" → "... Warnings"). */
export function pluralizeNwsEvent(event) {
  if (!event) return 'alerts';
  if (/Warnings$|Watches$|Advisories$/i.test(event)) return event;
  if (event.endsWith('Warning')) return event.replace(/Warning$/, 'Warnings');
  if (event.endsWith('Watch')) return event.replace(/Watch$/, 'Watches');
  if (event.endsWith('Advisory')) return event.replace(/Advisory$/, 'Advisories');
  return `${event}s`;
}

/**
 * For multi-event hazards (e.g. Extreme + Excessive Heat Warning), prefer the
 * active product name in Current Situation copy when only one product is live.
 * When none or both are active, fall back to the hazard's configured labels.
 */
export function resolveDisplayLabels(config, alerts = []) {
  const nwsEvents = config?.nwsEvents || [];
  if (!config || nwsEvents.length <= 1) {
    return {
      singularLabel: config?.singularLabel,
      pluralLabel: config?.pluralLabel,
    };
  }

  const activeUnique = nwsEvents.filter((event) =>
    (alerts || []).some((a) => a?.event === event)
  );

  if (activeUnique.length === 1) {
    const singular = activeUnique[0];
    return {
      singularLabel: singular,
      pluralLabel: pluralizeNwsEvent(singular),
    };
  }

  return {
    singularLabel: config.singularLabel,
    pluralLabel: config.pluralLabel,
  };
}
