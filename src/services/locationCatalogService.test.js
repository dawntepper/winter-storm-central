import { describe, expect, it } from 'vitest';
import {
  parseSlugCityState,
  parseCityStateLabel,
  CITY_PROMOTION_THRESHOLD,
  savedLocationAlertsPath,
  haversineMiles,
} from './locationCatalogService.js';
import { getCitySlugForLocation } from '../utils/cityLookup.js';

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

describe('haversineMiles', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineMiles(41.8781, -87.6298, 41.8781, -87.6298)).toBe(0);
  });

  it('returns a positive distance for separated coordinates', () => {
    const miles = haversineMiles(41.8781, -87.6298, 26.6406, -81.8723);
    expect(miles).toBeGreaterThan(900);
    expect(miles).toBeLessThan(1300);
  });
});

describe('savedLocationAlertsPath', () => {
  it('uses stored path when present', () => {
    expect(savedLocationAlertsPath({ cityAlertsPath: '/alerts/city/foo-co' })).toBe('/alerts/city/foo-co');
  });

  it('links catalog cities from static index', () => {
    const slug = getCitySlugForLocation('Miami, FL');
    if (slug) {
      expect(savedLocationAlertsPath({ name: 'Miami, FL' })).toBe(`/alerts/${slug}`);
    }
  });

  it('links user-generated slugs to catalog city route', () => {
    expect(savedLocationAlertsPath({ name: '80301', citySlug: 'boulder-co' })).toBe('/alerts/city/boulder-co');
  });

  it('prefers stored cityAlertsPath over static index', () => {
    expect(
      savedLocationAlertsPath({
        name: 'Miami, FL',
        cityAlertsPath: '/alerts/city/miami-fl',
      })
    ).toBe('/alerts/city/miami-fl');
  });

  it('returns null for non-city labels', () => {
    expect(savedLocationAlertsPath({ name: 'Near me (40.01, -105.27)' })).toBeNull();
  });
});
