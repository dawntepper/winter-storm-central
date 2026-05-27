/**
 * Analytics Utility for StormTracking
 * Uses Plausible Analytics for privacy-friendly event tracking
 */

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
 * Track when user saves a location
 */
export function trackLocationSaved(locationName, locationType = 'search') {
  track('Location Saved', {
    location_name: locationName,
    location_type: locationType // 'search', 'geolocation', 'alert'
  });
}

/**
 * Track when user removes a location
 */
export function trackLocationRemoved(locationName) {
  track('Location Removed', {
    location_name: locationName
  });
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
export function trackRadarToggle(isEnabled) {
  track('Radar Toggled', {
    state: isEnabled ? 'on' : 'off'
  });
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
export function trackRadarTypeChange(radarType) {
  track('Radar Type Change', { radar_type: radarType });
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
  track('State Alerts Page View', {
    stateCode,
    stateName,
    alertCount,
    source: resolveSource(source)
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
  track('Radar Page View', {
    source: resolveSource(source),
    state_context: normalizeSlug(stateContext)
  });
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
 * Rich location-change event. Fires 'Location Count Changed' with full
 * trigger context. Call from explicit UI handlers (Check Location CTA,
 * Your Locations widget toggle, etc.). The existing trackLocationCountChanged
 * effect still fires alongside for the basic count signal.
 *
 * action: 'add' | 'remove'
 * trigger: SAVE_TRIGGERS.X
 */
export function trackLocationChange(action, trigger, locationState, isFirstLocation) {
  track('Location Count Changed', {
    action,
    trigger,
    location_state: normalizeSlug(locationState),
    is_first_location: isFirstLocation
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
  track('Forecast Page View', {
    state: stateSlug,
    location_source: locationSource
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
  trackLocationRemoved('Boulder, CO');
  trackLocationViewedOnMap('Boulder, CO');
  trackLocationCountChanged(2);

  // Alert events
  console.log('\n2. Alert Interaction Events:');
  trackAlertDetailView('Winter Storm Warning', 'Severe', 'Denver, CO', 'winter');
  trackCategoryExpanded('Winter Weather', 15);
  trackCategoryCollapsed('Winter Weather', 45);
  trackAlertTapped('winter', 'Winter Storm Warning');
  trackAlertAddedToMap('winter');

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
  trackLocationRemoved,
  trackLocationViewedOnMap,
  trackLocationCountChanged,
  trackAlertDetailView,
  trackCategoryExpanded,
  trackCategoryCollapsed,
  trackAlertTapped,
  trackAlertAddedToMap,
  trackRadarToggle,
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
  trackLocationSearch,
  trackLocationSearchFailed,
  startSessionTracking,
  stopSessionTracking,
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
  trackMapRegionClick,
  trackAffiliateClick,
  trackEssentialsCardClick,
  trackLocationChange,
  trackIndexNowSubmission,
  trackForecastPageView
};
