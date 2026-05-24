/**
 * Submit URLs to Bing IndexNow API
 *
 * POST /api/submit-to-indexnow
 * Body: { urls: string[], source?: string }
 * Response: { success: boolean, submitted: number, message: string }
 *
 * Background: see docs/seo-reference.md (Session 2 — will be written post-ship)
 * and project memory "indexnow-setup". IndexNow accepts up to 10,000 URLs per
 * call; this function auto-batches if more are submitted. The verification
 * key is stored in INDEXNOW_KEY env var and must match the contents of the
 * public verification file deployed at https://stormtracking.io/{KEY}.txt.
 */

const HOST = 'stormtracking.io';
const ALLOWED_ORIGIN_PREFIX = `https://${HOST}`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const MAX_URLS_PER_BATCH = 10000;
const MAX_URLS_PER_REQUEST = 10000; // Cap total submission per call

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

function isValidStormtrackingUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === HOST;
  } catch {
    return false;
  }
}

async function submitBatch({ urls, key, keyLocation }) {
  const payload = {
    host: HOST,
    key,
    keyLocation,
    urlList: urls,
  };

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  // IndexNow returns 200/202 as success. 4xx/5xx as failure.
  // Body is usually empty for 200; 4xx may include a short message.
  let responseBody = '';
  try {
    responseBody = await response.text();
  } catch {
    /* ignore */
  }

  return { status: response.status, body: responseBody };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, submitted: 0, message: 'Method not allowed' });
  }

  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.error('[indexnow] INDEXNOW_KEY env var is not set');
    return jsonResponse(503, {
      success: false,
      submitted: 0,
      message: 'IndexNow not configured (INDEXNOW_KEY missing on server)',
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, submitted: 0, message: 'Invalid JSON body' });
  }

  const { urls, source = 'unspecified' } = body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return jsonResponse(400, {
      success: false,
      submitted: 0,
      message: 'urls must be a non-empty array',
    });
  }

  if (urls.length > MAX_URLS_PER_REQUEST) {
    return jsonResponse(400, {
      success: false,
      submitted: 0,
      message: `Too many URLs in one request (max ${MAX_URLS_PER_REQUEST})`,
    });
  }

  const invalid = urls.filter((u) => !isValidStormtrackingUrl(u));
  if (invalid.length > 0) {
    return jsonResponse(400, {
      success: false,
      submitted: 0,
      message: `Invalid URLs (must be https://${HOST}/...): ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? ` (+${invalid.length - 3} more)` : ''}`,
    });
  }

  const keyLocation = `${ALLOWED_ORIGIN_PREFIX}/${key}.txt`;

  // Split into batches of MAX_URLS_PER_BATCH (IndexNow's per-call limit).
  // For typical site usage (~150 URLs) this is a single batch.
  const batches = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_BATCH) {
    batches.push(urls.slice(i, i + MAX_URLS_PER_BATCH));
  }

  console.log(`[indexnow] source=${source} batches=${batches.length} total_urls=${urls.length}`);

  let totalSubmitted = 0;
  const errors = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const { status, body: respBody } = await submitBatch({ urls: batch, key, keyLocation });
      console.log(`[indexnow] batch ${i + 1}/${batches.length} → status=${status} urls=${batch.length}`);

      if (status === 200 || status === 202) {
        totalSubmitted += batch.length;
        continue;
      }

      if (status === 403) {
        // Key verification failed — the public verification file likely isn't accessible.
        console.error(`[indexnow] 403 forbidden — verification file at ${keyLocation} likely not deployed/accessible. Body: ${respBody.slice(0, 200)}`);
        errors.push(`Batch ${i + 1}: 403 (verification failed — check that ${keyLocation} is publicly accessible)`);
        break; // No point retrying further batches with a bad key
      }

      if (status === 429) {
        console.warn(`[indexnow] 429 rate limited on batch ${i + 1}`);
        errors.push(`Batch ${i + 1}: 429 (rate limited — try again in a few minutes)`);
        break;
      }

      // 400, 422, 5xx, anything else
      console.error(`[indexnow] batch ${i + 1} failed status=${status} body=${respBody.slice(0, 200)}`);
      errors.push(`Batch ${i + 1}: ${status} (${respBody.slice(0, 100) || 'no body'})`);
    } catch (err) {
      console.error(`[indexnow] batch ${i + 1} threw:`, err.message);
      errors.push(`Batch ${i + 1}: ${err.message}`);
    }
  }

  if (errors.length === 0) {
    return jsonResponse(200, {
      success: true,
      submitted: totalSubmitted,
      message: `Submitted ${totalSubmitted} URL${totalSubmitted === 1 ? '' : 's'} to IndexNow`,
    });
  }

  // Partial or full failure
  return jsonResponse(totalSubmitted > 0 ? 207 : 502, {
    success: false,
    submitted: totalSubmitted,
    message: `${totalSubmitted}/${urls.length} submitted. Errors: ${errors.join('; ')}`,
  });
};
