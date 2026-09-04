import { describe, expect, it } from 'vitest';
import { BASEMAP_STYLES, darkBasemapTileUrl } from './basemapTiles';

describe('BASEMAP_STYLES', () => {
  it('uses keyless Esri canvas URLs instead of Carto', () => {
    expect(Object.keys(BASEMAP_STYLES).sort()).toEqual(['dark', 'light', 'voyager']);
    for (const style of Object.values(BASEMAP_STYLES)) {
      expect(style.url).toMatch(/arcgisonline\.com/);
      expect(style.url).not.toMatch(/carto/i);
      expect(style.url).not.toMatch(/[?&]key=/);
      expect(style.url).toContain('{z}/{y}/{x}');
    }
  });
});

describe('darkBasemapTileUrl', () => {
  it('uses Esri tile order (z/y/x) with no API key', () => {
    expect(darkBasemapTileUrl(4, 4, 6)).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/4/6/4',
    );
  });
});
