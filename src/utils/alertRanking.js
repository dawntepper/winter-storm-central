/**
 * Alert Ranking & Time Utilities
 * Scores, ranks, and computes time info for NWS alerts.
 */

const SEVERITY_SCORES = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
};

const URGENCY_SCORES = {
  Immediate: 4,
  Expected: 3,
  Future: 2,
  Past: 1,
  Unknown: 0,
};

/**
 * Format a duration in milliseconds to "XH YM" or "YM" format.
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0M';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}H ${minutes}M`;
  return `${minutes}M`;
}

/**
 * Get time progress and remaining info for an alert.
 * Returns { progress (0-1), remainingFormatted, totalFormatted, status }.
 */
export function getAlertTimeInfo(alert) {
  const now = Date.now();
  const onset = alert.onset ? new Date(alert.onset).getTime() : null;
  const expires = alert.expires ? new Date(alert.expires).getTime() : null;

  if (!onset || !expires) {
    return { progress: 0, remainingFormatted: 'N/A', totalFormatted: 'N/A', status: 'unknown' };
  }

  if (now >= expires) {
    return { progress: 1, remainingFormatted: 'EXPIRED', totalFormatted: formatDuration(expires - onset), status: 'expired' };
  }

  if (now < onset) {
    return { progress: 0, remainingFormatted: formatDuration(expires - now), totalFormatted: formatDuration(expires - onset), status: 'pending' };
  }

  const total = expires - onset;
  const elapsed = now - onset;
  const progress = Math.min(elapsed / total, 1);
  const remaining = expires - now;

  return {
    progress,
    remainingFormatted: formatDuration(remaining),
    totalFormatted: formatDuration(total),
    status: 'active',
  };
}

const RECENCY_MAX_BONUS = 30;       // Max bonus points for brand-new alerts
const RECENCY_FULL_WINDOW = 30;      // Minutes at full bonus
const RECENCY_DECAY_WINDOW = 120;    // Minutes over which bonus decays to 0
const NEW_THRESHOLD_MINUTES = 30;    // Onset within this = "NEW"

/**
 * Compute a recency bonus (0–30) based on how recently the alert started.
 * Full bonus for onset < 30 min ago, linear decay to 0 over 2 hours.
 */
function recencyBonus(alert, now) {
  if (!alert.onset) return 0;
  const onsetTime = new Date(alert.onset).getTime();
  const minutesAgo = (now - onsetTime) / 60000;
  if (minutesAgo < 0) return RECENCY_MAX_BONUS; // Future onset = treat as brand-new
  if (minutesAgo <= RECENCY_FULL_WINDOW) return RECENCY_MAX_BONUS;
  if (minutesAgo >= RECENCY_DECAY_WINDOW) return 0;
  // Linear decay from RECENCY_FULL_WINDOW to RECENCY_DECAY_WINDOW
  return Math.round(RECENCY_MAX_BONUS * (1 - (minutesAgo - RECENCY_FULL_WINDOW) / (RECENCY_DECAY_WINDOW - RECENCY_FULL_WINDOW)));
}

/**
 * Score a single alert for ranking.
 * Higher = more severe/urgent. Recency adds up to +30 within the same severity tier.
 */
function scoreAlert(alert, now) {
  const severity = SEVERITY_SCORES[alert.severity] || 0;
  const urgency = URGENCY_SCORES[alert.urgency] || 0;
  const areaCount = (alert.areaDesc || '').split(';').filter(Boolean).length;
  return (severity * 100) + (urgency * 10) + areaCount + recencyBonus(alert, now);
}

/**
 * Rank alerts by severity/urgency/area, filtering out expired.
 * Returns a new array sorted descending by score with `rank` added.
 */
export function rankAlerts(alerts) {
  if (!alerts || alerts.length === 0) return [];

  const now = Date.now();

  return alerts
    .filter((a) => {
      if (!a.expires) return true; // Keep alerts without expiry
      return new Date(a.expires).getTime() > now;
    })
    .map((a) => ({ ...a, _score: scoreAlert(a, now) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      // Tiebreak: more recent onset first
      const aOnset = a.onset ? new Date(a.onset).getTime() : 0;
      const bOnset = b.onset ? new Date(b.onset).getTime() : 0;
      if (bOnset !== aOnset) return bOnset - aOnset;
      // Final tiebreak: ID
      return (a.id || '').localeCompare(b.id || '');
    })
    .map((a, i) => {
      const { _score, ...rest } = a;
      const onsetTime = a.onset ? new Date(a.onset).getTime() : null;
      const minutesSinceOnset = onsetTime != null ? (now - onsetTime) / 60000 : null;
      const isNew = minutesSinceOnset != null && minutesSinceOnset >= 0 && minutesSinceOnset <= NEW_THRESHOLD_MINUTES;
      return { ...rest, rank: i + 1, isNew };
    });
}
