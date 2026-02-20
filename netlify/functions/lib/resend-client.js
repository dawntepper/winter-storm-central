/**
 * Resend Email Client
 *
 * Sends weather alert emails via the Resend API.
 * Used as a replacement for Kit broadcast sending.
 *
 * Environment variables:
 *   RESEND_API_KEY - Resend API key (required)
 *   RESEND_FROM    - Sender address (default: StormTracking.io <alerts@stormtracking.io>)
 */

const { Resend } = require('resend');

const BATCH_SIZE = 100; // Resend batch limit

let resendClient = null;

function getResend() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Missing RESEND_API_KEY environment variable');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromAddress() {
  return process.env.RESEND_FROM || 'StormTracking.io <alerts@stormtracking.io>';
}

/**
 * Send a single email via Resend
 */
async function sendEmail({ to, subject, html }) {
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend send error: ${JSON.stringify(error)}`);
  }

  return data;
}

/**
 * Send emails in batches via Resend batch API.
 * Each email can have its own to/subject/html.
 *
 * @param {Array<{to: string, subject: string, html: string}>} emails
 * @returns {Object} { sent: number, messageIds: string[], errors: string[] }
 */
async function sendBatchEmails(emails) {
  const resend = getResend();
  const from = getFromAddress();

  let totalSent = 0;
  const allMessageIds = [];
  const allErrors = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE).map((e) => ({
      from,
      to: [e.to],
      subject: e.subject,
      html: e.html,
    }));

    try {
      const { data, error } = await resend.batch.send(batch);

      if (error) {
        allErrors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${JSON.stringify(error)}`);
        continue;
      }

      const ids = (data?.data || []).map((d) => d.id).filter(Boolean);
      allMessageIds.push(...ids);
      totalSent += batch.length;

      console.log(`[Resend] Batch ${Math.floor(i / BATCH_SIZE) + 1}: sent ${batch.length} emails`);
    } catch (err) {
      allErrors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${err.message}`);
      console.error(`[Resend] Batch error:`, err.message);
    }
  }

  return { sent: totalSent, messageIds: allMessageIds, errors: allErrors };
}

module.exports = { sendEmail, sendBatchEmails, getResend };
