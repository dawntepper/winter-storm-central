/**
 * Shared Alert Pipeline — used by both Netlify scheduled functions
 *
 * Two pipelines call this module with different filters:
 *
 *   1. process-weather-alerts-background.js (every 30 min)
 *      Filter: exclude URGENT_EVENT_TYPES. Handles digest cadence for
 *      non-urgent alerts (winter storms, heat advisories, watches, etc.).
 *      Lock key: 'lock'
 *
 *   2. process-urgent-alerts-background.js (every 5 min)
 *      Filter: include only URGENT_EVENT_TYPES (Tornado Warning,
 *      Flash Flood Warning). Short-fuse pipeline for action-required
 *      warnings where 30-min latency would land emails after the warning
 *      has expired.
 *      Lock key: 'lock-urgent'
 *
 * Shared infrastructure (one source of truth across both pipelines):
 *   - NWS fetch + parse (this file)
 *   - Dedup store (lib/dedup-store.js, keyed by NWS alert ID)
 *   - Email render + send (lib/email-templates.js + lib/resend-client.js)
 *   - Subscriber location matching (lib/alert-matcher.js + Kit tags)
 *
 * Critical: dedup is shared via the same SENT_ALERTS_STORE blob. If the
 * urgent pipeline sends a Tornado Warning at 6:02 PM, the digest pipeline
 * will see that alert ID in the dedup set at 6:30 PM and skip it — even
 * though its own filter (exclude urgent) should already keep it out of
 * scope. The shared dedup is the safety net, not the primary mechanism.
 *
 * Locks ARE separate so a running digest cycle doesn't block urgent.
 */

const {
  ALERTS_API,
  NWS_HEADERS,
  getCategoryForEvent,
  extractLocationName,
  extractStateCode,
  extractGeometryCoordinates,
  filterAlertFeatures,
} = require('../../../shared/nws-alert-parser.js');

const {
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
  cleanupOldRecords,
  acquireProcessingLock,
  releaseProcessingLock,
} = require('./dedup-store.js');

const {
  listTags,
  createTag,
  listSubscribersForTag,
} = require('./kit-client.js');

const { sendBatchEmails } = require('./resend-client.js');

const {
  getAffectedStates,
  groupAlertsByState,
  countyTagFor,
} = require('./alert-matcher.js');

const { getCountyNamesForUGCs } = require('./nws-zones.js');

const {
  buildAlertEmail,
  buildAlertSubject,
} = require('./email-templates.js');

const HAS_COUNTY_INFO_TAG = 'has-county-info';

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

/**
 * Parse a raw NWS alert feature for email use. Simpler than the client-side
 * version — doesn't require coordinates (alerts without geometry still get
 * sent, just without a map link).
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

async function fetchNWSAlerts(logPrefix) {
  console.log(`[${logPrefix}] [NWS] Fetching active alerts...`);
  const response = await fetch(ALERTS_API, { headers: NWS_HEADERS });
  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const features = data.features || [];
  const filtered = filterAlertFeatures(features);
  const parsed = filtered.map(parseAlertForEmail).filter(Boolean);
  console.log(`[${logPrefix}] [NWS] Fetched ${features.length} total, ${parsed.length} after include-list filter`);
  return parsed;
}

/**
 * Snapshot every tag in Kit into a Map<lowercasedName, tagId>. We do this once
 * per cron run so per-state/per-county tag lookups stay in-memory after the
 * single listTags() call. Also ensures the state tags for the affected states
 * exist (creating them if missing).
 */
async function loadAndEnsureTags(affectedStates, logPrefix) {
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
      console.log(`[${logPrefix}] [Kit] Creating state tag: ${tagName}`);
      const result = await createTag(tagName);
      if (result?.tag?.id) {
        stateTagIds[state] = result.tag.id;
        tagsByName.set(lc, result.tag.id);
      }
    }
  }
  return { tagsByName, stateTagIds };
}

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

async function bucketAlertsByCounty(state, alerts) {
  const buckets = new Map();
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

async function sendStateAlerts(state, alerts, stateTagId, tagsByName, logPrefix) {
  const stateName = STATE_NAMES[state] || state;
  const result = { subscriberCount: 0, messageIds: [], errors: [] };
  const sentTo = new Set();

  // County-precise path
  const countyBuckets = await bucketAlertsByCounty(state, alerts);
  console.log(`[${logPrefix}] [Process] ${stateName}: ${countyBuckets.size} county buckets from ${alerts.length} alerts`);

  for (const [countyTag, { alerts: countyAlerts, countyName }] of countyBuckets) {
    const tagId = tagsByName.get(countyTag.toLowerCase());
    if (!tagId) {
      console.log(`[${logPrefix}] [Resend] ${countyTag}: tag doesn't exist yet (no subscribers in this county)`);
      continue;
    }
    const subs = await getTagSubscribers(tagId);
    const emails = subs.map(s => s.email_address).filter(e => e && !sentTo.has(e));
    if (emails.length === 0) {
      console.log(`[${logPrefix}] [Resend] ${countyTag}: 0 subscribers, skipping`);
      continue;
    }
    const subject = buildAlertSubject({ stateName, alerts: countyAlerts, countyName });
    const html = buildAlertEmail({ stateName, stateAbbr: state, alerts: countyAlerts });
    const batch = emails.map(email => ({ to: email, subject, html }));
    console.log(`[${logPrefix}] [Resend] Sending ${batch.length} ${countyTag} emails: "${subject}"`);
    const r = await sendBatchEmails(batch);
    result.subscriberCount += r.sent;
    result.messageIds.push(...r.messageIds);
    if (r.errors.length) result.errors.push(...r.errors);
    emails.forEach(e => sentTo.add(e));
  }

  // State-level legacy fallback: location-XX subscribers without has-county-info
  // get the full state alert set. Zip signups MUST NOT land here — they opted
  // into county precision, and a missing county tag would otherwise blast them
  // every alert in the state (e.g. Lee County ZIP getting Panhandle digests).
  const stateSubs = await getTagSubscribers(stateTagId);
  let countyInfoEmails = new Set();
  const countyInfoTagId = tagsByName.get(HAS_COUNTY_INFO_TAG);
  if (countyInfoTagId) {
    const ciSubs = await getTagSubscribers(countyInfoTagId);
    countyInfoEmails = new Set(ciSubs.map(s => s.email_address).filter(Boolean));
  }
  let skippedZipWithoutCounty = 0;
  const legacyEmails = [];
  for (const sub of stateSubs) {
    const e = sub.email_address;
    if (!e || countyInfoEmails.has(e) || sentTo.has(e)) continue;
    const zip = sub.fields?.zip_code;
    if (zip && String(zip).trim()) {
      skippedZipWithoutCounty++;
      continue;
    }
    legacyEmails.push(e);
  }
  if (skippedZipWithoutCounty > 0) {
    console.warn(
      `[${logPrefix}] [Resend] Skipping ${skippedZipWithoutCounty} ${stateName} ` +
      `state-fallback recipient(s) who have zip_code but lack has-county-info ` +
      `(need county re-tag; refusing statewide blast)`
    );
  }

  if (legacyEmails.length > 0) {
    const subject = buildAlertSubject({ stateName, alerts });
    const html = buildAlertEmail({ stateName, stateAbbr: state, alerts });
    const batch = legacyEmails.map(email => ({ to: email, subject, html }));
    console.log(`[${logPrefix}] [Resend] Sending ${batch.length} state-fallback emails for ${stateName}: "${subject}"`);
    const r = await sendBatchEmails(batch);
    result.subscriberCount += r.sent;
    result.messageIds.push(...r.messageIds);
    if (r.errors.length) result.errors.push(...r.errors);
    legacyEmails.forEach(e => sentTo.add(e));
  } else {
    console.log(`[${logPrefix}] [Resend] No legacy state-fallback subscribers for ${stateName}`);
  }

  if (result.errors.length > 0) {
    console.warn(`[${logPrefix}] [Resend] Batch errors for ${stateName}:`, result.errors);
  }
  console.log(`[${logPrefix}] [Resend] Sent ${result.subscriberCount} total emails for ${stateName}`);
  return result;
}

/**
 * Run an alert processing pipeline.
 *
 * @param {Object} opts
 * @param {string} opts.pipelineName  Short label for log lines ('standard' | 'urgent').
 * @param {(alerts: Object[]) => Object[]} opts.filterAlerts  Receives the
 *     full parsed NWS payload, returns the subset this pipeline owns. Must
 *     not mutate input.
 * @param {string} opts.lockKey  Netlify Blob lock key. Pipelines use distinct
 *     keys so concurrent runs don't block each other across tiers.
 */
async function processAlerts({ pipelineName, filterAlerts, lockKey }) {
  const startTime = Date.now();
  const logPrefix = pipelineName;
  const results = {
    pipeline: pipelineName,
    alertsFetched: 0,
    alertsInScope: 0,
    alertsNew: 0,
    broadcastsSent: 0,
    statesNotified: [],
    errors: [],
  };

  let lockHeld = false;
  try {
    const lockResult = await acquireProcessingLock({ lockKey });
    if (!lockResult.acquired) {
      const heldAgeSec = Math.round((Date.now() - lockResult.heldBy.startedAt) / 1000);
      console.log(`[${logPrefix}] [Process] Another invocation holds lock '${lockKey}' (${heldAgeSec}s old), exiting`);
      return { ...results, skipped: 'lock-held', lockAgeSec: heldAgeSec };
    }
    lockHeld = true;
    console.log(`[${logPrefix}] [Process] Lock '${lockKey}' acquired`);
  } catch (lockErr) {
    // If the lock store itself is broken, proceed anyway — better to risk a
    // duplicate run than to silently stop sending alerts.
    console.warn(`[${logPrefix}] [Process] Lock acquire failed, proceeding without lock:`, lockErr.message);
  }

  try {
    // 1. Fetch all NWS alerts (full include-list filter applied in fetchNWSAlerts).
    const allAlerts = await fetchNWSAlerts(logPrefix);
    results.alertsFetched = allAlerts.length;

    // 2. Apply pipeline-specific filter.
    const inScope = filterAlerts(allAlerts);
    results.alertsInScope = inScope.length;
    console.log(`[${logPrefix}] [Process] ${inScope.length}/${allAlerts.length} alerts in scope for this pipeline`);

    if (inScope.length === 0) {
      return results;
    }

    // 3. Dedup against shared SENT_ALERTS_STORE.
    const alertIds = inScope.map((a) => a.id);
    const alreadySent = await getAlreadySentAlertIds(alertIds);
    const newAlerts = inScope.filter((a) => !alreadySent.has(a.id));
    results.alertsNew = newAlerts.length;

    if (newAlerts.length === 0) {
      console.log(`[${logPrefix}] [Process] No new alerts to send (all ${inScope.length} in-scope already dedup'd)`);
      return results;
    }

    console.log(`[${logPrefix}] [Process] ${newAlerts.length} new alerts to process`);

    // 4. Group + load tags.
    const alertsByState = groupAlertsByState(newAlerts);
    const affectedStates = Object.keys(alertsByState);
    console.log(`[${logPrefix}] [Process] Affected states: ${affectedStates.join(', ')}`);

    const { tagsByName, stateTagIds } = await loadAndEnsureTags(affectedStates, logPrefix);

    // 5. Send + record per state.
    for (const [state, stateAlerts] of Object.entries(alertsByState)) {
      const stateTagId = stateTagIds[state];
      if (!stateTagId) {
        console.warn(`[${logPrefix}] [Process] No state tag for ${state}, skipping`);
        continue;
      }

      try {
        const { subscriberCount, messageIds } = await sendStateAlerts(state, stateAlerts, stateTagId, tagsByName, logPrefix);

        for (const alert of stateAlerts) {
          try {
            const sentRecord = await recordSentAlert({
              nwsAlertId: alert.id,
              eventType: alert.event,
              severity: alert.severity,
              affectedStates: getAffectedStates(alert),
              areaDescription: alert.areaDesc,
              headline: alert.headline,
              kitBroadcastIds: messageIds.slice(0, 5),
              subscriberCount,
              statesNotified: [state],
              alertOnset: alert.onset,
              alertExpires: alert.expires,
              status: subscriberCount > 0 ? 'sent' : 'skipped',
            });
            await logBroadcastSend({
              sentAlertId: sentRecord.id,
              nwsAlertId: alert.id,
              kitBroadcastId: messageIds[0] || null,
              targetState: state,
              status: subscriberCount > 0 ? 'sent' : 'skipped',
            });
          } catch (recordError) {
            console.error(`[${logPrefix}] [Process] Error recording alert ${alert.id}:`, recordError.message);
          }
        }

        if (subscriberCount > 0) results.broadcastsSent++;
        results.statesNotified.push(state);
        console.log(`[${logPrefix}] [Process] Sent ${subscriberCount} emails for ${state}`);
      } catch (sendError) {
        console.error(`[${logPrefix}] [Process] Error sending emails for ${state}:`, sendError.message);
        results.errors.push(`${state}: ${sendError.message}`);

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
            console.error(`[${logPrefix}] [Process] Error recording failed alert:`, recordError.message);
          }
        }
      }
    }

    // 6. Periodic cleanup — only the standard pipeline runs it (urgent fires 12x
    //    more often, so its 0.02 chance would over-clean).
    if (pipelineName === 'standard' && Math.random() < 0.02) {
      console.log(`[${logPrefix}] [Process] Running periodic cleanup...`);
      await cleanupOldRecords(30);
    }
  } catch (error) {
    console.error(`[${logPrefix}] [Process] Fatal error:`, error);
    results.errors.push(error.message);
  } finally {
    if (lockHeld) {
      await releaseProcessingLock({ lockKey });
      console.log(`[${logPrefix}] [Process] Lock '${lockKey}' released`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[${logPrefix}] [Process] Completed in ${duration}ms:`, JSON.stringify(results));
  return results;
}

module.exports = {
  processAlerts,
};
