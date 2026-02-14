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

import { getStateFromZip } from './lib/alert-matcher.js';

const KIT_API_BASE = 'https://api.kit.com/v4';
const KIT_FORM_ID = '9086634';

function getApiKey() {
  // Support both env var names
  const apiKey = process.env.CONVERTKIT_API_KEY || process.env.KIT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CONVERTKIT_API_KEY or KIT_API_KEY environment variable');
  }
  return apiKey;
}

async function kitFormSubscribe({ email, zipCode, apiKey }) {
  const url = `${KIT_API_BASE}/forms/${KIT_FORM_ID}/subscribers`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      fields: {
        zip_code: zipCode,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Kit API error ${response.status}: ${errorBody}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function ensureStateTag({ state, apiKey }) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const tagName = `${prefix}${state}`;

  // List existing tags to find or create
  const listResponse = await fetch(`${KIT_API_BASE}/tags`, {
    headers: {
      'X-Kit-Api-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!listResponse.ok) return null;

  const data = await listResponse.json();
  const existingTag = (data.tags || []).find(
    (t) => t.name.toLowerCase() === tagName.toLowerCase()
  );

  if (existingTag) return existingTag.id;

  // Create the tag
  const createResponse = await fetch(`${KIT_API_BASE}/tags`, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name: tagName }),
  });

  if (!createResponse.ok) return null;

  const created = await createResponse.json();
  return created?.tag?.id || null;
}

async function tagSubscriber({ tagId, email, apiKey }) {
  // Find subscriber by email first
  const findResponse = await fetch(
    `${KIT_API_BASE}/subscribers?email_address=${encodeURIComponent(email)}`,
    {
      headers: {
        'X-Kit-Api-Key': apiKey,
        Accept: 'application/json',
      },
    }
  );

  if (!findResponse.ok) return;

  const findData = await findResponse.json();
  const subscriber = (findData.subscribers || [])[0];
  if (!subscriber?.id) return;

  // Tag the subscriber
  await fetch(`${KIT_API_BASE}/tags/${tagId}/subscribers/${subscriber.id}`, {
    method: 'POST',
    headers: {
      'X-Kit-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

export const handler = async (event) => {
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
    if (state) {
      try {
        const tagId = await ensureStateTag({ state, apiKey });
        if (tagId) {
          await tagSubscriber({ tagId, email, apiKey });
          console.log(`[Subscribe] Tagged ${email} with state ${state}`);
        }
      } catch (tagError) {
        console.warn(`[Subscribe] State tagging failed for ${email}:`, tagError.message);
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to subscribe. Please try again later.',
      }),
    };
  }
};
