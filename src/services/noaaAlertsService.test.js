import { describe, expect, it } from 'vitest';
import { extractCoordinates, parseAlert } from './noaaAlertsService.js';
import { extractStateCode } from '../../shared/nws-alert-parser.js';
import { hazardEngine } from '../../shared/hazard-engine/index.js';

const DE_HEAT_ADVISORY = {
  properties: {
    geocode: {
      SAME: [
        '010003',
        '034021',
        '034015',
        '034007',
        '034005',
        '042045',
        '042101',
        '042029',
        '042091',
        '042017',
      ],
      UGC: [
        'DEZ001',
        'NJZ015',
        'NJZ017',
        'NJZ018',
        'NJZ019',
        'PAZ070',
        'PAZ071',
        'PAZ102',
        'PAZ104',
        'PAZ106',
      ],
    },
  },
  geometry: null,
};

describe('extractCoordinates', () => {
  it('places multi-state alerts in the primary state, not averaged across neighbors', () => {
    const coords = extractCoordinates(DE_HEAT_ADVISORY);
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeGreaterThan(39.0);
    expect(coords.lat).toBeLessThan(39.9);
    expect(coords.lon).toBeGreaterThan(-76.2);
    expect(coords.lon).toBeLessThan(-75.0);
    expect(coords.source).toBe('fips');
  });
});

/** Shape of the live 2026-07-26 Alaska Winter Weather Advisory (no geometry). */
const AK_WINTER_WEATHER_ADVISORY = {
  id: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.ak-wwa-test',
  geometry: null,
  properties: {
    event: 'Winter Weather Advisory',
    areaDesc: 'Central Brooks Range',
    severity: 'Moderate',
    urgency: 'Expected',
    certainty: 'Likely',
    onset: '2026-07-26T12:00:00Z',
    expires: '2099-07-27T06:00:00Z',
    headline: 'Winter Weather Advisory issued for Central Brooks Range',
    description: 'Snow and blowing snow expected.',
    geocode: {
      UGC: ['AKZ809'],
      SAME: ['002185'],
    },
  },
};

const HI_WINTER_STORM_WARNING = {
  id: 'hi-wsw-test',
  geometry: null,
  properties: {
    event: 'Winter Storm Warning',
    areaDesc: 'Big Island Interior',
    severity: 'Severe',
    urgency: 'Expected',
    certainty: 'Likely',
    onset: '2026-07-26T12:00:00Z',
    expires: '2099-07-27T06:00:00Z',
    headline: 'Winter Storm Warning for Big Island Interior',
    description: 'Heavy snow.',
    geocode: {
      UGC: ['HIZ001'],
      SAME: [],
    },
  },
};

describe('Alaska / Hawaii retention for severe-weather pages', () => {
  it('extracts AK from zone UGC even when areaDesc has no ", AK" suffix', () => {
    expect(extractStateCode(AK_WINTER_WEATHER_ADVISORY)).toBe('AK');
    expect(extractStateCode(HI_WINTER_STORM_WARNING)).toBe('HI');
  });

  it('parses Alaska Winter Weather Advisory without geometry into allAlerts', () => {
    const parsed = parseAlert(AK_WINTER_WEATHER_ADVISORY);
    expect(parsed).not.toBeNull();
    expect(parsed.state).toBe('AK');
    expect(parsed.event).toBe('Winter Weather Advisory');
    expect(parsed.lat).toBeGreaterThan(50);
    expect(parsed.lon).toBeLessThan(-129);
  });

  it('parses Hawaii winter products with UGC-only geocode', () => {
    const parsed = parseAlert(HI_WINTER_STORM_WARNING);
    expect(parsed).not.toBeNull();
    expect(parsed.state).toBe('HI');
    expect(parsed.lat).toBeLessThan(24.2);
  });

  it('surfaces Alaska advisory on the winter-storm hazard page', () => {
    const parsed = parseAlert(AK_WINTER_WEATHER_ADVISORY);
    const snap = hazardEngine.get('winter-storm-warning', [parsed], { dataAvailable: true });
    expect(snap.activeCount).toBe(1);
    expect(snap.liveStatus.hasActiveAlerts).toBe(true);
    expect(snap.affectedStates.map((s) => s.code)).toContain('AK');
    expect(snap.liveStatus.statusHeadline).toMatch(/Winter Weather Advisory Active/i);
  });
});
