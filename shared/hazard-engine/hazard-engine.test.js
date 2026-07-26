import { describe, expect, it } from 'vitest';
import {
  hazardEngine,
  get,
  buildStateSituationSummary,
} from './index.js';
import { getHazardConfig, labelForCount, resolveDisplayLabels, pluralizeNwsEvent } from './hazards.js';
import {
  matchesHazardEvent,
  dedupeAlertsById,
  filterAlertsForHazard,
  buildAffectedStates,
  extractAffectedStateCodes,
  isAlertExpired,
} from './normalize.js';
import { buildFallbackBrief } from './fallbackBrief.js';
import { buildDataSignature } from './dataSignature.js';
import { shouldRegenerateBrief } from './regeneration.js';
import { validateBriefResponse } from './validateBrief.js';
import { buildLiveStatus } from './liveStatus.js';

const tornadoConfig = getHazardConfig('tornado-warning');

function alert(overrides = {}) {
  return {
    id: 'nws-1',
    event: 'Tornado Warning',
    state: 'KY',
    areaDesc: 'Floyd, KY; Pike, KY',
    severity: 'Extreme',
    urgency: 'Immediate',
    certainty: 'Observed',
    onset: '2026-07-24T12:00:00Z',
    expires: '2099-07-24T18:00:00Z',
    headline: 'Tornado Warning for Floyd',
    ...overrides,
  };
}

describe('hazard config', () => {
  it('looks up known hazards', () => {
    expect(tornadoConfig.nwsEvents).toEqual(['Tornado Warning']);
    expect(tornadoConfig.pageTitle).toBe('Tornado Warnings Today');
  });

  it('returns null for unknown slugs', () => {
    expect(getHazardConfig('not-a-hazard')).toBeNull();
    expect(get('not-a-hazard', []).ok).toBe(false);
  });

  it('singular/plural labels', () => {
    expect(labelForCount(tornadoConfig, 1)).toBe('Tornado Warning');
    expect(labelForCount(tornadoConfig, 12)).toBe('Tornado Warnings');
  });
});

describe('exact NWS event matching', () => {
  it('matches exact event only', () => {
    expect(matchesHazardEvent(alert(), tornadoConfig)).toBe(true);
    expect(matchesHazardEvent(alert({ event: 'Tornado Watch' }), tornadoConfig)).toBe(false);
    expect(matchesHazardEvent(alert({ event: 'Severe Thunderstorm Warning' }), tornadoConfig)).toBe(false);
  });

  it('matches both Excessive and Extreme Heat Warning on the heat hazard page', () => {
    const heatConfig = getHazardConfig('excessive-heat-warning');
    expect(heatConfig.nwsEvents).toEqual([
      'Extreme Heat Warning',
      'Excessive Heat Warning',
    ]);
    expect(heatConfig.singularLabel).toBe('Extreme Heat Warning');
    expect(heatConfig.pluralLabel).toBe('Extreme Heat Warnings');
    expect(matchesHazardEvent(alert({ event: 'Excessive Heat Warning' }), heatConfig)).toBe(true);
    expect(matchesHazardEvent(alert({ event: 'Extreme Heat Warning' }), heatConfig)).toBe(true);
    // Advisories and watches are separate products — do not group onto this page
    expect(matchesHazardEvent(alert({ event: 'Heat Advisory' }), heatConfig)).toBe(false);
    expect(matchesHazardEvent(alert({ event: 'Extreme Heat Watch' }), heatConfig)).toBe(false);
    expect(matchesHazardEvent(alert({ event: 'Excessive Heat Watch' }), heatConfig)).toBe(false);
  });

  it('counts Extreme Heat Warnings in the heat hazard snapshot', () => {
    const snap = hazardEngine.get(
      'excessive-heat-warning',
      [
        alert({ id: 'eh-1', event: 'Extreme Heat Warning', state: 'MT', areaDesc: 'Cascade, MT' }),
        alert({ id: 'eh-2', event: 'Extreme Heat Warning', state: 'AZ', areaDesc: 'Maricopa, AZ' }),
        alert({ id: 'adv-1', event: 'Heat Advisory', state: 'TX', areaDesc: 'Travis, TX' }),
      ],
      { dataAvailable: true }
    );
    expect(snap.ok).toBe(true);
    expect(snap.activeCount).toBe(2);
    expect(snap.alerts.every((a) => a.event === 'Extreme Heat Warning')).toBe(true);
  });

  it('builds non-empty live status for Extreme Heat Warning alerts', () => {
    const snap = hazardEngine.get(
      'excessive-heat-warning',
      [
        alert({ id: 'eh-1', event: 'Extreme Heat Warning', state: 'AZ', areaDesc: 'Maricopa, AZ' }),
        alert({ id: 'eh-2', event: 'Extreme Heat Warning', state: 'IA', areaDesc: 'Polk, IA' }),
      ],
      { dataAvailable: true }
    );
    expect(snap.liveStatus.hasActiveAlerts).toBe(true);
    expect(snap.liveStatus.statusHeadline).toBe('Active Extreme Heat Warnings: 2');
    expect(snap.liveStatus.situationSummary).toMatch(/Extreme Heat Warnings are currently active/i);
    expect(snap.liveStatus.situationSummary).not.toMatch(/no active/i);
    expect(snap.liveStatus.monitoringNote).toBeNull();
  });

  it('shows empty live status only when Extreme and Excessive Heat Warning counts are both zero', () => {
    const heatOnlyAdvisory = hazardEngine.get(
      'excessive-heat-warning',
      [alert({ id: 'adv-1', event: 'Heat Advisory', state: 'TX', areaDesc: 'Travis, TX' })],
      { dataAvailable: true }
    );
    expect(heatOnlyAdvisory.activeCount).toBe(0);
    expect(heatOnlyAdvisory.liveStatus.hasActiveAlerts).toBe(false);
    expect(heatOnlyAdvisory.liveStatus.statusHeadline).toBe('No Active Extreme Heat Warnings');
    expect(heatOnlyAdvisory.liveStatus.situationSummary).toMatch(
      /no active Extreme Heat Warnings or Excessive Heat Warnings/i
    );

    const excessiveOnly = hazardEngine.get(
      'excessive-heat-warning',
      [alert({ id: 'ex-1', event: 'Excessive Heat Warning', state: 'CA', areaDesc: 'Riverside, CA' })],
      { dataAvailable: true }
    );
    expect(excessiveOnly.activeCount).toBe(1);
    expect(excessiveOnly.liveStatus.hasActiveAlerts).toBe(true);
    expect(excessiveOnly.liveStatus.statusHeadline).toBe('Active Excessive Heat Warnings: 1');

    const both = hazardEngine.get(
      'excessive-heat-warning',
      [
        alert({ id: 'eh-1', event: 'Extreme Heat Warning', state: 'AZ', areaDesc: 'Maricopa, AZ' }),
        alert({ id: 'ex-1', event: 'Excessive Heat Warning', state: 'CA', areaDesc: 'Riverside, CA' }),
      ],
      { dataAvailable: true }
    );
    expect(both.activeCount).toBe(2);
    expect(both.liveStatus.hasActiveAlerts).toBe(true);
    // Both products active → configured covering label (Extreme Heat)
    expect(both.liveStatus.statusHeadline).toBe('Active Extreme Heat Warnings: 2');
  });

  it('resolves display labels from the active heat product', () => {
    const heatConfig = getHazardConfig('excessive-heat-warning');
    expect(pluralizeNwsEvent('Extreme Heat Warning')).toBe('Extreme Heat Warnings');
    expect(resolveDisplayLabels(heatConfig, [
      alert({ event: 'Extreme Heat Warning' }),
    ]).pluralLabel).toBe('Extreme Heat Warnings');
    expect(resolveDisplayLabels(heatConfig, [
      alert({ event: 'Excessive Heat Warning' }),
    ]).pluralLabel).toBe('Excessive Heat Warnings');
    expect(resolveDisplayLabels(heatConfig, []).pluralLabel).toBe('Extreme Heat Warnings');
  });
});

describe('dedupe + active filter', () => {
  it('dedupes by id keeping newest', () => {
    const a = alert({ id: 'same', onset: '2026-07-24T10:00:00Z' });
    const b = alert({ id: 'same', onset: '2026-07-24T12:00:00Z', headline: 'Updated' });
    const out = dedupeAlertsById([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe('Updated');
  });

  it('drops expired alerts', () => {
    expect(isAlertExpired(alert({ expires: '2020-01-01T00:00:00Z' }))).toBe(true);
    const filtered = filterAlertsForHazard(
      [alert({ expires: '2020-01-01T00:00:00Z' }), alert({ id: 'nws-2' })],
      tornadoConfig
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('nws-2');
  });
});

describe('state extraction + sorting', () => {
  it('extracts multiple states from areaDesc', () => {
    const codes = extractAffectedStateCodes(alert({
      state: 'KY',
      areaDesc: 'Floyd, KY; Mingo, WV; Fayette, PA',
    }));
    expect(codes.sort()).toEqual(['KY', 'PA', 'WV']);
  });

  it('sorts states by count then name', () => {
    const alerts = [
      alert({ id: '1', state: 'WV', areaDesc: 'Mingo, WV' }),
      alert({ id: '2', state: 'KY', areaDesc: 'Floyd, KY' }),
      alert({ id: '3', state: 'KY', areaDesc: 'Pike, KY' }),
      alert({ id: '4', state: 'PA', areaDesc: 'Fayette, PA' }),
      alert({ id: '5', state: 'KY', areaDesc: 'Knott, KY' }),
    ];
    const states = buildAffectedStates(alerts);
    expect(states.map((s) => s.code)).toEqual(['KY', 'PA', 'WV']);
    expect(states[0].alertCount).toBe(3);
    expect(states[0].href).toBe('/alerts/kentucky');
  });
});

describe('live status + fallback brief', () => {
  it('builds active status sentence', () => {
    const states = buildAffectedStates([
      alert({ id: '1', areaDesc: 'Floyd, KY' }),
      alert({ id: '2', areaDesc: 'Mingo, WV' }),
      alert({ id: '3', areaDesc: 'Fayette, PA' }),
    ]);
    const status = buildLiveStatus(tornadoConfig, { activeCount: 12, affectedStates: states });
    expect(status.hasActiveAlerts).toBe(true);
    expect(status.statusHeadline).toBe('Active Tornado Warnings: 12');
    expect(status.statusSentence).toContain('Kentucky');
  });

  it('builds zero-active status', () => {
    const status = buildLiveStatus(tornadoConfig, { activeCount: 0, affectedStates: [] });
    expect(status.statusHeadline).toBe('No Active Tornado Warnings');
    expect(status.heading).toBe('Current Situation');
    expect(status.monitoringNote).toMatch(/monitor/i);
  });

  it('builds distribution-aware situation summary', () => {
    const status = buildLiveStatus(tornadoConfig, {
      activeCount: 7,
      affectedStates: [
        { name: 'Texas', code: 'TX', alertCount: 5 },
        { name: 'Georgia', code: 'GA', alertCount: 1 },
        { name: 'Kansas', code: 'KS', alertCount: 1 },
      ],
    });
    expect(status.situationSummary).toContain('Texas accounting for 5 of the 7');
    expect(status.situationSummary).toMatch(/Georgia and Kansas each have one/i);
  });

  it('fallback briefs are grammatical', () => {
    const multi = buildFallbackBrief(tornadoConfig, {
      activeCount: 12,
      affectedStates: [
        { name: 'Kentucky', alertCount: 7 },
        { name: 'West Virginia', alertCount: 3 },
        { name: 'Pennsylvania', alertCount: 2 },
      ],
    });
    expect(multi.summary).toContain('3 states');
    expect(multi.summary).toContain('Kentucky');

    const one = buildFallbackBrief(tornadoConfig, {
      activeCount: 1,
      affectedStates: [{ name: 'Illinois', alertCount: 1 }],
    });
    expect(one.summary).toContain('Illinois');

    const zero = buildFallbackBrief(tornadoConfig, { activeCount: 0, affectedStates: [] });
    expect(zero.summary).toContain('No tornado warnings');
  });
});

describe('data signature + regeneration', () => {
  it('changes signature when states change', () => {
    const a = buildDataSignature({
      hazardSlug: 'tornado-warning',
      activeCount: 2,
      affectedStateCodes: ['KY', 'WV'],
      sourceAlertIds: ['1', '2'],
      highestSeverity: 'Extreme',
      highestUrgency: 'Immediate',
      hasExtremeAlert: true,
    });
    const b = buildDataSignature({
      hazardSlug: 'tornado-warning',
      activeCount: 2,
      affectedStateCodes: ['KY', 'PA'],
      sourceAlertIds: ['1', '2'],
      highestSeverity: 'Extreme',
      highestUrgency: 'Immediate',
      hasExtremeAlert: true,
    });
    expect(a).not.toBe(b);
  });

  it('regenerates on zero-to-active and respects manual override', () => {
    const active = shouldRegenerateBrief({
      cachedBrief: {
        summary: 'old',
        active_count: 0,
        affected_state_codes: [],
        data_signature: 'x',
        generated_at: new Date().toISOString(),
        status: 'valid',
      },
      currentSignature: 'y',
      currentActiveCount: 5,
      currentStateCodes: ['KY'],
    });
    expect(active.shouldRegenerate).toBe(true);
    expect(active.reasons).toContain('zero_to_active');

    const locked = shouldRegenerateBrief({
      cachedBrief: {
        summary: 'ai',
        manual_override: true,
        manual_summary: 'editor',
        active_count: 5,
        affected_state_codes: ['KY'],
        generated_at: new Date().toISOString(),
        status: 'valid',
      },
      currentSignature: 'changed',
      currentActiveCount: 8,
      currentStateCodes: ['KY', 'WV'],
    });
    expect(locked.shouldRegenerate).toBe(false);
  });
});

describe('Claude validation', () => {
  it('accepts clean JSON', () => {
    const result = validateBriefResponse(
      {
        summary: 'Tornado warnings remain active across eastern Kentucky and portions of West Virginia.',
        notableChange: null,
        confidenceNotes: [],
      },
      { affectedStateNames: ['Kentucky', 'West Virginia'], activeCount: 5 }
    );
    expect(result.ok).toBe(true);
  });

  it('rejects unsupported states and URLs', () => {
    const badState = validateBriefResponse(
      { summary: 'Warnings are active in Texas and Alaska.', notableChange: null, confidenceNotes: [] },
      { affectedStateNames: ['Kentucky'], activeCount: 2 }
    );
    expect(badState.ok).toBe(false);

    const badUrl = validateBriefResponse(
      { summary: 'See https://example.com for details.', notableChange: null, confidenceNotes: [] },
      { affectedStateNames: ['Kentucky'], activeCount: 1 }
    );
    expect(badUrl.ok).toBe(false);
  });
});

describe('hazardEngine.get snapshot', () => {
  it('returns a normalized intelligence object', () => {
    const alerts = [
      alert({ id: '1', areaDesc: 'Floyd, KY' }),
      alert({ id: '2', areaDesc: 'Mingo, WV' }),
      alert({ id: '3', areaDesc: 'Fayette, PA' }),
      alert({ id: 'dup', event: 'Tornado Watch' }),
    ];
    const snap = hazardEngine.get('tornado-warning', alerts, {
      latestSourceUpdateAt: '2026-07-24T12:05:00Z',
    });
    expect(snap.ok).toBe(true);
    expect(snap.activeCount).toBe(3);
    expect(snap.radarFilter).toBe('tornado-warning');
    expect(snap.liveStatus.statusHeadline).toBe('Active Tornado Warnings: 3');
    expect(snap.weatherBrief.source).toBe('fallback');
    expect(snap.affectedStates).toHaveLength(3);
    expect(snap.relatedHazards.some((r) => r.slug === 'tornado-watch')).toBe(true);
  });

  it('uses manual override brief', () => {
    const snap = hazardEngine.get('tornado-warning', [alert()], {
      cachedBrief: {
        summary: 'AI text',
        manual_override: true,
        manual_summary: 'Editor-approved tornado brief.',
        status: 'valid',
        generated_at: '2026-07-24T12:00:00Z',
      },
    });
    expect(snap.weatherBrief.source).toBe('manual');
    expect(snap.weatherBrief.summary).toBe('Editor-approved tornado brief.');
  });

  it('handles unavailable feed without claiming zero alerts', () => {
    const snap = hazardEngine.get('tornado-warning', [alert()], { dataAvailable: false });
    expect(snap.activeCount).toBe(0);
    expect(snap.liveStatus.statusHeadline).toMatch(/unavailable/i);
    expect(snap.freshness.dataAvailable).toBe(false);
  });
});

describe('hazardEngine.getState', () => {
  it('aggregates alerts, hazards, and deterministic summary for a state', () => {
    const alerts = [
      alert({
        id: 'heat-1',
        event: 'Excessive Heat Warning',
        category: 'heat',
        state: 'CO',
        areaDesc: 'Denver, CO; Pueblo, CO',
        urgency: 'Expected',
        severity: 'Moderate',
      }),
      alert({
        id: 'heat-2',
        event: 'Heat Advisory',
        category: 'heat',
        state: 'CO',
        areaDesc: 'El Paso, CO',
        urgency: 'Expected',
        severity: 'Minor',
      }),
      alert({
        id: 'flood-1',
        event: 'Flash Flood Warning',
        category: 'flood',
        state: 'CO',
        areaDesc: 'Pueblo, CO',
      }),
      alert({
        id: 'other-state',
        event: 'Heat Advisory',
        category: 'heat',
        state: 'TX',
        areaDesc: 'Travis, TX',
      }),
    ];

    const snap = hazardEngine.getState('CO', alerts, {
      latestSourceUpdateAt: '2026-07-24T12:05:00Z',
    });

    expect(snap.ok).toBe(true);
    expect(snap.stateCode).toBe('CO');
    expect(snap.stateName).toBe('Colorado');
    expect(snap.activeCount).toBe(3);
    expect(snap.hazards.map((h) => h.slug)).toEqual(['heat', 'flood']);
    expect(snap.hazards[0].activeCount).toBe(2);
    expect(snap.hazards[1].activeCount).toBe(1);
    expect(snap.liveStatus.statusHeadline).toBe('3 Weather Alerts Active in Colorado');
    expect(snap.deterministicSummary).toBe(
      'Extreme Heat is the primary concern with 2 alerts, plus 1 Flooding alert.'
    );
    expect(snap.deterministicSummary).not.toMatch(/currently active across/i);
    expect(snap.affectedCounties.some((c) => c.name === 'Pueblo')).toBe(true);
    expect(snap.weatherBrief).toBeNull();
  });

  it('handles zero-alert state without inventing activity', () => {
    const snap = hazardEngine.getState('CO', [], {
      latestSourceUpdateAt: '2026-07-24T12:05:00Z',
    });
    expect(snap.ok).toBe(true);
    expect(snap.activeCount).toBe(0);
    expect(snap.liveStatus.statusHeadline).toBe('No Active Weather Alerts in Colorado');
    expect(snap.liveStatus.monitoringNote).toMatch(/continues to monitor/i);
    expect(snap.hazards).toHaveLength(0);
  });

  it('rejects unknown state codes', () => {
    expect(hazardEngine.getState('XX', []).ok).toBe(false);
  });
});

describe('buildStateSituationSummary', () => {
  it('does not repeat the headline count opener', () => {
    const summary = buildStateSituationSummary({
      stateName: 'Oregon',
      activeCount: 7,
      hazards: [
        { label: 'Fire Weather', activeCount: 6 },
        { label: 'Extreme Heat', activeCount: 1 },
      ],
    });
    expect(summary).toBe(
      'Fire Weather is the primary concern with 6 alerts, plus 1 Extreme Heat alert.'
    );
    expect(summary).not.toMatch(/7 Weather Alerts/i);
  });

  it('handles a single hazard type', () => {
    expect(
      buildStateSituationSummary({
        stateName: 'Texas',
        activeCount: 1,
        hazards: [{ label: 'Flooding', activeCount: 1 }],
      })
    ).toBe('Flooding is the primary concern with 1 alert.');
  });

  it('handles zero alerts', () => {
    expect(
      buildStateSituationSummary({
        stateName: 'Maine',
        activeCount: 0,
        hazards: [],
      })
    ).toMatch(/no active/i);
  });
});
