/**
 * County alerts page — /alerts/county/:countySlug
 * Full-page layout with map + alerts sidebar (mirrors state alerts page).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import {
  fetchCountyBySlug,
  getCitiesForCounty,
  trackCountyAlertView,
  getStateSlugForCode,
  cityAlertsPath,
  alertMatchesCounty,
} from '../services/locationCatalogService';
import { fetchCountyHighlight } from '../services/geoLocationService';
import { setHomepageMetaTags } from '../data/homepageMeta';
import { US_STATES } from '../data/stateConfig';
import PageBackNav from './PageBackNav';
import SiteFooter from './SiteFooter';
import PageHeaderNav from './PageHeaderNav';
import StormMap from './StormMap';
import AlertDetailModal from './AlertDetailModal';
import AlertsByCategory from './AlertsByCategory';
import { NAV_SOURCES, trackForecastLinkClick } from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

function setCountyMetaTags(county) {
  const title = `${county.name} County, ${county.stateCode} Weather Alerts — Live NWS Warnings`;
  const desc = `Active NWS weather alerts for ${county.name} County, ${county.stateCode}. Updated continuously from the National Weather Service.`;
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);
}

export default function CountyAlertsPage() {
  const { countySlug } = useParams();
  const [county, setCounty] = useState(null);
  const [cities, setCities] = useState([]);
  const [loadingCounty, setLoadingCounty] = useState(true);
  const [highlightArea, setHighlightArea] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const { alerts: alertsData, loading: alertsLoading, lastUpdated } = useExtremeWeather(true);

  const allAlerts = alertsData?.allAlerts || [];

  const countyAlerts = useMemo(() => {
    if (!county) return [];
    return allAlerts.filter((a) => alertMatchesCounty(a, county));
  }, [county, allAlerts]);

  const stateSlug = county ? getStateSlugForCode(county.stateCode) : null;
  const stateData = stateSlug ? US_STATES[stateSlug] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCounty(true);
      setHighlightArea(null);
      const row = await fetchCountyBySlug(countySlug);
      if (cancelled) return;
      setCounty(row);
      if (row) {
        setCountyMetaTags(row);
        const linked = await getCitiesForCounty(row.id);
        if (!cancelled) setCities(linked);
        fetchCountyHighlight(row).then(({ feature }) => {
          if (!cancelled) setHighlightArea(feature);
        });
      }
      setLoadingCounty(false);
    })();
    return () => {
      cancelled = true;
      setHomepageMetaTags();
    };
  }, [countySlug]);

  const countyPageViewTrackedRef = useRef(null);
  useEffect(() => {
    if (county && !alertsLoading && countyPageViewTrackedRef.current !== county.id) {
      countyPageViewTrackedRef.current = county.id;
      trackCountyAlertView({
        countyId: county.id,
        stateCode: county.stateCode,
        alertCount: countyAlerts.length,
        source: 'county-page',
        countyName: county.name,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county?.id, alertsLoading]);

  if (loadingCounty) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!county) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">County Not Found</h1>
          <p className="text-slate-400 mb-6">No catalog entry for &quot;{countySlug}&quot;.</p>
          <Link to="/alerts" className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium">
            All alerts →
          </Link>
        </div>
      </div>
    );
  }

  const mapCenter = county.lat != null && county.lon != null
    ? { lat: county.lat, lon: county.lon, zoom: 8, id: `county-${county.slug}` }
    : stateData
      ? { lat: stateData.center[0], lon: stateData.center[1], zoom: stateData.zoom, id: `state-${county.stateCode}` }
      : null;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          <PageHeaderNav source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN} />
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {county.name} County, {county.stateCode} Weather Alerts
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live NWS warnings for {county.name} County
            {lastUpdated && (
              <span className="text-slate-500">
                {' '}
                · Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
          {stateSlug && (
            <Link
              to={`/alerts/${stateSlug}`}
              className="inline-block mt-2 text-sm text-sky-400 hover:underline"
            >
              ← {county.stateName || county.stateCode} state alerts
            </Link>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="lg:grid lg:grid-cols-[3fr_2fr] gap-6 items-start">
          <section
            className="sticky z-10 top-[calc(env(safe-area-inset-top,0px)+4px)] lg:top-4 -mx-4 sm:-mx-6 lg:mx-0 [&_.leaflet-container]:!h-[40vh] lg:[&_.leaflet-container]:!h-[500px] before:content-[''] before:absolute before:left-0 before:right-0 before:h-4 before:-top-4 before:bg-slate-900 lg:before:hidden"
          >
            <h2 className="text-lg font-semibold text-white mb-3 px-4 sm:px-6 lg:px-0">
              Live Weather Radar — {county.name} County
            </h2>
            {mapCenter && (
              <StormMap
                weatherData={{}}
                stormPhase="active"
                userLocations={[]}
                alerts={countyAlerts}
                cityMarkers={[]}
                isHero
                centerOn={mapCenter}
                highlightArea={highlightArea}
                showResetView={false}
                selectedStateCode={county.stateCode}
                radarLayerType="precipitation"
                radarColorScheme={4}
              />
            )}
          </section>

          <div className="space-y-4 mt-6 lg:mt-0">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">
                Active Weather Alerts in {county.name} County
                {!alertsLoading && (
                  <span className="text-sm font-normal text-slate-400 ml-2">({countyAlerts.length})</span>
                )}
              </h2>

              {alertsLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Loading alerts...</p>
                </div>
              ) : countyAlerts.length === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-8 text-center">
                  <p className="text-lg font-medium text-emerald-400 mb-1">
                    No active weather alerts for {county.name} County
                  </p>
                  <p className="text-sm text-slate-400">
                    Check back for updates. Alerts refresh continuously from the NWS.
                  </p>
                </div>
              ) : (
                <AlertsByCategory
                  alerts={countyAlerts}
                  stateCode={county.stateCode}
                  onViewDetail={setSelectedAlert}
                />
              )}
            </section>

            {cities.length > 0 && (
              <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Cities in {county.name} County</h2>
                <div className="flex flex-wrap gap-2">
                  {cities.map((city) => (
                    <Link
                      key={city.id}
                      to={cityAlertsPath(city.slug, RICH_CITY_SLUGS.has(city.slug))}
                      className="text-sm px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 rounded-lg text-slate-300 hover:text-white transition-colors"
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                to="/radar"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded-lg font-medium"
              >
                Live radar →
              </Link>
              {stateSlug && (
                <Link
                  to={`/forecast/${stateSlug}`}
                  onClick={() => trackForecastLinkClick('county-page', stateSlug, 'state-default')}
                  className="px-4 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 hover:border-sky-400/60 text-sky-300 hover:text-sky-200 text-sm rounded-lg font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10"
                >
                  {county.stateCode} forecast →
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
}
