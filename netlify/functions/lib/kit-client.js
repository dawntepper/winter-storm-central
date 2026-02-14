/**
 * Kit (formerly ConvertKit) API v4 Client
 *
 * Handles authentication, rate limiting, and retry logic
 * for the Kit email marketing API.
 *
 * API docs: https://developers.kit.com/v4
 * Rate limit: 120 requests per rolling 60-second window
 */

const KIT_API_BASE = 'https://api.kit.com/v4';

// Rate limiting: 120 req/60s = 2 req/s max
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const REQUEST_SPACING_MS = 600; // ~1.6 req/s to stay safely under limit
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

let requestTimestamps = [];

/**
 * Wait if needed to respect rate limits
 */
async function waitForRateLimit() {
  const now = Date.now();
  // Remove timestamps older than the rate limit window
  requestTimestamps = requestTimestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW
  );

  if (requestTimestamps.length >= RATE_LIMIT_MAX - 5) {
    // Near the limit, wait until the oldest request falls out of the window
    const oldestInWindow = requestTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW - (now - oldestInWindow) + 100;
    console.log(`[Kit] Rate limit approaching, waiting ${waitTime}ms`);
    await sleep(waitTime);
  }

  // Add minimum spacing between requests
  const lastRequest = requestTimestamps[requestTimestamps.length - 1];
  if (lastRequest && now - lastRequest < REQUEST_SPACING_MS) {
    await sleep(REQUEST_SPACING_MS - (now - lastRequest));
  }

  requestTimestamps.push(Date.now());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get API key from environment
 */
function getApiKey() {
  const apiKey = process.env.CONVERTKIT_API_KEY || process.env.KIT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CONVERTKIT_API_KEY or KIT_API_KEY environment variable');
  }
  return apiKey;
}

/**
 * Make an authenticated request to the Kit API with retry logic
 */
async function kitRequest(method, path, body = null) {
  const apiKey = getApiKey();
  const url = `${KIT_API_BASE}${path}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitForRateLimit();

    try {
      const options = {
        method,
        headers: {
          'X-Kit-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      // Handle rate limiting response
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_BACKOFF_MS * attempt;
        console.warn(
          `[Kit] Rate limited (429), waiting ${waitTime}ms (attempt ${attempt}/${MAX_RETRIES})`
        );
        await sleep(waitTime);
        continue;
      }

      // Handle server errors with retry
      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const waitTime = RETRY_BACKOFF_MS * attempt;
          console.warn(
            `[Kit] Server error ${response.status}, retrying in ${waitTime}ms (attempt ${attempt}/${MAX_RETRIES})`
          );
          await sleep(waitTime);
          continue;
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Kit API error ${response.status}: ${errorBody}`
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (
        attempt < MAX_RETRIES &&
        (error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('fetch failed'))
      ) {
        const waitTime = RETRY_BACKOFF_MS * attempt;
        console.warn(
          `[Kit] Network error, retrying in ${waitTime}ms (attempt ${attempt}/${MAX_RETRIES}):`,
          error.message
        );
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Kit API request failed after ${MAX_RETRIES} attempts`);
}

// ============================================
// SUBSCRIBERS
// ============================================

/**
 * List subscribers with pagination
 * Supports filtering by status and sorting
 */
async function listSubscribers({ status = 'active', cursor = null, perPage = 500 } = {}) {
  let path = `/subscribers?status=${status}&per_page=${perPage}`;
  if (cursor) {
    path += `&after=${cursor}`;
  }
  return kitRequest('GET', path);
}

/**
 * Get all active subscribers with their custom fields (paginated)
 * Returns array of all subscribers
 */
async function getAllSubscribers() {
  const allSubscribers = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const response = await listSubscribers({ cursor, perPage: 500 });
    const subscribers = response.subscribers || [];
    allSubscribers.push(...subscribers);

    // Kit v4 uses cursor-based pagination
    if (response.pagination?.has_next_page && response.pagination?.end_cursor) {
      cursor = response.pagination.end_cursor;
    } else {
      hasMore = false;
    }

    console.log(`[Kit] Fetched ${allSubscribers.length} subscribers so far...`);
  }

  return allSubscribers;
}

/**
 * Find subscriber by email
 */
async function findSubscriberByEmail(email) {
  const response = await kitRequest(
    'GET',
    `/subscribers?email_address=${encodeURIComponent(email)}`
  );
  const subscribers = response.subscribers || [];
  return subscribers.length > 0 ? subscribers[0] : null;
}

// ============================================
// TAGS
// ============================================

/**
 * List all tags
 */
async function listTags() {
  return kitRequest('GET', '/tags');
}

/**
 * Create a tag
 */
async function createTag(name) {
  return kitRequest('POST', '/tags', { name });
}

/**
 * Tag a subscriber
 */
async function tagSubscriber(tagId, subscriberId) {
  return kitRequest('POST', `/tags/${tagId}/subscribers/${subscriberId}`);
}

/**
 * Remove a tag from a subscriber
 */
async function untagSubscriber(tagId, subscriberId) {
  return kitRequest('DELETE', `/tags/${tagId}/subscribers/${subscriberId}`);
}

/**
 * Get all tags for a subscriber
 */
async function getSubscriberTags(subscriberId) {
  const response = await kitRequest('GET', `/subscribers/${subscriberId}/tags`);
  return response.tags || [];
}

/**
 * List subscribers for a tag
 */
async function listSubscribersForTag(tagId, { cursor = null, perPage = 500 } = {}) {
  let path = `/tags/${tagId}/subscribers?per_page=${perPage}`;
  if (cursor) {
    path += `&after=${cursor}`;
  }
  return kitRequest('GET', path);
}

// ============================================
// BROADCASTS
// ============================================

/**
 * Create a broadcast (draft)
 *
 * @param {Object} options
 * @param {string} options.subject - Email subject line
 * @param {string} options.content - HTML content of the email
 * @param {string} [options.description] - Internal description
 * @param {string} [options.previewText] - Preview/preheader text
 * @param {Array} [options.subscriberFilter] - Filter to target specific subscribers
 */
async function createBroadcast({
  subject,
  content,
  description = '',
  previewText = '',
  subscriberFilter = null,
}) {
  const body = {
    subject,
    content,
    description,
    preview_text: previewText,
    public: false, // Don't publish to web
  };

  if (subscriberFilter) {
    body.subscriber_filter = subscriberFilter;
  }

  return kitRequest('POST', '/broadcasts', body);
}

/**
 * Create and schedule a broadcast for immediate send
 *
 * @param {Object} options - Same as createBroadcast, plus sendAt
 * @param {string} [options.sendAt] - ISO8601 time to send (defaults to now)
 */
async function createAndSendBroadcast({
  subject,
  content,
  description = '',
  previewText = '',
  subscriberFilter = null,
}) {
  const body = {
    subject,
    content,
    description,
    preview_text: previewText,
    public: false,
    // Schedule for ~2 minutes from now to allow Kit to process
    send_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  };

  if (subscriberFilter) {
    body.subscriber_filter = subscriberFilter;
  }

  return kitRequest('POST', '/broadcasts', body);
}

/**
 * Get a broadcast by ID
 */
async function getBroadcast(broadcastId) {
  return kitRequest('GET', `/broadcasts/${broadcastId}`);
}

/**
 * Delete a broadcast
 */
async function deleteBroadcast(broadcastId) {
  return kitRequest('DELETE', `/broadcasts/${broadcastId}`);
}

// ============================================
// ONE-OFF EMAILS (via targeted broadcast)
// ============================================

/**
 * Send a one-off email to a single subscriber via a targeted broadcast.
 * Kit doesn't have a transactional email API, so this creates a broadcast
 * filtered to one subscriber and schedules it for immediate send.
 *
 * @param {Object} options
 * @param {string} options.email - Subscriber email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.content - HTML email content
 * @param {string} [options.previewText] - Preview/preheader text
 */
async function sendOneOffEmail({ email, subject, content, previewText = '' }) {
  const subscriber = await findSubscriberByEmail(email);
  if (!subscriber?.id) {
    throw new Error(`Subscriber not found for email: ${email}`);
  }

  return kitRequest('POST', '/broadcasts', {
    subject,
    content,
    preview_text: previewText,
    public: false,
    subscriber_filter: [{ type: 'subscriber', id: subscriber.id }],
    send_at: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute from now
  });
}

// ============================================
// SEQUENCES
// ============================================

/**
 * Add a subscriber to a sequence by email.
 * This triggers Kit's sequence automation for the subscriber.
 *
 * @param {Object} options
 * @param {string} options.sequenceId - Kit sequence ID
 * @param {string} options.email - Subscriber email address
 */
async function addSubscriberToSequence({ sequenceId, email }) {
  return kitRequest('POST', `/sequences/${sequenceId}/subscribers`, {
    email_address: email,
  });
}

// ============================================
// CUSTOM FIELDS
// ============================================

/**
 * List custom fields
 */
async function listCustomFields() {
  return kitRequest('GET', '/custom_fields');
}

/**
 * Create a custom field
 */
async function createCustomField(label) {
  return kitRequest('POST', '/custom_fields', { label });
}

module.exports = {
  kitRequest,
  listSubscribers,
  getAllSubscribers,
  findSubscriberByEmail,
  listTags,
  createTag,
  tagSubscriber,
  untagSubscriber,
  getSubscriberTags,
  listSubscribersForTag,
  createBroadcast,
  createAndSendBroadcast,
  getBroadcast,
  deleteBroadcast,
  sendOneOffEmail,
  addSubscriberToSequence,
  listCustomFields,
  createCustomField,
};
