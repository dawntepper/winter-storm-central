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
 * Track storm page view with storm details
 */
export function trackStormPageView({ stormName, stormSlug, stormType, stormStatus, affectedStates }) {
  track('Storm Page View', {
    stormName,
    stormSlug,
    stormType,
    stormStatus,
    affectedStates // comma-separated string
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

  // Search events
  console.log('\n5. Search Events:');
  trackLocationSearch('80301');
  trackLocationSearchFailed('xyz123', 'Location not found');

  // Storm page events
  console.log('\n6. Storm Page Events:');
  trackStormBannerClick({ stormSlug: 'winter-storm-test', stormName: 'Winter Storm Test', source: 'homepage_banner' });
  trackStormAlertDetailView({ stormSlug: 'winter-storm-test', alertType: 'Winter Storm Warning', alertSeverity: 'Severe', alertLocation: 'Denver, CO' });
  trackStormPageEntry({ stormSlug: 'winter-storm-test', referrer: 'google.com', isDirect: false });

  // Session events
  console.log('\n7. Session Events (would track over time):');
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
  trackStormPageEntry
};
