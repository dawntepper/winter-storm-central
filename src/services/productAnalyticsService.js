/**
 * Supabase-backed product funnel + radar analytics.
 * Anon client inserts only — admin reads via service role API.
 *
 * ## Dedupe strategy (session-scoped safeguards)
 *
 * Prevents duplicate rows from React StrictMode double-mount, HMR, auth token
 * refresh, alert polling re-renders, and route re-navigation within a cooldown.
 *
 * | Event / radar type          | Rule            | Dedupe key |
 * |-----------------------------|-----------------|------------|
 * | homepage_view               | session_once    | homepage_view |
 * | sign_in                     | session_once    | sign_in |
 * | locations_synced            | session_once    | locations_synced |
 * | state_alert_page_view       | visit_cooldown  | state:{stateCode} (3s) |
 * | forecast_view               | visit_cooldown  | forecast:{state_slug} (3s) |
 * | city_weather_page_view      | visit_cooldown  | city:{city_slug} (3s) |
 * | city_radar_viewed           | visit_cooldown  | city_radar:{city_slug} (3s) |
 * | forecast_link_click         | none            | every click |
 * | forecast_section_viewed     | visit_cooldown  | forecast_section:{city_slug} (3s) |
 * | state_selector_used         | none            | every selection |
 * | radar_view                  | visit_cooldown  | radar_view:{pagePath} (3s) |
 * | county_alert_view           | visit_cooldown  | county:{county_id} (3s) |
 * | location_change             | debounce        | loc:{state}:{source}:{coords} (2s) |
 * | location_search_success     | debounce        | search:{state}:{query} (1s) |
 * | save_location               | none            | every intentional save |
 * | radar_opened                | visit_cooldown  | radar_opened:{pagePath} (3s) |
 * | radar_toggled               | none            | every toggle |
 * | radar_type_changed          | none            | every type pick |
 * | radar_location_changed      | debounce        | radar_loc:{state}:{type} (2s) |
 *
 * session_once  — one emit per browser tab session (sessionStorage flag).
 * visit_cooldown — at most once per key within COOLDOWN_MS; blocks StrictMode/
 *                  HMR doubles but allows re-navigation after the window.
 * debounce      — in-memory; suppresses identical action keys within DEBOUNCE_MS.
 * none          — always emit (user-initiated actions).
 */

import { supabase } from '../lib/supabase';
import { getOrCreateVisitorIds } from '../utils/visitorIds';
const DEDUPE_PREFIX = 'stormtracking_pe_';
const DEDUPE_RADAR_PREFIX = 'stormtracking_re_';
const VISIT_COOLDOWN_MS = 3000;

export const PRODUCT_EVENTS = {
  HOMEPAGE_VIEW: 'homepage_view',
  STATE_ALERT_PAGE_VIEW: 'state_alert_page_view',
  LOCATION_CHANGE: 'location_change',
  LOCATION_SEARCH_SUCCESS: 'location_search_success',
  COUNTY_ALERT_VIEW: 'county_alert_view',
  RADAR_VIEW: 'radar_view',
  FORECAST_VIEW: 'forecast_view',
  CITY_WEATHER_PAGE_VIEW: 'city_weather_page_view',
  CITY_RADAR_VIEWED: 'city_radar_viewed',
  FORECAST_LINK_CLICK: 'forecast_link_click',
  FORECAST_SECTION_VIEWED: 'forecast_section_viewed',
  STATE_SELECTOR_USED: 'state_selector_used',
  SAVE_LOCATION: 'save_location',
  SIGN_IN: 'sign_in',
  LOCATIONS_SYNCED: 'locations_synced',
  STORM_BANNER_VIEWED: 'storm_banner_viewed',
  STORM_BANNER_CLICKED: 'storm_banner_clicked',
  STORM_PAGE_VIEWED: 'storm_page_viewed',
  STORM_RADAR_OPENED: 'storm_radar_opened',
  STORM_ALERTS_CLICKED: 'storm_alerts_clicked',
  STORM_LOCATION_SAVED: 'storm_location_saved',
  STORM_SIGNIN_STARTED: 'storm_signin_started',
};

export const RADAR_EVENTS = {
  OPENED: 'radar_opened',
  TOGGLED: 'radar_toggled',
  TYPE_CHANGED: 'radar_type_changed',
  LOCATION_CHANGED: 'radar_location_changed',
};

/** Sentinel for national / no-state radar context (stored in DB, not null). */
export const RADAR_STATE_NATIONAL = 'US';

/** Normalize radar state_code: valid 2-letter abbr, else national sentinel. */
export function normalizeRadarStateCode(stateCode) {
  const normalized = String(stateCode || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : RADAR_STATE_NATIONAL;
}

/** @type {Map<string, number>} */
const debounceMemory = new Map();

const PRODUCT_DEDUPE_RULES = {
  [PRODUCT_EVENTS.HOMEPAGE_VIEW]: { type: 'session_once', key: () => 'homepage_view' },
  [PRODUCT_EVENTS.SIGN_IN]: { type: 'session_once', key: () => 'sign_in' },
  [PRODUCT_EVENTS.LOCATIONS_SYNCED]: { type: 'session_once', key: () => 'locations_synced' },
  [PRODUCT_EVENTS.STATE_ALERT_PAGE_VIEW]: {
    type: 'visit_cooldown',
    key: ({ stateCode }) => `state:${stateCode || 'unknown'}`,
  },
  [PRODUCT_EVENTS.FORECAST_VIEW]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `forecast:${metadata?.state_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.CITY_WEATHER_PAGE_VIEW]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `city:${metadata?.city_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.CITY_RADAR_VIEWED]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `city_radar:${metadata?.city_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.RADAR_VIEW]: {
    type: 'visit_cooldown',
    key: ({ pagePath }) => `radar_view:${pagePath || getPagePath()}`,
  },
  [PRODUCT_EVENTS.COUNTY_ALERT_VIEW]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `county:${metadata?.county_id || 'unknown'}`,
  },
  [PRODUCT_EVENTS.LOCATION_CHANGE]: {
    type: 'debounce',
    ms: 2000,
    key: ({ stateCode, metadata }) => {
      const lat = metadata?.lat;
      const lon = metadata?.lon;
      const source = metadata?.source || 'unknown';
      const coords = lat != null && lon != null ? `${lat},${lon}` : 'none';
      return `loc:${stateCode || 'unknown'}:${source}:${coords}`;
    },
  },
  [PRODUCT_EVENTS.LOCATION_SEARCH_SUCCESS]: {
    type: 'debounce',
    ms: 1000,
    key: ({ stateCode, metadata }) =>
      `search:${stateCode || 'unknown'}:${metadata?.query || ''}`,
  },
  [PRODUCT_EVENTS.FORECAST_LINK_CLICK]: { type: 'none' },
  [PRODUCT_EVENTS.FORECAST_SECTION_VIEWED]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `forecast_section:${metadata?.city_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.STATE_SELECTOR_USED]: { type: 'none' },
  [PRODUCT_EVENTS.SAVE_LOCATION]: { type: 'none' },
  [PRODUCT_EVENTS.STORM_BANNER_VIEWED]: {
    type: 'session_once',
    key: ({ metadata }) => `storm_banner_view:${metadata?.storm_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.STORM_BANNER_CLICKED]: { type: 'none' },
  [PRODUCT_EVENTS.STORM_PAGE_VIEWED]: {
    type: 'visit_cooldown',
    key: ({ metadata }) => `storm_page:${metadata?.storm_slug || 'unknown'}`,
  },
  [PRODUCT_EVENTS.STORM_RADAR_OPENED]: { type: 'none' },
  [PRODUCT_EVENTS.STORM_ALERTS_CLICKED]: { type: 'none' },
  [PRODUCT_EVENTS.STORM_LOCATION_SAVED]: { type: 'none' },
  [PRODUCT_EVENTS.STORM_SIGNIN_STARTED]: {
    type: 'session_once',
    key: ({ metadata }) => `storm_signin:${metadata?.storm_slug || 'unknown'}`,
  },
};

const RADAR_DEDUPE_RULES = {
  [RADAR_EVENTS.OPENED]: {
    type: 'visit_cooldown',
    key: () => `radar_opened:${getPagePath()}`,
  },
  [RADAR_EVENTS.TOGGLED]: { type: 'none' },
  [RADAR_EVENTS.TYPE_CHANGED]: { type: 'none' },
  [RADAR_EVENTS.LOCATION_CHANGED]: {
    type: 'debounce',
    ms: 2000,
    key: ({ stateCode, radarType }) => `radar_loc:${stateCode || 'unknown'}:${radarType || 'unknown'}`,
  },
};

function getPagePath() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
}

function storageKey(prefix, dedupeKey) {
  return `${prefix}${dedupeKey}`;
}

function readSessionFlag(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionFlag(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Silent — analytics never breaks the app
  }
}

function isSessionOnceDuplicate(prefix, dedupeKey) {
  return readSessionFlag(storageKey(prefix, dedupeKey)) === '1';
}

function markSessionOnce(prefix, dedupeKey) {
  writeSessionFlag(storageKey(prefix, dedupeKey), '1');
}

function isVisitCooldownDuplicate(prefix, dedupeKey) {
  const raw = readSessionFlag(storageKey(prefix, dedupeKey));
  if (!raw) return false;
  const last = Number(raw);
  if (!Number.isFinite(last)) return false;
  return Date.now() - last < VISIT_COOLDOWN_MS;
}

function markVisitCooldown(prefix, dedupeKey) {
  writeSessionFlag(storageKey(prefix, dedupeKey), String(Date.now()));
}

function isDebounceDuplicate(dedupeKey, ms) {
  const last = debounceMemory.get(dedupeKey);
  if (!last) return false;
  return Date.now() - last < ms;
}

function markDebounce(dedupeKey) {
  debounceMemory.set(dedupeKey, Date.now());
}

/**
 * Returns true when the event should be emitted (slot acquired).
 * Exported for county_alert_views and other parallel Supabase writes.
 */
export function shouldEmitAnalyticsEvent(table, eventId, context = {}) {
  const rules = table === 'radar_events' ? RADAR_DEDUPE_RULES : PRODUCT_DEDUPE_RULES;
  const rule = rules[eventId];
  if (!rule || rule.type === 'none') return true;

  const prefix = table === 'radar_events' ? DEDUPE_RADAR_PREFIX : DEDUPE_PREFIX;
  const dedupeKey = rule.key(context);

  if (rule.type === 'session_once') {
    if (isSessionOnceDuplicate(prefix, dedupeKey)) return false;
    markSessionOnce(prefix, dedupeKey);
    return true;
  }

  if (rule.type === 'visit_cooldown') {
    if (isVisitCooldownDuplicate(prefix, dedupeKey)) return false;
    markVisitCooldown(prefix, dedupeKey);
    return true;
  }

  if (rule.type === 'debounce') {
    if (isDebounceDuplicate(dedupeKey, rule.ms)) return false;
    markDebounce(dedupeKey);
    return true;
  }

  return true;
}

async function insertRow(table, row) {
  const ids = getOrCreateVisitorIds();
  if (!ids || !supabase) return false;

  const { error } = await supabase.from(table).insert({
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
    ...row,
  });

  if (error && process.env.NODE_ENV === 'development') {
    console.warn(`[productAnalytics] ${table} insert:`, error.message);
    return false;
  }

  return !error;
}

/**
 * Record a product funnel event in Supabase.
 * @returns {boolean} true when inserted (not deduped)
 */
export function recordProductEvent(eventName, { stateCode, metadata, pagePath } = {}) {
  const context = { stateCode, metadata, pagePath: pagePath || getPagePath() };
  if (!shouldEmitAnalyticsEvent('product_events', eventName, context)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[productAnalytics] deduped product_events:', eventName, context);
    }
    return false;
  }

  return insertRow('product_events', {
    event_name: eventName,
    state_code: stateCode || null,
    page_path: context.pagePath,
    metadata: metadata || null,
  });
}

/**
 * Record a radar engagement event in Supabase.
 * @returns {boolean} true when inserted (not deduped)
 */
export function recordRadarEvent(eventType, { stateCode, radarType } = {}) {
  const context = { stateCode, radarType };
  if (!shouldEmitAnalyticsEvent('radar_events', eventType, context)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[productAnalytics] deduped radar_events:', eventType, context);
    }
    return false;
  }

  return insertRow('radar_events', {
    event_type: eventType,
    state_code: normalizeRadarStateCode(stateCode),
    radar_type: radarType || null,
  });
}
