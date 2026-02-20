/**
 * Process Weather Alerts — Netlify Scheduled Function
 *
 * Runs every 30 minutes to:
 * 1. Fetch active NWS alerts
 * 2. Filter out already-sent alerts
 * 3. Query Kit for subscribers by state tag
 * 4. Send emails via Resend API
 * 5. Record sent alerts in Supabase
 *
 * Schedule: Every 30 minutes (configured in netlify.toml)
 *
 * Environment variables required:
 *   RESEND_API_KEY         - Resend API key for email delivery
 *   KIT_API_KEY            - Kit (ConvertKit) API v4 key (subscriber management)
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (bypasses RLS)
 *   KIT_STATE_TAG_PREFIX   - Prefix for state tags in Kit (default: "location-")
 */

// Shared NWS alert parsing (single source of truth with client-side)
const {
  ALERTS_API,
  NWS_HEADERS,
  getCategoryForEvent,
  extractLocationName,
  extractStateCode,
  extractGeometryCoordinates,
  filterAlertFeatures,
} = require('../../shared/nws-alert-parser.js');

const {
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
  cleanupOldRecords,
} = require('./lib/supabase-admin.js');

const {
  listTags,
  createTag,
  listSubscribersForTag,
} = require('./lib/kit-client.js');

const { sendBatchEmails } = require('./lib/resend-client.js');

const {
  getAffectedStates,
  groupAlertsByState,
} = require('./lib/alert-matcher.js');

const {
  buildAlertEmail,
  buildAlertSubject,
  buildPreviewText,
} = require('./lib/email-templates.js');

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
 * Get all subscribers for a Kit tag (handles pagination)
 */
async function getTagSubscribers(tagId) {
  const subscribers = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const response = await listSubscribersForTag(tagId, { cursor, perPage: 500 });
    const subs = response.subscribers || [];
    subscribers.push(...subs);

    if (response.pagination?.has_next_page && response.pagination?.end_cursor) {
      cursor = response.pagination.end_cursor;
    } else {
      hasMore = false;
    }
  }

  return subscribers;
}

/**
 * Send alert emails for a specific state via Resend.
 * Queries Kit for subscribers tagged with the state, then sends via Resend batch.
 */
async function sendStateAlerts(state, alerts, tagId) {
  const stateName = STATE_NAMES[state] || state;

  // 1. Get subscribers for this state from Kit
  const subscribers = await getTagSubscribers(tagId);
  const validEmails = subscribers
    .map((s) => s.email_address)
    .filter(Boolean);

  if (validEmails.length === 0) {
    console.log(`[Resend] No subscribers for ${stateName}, skipping`);
    return { subscriberCount: 0, messageIds: [] };
  }

  console.log(`[Resend] ${validEmails.length} subscribers for ${stateName}`);

  // 2. Build email content
  const subject = buildAlertSubject({ stateName, alerts });
  const html = buildAlertEmail({ stateName, stateAbbr: state, alerts });

  // 3. Send via Resend batch
  const emails = validEmails.map((email) => ({
    to: email,
    subject,
    html,
  }));

  console.log(`[Resend] Sending ${emails.length} emails for ${stateName}: "${subject}"`);
  const result = await sendBatchEmails(emails);

  if (result.errors.length > 0) {
    console.warn(`[Resend] Batch errors for ${stateName}:`, result.errors);
  }

  console.log(`[Resend] Sent ${result.sent} emails for ${stateName}`);
  return { subscriberCount: result.sent, messageIds: result.messageIds };
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

    // Step 5: Send emails for each state via Resend
    for (const [state, stateAlerts] of Object.entries(alertsByState)) {
      const tagId = stateTagMap[state];
      if (!tagId) {
        console.warn(`[Process] No tag found for state ${state}, skipping`);
        continue;
      }

      try {
        const { subscriberCount, messageIds } = await sendStateAlerts(state, stateAlerts, tagId);

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
              kitBroadcastIds: messageIds.slice(0, 5), // Store a few Resend message IDs for reference
              subscriberCount,
              statesNotified: [state],
              alertOnset: alert.onset,
              alertExpires: alert.expires,
              status: subscriberCount > 0 ? 'sent' : 'skipped',
            });

            // Log the send
            await logBroadcastSend({
              sentAlertId: sentRecord.id,
              nwsAlertId: alert.id,
              kitBroadcastId: messageIds[0] || null, // First Resend message ID
              targetState: state,
              status: subscriberCount > 0 ? 'sent' : 'skipped',
            });
          } catch (recordError) {
            console.error(`[Process] Error recording alert ${alert.id}:`, recordError.message);
          }
        }

        if (subscriberCount > 0) {
          results.broadcastsSent++;
        }
        results.statesNotified.push(state);
        console.log(`[Process] Successfully sent ${subscriberCount} emails for ${state}`);
      } catch (sendError) {
        console.error(`[Process] Error sending emails for ${state}:`, sendError.message);
        results.errors.push(`${state}: ${sendError.message}`);

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
              errorMessage: sendError.message,
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
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  // Check for required environment variables
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (!process.env.CONVERTKIT_API_KEY && !process.env.KIT_API_KEY) {
    missing.push('CONVERTKIT_API_KEY or KIT_API_KEY');
  }
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
