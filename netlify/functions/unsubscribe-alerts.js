/**
 * Unsubscribe Alerts — Netlify Function
 *
 * Removes a subscriber's location tags in Kit so they stop receiving
 * weather alert emails. Does NOT delete them from Kit entirely.
 *
 * GET  /api/unsubscribe-alerts?email=user@example.com → shows confirmation page
 * POST /api/unsubscribe-alerts { email } → processes unsubscribe
 */

const {
  findSubscriberByEmail,
  getSubscriberTags,
  untagSubscriber,
} = require('./lib/kit-client.js');

const SITE_URL = 'https://stormtracking.io';

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - StormTracking.io</title>
  <style>
    body { margin:0; padding:0; background:#0f172a; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { max-width:420px; width:90%; background:#1e293b; border:1px solid #334155; border-radius:12px; padding:32px; text-align:center; }
    h1 { font-size:20px; margin:0 0 8px; color:#f1f5f9; }
    p { font-size:14px; color:#94a3b8; line-height:1.6; margin:12px 0; }
    input[type="email"] { width:100%; padding:10px 14px; background:#0f172a; border:1px solid #475569; border-radius:8px; color:#e2e8f0; font-size:14px; margin:12px 0; box-sizing:border-box; }
    button { padding:10px 24px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; margin-top:8px; }
    button:hover { background:#1d4ed8; }
    a { color:#38bdf8; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .success { color:#34d399; }
    .error { color:#f87171; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // GET — show unsubscribe form
  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.rawQuery || '');
    const email = params.get('email') || '';

    const html = htmlPage('Unsubscribe', `
      <h1>Unsubscribe from Weather Alerts</h1>
      <p>Enter your email address to stop receiving weather alert emails.</p>
      <form method="POST" action="/api/unsubscribe-alerts">
        <input type="email" name="email" placeholder="your@email.com" value="${email.replace(/"/g, '&quot;')}" required />
        <br>
        <button type="submit">Unsubscribe</button>
      </form>
      <p><a href="${SITE_URL}">Back to StormTracking.io</a></p>
    `);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: html,
    };
  }

  // POST — process unsubscribe
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  let email;
  const contentType = event.headers?.['content-type'] || '';

  if (contentType.includes('application/json')) {
    try {
      const body = JSON.parse(event.body || '{}');
      email = body.email;
    } catch {
      email = null;
    }
  } else {
    // Form submission (application/x-www-form-urlencoded)
    const params = new URLSearchParams(event.body || '');
    email = params.get('email');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const html = htmlPage('Unsubscribe', `
      <h1>Invalid Email</h1>
      <p class="error">Please provide a valid email address.</p>
      <p><a href="/api/unsubscribe-alerts">Try again</a></p>
    `);
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: html,
    };
  }

  try {
    const prefix = process.env.KIT_STATE_TAG_PREFIX || 'location-';
    const subscriber = await findSubscriberByEmail(email);

    if (!subscriber?.id) {
      const html = htmlPage('Unsubscribe', `
        <h1>You're Not Subscribed</h1>
        <p>We couldn't find <strong>${email}</strong> in our alert subscribers.</p>
        <p><a href="${SITE_URL}">Back to StormTracking.io</a></p>
      `);
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: html,
      };
    }

    // Remove all location tags
    const tags = await getSubscriberTags(subscriber.id);
    let removedCount = 0;
    for (const tag of tags) {
      if (tag.name.toLowerCase().startsWith(prefix.toLowerCase())) {
        await untagSubscriber(tag.id, subscriber.id);
        removedCount++;
        console.log(`[Unsubscribe] Removed tag ${tag.name} from ${email}`);
      }
    }

    console.log(`[Unsubscribe] Removed ${removedCount} location tags from ${email}`);

    const html = htmlPage('Unsubscribed', `
      <h1 class="success">You've Been Unsubscribed</h1>
      <p>You will no longer receive weather alert emails at <strong>${email}</strong>.</p>
      <p>Changed your mind? You can <a href="${SITE_URL}">re-subscribe</a> anytime.</p>
    `);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: html,
    };
  } catch (error) {
    console.error('[Unsubscribe] Error:', error.message);
    const html = htmlPage('Error', `
      <h1>Something Went Wrong</h1>
      <p class="error">We couldn't process your request. Please try again later.</p>
      <p><a href="/api/unsubscribe-alerts">Try again</a></p>
    `);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: html,
    };
  }
};
