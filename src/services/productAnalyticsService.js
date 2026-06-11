/**
 * Supabase-backed product funnel + radar analytics.
 * Anon client inserts only — admin reads via service role API.
 */

import { supabase } from '../lib/supabase';

const VISITOR_ID_KEY = 'stormtracking_visitor_id';
const SESSION_ID_KEY = 'stormtracking_session_id';

export const PRODUCT_EVENTS = {
  HOMEPAGE_VIEW: 'homepage_view',
  STATE_ALERT_PAGE_VIEW: 'state_alert_page_view',
  LOCATION_CHANGE: 'location_change',
  LOCATION_SEARCH_SUCCESS: 'location_search_success',
  COUNTY_ALERT_VIEW: 'county_alert_view',
  RADAR_VIEW: 'radar_view',
  FORECAST_VIEW: 'forecast_view',
  SAVE_LOCATION: 'save_location',
  SIGN_IN: 'sign_in',
  LOCATIONS_SYNCED: 'locations_synced',
};

export const RADAR_EVENTS = {
  OPENED: 'radar_opened',
  TOGGLED: 'radar_toggled',
  TYPE_CHANGED: 'radar_type_changed',
  LOCATION_CHANGED: 'radar_location_changed',
};

function getIds() {
  if (typeof window === 'undefined') return null;
  try {
    const visitorId = localStorage.getItem(VISITOR_ID_KEY);
    const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!visitorId || !sessionId) return null;
    return { visitorId, sessionId };
  } catch {
    return null;
  }
}

function getPagePath() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
}

async function insertRow(table, row) {
  const ids = getIds();
  if (!ids || !supabase) return;

  const { error } = await supabase.from(table).insert({
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
    ...row,
  });

  if (error && process.env.NODE_ENV === 'development') {
    console.warn(`[productAnalytics] ${table} insert:`, error.message);
  }
}

/**
 * Record a product funnel event in Supabase.
 */
export function recordProductEvent(eventName, { stateCode, metadata, pagePath } = {}) {
  return insertRow('product_events', {
    event_name: eventName,
    state_code: stateCode || null,
    page_path: pagePath || getPagePath(),
    metadata: metadata || null,
  });
}

/**
 * Record a radar engagement event in Supabase.
 */
export function recordRadarEvent(eventType, { stateCode, radarType } = {}) {
  return insertRow('radar_events', {
    event_type: eventType,
    state_code: stateCode || null,
    radar_type: radarType || null,
  });
}
