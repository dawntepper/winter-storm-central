import { describe, expect, it } from 'vitest';
import { extractCoordinates } from './noaaAlertsService.js';

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
