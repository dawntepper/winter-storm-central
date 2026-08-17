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

/**
 * Tropical-family hazard frame: lower-48 + Gulf + Caribbean approaches so
 * PR/VI and Atlantic hurricane tracks stay in view without zooming so far
 * out that RainViewer precip vanishes (a AK→Caribbean world box at z≈3.5
 * made radar look "missing"). Used only on tropical embeds — tornado/flood
 * keep CONUS or alert-local framing. Pacific-only alert sets (AK/HI/GU/AS/MP)
 * still use tighter non-CONUS state framing via resolveTropicalHazardEmbedTarget.
 */
export const TROPICAL_BASIN_BOUNDS = {
  south: 8.0,
  west: -125.0,
  north: 50.0,
  east: -50.0,
};

/** Pacific non-CONUS codes — keep state/alert framing, not Atlantic basin. */
export const PACIFIC_NON_CONUS_CODES = new Set(['AK', 'HI', 'GU', 'AS', 'MP']);

/** Lon/lat span (degrees) above which we treat alerts as nationally broad. */
export const BROAD_SPAN_LON_DEG = 28;
export const BROAD_SPAN_LAT_DEG = 18;

/** Distinct state codes above which we fall back to CONUS. */
export const BROAD_STATE_COUNT = 6;

/** Embedded mobile fitBounds padding (alert clusters / state pages). */
export const EMBED_MOBILE_PADDING = [36, 28];
export const EMBED_STATE_PADDING = [32, 24];
/**
 * Tight lower-48 fit for hazard embeds (empty / broad / CONUS fallback).
 * Looser [36, 28] left too much Canada / ocean and crowded state labels.
 */
export const EMBED_CONUS_PADDING = [16, 12];
/**
 * Padding for homepage /alerts /radar CONUS fitBounds.
 * Slightly looser than hazard-embed CONUS padding so Pacific + Atlantic
 * coasts stay in frame in wide map columns.
 */
export const HOME_CONUS_PADDING = [28, 24];
/** Cap for full-page CONUS fit — keeps both coasts visible in map columns. */
export const HOME_CONUS_MAX_ZOOM = 5.25;

/** Cap zoom so single alerts stay regional, not street-level. */
export const EMBED_MAX_ZOOM = 8;
/** Allow CONUS fitBounds to fill hazard embeds; still below street-level. */
export const EMBED_CONUS_MAX_ZOOM = 6;
export const EMBED_SINGLE_ALERT_ZOOM = 7;
/** Alaska is large — keep a wider regional view than CONUS counties. */
export const EMBED_ALASKA_MAX_ZOOM = 5;
export const EMBED_HAWAII_MAX_ZOOM = 7;
/** Puerto Rico / USVI / Pacific territories — regional, not street-level. */
export const EMBED_TERRITORY_MAX_ZOOM = 8;
/** Tropical basin embeds — CONUS + Caribbean; high enough for visible precip. */
export const EMBED_TROPICAL_MAX_ZOOM = 5;
export const EMBED_TROPICAL_PADDING = [14, 12];

function conusEmbedTarget() {
  return {
    bounds: CONUS_BOUNDS,
    mode: 'conus',
    maxZoom: EMBED_CONUS_MAX_ZOOM,
    padding: EMBED_CONUS_PADDING,
  };
}

function tropicalBasinEmbedTarget() {
  return {
    bounds: TROPICAL_BASIN_BOUNDS,
    mode: 'tropical_basin',
    maxZoom: EMBED_TROPICAL_MAX_ZOOM,
    padding: EMBED_TROPICAL_PADDING,
  };
}

/**
 * States/territories outside the default lower-48 radar frame.
 * Caribbean (PR/VI) and Pacific (GU/AS/MP) sit south/west of CONUS_BOUNDS —
 * without this, tropical alerts frame as CONUS and markers fall off-map.
 */
export const NON_CONUS_STATE_CODES = new Set(['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP']);

/**
 * Approximate bounding boxes for territories missing from STATE_GEOJSON
 * (us-atlas lower-48 + AK/HI/DC only). Used by getStateBounds / embeds.
 */
export const TERRITORY_BOUNDS = {
  PR: { south: 17.85, west: -67.95, north: 18.55, east: -65.20 },
  VI: { south: 17.65, west: -65.10, north: 18.45, east: -64.55 },
  GU: { south: 13.22, west: 144.60, north: 13.67, east: 145.01 },
  AS: { south: -14.40, west: -170.85, north: -14.15, east: -169.40 },
  MP: { south: 14.05, west: 145.10, north: 15.30, east: 145.90 },
};

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
 * True when an alert is outside the lower-48 (AK/HI/territories, or coords).
 * These never appear in the default CONUS radar frame.
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
  // Puerto Rico / US Virgin Islands (Caribbean — south of CONUS_BOUNDS.south)
  if (lat >= 17.5 && lat <= 19.5 && lon >= -68.5 && lon <= -64.3) return true;
  // Guam / Northern Mariana Islands (western Pacific, eastern hemisphere)
  if (lat >= 13 && lat <= 21 && lon >= 144 && lon <= 147) return true;
  // American Samoa (south Pacific)
  if (lat >= -15 && lat <= -13 && lon >= -172 && lon <= -168) return true;
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
  // Caribbean / Pacific territories
  if ([...states].some((c) => ['PR', 'VI', 'GU', 'AS', 'MP'].includes(c))) {
    return EMBED_TERRITORY_MAX_ZOOM;
  }
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
  if (!stateCode) return null;
  if (TERRITORY_BOUNDS[stateCode]) {
    return { ...TERRITORY_BOUNDS[stateCode] };
  }
  if (!STATE_GEOJSON[stateCode]) return null;
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
 * Non-CONUS (AK/HI/territories): always frame those alerts / that state —
 * never fall back to the lower-48 CONUS box (Alaska's footprint alone looks
 * "broad" by span; PR/VI sit south of CONUS_BOUNDS).
 *
 * @param {object[]} alerts
 * @param {{ mapFamily?: 'tropical'|null }} [options]
 *   mapFamily 'tropical' → CONUS + Caribbean basin (incl. PR/VI approaches)
 *   unless alerts are Pacific-only (AK/HI/GU/AS/MP).
 */
export function resolveHazardEmbedTarget(alerts, options = {}) {
  const list = alerts || [];
  const mapFamily = options.mapFamily || null;

  if (mapFamily === 'tropical') {
    return resolveTropicalHazardEmbedTarget(list);
  }

  if (list.length === 0) {
    return conusEmbedTarget();
  }

  const outside = list.filter(isOutsideConusAlert);
  const allOutside = outside.length === list.length;

  if (allOutside) {
    return resolveNonConusHazardEmbedTarget(list);
  }

  // Mixed non-CONUS + CONUS: frame from lower-48 points only so Alaska/Hawaii/
  // Caribbean/Pacific markers cannot force a world-wide / overly broad embed.
  const conusList = list.filter((a) => !isOutsideConusAlert(a));
  const bounds = boundsFromAlertPoints(conusList);
  if (!isValidBounds(bounds)) {
    return conusEmbedTarget();
  }

  if (conusList.length === 1) {
    return {
      bounds: singleAlertBounds(conusList[0], 1.2),
      mode: 'single',
      maxZoom: EMBED_SINGLE_ALERT_ZOOM,
    };
  }

  if (isBroadlyDistributed(bounds, conusList)) {
    return conusEmbedTarget();
  }

  return { bounds, mode: 'alerts', maxZoom: EMBED_MAX_ZOOM };
}

/**
 * Tropical-family embeds: prefer CONUS + Caribbean basin so PR/VI and
 * Atlantic approaches stay in view without a globe-scale zoom that hides
 * RainViewer precip. Do not fall back to CONUS-only (clips Caribbean).
 * Pacific-only tropical products keep AK/HI/territory framing.
 */
function resolveTropicalHazardEmbedTarget(list) {
  if (list.length === 0) {
    return tropicalBasinEmbedTarget();
  }

  const stateCodes = new Set(list.map((a) => a.state).filter(Boolean));
  const allPacific = [...stateCodes].length > 0
    && [...stateCodes].every((c) => PACIFIC_NON_CONUS_CODES.has(c));
  const allOutside = list.every(isOutsideConusAlert);

  if (allOutside && allPacific) {
    return resolveNonConusHazardEmbedTarget(list);
  }

  return tropicalBasinEmbedTarget();
}

function resolveNonConusHazardEmbedTarget(list) {
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

  return conusEmbedTarget();
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
  else if (NON_CONUS_STATE_CODES.has(stateCode)) maxZoom = EMBED_TERRITORY_MAX_ZOOM;
  return { bounds, mode: 'state', maxZoom };
}

/** Convert plain bounds → Leaflet LatLngBounds (call only in browser/map code). */
export function toLeafletBounds(L, bounds) {
  const b = bounds || CONUS_BOUNDS;
  return L.latLngBounds([b.south, b.west], [b.north, b.east]);
}
