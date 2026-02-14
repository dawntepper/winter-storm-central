/**
 * Process Weather Alerts — Netlify Scheduled Function
 *
 * Runs every 30 minutes to:
 * 1. Fetch active NWS alerts
 * 2. Filter out already-sent alerts
 * 3. Match new alerts to Kit subscribers by state/zip
 * 4. Send targeted Kit broadcasts
 * 5. Record sent alerts in Supabase
 *
 * Schedule: Every 30 minutes (configured in netlify.toml)
 *
 * Environment variables required:
 *   KIT_API_KEY            - Kit (ConvertKit) API v4 key
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (bypasses RLS)
 *   KIT_STATE_TAG_PREFIX   - Prefix for state tags in Kit (default: "location-")
 *   KIT_ZIP_FIELD_KEY      - Custom field key for zip codes (default: "zip_code")
 */

// Shared NWS alert parsing (single source of truth with client-side)
import {
  ALERTS_API,
  NWS_HEADERS,
  getCategoryForEvent,
  extractLocationName,
  extractStateCode,
  extractGeometryCoordinates,
  filterAlertFeatures,
} from '../../shared/nws-alert-parser.js';

import {
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
  cleanupOldRecords,
} from './lib/supabase-admin.js';

import {
  listTags,
  createTag,
  createAndSendBroadcast,
} from './lib/kit-client.js';

import {
  getAffectedStates,
  groupAlertsByState,
} from './lib/alert-matcher.js';

import {
  buildAlertEmail,
  buildAlertSubject,
  buildPreviewText,
} from './lib/email-templates.js';

// ============================================
// SERVER-SIDE ALERT PARSING
// Uses shared parser + simplified coordinate extraction
// ============================================

/**
 * Parse a raw NWS alert feature for email use.
 * Simpler than the client-side version — doesn't require coordinates
 * (alerts without geometry still get sent, just without a map link).
 */
function parseAlertForEmail(rawAlert) {
  const props = rawAlert.properties || {};
  const eventType = props.event || '';
  const category = getCategoryForEvent(eventType);
  if (!category) return null;

  const state = extractStateCode(rawAlert);
  const coords = extractGeometryCoordinates(rawAlert);

  return {
    id: rawAlert.id || props.id,
    event: eventType,
    category,
    state,
    location: extractLocationName(rawAlert),
    lat: coords?.lat || null,
    lon: coords?.lon || null,
    headline: props.headline || eventType,
    description: props.description?.substring(0, 500) || '',
    severity: props.severity,
    urgency: props.urgency,
    onset: props.onset,
    expires: props.expires,
    areaDesc: props.areaDesc,
  };
}

/**
 * Fetch active alerts from NWS API
 */
async function fetchNWSAlerts() {
  console.log('[NWS] Fetching active alerts...');
  const response = await fetch(ALERTS_API, {
    headers: NWS_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const features = data.features || [];

  // Filter using shared logic
  const filtered = filterAlertFeatures(features);

  // Parse alerts for email
  const parsed = filtered.map(parseAlertForEmail).filter(Boolean);
  console.log(`[NWS] Fetched ${features.length} total alerts, ${parsed.length} after filtering`);

  return parsed;
}

// ============================================
// STATE NAME LOOKUP
// ============================================

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington DC', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
};

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Ensure state-based tags exist in Kit
 * Creates missing tags and returns a map of state -> tagId
 */
async function ensureStateTags(states) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const response = await listTags();
  const existingTags = response.tags || [];

  const tagMap = {};

  // Index existing tags
  for (const tag of existingTags) {
    if (tag.name.startsWith(prefix)) {
      const state = tag.name.substring(prefix.length).toUpperCase();
      tagMap[state] = tag.id;
    }
  }

  // Create missing tags for affected states
  for (const state of states) {
    if (!tagMap[state]) {
      const tagName = `${prefix}${state}`;
      console.log(`[Kit] Creating tag: ${tagName}`);
      const result = await createTag(tagName);
      if (result?.tag?.id) {
        tagMap[state] = result.tag.id;
      }
    }
  }

  return tagMap;
}

/**
 * Send a broadcast for alerts in a specific state
 */
async function sendStateBroadcast(state, alerts, tagId) {
  const stateName = STATE_NAMES[state] || state;

  const subject = buildAlertSubject({ stateName, alerts });
  const content = buildAlertEmail({ stateName, stateAbbr: state, alerts });
  const previewText = buildPreviewText({ stateName, alerts });

  // Target subscribers with the state tag using subscriber_filter
  const subscriberFilter = [
    {
      all: [{ type: 'tag', ids: [tagId] }],
    },
  ];

  console.log(`[Kit] Creating broadcast for ${stateName}: "${subject}"`);
  console.log(`[Kit]   Targeting tag ID: ${tagId}`);
  console.log(`[Kit]   Alert count: ${alerts.length}`);

  const result = await createAndSendBroadcast({
    subject,
    content,
    description: `Auto weather alert for ${stateName} - ${alerts.length} alert(s)`,
    previewText,
    subscriberFilter,
  });

  const broadcastId = result?.broadcast?.id || null;
  console.log(`[Kit] Broadcast created: ${broadcastId}`);

  return broadcastId;
}

/**
 * Main processing function
 */
async function processAlerts() {
  const startTime = Date.now();
  const results = {
    alertsFetched: 0,
    alertsNew: 0,
    broadcastsSent: 0,
    statesNotified: [],
    errors: [],
  };

  try {
    // Step 1: Fetch active NWS alerts
    const allAlerts = await fetchNWSAlerts();
    results.alertsFetched = allAlerts.length;

    if (allAlerts.length === 0) {
      console.log('[Process] No active alerts found');
      return results;
    }

    // Step 2: Check which alerts have already been sent
    const alertIds = allAlerts.map((a) => a.id);
    const alreadySent = await getAlreadySentAlertIds(alertIds);
    const newAlerts = allAlerts.filter((a) => !alreadySent.has(a.id));
    results.alertsNew = newAlerts.length;

    if (newAlerts.length === 0) {
      console.log('[Process] No new alerts to send');
      return results;
    }

    console.log(`[Process] ${newAlerts.length} new alerts to process`);

    // Step 3: Group new alerts by state
    const alertsByState = groupAlertsByState(newAlerts);
    const affectedStates = Object.keys(alertsByState);

    console.log(`[Process] Affected states: ${affectedStates.join(', ')}`);

    // Step 4: Ensure state tags exist in Kit
    const stateTagMap = await ensureStateTags(affectedStates);

    // Step 5: Send broadcasts for each state
    for (const [state, stateAlerts] of Object.entries(alertsByState)) {
      const tagId = stateTagMap[state];
      if (!tagId) {
        console.warn(`[Process] No tag found for state ${state}, skipping`);
        continue;
      }

      try {
        const broadcastId = await sendStateBroadcast(state, stateAlerts, tagId);

        // Record each alert as sent
        for (const alert of stateAlerts) {
          try {
            const sentRecord = await recordSentAlert({
              nwsAlertId: alert.id,
              eventType: alert.event,
              severity: alert.severity,
              affectedStates: getAffectedStates(alert),
              areaDescription: alert.areaDesc,
              headline: alert.headline,
              kitBroadcastIds: broadcastId ? [broadcastId] : [],
              subscriberCount: 0, // Kit doesn't return this on create
              statesNotified: [state],
              alertOnset: alert.onset,
              alertExpires: alert.expires,
              status: 'sent',
            });

            // Log the broadcast send
            await logBroadcastSend({
              sentAlertId: sentRecord.id,
              nwsAlertId: alert.id,
              kitBroadcastId: broadcastId,
              targetState: state,
              status: 'sent',
            });
          } catch (recordError) {
            console.error(`[Process] Error recording alert ${alert.id}:`, recordError.message);
          }
        }

        results.broadcastsSent++;
        results.statesNotified.push(state);
        console.log(`[Process] Successfully sent broadcast for ${state}`);
      } catch (broadcastError) {
        console.error(`[Process] Error sending broadcast for ${state}:`, broadcastError.message);
        results.errors.push(`${state}: ${broadcastError.message}`);

        // Record failed alerts
        for (const alert of stateAlerts) {
          try {
            await recordSentAlert({
              nwsAlertId: alert.id,
              eventType: alert.event,
              severity: alert.severity,
              affectedStates: getAffectedStates(alert),
              areaDescription: alert.areaDesc,
              headline: alert.headline,
              kitBroadcastIds: [],
              subscriberCount: 0,
              statesNotified: [],
              alertOnset: alert.onset,
              alertExpires: alert.expires,
              status: 'failed',
              errorMessage: broadcastError.message,
            });
          } catch (recordError) {
            console.error(`[Process] Error recording failed alert:`, recordError.message);
          }
        }
      }
    }

    // Step 6: Cleanup old records periodically (every ~24 hours worth of runs)
    if (Math.random() < 0.02) {
      console.log('[Process] Running periodic cleanup...');
      await cleanupOldRecords(30);
    }
  } catch (error) {
    console.error('[Process] Fatal error:', error);
    results.errors.push(error.message);
  }

  const duration = Date.now() - startTime;
  console.log(`[Process] Completed in ${duration}ms:`, JSON.stringify(results));

  return results;
}

// ============================================
// NETLIFY FUNCTION HANDLER
// ============================================

// Support both scheduled invocation and HTTP trigger (for manual runs)
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  // Check for required environment variables
  const requiredVars = ['KIT_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    const msg = `Missing environment variables: ${missing.join(', ')}`;
    console.error(msg);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: msg }),
    };
  }

  // If triggered via HTTP, require a simple auth check
  if (event.httpMethod) {
    const authHeader = event.headers?.authorization;
    const expectedToken = process.env.ALERT_PROCESS_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }
  }

  try {
    const results = await processAlerts();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...results,
        processedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        processedAt: new Date().toISOString(),
      }),
    };
  }
};
