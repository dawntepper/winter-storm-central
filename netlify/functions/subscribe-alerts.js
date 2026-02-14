/**
 * Subscribe Alerts — Netlify Function
 *
 * Handles email signups for weather alerts via Kit (ConvertKit) Forms API.
 * Adds subscriber to Kit form with zip_code custom field, then tags
 * them by state for targeted broadcasts.
 *
 * POST /api/subscribe-alerts
 * Body: { email: string, zip_code: string }
 */

const { getStateFromZip } = require('./lib/alert-matcher.js');
const {
  findSubscriberByEmail,
  getSubscriberTags,
  untagSubscriber,
  addSubscriberToSequence,
} = require('./lib/kit-client.js');

const KIT_V3_BASE = 'https://api.convertkit.com/v3';
const KIT_V4_BASE = 'https://api.kit.com/v4';
const KIT_FORM_ID = '9086634';

function getApiKey() {
  // Support both env var names
  const apiKey = process.env.CONVERTKIT_API_KEY || process.env.KIT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CONVERTKIT_API_KEY or KIT_API_KEY environment variable');
  }
  return apiKey;
}

/**
 * Subscribe via Kit v3 Forms API (most reliable for form signups)
 */
async function kitFormSubscribe({ email, zipCode, apiKey }) {
  const url = `${KIT_V3_BASE}/forms/${KIT_FORM_ID}/subscribe`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      email,
      fields: {
        zip_code: zipCode,
      },
    }),
  });

  const responseText = await response.text();
  console.log(`[Subscribe] Kit v3 response ${response.status}:`, responseText);

  if (!response.ok) {
    throw new Error(`Kit API error ${response.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
}

async function ensureStateTag({ state, apiKey }) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const tagName = `${prefix}${state}`;

  // List existing tags to find or create (v4 API)
  const listResponse = await fetch(`${KIT_V4_BASE}/tags`, {
    headers: {
      'X-Kit-Api-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!listResponse.ok) {
    console.warn(`[Subscribe] Failed to list tags: ${listResponse.status}`);
    return null;
  }

  const data = await listResponse.json();
  const existingTag = (data.tags || []).find(
    (t) => t.name.toLowerCase() === tagName.toLowerCase()
  );

  if (existingTag) return existingTag.id;

  // Create the tag
  const createResponse = await fetch(`${KIT_V4_BASE}/tags`, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name: tagName }),
  });

  if (!createResponse.ok) {
    console.warn(`[Subscribe] Failed to create tag ${tagName}: ${createResponse.status}`);
    return null;
  }

  const created = await createResponse.json();
  return created?.tag?.id || null;
}

async function tagSubscriber({ tagId, email, apiKey }) {
  // Find subscriber by email (v4 API)
  const findResponse = await fetch(
    `${KIT_V4_BASE}/subscribers?email_address=${encodeURIComponent(email)}`,
    {
      headers: {
        'X-Kit-Api-Key': apiKey,
        Accept: 'application/json',
      },
    }
  );

  if (!findResponse.ok) {
    console.warn(`[Subscribe] Failed to find subscriber: ${findResponse.status}`);
    return;
  }

  const findData = await findResponse.json();
  const subscriber = (findData.subscribers || [])[0];
  if (!subscriber?.id) return;

  // Tag the subscriber
  await fetch(`${KIT_V4_BASE}/tags/${tagId}/subscribers/${subscriber.id}`, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const { email, zip_code } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid email required' }),
    };
  }

  if (!zip_code || !/^\d{5}$/.test(zip_code)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid 5-digit zip code required' }),
    };
  }

  try {
    const apiKey = getApiKey();

    // 1. Subscribe to Kit form with zip_code field
    await kitFormSubscribe({ email, zipCode: zip_code, apiKey });
    console.log(`[Subscribe] Added ${email} to form ${KIT_FORM_ID}`);

    // 2. Tag by state (best-effort — don't fail the signup if tagging fails)
    const state = getStateFromZip(zip_code);
    const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
    if (state) {
      try {
        // Remove old location tags if this is a re-subscribe with a new zip
        const existing = await findSubscriberByEmail(email);
        if (existing?.id) {
          const currentTags = await getSubscriberTags(existing.id);
          const newTagName = `${prefix}${state}`.toLowerCase();
          for (const tag of currentTags) {
            if (
              tag.name.toLowerCase().startsWith(prefix.toLowerCase()) &&
              tag.name.toLowerCase() !== newTagName
            ) {
              await untagSubscriber(tag.id, existing.id);
              console.log(`[Subscribe] Removed old tag ${tag.name} from ${email}`);
            }
          }
        }

        const tagId = await ensureStateTag({ state, apiKey });
        if (tagId) {
          await tagSubscriber({ tagId, email, apiKey });
          console.log(`[Subscribe] Tagged ${email} with state ${state}`);
        }
      } catch (tagError) {
        console.warn(`[Subscribe] State tagging failed for ${email}:`, tagError.message);
      }
    }

    // 3. Enroll in welcome sequence (best-effort — don't fail signup)
    const welcomeSequenceId = process.env.KIT_WELCOME_SEQUENCE_ID;
    if (welcomeSequenceId) {
      try {
        await addSubscriberToSequence(welcomeSequenceId, email);
        console.log(`[Subscribe] Enrolled ${email} in welcome sequence ${welcomeSequenceId}`);
      } catch (seqError) {
        console.warn(`[Subscribe] Welcome sequence enrollment failed for ${email}:`, seqError.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully subscribed to weather alerts',
      }),
    };
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    const isConfigError = error.message?.includes('Missing');
    return {
      statusCode: isConfigError ? 503 : 500,
      headers,
      body: JSON.stringify({
        error: isConfigError
          ? 'Email service not configured. Please try again later.'
          : `Failed to subscribe: ${error.message}`,
      }),
    };
  }
};
