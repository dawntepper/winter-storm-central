/**
 * Test Alert Email — Netlify Function
 *
 * Sends a test weather alert email via Resend.
 * Useful for verifying email templates and Resend delivery.
 *
 * Invoke manually:
 *   netlify functions:invoke test-alert-email --payload '{"email":"you@example.com"}'
 *
 * Or via HTTP:
 *   POST /api/test-alert-email
 *   Authorization: Bearer <ALERT_PROCESS_SECRET>
 *   Body: { "email": "you@example.com", "type": "alert" | "welcome" }
 */

const { sendEmail } = require('./lib/resend-client.js');
const {
  buildAlertEmail,
  buildAlertSubject,
  buildWelcomeEmail,
} = require('./lib/email-templates.js');

// Sample alert data for testing
const SAMPLE_ALERTS = [
  {
    id: 'test-alert-1',
    event: 'Winter Storm Warning',
    category: 'winter',
    state: 'NY',
    location: 'New York, NY',
    lat: 40.7128,
    lon: -74.006,
    headline: 'Winter Storm Warning issued for the New York metropolitan area',
    description:
      'Heavy snow expected. Total snow accumulations of 8 to 14 inches. ' +
      'Winds gusting as high as 45 mph. Travel could be very difficult to impossible.',
    severity: 'Severe',
    urgency: 'Expected',
    onset: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    areaDesc: 'New York; Kings; Queens; Bronx; Richmond',
  },
  {
    id: 'test-alert-2',
    event: 'Wind Chill Advisory',
    category: 'winter',
    state: 'NY',
    location: 'Albany, NY',
    lat: 42.6526,
    lon: -73.7562,
    headline: 'Wind Chill Advisory for upstate New York',
    description:
      'Very cold wind chills expected. Wind chills as low as 25 below zero. ' +
      'Frostbite possible on exposed skin in as little as 30 minutes.',
    severity: 'Moderate',
    urgency: 'Expected',
    onset: new Date().toISOString(),
    expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    areaDesc: 'Albany; Saratoga; Rensselaer',
  },
];

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Auth check
  const authHeader = event.headers?.authorization;
  const expectedToken = process.env.ALERT_PROCESS_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing RESEND_API_KEY' }),
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

  const { email, type = 'alert' } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Valid email required',
        usage: 'POST with {"email": "you@example.com", "type": "alert" | "welcome"}',
      }),
    };
  }

  try {
    let subject, html;

    if (type === 'welcome') {
      subject = '\u2705 You\'re signed up for weather alerts';
      html = buildWelcomeEmail();
    } else {
      subject = buildAlertSubject({ stateName: 'New York', alerts: SAMPLE_ALERTS });
      html = buildAlertEmail({
        stateName: 'New York',
        stateAbbr: 'NY',
        alerts: SAMPLE_ALERTS,
      });
    }

    console.log(`[Test] Sending ${type} email to ${email}...`);
    const result = await sendEmail({ to: email, subject, html });
    console.log(`[Test] Sent! Message ID: ${result?.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        type,
        to: email,
        subject,
        messageId: result?.id,
      }),
    };
  } catch (error) {
    console.error('[Test] Send failed:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
