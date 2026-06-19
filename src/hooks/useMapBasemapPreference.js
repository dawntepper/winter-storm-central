import { useCallback, useSyncExternalStore } from 'react';

export const MAP_BASEMAP_STORAGE_KEY = 'stormtracking-map-basemap';

const VALID_PREFERENCES = new Set(['dark', 'light', 'system']);

export const BASEMAP_PREFERENCE_LABELS = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

export const BASEMAP_PREFERENCE_CYCLE = ['dark', 'light', 'system'];

const PREFERENCE_CYCLE = BASEMAP_PREFERENCE_CYCLE;

const preferenceListeners = new Set();

function getSystemPrefersDark() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readPreference() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(MAP_BASEMAP_STORAGE_KEY);
    if (stored && VALID_PREFERENCES.has(stored)) return stored;
  } catch {
    // ignore localStorage errors
  }
  return 'dark';
}

let preferenceSnapshot = readPreference();

function emitPreferenceChange() {
  preferenceListeners.forEach((listener) => listener());
}

function subscribePreference(listener) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

function getPreferenceSnapshot() {
  return preferenceSnapshot;
}

function subscribeSystemPrefersDark(callback) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

export function resolveEffectiveBasemap(preference) {
  if (preference === 'light') return 'light';
  if (preference === 'system') return getSystemPrefersDark() ? 'dark' : 'light';
  return 'dark';
}

export function useMapBasemapPreference() {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    () => 'dark',
  );

  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemPrefersDark,
    getSystemPrefersDark,
    () => true,
  );

  const setPreference = useCallback((next) => {
    const value = typeof next === 'function' ? next(preferenceSnapshot) : next;
    if (!VALID_PREFERENCES.has(value) || value === preferenceSnapshot) return;
    preferenceSnapshot = value;
    try {
      localStorage.setItem(MAP_BASEMAP_STORAGE_KEY, value);
    } catch {
      // ignore localStorage errors
    }
    emitPreferenceChange();
  }, []);

  const cyclePreference = useCallback(() => {
    const idx = PREFERENCE_CYCLE.indexOf(preferenceSnapshot);
    setPreference(PREFERENCE_CYCLE[(idx + 1) % PREFERENCE_CYCLE.length]);
  }, [setPreference]);

  const effectiveBasemap = preference === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : preference;

  return { preference, setPreference, cyclePreference, effectiveBasemap };
}
