/**
 * Catalog city alerts page — /alerts/city/:citySlug
 * For cities in the Supabase catalog (rich /alerts/:slug pages redirect here).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { trackCityAlertView, trackForecastLinkClick } from '../utils/analytics';
import { setHomepageMetaTags } from '../data/homepageMeta';
import PageBackNav from './PageBackNav';
import PageHeaderNav from './PageHeaderNav';
import StormMap from './StormMap';
import { NAV_SOURCES } from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

function setCityMetaTags(city, county) {
  const title = `${city.name}, ${city.stateCode} Weather Alerts — ${county?.name || ''} County`;
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute(
      'content',
      `Active NWS weather alerts near ${city.name}, ${city.stateCode}. County-level warnings from the National Weather Service.`,
    );
  }
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

  useEffect(() => {
    if (redirectToRichPage) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cityRow = await getCityBySlugWithFallback(citySlug);
      if (cancelled) return;
      setCity(cityRow);

      if (cityRow) {
        const countyRow = await getPrimaryCountyForCity(cityRow.id);
        if (!cancelled) setCounty(countyRow);
        if (countyRow) {
          setCityMetaTags(cityRow, countyRow);
          const linked = await getCitiesForCounty(countyRow.id);
          if (!cancelled) setSiblingCities(linked.filter((c) => c.id !== cityRow.id));
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

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="text-lg font-bold text-white hover:text-sky-300">
              StormTracking
            </Link>
          </div>
          <PageHeaderNav source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {city.name}, {city.stateCode} Alerts
          </h1>
          {county && (
            <p className="text-sm text-slate-400 mt-1">
              {county.name} County · NWS county-level warnings
              {lastUpdated && (
                <span className="text-slate-500">
                  {' '}
                  · {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
          {stateSlug && (
            <Link to={`/alerts/${stateSlug}`} className="inline-block mt-2 text-xs text-sky-400 hover:underline">
              ← {city.stateName || city.stateCode} state alerts
            </Link>
          )}
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
            }]}
            alerts={mapAlerts}
            isHero
            selectedStateCode={city.stateCode}
            showResetView={false}
            centerOn={{ lat: city.lat, lon: city.lon, id: `city-${city.slug}`, zoom: 9 }}
          />
        </section>

        {!alertsLoading && cityAlerts.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white mb-3">
              Active alerts ({cityAlerts.length})
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

        {county && (
          <Link
            to={`/alerts/county/${county.slug}`}
            className="inline-block text-sm text-sky-400 hover:underline"
          >
            View all {county.name} County alerts →
          </Link>
        )}

        {siblingCities.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white mb-3">Other cities in {county?.name} County</h2>
            <div className="flex flex-wrap gap-2">
              {siblingCities.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  to={cityAlertsPath(c.slug, RICH_CITY_SLUGS.has(c.slug))}
                  className="text-sm px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:border-sky-500/40"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Link to="/radar" className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg font-medium">
            Radar →
          </Link>
          {stateSlug && (
            <Link
              to={`/forecast/${stateSlug}?city=${city.slug}`}
              onClick={() => trackForecastLinkClick('catalog-city-page', stateSlug, 'city')}
              className="px-4 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 hover:border-sky-400/60 text-sky-300 hover:text-sky-200 text-sm rounded-lg font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10"
            >
              Forecast →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
