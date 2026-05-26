/**
 * Process Urgent Alerts — Netlify Scheduled Function (Urgent Tier)
 *
 * Runs every 5 minutes. Sends short-fuse emails for action-required NWS
 * warnings — currently Tornado Warning and Flash Flood Warning (see
 * URGENT_EVENT_TYPES in shared/nws-alert-parser.js for the canonical list).
 *
 * Why a separate pipeline:
 * Tornado Warnings typically last 30-45 minutes. The digest pipeline running
 * every 30 min could land an email AFTER the warning has expired. This
 * function shortens that worst-case latency to ~5 minutes.
 *
 * Shared infrastructure with the standard pipeline:
 *   - Same NWS fetch + parse (lib/alert-pipeline.js)
 *   - Same SENT_ALERTS_STORE dedup (Netlify Blobs, keyed by NWS alert ID).
 *     This means if urgent sends at 6:02 PM, standard at 6:30 PM sees the
 *     ID in the dedup set and skips — even though its scope filter should
 *     already exclude urgent. Two layers of defense.
 *   - Same Resend delivery, same Kit subscriber tags, same email template.
 *
 * Lock key: 'lock-urgent' (distinct from standard's 'lock') so a running
 * 30-min digest cycle doesn't block a 5-min urgent run from firing.
 *
 * Most invocations (the common case) are no-ops: no urgent alerts active in
 * CONUS → fetch returns zero in-scope → exit cleanly without writes.
 *
 * Schedule: */5 * * * * (every 5 min) — configured in netlify.toml
 * Cost: 288 invocations/day, well under Netlify's free-tier function limit.
 */

const { URGENT_EVENT_TYPES } = require('../../shared/nws-alert-parser.js');
const { processAlerts } = require('./lib/alert-pipeline.js');

// Scope filter: include only urgent event types. Single source of truth for
// the urgent set is URGENT_EVENT_TYPES in shared/nws-alert-parser.js so the
// client-side fast-refresh trigger and this server-side pipeline can't drift.
function filterUrgentAlerts(alerts) {
  return alerts.filter((a) => URGENT_EVENT_TYPES.has(a.event));
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };

  // Required env check (same as standard pipeline).
  const missing = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.CONVERTKIT_API_KEY && !process.env.KIT_API_KEY) {
    missing.push('CONVERTKIT_API_KEY or KIT_API_KEY');
  }
  if (missing.length > 0) {
    const msg = `Missing environment variables: ${missing.join(', ')}`;
    console.error(msg);
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }

  // HTTP-trigger auth (scheduled runs skip this).
  if (event.httpMethod) {
    const expectedToken = process.env.ALERT_PROCESS_SECRET;
    const authHeader = event.headers?.authorization;
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  try {
    const results = await processAlerts({
      pipelineName: 'urgent',
      filterAlerts: filterUrgentAlerts,
      lockKey: 'lock-urgent',
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, ...results, processedAt: new Date().toISOString() }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message, processedAt: new Date().toISOString() }),
    };
  }
};
