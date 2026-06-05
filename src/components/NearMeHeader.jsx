import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchApproxLocation, reverseGeocode } from '../services/geoLocationService';
import { ABBR_TO_SLUG, US_STATES } from '../data/stateConfig';
import { getCitySlugForLocation } from '../utils/cityLookup';
import { trackGeolocationUsed, trackBrowseByStateClick, NAV_SOURCES } from '../utils/analytics';

/**
 * Localized "Weather Near Me" headline + dual-layer location detection.
 *
 * SEO note: the static phrase below ALWAYS renders immediately, so the crawler
 * target ("…Weather Near Me") is present on first paint. The location suffix is
 * a UX personalization only — crawlers see datacenter geo, not a real user's.
 *
 * Layer 1 (silent, on mount): Netlify edge geo → appends "(City, ST)" to the
 *   heading and surfaces the jump-to links. Header text only; never moves the map.
 * Layer 2 (explicit, on tap): browser GPS → onLocate() re-centers the map,
 *   reverse-geocode refines the label, and onResolveState() outlines the state.
 *
 * Once a region is known (either layer), we render clickable chips so a moved/
 * pinned map isn't left context-free: a link to the city's page (when we have
 * one) and to the state alerts/radar page.
 *
 * Props:
 *   as               — heading tag, 'h1' (default) or 'h2'. Use 'h2' on pages
 *                      that already have an <h1> to keep a single top-level heading.
 *   onLocate         — ({ lat, lon, zoom, id }) => void; moves the map on GPS success.
 *   onResolveState   — (stateAbbr) => void; outlines the state on the map after GPS.
 *   className        — wrapper classes.
 *   headingClassName — overrides the default heading typography.
 */
export default function NearMeHeader({
  as = 'h1',
  onLocate,
  onResolveState,
  className = '',
  headingClassName = '',
}) {
  // Uppercase alias so JSX can render the dynamic tag. (This repo's ESLint has
  // no react/jsx-uses-vars, so a lowercase JSX-only binding reads as unused.)
  const HeadingTag = as;
  const BASE_HEADING = 'Live Storm Tracking & Weather Near Me';

  const [resolved, setResolved] = useState(null); // { city, region } — region is the state abbr ("TX")
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | locating | denied | unsupported | error
  const [geoDenied, setGeoDenied] = useState(false); // location blocked / turned off in the browser

  // Layer 1 — silent IP (Netlify geo). Header text + jump links only; no map change.
  useEffect(() => {
    let cancelled = false;
    fetchApproxLocation().then((loc) => {
      if (cancelled || !loc?.city) return;
      setResolved({ city: loc.city, region: loc.region || null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Watch the geolocation permission. If the user has blocked/turned off
  // location, we hide the whole near-me UI (see early return below). Using the
  // Permissions API means we detect this without ever triggering a prompt, and
  // onchange keeps it in sync if they toggle it in browser settings.
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

  // Layer 2 — explicit GPS. Moves the map first (snappy), then refines label +
  // outlines the resolved state so the moved map has clear context.
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
        // Re-center the map immediately on the precise coords.
        onLocate?.({
          lat: latitude,
          lon: longitude,
          zoom: 9,
          id: `nearme-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
        });
        // Then refine the heading + outline the state (best-effort).
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

  // The user doesn't want to share location — either they blocked it in the
  // browser (geoDenied) or denied our prompt (gpsStatus). Remove the localized
  // headline AND the "Find Weather Near Me" button entirely. Crawlers never
  // reach the 'denied' state, so the SEO headline is unaffected.
  if (geoDenied || gpsStatus === 'denied') return null;

  const region = resolved?.region || null;
  const label = resolved ? (region ? `${resolved.city}, ${region}` : resolved.city) : null;
  const heading = label ? `${BASE_HEADING} (${label})` : BASE_HEADING;

  // Derive clickable destinations from the resolved location.
  const stateSlug = region ? ABBR_TO_SLUG[region] : null;
  const stateName = stateSlug ? US_STATES[stateSlug]?.name : null;
  const citySlug =
    resolved?.city && region ? getCitySlugForLocation(`${resolved.city}, ${region}`) : null;
  const hasJumpLinks = Boolean(stateSlug || citySlug);

  const chipClass =
    'inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 rounded-md text-xs sm:text-sm text-slate-200 hover:text-white transition-colors cursor-pointer';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HeadingTag className={headingClassName || 'text-xl sm:text-2xl font-bold text-white'}>
          {heading}
        </HeadingTag>
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
            <span className="text-[11px] text-amber-400">Couldn’t get your location — try again.</span>
          )}
        </div>
      </div>

      {/* Jump-to links — give the moved/pinned map context and a path to the
          dedicated city/state pages. Shown whenever a region is resolved. */}
      {hasJumpLinks && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-slate-400">Jump to:</span>
          {citySlug && (
            <Link to={`/alerts/${citySlug}`} className={chipClass}>
              <span aria-hidden="true">📍</span> {resolved.city} alerts
            </Link>
          )}
          {stateSlug && (
            <Link
              to={`/alerts/${stateSlug}`}
              onClick={() => trackBrowseByStateClick({ stateCode: region, source: NAV_SOURCES.NEAR_ME_HEADER })}
              className={chipClass}
            >
              {stateName} alerts &amp; city forecasts <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
