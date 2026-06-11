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
 * GPS "Use My Location" lives in ZipCodeSearch; parent passes resolved updates
 * via onResolved / resolvedLocation props.
 */
export default function NearMeHeader({
  as = 'h1',
  onLocate,
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
  const heading = label ? `Live Weather & Alerts — ${label}` : FALLBACK_HEADING;

  const stateSlug = region ? ABBR_TO_SLUG[region] : null;
  const stateName = stateSlug ? US_STATES[stateSlug]?.name : null;
  const citySlug =
    resolved?.city && region ? getCitySlugForLocation(`${resolved.city}, ${region}`) : null;
  const hasJumpLinks = Boolean(stateSlug || citySlug);

  const linkClass =
    'text-[11px] sm:text-xs text-slate-500 hover:text-sky-400 transition-colors';

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className={onLocate ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : undefined}>
        <HeadingTag className={headingClassName || 'text-xl sm:text-2xl font-bold text-white'}>
          {heading}
        </HeadingTag>
        {onLocate && (
          <div className="flex flex-col items-start gap-1 sm:items-end flex-shrink-0">
            <button
              type="button"
              onClick={handleFindNearMe}
              disabled={gpsStatus === 'locating'}
              aria-label="Find weather near me using your device location"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 border border-sky-500/40 text-sky-300 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <span aria-hidden="true">🎯</span>
              {gpsStatus === 'locating' ? 'Locating…' : 'Find Weather Near Me'}
            </button>
            {gpsStatus === 'unsupported' && (
              <span className="text-[11px] text-amber-400">Geolocation unavailable on this device.</span>
            )}
            {gpsStatus === 'error' && (
              <span className="text-[11px] text-amber-400">Couldn&apos;t get your location — try again.</span>
            )}
          </div>
        )}
      </div>

      {hasJumpLinks && (
        <nav aria-label="Jump to local alerts and forecasts" className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[11px] text-slate-600">Jump to:</span>
          {citySlug && (
            <Link to={`/alerts/${citySlug}`} className={linkClass}>
              {resolved.city} alerts
            </Link>
          )}
          {citySlug && stateSlug && <span aria-hidden="true" className="text-slate-700">·</span>}
          {stateSlug && (
            <Link
              to={`/alerts/${stateSlug}`}
              onClick={() => trackBrowseByStateClick({ stateCode: region, source: NAV_SOURCES.NEAR_ME_HEADER })}
              className={linkClass}
            >
              {stateName} alerts &amp; city forecasts
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
