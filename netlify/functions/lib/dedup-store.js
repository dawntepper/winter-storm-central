/**
 * Alert Dedup + Broadcast Log — Netlify Blobs Backend
 *
 * Drop-in replacement for lib/supabase-admin.js. Exports the same function
 * signatures so process-weather-alerts.js doesn't need behavioral changes.
 *
 * Storage layout:
 *   - sent-alerts store: keys are "<status>:<base64url(alertId)>", values are
 *     JSON metadata. Status prefix lets us list only successful sends for
 *     dedup without GETting every record.
 *   - broadcast-log store: keys are "<ISO-timestamp>-<state>-<random>", values
 *     are JSON log entries. Used for analytics/debugging, never read during
 *     normal alert processing.
 *
 * These handlers use Lambda-compat (`exports.handler`). Blobs context is NOT
 * auto-injected in that mode — call initBlobsFromLambda(event) once at the
 * top of the handler before any store reads/writes.
 *
 * For local scripts outside `netlify dev`, set NETLIFY_SITE_ID +
 * NETLIFY_BLOBS_TOKEN (PAT with Blobs scope). Do not leave a stale PAT in
 * Netlify env vars: it overrides working context and 401s every blob op.
 */

const { connectLambda, getStore } = require('@netlify/blobs');

const SENT_ALERTS_STORE = 'sent-alerts';
const BROADCAST_LOG_STORE = 'broadcast-log';
const LOCK_STORE = 'alert-processing-lock';
const LOCK_KEY = 'lock';
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 min, generous margin over typical 3-4 min runs

let lambdaBlobsReady = false;

/**
 * Wire Blobs credentials from the Lambda event (required for exports.handler).
 * Safe to call multiple times; no-ops when event lacks Blobs context (local).
 */
function initBlobsFromLambda(event) {
  if (lambdaBlobsReady || !event || typeof event !== 'object') return;
  try {
    connectLambda(event);
    lambdaBlobsReady = true;
  } catch (err) {
    // Scheduled/local invocations without Blobs blobs on the event fall through
    // to explicit token / MissingBlobsEnvironmentError at getStore time.
    console.warn('[dedup-store] connectLambda skipped:', err.message);
  }
}

function makeStore(name) {
  // Prefer deploy/Lambda context (after initBlobsFromLambda). Only use an
  // explicit PAT outside Netlify runtime — a stale NETLIFY_BLOBS_TOKEN in
  // production previously 401'd the entire alert pipeline.
  const runningOnNetlify = Boolean(
    process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (!runningOnNetlify) {
    const blobsToken = process.env.NETLIFY_BLOBS_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    if (blobsToken && siteID) {
      return getStore({ name, siteID, token: blobsToken });
    }
  }
  return getStore(name);
}

function encodeAlertId(id) {
  return Buffer.from(String(id), 'utf-8').toString('base64url');
}

function decodeAlertId(encoded) {
  try {
    return Buffer.from(encoded, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
}

function keyForSentAlert(status, alertId) {
  return `${status}:${encodeAlertId(alertId)}`;
}

function decodeKeyTail(key) {
  const colon = key.indexOf(':');
  if (colon === -1) return null;
  return decodeAlertId(key.slice(colon + 1));
}

/**
 * Has this alert already been successfully sent?
 */
async function isAlertSent(nwsAlertId) {
  const store = makeStore(SENT_ALERTS_STORE);
  const record = await store.get(keyForSentAlert('sent', nwsAlertId), { type: 'json' });
  return !!record;
}

/**
 * Given a list of alert IDs, return the Set of IDs that have already been
 * successfully sent. Filters by status prefix at list time so we don't pay a
 * GET per record.
 */
async function getAlreadySentAlertIds(nwsAlertIds) {
  if (!nwsAlertIds || nwsAlertIds.length === 0) return new Set();

  const wanted = new Set(nwsAlertIds.map(String));
  const found = new Set();
  const store = makeStore(SENT_ALERTS_STORE);

  let cursor;
  do {
    const page = await store.list({ prefix: 'sent:', cursor });
    for (const blob of page.blobs || []) {
      const id = decodeKeyTail(blob.key);
      if (id && wanted.has(id)) found.add(id);
    }
    cursor = page.cursor;
  } while (cursor);

  return found;
}

/**
 * Record an alert send attempt (sent / failed / skipped).
 * Returns { id, ...record } where id is the blob key (usable as a foreign
 * key for logBroadcastSend, matching the Supabase return shape).
 */
async function recordSentAlert({
  nwsAlertId,
  eventType,
  severity,
  affectedStates,
  areaDescription,
  headline,
  kitBroadcastIds,
  subscriberCount,
  statesNotified,
  alertOnset,
  alertExpires,
  status = 'sent',
  errorMessage = null,
}) {
  const store = makeStore(SENT_ALERTS_STORE);
  const key = keyForSentAlert(status, nwsAlertId);
  const record = {
    nws_alert_id: nwsAlertId,
    event_type: eventType,
    severity,
    affected_states: affectedStates,
    area_description: areaDescription,
    headline,
    kit_broadcast_ids: kitBroadcastIds,
    subscriber_count: subscriberCount,
    states_notified: statesNotified,
    alert_onset: alertOnset,
    alert_expires: alertExpires,
    status,
    error_message: errorMessage,
    created_at: new Date().toISOString(),
  };

  await store.setJSON(key, record);
  return { id: key, ...record };
}

/**
 * Append a row to the broadcast log. Best-effort: errors are logged, not
 * thrown, so a logging failure can't block alert processing.
 */
async function logBroadcastSend({
  sentAlertId,
  nwsAlertId,
  kitBroadcastId,
  targetState,
  status = 'created',
  errorMessage = null,
}) {
  try {
    const store = makeStore(BROADCAST_LOG_STORE);
    const timestamp = new Date().toISOString();
    const safeTs = timestamp.replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `${safeTs}-${targetState || 'unknown'}-${rand}`;

    await store.setJSON(key, {
      sent_alert_id: sentAlertId,
      nws_alert_id: nwsAlertId,
      kit_broadcast_id: kitBroadcastId,
      target_state: targetState,
      status,
      error_message: errorMessage,
      created_at: timestamp,
    });
  } catch (err) {
    console.error('logBroadcastSend failed:', err.message);
  }
}

async function cleanupStore(storeName, cutoffMs) {
  const store = makeStore(storeName);
  let removed = 0;
  let cursor;

  do {
    const page = await store.list({ cursor });
    for (const blob of page.blobs || []) {
      const record = await store.get(blob.key, { type: 'json' });
      const createdAt = record?.created_at ? new Date(record.created_at).getTime() : null;
      if (createdAt && createdAt < cutoffMs) {
        await store.delete(blob.key);
        removed++;
      }
    }
    cursor = page.cursor;
  } while (cursor);

  return removed;
}

/**
 * Delete records older than `daysOld` days from both stores. Safe to run
 * periodically; the function caller schedules it probabilistically (~once
 * per day across cron runs).
 */
async function cleanupOldRecords(daysOld = 30) {
  const cutoffMs = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  try {
    const sentRemoved = await cleanupStore(SENT_ALERTS_STORE, cutoffMs);
    const logRemoved = await cleanupStore(BROADCAST_LOG_STORE, cutoffMs);
    console.log(`[cleanup] Removed ${sentRemoved} sent-alerts and ${logRemoved} broadcast-log records older than ${daysOld} days`);
  } catch (err) {
    console.error('cleanupOldRecords failed:', err.message);
  }
}

/**
 * Try to acquire the processing lock. Returns { acquired: true } if this
 * caller now holds the lock, or { acquired: false, heldBy: {...} } if
 * another invocation is mid-run. Caller MUST call releaseProcessingLock()
 * in a finally block when done.
 *
 * Note: this is best-effort, not atomic. There's a tiny race window between
 * the get() and setJSON() calls where two concurrent runs could both see
 * "no lock" and both acquire. For our cadence (cron every 30 min, occasional
 * manual triggers) this is acceptable — the previous failure mode was THREE
 * simultaneous runs from accidental triggers, which this prevents.
 */
async function acquireProcessingLock({ lockKey = LOCK_KEY, ttlMs = DEFAULT_LOCK_TTL_MS } = {}) {
  const store = makeStore(LOCK_STORE);
  const existing = await store.get(lockKey, { type: 'json' });
  if (existing && Date.now() - existing.startedAt < ttlMs) {
    return { acquired: false, heldBy: existing };
  }
  await store.setJSON(lockKey, { startedAt: Date.now() });
  return { acquired: true };
}

async function releaseProcessingLock({ lockKey = LOCK_KEY } = {}) {
  try {
    const store = makeStore(LOCK_STORE);
    await store.delete(lockKey);
  } catch (err) {
    // If we can't release, the lock will expire via TTL — log but don't throw.
    console.warn('releaseProcessingLock failed:', err.message);
  }
}

module.exports = {
  initBlobsFromLambda,
  isAlertSent,
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
  cleanupOldRecords,
  acquireProcessingLock,
  releaseProcessingLock,
};
