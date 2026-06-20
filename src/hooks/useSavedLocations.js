/**
 * useSavedLocations — the saved-locations abstraction.
 *
 * Anonymous users keep using localStorage — UNLIMITED saves, device-local only.
 * Signed-in users get cloud-synced locations via Supabase (locationsRepo).
 *
 * On sign-in, any device-local pins missing from the account are merged up
 * automatically (idempotent — DB de-dupes by lat/lon). Account locations are
 * never deleted during merge.
 *
 * This hook deliberately does NOT replace ZipCodeSearch's internal weather-
 * fetching localStorage cache — it sits alongside it to provide: the anon
 * cap, the authenticated DB sync, and the device→account import.
 *
 * Weather access never depends on any of this — it's all opt-in convenience.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import {
  listUserLocations,
  addUserLocation,
  removeUserLocation,
  parseStateFromName,
  filterLocalOnlyCandidates,
} from '../lib/locationsRepo';
import { trackLocationsSynced } from '../utils/analytics';

// Anonymous saving is UNLIMITED — locations just stay on that device/browser.
// This threshold only decides when to show a gentle, dismissible "sign in to
// sync" CTA. It never blocks saving.
export const SYNC_CTA_THRESHOLD = 3;

// Legacy localStorage keys (must match App.jsx / ZipCodeSearch.jsx).
const SEARCH_LOCATIONS_KEY = 'winterStorm_userLocations';   // { id: { data, onMap } }
const ALERT_LOCATIONS_KEY = 'winterStorm_alertLocations';   // [ { id, name, lat, lon, ... } ]
const MIGRATED_FLAG = 'st_locations_migrated';

/**
 * Read both legacy localStorage keys and normalize to import candidates.
 * @returns {{ name: string, state: string|null, lat: number, lon: number, zip: string|null }[]}
 */
/** All saved location data from device localStorage (full objects, any on-map state). */
export function readStoredSavedLocations() {
  if (typeof window === 'undefined') return [];
  const out = [];

  try {
    const raw = localStorage.getItem(SEARCH_LOCATIONS_KEY);
    if (raw) {
      const obj = JSON.parse(raw) || {};
      for (const entry of Object.values(obj)) {
        if (entry?.data?.lat != null && entry?.data?.lon != null) {
          out.push(entry.data);
        }
      }
    }
  } catch (e) {
    console.error('readStoredSavedLocations (search) error:', e);
  }

  try {
    const raw = localStorage.getItem(ALERT_LOCATIONS_KEY);
    if (raw) {
      for (const d of JSON.parse(raw) || []) {
        if (d?.lat != null && d?.lon != null) out.push(d);
      }
    }
  } catch (e) {
    console.error('readStoredSavedLocations (alert) error:', e);
  }

  const seen = new Set();
  return out.filter((loc) => {
    const key = `${Number(loc.lat).toFixed(2)},${Number(loc.lon).toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** On-map pins from device localStorage (search + alert keys). */
export function readOnMapSavedLocations() {
  if (typeof window === 'undefined') return [];
  const out = [];

  try {
    const raw = localStorage.getItem(SEARCH_LOCATIONS_KEY);
    if (raw) {
      const obj = JSON.parse(raw) || {};
      for (const entry of Object.values(obj)) {
        if (entry?.onMap && entry?.data?.lat != null && entry?.data?.lon != null) {
          out.push(entry.data);
        }
      }
    }
  } catch (e) {
    console.error('readOnMapSavedLocations (search) error:', e);
  }

  try {
    const raw = localStorage.getItem(ALERT_LOCATIONS_KEY);
    if (raw) {
      for (const d of JSON.parse(raw) || []) {
        if (d?.lat != null && d?.lon != null) out.push(d);
      }
    }
  } catch (e) {
    console.error('readOnMapSavedLocations (alert) error:', e);
  }

  return out;
}

export function readLocalLocations() {
  if (typeof window === 'undefined') return [];
  const out = [];

  try {
    const raw = localStorage.getItem(SEARCH_LOCATIONS_KEY);
    if (raw) {
      const obj = JSON.parse(raw) || {};
      for (const entry of Object.values(obj)) {
        const d = entry?.data;
        if (d && d.lat != null && d.lon != null) {
          out.push({
            name: d.name,
            state: parseStateFromName(d.name),
            lat: Number(d.lat),
            lon: Number(d.lon),
            zip: d.zip ?? null,
          });
        }
      }
    }
  } catch (e) {
    console.error('readLocalLocations (search) error:', e);
  }

  try {
    const raw = localStorage.getItem(ALERT_LOCATIONS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) || [];
      for (const d of arr) {
        if (d && d.lat != null && d.lon != null) {
          out.push({
            name: d.name,
            state: parseStateFromName(d.name),
            lat: Number(d.lat),
            lon: Number(d.lon),
            zip: d.zip ?? null,
          });
        }
      }
    }
  } catch (e) {
    console.error('readLocalLocations (alert) error:', e);
  }

  // De-dupe by rounded lat/lon (mirrors the DB geo_key) so the import count
  // the user sees matches what actually lands in their account.
  const seen = new Set();
  return out.filter((l) => {
    const key = `${l.lat.toFixed(2)},${l.lon.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isMigrated() {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(MIGRATED_FLAG) === '1';
  } catch {
    return false;
  }
}

function markMigratedFlag() {
  try {
    localStorage.setItem(MIGRATED_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export function useSavedLocations() {
  const { user, isAuthenticated } = useAuth();
  const [dbLocations, setDbLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncedCount, setSyncedCount] = useState(null);
  const syncedForUserRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setDbLocations([]);
      return;
    }
    setLoading(true);
    const rows = await listUserLocations();
    setDbLocations(rows);
    setLoading(false);
  }, [isAuthenticated]);

  /**
   * Upload local-only pins to the account. Skips locations already saved
   * (by rounded lat/lon). Returns how many were newly linked.
   */
  const syncLocalToAccount = useCallback(async (dbRows) => {
    const accountRows = dbRows ?? (await listUserLocations());
    const localCandidates = readLocalLocations();
    const toUpload = filterLocalOnlyCandidates(localCandidates, accountRows);

    if (toUpload.length === 0) {
      markMigratedFlag();
      return { imported: 0, accountRows };
    }

    let imported = 0;
    for (let i = 0; i < toUpload.length; i++) {
      const saved = await addUserLocation({
        ...toUpload[i],
        sortOrder: accountRows.length + i,
      });
      if (saved) imported += 1;
    }

    markMigratedFlag();
    const updated = imported > 0 ? await listUserLocations() : accountRows;

    if (imported > 0) {
      setSyncedCount(imported);
      trackLocationsSynced({ syncedCount: imported, localCount: localCandidates.length });
    }

    return { imported, accountRows: updated };
  }, []);

  // Load account locations and merge any device-local pins on sign-in.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setDbLocations([]);
      setSyncedCount(null);
      syncedForUserRef.current = null;
      return;
    }

    // One successful sync per user per page load (ref set only after completion
    // so React Strict Mode's double-mount still runs sync once).
    if (syncedForUserRef.current === user.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { imported, accountRows } = await syncLocalToAccount();
        if (!cancelled) {
          setDbLocations(accountRows);
          syncedForUserRef.current = user.id;
          if (imported === 0) setSyncedCount(null);
        }
      } catch (e) {
        console.error('syncLocalToAccount error:', e);
        if (!cancelled) {
          const rows = await listUserLocations();
          setDbLocations(rows);
          syncedForUserRef.current = user.id;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, syncLocalToAccount]);

  /** Add a single location to the signed-in user's account. */
  const addToAccount = useCallback(
    async (loc) => {
      const saved = await addUserLocation(loc);
      if (saved) await refresh();
      return saved;
    },
    [refresh]
  );

  /** Remove a saved DB location by its user_locations id. */
  const removeFromAccount = useCallback(
    async (userLocationId) => {
      const ok = await removeUserLocation(userLocationId);
      if (ok) await refresh();
      return ok;
    },
    [refresh]
  );

  /**
   * Bulk-import device localStorage locations missing from the account.
   * Returns the number successfully imported.
   */
  const importLocalLocations = useCallback(
    async (candidates) => {
      const list = candidates || readLocalLocations();
      const dbRows = await listUserLocations();
      const toUpload = filterLocalOnlyCandidates(list, dbRows);
      let imported = 0;
      for (let i = 0; i < toUpload.length; i++) {
        const saved = await addUserLocation({ ...toUpload[i], sortOrder: dbRows.length + i });
        if (saved) imported += 1;
      }
      markMigratedFlag();
      const updated = imported > 0 ? await listUserLocations() : dbRows;
      setDbLocations(updated);
      if (imported > 0) {
        setSyncedCount(imported);
        trackLocationsSynced({ syncedCount: imported, localCount: list.length });
      }
      return imported;
    },
    []
  );

  const markMigrated = useCallback(() => markMigratedFlag(), []);

  const localCandidates = readLocalLocations();

  return {
    isAuthenticated,
    loading,
    // Saving is never capped; this only gates the dismissible sync CTA.
    syncCtaThreshold: SYNC_CTA_THRESHOLD,
    // Authenticated, cloud-synced locations.
    dbLocations,
    syncedCount,
    refresh,
    addToAccount,
    removeFromAccount,
    // Device → account migration (auto on sign-in; manual import still available).
    hasLocalLocations: localCandidates.length > 0,
    localLocationCount: localCandidates.length,
    needsMigration: false,
    importLocalLocations,
    markMigrated,
  };
}

export default useSavedLocations;
