/**
 * Analytics Utility for StormTracking
 * Uses Plausible Analytics for privacy-friendly event tracking.
 * Product + radar funnel events are also persisted to Supabase.
 */

import {
  recordProductEvent,
  recordRadarEvent,
  PRODUCT_EVENTS,
  RADAR_EVENTS,
} from '../services/productAnalyticsService';
import { SLUG_TO_ABBR } from '../data/stateConfig';

// Session tracking state
let sessionStartTime = Date.now();
let engagementTracked = { twoMin: false, fiveMin: false };
let engagementInterval = null;

/**
 * Core tracking function - wraps Plausible
 */
function track(eventName, props = {}) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(eventName, { props });
    // Log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', eventName, props);
    }
  }
}

// ============================================
// LOCATION MANAGEMENT EVENTS
// ============================================

/**
 * Legacy location-save signal (search / geolocation / alert type).
 * Prefer trackLocationAdded() for intent measurement.
 */
export function trackLocationSaved(locationName, locationType = 'search') {
  track('Location Saved', {
    location_name: locationName,
    location_type: locationType // 'search', 'geolocation', 'alert'
  });
}

// Session-scoped flags for milestone / first-location events (not fired on hydration)
let firstLocationAddedThisSession = false;
const locationMilestonesReached = new Set();

function parseLocationCityState(locationName) {
  if (!locationName) return { city: null, state: null };
  const parts = String(locationName).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      state: normalizeSlug(parts[parts.length - 1])
    };
  }
  return { city: locationName, state: null };
}

/**
 * User intentionally added a saved map location.
 * Fires Location Added; may also fire First Location Added and Multiple Locations Reached.
 *
 * @param {{ trigger: string, locationName: string, previousCount: number }} params
 */
export function trackLocationAdded({ trigger, locationName, previousCount }) {
  const { city, state } = parseLocationCityState(locationName);
  const isFirstLocation = previousCount === 0;
  const totalCount = previousCount + 1;

  const props = {
    trigger,
    state: state || 'unknown',
    is_first_location: isFirstLocation
  };
  if (city) props.city = city;

  track('Location Added', props);
  recordProductEvent(PRODUCT_EVENTS.SAVE_LOCATION, {
    stateCode: state,
    metadata: { trigger, city, is_first_location: isFirstLocation },
  });

  if (isFirstLocation && !firstLocationAddedThisSession) {
    firstLocationAddedThisSession = true;
    const firstProps = { trigger, state: state || 'unknown' };
    if (city) firstProps.city = city;
    track('First Location Added', firstProps);
  }

  for (const milestone of [2, 3, 5]) {
    if (previousCount < milestone && totalCount >= milestone && !locationMilestonesReached.has(milestone)) {
      locationMilestonesReached.add(milestone);
      track('Multiple Locations Reached', { location_count: milestone });
    }
  }
}

/**
 * User saved a map pin from an alert hover popup (Save Location).
 * Dedicated Plausible goal — replaces Location Added for the map_alert_popup path.
 *
 * @param {{ locationName: string, category: string, previousCount: number }} params
 */
export function trackLocationAddedFromAlert({ locationName, category, previousCount }) {
  const { city, state } = parseLocationCityState(locationName);
  const isFirstLocation = previousCount === 0;
  const totalCount = previousCount + 1;

  const props = {
    category: category || 'unknown',
    state: state || 'unknown',
    is_first_location: isFirstLocation
  };
  if (city) props.city = city;

  track('Location Added from Alert', props);
  recordProductEvent(PRODUCT_EVENTS.SAVE_LOCATION, {
    stateCode: state,
    metadata: { trigger: SAVE_TRIGGERS.MAP_ALERT_POPUP, category, city, is_first_location: isFirstLocation },
  });

  if (isFirstLocation && !firstLocationAddedThisSession) {
    firstLocationAddedThisSession = true;
    const firstProps = {
      trigger: SAVE_TRIGGERS.MAP_ALERT_POPUP,
      state: state || 'unknown'
    };
    if (city) firstProps.city = city;
    track('First Location Added', firstProps);
  }

  for (const milestone of [2, 3, 5]) {
    if (previousCount < milestone && totalCount >= milestone && !locationMilestonesReached.has(milestone)) {
      locationMilestonesReached.add(milestone);
      track('Multiple Locations Reached', { location_count: milestone });
    }
  }
}

/**
 * User intentionally removed a saved map location.
 *
 * @param {{ trigger: string, locationName: string, remainingCount: number }} params
 */
export function trackLocationRemoved({ trigger, locationName, remainingCount }) {
  const { city, state } = parseLocationCityState(locationName);
  const props = {
    trigger,
    state: state || 'unknown',
    remaining_location_count: remainingCount
  };
  if (city) props.city = city;
  track('Location Removed', props);
}

/**
 * Track when user clicks to view saved location on map
 */
export function trackLocationViewedOnMap(locationName) {
  track('Location Viewed on Map', {
    location_name: locationName
  });
}

/**
 * Update user location count (tracked as event with count)
 */
export function trackLocationCountChanged(count) {
  track('Location Count Changed', {
    location_count: count,
    has_locations: count > 0 ? 'yes' : 'no'
  });
}

/**
 * Local device locations merged into the signed-in account on sign-in.
 *
 * @param {{ syncedCount: number, localCount: number }} params
 */
export function trackLocationsSynced({ syncedCount, localCount }) {
  const recorded = recordProductEvent(PRODUCT_EVENTS.LOCATIONS_SYNCED, {
    metadata: { synced_count: syncedCount, local_count: localCount },
  });
  if (!recorded) return;
  track('Locations Synced', {
    synced_count: syncedCount,
    local_count: localCount
  });
}

// ============================================
// ALERT INTERACTION EVENTS
// ============================================

/**
 * Track when user views alert details (modal)
 */
export function trackAlertDetailView(alertType, severity, location, category) {
  track('Alert Detail View', {
    alert_type: alertType,
    severity: severity || 'unknown',
    location: location,
    category: category
  });
}

/**
 * Track when user expands a weather category
 */
export function trackCategoryExpanded(categoryName, alertCount) {
  track('Category Expanded', {
    category_name: categoryName,
    alert_count: alertCount
  });
}

/**
 * Track when user collapses a weather category
 */
export function trackCategoryCollapsed(categoryName, timeOpenSeconds) {
  track('Category Collapsed', {
    category_name: categoryName,
    time_open_seconds: Math.round(timeOpenSeconds)
  });
}

/**
 * Track when user taps an alert in the sidebar
 */
export function trackAlertTapped(category, eventType) {
  track('Alert Tapped', {
    category: category,
    event: eventType
  });
}

/**
 * Track when user adds alert to map
 */
export function trackAlertAddedToMap(category) {
  track('Alert Added to Map', {
    category: category
  });
}

// ============================================
// MAP INTERACTION EVENTS
// ============================================

/**
 * Track radar toggle
 */
export function trackRadarToggle(isEnabled, { stateCode, radarType } = {}) {
  recordRadarEvent(RADAR_EVENTS.TOGGLED, {
    stateCode,
    radarType,
  });
  if (isEnabled) {
    recordRadarEvent(RADAR_EVENTS.OPENED, { stateCode, radarType });
  }
  track('Radar Toggled', {
    state: isEnabled ? 'on' : 'off'
  });
}

/**
 * Radar overlay first shown (map mount or toggle on).
 */
export function trackRadarOpened({ stateCode, radarType } = {}) {
  recordRadarEvent(RADAR_EVENTS.OPENED, { stateCode, radarType });
}

/**
 * Radar map recentered to a new location.
 */
export function trackRadarLocationChanged({ stateCode, radarType } = {}) {
  recordRadarEvent(RADAR_EVENTS.LOCATION_CHANGED, { stateCode, radarType });
}

/**
 * Track alerts toggle
 */
export function trackAlertsToggle(isEnabled, alertCount) {
  track('Alerts Toggled', {
    state: isEnabled ? 'on' : 'off',
    alert_count: alertCount
  });
}

/**
 * Track map reset to default view
 */
export function trackMapReset() {
  track('Map Reset');
}

/**
 * Track when user clicks alert marker on map
 */
export function trackMapAlertClicked(alertType, location, category) {
  track('Map Alert Clicked', {
    alert_type: alertType,
    location: location,
    category: category
  });
}

/**
 * Track when user hovers alert to see details card
 */
export function trackMapAlertHovered(category) {
  track('Map Alert Hovered', {
    category: category
  });
}

// ============================================
// PAGE INTERACTION EVENTS
// ============================================

/**
 * Track share button click
 */
export function trackShare(method) {
  track('Share', {
    method: method // 'native', 'clipboard'
  });
}

/**
 * Track support/contact click
 */
export function trackSupportClick(type) {
  track('Support Click', {
    type: type // 'kofi', 'twitter'
  });
}

/**
 * Track manual refresh button click
 */
export function trackManualRefresh() {
  track('Manual Refresh');
}

/**
 * Track geolocation use
 */
export function trackGeolocationUsed() {
  track('Geolocation Used');
}

// ============================================
// SESSION QUALITY EVENTS
// ============================================

/**
 * Start session engagement tracking
 * Call this on app mount
 */
export function startSessionTracking() {
  sessionStartTime = Date.now();
  engagementTracked = { twoMin: false, fiveMin: false };

  // Clear any existing interval
  if (engagementInterval) {
    clearInterval(engagementInterval);
  }

  // Check engagement every 30 seconds
  engagementInterval = setInterval(() => {
    const sessionDuration = (Date.now() - sessionStartTime) / 1000; // in seconds

    // 2 minute milestone
    if (!engagementTracked.twoMin && sessionDuration >= 120) {
      track('Engaged Session', {
        duration: '2min'
      });
      engagementTracked.twoMin = true;
    }

    // 5 minute milestone
    if (!engagementTracked.fiveMin && sessionDuration >= 300) {
      track('High Engagement Session', {
        duration: '5min'
      });
      engagementTracked.fiveMin = true;

      // Stop checking after 5 min milestone reached
      clearInterval(engagementInterval);
      engagementInterval = null;
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Stop session tracking (call on unmount)
 */
export function stopSessionTracking() {
  if (engagementInterval) {
    clearInterval(engagementInterval);
    engagementInterval = null;
  }
}

// ============================================
// VISITOR RETENTION EVENTS
// ============================================
//
// Plausible is cookieless and has no built-in new-vs-returning dimension. We
// approximate it with a small localStorage record of the visitor's first-seen
// timestamp and session count, fired once per browser session as a single
// 'Visitor' event. A sessionStorage flag gates it to one fire per session, so
// a multi-page visit counts as one "visit" — matching Plausible's own session
// model rather than per-pageview.
//
// Privacy: stores only two integers (a timestamp + a counter) in the visitor's
// own browser. No identifier is generated and nothing leaves the device except
// the aggregate visitor_type + bucketed props below. Clearing site data resets
// a visitor to "new" — the standard caveat for any cookieless approach.

const VISITOR_KEY = 'st_visitor';               // localStorage: { firstSeen, lastSeen, visits }
const VISITOR_SESSION_FLAG = 'st_visitor_seen';  // sessionStorage: one fire per session

// Bucket raw counts/recency so the Properties tab stays low-cardinality and
// readable (raw integers would scatter into dozens of one-off rows).
function bucketVisitCount(n) {
  if (n <= 1) return '1';
  if (n === 2) return '2';
  if (n <= 5) return '3-5';
  if (n <= 10) return '6-10';
  return '11+';
}

function bucketDaysSince(days) {
  if (days <= 0) return '0';
  if (days <= 7) return '1-7';
  if (days <= 30) return '8-30';
  if (days <= 90) return '31-90';
  return '90+';
}

/**
 * Classify the current visitor as new or returning and fire one 'Visitor'
 * event per browser session. Call once on app mount (alongside
 * startSessionTracking). Safe to call on every mount — the sessionStorage
 * guard ensures it emits at most once per session.
 *
 * Props:
 *   visitor_type           'new' | 'returning'
 *   visit_count            bucketed session count ('1', '2', '3-5', '6-10', '11+')
 *   days_since_first_visit bucketed recency ('0', '1-7', '8-30', '31-90', '90+')
 */
export function trackVisitorType() {
  if (typeof window === 'undefined') return;
  try {
    // One Visitor event per session — a multi-page visit is still one visit.
    if (sessionStorage.getItem(VISITOR_SESSION_FLAG)) return;

    const now = Date.now();
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(VISITOR_KEY));
    } catch {
      stored = null;
    }

    const isReturning = Boolean(stored && stored.firstSeen);
    const firstSeen = isReturning ? stored.firstSeen : now;
    const visits = (isReturning ? (stored.visits || 1) : 0) + 1;
    const daysSinceFirst = Math.floor((now - firstSeen) / 86400000); // ms/day

    track('Visitor', {
      visitor_type: isReturning ? 'returning' : 'new',
      visit_count: bucketVisitCount(visits),
      days_since_first_visit: bucketDaysSince(daysSinceFirst)
    });

    localStorage.setItem(VISITOR_KEY, JSON.stringify({ firstSeen, lastSeen: now, visits }));
    sessionStorage.setItem(VISITOR_SESSION_FLAG, '1');
  } catch {
    // Silent — analytics never breaks the app
  }
}

/**
 * Supabase-backed session start (one event per browser session).
 * Fired from visitorSessionService after durable visitor_sessions insert.
 *
 * @param {{ visitorType: 'new' | 'returning', source?: string | null, landingPage: string }} params
 */
export function trackVisitorSessionStarted({ visitorType, source, landingPage }) {
  const props = {
    visitor_type: visitorType,
    landing_page: landingPage || '/',
  };
  if (source) props.source = source;
  track('Visitor Session Started', props);
}

/**
 * Optional follow-up when Supabase marks the visitor as returning.
 *
 * @param {{ source?: string | null, landingPage?: string }} params
 */
export function trackReturningVisitor({ source, landingPage } = {}) {
  const props = {};
  if (source) props.source = source;
  if (landingPage) props.landing_page = landingPage;
  track('Returning Visitor', props);
}

// ============================================
// STORM PAGE EVENTS
// ============================================

/**
 * Track storm page view with storm details.
 * Pass `source` explicitly when called from a known handler, or omit to let
 * the helper resolve it from the stashed nav source / referrer.
 */
export function trackStormPageView({ stormName, stormSlug, stormType, stormStatus, affectedStates, source }) {
  track('Storm Page View', {
    stormName,
    stormSlug,
    stormType,
    stormStatus,
    affectedStates, // comma-separated string
    source: resolveSource(source)
  });
}

/**
 * Track when user expands a state alert group on storm page
 */
export function trackStormAlertExpanded({ stormSlug, stateExpanded, alertCount }) {
  track('Storm Alert Expanded', {
    stormSlug,
    stateExpanded,
    alertCount
  });
}

/**
 * Track storm page share
 */
export function trackStormShare({ stormSlug, stormName }) {
  track('Storm Share', {
    stormSlug,
    stormName
  });
}

/**
 * Track map interactions on storm page
 */
export function trackStormMapInteraction({ stormSlug, interactionType }) {
  track('Storm Map Interaction', {
    stormSlug,
    interactionType // 'zoom', 'pan', 'radar_toggle', 'alerts_toggle', 'state_click', 'city_click'
  });
}

/**
 * Track storm page refresh
 */
export function trackStormPageRefresh({ stormSlug, timeSinceLastView }) {
  track('Storm Page Refresh', {
    stormSlug,
    timeSinceLastView
  });
}

/**
 * Track storm banner click (homepage → storm page)
 */
export function trackStormBannerClick({ stormSlug, stormName, source }) {
  track('Storm Banner Click', {
    stormSlug,
    stormName,
    source
  });
}

/**
 * Track alert detail view from storm page
 */
export function trackStormAlertDetailView({ stormSlug, alertType, alertSeverity, alertLocation }) {
  track('Storm Alert Detail View', {
    stormSlug,
    alertType,
    alertSeverity,
    alertLocation
  });
}

/**
 * Track storm page entry with referrer info
 */
export function trackStormPageEntry({ stormSlug, referrer, isDirect }) {
  track('Storm Page Entry', {
    stormSlug,
    referrer,
    isDirect
  });
}

/**
 * Emergency Information Panel became visible on a storm page.
 */
export function trackEmergencyInfoPanelViewed({ stormSlug, stormType, entryCount }) {
  track('Emergency Info Panel Viewed', {
    storm_slug: stormSlug,
    storm_type: stormType,
    entry_count: entryCount
  });
}

/**
 * User clicked a source or social link in the Emergency Information Panel.
 */
export function trackEmergencyInfoLinkClicked({
  stormSlug,
  stormType,
  category,
  sourceName,
  isOfficial,
  linkType
}) {
  track('Emergency Info Link Clicked', {
    storm_slug: stormSlug,
    storm_type: stormType,
    category,
    source_name: sourceName,
    is_official: isOfficial,
    link_type: linkType
  });
}

/**
 * Admin opened a draft/preview storm page.
 */
export function trackStormPreviewed({ stormSlug, stormType, adminStatus }) {
  track('Storm Previewed', {
    storm_slug: stormSlug,
    storm_type: stormType,
    admin_status: adminStatus
  });
}

/**
 * Admin published a storm (status → live, build hook triggered).
 */
export function trackStormPublished({ stormSlug, stormType, source }) {
  track('Storm Published', {
    storm_slug: stormSlug,
    storm_type: stormType,
    source: source || 'admin'
  });
}

/**
 * Admin added or saved an emergency info entry for a storm.
 */
export function trackEmergencyInfoAdded({ stormSlug, stormType, category, isOfficial }) {
  track('Emergency Info Added', {
    storm_slug: stormSlug,
    storm_type: stormType,
    category,
    is_official: isOfficial
  });
}

// ============================================
// RADAR PAGE NAVIGATION EVENTS
// ============================================

/**
 * Track click on "Live Weather Radar" link in header
 */
export function trackRadarLinkClick(source) {
  track('Radar Link Click', { source });
}

/**
 * Track click on "View Full Radar Map" from storm event pages
 */
export function trackStormRadarClick({ stormSlug, source }) {
  track('Storm Radar Click', { stormSlug, source });
}

// ============================================
// RADAR PAGE INTERACTION EVENTS
// ============================================

/**
 * Track radar type change on /radar page
 */
export function trackRadarTypeChange(radarType, { stateCode } = {}) {
  track('Radar Type Change', { radar_type: radarType });
  recordRadarEvent(RADAR_EVENTS.TYPE_CHANGED, { radarType, stateCode });
}

/**
 * Track color scheme change on /radar page
 */
export function trackRadarColorSchemeChange(colorScheme) {
  track('Radar Color Scheme Change', { color_scheme: colorScheme });
}

/**
 * Track click on active storm event link from /radar page
 */
export function trackRadarStormEventClick({ stormSlug, stormName }) {
  track('Radar Storm Event Click', { stormSlug, stormName });
}

// ============================================
// STATE ALERTS PAGE EVENTS
// ============================================

/**
 * Track state alerts page view.
 * Pass `source` explicitly when called from a known handler, or omit to let
 * the helper resolve it from the stashed nav source (set by button clicks
 * before navigation) or the referrer.
 */
export function trackStateAlertsPageView({ stateCode, stateName, alertCount, source }) {
  const resolvedSource = resolveSource(source);
  const recorded = recordProductEvent(PRODUCT_EVENTS.STATE_ALERT_PAGE_VIEW, {
    stateCode,
    metadata: { state_name: stateName, alert_count: alertCount, source: resolvedSource },
  });
  if (!recorded) return;
  track('State Alerts Page View', {
    stateCode,
    stateName,
    alertCount,
    source: resolvedSource
  });
}

/**
 * Track alert detail view from state alerts page
 */
export function trackStateAlertDetailView({ stateCode, alertType }) {
  track('State Alert Detail View', { stateCode, alertType });
}

/**
 * Track nearby state link click
 */
export function trackStateNearbyClick({ fromState, toState }) {
  track('State Nearby Click', { fromState, toState });
}

/**
 * Track click on a state from browse-by-state grid
 */
export function trackBrowseByStateClick({ stateCode, source }) {
  track('Browse By State Click', { stateCode, source });
}

// ============================================
// ALERT SIGNUP EVENTS
// ============================================

/**
 * Track successful alert signup
 */
export function trackAlertSignup({ type = 'new', zipCode }) {
  track('Alert Signup', {
    signup_type: type, // 'new' or 'update'
    zip_code: zipCode
  });
}

/**
 * Track alert signup failure
 */
export function trackAlertSignupError(error) {
  track('Alert Signup Error', {
    error: error
  });
}

// ============================================
// AUTH EVENTS
// ============================================

/**
 * Track first-time signup intent: magic link requested from the "Create account"
 * path (no prior completed sign-in on this device). Does not fire for returning
 * users requesting another magic link. Distinct from Alert Signup.
 *
 * @param {{ authMethod?: string }} params
 */
export function trackSignUpFormSubmitted({ authMethod = 'magic_link' } = {}) {
  track('Sign Up Form Submitted', { auth_method: authMethod });
}

/**
 * Track /add-to-home page view on mount. Pass `source` explicitly when
 * called from a known handler, or omit to resolve from stashed nav source /
 * referrer (e.g. sign-in modal link vs direct URL).
 */
export function trackAddToHomePageView(source) {
  track('Add To Home Page View', {
    source: resolveSource(source)
  });
}

// ============================================
// ZIP CODE SEARCH EVENTS
// ============================================

/**
 * Track when user searches for a location
 */
export function trackLocationSearch(searchTerm) {
  track('Location Search', {
    search_term: searchTerm
  });
}

/**
 * Track when location search fails
 */
export function trackLocationSearchFailed(searchTerm, error) {
  track('Location Search Failed', {
    search_term: searchTerm,
    error: error
  });
}

// ============================================
// LOCATION CATALOG / ALERT SEARCH EVENTS
// ============================================

/**
 * Track successful location catalog search (ZIP / city / county on state alert pages).
 */
export function trackLocationSearchSuccess({ query, stateCode, resolvedType }) {
  const recorded = recordProductEvent(PRODUCT_EVENTS.LOCATION_SEARCH_SUCCESS, {
    stateCode,
    metadata: { query, resolved_type: resolvedType || 'unknown' },
  });
  if (!recorded) return;
  track('Location Search Success', {
    query: query || '',
    state: stateCode || 'unknown',
    resolved_type: resolvedType || 'unknown',
  });
}

/**
 * @deprecated Use trackLocationSearchSuccess — kept for backward-compatible imports.
 */
export function trackAlertLocationSearch({ query, matchType, stateCode, hasCounty, hasCity, resultCount }) {
  trackLocationSearchSuccess({
    query,
    stateCode,
    resolvedType: matchType || 'unknown',
  });
}

/**
 * Track county alert result view (search module or county page).
 */
export function trackCountyAlertView({ countyId, stateCode, alertCount, source, countyName }) {
  const recorded = recordProductEvent(PRODUCT_EVENTS.COUNTY_ALERT_VIEW, {
    stateCode,
    metadata: {
      county_id: countyId,
      county_name: countyName,
      alert_count: alertCount ?? 0,
      source: source || 'unknown',
    },
  });
  if (!recorded) return false;
  track('County Alert View', {
    county_id: countyId || 'unknown',
    state_code: stateCode || 'unknown',
    alert_count: alertCount ?? 0,
    source: source || 'unknown',
    county_name: countyName || '',
  });
  return true;
}

/**
 * Track city alert result view.
 */
export function trackCityAlertView({ cityId, stateCode, source, cityName }) {
  track('City Alert View', {
    city_id: cityId || 'unknown',
    state_code: stateCode || 'unknown',
    source: source || 'unknown',
    city_name: cityName || '',
  });
}

/**
 * Track click on a county result link.
 */
export function trackCountyResultClick({ countySlug, stateCode, source }) {
  track('County Result Click', {
    county_slug: countySlug || '',
    state_code: stateCode || 'unknown',
    source: source || 'unknown',
  });
}

/**
 * Track click on a city result link.
 */
export function trackCityResultClick({ citySlug, stateCode, source }) {
  track('City Result Click', {
    city_slug: citySlug || '',
    state_code: stateCode || 'unknown',
    source: source || 'unknown',
  });
}

/**
 * Track city name search that did not resolve in the location catalog.
 */
export function trackLocationSearchNotFound({ query, stateCode }) {
  track('Location Search Not Found', {
    query: query || '',
    state: stateCode || 'unknown',
  });
}

// ============================================
// NAVIGATION SOURCE TRACKING
// ============================================
//
// Architecture: every navigation event (state page, storm page, radar page)
// records a `source` prop describing HOW the user got there. This is how we
// answer "do users find state pages via the homepage map, the dropdown, or
// the alert popup?" in Plausible.
//
// Pattern:
//   1. Button click handlers call setNavSource(NAV_SOURCES.X) immediately
//      before navigate(). The source is stashed in sessionStorage.
//   2. The destination page's mount effect calls trackXPageView(...) which
//      reads + clears the stashed source. If no flag is set (typed URL,
//      browser back/forward, bookmark, external referral), the helper falls
//      back to detectSourceFromReferrer() so every visit has a source.
//   3. resolveSource(explicit) used internally: explicit > stashed > referrer.
//
// One event per visit, no duplication. The flag is single-use — read clears
// it, so a stale flag from a previous navigation can't poison the next page.
//
// To add a new source value:
//   1. Add it to NAV_SOURCES below with a descriptive constant name
//   2. Call setNavSource(NAV_SOURCES.YOUR_NEW_SOURCE) in your button handler
//   3. No change needed in the destination page — it already reads the flag
//
// Never hardcode source strings at call sites. Always use NAV_SOURCES.X —
// hardcoded strings create dashboard noise (typos, casing drift) and break
// the audit chain.

export const NAV_SOURCES = {
  // Homepage origins
  HOMEPAGE_BANNER: 'homepage_banner',                  // Active storm banner above map
  HOMEPAGE_ALERT_POPUP: 'homepage_alert_popup',        // State link inside map alert hover popup
  HOMEPAGE_STATE_DROPDOWN: 'homepage_state_dropdown',  // Header "State Weather/Radar" select on /
  HOMEPAGE_RADAR_WIDGET: 'homepage_radar_widget',      // "Explore Radar Maps" CTA on homepage
  HOMEPAGE_QUICK_LINK: 'homepage_quick_link',

  // Inline state dropdowns on non-homepage pages
  STATE_PAGE_STATE_DROPDOWN: 'state_page_state_dropdown',
  RADAR_PAGE_STATE_DROPDOWN: 'radar_page_state_dropdown',
  STORM_PAGE_STATE_DROPDOWN: 'storm_page_state_dropdown',

  // State-page outbound nav
  STATE_PAGE_RADAR_LINK: 'state_page_radar_link',
  STATE_PAGE_STORM_LINK: 'state_page_storm_link',

  // Storm-page outbound nav
  STORM_PAGE_LINK: 'storm_page_link',
  STORM_PAGE_RADAR_LINK: 'storm_page_radar_link',

  // Radar-page outbound nav
  RADAR_PAGE_LINK: 'radar_page_link',

  // "Weather Near Me" feature → state alerts page
  NEAR_ME_HEADER: 'near_me_header',        // "{State} alerts & city forecasts" chip in NearMeHeader
  MAP_COUNTY_CLICK: 'map_county_click',    // clicking the highlighted "your area" county polygon

  // Auth / onboarding
  SIGN_IN_MODAL: 'sign_in_modal',

  // Generic
  HEADER_NAVIGATION: 'header_navigation',
  FOOTER_LINK: 'footer_link',
  INTERNAL_LINK: 'internal_link',
  ESSENTIALS_CARD: 'essentials_card',
  STATE_DIRECTORY_PAGE: 'state_directory_page',
  DIRECT_URL: 'direct_url',
  SEARCH_ENGINE: 'search_engine',
  SOCIAL_REFERRAL: 'social_referral',
};

// How a location save was triggered. STATE_PAGE_SAVE_BUTTON is intentionally
// omitted — state pages have no save button today. Add the constant when the
// feature is built.
export const SAVE_TRIGGERS = {
  CHECK_LOCATION_BUTTON: 'check_location_button',
  YOUR_LOCATIONS_WIDGET: 'your_locations_widget',
  YOUR_LOCATIONS_REMOVE: 'your_locations_remove',
  ALERT_ADD_TO_MAP: 'alert_add_to_map',
  MAP_ALERT_POPUP: 'map_alert_popup',
  MAP_LOCATION_PIN_CLICK: 'map_location_pin_click',
  AUTO_GEOLOCATE: 'auto_geolocate',
};

// Homepage map-region click sources. Neither StateHeatmap nor MostImpactedStates
// navigates to /alerts/{state} today — clicks just zoom the homepage map. The
// event captures interest signal: which states do users click on?
export const MAP_REGION_SOURCES = {
  HEATMAP: 'heatmap',
  MOST_IMPACTED_LIST: 'most_impacted_list',
};

const NAV_SOURCE_KEY = 'st_nav_source';

/**
 * Stash a navigation source for the next destination-page mount to consume.
 * Call from button click handlers immediately before navigate(...).
 */
export function setNavSource(source) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(NAV_SOURCE_KEY, source);
  } catch {
    // Silent — analytics never breaks the app
  }
}

/**
 * Read + clear the stashed nav source. Returns null if none set.
 * Called internally by resolveSource(); callers usually don't need this.
 */
export function readNavSource() {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(NAV_SOURCE_KEY);
    if (value) sessionStorage.removeItem(NAV_SOURCE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Fallback for direct loads / bookmarks / external referrals: derive a
 * navigation source from document.referrer. Categorizes into internal,
 * search engine, social, or direct.
 */
export function detectSourceFromReferrer() {
  if (typeof document === 'undefined') return NAV_SOURCES.DIRECT_URL;
  const referrer = document.referrer;
  if (!referrer) return NAV_SOURCES.DIRECT_URL;

  let referrerHost;
  try {
    referrerHost = new URL(referrer).hostname;
  } catch {
    return NAV_SOURCES.DIRECT_URL;
  }

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  if (referrerHost === currentHost) return NAV_SOURCES.INTERNAL_LINK;

  const searchEngines = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'chatgpt.', 'copilot.', 'perplexity.'];
  if (searchEngines.some(se => referrerHost.includes(se))) return NAV_SOURCES.SEARCH_ENGINE;

  const socials = ['instagram.', 'facebook.', 'twitter.', 'x.com', 't.co', 'threads.', 'linkedin.', 'reddit.'];
  if (socials.some(s => referrerHost.includes(s))) return NAV_SOURCES.SOCIAL_REFERRAL;

  return NAV_SOURCES.INTERNAL_LINK;
}

/** Resolve a source: explicit > stashed > referrer-derived. Always non-empty. */
function resolveSource(explicit) {
  return explicit || readNavSource() || detectSourceFromReferrer();
}

function normalizeSlug(value) {
  return (value || '').toLowerCase().replace(/\s+/g, '-');
}

// ============================================
// TYPED NAVIGATION HELPERS
// ============================================

/**
 * Fire 'Radar Page View' on /radar mount. NEW event (separate from the
 * existing 'Radar Link Click' which fires on the click intent).
 * stateContext defaults to 'national'; supports a future state-scoped radar.
 */
export function trackRadarPageView(source, stateContext = 'national') {
  const resolvedSource = resolveSource(source);
  const stateCode = stateContext && stateContext !== 'national'
    ? String(stateContext).toUpperCase().slice(0, 2)
    : null;
  const recorded = recordProductEvent(PRODUCT_EVENTS.RADAR_VIEW, {
    stateCode: /^[A-Z]{2}$/.test(stateCode || '') ? stateCode : null,
    metadata: { source: resolvedSource, state_context: normalizeSlug(stateContext) },
  });
  if (!recorded) return;
  track('Radar Page View', {
    source: resolvedSource,
    state_context: normalizeSlug(stateContext)
  });
}

/**
 * Fire 'Homepage View' once per homepage mount.
 */
export function trackHomepageView() {
  const recorded = recordProductEvent(PRODUCT_EVENTS.HOMEPAGE_VIEW);
  if (!recorded) return;
  track('Homepage View');
}

/**
 * Map or forecast location changed (distinct from save_location).
 */
export function trackLocationChange({ source, stateCode, metadata } = {}) {
  const recorded = recordProductEvent(PRODUCT_EVENTS.LOCATION_CHANGE, {
    stateCode,
    metadata: { source, ...metadata },
  });
  if (!recorded) return;
  track('Location Change', {
    source: source || 'unknown',
    state: stateCode || 'unknown',
  });
}

/**
 * Completed sign-in (magic link, OAuth, or password).
 */
export function trackSignIn({ method } = {}) {
  const recorded = recordProductEvent(PRODUCT_EVENTS.SIGN_IN, {
    metadata: { auth_method: method || 'unknown' },
  });
  if (!recorded) return;
  track('Sign In', { auth_method: method || 'unknown' });
}

/**
 * Fire 'Map Region Click' for non-navigating state interactions on the
 * homepage (StateHeatmap, MostImpactedStates). Captures interest, not action.
 * regionSource should be one of MAP_REGION_SOURCES.
 */
export function trackMapRegionClick(stateAbbr, regionSource) {
  track('Map Region Click', {
    state: stateAbbr,
    source: regionSource
  });
}

/**
 * Fire 'Affiliate Click' when user clicks an affiliate CTA. The `merchant`
 * parameter defaults to 'amazon' because that's currently the only merchant,
 * but it future-proofs the prop schema for when we expand (e.g. Walmart,
 * REI). Once non-Amazon products exist, add a `merchant` field to entries
 * in src/data/affiliateProducts.js and pass it explicitly from the caller.
 */
export function trackAffiliateClick(productId, category, tier, placement, merchant = 'amazon') {
  track('Affiliate Click', {
    product: productId,
    category,
    tier,
    placement,
    merchant
  });
}

/**
 * Fire 'Essentials Card Click' when user clicks a product inside an
 * EssentialsCard on homepage / state pages / storm pages. Wired up in
 * Commits 2/3.
 */
export function trackEssentialsCardClick(productId, placement) {
  track('Essentials Card Click', {
    product: productId,
    placement,
    destination: 'prep-page'
  });
}

/**
 * Fire 'IndexNow Submission' when URLs are pushed to Bing IndexNow from
 * either the /admin/seo bulk buttons or (Session 2) the build-time hook in
 * scripts/generate-sitemap.js. Tracks how often submissions happen and
 * whether they succeed.
 *
 * source: 'admin_state_pages' | 'admin_storm_pages' | 'admin_core_pages' |
 *         'admin_custom' | 'build_sitemap' (Session 2)
 */
export function trackIndexNowSubmission(source, urlsCount, success) {
  track('IndexNow Submission', {
    source,
    urls_count: urlsCount,
    success
  });
}

/**
 * Fire 'Forecast Page View' on /forecast/[state-slug] mount. Captures which
 * state was viewed and how the location was picked (default centroid, city
 * dropdown, ZIP entry, or geolocation).
 *
 * locationSource: 'state-default' | 'city' | 'zip' | 'geolocation'
 */
export function trackForecastPageView(stateSlug, locationSource) {
  const stateCode = SLUG_TO_ABBR[stateSlug] || null;
  const recorded = recordProductEvent(PRODUCT_EVENTS.FORECAST_VIEW, {
    stateCode,
    metadata: { state_slug: stateSlug, location_source: locationSource },
  });
  if (!recorded) return;
  track('Forecast Page View', {
    state: stateSlug,
    location_source: locationSource
  });
}

/**
 * Fire 'Forecast Location Changed' when the picker on /forecast/[state-slug]
 * updates the displayed location after initial mount. Lets us see which
 * picker mode subscribers actually use (city dropdown vs ZIP vs geolocation).
 *
 * source: 'city' | 'zip' | 'geolocation'
 */
export function trackForecastLocationChanged(source, { stateCode } = {}) {
  track('Forecast Location Changed', { source });
  trackLocationChange({ source, stateCode, metadata: { context: 'forecast' } });
}

/** source_page values for forecast clicks on state alert surfaces. */
export const FORECAST_SOURCE_PAGES = {
  WEATHER_FORECAST_CARD: 'weather_forecast_card',
  POPULAR_FORECASTS_SECTION: 'popular_forecasts_section',
  STATE_ALERT_PAGE: 'state_alert_page',
};

/**
 * Fire 'Forecast Link Click' when a user navigates to a forecast page from
 * another surface (CityAlertsPage forecast section CTA, StateAlertsPage
 * forecast widget city links, etc.). Pairs with Forecast Page View on the
 * landing side to measure the entry funnel.
 *
 * source:           'city-page' | 'state-page-widget' | 'state-page-search' |
 *                     'county-page' | 'catalog-city-page'  (where the click came from)
 * destinationState: state slug being navigated to
 * destinationType:  'city' | 'zip' | 'state-default'
 * options.sourcePage: canonical source_page for state-surface clicks
 */
export function trackForecastLinkClick(source, destinationState, destinationType, options = {}) {
  const stateCode = SLUG_TO_ABBR[destinationState] || null;
  const { sourcePage, city, citySlug } = options;
  const recorded = recordProductEvent(PRODUCT_EVENTS.FORECAST_LINK_CLICK, {
    stateCode,
    metadata: {
      source,
      source_page: sourcePage || null,
      destination_state: destinationState,
      destination_type: destinationType,
      ...(city ? { city } : {}),
      ...(citySlug ? { city_slug: citySlug } : {}),
    },
  });
  if (!recorded) return;
  track('Forecast Link Click', {
    source,
    source_page: sourcePage || source,
    destination_state: destinationState,
    destination_type: destinationType,
    ...(city ? { city } : {}),
  });
}

/**
 * Forecast city destination click — Plausible "Forecast City Click" +
 * product_events.forecast_link_click (destination_type: city).
 */
export function trackForecastCityClick({
  stateCode,
  stateSlug,
  city,
  citySlug,
  sourcePage,
}) {
  const code = stateCode || SLUG_TO_ABBR[stateSlug] || null;
  const recorded = recordProductEvent(PRODUCT_EVENTS.FORECAST_LINK_CLICK, {
    stateCode: code,
    metadata: {
      source_page: sourcePage,
      destination_state: stateSlug,
      destination_type: 'city',
      city,
      city_slug: citySlug,
    },
  });
  if (!recorded) return;
  track('Forecast City Click', {
    state: code || stateSlug,
    city,
    source_page: sourcePage,
  });
}

/**
 * Forecast state-default destination click — Plausible "Forecast State Click" +
 * product_events.forecast_link_click (destination_type: state-default).
 */
export function trackForecastStateClick({ stateCode, stateSlug, sourcePage }) {
  const code = stateCode || SLUG_TO_ABBR[stateSlug] || null;
  const recorded = recordProductEvent(PRODUCT_EVENTS.FORECAST_LINK_CLICK, {
    stateCode: code,
    metadata: {
      source_page: sourcePage,
      destination_state: stateSlug,
      destination_type: 'state-default',
    },
  });
  if (!recorded) return;
  track('Forecast State Click', {
    state: code || stateSlug,
    source_page: sourcePage,
  });
}


// ============================================
// TEST FUNCTION
// ============================================

/**
 * Test all tracking events - call from browser console
 * Usage: window.testAllTracking()
 */
export function testAllTracking() {
  console.log('=== Testing All Analytics Events ===\n');

  // Location events
  console.log('1. Location Management Events:');
  trackLocationSaved('Boulder, CO', 'search');
  trackLocationAdded({
    trigger: SAVE_TRIGGERS.CHECK_LOCATION_BUTTON,
    locationName: 'Boulder, CO',
    previousCount: 0
  });
  trackLocationRemoved({
    trigger: SAVE_TRIGGERS.YOUR_LOCATIONS_REMOVE,
    locationName: 'Boulder, CO',
    remainingCount: 0
  });
  trackLocationViewedOnMap('Boulder, CO');
  trackLocationCountChanged(2);

  // Alert events
  console.log('\n2. Alert Interaction Events:');
  trackAlertDetailView('Winter Storm Warning', 'Severe', 'Denver, CO', 'winter');
  trackCategoryExpanded('Winter Weather', 15);
  trackCategoryCollapsed('Winter Weather', 45);
  trackAlertTapped('winter', 'Winter Storm Warning');
  trackAlertAddedToMap('winter');
  trackLocationAddedFromAlert({
    locationName: 'Denver, CO',
    category: 'winter',
    previousCount: 0
  });

  // Map events
  console.log('\n3. Map Interaction Events:');
  trackRadarToggle(true);
  trackAlertsToggle(false, 25);
  trackMapReset();
  trackMapAlertClicked('Flood Watch', 'Houston, TX', 'flood');
  trackMapAlertHovered('severe');

  // Page events
  console.log('\n4. Page Interaction Events:');
  trackShare('clipboard');
  trackSupportClick('kofi');
  trackManualRefresh();
  trackGeolocationUsed();

  // Alert signup events
  console.log('\n5. Alert Signup Events:');
  trackAlertSignup({ type: 'new', zipCode: '80301' });
  trackAlertSignupError('Server error (500)');

  // Search events
  console.log('\n6. Search Events:');
  trackLocationSearch('80301');
  trackLocationSearchFailed('xyz123', 'Location not found');
  trackLocationSearchSuccess({ query: 'Denver', stateCode: 'CO', resolvedType: 'city' });
  trackLocationSearchNotFound({ query: 'Smallville', stateCode: 'KS' });

  // Radar navigation events
  console.log('\n6. Radar Navigation Events:');
  trackRadarLinkClick('header');
  trackStormRadarClick({ stormSlug: 'winter-storm-test', source: 'storm_page_cta' });

  // Radar page interaction events
  console.log('\n6b. Radar Page Interaction Events:');
  trackRadarTypeChange('satellite');
  trackRadarColorSchemeChange('NEXRAD Level III');
  trackRadarStormEventClick({ stormSlug: 'winter-storm-test', stormName: 'Winter Storm Test' });

  // State alerts events
  console.log('\n7. State Alerts Events:');
  trackStateAlertsPageView({ stateCode: 'NY', stateName: 'New York', alertCount: 5 });
  trackStateAlertDetailView({ stateCode: 'NY', alertType: 'Winter Storm Warning' });
  trackStateNearbyClick({ fromState: 'NY', toState: 'NJ' });
  trackBrowseByStateClick({ stateCode: 'NY', source: 'homepage_grid' });

  // Storm page events
  console.log('\n8. Storm Page Events:');
  trackStormBannerClick({ stormSlug: 'winter-storm-test', stormName: 'Winter Storm Test', source: 'homepage_banner' });
  trackStormAlertDetailView({ stormSlug: 'winter-storm-test', alertType: 'Winter Storm Warning', alertSeverity: 'Severe', alertLocation: 'Denver, CO' });
  trackStormPageEntry({ stormSlug: 'winter-storm-test', referrer: 'google.com', isDirect: false });

  // Session events
  console.log('\n8. Session Events (would track over time):');
  console.log('   - Engaged Session (2min) - tracked via timer');
  console.log('   - High Engagement Session (5min) - tracked via timer');

  console.log('\n=== All test events sent! ===');
  console.log('Check your Plausible dashboard to verify.');

  return 'Analytics test complete - check console and Plausible dashboard';
}

// Expose test function globally for console access
if (typeof window !== 'undefined') {
  window.testAllTracking = testAllTracking;
}

// Default export of all functions
export default {
  track,
  trackLocationSaved,
  trackLocationAdded,
  trackLocationAddedFromAlert,
  trackLocationRemoved,
  trackLocationViewedOnMap,
  trackLocationCountChanged,
  trackAlertDetailView,
  trackCategoryExpanded,
  trackCategoryCollapsed,
  trackAlertTapped,
  trackAlertAddedToMap,
  trackRadarToggle,
  trackRadarOpened,
  trackRadarLocationChanged,
  trackAlertsToggle,
  trackMapReset,
  trackMapAlertClicked,
  trackMapAlertHovered,
  trackShare,
  trackSupportClick,
  trackManualRefresh,
  trackGeolocationUsed,
  trackAlertSignup,
  trackAlertSignupError,
  trackSignUpFormSubmitted,
  trackAddToHomePageView,
  trackLocationSearch,
  trackLocationSearchFailed,
  trackLocationSearchSuccess,
  trackAlertLocationSearch,
  trackCountyAlertView,
  trackCityAlertView,
  trackCountyResultClick,
  trackCityResultClick,
  trackLocationSearchNotFound,
  startSessionTracking,
  stopSessionTracking,
  trackVisitorType,
  trackVisitorSessionStarted,
  trackReturningVisitor,
  testAllTracking,
  // Storm page events
  trackStormPageView,
  trackStormAlertExpanded,
  trackStormShare,
  trackStormMapInteraction,
  trackStormPageRefresh,
  trackStormBannerClick,
  trackStormAlertDetailView,
  trackStormPageEntry,
  trackEmergencyInfoPanelViewed,
  trackEmergencyInfoLinkClicked,
  trackStormPreviewed,
  trackStormPublished,
  trackEmergencyInfoAdded,
  trackRadarLinkClick,
  trackStormRadarClick,
  trackRadarTypeChange,
  trackRadarColorSchemeChange,
  trackRadarStormEventClick,
  // State alerts events
  trackStateAlertsPageView,
  trackStateAlertDetailView,
  trackStateNearbyClick,
  trackBrowseByStateClick,
  // Navigation source tracking
  NAV_SOURCES,
  SAVE_TRIGGERS,
  MAP_REGION_SOURCES,
  setNavSource,
  readNavSource,
  detectSourceFromReferrer,
  trackRadarPageView,
  trackHomepageView,
  trackLocationChange,
  trackSignIn,
  trackMapRegionClick,
  trackAffiliateClick,
  trackEssentialsCardClick,
  trackIndexNowSubmission,
  trackForecastPageView,
  trackForecastLocationChanged,
  trackForecastLinkClick,
  trackForecastCityClick,
  trackForecastStateClick,
  FORECAST_SOURCE_PAGES,
};
