import { describe, expect, it } from 'vitest';
import {
  parseSlugCityState,
  parseCityStateLabel,
  CITY_PROMOTION_THRESHOLD,
} from './locationCatalogService.js';

describe('parseSlugCityState', () => {
  it('parses city-state slugs', () => {
    expect(parseSlugCityState('springfield-il')).toEqual({
      name: 'Springfield',
      stateCode: 'IL',
    });
    expect(parseSlugCityState('fort-worth-tx')).toEqual({
      name: 'Fort Worth',
      stateCode: 'TX',
    });
  });

  it('returns null for invalid slugs', () => {
    expect(parseSlugCityState('not-a-slug')).toBeNull();
    expect(parseSlugCityState('')).toBeNull();
  });
});

describe('parseCityStateLabel', () => {
  it('parses City, ST labels', () => {
    expect(parseCityStateLabel('Boulder, CO')).toEqual({
      name: 'Boulder',
      stateCode: 'CO',
    });
  });

  it('returns null for non-city labels', () => {
    expect(parseCityStateLabel('80301')).toBeNull();
    expect(parseCityStateLabel(null)).toBeNull();
  });
});

describe('CITY_PROMOTION_THRESHOLD', () => {
  it('is a positive integer for static page promotion docs', () => {
    expect(CITY_PROMOTION_THRESHOLD).toBeGreaterThan(0);
  });
});
