import { describe, expect, it } from 'vitest';
import {
  buildPopularStateLocations,
  formatCityDisplayName,
} from './popularStateCities';

const richSlugs = new Set(['hartford-ct']);
const richPopulations = { 'hartford-ct': 121054 };

function catalogCity(name, slug, population = 0) {
  return { slug, name, population, hasStaticPage: false };
}

describe('formatCityDisplayName', () => {
  it('strips Census balance suffixes', () => {
    expect(formatCityDisplayName('City of Milford (balance)')).toBe('Milford');
  });
});

describe('buildPopularStateLocations', () => {
  it('includes Hartford and major CT cities ahead of small alphabetical catalog entries', () => {
    const catalog = [
      catalogCity('Ansonia', 'ansonia-ct'),
      catalogCity('Bantam', 'bantam-ct'),
      catalogCity('Bridgeport', 'bridgeport-ct', 145936),
      catalogCity('Bristol', 'bristol-ct'),
      catalogCity('City of Milford (balance)', 'milford-ct-balance'),
      catalogCity('Danbury', 'danbury-ct', 84992),
      catalogCity('Danielson', 'danielson-ct'),
      catalogCity('Derby', 'derby-ct'),
      catalogCity('New Haven', 'new-haven-ct', 129934),
      catalogCity('Stamford', 'stamford-ct', 129113),
      catalogCity('Waterbury', 'waterbury-ct', 108272),
      catalogCity('Norwalk', 'norwalk-ct', 88438),
    ];

    const popular = buildPopularStateLocations({
      staticCities: [{ slug: 'hartford-ct', city: 'Hartford' }],
      catalogCities: catalog,
      richCitySlugs: richSlugs,
      populationFromRichJson: richPopulations,
      cityAlertsPath: (slug, hasRich) => (hasRich ? `/alerts/${slug}` : `/alerts/city/${slug}`),
      maxCount: 8,
    });

    const names = popular.map((c) => c.name);
    const slugs = popular.map((c) => c.slug);

    expect(slugs).toContain('hartford-ct');
    expect(names).toContain('Hartford');
    expect(names).not.toContain('Ansonia');
    expect(names).not.toContain('Bantam');
    expect(names).toEqual(
      expect.arrayContaining(['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury', 'Norwalk', 'Danbury']),
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('dedupes static and catalog entries by slug', () => {
    const popular = buildPopularStateLocations({
      staticCities: [{ slug: 'hartford-ct', city: 'Hartford' }],
      catalogCities: [
        { slug: 'hartford-ct', name: 'Hartford', population: 123243, hasStaticPage: true },
      ],
      richCitySlugs: richSlugs,
      populationFromRichJson: richPopulations,
      cityAlertsPath: (slug) => `/alerts/${slug}`,
      maxCount: 8,
    });

    expect(popular.filter((c) => c.slug === 'hartford-ct')).toHaveLength(1);
    expect(popular[0].path).toBe('/alerts/hartford-ct');
  });
});
