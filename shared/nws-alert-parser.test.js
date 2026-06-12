import { describe, expect, it } from 'vitest';
import {
  extractGeometryCoordinates,
  extractLocationName,
  extractStateCode,
  filterSameCodesForState,
  normalizeSameFips,
} from './nws-alert-parser.js';

const DE_HEAT_ADVISORY = {
  properties: {
    event: 'Heat Advisory',
    areaDesc:
      'New Castle; Mercer; Gloucester; Camden; Northwestern Burlington; Delaware; Philadelphia; Eastern Chester; Eastern Montgomery; Lower Bucks',
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

describe('normalizeSameFips', () => {
  it('normalizes 5- and 6-digit SAME codes', () => {
    expect(normalizeSameFips('010003')).toBe('10003');
    expect(normalizeSameFips('10003')).toBe('10003');
    expect(normalizeSameFips('034021')).toBe('34021');
  });
});

describe('filterSameCodesForState', () => {
  const stateFipsFromPostal = (postal) => ({ DE: '10', NJ: '34', PA: '42' })[postal];

  it('keeps only counties in the primary state for multi-state alerts', () => {
    const sameCodes = DE_HEAT_ADVISORY.properties.geocode.SAME;
    const filtered = filterSameCodesForState(sameCodes, 'DE', stateFipsFromPostal);
    expect(filtered).toEqual(['010003']);
  });

  it('returns all codes when state is unknown', () => {
    const sameCodes = DE_HEAT_ADVISORY.properties.geocode.SAME;
    expect(filterSameCodesForState(sameCodes, null, stateFipsFromPostal)).toEqual(sameCodes);
  });
});

describe('extractLocationName', () => {
  it('uses the first area and primary UGC state', () => {
    expect(extractLocationName(DE_HEAT_ADVISORY)).toBe('New Castle, DE');
  });
});

describe('extractStateCode', () => {
  it('reads postal state from the first UGC code', () => {
    expect(extractStateCode(DE_HEAT_ADVISORY)).toBe('DE');
  });
});

describe('extractGeometryCoordinates', () => {
  it('centroids Polygon rings', () => {
    const alert = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      },
    };
    expect(extractGeometryCoordinates(alert)).toEqual({ lat: 0.8, lon: 0.8 });
  });

  it('centroids MultiPolygon parts', () => {
    const alert = {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
          [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]],
        ],
      },
    };
    const centroid = extractGeometryCoordinates(alert);
    expect(centroid.lat).toBeCloseTo(5.8);
    expect(centroid.lon).toBeCloseTo(5.8);
  });
});
