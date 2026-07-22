/**
 * Process Weather Alerts — Netlify Scheduled Function (Standard Tier)
 *
 * Runs every 30 minutes. Sends digest-cadence emails for non-urgent alert
 * types — winter storms, heat advisories, watches, advisories, anything
 * NOT in URGENT_EVENT_TYPES.
 *
 * Urgent alerts (Tornado Warning, Flash Flood Warning) are handled by the
 * separate process-urgent-alerts-background function on a 5-min cron. This
 * function filters them OUT so subscribers don't get the same alert twice.
 *
 * Shared logic lives in lib/alert-pipeline.js — see that file for the full
 * fetch → dedup → tag → send → record flow.
 *
 * Schedule: every 30 min (cron in netlify.toml)
 *
 * Environment variables required:
 *   RESEND_API_KEY         - Resend API key for email delivery
 *   KIT_API_KEY            - Kit (ConvertKit) API v4 key (subscriber management)
 *   KIT_STATE_TAG_PREFIX   - Prefix for state tags in Kit (default: "location-")
 *
 * Dedup storage (Netlify Blobs) auto-detects context — no env vars required.
 */

const { URGENT_EVENT_TYPES } = require('../../shared/nws-alert-parser.js');
const { processAlerts } = require('./lib/alert-pipeline.js');
const { initBlobsFromLambda } = require('./lib/dedup-store.js');

// Scope filter: exclude urgent event types. Those go through the dedicated
// urgent pipeline on a 5-min cron. Shared SENT_ALERTS_STORE dedup is the
// belt to this scope filter's suspenders.
function filterStandardAlerts(alerts) {
  return alerts.filter((a) => !URGENT_EVENT_TYPES.has(a.event));
}

exports.handler = async (event) => {
  // Lambda-compat mode: Blobs needs credentials from the event.
  initBlobsFromLambda(event);

  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };

  // Required env check.
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

  // HTTP-trigger auth (scheduled runs skip this since httpMethod is undefined).
  if (event.httpMethod) {
    const expectedToken = process.env.ALERT_PROCESS_SECRET;
    const authHeader = event.headers?.authorization;
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  try {
    const results = await processAlerts({
      pipelineName: 'standard',
      filterAlerts: filterStandardAlerts,
      lockKey: 'lock',
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
