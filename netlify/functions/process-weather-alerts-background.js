/**
 * Process Weather Alerts — Netlify Scheduled Function
 *
 * Runs every 30 minutes to:
 * 1. Fetch active NWS alerts
 * 2. Filter out already-sent alerts (dedup via Netlify Blobs)
 * 3. Query Kit for subscribers by state tag
 * 4. Send emails via Resend API
 * 5. Record sent alerts in Netlify Blobs for future dedup
 *
 * Schedule: Every 30 minutes (configured in netlify.toml)
 *
 * Environment variables required:
 *   RESEND_API_KEY         - Resend API key for email delivery
 *   KIT_API_KEY            - Kit (ConvertKit) API v4 key (subscriber management)
 *   KIT_STATE_TAG_PREFIX   - Prefix for state tags in Kit (default: "location-")
 *
 * Dedup storage (Netlify Blobs) auto-detects context inside a Netlify
 * Function — no additional env vars required.
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
  acquireProcessingLock,
  releaseProcessingLock,
} = require('./lib/dedup-store.js');

const {
  listTags,
  createTag,
  listSubscribersForTag,
} = require('./lib/kit-client.js');

const { sendBatchEmails } = require('./lib/resend-client.js');

const {
  getAffectedStates,
  groupAlertsByState,
  countyTagFor,
} = require('./lib/alert-matcher.js');

const { getCountyNamesForUGCs } = require('./lib/nws-zones.js');

const HAS_COUNTY_INFO_TAG = 'has-county-info';

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
    // Preserved for county-tag matching downstream
    ugc: props.geocode?.UGC || [],
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
 * Snapshot every tag in Kit into a Map<lowercasedName, tagId>. We do this once
 * per cron run so per-state/per-county tag lookups stay in-memory after the
 * single listTags() call. Also ensures the state tags for the affected states
 * exist (creating them if missing) and returns:
 *   {
 *     tagsByName: Map<string, id>,   // every existing tag, lowercased
 *     stateTagIds: { FL: id, ... }   // state tag id per affected state
 *   }
 */
async function loadAndEnsureTags(affectedStates) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const response = await listTags();
  const existingTags = response.tags || [];

  const tagsByName = new Map();
  for (const tag of existingTags) {
    tagsByName.set(tag.name.toLowerCase(), tag.id);
  }

  const stateTagIds = {};
  for (const state of affectedStates) {
    const tagName = `${prefix}${state}`;
    const lc = tagName.toLowerCase();
    if (tagsByName.has(lc)) {
      stateTagIds[state] = tagsByName.get(lc);
    } else {
      console.log(`[Kit] Creating state tag: ${tagName}`);
      const result = await createTag(tagName);
      if (result?.tag?.id) {
        stateTagIds[state] = result.tag.id;
        tagsByName.set(lc, result.tag.id);
      }
    }
  }
  return { tagsByName, stateTagIds };
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
 * Resolve each alert's UGCs into the set of county tags + canonical county
 * names that apply for the given state. Returns Map<countyTag, {alerts, name}>.
 */
async function bucketAlertsByCounty(state, alerts) {
  const buckets = new Map(); // countyTag -> { alerts: [], countyName: 'Lee' }

  // Gather all county UGCs for this state across all alerts, then look up
  // their names in one batch via the cached NWS zones map.
  const allStateUGCs = new Set();
  for (const alert of alerts) {
    for (const ugc of alert.ugc || []) {
      if (ugc.startsWith(`${state}C`)) allStateUGCs.add(ugc);
    }
  }
  if (allStateUGCs.size === 0) return buckets;

  const nameByUGC = await getCountyNamesForUGCs([...allStateUGCs]);

  for (const alert of alerts) {
    for (const ugc of alert.ugc || []) {
      if (!ugc.startsWith(`${state}C`)) continue;
      const countyName = nameByUGC.get(ugc);
      if (!countyName) continue;
      const tag = countyTagFor(state, countyName);
      if (!tag) continue;
      let bucket = buckets.get(tag);
      if (!bucket) {
        bucket = { alerts: [], countyName };
        buckets.set(tag, bucket);
      }
      if (!bucket.alerts.includes(alert)) bucket.alerts.push(alert);
    }
  }
  return buckets;
}

/**
 * Send alert emails for a single state. Splits into per-county batches when
 * we have county-tagged subscribers, then sends the full state alert set to
 * the legacy fallback (location-XX subscribers without has-county-info).
 *
 * Returns { subscriberCount, messageIds, errors }.
 */
async function sendStateAlerts(state, alerts, stateTagId, tagsByName) {
  const stateName = STATE_NAMES[state] || state;
  const result = { subscriberCount: 0, messageIds: [], errors: [] };
  const sentTo = new Set(); // dedupe across county + state-fallback paths

  // === COUNTY-PRECISE PATH ===
  const countyBuckets = await bucketAlertsByCounty(state, alerts);
  console.log(`[Process] ${stateName}: ${countyBuckets.size} county buckets from ${alerts.length} alerts`);

  for (const [countyTag, { alerts: countyAlerts, countyName }] of countyBuckets) {
    const tagId = tagsByName.get(countyTag.toLowerCase());
    if (!tagId) {
      console.log(`[Resend] ${countyTag}: tag doesn't exist yet (no subscribers in this county)`);
      continue;
    }

    const subs = await getTagSubscribers(tagId);
    const emails = subs
      .map(s => s.email_address)
      .filter(e => e && !sentTo.has(e));

    if (emails.length === 0) {
      console.log(`[Resend] ${countyTag}: 0 subscribers, skipping`);
      continue;
    }

    const subject = buildAlertSubject({ stateName, alerts: countyAlerts, countyName });
    const html = buildAlertEmail({ stateName, stateAbbr: state, alerts: countyAlerts });
    const batch = emails.map(email => ({ to: email, subject, html }));

    console.log(`[Resend] Sending ${batch.length} ${countyTag} emails: "${subject}"`);
    const r = await sendBatchEmails(batch);
    result.subscriberCount += r.sent;
    result.messageIds.push(...r.messageIds);
    if (r.errors.length) result.errors.push(...r.errors);
    emails.forEach(e => sentTo.add(e));
  }

  // === STATE-LEVEL LEGACY FALLBACK ===
  // location-XX subscribers MINUS has-county-info subscribers get the full
  // state alert set, preserving the previous behavior for subscribers who
  // signed up before we captured county info.
  const stateSubs = await getTagSubscribers(stateTagId);
  let countyInfoEmails = new Set();
  const countyInfoTagId = tagsByName.get(HAS_COUNTY_INFO_TAG);
  if (countyInfoTagId) {
    const ciSubs = await getTagSubscribers(countyInfoTagId);
    countyInfoEmails = new Set(ciSubs.map(s => s.email_address).filter(Boolean));
  }
  const legacyEmails = stateSubs
    .map(s => s.email_address)
    .filter(e => e && !countyInfoEmails.has(e) && !sentTo.has(e));

  if (legacyEmails.length > 0) {
    const subject = buildAlertSubject({ stateName, alerts });
    const html = buildAlertEmail({ stateName, stateAbbr: state, alerts });
    const batch = legacyEmails.map(email => ({ to: email, subject, html }));

    console.log(`[Resend] Sending ${batch.length} state-fallback emails for ${stateName}: "${subject}"`);
    const r = await sendBatchEmails(batch);
    result.subscriberCount += r.sent;
    result.messageIds.push(...r.messageIds);
    if (r.errors.length) result.errors.push(...r.errors);
    legacyEmails.forEach(e => sentTo.add(e));
  } else {
    console.log(`[Resend] No legacy state-fallback subscribers for ${stateName}`);
  }

  if (result.errors.length > 0) {
    console.warn(`[Resend] Batch errors for ${stateName}:`, result.errors);
  }
  console.log(`[Resend] Sent ${result.subscriberCount} total emails for ${stateName}`);
  return result;
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

  // Acquire the processing lock so concurrent invocations short-circuit
  // instead of all racing on the same alert set. Cron + manual triggers
  // overlapping previously caused 4 simultaneous runs.
  let lockHeld = false;
  try {
    const lockResult = await acquireProcessingLock();
    if (!lockResult.acquired) {
      const heldAgeSec = Math.round((Date.now() - lockResult.heldBy.startedAt) / 1000);
      console.log(`[Process] Another invocation is processing (lock ${heldAgeSec}s old), exiting`);
      return { ...results, skipped: 'lock-held', lockAgeSec: heldAgeSec };
    }
    lockHeld = true;
    console.log('[Process] Lock acquired');
  } catch (lockErr) {
    // If the lock store itself is broken, proceed anyway — better to risk a
    // duplicate run than to silently stop sending alerts.
    console.warn('[Process] Lock acquire failed, proceeding without lock:', lockErr.message);
  }

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

    // Step 4: Load all Kit tags once and ensure state tags exist
    const { tagsByName, stateTagIds } = await loadAndEnsureTags(affectedStates);

    // Step 5: Send emails for each state via Resend
    for (const [state, stateAlerts] of Object.entries(alertsByState)) {
      const stateTagId = stateTagIds[state];
      if (!stateTagId) {
        console.warn(`[Process] No state tag for ${state}, skipping`);
        continue;
      }

      try {
        const { subscriberCount, messageIds } = await sendStateAlerts(state, stateAlerts, stateTagId, tagsByName);

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
  } finally {
    if (lockHeld) {
      await releaseProcessingLock();
      console.log('[Process] Lock released');
    }
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

  // Check for required environment variables. Dedup state lives in Netlify
  // Blobs now, which needs no env vars when running inside a Netlify Function.
  const requiredVars = ['RESEND_API_KEY'];
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
