/**
 * Threat Score Calculator
 * Computes a 0-100 national threat score from active NWS alerts.
 */

const SEVERITY_WEIGHTS = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 1,
};

const URGENCY_WEIGHTS = {
  Immediate: 4,
  Expected: 3,
  Future: 2,
  Past: 1,
  Unknown: 1,
};

const TOTAL_CATEGORIES = 6; // winter, severe, heat, flood, fire, tropical

/**
 * Calculate a 0-100 threat score from all active alerts.
 * @param {Array} allAlerts - Array of parsed alert objects
 * @returns {{ score: number, level: string, breakdown: { volume: number, severity: number, urgency: number, diversity: number } }}
 */
export function calculateThreatScore(allAlerts) {
  if (!allAlerts || allAlerts.length === 0) {
    return {
      score: 0,
      level: 'Low',
      breakdown: { volume: 0, severity: 0, urgency: 0, diversity: 0 },
    };
  }

  const count = allAlerts.length;

  // Volume: 0-25 based on alert count (logarithmic scale, reaches ~20 at 500)
  const volume = Math.min(Math.log(count + 1) / Math.log(601), 1) * 25;

  // Severity: 0-25 based on average severity weight
  const avgSeverity =
    allAlerts.reduce((sum, a) => sum + (SEVERITY_WEIGHTS[a.severity] || 1), 0) / count;
  const severity = ((avgSeverity - 1) / 3) * 25;

  // Urgency: 0-25 based on average urgency weight
  const avgUrgency =
    allAlerts.reduce((sum, a) => sum + (URGENCY_WEIGHTS[a.urgency] || 1), 0) / count;
  const urgency = ((avgUrgency - 1) / 3) * 25;

  // Category Diversity: 0-25 based on how many of the 6 categories have alerts
  const activeCategories = new Set(allAlerts.map((a) => a.category)).size;
  const diversity = (activeCategories / TOTAL_CATEGORIES) * 25;

  const score = Math.round(volume + severity + urgency + diversity);

  return {
    score: Math.min(score, 100),
    level: getLevel(score),
    breakdown: {
      volume: Math.round(volume),
      severity: Math.round(severity),
      urgency: Math.round(urgency),
      diversity: Math.round(diversity),
    },
  };
}

function getLevel(score) {
  if (score >= 80) return 'Extreme';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Elevated';
  if (score >= 20) return 'Moderate';
  return 'Low';
}

/**
 * Map a 0-100 score to a color on a green→red gradient.
 * @param {number} score
 * @returns {string} CSS color
 */
export function getScoreColor(score) {
  if (score >= 80) return '#ef4444'; // red
  if (score >= 60) return '#f97316'; // orange
  if (score >= 40) return '#eab308'; // yellow
  if (score >= 20) return '#84cc16'; // lime
  return '#22c55e'; // green
}
