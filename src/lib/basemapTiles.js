/**
 * Keyless Leaflet raster basemaps (Esri World Canvas / Street Map).
 *
 * CARTO raster tiles at basemaps.cartocdn.com now watermark every unauthenticated
 * request with "API KEY REQUIRED" (https://docs.carto.com/faqs/carto-basemaps).
 * A free CARTO key is capped at 5 million tiles/month — tight for this app:
 * each visitor loads many tiles on pan/zoom, retina, and the dark terrain-hint
 * overlay. Esri's classic Canvas MapServer endpoints need no key.
 *
 * Tile templates use {z}/{y}/{x} (Esri order), not OSM {z}/{x}/{y}.
 */
export const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS';

export const BASEMAP_STYLES = {
  dark: {
    label: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
    maxNativeZoom: 16,
    maxZoom: 19,
  },
  light: {
    label: 'Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
    maxNativeZoom: 16,
    maxZoom: 19,
  },
  voyager: {
    label: 'Voyager',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
    maxNativeZoom: 19,
    maxZoom: 19,
  },
};

/** Absolute tile URL for OG-image compositing (Esri uses y/x, not x/y). */
export function darkBasemapTileUrl(zoom, x, y) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom}/${y}/${x}`;
}
