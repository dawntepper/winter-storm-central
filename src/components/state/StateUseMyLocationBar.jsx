import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveCityPageFromCoords } from '../../services/locationCatalogService';
import {
  trackUseMyLocationClick,
  trackCityPageLocationChanged,
  trackGeolocationUsed,
  FORECAST_SOURCE_PAGES,
} from '../../utils/analytics';

function CrosshairIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function NavigationIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

/**
 * Full-width "Use My Location" bar for state alert pages.
 */
export default function StateUseMyLocationBar({ stateCode }) {
  const navigate = useNavigate();
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleUseMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setError('');
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        trackGeolocationUsed();
        try {
          const resolved = await resolveCityPageFromCoords(latitude, longitude);
          trackUseMyLocationClick({
            sourcePage: FORECAST_SOURCE_PAGES.STATE_ALERT_PAGE,
            currentCity: null,
            currentState: stateCode,
            resolvedCity: resolved.cityName,
            resolvedState: resolved.stateCode,
            navigationSuccess: resolved.navigationSuccess,
          });

          if (resolved.navigationSuccess && resolved.path) {
            trackCityPageLocationChanged({
              fromCity: null,
              fromState: stateCode,
              toCity: resolved.cityName,
              toState: resolved.stateCode,
              source: 'use_my_location',
            });
            navigate(resolved.path);
            setGpsStatus('idle');
            return;
          }

          setError(resolved.fallbackMessage || 'Could not find a city page near you.');
        } catch (err) {
          console.warn('Use My Location failed:', err);
          setError('Could not resolve your location — try searching instead.');
        }
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [navigate, stateCode]);

  const gpsMessage =
    gpsStatus === 'unsupported'
      ? 'Geolocation unavailable on this device.'
      : gpsStatus === 'denied'
        ? 'Location access blocked in browser settings.'
        : gpsStatus === 'error'
          ? 'Could not get your location — try again.'
          : null;

  const isLocating = gpsStatus === 'locating';

  return (
    <section className="mt-3" aria-label="Use my location">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <CrosshairIcon className="h-5 w-5" />
          </span>
          <div className="hidden h-8 w-px shrink-0 bg-slate-600 sm:block" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <p className="shrink-0 text-sm sm:text-base font-bold text-white">Use My Location</p>
            <div className="hidden h-5 w-px shrink-0 bg-slate-600 sm:block" aria-hidden="true" />
            <p className="min-w-0 text-xs sm:text-sm text-slate-400 leading-snug">
              Get weather alerts and forecasts for your exact location
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          aria-label="Use my device location"
          className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50 cursor-pointer"
        >
          <NavigationIcon className="h-4 w-4" />
          {isLocating ? 'Locating…' : 'Use My Location'}
        </button>
      </div>
      {(gpsMessage || error) && (
        <p className="mt-2 text-xs sm:text-sm text-amber-400">{error || gpsMessage}</p>
      )}
    </section>
  );
}
