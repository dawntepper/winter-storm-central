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

const { getStateFromZip, countyTagFor } = require('./lib/alert-matcher.js');
const { getLocationFromZip } = require('./lib/zip-to-location.js');
const {
  kitRequest,
  findSubscriberByEmail,
  getSubscriberTags,
  listTags,
  createTag,
  tagSubscriber: kitTagSubscriber,
  untagSubscriber,
} = require('./lib/kit-client.js');
const { sendEmail } = require('./lib/resend-client.js');
const { buildWelcomeEmail, SITE_URL } = require('./lib/email-templates.js');

const HAS_COUNTY_INFO_TAG = 'has-county-info';

// Map signup-source → additional Kit tag applied alongside location tags.
// Lets us segment subscribers later by where they originally signed up
// without changing the alert delivery flow (all sources receive the same
// alert emails). Add new entries here when a new signup surface launches.
const SOURCE_TAGS = {
  prep: 'newsletter',   // /prep page inline form — these subscribers opted in
                        // partly with newsletter framing, so they get the
                        // 'newsletter' tag for future newsletter sends.
};

const KIT_FORM_ID = process.env.KIT_FORM_ID || '9086634';

/**
 * Create or update a subscriber with zip_code field via Kit v4 Subscribers API.
 */
async function createSubscriber({ email, zipCode }) {
  return kitRequest('POST', '/subscribers', {
    email_address: email,
    fields: {
      zip_code: zipCode,
    },
  });
}

/**
 * Add subscriber to Kit form so they appear in the form's subscriber list
 * and trigger any form-level automations.
 */
async function addSubscriberToForm({ email }) {
  return kitRequest('POST', `/forms/${KIT_FORM_ID}/subscribers`, {
    email_address: email,
  });
}

async function ensureStateTag({ state }) {
  const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
  const tagName = `${prefix}${state}`;
  return ensureTagByName(tagName);
}

async function ensureTagByName(tagName) {
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

  const { email, zip_code, source } = body;

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

    const fallbackState = getStateFromZip(zip_code);
    console.log(`[Subscribe] Zip-prefix fallback state for ${zip_code}: ${fallbackState || 'UNKNOWN'}`);
    const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';

    // Zip signups require county resolution. Silently tagging location-XX only
    // puts the subscriber on the statewide digest path (wrong counties).
    let location = null;
    try {
      location = await getLocationFromZip(zip_code);
      if (location) {
        console.log(`[Subscribe] Precise lookup: state=${location.state}, county=${location.county}, fips=${location.fips}`);
      } else {
        console.warn(`[Subscribe] Precise lookup returned null for ${zip_code} — refusing state-only signup`);
      }
    } catch (locError) {
      console.warn(`[Subscribe] Precise lookup threw:`, locError.message);
    }
    if (!location?.state || !location?.county) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'Could not resolve county for that ZIP code. Please try again in a moment.',
        }),
      };
    }
    const state = location.state;
    const countyName = location.county;
    const countyTagName = countyTagFor(state, countyName);
    if (!countyTagName) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: 'Could not resolve county for that ZIP code. Please try again in a moment.',
        }),
      };
    }
    // Keep zip-prefix as a sanity check when both resolve.
    if (fallbackState && fallbackState !== state) {
      console.warn(
        `[Subscribe] Zip-prefix state ${fallbackState} disagrees with FCC state ${state} for ${zip_code}; using FCC`
      );
    }

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
    const subscriberId = subscribeResult?.subscriber?.id;
    console.log(`[Subscribe] Subscribe result: id=${subscriberId}`, JSON.stringify(subscribeResult)?.substring(0, 500));

    // 2b. Add subscriber to Kit form
    try {
      console.log(`[Subscribe] Step 2b: Adding ${email} to Kit form ${KIT_FORM_ID}...`);
      const formResult = await addSubscriberToForm({ email });
      console.log(`[Subscribe] Form add result:`, JSON.stringify(formResult)?.substring(0, 500));
    } catch (formError) {
      console.warn(`[Subscribe] Adding to form failed for ${email}:`, formError.message);
    }

    // 3. Apply location tags (state + county + has-county-info). County was
    //    required above; if Kit county tagging fails we still have zip_code on
    //    the subscriber so the pipeline will refuse statewide fallback.
    //    Returning subscribers: strip old location-* / county-* first.
    try {
      if (isExistingSubscriber) {
        const existing = await findSubscriberByEmail(email);
        if (existing?.id) {
          const currentTags = await getSubscriberTags(existing.id);
          const newStateTag = `${prefix}${state}`.toLowerCase();
          const newCountyTag = countyTagName.toLowerCase();
          for (const tag of currentTags) {
            const tn = tag.name.toLowerCase();
            const isOldStateTag =
              tn.startsWith(prefix.toLowerCase()) && tn !== newStateTag;
            const isOldCountyTag =
              tn.startsWith('county-') && tn !== newCountyTag;
            if (isOldStateTag || isOldCountyTag) {
              await untagSubscriber(tag.id, existing.id);
              console.log(`[Subscribe] Removed old tag ${tag.name} from ${email}`);
            }
          }
        }
      }

      const stateTagId = await ensureStateTag({ state });
      if (stateTagId) {
        await tagSubscriberByEmail({ tagId: stateTagId, email });
        console.log(`[Subscribe] Tagged ${email} with state ${state}`);
      }

      try {
        const countyTagId = await ensureTagByName(countyTagName);
        if (countyTagId) {
          await tagSubscriberByEmail({ tagId: countyTagId, email });
          console.log(`[Subscribe] Tagged ${email} with ${countyTagName}`);
        }
        const sentinelId = await ensureTagByName(HAS_COUNTY_INFO_TAG);
        if (sentinelId) {
          await tagSubscriberByEmail({ tagId: sentinelId, email });
          console.log(`[Subscribe] Tagged ${email} with ${HAS_COUNTY_INFO_TAG}`);
        }
      } catch (countyTagError) {
        console.warn(`[Subscribe] County tagging failed for ${email}:`, countyTagError.message);
      }
    } catch (tagError) {
      console.warn(`[Subscribe] State tagging failed for ${email}:`, tagError.message);
    }

    // 3b. Apply source-specific tag (e.g. /prep signups → 'newsletter').
    // Best-effort: failures here don't block the subscription — the
    // subscriber is still on the alert list via location tags above.
    const sourceTag = source ? SOURCE_TAGS[source] : null;
    if (sourceTag) {
      try {
        const sourceTagId = await ensureTagByName(sourceTag);
        if (sourceTagId) {
          await tagSubscriberByEmail({ tagId: sourceTagId, email });
          console.log(`[Subscribe] Tagged ${email} with ${sourceTag} (source: ${source})`);
        }
      } catch (sourceTagError) {
        console.warn(`[Subscribe] Source tagging failed for ${email}:`, sourceTagError.message);
      }
    }

    // 4. Send welcome email via Resend — only for new subscribers
    console.log(`[Subscribe] Step 4: Welcome email decision — isExistingSubscriber: ${isExistingSubscriber}`);
    if (!isExistingSubscriber) {
      try {
        console.log(`[Subscribe] Sending welcome email via Resend to ${email}...`);
        const welcomeHtml = buildWelcomeEmail();
        await sendEmail({
          to: email,
          subject: '\u2705 You\'re signed up for weather alerts',
          html: welcomeHtml,
        });
        console.log(`[Subscribe] Welcome email sent via Resend to ${email}`);
      } catch (welcomeError) {
        // Don't fail the signup if welcome email fails
        console.error(`[Subscribe] !!! Welcome email FAILED for ${email}:`, welcomeError.message);
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
