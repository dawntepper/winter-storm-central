import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { US_STATES, ABBR_TO_SLUG } from '../data/stateConfig';
import { getStateCentroid } from '../data/stateCentroids';
import { getCityBySlug } from '../data/cityCatalog';
import { getForecastForCoords, lookupZipCoords } from '../services/forecastService';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import ForecastLocationPicker from '../components/ForecastLocationPicker';
import { ForecastCurrent, ForecastHourly, ForecastDaily } from '../components/ForecastSections';
import StormMap from '../components/StormMap';
import PageHeaderNav from '../components/PageHeaderNav';
import ContactLink from '../components/ContactLink';
import { trackForecastPageView, trackForecastLocationChanged, trackRadarLinkClick, setNavSource, NAV_SOURCES } from '../utils/analytics';

const PENDING_GEO_KEY = 'forecast_pending_geo';
const PENDING_GEO_TTL = 30 * 1000; // 30s — enough to cover a redirect, not enough to leak across sessions

/**
 * /forecast/[state-slug] — auto-generated for all 55 state/territory slugs.
 *
 * Default behavior: state centroid forecast. Picker lets users narrow via:
 *   - City dropdown (catalogued cities for the current state)
 *   - 5-digit ZIP (Zippopotam.us lookup)
 *   - Browser geolocation
 *
 * Cross-state geolocation: if a user on /forecast/oklahoma clicks "Use my
 * location" and is actually in Florida, after the NWS /points response
 * reveals state=FL, the page redirects to /forecast/florida — preserving
 * the geolocated coords via sessionStorage so the new page lands on the
 * user's actual location, not Florida's state centroid.
 *
 * Page sections (top to bottom):
 *   1. Header + picker
 *   2. Live radar centered on selected location (StormMap reused)
 *   3. Current conditions (first hourly period)
 *   4. Hourly strip (next 24h, ~6.5d available)
 *   5. 7-day outlook (NWS daily periods grouped by date)
 *
 * Data source: api.weather.gov, no key. See forecastService for the chain.
 */
export default function ForecastPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const stateData = US_STATES[slug];

  const [coords, setCoords] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pull active NWS alerts so the radar map can show alert markers + the
  // hover popup if any alert is active at the picked location. Same hook
  // and adaptive-refresh cadence as the homepage/state pages.
  const { alerts: alertsData } = useExtremeWeather(true);
  const mapAlerts = useMemo(() => (
    alertsData?.byCategory ? Object.values(alertsData.byCategory).flat() : []
  ), [alertsData]);

  // One-time Plausible page view on mount.
  useEffect(() => {
    if (!stateData) return;
    const initialSource = searchParams.get('city') ? 'city'
      : searchParams.get('zip') ? 'zip'
      : 'state-default';
    trackForecastPageView(slug, initialSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Resolve initial location. Precedence:
  //   1. sessionStorage pending-geolocation (set by a cross-state redirect)
  //   2. ?city= query param
  //   3. ?zip= query param
  //   4. State centroid default
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      // 1. Pending geolocation handoff from a cross-state redirect
      try {
        const raw = sessionStorage.getItem(PENDING_GEO_KEY);
        if (raw) {
          sessionStorage.removeItem(PENDING_GEO_KEY);
          const { lat, lon, savedAt } = JSON.parse(raw);
          if (Date.now() - savedAt < PENDING_GEO_TTL && Number.isFinite(lat) && Number.isFinite(lon)) {
            if (!cancelled) setCoords({ lat, lon, displayName: 'Your current location' });
            return;
          }
        }
      } catch { /* ignore parse errors */ }

      // 2. URL ?city=
      const citySlug = searchParams.get('city');
      if (citySlug) {
        const city = getCityBySlug(citySlug);
        if (city) {
          if (!cancelled) setCoords({
            lat: city.lat,
            lon: city.lon,
            displayName: `${city.city}, ${city.state_abbr}`,
          });
          return;
        }
      }

      // 3. URL ?zip=
      const zip = searchParams.get('zip');
      if (zip && /^\d{5}$/.test(zip)) {
        try {
          const c = await lookupZipCoords(zip);
          if (!cancelled) setCoords({
            lat: c.lat,
            lon: c.lon,
            displayName: `${c.place}, ${c.stateAbbr} ${zip}`,
          });
          return;
        } catch { /* fall through to state default */ }
      }

      // 4. State centroid default
      if (stateData) {
        const centroid = getStateCentroid(stateData.abbr);
        if (centroid && !cancelled) {
          setCoords({
            lat: centroid.lat,
            lon: centroid.lon,
            displayName: `${stateData.name} (state default)`,
          });
        }
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [slug, searchParams, stateData]);

  // Fetch forecast on coords change. After resolution, check if NWS reports
  // a state that differs from the URL — that means geolocation (or a
  // cross-state ZIP) landed us on the wrong state slug. Redirect with the
  // coords preserved via sessionStorage so the new page shows the user's
  // actual location, not the new state's centroid.
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getForecastForCoords(coords.lat, coords.lon)
      .then((data) => {
        if (cancelled) return;
        setForecast(data);

        const reportedAbbr = data.location?.state;
        if (
          reportedAbbr &&
          stateData?.abbr &&
          reportedAbbr !== stateData.abbr
        ) {
          const correctSlug = ABBR_TO_SLUG[reportedAbbr];
          if (correctSlug && correctSlug !== slug) {
            try {
              sessionStorage.setItem(
                PENDING_GEO_KEY,
                JSON.stringify({ lat: coords.lat, lon: coords.lon, savedAt: Date.now() })
              );
            } catch { /* ignore */ }
            navigate(`/forecast/${correctSlug}`, { replace: true });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load forecast');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [coords, slug, stateData, navigate]);

  // SEO meta
  useEffect(() => {
    if (!stateData) return;
    const title = `${stateData.name} Weather Forecast | Hourly & 7-Day | StormTracking`;
    const desc = `Live NWS forecast for ${stateData.name}. Hourly outlook, 7-day forecast, current conditions, and live weather radar. Free data from the National Weather Service.`;
    document.title = title;
    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', `https://stormtracking.io/forecast/${slug}`);
    setMeta('link[rel="canonical"]', 'href', `https://stormtracking.io/forecast/${slug}`);
    return () => {
      document.title = 'StormTracking | Live Weather Radar & Real-Time Storm Alerts';
    };
  }, [stateData, slug]);

  const handleLocationSelect = (pick) => {
    setCoords({ lat: pick.lat, lon: pick.lon, displayName: pick.displayName });
    trackForecastLocationChanged(pick.source);
    // Persist city + zip picks in the URL. Geolocation stays ephemeral —
    // the cross-state-redirect effect above handles state correction.
    const next = new URLSearchParams(searchParams);
    next.delete('city');
    next.delete('zip');
    if (pick.source === 'city') next.set('city', pick.citySlug);
    if (pick.source === 'zip') next.set('zip', pick.zip);
    setSearchParams(next, { replace: true });
  };

  if (!stateData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 p-6">
        <p>Unknown state. <Link to="/" className="text-sky-400 hover:text-sky-300">Back to home</Link>.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white text-sm">← Home</Link>
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          <PageHeaderNav source={NAV_SOURCES.HEADER_NAVIGATION} />
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{stateData.name} Weather Forecast</h1>
          <p className="text-sm text-slate-400 mt-0.5">Hourly outlook, 7-day forecast, and live radar — direct from NWS.</p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Row 1: Picker + Current Conditions side-by-side on desktop.
            Picker is wider (2fr) since it has more controls; Current is
            the compact summary on the right (1fr). Stacks on mobile with
            picker on top, current below — then radar fills the row below. */}
        <div className="lg:grid lg:grid-cols-[2fr_1fr] gap-4 lg:items-start space-y-4 lg:space-y-0">
          <ForecastLocationPicker
            stateSlug={slug}
            stateName={stateData.name}
            currentLabel={coords?.displayName || 'Loading…'}
            onSelect={handleLocationSelect}
          />
          {forecast ? (
            <ForecastCurrent current={forecast.current} location={coords?.displayName} />
          ) : (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
              <p className="text-sm text-slate-400">Loading current conditions…</p>
            </div>
          )}
        </div>

        {coords && (
          <section aria-label="Live weather radar">
            <StormMap
              weatherData={{}}
              stormPhase="active"
              userLocations={
                // Only show the location pin when the user has explicitly
                // picked a city/ZIP/their location. For state-default the
                // whole state is in view; a centroid pin would be misleading.
                coords.displayName?.endsWith('(state default)')
                  ? []
                  : [{
                      id: 'forecast-pin',
                      lat: coords.lat,
                      lon: coords.lon,
                      name: coords.displayName,
                      // Feed NWS current data to the marker's hover popover so
                      // it shows real conditions instead of "Weather data
                      // loading..." once the forecast resolves.
                      conditions: forecast?.current ? {
                        temperature: forecast.current.temperature,
                        temperatureUnit: forecast.current.temperatureUnit,
                        shortForecast: forecast.current.shortForecast,
                      } : null,
                    }]
              }
              alerts={mapAlerts}
              isHero
              centerOn={{ lat: coords.lat, lon: coords.lon, id: `forecast-${coords.lat}-${coords.lon}`, zoom: 8 }}
            />
          </section>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-4 text-sm">
            Forecast unavailable: {error}. This is usually a brief NWS issue — try again in a moment, or pick a different location.
          </div>
        )}

        {loading && !forecast && (
          <p className="text-sm text-slate-400">Loading hourly + 7-day forecast…</p>
        )}

        {forecast && (
          <>
            <ForecastHourly periods={forecast.hourly} timeZone={forecast.location?.timeZone} />
            <ForecastDaily periods={forecast.daily} />
          </>
        )}

        <footer className="pt-4 text-xs text-slate-500 text-center">
          Forecast data from the National Weather Service (api.weather.gov). Updates ~hourly. For severe weather, always defer to{' '}
          <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>{' '}
          and local emergency management. Questions? Reach{' '}
          <ContactLink className="text-sky-400 hover:text-sky-300">StormTracking Support</ContactLink>.
        </footer>
      </main>
    </div>
  );
}
