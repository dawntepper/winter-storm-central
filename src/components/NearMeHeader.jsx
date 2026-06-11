import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchApproxLocation, reverseGeocode } from '../services/geoLocationService';
import { ABBR_TO_SLUG, US_STATES } from '../data/stateConfig';
import { getCitySlugForLocation } from '../utils/cityLookup';
import { trackGeolocationUsed, trackBrowseByStateClick, NAV_SOURCES } from '../utils/analytics';

/**
 * Localized homepage hero headline + jump-to links.
 *
 * SEO: static fallback copy renders on first paint; location suffix is UX-only.
 * Layer 1 (silent IP geo) personalizes the title — header text only, no map move.
 * Layer 2 (hero CTA): GPS "Find Weather Near Me" or "Change Location" when a
 * place is already known. Check Location card below offers detailed search.
 */
export default function NearMeHeader({
  as = 'h1',
  onLocate,
  onChangeLocation,
  onResolveState,
  resolvedLocation = null,
  onResolved,
  className = '',
  headingClassName = '',
}) {
  const HeadingTag = as;
  const FALLBACK_HEADING = 'Live Weather & Alerts';

  const [internalResolved, setInternalResolved] = useState(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle');

  const resolved = resolvedLocation ?? internalResolved;

  const setResolved = (loc) => {
    if (onResolved) onResolved(loc);
    else setInternalResolved(loc);
  };

  // Layer 1 — silent IP geo. Header text + jump links only.
  useEffect(() => {
    let cancelled = false;
    fetchApproxLocation().then((loc) => {
      if (cancelled || !loc?.city) return;
      const next = { city: loc.city, region: loc.region || null };
      setResolved(next);
      if (loc.region) onResolveState?.(loc.region);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let status;
    const sync = () => setGeoDenied(status.state === 'denied');
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        status = s;
        sync();
        status.onchange = sync;
      })
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  const handleFindNearMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        trackGeolocationUsed();
        onLocate?.({
          lat: latitude,
          lon: longitude,
          zoom: 9,
          id: `nearme-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
        });
        const place = await reverseGeocode(latitude, longitude);
        if (place?.city) {
          setResolved({ city: place.city, region: place.region || null });
          if (place.region) onResolveState?.(place.region);
        }
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [onLocate, onResolveState]);

  if (geoDenied || gpsStatus === 'denied') return null;

  const region = resolved?.region || null;
  const label = resolved ? (region ? `${resolved.city}, ${region}` : resolved.city) : null;
  const heading = label ? `Weather Near ${label}` : FALLBACK_HEADING;

  const showLocationAction = Boolean(onLocate || onChangeLocation);
  const useChangeLocation = Boolean(resolved && onChangeLocation);

  const handlePrimaryAction = () => {
    if (useChangeLocation) onChangeLocation();
    else handleFindNearMe();
  };

  const primaryLabel = useChangeLocation
    ? 'Change Location'
    : gpsStatus === 'locating'
      ? 'Locating…'
      : 'Find Weather Near Me';

  const stateSlug = region ? ABBR_TO_SLUG[region] : null;
  const stateName = stateSlug ? US_STATES[stateSlug]?.name : null;
  const citySlug =
    resolved?.city && region ? getCitySlugForLocation(`${resolved.city}, ${region}`) : null;
  const hasJumpLinks = Boolean(stateSlug || citySlug);

  const cityLinkClass =
    'inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-medium text-sky-300/90 hover:text-sky-200 border border-sky-500/25 hover:border-sky-500/45 bg-sky-950/25 hover:bg-sky-950/40 transition-colors';
  const stateLinkClass =
    'inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-medium text-emerald-300/90 hover:text-emerald-200 border border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-950/25 hover:bg-emerald-950/40 transition-colors';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className={showLocationAction ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : undefined}>
        <HeadingTag className={headingClassName || 'text-xl sm:text-2xl font-bold text-white'}>
          {heading}
        </HeadingTag>
        {showLocationAction && (
          <div className="flex flex-col items-stretch sm:items-end gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!useChangeLocation && gpsStatus === 'locating'}
              aria-label={
                useChangeLocation
                  ? 'Change your location'
                  : 'Find weather near me using your device location'
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 border border-sky-500/60 text-white text-sm font-semibold rounded-lg shadow-sm shadow-sky-900/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span aria-hidden="true">{useChangeLocation ? '📍' : '🎯'}</span>
              {primaryLabel}
            </button>
            {!useChangeLocation && gpsStatus === 'unsupported' && (
              <span className="text-[11px] text-amber-400 sm:text-right">Geolocation unavailable on this device.</span>
            )}
            {!useChangeLocation && gpsStatus === 'error' && (
              <span className="text-[11px] text-amber-400 sm:text-right">Couldn&apos;t get your location — try again.</span>
            )}
          </div>
        )}
      </div>

      {hasJumpLinks && (
        <nav aria-label="Jump to local alerts and forecasts" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs text-slate-500 font-medium">Jump to:</span>
          {citySlug && (
            <Link to={`/alerts/${citySlug}`} className={cityLinkClass}>
              {resolved.city} alerts
            </Link>
          )}
          {stateSlug && (
            <Link
              to={`/alerts/${stateSlug}`}
              onClick={() => trackBrowseByStateClick({ stateCode: region, source: NAV_SOURCES.NEAR_ME_HEADER })}
              className={stateLinkClass}
            >
              {stateName} alerts &amp; city forecasts
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
