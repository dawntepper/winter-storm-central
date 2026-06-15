/**
 * State Alerts Page Component
 * Shows NWS weather alerts filtered for a specific US state,
 * with a radar map zoomed to that state and links to nearby states.
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { getActiveStormEvents } from '../services/stormEventsService';
import { ALERT_CATEGORIES } from '../services/noaaAlertsService';
import { setHomepageMetaTags } from '../data/homepageMeta';
import StormMap from './StormMap';
import { CityDirectory, citiesWithCoordsForState } from './CitiesInState';
import EssentialsCard from './EssentialsCard';
import LocalForecastsAndAlerts from './LocalForecastsAndAlerts';
import AlertDetailModal from './AlertDetailModal';
import AlertsByCategory from './AlertsByCategory';
import PageHeaderNav from './PageHeaderNav';
import PageBackNav from './PageBackNav';
import { AlertListSkeleton, Skeleton } from './Skeletons';
import StateActionCards from './state/StateActionCards';
import StateUseMyLocationBar from './state/StateUseMyLocationBar';
import StateFindLocalWeather from './state/StateFindLocalWeather';
import StateCityRail from './state/StateCityRail';
import StateEmptyAlerts from './state/StateEmptyAlerts';
import StateCountyBrowse from './state/StateCountyBrowse';
import RelatedWeatherLinks from './state/RelatedWeatherLinks';

// Hurricane/Gulf Coast states surface the Florida-style variant; Tornado Alley
// states get the tornado variant. TX gets its own variant. All other states
// have no embedded prep card (component returns null when variant missing OR
// when AFFILIATE_LINKS_ENABLED is false).
const STATE_ESSENTIALS_VARIANTS = {
  FL: 'state-fl',
  TX: 'state-tx',
  LA: 'state-fl',
  GA: 'state-fl',
  SC: 'state-fl',
  NC: 'state-fl',
  AL: 'state-fl',
  MS: 'state-fl',
  KS: 'state-tornado',
  OK: 'state-tornado',
  NE: 'state-tornado',
  IA: 'state-tornado',
  MO: 'state-tornado',
  AR: 'state-tornado',
};
import {
  US_STATES, SLUG_TO_ABBR, STATE_NAMES, NEARBY_STATES, ABBR_TO_SLUG, getStateUrl
} from '../data/stateConfig';
import {
  trackStateAlertsPageView,
  trackStateNearbyClick,
  setNavSource,
  NAV_SOURCES
} from '../utils/analytics';

// =============================================
// SEO META TAGS
// =============================================

function setStateMetaTags(stateName, stateSlug) {
  const title = `${stateName} Weather Alerts Today — Live NWS Warnings & Radar`;
  const desc = `Active NWS warnings across ${stateName} right now. Live radar, tornado and severe thunderstorm watches, flood and winter alerts — updated continuously.`;

  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', `https://stormtracking.io/alerts/${stateSlug}`);

  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', title);

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', desc);

  let twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `https://stormtracking.io/alerts/${stateSlug}`);

  let keywords = document.querySelector('meta[name="keywords"]');
  if (keywords) {
    keywords.setAttribute('content',
      `${stateName.toLowerCase()} weather alerts, ${stateName.toLowerCase()} weather warnings, ${stateName.toLowerCase()} severe weather, ${stateName.toLowerCase()} radar, NWS ${stateName.toLowerCase()}`
    );
  }
}

function resetMetaTags() {
  setHomepageMetaTags();
}

// =============================================
// ACTIVE STORMS FOR STATE
// =============================================

function ActiveStormsForState({ stateAbbr }) {
  const [storms, setStorms] = useState([]);

  useEffect(() => {
    async function fetchStorms() {
      const { data } = await getActiveStormEvents();
      if (data) {
        const matching = data.filter(storm =>
          Array.isArray(storm.affectedStates) && storm.affectedStates.includes(stateAbbr)
        );
        setStorms(matching);
      }
    }
    fetchStorms();
  }, [stateAbbr]);

  if (storms.length === 0) return null;

  const typeIcons = {
    winter_storm: '❄️', hurricane: '🌀', severe_weather: '⛈️',
    flooding: '🌊', heat_wave: '🌡️', wildfire: '🔥', default: '⚠️'
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        Active Storm Events
      </h2>
      <div className="space-y-2">
        {storms.map(storm => (
          <Link
            key={storm.id || storm.slug}
            to={`/storm/${storm.slug}`}
            className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors"
          >
            <span className="text-xl">{typeIcons[storm.type] || typeIcons.default}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{storm.title}</p>
              <span className={`text-xs font-medium inline-block mt-0.5 px-2 py-0.5 rounded-full ${
                storm.status === 'active'
                  ? 'bg-emerald-500/30 text-emerald-300'
                  : 'bg-amber-400/30 text-amber-300'
              }`}>
                {storm.status === 'active' ? 'Active Now' : 'Forecasted'}
              </span>
            </div>
            <span className="text-xs font-medium text-sky-400">View →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// =============================================
// NEARBY STATES
// =============================================

function NearbyStateAlertsViz({ stateAbbr, alertCountsByState, allAlerts }) {
  const navigate = useNavigate();
  const nearby = NEARBY_STATES[stateAbbr] || [];
  if (nearby.length === 0) return null;

  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;

  // Build sorted list with category info
  const stateRows = nearby
    .map(abbr => {
      const name = STATE_NAMES[abbr];
      const slug = ABBR_TO_SLUG[abbr];
      const count = alertCountsByState[abbr] || 0;
      if (!name || !slug) return null;

      // Find dominant category for this state
      const stateAlerts = (allAlerts || []).filter(a => a.state === abbr);
      const catCounts = {};
      for (const a of stateAlerts) {
        const cat = a.category || 'severe';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
      const topCategories = Object.entries(catCounts).sort(([, a], [, b]) => b - a);
      const topCatId = topCategories[0]?.[0];
      const topCat = topCatId ? ALERT_CATEGORIES[topCatId] : null;
      const barColor = topCat?.color || '#64748b';

      // Top 3 category icons
      const catIcons = topCategories.slice(0, 3).map(([catId]) => {
        const cat = ALERT_CATEGORIES[catId];
        return cat ? cat.icon : null;
      }).filter(Boolean);

      return { abbr, name, slug, count, barColor, catIcons };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...stateRows.map(s => s.count), 1);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
        <h3 className="text-sm font-semibold text-emerald-400">States Near {stateName}</h3>
      </div>
      <div className="p-4 space-y-1.5">
        {stateRows.map(st => (
          <button
            key={st.abbr}
            onClick={() => {
              trackStateNearbyClick({ fromState: stateAbbr, toState: st.abbr });
              navigate(`/alerts/${st.slug}`);
            }}
            className="group w-full flex items-center gap-2 hover:bg-slate-700/30 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-left"
          >
            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-1">
              <span className="w-7">{st.abbr}</span>
              {st.catIcons.map((icon, i) => (
                <span key={i} className="text-[8px] leading-none">{icon}</span>
              ))}
            </span>
            <div className="flex-1 h-4 bg-slate-700/40 rounded-sm overflow-hidden relative">
              {st.count > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-sm transition-all"
                  style={{
                    width: `${(st.count / maxCount) * 100}%`,
                    backgroundColor: st.barColor,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
            <span className="text-xs text-slate-400 w-7 text-right tabular-nums">
              {st.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE COMPONENT
// =============================================

export default function StateAlertsPage() {
  const { slug: stateSlug } = useParams();
  const stateAbbr = SLUG_TO_ABBR[stateSlug];
  const stateData = stateAbbr ? US_STATES[stateSlug] : null;

  // Alerts
  const {
    alerts: alertsData,
    loading: alertsLoading,
    lastUpdated,
  } = useExtremeWeather(true);

  // Alert detail modal
  const [selectedAlert, setSelectedAlert] = useState(null);

  const scrollToSection = useCallback((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToRadar = useCallback(() => {
    scrollToSection('state-alerts-map');
  }, [scrollToSection]);

  const scrollToLocalWeather = useCallback(() => {
    scrollToSection('state-local-weather');
  }, [scrollToSection]);

  const scrollToCounties = useCallback(() => {
    scrollToSection('state-counties');
  }, [scrollToSection]);

  // Filter alerts for this state
  const stateAlerts = useMemo(() => {
    if (!alertsData?.allAlerts || !stateAbbr) return [];
    return alertsData.allAlerts.filter(a => a.state === stateAbbr);
  }, [alertsData, stateAbbr]);

  // Default: all state alerts on map.
  const displayMapAlerts = stateAlerts;
  const displayMapCenter = {
    lat: stateData?.center[0],
    lon: stateData?.center[1],
    zoom: (stateData?.zoom ?? 7) - 1,
    id: `state-${stateAbbr}`,
  };

  // Cities in this state with dedicated pages — rendered as clickable map markers
  const stateCityMarkers = useMemo(
    () => (stateAbbr ? citiesWithCoordsForState(stateAbbr) : []),
    [stateAbbr]
  );

  // Compute alert counts by state (for nearby states badges)
  const alertCountsByState = useMemo(() => {
    if (!alertsData?.allAlerts) return {};
    const counts = {};
    for (const alert of alertsData.allAlerts) {
      if (alert.state) {
        counts[alert.state] = (counts[alert.state] || 0) + 1;
      }
    }
    return counts;
  }, [alertsData]);

  // Set meta tags
  useEffect(() => {
    if (stateData) {
      setStateMetaTags(stateData.name, stateSlug);
    }
    return () => resetMetaTags();
  }, [stateSlug, stateData]);

  // Track page view once per state navigation (not on alert polling refreshes).
  const statePageViewTrackedRef = useRef(null);
  useEffect(() => {
    if (stateData && !alertsLoading && statePageViewTrackedRef.current !== stateAbbr) {
      statePageViewTrackedRef.current = stateAbbr;
      trackStateAlertsPageView({
        stateCode: stateAbbr,
        stateName: stateData.name,
        alertCount: stateAlerts.length
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateAbbr, stateData, alertsLoading]);

  // 404 — invalid state slug
  if (!stateAbbr || !stateData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">State Not Found</h1>
          <p className="text-slate-400 mb-6">The state "{stateSlug}" could not be found.</p>
          <Link to="/" className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": `${stateData.name} Weather Alerts Today — Live NWS Warnings & Radar`,
            "description": `Active NWS warnings across ${stateData.name} right now. Live radar, tornado and severe thunderstorm watches, flood and winter alerts — updated continuously.`,
            "url": `https://stormtracking.io/alerts/${stateSlug}`,
            "isPartOf": {
              "@type": "WebSite",
              "name": "StormTracking",
              "url": "https://stormtracking.io"
            }
          })
        }}
      />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          <PageHeaderNav
            source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN}
            currentStateSlug={stateSlug}
          />
        </div>
      </header>

      {/* Page Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{stateData.name} Weather Alerts</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Real-time severe weather alerts from the National Weather Service
              </p>
            </div>
            <div className="flex items-center gap-3">
              {alertsLoading ? (
                <Skeleton className="h-7 w-20 rounded-lg" />
              ) : (
                <a
                  href="#state-alerts"
                  className={`text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors ${
                    stateAlerts.length > 0
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                >
                  {stateAlerts.length} {stateAlerts.length === 1 ? 'Alert' : 'Alerts'}
                </a>
              )}
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-2">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
          <StateActionCards
            stateCode={stateAbbr}
            stateName={stateData.name}
            onRadar={scrollToRadar}
            onSelectCity={scrollToLocalWeather}
            onCounties={scrollToCounties}
          />
          <StateUseMyLocationBar stateCode={stateAbbr} />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* City rail | radar | alerts — desktop; mobile stacks rail above map */}
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[auto_1fr_minmax(0,300px)] lg:gap-4 xl:gap-5 items-start">
          <StateCityRail
            layout="horizontal"
            stateAbbr={stateAbbr}
            stateCode={stateAbbr}
            stateSlug={stateSlug}
            className="lg:hidden"
          />

          {/* City rail + map — sticky while scrolling alerts */}
          <div className="lg:col-span-2 sticky z-10 top-[calc(env(safe-area-inset-top,0px)+4px)] lg:top-4 lg:grid lg:grid-cols-[auto_1fr] lg:gap-3 lg:items-start before:content-[''] before:absolute before:left-0 before:right-0 before:h-4 before:-top-4 before:bg-slate-900 lg:before:hidden">
            <StateCityRail
              layout="vertical"
              stateAbbr={stateAbbr}
              stateCode={stateAbbr}
              stateSlug={stateSlug}
              className="hidden lg:flex"
            />
            <section
              id="state-alerts-map"
              className="relative -mx-4 sm:-mx-6 lg:mx-0 min-w-0 [&_.leaflet-container]:!h-[40vh] lg:[&_.leaflet-container]:!h-[500px]"
            >
              <StormMap
                weatherData={{}}
                stormPhase="active"
                userLocations={[]}
                alerts={displayMapAlerts}
                cityMarkers={stateCityMarkers}
                isHero
                centerOn={displayMapCenter}
                highlightArea={null}
                onResetView={undefined}
                resetViewLabel="Full View"
                resetViewTitle="Reset to default US view"
                resetToDefaultOnClick
                selectedStateCode={stateAbbr}
                radarLayerType="precipitation"
                radarColorScheme={4}
                stateNavSource={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN}
                currentStateSlug={stateSlug}
              />
            </section>
          </div>

          {/* Alerts sidebar — scrolls with page */}
          <div className="space-y-4 mt-6 lg:mt-0">

            {/* Active Storm Events */}
            <ActiveStormsForState stateAbbr={stateAbbr} />

            {/* Alerts */}
            <section id="state-alerts">
              <h2 className="text-lg font-semibold text-white mb-3">
                Active Weather Alerts in {stateData.name}
                {!alertsLoading && (
                  <span className="text-sm font-normal text-slate-400 ml-2">({stateAlerts.length})</span>
                )}
              </h2>

              {alertsLoading ? (
                <AlertListSkeleton count={4} showHeader={false} />
              ) : stateAlerts.length === 0 ? (
                <StateEmptyAlerts
                  stateName={stateData.name}
                  onViewRadar={scrollToRadar}
                  onSelectCity={scrollToLocalWeather}
                />
              ) : (
                <AlertsByCategory
                  alerts={stateAlerts}
                  stateCode={stateAbbr}
                  onViewDetail={setSelectedAlert}
                />
              )}
            </section>

            <LocalForecastsAndAlerts
              stateSlug={stateSlug}
              stateName={stateData.name}
              stateCode={stateAbbr}
            />

            <StateFindLocalWeather
              stateCode={stateAbbr}
              stateName={stateData.name}
            />

            {/* Nearby State Alerts Visualization */}
            <NearbyStateAlertsViz
              stateAbbr={stateAbbr}
              alertCountsByState={alertCountsByState}
              allAlerts={alertsData?.allAlerts}
            />
          </div>
        </div>

        <StateCountyBrowse stateCode={stateAbbr} stateName={stateData.name} />

        {/* City directory */}
        <CityDirectory stateAbbr={stateAbbr} stateName={stateData.name} />

        {/* Storm prep essentials — only shown for hurricane-prone or tornado-belt
            states, and gated by AFFILIATE_LINKS_ENABLED so the component renders
            null until the feature flag is flipped on. */}
        {STATE_ESSENTIALS_VARIANTS[stateAbbr] && (
          <section>
            <EssentialsCard
              variant={STATE_ESSENTIALS_VARIANTS[stateAbbr]}
              placement={`state-${stateSlug}`}
            />
          </section>
        )}

        {/* SEO FAQ */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{stateData.name} Weather Alert FAQ</h2>
          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                What types of weather alerts affect {stateData.name}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {stateData.name} can experience a range of NWS alerts including winter storm warnings,
                severe thunderstorm watches, tornado warnings, flood advisories, heat advisories, and more.
                All alerts shown here come directly from the National Weather Service and are updated in real-time.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                How often are {stateData.name} weather alerts updated?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Weather alerts for {stateData.name} refresh every 10 minutes from the National Weather Service
                (every 2 minutes during active tornado or flash flood warnings). New alerts appear as soon
                as they are issued. Radar imagery refreshes about every 5 minutes.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                How can I track severe weather in {stateData.name}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bookmark this page to check {stateData.name} weather alerts. You can also visit our{' '}
                <Link to="/radar" className="text-sky-400 hover:underline">live radar page</Link>{' '}
                for a full-screen radar view, or our{' '}
                <Link to="/" className="text-sky-400 hover:underline">homepage</Link>{' '}
                to track active storm events across the country.
              </p>
            </div>
          </div>
        </section>

        <RelatedWeatherLinks
          stateName={stateData.name}
          stateSlug={stateSlug}
          stateCode={stateAbbr}
          onStateRadar={scrollToRadar}
          onStateCounties={scrollToCounties}
        />

        {/* CTA */}
        <section className="text-center py-4">
          <h2 className="text-lg font-semibold text-white mb-2">Stay Safe in {stateData.name}</h2>
          <p className="text-slate-400 text-sm mb-4 max-w-xl mx-auto">
            Monitor weather conditions across all 50 states with live radar and real-time NWS alerts.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/radar"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Full Radar Map →
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm"
            >
              All Weather Alerts →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-slate-800 px-4">
        <p className="text-slate-500 text-xs max-w-2xl mx-auto">
          <span className="font-medium text-slate-400">Disclaimer:</span> StormTracking uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
          <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>
          {' '}and follow local emergency management guidance.
        </p>
      </footer>

      {/* Alert Detail Modal */}
      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
}
