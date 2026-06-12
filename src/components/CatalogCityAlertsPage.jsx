/**
 * Catalog city alerts page — /alerts/city/:citySlug
 * For cities in the Supabase catalog (rich /alerts/:slug pages redirect here).
 * Uses ForecastPage layout with compact alert integration.
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
import { trackCityAlertView } from '../utils/analytics';
import { setHomepageMetaTags } from '../data/homepageMeta';
import PageHeaderNav from './PageHeaderNav';
import ForecastCityLayout from './ForecastCityLayout';
import { CityRelatedLinks, CityNearbyLinks } from './city/CityWeatherDashboard';
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
    const enriched = allAlerts.filter((a) => ids.has(a.id));
    if (enriched.length > 0) return enriched;
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

  const siblingLinks = siblingCities.slice(0, 8).map((c) => ({
    id: c.id,
    slug: c.slug,
    href: cityAlertsPath(c.slug, RICH_CITY_SLUGS.has(c.slug)),
    label: c.name,
    cityName: c.name,
    stateCode: city.stateCode,
    stateSlug,
  }));

  return (
    <ForecastCityLayout
      cityName={city.name}
      citySlug={city.slug}
      stateSlug={stateSlug}
      stateName={stateLabel}
      stateCode={city.stateCode}
      lat={city.lat}
      lon={city.lon}
      alerts={alertsLoading ? null : cityAlerts}
      alertsLoading={alertsLoading}
      mapAlerts={mapAlerts}
      analyticsSource="catalog_city_page"
      headerNav={<PageHeaderNav source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN} />}
      extras={(
        <div className="space-y-6">
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
            <CityNearbyLinks
              title="Nearby Forecasts"
              cities={siblingLinks}
              stateCode={city.stateCode}
              stateSlug={stateSlug}
            />
          )}
          <CityRelatedLinks
            cityName={city.name}
            lat={city.lat}
            lon={city.lon}
            stateSlug={stateSlug}
            stateLabel={stateLabel}
          />
        </div>
      )}
      footerNote={(
        <>
          Alerts sourced from the National Weather Service.
          Forecast from NWS gridpoints via{' '}
          <a className="text-sky-400 hover:underline" href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">weather.gov</a>.
          {lastUpdated && (
            <> Last updated {new Date(lastUpdated).toLocaleTimeString()}.</>
          )}
          {' '}StormTracking.io is not affiliated with NOAA or the NWS.
        </>
      )}
    />
  );
}
