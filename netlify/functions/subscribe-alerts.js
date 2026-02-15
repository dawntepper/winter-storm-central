/**
 * Subscribe Alerts — Netlify Function
 *
 * Handles email signups for weather alerts via Kit (ConvertKit) v4 API.
 * Creates subscriber with zip_code custom field, then tags
 * them by state for targeted broadcasts.
 *
 * POST /api/subscribe-alerts
 * Body: { email: string, zip_code: string }
 */

const { getStateFromZip } = require('./lib/alert-matcher.js');
const {
  kitRequest,
  findSubscriberByEmail,
  getSubscriberTags,
  listTags,
  createTag,
  tagSubscriber: kitTagSubscriber,
  untagSubscriber,
  sendOneOffEmail,
} = require('./lib/kit-client.js');
const { buildWelcomeEmail } = require('./lib/email-templates.js');

/**
 * Create or update a subscriber with zip_code field via Kit v4 Subscribers API.
 * Uses the direct subscribers endpoint (API-key auth) instead of the forms
 * endpoint (which requires OAuth).
 */
async function createSubscriber({ email, zipCode }) {
  return kitRequest('POST', '/subscribers', {
    email_address: email,
    fields: {
      zip_code: zipCode,
    },
  });
}

async function ensureStateTag({ state }) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const tagName = `${prefix}${state}`;

  const data = await listTags();
  const existingTag = (data.tags || []).find(
    (t) => t.name.toLowerCase() === tagName.toLowerCase()
  );

  if (existingTag) return existingTag.id;

  const created = await createTag(tagName);
  return created?.tag?.id || null;
}

async function tagSubscriberByEmail({ tagId, email }) {
  const subscriber = await findSubscriberByEmail(email);
  if (!subscriber?.id) return;
  await kitTagSubscriber(tagId, subscriber.id);
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
    console.log(`[Subscribe] === START subscribe flow for ${email}, zip: ${zip_code} ===`);

    const state = getStateFromZip(zip_code);
    console.log(`[Subscribe] Resolved zip ${zip_code} -> state: ${state || 'UNKNOWN'}`);
    const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';

    // 1. Check if subscriber already exists BEFORE creating
    let isExistingSubscriber = false;
    try {
      console.log(`[Subscribe] Step 1: Checking if ${email} already exists in Kit...`);
      const existing = await findSubscriberByEmail(email);
      if (existing?.id) {
        isExistingSubscriber = true;
        console.log(`[Subscribe] Existing subscriber found: ID=${existing.id}, state=${existing.state}`);
      } else {
        console.log(`[Subscribe] No existing subscriber found — this is a NEW signup`);
      }
    } catch (lookupError) {
      console.warn(`[Subscribe] Pre-check lookup failed for ${email}:`, lookupError.message);
    }

    // 2. Create/update subscriber with zip_code field
    console.log(`[Subscribe] Step 2: Creating/updating subscriber ${email}...`);
    const subscribeResult = await createSubscriber({ email, zipCode: zip_code });
    console.log(`[Subscribe] Subscribe result:`, JSON.stringify(subscribeResult)?.substring(0, 500));

    // 3. Handle state tagging (and clean up old tags for returning subscribers)
    if (state) {
      try {
        if (isExistingSubscriber) {
          const existing = await findSubscriberByEmail(email);
          if (existing?.id) {
            // Remove old location tags if this is a re-subscribe with a new zip
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
        }

        const tagId = await ensureStateTag({ state });
        if (tagId) {
          await tagSubscriberByEmail({ tagId, email });
          console.log(`[Subscribe] Tagged ${email} with state ${state}`);
        }
      } catch (tagError) {
        console.warn(`[Subscribe] State tagging failed for ${email}:`, tagError.message);
      }
    }

    // 4. Send welcome email — only for new subscribers (single one-off broadcast)
    console.log(`[Subscribe] Step 4: Welcome email decision — isExistingSubscriber: ${isExistingSubscriber}`);
    if (!isExistingSubscriber) {
      try {
        console.log(`[Subscribe] Sending welcome email to ${email}...`);
        const welcomeResult = await sendOneOffEmail({
          email,
          subject: 'Welcome to StormTracking.io — You\'re signed up for weather alerts',
          content: buildWelcomeEmail(),
          previewText: 'You\'ll receive email alerts when severe weather is detected in your area.',
        });
        console.log(`[Subscribe] Welcome email broadcast result:`, JSON.stringify(welcomeResult)?.substring(0, 500));
        console.log(`[Subscribe] Welcome email SENT successfully to ${email}`);
      } catch (welcomeError) {
        console.error(`[Subscribe] !!! Welcome email FAILED for ${email}:`, welcomeError.message);
        console.error(`[Subscribe] Welcome email error stack:`, welcomeError.stack);
      }
    } else {
      console.log(`[Subscribe] Skipping welcome email — returning subscriber ${email}`);
    }

    console.log(`[Subscribe] === COMPLETE subscribe flow for ${email} ===`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully subscribed to weather alerts',
      }),
    };
  } catch (error) {
    console.error(`[Subscribe] === FAILED subscribe flow ===`);
    console.error('[Subscribe] Error:', error.message);
    console.error('[Subscribe] Stack:', error.stack);
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
