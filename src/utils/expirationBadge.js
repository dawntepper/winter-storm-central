/**
 * Time-aware expiration badge formatter.
 *
 * Returns { label, urgency } for the small "Exp:" badge on alert tiles.
 * Pure function — no hooks, no Date.now() unless caller omits nowMs.
 * Components pair this with useMinuteTick so the relative-time labels
 * stay accurate as time passes ("in 25 min" → "in 24 min" etc.).
 *
 * Format rules (per spec):
 *   - Already expired:           "Expired"
 *   - Under 60 min from now:     "in 25 min"
 *   - Same day, ≥60 min away:    "9:45 PM"
 *   - Tomorrow:                  "Tomorrow 3:00 AM"
 *   - Later than tomorrow:       "May 28, 9:00 AM"
 *
 * Urgency tier (for color treatment):
 *   - expired:  "expired"
 *   - <30 min:  "urgent"
 *   - all else: "standard"
 *
 * Local timezone is used for all absolute time displays via toLocaleString.
 */

export function formatExpirationBadge(expiresAt, nowMs = Date.now()) {
  if (!expiresAt) {
    return { label: '', urgency: 'standard' };
  }

  const expiresMs = expiresAt instanceof Date
    ? expiresAt.getTime()
    : new Date(expiresAt).getTime();

  if (!Number.isFinite(expiresMs)) {
    return { label: '', urgency: 'standard' };
  }

  const minutesUntil = Math.round((expiresMs - nowMs) / 60000);

  if (minutesUntil <= 0) {
    return { label: 'Expired', urgency: 'expired' };
  }

  if (minutesUntil < 60) {
    return {
      label: `in ${minutesUntil} min`,
      urgency: minutesUntil < 30 ? 'urgent' : 'standard',
    };
  }

  const now = new Date(nowMs);
  const expires = new Date(expiresMs);
  const timeStr = expires.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Compare calendar days in local timezone.
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiresDay = new Date(expires.getFullYear(), expires.getMonth(), expires.getDate());
  const tomorrowDay = new Date(nowDay);
  tomorrowDay.setDate(tomorrowDay.getDate() + 1);

  if (expiresDay.getTime() === nowDay.getTime()) {
    return { label: timeStr, urgency: 'standard' };
  }

  if (expiresDay.getTime() === tomorrowDay.getTime()) {
    return { label: `Tomorrow ${timeStr}`, urgency: 'standard' };
  }

  const dateStr = expires.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return { label: `${dateStr}, ${timeStr}`, urgency: 'standard' };
}
