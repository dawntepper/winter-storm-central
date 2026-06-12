import { describe, expect, it } from 'vitest';
import { getCoordinatesFromFIPS } from './stateCentroids.js';

describe('getCoordinatesFromFIPS', () => {
  it('returns New Castle County DE centroid, not PA/NJ', () => {
    const coords = getCoordinatesFromFIPS('010003');
    expect(coords.lat).toBeCloseTo(39.56, 1);
    expect(coords.lon).toBeCloseTo(-75.6, 1);
    expect(coords.lat).toBeLessThan(39.9);
  });

  it('returns distinct coordinates for counties in other states', () => {
    const de = getCoordinatesFromFIPS('010003');
    const mercerNj = getCoordinatesFromFIPS('034021');
    expect(mercerNj.lat).not.toBeCloseTo(de.lat, 0);
    expect(mercerNj.lon).not.toBeCloseTo(de.lon, 0);
  });
});
