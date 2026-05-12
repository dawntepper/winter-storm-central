/**
 * Test harness for lib/dedup-store.js.
 *
 * Exercises recordSentAlert → getAlreadySentAlertIds → logBroadcastSend
 * against the real Netlify Blobs stores, then cleans up the test record.
 *
 * Run locally (requires `netlify dev` for Blobs context):
 *   npx netlify functions:invoke test-dedup
 *
 * Run against production after deploy:
 *   curl -X POST https://stormtracking.io/api/test-dedup \
 *     -H "Authorization: Bearer $ALERT_PROCESS_SECRET"
 */

const { getStore } = require('@netlify/blobs');
const {
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
} = require('./lib/dedup-store.js');

function makeStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

async function runTests() {
  const results = [];
  const TEST_ID = `test-alert-${Date.now()}`;
  let recordKey = null;

  try {
    // Test 1: recordSentAlert
    const rec = await recordSentAlert({
      nwsAlertId: TEST_ID,
      eventType: 'Test',
      severity: 'Unknown',
      affectedStates: ['NY'],
      areaDescription: 'Test area',
      headline: 'Test headline',
      kitBroadcastIds: [],
      subscriberCount: 0,
      statesNotified: ['NY'],
      alertOnset: new Date().toISOString(),
      alertExpires: new Date(Date.now() + 3600000).toISOString(),
      status: 'sent',
    });
    recordKey = rec?.id || null;
    results.push({
      test: 'recordSentAlert',
      pass: !!recordKey,
      detail: { id: recordKey },
    });

    // Test 2: getAlreadySentAlertIds
    const sent = await getAlreadySentAlertIds([TEST_ID, `${TEST_ID}-nonexistent`]);
    results.push({
      test: 'getAlreadySentAlertIds',
      pass: sent.has(TEST_ID) && !sent.has(`${TEST_ID}-nonexistent`),
      detail: { found: [...sent] },
    });

    // Test 3: logBroadcastSend (best-effort, doesn't throw)
    await logBroadcastSend({
      sentAlertId: recordKey,
      nwsAlertId: TEST_ID,
      kitBroadcastId: 'test-broadcast',
      targetState: 'NY',
      status: 'sent',
    });
    results.push({ test: 'logBroadcastSend', pass: true });

    return { success: results.every(r => r.pass), results, testId: TEST_ID };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: err.stack,
      results,
      testId: TEST_ID,
    };
  } finally {
    // Cleanup: remove the test record so we don't litter the dedup store.
    if (recordKey) {
      try {
        await makeStore('sent-alerts').delete(recordKey);
      } catch (err) {
        console.warn('Test cleanup failed:', err.message);
      }
    }
  }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  // Bearer-protect the HTTP path so the test endpoint can't be hammered.
  if (event?.httpMethod) {
    const auth = event.headers?.authorization;
    const expected = process.env.ALERT_PROCESS_SECRET;
    if (expected && auth !== `Bearer ${expected}`) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  const result = await runTests();
  return {
    statusCode: result.success ? 200 : 500,
    headers,
    body: JSON.stringify(result, null, 2),
  };
};
