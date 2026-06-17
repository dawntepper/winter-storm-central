import { describe, expect, it } from 'vitest';
import { filterCatalogByPrefix } from './catalogFilter';

const cities = [
  { name: 'Chicago' },
  { name: 'Seattle' },
  { name: 'Salt Lake City' },
];

describe('filterCatalogByPrefix', () => {
  it('returns all items for empty query', () => {
    expect(filterCatalogByPrefix('', cities, (c) => c.name)).toHaveLength(3);
  });

  it('matches city name prefixes', () => {
    const matches = filterCatalogByPrefix('Sea', cities, (c) => c.name);
    expect(matches.map((c) => c.name)).toEqual(['Seattle']);
  });

  it('matches word prefixes in multi-word cities', () => {
    const matches = filterCatalogByPrefix('Lake', cities, (c) => c.name);
    expect(matches.map((c) => c.name)).toEqual(['Salt Lake City']);
  });

  it('does not match substring typos inside a city name', () => {
    const matches = filterCatalogByPrefix('hicago', cities, (c) => c.name);
    expect(matches).toHaveLength(0);
  });

  it('does not match misspellings with wrong prefix', () => {
    const matches = filterCatalogByPrefix('Chicgo', cities, (c) => c.name);
    expect(matches).toHaveLength(0);
  });
});
