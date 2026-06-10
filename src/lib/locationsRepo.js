/**
 * Locations repository — Supabase data access for saved locations.
 *
 * Wraps the canonical `locations` catalog + the per-user `user_locations`
 * join rows behind a small, app-shaped API. The hook (useSavedLocations)
 * and the device→account import flow are the only callers.
 *
 * All writes to the canonical catalog go through the get_or_create_location
 * RPC (SECURITY DEFINER) so users never insert into `locations` directly.
 *
 * @typedef {Object} SavedLocation
 * @property {string} userLocationId  user_locations.id (the row to delete/update)
 * @property {string} locationId      locations.id
 * @property {string} name
 * @property {string|null} state
 * @property {number} lat
 * @property {number} lon
 * @property {string|null} zip
 * @property {string|null} nickname
 * @property {boolean} isPrimary
 * @property {number} sortOrder
 */

import { supabase } from './supabase';

/**
 * Best-effort 2-letter state extraction from a "City, ST" name.
 * Returns null when the trailing token isn't a 2-letter code.
 */
export function parseStateFromName(name) {
  const m = String(name || '').match(/,\s*([A-Za-z]{2})\s*$/);
  return m ? m[1].toUpperCase() : null;
}

/** Rounded lat/lon key — mirrors DB geo dedupe and App.jsx merge-down. */
export function locationGeoKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

/**
 * Local candidates that are not already saved on the account (by geo key).
 * @param {{ lat: number, lon: number }[]} localCandidates
 * @param {SavedLocation[]} dbLocations
 */
export function filterLocalOnlyCandidates(localCandidates, dbLocations) {
  const accountKeys = new Set(
    (dbLocations || [])
      .filter((d) => d.lat != null && d.lon != null)
      .map((d) => locationGeoKey(d.lat, d.lon))
  );
  return (localCandidates || []).filter(
    (l) => l.lat != null && l.lon != null && !accountKeys.has(locationGeoKey(l.lat, l.lon))
  );
}

/** Map a joined user_locations + locations row to a SavedLocation. */
function mapRow(row) {
  const loc = row.locations || {};
  return {
    userLocationId: row.id,
    locationId: row.location_id,
    name: loc.name,
    state: loc.state ?? null,
    lat: loc.latitude != null ? Number(loc.latitude) : null,
    lon: loc.longitude != null ? Number(loc.longitude) : null,
    zip: loc.zip ?? null,
    nickname: row.nickname ?? null,
    isPrimary: !!row.is_primary,
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * List the signed-in user's saved locations (joined to the catalog).
 * @returns {Promise<SavedLocation[]>}
 */
export async function listUserLocations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_locations')
    .select(
      'id, location_id, nickname, is_primary, sort_order, created_at, ' +
        'locations:location_id ( id, name, state, latitude, longitude, zip )'
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listUserLocations error:', error);
    return [];
  }
  return (data || []).map(mapRow);
}

/**
 * Resolve (or create) a canonical location, then save it for the current user.
 * Idempotent: a duplicate (user_id, location_id) is ignored, and the existing
 * row is returned instead.
 *
 * @param {{ name: string, state?: string|null, lat: number, lon: number,
 *           zip?: string|null, nickname?: string|null, sortOrder?: number }} input
 * @returns {Promise<SavedLocation|null>}
 */
export async function addUserLocation(input) {
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const state = input.state ?? parseStateFromName(input.name);

  // 1) Resolve/create the canonical location via the SECURITY DEFINER RPC.
  const { data: locationId, error: rpcError } = await supabase.rpc('get_or_create_location', {
    p_name: input.name,
    p_state: state,
    p_lat: input.lat,
    p_lon: input.lon,
    p_zip: input.zip ?? null,
  });
  if (rpcError) {
    console.error('get_or_create_location error:', rpcError);
    return null;
  }

  // 2) Link it to the user. Ignore a duplicate save and re-read the row.
  const { data: inserted, error: insertError } = await supabase
    .from('user_locations')
    .insert({
      user_id: user.id,
      location_id: locationId,
      nickname: input.nickname ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select(
      'id, location_id, nickname, is_primary, sort_order, created_at, ' +
        'locations:location_id ( id, name, state, latitude, longitude, zip )'
    )
    .single();

  if (insertError) {
    // 23505 = unique_violation → already saved; fetch and return the existing row.
    if (insertError.code === '23505') {
      const { data: existing } = await supabase
        .from('user_locations')
        .select(
          'id, location_id, nickname, is_primary, sort_order, created_at, ' +
            'locations:location_id ( id, name, state, latitude, longitude, zip )'
        )
        .eq('user_id', user.id)
        .eq('location_id', locationId)
        .single();
      return existing ? mapRow(existing) : null;
    }
    console.error('addUserLocation insert error:', insertError);
    return null;
  }

  return mapRow(inserted);
}

/** Remove a saved location by its user_locations id. */
export async function removeUserLocation(userLocationId) {
  if (!supabase) return false;
  const { error } = await supabase.from('user_locations').delete().eq('id', userLocationId);
  if (error) {
    console.error('removeUserLocation error:', error);
    return false;
  }
  return true;
}

/**
 * Mark one saved location as primary (clears any previous primary first to
 * satisfy the one-primary-per-user partial unique index).
 */
export async function setPrimaryUserLocation(userLocationId) {
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error: clearErr } = await supabase
    .from('user_locations')
    .update({ is_primary: false })
    .eq('user_id', user.id)
    .eq('is_primary', true);
  if (clearErr) {
    console.error('setPrimary clear error:', clearErr);
    return false;
  }

  const { error } = await supabase
    .from('user_locations')
    .update({ is_primary: true })
    .eq('id', userLocationId);
  if (error) {
    console.error('setPrimary set error:', error);
    return false;
  }
  return true;
}
