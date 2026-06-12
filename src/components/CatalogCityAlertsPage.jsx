/**
 * Catalog city alerts page — /alerts/city/:citySlug
 * For cities in the Supabase catalog (rich /alerts/:slug pages redirect here).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import {
  getCityBySlugWithFallback,
  getPrimaryCountyForCity,
  getCitiesForCounty,
  trackCountyAlertView,
  getStateSlugForCode,
  cityAlertsPath,
  alertMatchesCity,
} from '../services/locationCatalogService';
import { fetchOpenMeteoConditions } from '../utils/fetchOpenMeteoConditions';
import { trackCityAlertView, trackCityWeatherPageView } from '../utils/analytics';
import { setHomepageMetaTags } from '../data/homepageMeta';
import PageBackNav from './PageBackNav';
import PageHeaderNav from './PageHeaderNav';
import StormMap from './StormMap';
import CityCurrentConditions from './CityCurrentConditions';
import CityForecastSection from './CityForecastSection';
import { NAV_SOURCES } from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

const BASE_URL = 'https://stormtracking.io';

function setCityMetaTags(city) {
  const url = `${BASE_URL}${cityAlertsPath(city.slug, false)}`;
  const stateLabel = city.stateName || city.stateCode;
  const title = `${city.name}, ${stateLabel} Weather Alerts & Forecast | StormTracking`;
  const description = `Live ${city.name} weather alerts, radar, current conditions, hourly forecast, and 7-day outlook from NWS and NOAA.`;

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
  setMeta('link[rel="canonical"]', 'href', url);
}

function severityClasses(severity) {
  if (severity === 'Extreme') return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (severity === 'Severe') return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (severity === 'Moderate') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}

export default function CatalogCityAlertsPage() {
  const { citySlug } = useParams();
  const redirectToRichPage = RICH_CITY_SLUGS.has(citySlug);

  const [city, setCity] = useState(null);
  const [county, setCounty] = useState(null);
  const [siblingCities, setSiblingCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conditions, setConditions] = useState(null);
  const [conditionsError, setConditionsError] = useState(false);
  const [forecastLoaded, setForecastLoaded] = useState(false);
  const [hasForecastData, setHasForecastData] = useState(false);

  const { alerts: alertsData, loading: alertsLoading, lastUpdated } = useExtremeWeather(true);
  const allAlerts = alertsData?.allAlerts || [];

  const cityAlerts = useMemo(() => {
    if (!city) return [];
    return allAlerts.filter((a) => alertMatchesCity(a, city, county));
  }, [city, county, allAlerts]);

  const mapAlerts = useMemo(() => {
    if (!city || cityAlerts.length === 0) return [];
    const ids = new Set(cityAlerts.map((a) => a.id));
    const matched = allAlerts.filter((a) => ids.has(a.id));
    if (matched.length > 0) return matched;
    return cityAlerts.map((a) => ({
      ...a,
      lat: city.lat,
      lon: city.lon,
      state: city.stateCode,
    }));
  }, [city, cityAlerts, allAlerts]);

  const handleForecastLoad = useCallback((data) => {
    setForecastLoaded(true);
    setHasForecastData(Boolean(data));
  }, []);

  useEffect(() => {
    if (redirectToRichPage) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setForecastLoaded(false);
      setHasForecastData(false);
      const cityRow = await getCityBySlugWithFallback(citySlug);
      if (cancelled) return;
      setCity(cityRow);

      if (cityRow) {
        setCityMetaTags(cityRow);
        const countyRow = await getPrimaryCountyForCity(cityRow.id);
        if (!cancelled) setCounty(countyRow);
        if (countyRow) {
          const linked = await getCitiesForCounty(countyRow.id);
          if (!cancelled) {
            setSiblingCities(linked.filter((c) => c.id !== cityRow.id));
          }
        } else {
          setSiblingCities([]);
        }
        trackCityAlertView({
          cityId: cityRow.id,
          stateCode: cityRow.stateCode,
          source: 'catalog-city-page',
          cityName: cityRow.name,
        });
      }
      setLoading(false);
    })();
    return () => setHomepageMetaTags();
  }, [citySlug, redirectToRichPage]);

  useEffect(() => {
    if (!city || redirectToRichPage) return undefined;
    let cancelled = false;
    setConditions(null);
    setConditionsError(false);
    if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) {
      setConditionsError(true);
      return undefined;
    }
    fetchOpenMeteoConditions({ lat: city.lat, lon: city.lon, timezone: 'auto' })
      .then((result) => {
        if (cancelled) return;
        if (result === null) setConditionsError(true);
        else setConditions(result);
      });
    return () => { cancelled = true; };
  }, [city, redirectToRichPage]);

  useEffect(() => {
    if (!city || redirectToRichPage || alertsLoading || !forecastLoaded) return;
    trackCityWeatherPageView({
      stateCode: city.stateCode,
      city: city.name,
      citySlug: city.slug,
      hasAlerts: cityAlerts.length > 0,
      hasForecastData,
      source: 'catalog_city_page',
    });
  }, [city, cityAlerts.length, alertsLoading, redirectToRichPage, forecastLoaded, hasForecastData]);

  const countyPageViewTrackedRef = useRef(null);
  useEffect(() => {
    if (county && !alertsLoading && countyPageViewTrackedRef.current !== county.id) {
      countyPageViewTrackedRef.current = county.id;
      trackCountyAlertView({
        countyId: county.id,
        stateCode: county.stateCode,
        alertCount: cityAlerts.length,
        source: 'catalog-city-page',
        countyName: county.name,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county?.id, alertsLoading]);

  if (redirectToRichPage) {
    return <Navigate to={`/alerts/${citySlug}`} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!city) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">City Not Found</h1>
          <Link to="/alerts" className="px-5 py-2.5 bg-sky-600 text-white rounded-lg font-medium">
            All alerts →
          </Link>
        </div>
      </div>
    );
  }

  const stateSlug = getStateSlugForCode(city.stateCode);
  const stateLabel = city.stateName || city.stateCode;
  const alertCount = cityAlerts.length;
  const cardClasses = 'group flex items-center justify-between gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 transition-all duration-200 hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/10';
  const ctaClass = 'text-sm font-semibold text-sky-400 group-hover:text-sky-300 flex-shrink-0 transition-colors';

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="text-lg font-bold text-white hover:text-sky-300">
              StormTracking
            </Link>
          </div>
          <PageHeaderNav source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          {stateSlug && (
            <Link
              to={`/alerts/${stateSlug}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300 mb-3 transition-colors"
            >
              ← {stateLabel} Alerts
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {city.name} Weather Alerts &amp; Forecast
          </h1>
          {county ? (
            <p className="text-sm text-slate-400 mt-1">
              {county.name} County · NWS county-level warnings
              {lastUpdated && (
                <span className="text-slate-500">
                  {' '}
                  · {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">
              Live National Weather Service warnings and forecast for {city.name}, {stateLabel}.
              {lastUpdated && (
                <span className="text-slate-500">
                  {' '}
                  · Updated {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            {alertCount > 0
              ? `${alertCount} active alert${alertCount === 1 ? '' : 's'} right now for ${city.name}.`
              : `No active alerts right now for ${city.name}.`}
            {' '}Current conditions, hourly forecast, and 7-day outlook from NWS and NOAA.
          </p>
        </div>

        <section aria-label={`Live weather radar — ${city.name}`}>
          <StormMap
            weatherData={{}}
            stormPhase="active"
            userLocations={[{
              id: `city-pin-${city.slug}`,
              lat: city.lat,
              lon: city.lon,
              name: `${city.name}, ${city.stateCode}`,
              conditions: conditions ? {
                temperature: conditions.current?.temperature,
                temperatureUnit: 'F',
                shortForecast: conditions.current?.shortForecast || conditions.current?.condition,
              } : null,
            }]}
            alerts={mapAlerts}
            isHero
            selectedStateCode={city.stateCode}
            showResetView={false}
            centerOn={{ lat: city.lat, lon: city.lon, id: `city-${city.slug}`, zoom: 9 }}
          />
        </section>

        <CityCurrentConditions
          cityName={city.name}
          conditions={conditions}
          error={conditionsError}
        />

        {!alertsLoading && alertCount > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">
              Active alerts ({alertCount})
            </h2>
            <ul className="space-y-2">
              {cityAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`text-sm px-4 py-3 rounded-xl border ${severityClasses(alert.severity)}`}
                >
                  <p className="font-semibold">{alert.event}</p>
                  {alert.headline && <p className="text-xs opacity-90 mt-1">{alert.headline}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!alertsLoading && alertCount === 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Active Alerts</h2>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <p className="text-emerald-200 text-sm leading-relaxed">
                <strong>No active weather alerts for {city.name} at this time.</strong>
              </p>
            </div>
          </section>
        )}

        <CityForecastSection
          cityName={city.name}
          citySlug={city.slug}
          stateSlug={stateSlug}
          lat={city.lat}
          lon={city.lon}
          showUnavailableFallback
          onForecastLoad={handleForecastLoad}
          forecastLinkSource="catalog-city-page"
        />

        {county && (
          <Link
            to={`/alerts/county/${county.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            View all {county.name} County alerts
            <span aria-hidden="true">→</span>
          </Link>
        )}

        {siblingCities.length > 0 && county && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Nearby cities in {county.name} County</h2>
            <div className="flex flex-wrap gap-2">
              {siblingCities.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  to={cityAlertsPath(c.slug, RICH_CITY_SLUGS.has(c.slug))}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:border-sky-500/40 hover:text-sky-300 transition-colors"
                >
                  {c.name}
                  <span aria-hidden="true" className="text-sky-400 text-xs font-semibold">View Alerts →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Related</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to={`/radar?lat=${city.lat}&lon=${city.lon}`} className={cardClasses}>
              <div>
                <p className="text-sm font-medium text-white">Live radar for {city.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Real-time precipitation and storm tracking</p>
              </div>
              <span className={ctaClass} aria-hidden="true">Open →</span>
            </Link>
            {stateSlug && (
              <Link to={`/alerts/${stateSlug}`} className={cardClasses}>
                <div>
                  <p className="text-sm font-medium text-white">All {stateLabel} weather alerts</p>
                  <p className="text-xs text-slate-400 mt-0.5">Statewide active warnings and watches</p>
                </div>
                <span className={ctaClass} aria-hidden="true">More →</span>
              </Link>
            )}
          </div>
        </section>

        <footer className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed">
            Alerts sourced from the National Weather Service.
            Current conditions from{' '}
            <a className="hover:text-slate-300 underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            . Forecast from NWS gridpoints via{' '}
            <a className="hover:text-slate-300 underline" href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">weather.gov</a>.
            Updated continuously. StormTracking.io is not affiliated with NOAA or the NWS.
          </p>
        </footer>
      </main>
    </div>
  );
}
