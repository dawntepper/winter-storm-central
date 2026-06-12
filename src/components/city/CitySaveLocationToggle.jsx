import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackLocationAdded, trackLocationRemoved, SAVE_TRIGGERS } from '../../utils/analytics';
import { ensureCityFromSavedLocation } from '../../services/locationCatalogService';

const LOCATIONS_KEY = 'winterStorm_userLocations';

function readSavedLocations() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function countOnMapLocations(locations) {
  return Object.values(locations).filter((entry) => entry?.onMap).length;
}

function writeSavedLocations(locations) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
  window.dispatchEvent(new CustomEvent('savedLocationsChanged'));
}

/**
 * Save-location toggle for city alert pages — mirrors ZipCodeSearch localStorage shape.
 */
export default function CitySaveLocationToggle({
  locationName,
  lat,
  lon,
  citySlug,
  stateCode,
  variant = 'card',
}) {
  const locationId = useMemo(() => {
    if (citySlug) return `city-${citySlug}`;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `geo-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    }
    return null;
  }, [citySlug, lat, lon]);

  const [saved, setSaved] = useState(false);

  const refreshSavedState = useCallback(() => {
    if (!locationId) return;
    const locations = readSavedLocations();
    setSaved(Boolean(locations[locationId]?.onMap));
  }, [locationId]);

  useEffect(() => {
    refreshSavedState();
    const handler = () => refreshSavedState();
    window.addEventListener('savedLocationsChanged', handler);
    return () => window.removeEventListener('savedLocationsChanged', handler);
  }, [refreshSavedState]);

  if (!locationId || !locationName || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const handleToggle = (checked) => {
    const locations = readSavedLocations();
    const previousCount = countOnMapLocations(locations);
    const locationData = {
      name: locationName,
      lat,
      lon,
      ...(citySlug ? { citySlug } : {}),
      id: `user-${locationId}`,
    };

    if (checked) {
      trackLocationAdded({
        trigger: SAVE_TRIGGERS.CITY_PAGE,
        locationName,
        previousCount,
      });
      ensureCityFromSavedLocation({
        label: locationName,
        lat,
        lon,
      }).then((result) => {
        if (!result?.citySlug) return;
        const updated = readSavedLocations();
        const entry = updated[locationId];
        if (entry?.data) {
          entry.data.citySlug = result.citySlug;
          writeSavedLocations(updated);
        }
      });
      locations[locationId] = { data: locationData, onMap: true };
    } else {
      trackLocationRemoved({
        trigger: SAVE_TRIGGERS.CITY_PAGE,
        locationName,
        remainingCount: Math.max(0, previousCount - 1),
      });
      delete locations[locationId];
    }

    writeSavedLocations(locations);
    setSaved(checked);
  };

  if (variant === 'inline') {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-400 hover:text-slate-300 transition-colors shrink-0">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => handleToggle(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
        />
        <span>Save to map</span>
      </label>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => handleToggle(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
        />
        <span className="text-sm text-slate-200">
          Save {locationName} to your map
        </span>
      </label>
      <p className="text-xs text-slate-500 mt-1.5 ml-6">
        Pin this city on the homepage radar and get quick access from Your Locations.
      </p>
    </div>
  );
}
