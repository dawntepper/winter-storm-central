/**
 * City Alerts Page — reusable template rendered for any city in
 * src/content/cities/[slug].json. Reads city data, fetches live NWS alerts
 * (by NWS zone) and Open-Meteo current conditions + 4-day forecast, and
 * emits LLM/SEO-friendly meta tags + JSON-LD structured data.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  NWS_HEADERS,
  INCLUDED_EVENTS,
  getCategoryForEvent,
  ALERT_CATEGORIES,
} from '../../shared/nws-alert-parser';
import {
  fetchOpenMeteoConditions,
  describeWeatherCode,
  degreesToCompass,
} from '../utils/fetchOpenMeteoConditions';
import { getForecastForCoords } from '../services/forecastService';
import { ForecastHourly, ForecastDaily } from './ForecastSections';
import { trackForecastLinkClick } from '../utils/analytics';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import StormMap from './StormMap';
import AlertSignupBar from './AlertSignupBar';
import citiesIndex from '../content/cities/index.json';

const BASE_URL = 'https://stormtracking.io';

// Eager-load every city JSON at build time so slug → data is a sync lookup.
const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });
const CITY_DATA = {};
for (const [path, mod] of Object.entries(cityModules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match && match[1] !== 'index') {
    CITY_DATA[match[1]] = mod.default || mod;
  }
}

// Map city slugs in index.json → display labels for "nearby cities" links.
const CITY_INDEX_BY_SLUG = {};
for (const c of citiesIndex.cities || []) {
  CITY_INDEX_BY_SLUG[c.slug] = c;
}

// ============================================================
// META TAGS
// ============================================================

function setCityMetaTags(city) {
  const url = `${BASE_URL}/alerts/${city.slug}`;
  const title = `${city.city}, ${city.state} Weather Alerts & Forecast — Live NWS Warnings | StormTracking.io`;
  const description = `Live weather alerts and current conditions for ${city.city}, ${city.state}. Real-time National Weather Service warnings, watches, and current temperature. Updated continuously, no ads.`;
  const ogImage = `${BASE_URL}/og-image.png`;

  document.title = title;

  const setMeta = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[name="title"]', 'content', title);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('meta[property="og:image"]', 'content', ogImage);
  setMeta('meta[property="og:type"]', 'content', 'website');
  setMeta('meta[name="twitter:title"]', 'content', `${city.city}, ${city.state} Weather Alerts`);
  setMeta('meta[name="twitter:description"]', 'content', `Live NWS warnings and current conditions for ${city.city}. No ads, no clutter.`);
  setMeta('meta[name="twitter:image"]', 'content', ogImage);
  setMeta('meta[property="twitter:title"]', 'content', `${city.city}, ${city.state} Weather Alerts`);
  setMeta('meta[property="twitter:description"]', 'content', `Live NWS warnings and current conditions for ${city.city}. No ads, no clutter.`);
  setMeta('meta[property="twitter:image"]', 'content', ogImage);
  setMeta('link[rel="canonical"]', 'href', url);
  setMeta(
    'meta[name="keywords"]',
    'content',
    `${city.city.toLowerCase()} weather alerts, ${city.city.toLowerCase()} ${city.state.toLowerCase()} weather, ${city.city.toLowerCase()} severe weather warnings, ${city.city.toLowerCase()} radar, NWS ${city.city.toLowerCase()}`,
  );
}

function resetMetaTags() {
  document.title = 'StormTracking | Live Weather Radar & Real-Time Storm Alerts';
  const desc = 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking. Free NOAA data for winter storms, tornadoes, and extreme weather across the US.';

  const reset = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  reset('meta[name="description"]', 'content', desc);
  reset('meta[property="og:title"]', 'content', 'StormTracking | Live Weather Radar & Storm Alerts');
  reset('meta[property="og:description"]', 'content', desc);
  reset('meta[property="og:url"]', 'content', BASE_URL);
  reset('meta[property="og:image"]', 'content', `${BASE_URL}/og-image.png`);
  reset('link[rel="canonical"]', 'href', BASE_URL);
}

// ============================================================
// LIVE DATA FETCH
// ============================================================

async function fetchCityAlerts(zone) {
  if (!zone) return [];
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(zone)}`,
      { headers: NWS_HEADERS },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const features = data?.features || [];
    return features
      .filter((f) => INCLUDED_EVENTS.includes(f?.properties?.event))
      .map((f) => {
        const p = f.properties || {};
        return {
          id: f.id || p.id,
          event: p.event,
          severity: p.severity,
          urgency: p.urgency,
          headline: p.headline,
          description: p.description,
          instruction: p.instruction,
          areaDesc: p.areaDesc,
          onset: p.onset,
          effective: p.effective,
          expires: p.expires,
          ends: p.ends,
          sender: p.senderName,
          url: p['@id'] || f.id,
          category: getCategoryForEvent(p.event),
        };
      });
  } catch (err) {
    console.warn('fetchCityAlerts failed:', err);
    return null;
  }
}

// ============================================================
// HELPERS
// ============================================================

function currentSeason() {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

function formatTemp(t) {
  return typeof t === 'number' ? `${Math.round(t)}°` : '—';
}

function formatDateShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function severityClasses(severity) {
  if (severity === 'Extreme') return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (severity === 'Severe') return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (severity === 'Moderate') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (severity === 'Minor') return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}

// ============================================================
// JSON-LD
// ============================================================

function buildJsonLd(city, conditions) {
  const url = `${BASE_URL}/alerts/${city.slug}`;
  const now = new Date().toISOString();

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${city.city}, ${city.state} Weather Alerts & Forecast`,
    description: `Live weather alerts and current conditions for ${city.city}, ${city.state} from the National Weather Service.`,
    url,
    dateModified: now,
    mainEntity: {
      '@type': 'Place',
      name: `${city.city}, ${city.state}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city.city,
        addressRegion: city.state_abbr,
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: city.lat,
        longitude: city.lon,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'StormTracking.io',
      url: BASE_URL,
    },
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StormTracking.io', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Weather Alerts', item: `${BASE_URL}/alerts` },
      { '@type': 'ListItem', position: 3, name: `${city.state} Alerts`, item: `${BASE_URL}/alerts/${city.state_slug}` },
      { '@type': 'ListItem', position: 4, name: `${city.city} Alerts`, item: url },
    ],
  };

  const out = [webPage, breadcrumbs];

  if (conditions?.current) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'WeatherForecast',
      datePublished: conditions.fetchedAt,
      validIn: {
        '@type': 'Place',
        name: `${city.city}, ${city.state}`,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: city.lat,
          longitude: city.lon,
        },
      },
    });
  }

  return out;
}

// ============================================================
// SUB-SECTIONS
// ============================================================

function CurrentConditions({ city, conditions, error }) {
  if (error) {
    return (
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-slate-400 text-sm">
          Current conditions are temporarily unavailable. Active alerts below are still live from the National Weather Service.
        </p>
      </section>
    );
  }
  if (!conditions) {
    return (
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-slate-400 text-sm">Loading current conditions for {city.city}…</p>
      </section>
    );
  }

  const { current, daily, fetchedAt } = conditions;
  const wx = describeWeatherCode(current.weatherCode);
  const windDir = degreesToCompass(current.windDirection);

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Current Conditions
        </h2>
        <span className="text-xs text-slate-500">
          Updated {formatDateTime(fetchedAt)}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex items-center gap-4">
          <span className="text-5xl" aria-hidden="true">{wx.icon}</span>
          <div>
            <p className="text-5xl font-bold text-white leading-none">
              {formatTemp(current.temperature)}<span className="text-2xl text-slate-400">F</span>
            </p>
            <p className="text-sm text-slate-300 mt-1">{wx.label}</p>
            {typeof current.apparentTemperature === 'number' && (
              <p className="text-xs text-slate-500 mt-0.5">
                Feels like {formatTemp(current.apparentTemperature)}F
              </p>
            )}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Metric label="Humidity" value={typeof current.humidity === 'number' ? `${Math.round(current.humidity)}%` : '—'} />
          <Metric label="Wind" value={typeof current.windSpeed === 'number' ? `${Math.round(current.windSpeed)} mph ${windDir}` : '—'} />
          <Metric label="Gusts" value={typeof current.windGusts === 'number' ? `${Math.round(current.windGusts)} mph` : '—'} />
          <Metric label="UV Index" value={typeof current.uvIndex === 'number' ? current.uvIndex.toFixed(1) : '—'} />
        </div>
      </div>

      {daily && daily.length > 0 && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {daily.slice(0, 4).map((d, i) => {
              const dw = describeWeatherCode(d.weatherCode);
              return (
                <div key={d.date || i} className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">{i === 0 ? 'Today' : formatDateShort(d.date)}</p>
                  <p className="text-2xl my-1" aria-hidden="true">{dw.icon}</p>
                  <p className="text-sm font-medium text-white">
                    {formatTemp(d.tempMax)} <span className="text-slate-500">/ {formatTemp(d.tempMin)}</span>
                  </p>
                  {typeof d.precipChance === 'number' && (
                    <p className="text-[11px] text-sky-400 mt-1">
                      {Math.round(d.precipChance)}% precip
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

function ActiveAlerts({ city, alerts, error }) {
  if (error) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Active Alerts</h2>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200">
          NWS alert data is temporarily unavailable. Please refresh, or check
          {' '}
          <a className="underline" href={`https://forecast.weather.gov/MapClick.php?lat=${city.lat}&lon=${city.lon}`} target="_blank" rel="noopener noreferrer">
            weather.gov directly
          </a>.
        </div>
      </section>
    );
  }

  if (alerts === null) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Active Alerts</h2>
        <p className="text-slate-400 text-sm">Loading alerts for {city.city}…</p>
      </section>
    );
  }

  if (alerts.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Active Alerts</h2>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <p className="text-emerald-200 text-sm leading-relaxed">
            <strong>No active weather alerts for {city.city} at this time.</strong>
            {' '}Sign up below to be notified when severe weather threatens this area.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">
        Active Alerts ({alerts.length})
      </h2>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  );
}

function AlertCard({ alert }) {
  const [open, setOpen] = useState(false);
  const category = ALERT_CATEGORIES[alert.category];

  return (
    <article className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {category && (
                <span className="text-base" aria-hidden="true">{category.icon}</span>
              )}
              <h3 className="text-base font-semibold text-white">{alert.event}</h3>
            </div>
            {alert.headline && (
              <p className="text-sm text-slate-300 leading-snug">{alert.headline}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${severityClasses(alert.severity)} whitespace-nowrap`}>
            {alert.severity || 'Alert'}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
          {alert.effective && <span>Effective: {formatDateTime(alert.effective)}</span>}
          {alert.expires && <span>Expires: {formatDateTime(alert.expires)}</span>}
        </div>
      </header>

      {alert.areaDesc && (
        <div className="px-4 py-2 text-xs text-slate-400 bg-slate-900/40 border-b border-slate-700/60">
          <span className="text-slate-500">Affected:</span> {alert.areaDesc}
        </div>
      )}

      {(alert.description || alert.instruction) && (
        <div className="px-4 py-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            {open ? 'Hide details' : 'Show full NWS message'} {open ? '▴' : '▾'}
          </button>
          {open && (
            <div className="mt-3 space-y-3 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {alert.description && <p>{alert.description}</p>}
              {alert.instruction && (
                <p className="border-l-2 border-amber-500/50 pl-3 text-amber-100">
                  {alert.instruction}
                </p>
              )}
              {alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-sky-400 hover:underline"
                >
                  View on weather.gov &rarr;
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

const SEASON_LABEL = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

const HAZARD_LABELS = {
  'hurricane': 'Hurricanes',
  'tropical-storm': 'Tropical storms',
  'flooding': 'Flooding',
  'severe-thunderstorm': 'Severe thunderstorms',
  'lightning': 'Lightning',
  'cold-front': 'Cold fronts',
  'cold-fronts': 'Cold fronts',
  'tornado': 'Tornadoes',
  'winter-storm': 'Winter storms',
  'ice-storm': 'Ice storms',
  'heat': 'Extreme heat',
  'wildfire': 'Wildfires',
  'high-wind': 'High wind',
};

function SeasonalRisk({ city, season }) {
  if (!city.seasonal_risks) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Seasonal Risk Profile</h2>
      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {city.description_long}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SEASON_ORDER.map((s) => {
          const risks = city.seasonal_risks[s] || [];
          const isCurrent = s === season;
          return (
            <div
              key={s}
              className={`rounded-lg p-3 border ${
                isCurrent
                  ? 'border-sky-400/50 bg-sky-500/10'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isCurrent ? 'text-sky-300' : 'text-slate-400'}`}>
                {SEASON_LABEL[s]}{isCurrent && ' • Now'}
              </p>
              <ul className="space-y-1">
                {risks.length === 0 && (
                  <li className="text-xs text-slate-500">Low risk</li>
                )}
                {risks.map((r) => (
                  <li key={r} className="text-xs text-slate-300">
                    {HAZARD_LABELS[r] || r}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RelatedLinks({ city }) {
  const radarUrl = `/radar?lat=${city.lat}&lon=${city.lon}`;
  const cardClasses = 'group block bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 transition-all duration-200 hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/10';
  const arrow = (
    <span
      aria-hidden="true"
      className="text-sky-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
    >
      &rarr;
    </span>
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Related</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to={radarUrl} className={cardClasses}>
          <p className="text-sm font-medium text-white flex items-center justify-between gap-2">
            <span>Live radar centered on {city.city}</span>
            {arrow}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Real-time precipitation and storm tracking</p>
        </Link>
        <Link to={`/alerts/${city.state_slug}`} className={cardClasses}>
          <p className="text-sm font-medium text-white flex items-center justify-between gap-2">
            <span>All {city.state} weather alerts</span>
            {arrow}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Statewide active warnings and watches</p>
        </Link>
      </div>
    </section>
  );
}

function NearbyCities({ city }) {
  const nearby = (city.nearby_cities || [])
    .map((slug) => ({ slug, idx: CITY_INDEX_BY_SLUG[slug] }))
    .filter((entry) => entry.idx); // only show supported cities

  const unsupported = (city.nearby_cities || [])
    .filter((slug) => !CITY_INDEX_BY_SLUG[slug])
    .map((slug) => slug.replace(/-([a-z]{2})$/, ', $1').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

  if (nearby.length === 0 && unsupported.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Weather alerts in nearby cities</h2>
      {nearby.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {nearby.map((entry) => (
            <Link
              key={entry.slug}
              to={`/alerts/${entry.slug}`}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-sky-300 hover:text-sky-200 transition-colors"
            >
              {entry.idx.city}, {entry.idx.state_abbr || entry.idx.state}
            </Link>
          ))}
        </div>
      )}
      {unsupported.length > 0 && (
        <p className="text-xs text-slate-500">
          More coming soon: {unsupported.join(' • ')}
        </p>
      )}
    </section>
  );
}

// ============================================================
// Forecast section — NWS-based hourly + 7-day outlook for this city.
// Lives alongside the existing Open-Meteo current-conditions widget.
// Lazy fetches on mount; failures degrade silently (section just hides).
// ============================================================

function CityForecastSection({ city }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city?.lat || !city?.lon) return;
    let cancelled = false;
    setLoading(true);
    getForecastForCoords(city.lat, city.lon)
      .then((data) => { if (!cancelled) setForecast(data); })
      .catch(() => { /* hide section silently on failure */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city?.lat, city?.lon]);

  if (loading && !forecast) {
    return (
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-sm text-slate-400">Loading forecast…</p>
      </section>
    );
  }

  if (!forecast) return null;

  return (
    <section className="space-y-4">
      <ForecastHourly
        periods={forecast.hourly}
        timeZone={forecast.location?.timeZone}
        title={`Next 24 hours · ${city.city}`}
      />
      <ForecastDaily periods={forecast.daily} title={`7-day outlook · ${city.city}`} />
      <div className="text-center">
        <Link
          to={`/forecast/${city.state_slug}?city=${city.slug}`}
          onClick={() => trackForecastLinkClick('city-page', city.state_slug, 'city')}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-sky-200 text-sm font-semibold rounded-lg transition-colors"
        >
          View full forecast for {city.city}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function CityAlertsPage() {
  const { slug } = useParams();
  const city = CITY_DATA[slug];

  const [alerts, setAlerts] = useState(null);
  const [alertsError, setAlertsError] = useState(false);
  const [conditions, setConditions] = useState(null);
  const [conditionsError, setConditionsError] = useState(false);

  // Pull all active NWS alerts (national feed) so the inline StormMap can
  // render alert markers + hover popups around the city, matching the
  // pattern on state/forecast pages. Adaptive refresh cadence (10/2 min)
  // is handled by the hook.
  const { alerts: allAlertsData } = useExtremeWeather(true);
  const mapAlerts = useMemo(() => (
    allAlertsData?.byCategory ? Object.values(allAlertsData.byCategory).flat() : []
  ), [allAlertsData]);

  useEffect(() => {
    if (!city) return;
    setCityMetaTags(city);
    return () => resetMetaTags();
  }, [city]);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setAlerts(null);
    setAlertsError(false);
    fetchCityAlerts(city.nws_zone).then((result) => {
      if (cancelled) return;
      if (result === null) setAlertsError(true);
      else setAlerts(result);
    });
    return () => { cancelled = true; };
  }, [city]);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setConditions(null);
    setConditionsError(false);
    fetchOpenMeteoConditions({ lat: city.lat, lon: city.lon, timezone: city.timezone || 'auto' })
      .then((result) => {
        if (cancelled) return;
        if (result === null) setConditionsError(true);
        else setConditions(result);
      });
    return () => { cancelled = true; };
  }, [city]);

  const jsonLdBlocks = useMemo(() => (city ? buildJsonLd(city, conditions) : []), [city, conditions]);

  if (!city) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">City Not Found</h1>
          <p className="text-slate-400 mb-6">We don&apos;t have an alerts page for &quot;{slug}&quot; yet.</p>
          <Link to="/alerts" className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors">
            See all active alerts &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const season = currentSeason();
  const alertCount = Array.isArray(alerts) ? alerts.length : 0;

  return (
    <div className="min-h-screen bg-slate-900">
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline text-sm">Home</span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl" aria-hidden="true">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/alerts" className="text-[10px] sm:text-xs text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 pl-2 pr-2 py-0.5 rounded border border-red-500/30 transition-colors">Live Alerts</Link>
            <Link to="/radar" className="text-[10px] sm:text-xs text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 pl-2 pr-2 py-0.5 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
            <Link to={`/alerts/${city.state_slug}`} className="text-[10px] sm:text-xs text-sky-400 hover:bg-sky-500/25 font-medium bg-sky-500/15 pl-2 pr-2 py-0.5 rounded border border-sky-500/30 transition-colors">{city.state_abbr} Alerts</Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            <Link to="/alerts" className="hover:text-slate-300">Alerts</Link>
            {' › '}
            <Link to={`/alerts/${city.state_slug}`} className="hover:text-slate-300">{city.state}</Link>
            {' › '}
            <span className="text-slate-400">{city.city}</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {city.city}, {city.state} Weather Alerts &amp; Current Conditions
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            {city.description_short} Live National Weather Service warnings, current temperature and conditions, and a 4-day forecast for {city.county} County. {alertCount > 0 ? `${alertCount} active alert${alertCount === 1 ? '' : 's'} right now.` : 'No active alerts right now.'} Data from the NWS and Open-Meteo. No ads, no clutter, no paywalls.
          </p>
        </div>

        {/* Live radar centered on the city — alert markers + hover popups
            for any active NWS alert in range, plus a green pin labelling
            the city itself. Same StormMap component used on the homepage,
            state alerts pages, and /forecast/[state-slug]. */}
        <section aria-label={`Live weather radar — ${city.city}`}>
          <StormMap
            weatherData={{}}
            stormPhase="active"
            userLocations={[{
              id: `city-pin-${city.slug}`,
              lat: city.lat,
              lon: city.lon,
              name: `${city.city}, ${city.state_abbr}`,
              conditions: conditions ? {
                temperature: conditions.temperature,
                temperatureUnit: 'F',
                shortForecast: conditions.shortForecast || conditions.condition,
              } : null,
            }]}
            alerts={mapAlerts}
            isHero
            centerOn={{ lat: city.lat, lon: city.lon, id: `city-${city.slug}`, zoom: 8 }}
          />
        </section>

        <CurrentConditions city={city} conditions={conditions} error={conditionsError} />
        <ActiveAlerts city={city} alerts={alerts} error={alertsError} />
        <CityForecastSection city={city} />
        <RelatedLinks city={city} />
        <NearbyCities city={city} />
        <SeasonalRisk city={city} season={season} />

        <footer className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed">
            Alerts sourced from the National Weather Service (NWS office: {city.nws_office}, forecast zone {city.nws_zone}).
            Current conditions and forecast from{' '}
            <a className="hover:text-slate-300 underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.
            Updated continuously. StormTracking.io is not affiliated with NOAA or the NWS — always follow official guidance from local authorities.
          </p>
        </footer>
      </main>

      <AlertSignupBar />
    </div>
  );
}
