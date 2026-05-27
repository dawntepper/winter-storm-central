import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import { getStateCentroid } from '../data/stateCentroids';
import { getCityBySlug } from '../data/cityCatalog';
import { getForecastForCoords, lookupZipCoords } from '../services/forecastService';
import ForecastLocationPicker from '../components/ForecastLocationPicker';
import StormMap from '../components/StormMap';
import ContactLink from '../components/ContactLink';
import { trackForecastPageView } from '../utils/analytics';

/**
 * /forecast/[state-slug] — auto-generated for all 55 state/territory slugs.
 *
 * Default behavior: state centroid forecast. Picker lets users narrow to:
 *   - A specific city (?city=oklahoma-city, dropdown from catalog)
 *   - Any 5-digit US ZIP (?zip=73101, via Zippopotam.us lookup)
 *   - Browser geolocation (no URL change — ephemeral session pick)
 *
 * Page sections, top to bottom:
 *   1. Page header + location picker
 *   2. Live radar map centered on selected location (reuses StormMap)
 *   3. Current conditions card
 *   4. Hourly forecast strip (~6.5 days)
 *   5. 7-day forecast cards (NWS daily periods, day/night condensed)
 *
 * Data source: NWS api.weather.gov (free, no API key). See forecastService
 * for the two-step /points → /forecast + /forecast/hourly chain.
 */
export default function ForecastPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const stateData = US_STATES[slug];

  const [coords, setCoords] = useState(null); // { lat, lon, displayName }
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Plausible — fires once per mount with the initial location source.
  // Captures state slug + how the user landed on this location so we can
  // see which states get traffic and which picker modes get used most.
  useEffect(() => {
    if (!stateData) return;
    const initialSource = searchParams.get('city') ? 'city'
      : searchParams.get('zip') ? 'zip'
      : 'state-default';
    trackForecastPageView(slug, initialSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Resolve the initial location from URL query params or default to state centroid.
  // Runs on mount + when slug / query params change.
  useEffect(() => {
    let cancelled = false;
    async function resolveInitialLocation() {
      const citySlug = searchParams.get('city');
      const zip = searchParams.get('zip');

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
        // Fall through to state default if slug doesn't match
      }

      if (zip && /^\d{5}$/.test(zip)) {
        try {
          const c = await lookupZipCoords(zip);
          if (!cancelled) setCoords({
            lat: c.lat,
            lon: c.lon,
            displayName: `${c.place}, ${c.stateAbbr} ${zip}`,
          });
          return;
        } catch {
          // Fall through to state default on ZIP lookup failure
        }
      }

      // Default: state centroid
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
    resolveInitialLocation();
    return () => { cancelled = true; };
  }, [slug, searchParams, stateData]);

  // Fetch forecast whenever coords change.
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getForecastForCoords(coords.lat, coords.lon)
      .then((data) => {
        if (!cancelled) setForecast(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load forecast');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [coords]);

  // SEO meta — set on mount + when state name resolves.
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
      // Reset to defaults on unmount
      document.title = 'StormTracking | Live Weather Radar & Real-Time Storm Alerts';
    };
  }, [stateData, slug]);

  const handleLocationSelect = (pick) => {
    setCoords({ lat: pick.lat, lon: pick.lon, displayName: pick.displayName });
    // Persist city + zip picks in URL for deep-linking. Geolocation stays
    // ephemeral (no URL update — privacy + meaningless without re-permission).
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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white text-sm">← Home</Link>
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{stateData.name} Weather Forecast</h1>
          <p className="text-sm text-slate-400 mt-0.5">Hourly outlook, 7-day forecast, and live radar — direct from NWS.</p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <ForecastLocationPicker
          stateSlug={slug}
          stateName={stateData.name}
          currentLabel={coords?.displayName || 'Loading…'}
          onSelect={handleLocationSelect}
        />

        {coords && (
          <section aria-label="Live weather radar">
            <StormMap
              weatherData={{}}
              stormPhase="active"
              userLocations={[]}
              alerts={[]}
              isHero
              centerOn={{ lat: coords.lat, lon: coords.lon, id: `forecast-${coords.lat}-${coords.lon}`, zoom: 8 }}
            />
          </section>
        )}

        {loading && !forecast && (
          <p className="text-sm text-slate-400">Loading forecast…</p>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-4 text-sm">
            Forecast unavailable: {error}. This is usually a brief NWS issue — try again in a moment, or pick a different location.
          </div>
        )}

        {forecast && (
          <>
            <CurrentConditions current={forecast.current} location={coords?.displayName} />
            <HourlyForecast periods={forecast.hourly} timeZone={forecast.location?.timeZone} />
            <SevenDayForecast periods={forecast.daily} />
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

function CurrentConditions({ current, location }) {
  if (!current) return null;
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Right now</h2>
      <div className="flex items-start gap-4">
        {current.icon && (
          <img src={current.icon} alt="" className="w-20 h-20 rounded-lg flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-bold text-white">
              {current.temperature}°{current.temperatureUnit || 'F'}
            </span>
          </div>
          <p className="text-base text-slate-300 mt-1">{current.shortForecast}</p>
          <p className="text-xs text-slate-500 mt-2">
            Wind {current.windSpeed} {current.windDirection}
            {location ? ` · ${location}` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}

function HourlyForecast({ periods, timeZone }) {
  if (!periods || periods.length === 0) return null;
  const next24 = periods.slice(0, 24);
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', timeZone: timeZone || undefined });
  };
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Next 24 hours</h2>
        <span className="text-[10px] text-slate-500">
          {periods.length} hourly periods total (~{Math.round(periods.length / 24)} days)
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {next24.map((p) => (
          <div
            key={p.startTime}
            className="flex-shrink-0 w-20 bg-slate-900/60 border border-slate-700 rounded-lg p-2 flex flex-col items-center text-center"
          >
            <span className="text-[10px] text-slate-400 mb-1">{fmt(p.startTime)}</span>
            {p.icon && <img src={p.icon} alt="" className="w-10 h-10" />}
            <span className="text-sm font-semibold text-white mt-1">
              {p.temperature}°
            </span>
            {p.probabilityOfPrecipitation?.value != null && p.probabilityOfPrecipitation.value > 0 && (
              <span className="text-[10px] text-sky-400 mt-0.5">{p.probabilityOfPrecipitation.value}%</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SevenDayForecast({ periods }) {
  if (!periods || periods.length === 0) return null;
  // NWS returns alternating day/night periods. Pair them into a daily view.
  const days = useMemo(() => groupPeriodsIntoDays(periods), [periods]);
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">7-day outlook</h2>
      <div className="space-y-2">
        {days.map((d) => (
          <div key={d.key} className="flex items-center gap-3 sm:gap-4 p-3 bg-slate-900/40 border border-slate-700 rounded-lg">
            <div className="w-20 sm:w-28 flex-shrink-0">
              <p className="text-sm font-semibold text-white">{d.dayName}</p>
              <p className="text-[10px] text-slate-500">{d.dateLabel}</p>
            </div>
            {d.day?.icon ? (
              <img src={d.day.icon} alt="" className="w-12 h-12 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">
                {d.day?.shortForecast || d.night?.shortForecast || '—'}
              </p>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                {d.day?.detailedForecast || d.night?.detailedForecast || ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-white">
                {d.high != null ? `${d.high}°` : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {d.low != null ? `${d.low}°` : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * NWS daily forecast returns alternating day/night periods (~14 total over 7 days).
 * Group them by calendar date with a high (day) + low (night) summary.
 */
function groupPeriodsIntoDays(periods) {
  const byDay = new Map();
  for (const p of periods) {
    const start = new Date(p.startTime);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    if (!byDay.has(key)) {
      const dayName = start.toLocaleDateString(undefined, { weekday: 'long' });
      const dateLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      byDay.set(key, { key, dayName, dateLabel, day: null, night: null, high: null, low: null });
    }
    const bucket = byDay.get(key);
    if (p.isDaytime) {
      bucket.day = p;
      bucket.high = p.temperature;
    } else {
      bucket.night = p;
      bucket.low = p.temperature;
    }
  }
  return Array.from(byDay.values());
}
