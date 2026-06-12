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
import { trackCityAlertView, trackCityWeatherPageView } from '../utils/analytics';
import { setHomepageMetaTags } from '../data/homepageMeta';
import PageHeaderNav from './PageHeaderNav';
import StormMap from './StormMap';
import CityRightNowCard from './city/CityRightNowCard';
import CityForecastSection from './CityForecastSection';
import CityWeatherDashboard, { CityRelatedLinks, CityNearbyLinks } from './city/CityWeatherDashboard';
import CityRadarSection from './city/CityRadarSection';
import { useCityForecast } from '../hooks/useCityForecast';
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
  const [forecastLoaded, setForecastLoaded] = useState(false);
  const [hasForecastData, setHasForecastData] = useState(false);

  const { alerts: alertsData, loading: alertsLoading, lastUpdated } = useExtremeWeather(true);
  const allAlerts = alertsData?.allAlerts || [];

  const cityAlerts = useMemo(() => {
    if (!city) return [];
    return allAlerts.filter((a) => alertMatchesCity(a, city, county));
  }, [city, county, allAlerts]);

  const { forecast: nwsForecast } = useCityForecast(city?.lat, city?.lon);

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

  const mapConditions = nwsForecast?.current ? {
    temperature: nwsForecast.current.temperature,
    temperatureUnit: nwsForecast.current.temperatureUnit,
    shortForecast: nwsForecast.current.shortForecast,
  } : null;

  const siblingLinks = siblingCities.slice(0, 8).map((c) => ({
    id: c.id,
    href: cityAlertsPath(c.slug, RICH_CITY_SLUGS.has(c.slug)),
    label: c.name,
  }));

  return (
    <CityWeatherDashboard
      headerNav={<PageHeaderNav source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN} />}
      stateBackLink={stateSlug ? (
        <Link
          to={`/alerts/${stateSlug}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300 mb-3 transition-colors"
        >
          ← {stateLabel} Alerts
        </Link>
      ) : null}
      title={`${city.name} Weather Alerts & Forecast`}
      subtitle={county
        ? `${county.name} County · NWS county-level warnings. ${alertCount > 0 ? `${alertCount} active alert${alertCount === 1 ? '' : 's'} right now.` : 'No active alerts right now.'} Current conditions, hourly forecast, and 7-day outlook from NWS and NOAA.`
        : `Live National Weather Service warnings and forecast for ${city.name}, ${stateLabel}. ${alertCount > 0 ? `${alertCount} active alert${alertCount === 1 ? '' : 's'} right now.` : 'No active alerts right now.'}`}
      cityName={city.name}
      lat={city.lat}
      lon={city.lon}
      citySlug={city.slug}
      stateCode={city.stateCode}
      alerts={alertsLoading ? null : cityAlerts}
      alertsLoading={alertsLoading}
      lastUpdated={lastUpdated}
      rightNow={(
        <CityRightNowCard
          lat={city.lat}
          lon={city.lon}
          locationName={`${city.name}, ${city.stateCode}`}
          cityName={city.name}
        />
      )}
      radar={(
        <CityRadarSection
          cityName={city.name}
          citySlug={city.slug}
          stateCode={city.stateCode}
          analyticsSource="catalog_city_page"
          hasAlerts={alertCount > 0}
        >
          <section aria-label={`Live weather radar — ${city.name}`}>
            <StormMap
              weatherData={{}}
              stormPhase="active"
              userLocations={[{
                id: `city-pin-${city.slug}`,
                lat: city.lat,
                lon: city.lon,
                name: `${city.name}, ${city.stateCode}`,
                conditions: mapConditions,
              }]}
              alerts={mapAlerts}
              isHero
              selectedStateCode={city.stateCode}
              resetViewTitle={`Return to ${city.name}`}
              centerOn={{ lat: city.lat, lon: city.lon, id: `city-${city.slug}`, zoom: 9 }}
            />
          </section>
        </CityRadarSection>
      )}
      forecast={(
        <CityForecastSection
          cityName={city.name}
          citySlug={city.slug}
          stateSlug={stateSlug}
          stateCode={city.stateCode}
          lat={city.lat}
          lon={city.lon}
          showUnavailableFallback
          onForecastLoad={handleForecastLoad}
          forecastLinkSource="catalog-city-page"
          analyticsSource="catalog_city_page"
        />
      )}
      related={(
        <>
          {county && (
            <Link
              to={`/alerts/county/${county.slug}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
              View all {county.name} County alerts
              <span aria-hidden="true">→</span>
            </Link>
          )}
          <CityRelatedLinks
            cityName={city.name}
            lat={city.lat}
            lon={city.lon}
            stateSlug={stateSlug}
            stateLabel={stateLabel}
          />
        </>
      )}
      nearby={siblingCities.length > 0 && county ? (
        <CityNearbyLinks
          title={`Nearby cities in ${county.name} County`}
          cities={siblingLinks}
        />
      ) : null}
      footer={(
        <footer className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed text-center">
            Alerts sourced from the National Weather Service.
            Current conditions from{' '}
            <a className="hover:text-slate-300 underline" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
            . Forecast from NWS gridpoints via{' '}
            <a className="hover:text-slate-300 underline" href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">weather.gov</a>.
            Updated continuously. StormTracking.io is not affiliated with NOAA or the NWS.
          </p>
        </footer>
      )}
    />
  );
}
