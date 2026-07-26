import { describe, expect, it } from 'vitest';
import {
  boundsFromAlertPoints,
  isBroadlyDistributed,
  resolveHazardEmbedTarget,
  resolveStateEmbedTarget,
  boundsEquals,
  BROAD_SPAN_LON_DEG,
  BROAD_STATE_COUNT,
  CONUS_BOUNDS,
  EMBED_CONUS_PADDING,
  EMBED_CONUS_MAX_ZOOM,
  EMBED_MOBILE_PADDING,
} from './mapExtent.js';

function pt(lat, lon, state, id = 'a') {
  return { id, lat, lon, state };
}

describe('boundsFromAlertPoints', () => {
  it('returns null without coordinates', () => {
    expect(boundsFromAlertPoints([])).toBeNull();
    expect(boundsFromAlertPoints([{ id: 1 }])).toBeNull();
  });

  it('builds bounds from markers', () => {
    const b = boundsFromAlertPoints([
      pt(32, -97, 'TX'),
      pt(33, -96, 'TX'),
    ]);
    expect(b.south).toBe(32);
    expect(b.north).toBe(33);
    expect(b.west).toBe(-97);
    expect(b.east).toBe(-96);
  });
});

describe('isBroadlyDistributed', () => {
  it('treats wide lon span as broad', () => {
    const bounds = { south: 30, west: -120, north: 40, east: -70 };
    expect(bounds.east - bounds.west).toBeGreaterThanOrEqual(BROAD_SPAN_LON_DEG);
    expect(isBroadlyDistributed(bounds, [])).toBe(true);
  });

  it('treats many distinct states as broad', () => {
    const alerts = [
      pt(34, -118, 'CA'),
      pt(25, -80, 'FL'),
      pt(45, -69, 'ME'),
      pt(47, -122, 'WA'),
      pt(40, -74, 'NY'),
      pt(41, -87, 'IL'),
    ];
    const bounds = boundsFromAlertPoints(alerts);
    expect(new Set(alerts.map((a) => a.state)).size).toBeGreaterThanOrEqual(BROAD_STATE_COUNT);
    expect(isBroadlyDistributed(bounds, alerts)).toBe(true);
  });

  it('keeps concentrated multi-state clusters fitted', () => {
    const alerts = [
      pt(31.5, -99, 'TX'),
      pt(38.5, -98, 'KS'),
      pt(33, -83.5, 'GA'),
    ];
    const bounds = boundsFromAlertPoints(alerts);
    expect(isBroadlyDistributed(bounds, alerts)).toBe(false);
  });
});

describe('resolveHazardEmbedTarget', () => {
  it('uses tight CONUS padding/maxZoom when empty', () => {
    const t = resolveHazardEmbedTarget([]);
    expect(t.mode).toBe('conus');
    expect(boundsEquals(t.bounds, CONUS_BOUNDS)).toBe(true);
    expect(t.padding).toEqual(EMBED_CONUS_PADDING);
    expect(t.maxZoom).toBe(EMBED_CONUS_MAX_ZOOM);
    // Tighter than the general embed pad so lower-48 fills the hazard map
    expect(EMBED_CONUS_PADDING[0]).toBeLessThan(EMBED_MOBILE_PADDING[0]);
    expect(EMBED_CONUS_PADDING[1]).toBeLessThan(EMBED_MOBILE_PADDING[1]);
  });

  it('uses single-alert regional box', () => {
    const t = resolveHazardEmbedTarget([pt(35.5, -97.5, 'OK', 'one')]);
    expect(t.mode).toBe('single');
    expect(t.maxZoom).toBe(7);
  });

  it('fits concentrated clusters', () => {
    const t = resolveHazardEmbedTarget([
      pt(31.5, -99, 'TX'),
      pt(38.5, -98, 'KS'),
      pt(33, -83.5, 'GA'),
    ]);
    expect(t.mode).toBe('alerts');
  });

  it('ignores AK/HI points when framing mixed CONUS alert sets', () => {
    const t = resolveHazardEmbedTarget([
      pt(31.5, -99, 'TX'),
      pt(38.5, -98, 'KS'),
      pt(33, -83.5, 'GA'),
      pt(64.8, -147.7, 'AK', 'ak-1'),
    ]);
    // Without filtering AK, lon span would look "broad" and fall back to CONUS
    expect(t.mode).toBe('alerts');
    expect(t.bounds.north).toBeLessThan(50);
    expect(t.bounds.west).toBeGreaterThan(-130);
  });

  it('uses tight CONUS when lower-48 alerts are broadly distributed', () => {
    const t = resolveHazardEmbedTarget([
      pt(34, -118, 'CA'),
      pt(25, -80, 'FL'),
      pt(45, -69, 'ME'),
      pt(47, -122, 'WA'),
      pt(40, -74, 'NY'),
      pt(41, -87, 'IL'),
    ]);
    expect(t.mode).toBe('conus');
    expect(t.padding).toEqual(EMBED_CONUS_PADDING);
    expect(t.maxZoom).toBe(EMBED_CONUS_MAX_ZOOM);
  });

  it('frames Alaska instead of CONUS for Alaska-only alerts', () => {
    // Alaska's lon span alone exceeds the "broad" threshold — must not CONUS-fallback
    const t = resolveHazardEmbedTarget([
      pt(64.8, -147.7, 'AK', 'ak-1'),
      pt(61.2, -149.9, 'AK', 'ak-2'),
    ]);
    expect(t.mode).toBe('non_conus_state');
    expect(boundsEquals(t.bounds, CONUS_BOUNDS)).toBe(false);
    expect(t.bounds.north).toBeGreaterThan(50);
    expect(t.maxZoom).toBe(5);
  });

  it('frames Hawaii instead of CONUS for a single Hawaii alert', () => {
    const t = resolveHazardEmbedTarget([pt(21.3, -157.8, 'HI', 'hi-1')]);
    expect(t.mode).toMatch(/^non_conus/);
    expect(boundsEquals(t.bounds, CONUS_BOUNDS)).toBe(false);
    expect(t.bounds.south).toBeLessThan(24);
  });
});

describe('resolveStateEmbedTarget', () => {
  it('returns Oklahoma state bounds', () => {
    const t = resolveStateEmbedTarget('OK');
    expect(t.mode).toBe('state');
    // Oklahoma roughly 33–37N, 94–103W
    expect(t.bounds.south).toBeGreaterThan(33);
    expect(t.bounds.north).toBeLessThan(38);
    expect(t.bounds.west).toBeLessThan(-94);
    expect(t.bounds.east).toBeGreaterThan(-95);
  });

  it('frames Alaska without wrapping the globe (antimeridian-safe)', () => {
    const t = resolveStateEmbedTarget('AK');
    expect(t.mode).toBe('state');
    expect(t.maxZoom).toBe(5);
    // Must not use naive +179/−179 span (~360°) that fitBounds as a world view
    expect(t.bounds.east - t.bounds.west).toBeLessThan(80);
    expect(t.bounds.east - t.bounds.west).toBeGreaterThan(40);
    expect(t.bounds.north).toBeGreaterThan(70);
    expect(t.bounds.south).toBeGreaterThan(50);
    expect(t.bounds.south).toBeLessThan(55);
    // Stay inside Leaflet-safe lon range (west < -180 can hang fitBounds)
    expect(t.bounds.west).toBeGreaterThanOrEqual(-180);
    expect(t.bounds.east).toBeLessThan(-120);
    expect(t.bounds.east).toBeGreaterThan(-140);
  });

  it('frames Hawaii tightly', () => {
    const t = resolveStateEmbedTarget('HI');
    expect(t.mode).toBe('state');
    expect(t.maxZoom).toBe(7);
    expect(t.bounds.east - t.bounds.west).toBeLessThan(10);
    expect(t.bounds.north).toBeLessThan(24);
  });
});
