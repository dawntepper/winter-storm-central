/**
 * Weather Brief regeneration decision logic.
 */

import {
  BRIEF_MAX_AGE_ACTIVE_MS,
  BRIEF_MAX_AGE_INACTIVE_MS,
  COUNT_CHANGE_THRESHOLD,
} from './hazards.js';

function setsEqual(a = [], b = []) {
  const aa = new Set(a);
  const bb = new Set(b);
  if (aa.size !== bb.size) return false;
  for (const v of aa) {
    if (!bb.has(v)) return false;
  }
  return true;
}

/**
 * @returns {{ shouldRegenerate: boolean, reasons: string[] }}
 */
export function shouldRegenerateBrief({
  cachedBrief = null,
  currentSignature,
  currentActiveCount = 0,
  currentStateCodes = [],
  currentHighestSeverity = null,
  currentHighestUrgency = null,
  currentHasExtreme = false,
  force = false,
  now = Date.now(),
} = {}) {
  const reasons = [];

  if (force) {
    return { shouldRegenerate: true, reasons: ['manual_force'] };
  }

  if (!cachedBrief || !cachedBrief.summary) {
    return { shouldRegenerate: true, reasons: ['missing_summary'] };
  }

  if (cachedBrief.manual_override) {
    return { shouldRegenerate: false, reasons: ['manual_override'] };
  }

  if (cachedBrief.status === 'failed' || cachedBrief.status === 'stale') {
    reasons.push(`status_${cachedBrief.status}`);
  }

  const prevCount = cachedBrief.active_count ?? 0;
  if ((prevCount === 0) !== (currentActiveCount === 0)) {
    reasons.push(currentActiveCount > 0 ? 'zero_to_active' : 'active_to_zero');
  }

  const prevStates = cachedBrief.affected_state_codes || [];
  if (!setsEqual(prevStates, currentStateCodes)) {
    reasons.push('affected_states_changed');
  }

  // Severity / urgency / extreme — compare against signature pieces when stored
  if (cachedBrief.data_signature && currentSignature && cachedBrief.data_signature !== currentSignature) {
    // Decompose coarse reasons from signature mismatch beyond states/count
    const prevSev = /sev:([^|]*)/.exec(cachedBrief.data_signature)?.[1] || '';
    const prevUrg = /urg:([^|]*)/.exec(cachedBrief.data_signature)?.[1] || '';
    const prevExt = /ext:([^|]*)/.exec(cachedBrief.data_signature)?.[1] || '';
    if (prevSev !== (currentHighestSeverity || '')) reasons.push('highest_severity_changed');
    if (prevUrg !== (currentHighestUrgency || '')) reasons.push('highest_urgency_changed');
    if (prevExt !== (currentHasExtreme ? '1' : '0')) reasons.push('extreme_alert_changed');

    const prevIds = /ids:([^|]*)/.exec(cachedBrief.data_signature)?.[1] || '';
    const nextIds = /ids:([^|]*)/.exec(currentSignature)?.[1] || '';
    if (prevIds !== nextIds) reasons.push('source_alert_set_changed');
  }

  const countDelta = Math.abs(prevCount - currentActiveCount);
  if (countDelta >= COUNT_CHANGE_THRESHOLD) {
    reasons.push('count_threshold');
  }

  const generatedAt = cachedBrief.generated_at ? new Date(cachedBrief.generated_at).getTime() : 0;
  const maxAge = currentActiveCount > 0 ? BRIEF_MAX_AGE_ACTIVE_MS : BRIEF_MAX_AGE_INACTIVE_MS;
  if (!generatedAt || now - generatedAt > maxAge) {
    reasons.push('max_age_exceeded');
  }

  // Deduplicate reasons
  const unique = [...new Set(reasons)];
  // Age alone with identical signature should still regenerate
  const meaningful = unique.filter((r) => r !== 'status_stale' && r !== 'status_failed');
  if (unique.includes('status_failed')) {
    return { shouldRegenerate: true, reasons: unique };
  }

  return {
    shouldRegenerate: meaningful.length > 0,
    reasons: unique,
  };
}
