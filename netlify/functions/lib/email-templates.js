/**
 * Email Template Builder for Weather Alert Broadcasts
 *
 * Generates HTML email content for Kit broadcasts.
 * Kit handles unsubscribe links automatically.
 */

const SITE_URL = 'https://stormtracking.io';

// Severity → color mapping
const SEVERITY_COLORS = {
  Extreme: '#dc2626',   // red-600
  Severe: '#ea580c',    // orange-600
  Moderate: '#ca8a04',  // yellow-600
  Minor: '#2563eb',     // blue-600
  Unknown: '#6b7280',   // gray-500
};

// Alert category → emoji + color
const CATEGORY_STYLES = {
  winter: { emoji: '\u2744\uFE0F', color: '#3b82f6', label: 'Winter Weather' },
  severe: { emoji: '\u26C8\uFE0F', color: '#ef4444', label: 'Severe Storm' },
  heat: { emoji: '\uD83C\uDF21\uFE0F', color: '#f97316', label: 'Extreme Heat' },
  flood: { emoji: '\uD83C\uDF0A', color: '#a855f7', label: 'Flooding' },
  fire: { emoji: '\uD83D\uDD25', color: '#92400e', label: 'Fire Weather' },
  tropical: { emoji: '\uD83C\uDF00', color: '#1e3a8a', label: 'Tropical' },
};

/**
 * Format a date for display in emails
 */
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

/**
 * Generate the map link for a specific alert location
 */
function getMapLink(alert) {
  if (alert.lat && alert.lon) {
    return `${SITE_URL}?lat=${alert.lat}&lon=${alert.lon}&zoom=8`;
  }
  if (alert.state) {
    return `${SITE_URL}/alerts/${alert.state.toLowerCase()}`;
  }
  return `${SITE_URL}/alerts`;
}

/**
 * Build HTML for a single alert card within an email
 */
function buildAlertCard(alert) {
  const category = CATEGORY_STYLES[alert.category] || CATEGORY_STYLES.winter;
  const severityColor = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.Unknown;
  const mapLink = getMapLink(alert);

  // Truncate description for email
  const description = alert.description
    ? alert.description.substring(0, 300) + (alert.description.length > 300 ? '...' : '')
    : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-left:4px solid ${category.color};border-radius:8px;padding:20px;">
          <!-- Alert header -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-bottom:8px;">
                <span style="font-size:12px;font-weight:600;color:#ffffff;background:${severityColor};padding:3px 10px;border-radius:12px;text-transform:uppercase;letter-spacing:0.5px;">
                  ${alert.severity || 'Alert'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:4px;">
                <span style="font-size:18px;font-weight:700;color:#111827;line-height:1.3;">
                  ${category.emoji} ${alert.event || 'Weather Alert'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <span style="font-size:14px;color:#6b7280;">
                  ${alert.location || 'Unknown Location'}
                </span>
              </td>
            </tr>
          </table>

          <!-- Timing -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
            <tr>
              <td style="background:#f9fafb;border-radius:6px;padding:12px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px;color:#4b5563;padding-bottom:4px;">
                      <strong>Effective:</strong> ${formatDate(alert.onset)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;color:#4b5563;">
                      <strong>Expires:</strong> ${formatDate(alert.expires)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Description -->
          ${description ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.5;">
                ${description}
              </td>
            </tr>
          </table>
          ` : ''}

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:${category.color};border-radius:6px;">
                <a href="${mapLink}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                  View on Map &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Build the full email HTML for a weather alert broadcast
 *
 * @param {Object} options
 * @param {string} options.stateName - Full state name (e.g., "New York")
 * @param {string} options.stateAbbr - State abbreviation (e.g., "NY")
 * @param {Array} options.alerts - Array of parsed alert objects
 * @returns {string} HTML email content
 */
function buildAlertEmail({ stateName, stateAbbr, alerts }) {
  const alertCount = alerts.length;
  const alertCards = alerts.map(buildAlertCard).join('\n');
  const stateAlertsUrl = `${SITE_URL}/alerts/${stateName.toLowerCase().replace(/\s+/g, '-')}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weather Alert for ${stateName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);background-color:#1e3a5f;border-radius:12px 12px 0 0;padding:32px 24px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                      StormTracking.io
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-size:13px;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;">
                      Weather Alert Notification
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:8px 20px;">
                          <span style="font-size:15px;color:#ffffff;font-weight:600;">
                            ${alertCount} Active Alert${alertCount !== 1 ? 's' : ''} in ${stateName}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#f9fafb;padding:24px;">

              <!-- Intro -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="font-size:15px;color:#374151;line-height:1.6;">
                    The National Weather Service has issued ${alertCount === 1 ? 'a new alert' : 'new alerts'} affecting your area in <strong>${stateName}</strong>. Please review the details below and take appropriate precautions.
                  </td>
                </tr>
              </table>

              <!-- Alert Cards -->
              ${alertCards}

              <!-- View All CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#1e3a5f;border-radius:8px;">
                          <a href="${stateAlertsUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                            View All ${stateName} Alerts
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:24px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#9ca3af;line-height:1.5;padding-bottom:8px;">
                    Data sourced from the
                    <a href="https://www.weather.gov/" style="color:#2563eb;text-decoration:none;">National Weather Service</a>.
                    Always follow official guidance from local authorities.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:12px;color:#9ca3af;line-height:1.5;padding-bottom:8px;">
                    You received this because you subscribed to weather alerts for ${stateAbbr} on
                    <a href="${SITE_URL}" style="color:#2563eb;text-decoration:none;">StormTracking.io</a>.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:11px;color:#d1d5db;">
                    &copy; ${new Date().getFullYear()} StormTracking.io
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate the email subject line for a weather alert broadcast
 */
function buildAlertSubject({ stateName, alerts }) {
  if (alerts.length === 1) {
    const alert = alerts[0];
    return `${alert.severity === 'Extreme' ? 'URGENT: ' : ''}${alert.event} - ${stateName}`;
  }

  // Multiple alerts — summarize
  const hasExtreme = alerts.some((a) => a.severity === 'Extreme');
  const uniqueTypes = [...new Set(alerts.map((a) => a.event))];

  if (uniqueTypes.length <= 2) {
    return `${hasExtreme ? 'URGENT: ' : ''}${uniqueTypes.join(' & ')} - ${stateName}`;
  }

  return `${hasExtreme ? 'URGENT: ' : ''}${alerts.length} Weather Alerts for ${stateName}`;
}

/**
 * Generate preview text for the email
 */
function buildPreviewText({ stateName, alerts }) {
  if (alerts.length === 1) {
    const alert = alerts[0];
    return `${alert.event} affecting ${alert.location}. Valid ${formatDate(alert.onset)} through ${formatDate(alert.expires)}.`;
  }
  const types = [...new Set(alerts.map((a) => a.event))];
  return `${alerts.length} active alerts in ${stateName}: ${types.slice(0, 3).join(', ')}${types.length > 3 ? '...' : ''}`;
}

module.exports = {
  buildAlertEmail,
  buildAlertSubject,
  buildPreviewText,
  buildAlertCard,
  SITE_URL,
};
