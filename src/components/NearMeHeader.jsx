import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchApproxLocation, reverseGeocode } from '../services/geoLocationService';
import { ABBR_TO_SLUG, US_STATES } from '../data/stateConfig';
import { getCitySlugForLocation } from '../utils/cityLookup';
import { trackGeolocationUsed, trackBrowseByStateClick, NAV_SOURCES } from '../utils/analytics';
import { trackLocationSearch } from '../services/locationCatalogService';

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
  variant = 'default',
  onLocate,
  onChangeLocation,
  onResolveState,
  resolvedLocation = null,
  onResolved,
  locationContext = null,
  className = '',
  headingClassName = '',
}) {
  const HeadingTag = as;
  const isRadar = variant === 'radar';
  const FALLBACK_HEADING = variant === 'radar' ? 'Live Weather Radar' : 'Live Weather & Alerts';

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
        const queryLabel = place?.city
          ? `${place.city}${place.region ? `, ${place.region}` : ''}`
          : `Near me (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
        await trackLocationSearch({
          query: queryLabel,
          matchType: 'gps',
          stateCode: place?.region || null,
          pageContext: variant === 'radar' ? 'radar-hero' : 'homepage-hero',
          success: true,
          resolvedType: 'gps',
        });
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [onLocate, onResolveState]);

  if ((geoDenied || gpsStatus === 'denied') && variant !== 'radar') return null;

  const region = resolved?.region || null;
  const label = resolved ? (region ? `${resolved.city}, ${region}` : resolved.city) : null;
  const heading = label
    ? (variant === 'radar' ? `Live Radar — ${label}` : `Weather Near ${label}`)
    : FALLBACK_HEADING;

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

  const defaultHeadingClass = isRadar
    ? 'text-base sm:text-lg font-bold text-white'
    : 'text-xl sm:text-2xl font-bold text-white';

  const radarActionClass =
    'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-300 hover:text-sky-200 border border-sky-500/30 hover:border-sky-500/50 rounded-md bg-sky-500/10 hover:bg-sky-500/15 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0';

  const contextLine = isRadar && locationContext ? (
    <p className="text-xs text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {locationContext.alertInfo ? (
        <span className="text-orange-400 whitespace-nowrap">⚠️ {locationContext.alertInfo.event}</span>
      ) : locationContext.alertCount > 0 ? (
        <span className="text-orange-400 whitespace-nowrap">
          ⚠️ {locationContext.alertCount} active alert{locationContext.alertCount !== 1 ? 's' : ''}
        </span>
      ) : (
        <span className="text-cyan-500 whitespace-nowrap">✓ No active alerts</span>
      )}
      {!locationContext.alertInfo && locationContext.alertCount === 0 && stateSlug && (
        <>
          <span className="text-slate-600">·</span>
          <Link
            to={`/alerts/${stateSlug}`}
            onClick={() => trackBrowseByStateClick({ stateCode: region, source: NAV_SOURCES.NEAR_ME_HEADER })}
            className="text-slate-500 hover:text-slate-400 whitespace-nowrap transition-colors"
          >
            View state alerts →
          </Link>
        </>
      )}
      {locationContext.conditions?.temperature != null && (
        <>
          <span className="text-slate-600">·</span>
          <span className="whitespace-nowrap">
            {locationContext.conditions.temperature}°{locationContext.conditions.temperatureUnit || 'F'}
            {locationContext.conditions.shortForecast ? ` · ${locationContext.conditions.shortForecast}` : ''}
          </span>
        </>
      )}
    </p>
  ) : null;

  const locationActionButton = showLocationAction ? (
    <button
      type="button"
      onClick={handlePrimaryAction}
      disabled={!useChangeLocation && gpsStatus === 'locating'}
      aria-label={
        useChangeLocation
          ? 'Change your location'
          : 'Find weather near me using your device location'
      }
      className={
        isRadar
          ? radarActionClass
          : 'inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 border border-sky-500/60 text-white font-semibold rounded-lg shadow-sm shadow-sky-900/30 transition-colors cursor-pointer whitespace-nowrap px-4 py-2.5 text-sm'
      }
    >
      {!isRadar && <span aria-hidden="true">{useChangeLocation ? '📍' : '🎯'}</span>}
      {primaryLabel}
    </button>
  ) : null;

  const gpsStatusHints = showLocationAction && !useChangeLocation && (
    <>
      {gpsStatus === 'unsupported' && (
        <span className="text-[11px] text-amber-400">Geolocation unavailable on this device.</span>
      )}
      {gpsStatus === 'error' && (
        <span className="text-[11px] text-amber-400">Couldn&apos;t get your location — try again.</span>
      )}
    </>
  );

  return (
    <div className={`${isRadar ? 'space-y-1' : 'space-y-2'} ${className}`}>
      {isRadar ? (
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <HeadingTag className={`${headingClassName || defaultHeadingClass} min-w-0`}>
              {heading}
            </HeadingTag>
            {locationActionButton}
          </div>
          {contextLine}
          {gpsStatusHints}
        </div>
      ) : (
        <div className={showLocationAction ? 'flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between' : undefined}>
          <div className="min-w-0">
            <HeadingTag className={headingClassName || defaultHeadingClass}>
              {heading}
            </HeadingTag>
          </div>
          {showLocationAction && (
            <div className="flex flex-col items-stretch sm:items-end gap-0.5 flex-shrink-0">
              {locationActionButton}
              {gpsStatusHints}
            </div>
          )}
        </div>
      )}

      {hasJumpLinks && !isRadar && (
        <nav aria-label="Jump to local alerts and forecasts" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Jump to:</span>
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
