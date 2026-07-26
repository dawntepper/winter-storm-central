/**
 * Embedded map extent helpers for state / hazard radar previews.
 * Uses alert marker coordinates (lat/lon). Alert polygons are not retained
 * on client alert objects after parse-time centroid extraction.
 *
 * Bounds are plain objects so this module can run in Node tests without Leaflet.
 * Convert with toLeafletBounds() at the map boundary.
 */

import { STATE_GEOJSON } from '../data/stateGeoJSON';

/** Lower-48 bounding box (Alaska/Hawaii remain pannable, not default). */
export const CONUS_BOUNDS = {
  south: 24.52,
  west: -124.77,
  north: 49.38,
  east: -66.95,
};

/** Lon/lat span (degrees) above which we treat alerts as nationally broad. */
export const BROAD_SPAN_LON_DEG = 28;
export const BROAD_SPAN_LAT_DEG = 18;

/** Distinct state codes above which we fall back to CONUS. */
export const BROAD_STATE_COUNT = 6;

/** Embedded mobile fitBounds padding. */
export const EMBED_MOBILE_PADDING = [36, 28];
export const EMBED_STATE_PADDING = [32, 24];

/** Cap zoom so single alerts stay regional, not street-level. */
export const EMBED_MAX_ZOOM = 8;
export const EMBED_SINGLE_ALERT_ZOOM = 7;
/** Alaska is large — keep a wider regional view than CONUS counties. */
export const EMBED_ALASKA_MAX_ZOOM = 5;
export const EMBED_HAWAII_MAX_ZOOM = 7;

/** States outside the default lower-48 radar frame. */
export const NON_CONUS_STATE_CODES = new Set(['AK', 'HI']);

function isValidBounds(b) {
  return (
    b
    && Number.isFinite(b.south)
    && Number.isFinite(b.west)
    && Number.isFinite(b.north)
    && Number.isFinite(b.east)
    && b.south <= b.north
    && b.west <= b.east
  );
}

export function boundsEquals(a, b) {
  if (!a || !b) return false;
  return (
    a.south === b.south
    && a.west === b.west
    && a.north === b.north
    && a.east === b.east
  );
}

/**
 * Build bounds from alert marker points.
 * @returns {{south,west,north,east}|null}
 */
export function boundsFromAlertPoints(alerts) {
  const pts = (alerts || []).filter(
    (a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lon)
  );
  if (pts.length === 0) return null;
  return boundsFromLonLatPairs(pts.map((a) => [a.lon, a.lat]));
}

/**
 * True when an alert is in Alaska/Hawaii (or coordinates clearly outside CONUS).
 * These never appear in the default lower-48 radar frame.
 */
export function isOutsideConusAlert(alert) {
  if (!alert) return false;
  if (NON_CONUS_STATE_CODES.has(alert.state)) return true;

  const { lat, lon } = alert;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Hawaii island chain
  if (lat < 24.2 && lon < -154) return true;
  // Alaska (incl. Aleutians west of the CONUS west edge)
  if (lat > 50 && lon < -129) return true;
  return false;
}

/**
 * Broad-distribution heuristic for CONUS alerts:
 * - bounding-box lon span ≥ 28° OR lat span ≥ 18°, OR
 * - alerts touch ≥ 6 distinct state codes
 *
 * Concentrated multi-state clusters (e.g. TX + KS + GA) stay fitted;
 * coast-to-coast / many-region sets fall back to CONUS.
 * Do not use this alone for AK/HI — Alaska's own footprint exceeds these spans.
 */
export function isBroadlyDistributed(bounds, alerts = []) {
  if (!isValidBounds(bounds)) return true;

  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  if (lonSpan >= BROAD_SPAN_LON_DEG || latSpan >= BROAD_SPAN_LAT_DEG) {
    return true;
  }

  const states = new Set(
    (alerts || []).map((a) => a.state).filter(Boolean)
  );
  if (states.size >= BROAD_STATE_COUNT) return true;

  return false;
}

function maxZoomForNonConusStates(states) {
  if (states.has('AK') && !states.has('HI')) return EMBED_ALASKA_MAX_ZOOM;
  if (states.has('HI') && !states.has('AK')) return EMBED_HAWAII_MAX_ZOOM;
  // Both AK + HI (rare): keep loose so neither is over-zoomed
  return EMBED_ALASKA_MAX_ZOOM;
}

/**
 * Signature of alert geography for viewport decisions.
 * Changes when states enter/leave or CONUS↔non-CONUS class flips — not on
 * minor count changes within the same state set.
 */
export function alertGeographySignature(alerts) {
  const list = alerts || [];
  if (list.length === 0) return 'empty';
  const states = [...new Set(list.map((a) => a.state || '?'))].sort();
  const allOutside = list.every(isOutsideConusAlert);
  return `${allOutside ? 'nonconus' : 'conus'}:${states.join('|')}`;
}

function walkCoordinates(node, out) {
  if (!Array.isArray(node) || node.length === 0) return;
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    out.push(node);
    return;
  }
  for (const child of node) walkCoordinates(child, out);
}

/**
 * Build south/west/north/east from [lon, lat] pairs.
 * When coordinates cross the antimeridian (Alaska Aleutians use +172…+180
 * while the mainland is −180…−130), naive min/max spans ~360° and fitBounds
 * shows the whole globe. For that case we ignore eastern-hemisphere points so
 * the box stays Pacific-centered within Leaflet's safe [-180, 180] range
 * (unwrapping to west < -180 can hang/loop fitBounds).
 */
export function boundsFromLonLatPairs(pairs) {
  if (!pairs?.length) return null;

  let samples = pairs.filter(
    (p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]),
  );
  if (!samples.length) return null;

  const lons = samples.map((p) => p[0]);
  const naiveSpan = Math.max(...lons) - Math.min(...lons);
  if (naiveSpan > 180) {
    // Keep only western-hemisphere samples (Alaska mainland + most Aleutians).
    // Unwrapping past −180 can hang Leaflet fitBounds.
    samples = samples.filter((p) => p[0] <= 0);
    if (!samples.length) return null;
  }

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [lon, lat] of samples) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
  }
  west = Math.max(-180, Math.min(180, west));
  east = Math.max(-180, Math.min(180, east));
  const bounds = { south, west, north, east };
  return isValidBounds(bounds) ? bounds : null;
}

/**
 * @returns {{south,west,north,east}|null}
 */
export function getStateBounds(stateCode) {
  if (!stateCode || !STATE_GEOJSON[stateCode]) return null;
  try {
    const coords = [];
    walkCoordinates(STATE_GEOJSON[stateCode].geometry?.coordinates, coords);
    return boundsFromLonLatPairs(coords);
  } catch {
    return null;
  }
}

function singleAlertBounds(alert, padDeg) {
  return {
    south: alert.lat - padDeg,
    west: alert.lon - padDeg,
    north: alert.lat + padDeg,
    east: alert.lon + padDeg,
  };
}

/**
 * Resolve the target bounds for an embedded hazard map.
 *
 * Non-CONUS (AK/HI): always frame those alerts / that state — never fall back
 * to the lower-48 CONUS box (Alaska's footprint alone looks "broad" by span).
 */
export function resolveHazardEmbedTarget(alerts) {
  const list = alerts || [];
  if (list.length === 0) {
    return { bounds: CONUS_BOUNDS, mode: 'conus', maxZoom: EMBED_MAX_ZOOM };
  }

  const outside = list.filter(isOutsideConusAlert);
  const allOutside = outside.length === list.length;

  if (allOutside) {
    const stateCodes = new Set(list.map((a) => a.state).filter(Boolean));
    const maxZoom = maxZoomForNonConusStates(stateCodes);

    // Single non-CONUS state → prefer full state frame so context is clear
    if (stateCodes.size === 1) {
      const code = [...stateCodes][0];
      const stateBounds = getStateBounds(code);
      if (stateBounds) {
        return { bounds: stateBounds, mode: 'non_conus_state', maxZoom };
      }
    }

    if (list.length === 1 && Number.isFinite(list[0].lat) && Number.isFinite(list[0].lon)) {
      const pad = list[0].state === 'AK' ? 2.5 : 1.2;
      return {
        bounds: singleAlertBounds(list[0], pad),
        mode: 'non_conus_single',
        maxZoom,
      };
    }

    const bounds = boundsFromAlertPoints(list);
    if (isValidBounds(bounds)) {
      return { bounds, mode: 'non_conus_alerts', maxZoom };
    }
    // Last resort: still avoid CONUS for known AK/HI state codes
    const fallbackCode = [...stateCodes][0];
    const fallbackBounds = fallbackCode ? getStateBounds(fallbackCode) : null;
    if (fallbackBounds) {
      return { bounds: fallbackBounds, mode: 'non_conus_state', maxZoom };
    }
  }

  const bounds = boundsFromAlertPoints(list);
  if (!isValidBounds(bounds)) {
    return { bounds: CONUS_BOUNDS, mode: 'conus', maxZoom: EMBED_MAX_ZOOM };
  }

  if (list.length === 1) {
    return {
      bounds: singleAlertBounds(list[0], 1.2),
      mode: 'single',
      maxZoom: EMBED_SINGLE_ALERT_ZOOM,
    };
  }

  if (isBroadlyDistributed(bounds, list)) {
    return { bounds: CONUS_BOUNDS, mode: 'conus', maxZoom: EMBED_MAX_ZOOM };
  }

  return { bounds, mode: 'alerts', maxZoom: EMBED_MAX_ZOOM };
}

/**
 * Resolve target bounds for an embedded state map — state geometry wins.
 */
export function resolveStateEmbedTarget(stateCode) {
  const bounds = getStateBounds(stateCode);
  if (!bounds) {
    return { bounds: CONUS_BOUNDS, mode: 'conus', maxZoom: EMBED_MAX_ZOOM };
  }
  let maxZoom = EMBED_MAX_ZOOM;
  if (stateCode === 'AK') maxZoom = EMBED_ALASKA_MAX_ZOOM;
  else if (stateCode === 'HI') maxZoom = EMBED_HAWAII_MAX_ZOOM;
  return { bounds, mode: 'state', maxZoom };
}

/** Convert plain bounds → Leaflet LatLngBounds (call only in browser/map code). */
export function toLeafletBounds(L, bounds) {
  const b = bounds || CONUS_BOUNDS;
  return L.latLngBounds([b.south, b.west], [b.north, b.east]);
}
