/**
 * State Alerts Page Component
 * Shows NWS weather alerts filtered for a specific US state,
 * with a radar map zoomed to that state.
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { getActiveStormEvents } from '../services/stormEventsService';
import { setHomepageMetaTags } from '../data/homepageMeta';
import StormMap from './StormMap';
import { CityDirectory, citiesWithCoordsForState } from './CitiesInState';
import EssentialsCard from './EssentialsCard';
import AlertDetailModal from './AlertDetailModal';
import PageSiteHeader from './PageSiteHeader';
import StateActionCards from './state/StateActionCards';
import StateFindLocalWeather from './state/StateFindLocalWeather';
import StateCurrentSituation from './state/StateCurrentSituation';
import CurrentStateAlerts from './state/CurrentStateAlerts';
import PopularLocations from './state/PopularLocations';
import StateCountyBrowse from './state/StateCountyBrowse';
import RelatedWeatherLinks from './state/RelatedWeatherLinks';
import SiteFooter from './SiteFooter';
import { hazardEngine } from '../../shared/hazard-engine/index.js';
import { CATEGORY_ORDER } from '../../shared/nws-alert-parser.js';
import {
  REFRESH_INTERVAL_NORMAL,
  REFRESH_INTERVAL_FAST,
} from '../services/noaaAlertsService';

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
  US_STATES, SLUG_TO_ABBR
} from '../data/stateConfig';
import {
  trackStateAlertsPageView,
  NAV_SOURCES
} from '../utils/analytics';

const REFRESH_NORMAL_MIN = Math.round(REFRESH_INTERVAL_NORMAL / 60000);
const REFRESH_FAST_MIN = Math.round(REFRESH_INTERVAL_FAST / 60000);

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
// MAIN PAGE COMPONENT
// =============================================

export default function StateAlertsPage() {
  const { slug: stateSlug } = useParams();
  const stateAbbr = SLUG_TO_ABBR[stateSlug];
  const stateData = stateAbbr ? US_STATES[stateSlug] : null;

  const {
    alerts: alertsData,
    loading: alertsLoading,
    lastUpdated,
    error: alertsError,
  } = useExtremeWeather(true);

  const [selectedAlert, setSelectedAlert] = useState(null);
  /**
   * Source of truth for hazard filtering on this page.
   * null = all active hazards; otherwise an ALERT_CATEGORIES id (e.g. 'heat').
   * Drives Current Situation pills, map markers, and Current Alerts list.
   */
  const [selectedHazard, setSelectedHazard] = useState(null);

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

  const scrollToAlerts = useCallback(() => {
    scrollToSection('current-alerts');
  }, [scrollToSection]);

  // Reset hazard filter when navigating between states
  useEffect(() => {
    setSelectedHazard(null);
  }, [stateAbbr]);

  const stateIntel = useMemo(() => {
    if (!stateAbbr) return null;
    return hazardEngine.getState(stateAbbr, alertsData?.allAlerts || [], {
      latestSourceUpdateAt: lastUpdated || null,
      dataAvailable: !alertsError,
    });
  }, [stateAbbr, alertsData, lastUpdated, alertsError]);

  const stateAlerts = stateIntel?.ok ? stateIntel.alerts : [];

  // StormMap marker filter — derived from page-owned selectedHazard
  const activeCategories = useMemo(() => {
    if (!selectedHazard) return new Set(CATEGORY_ORDER);
    return new Set([selectedHazard]);
  }, [selectedHazard]);

  const handleSelectHazard = useCallback((categoryId) => {
    setSelectedHazard((prev) => {
      if (categoryId == null) return null;
      // Toggle off → back to All
      if (prev === categoryId) return null;
      return categoryId;
    });
  }, []);

  const displayMapCenter = useMemo(() => {
    if (!stateData || !stateAbbr) return null;
    return {
      lat: stateData.center[0],
      lon: stateData.center[1],
      zoom: (stateData.zoom ?? 7) - 1,
      id: `state-${stateAbbr}`,
    };
  }, [stateAbbr, stateData]);

  const stateCityMarkers = useMemo(
    () => (stateAbbr ? citiesWithCoordsForState(stateAbbr) : []),
    [stateAbbr]
  );

  useEffect(() => {
    if (stateData) {
      setStateMetaTags(stateData.name, stateSlug);
    }
    return () => resetMetaTags();
  }, [stateSlug, stateData]);

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

      <PageSiteHeader
        source={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN}
        currentStateSlug={stateSlug}
      />

      {/* Page Header — always paints immediately from route slug */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 lg:py-3">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">{stateData.name} Weather Alerts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time severe weather alerts from the National Weather Service.
          </p>
          <StateActionCards
            stateCode={stateAbbr}
            stateName={stateData.name}
            onRadar={scrollToRadar}
            onSelectCity={scrollToLocalWeather}
            onCounties={scrollToCounties}
          />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:pt-3 lg:pb-6 space-y-4 sm:space-y-6 lg:space-y-4">
        {stateIntel?.ok ? (
          <StateCurrentSituation
            stateIntel={stateIntel}
            selectedCategory={selectedHazard}
            allCategoriesSelected={selectedHazard == null}
            onSelectCategory={handleSelectHazard}
            onAlertsClick={scrollToAlerts}
          />
        ) : null}

        {/* Map + Find Local Weather */}
        <div className="lg:grid lg:grid-cols-[1fr_minmax(0,300px)] lg:gap-4 xl:gap-5 items-start">
          <div className="min-w-0 w-full self-start h-fit">
            <section
              id="state-alerts-map"
              aria-labelledby="state-live-map-heading"
              className="sticky z-10 top-[calc(env(safe-area-inset-top,0px)+4px)] lg:top-4 relative -mx-4 sm:-mx-6 lg:mx-0 before:content-[''] before:absolute before:left-0 before:right-0 before:h-4 before:-top-4 before:bg-slate-900 lg:before:hidden"
            >
              <div className="flex flex-wrap items-end justify-between gap-2 mb-2 px-4 sm:px-6 lg:px-0">
                <h2
                  id="state-live-map-heading"
                  className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  Live {stateData.name} Weather Map
                </h2>
                <Link
                  to="/radar"
                  className="text-sm text-sky-400 hover:text-sky-300 font-medium"
                >
                  Open Full Radar →
                </Link>
              </div>
              <StormMap
                weatherData={{}}
                stormPhase="active"
                userLocations={[]}
                alerts={stateAlerts}
                cityMarkers={stateCityMarkers}
                isHero
                presentation="embedded"
                embedFit="state"
                embedContextKey={stateAbbr}
                centerOn={displayMapCenter}
                highlightArea={null}
                onResetView={undefined}
                resetViewLabel="Full View"
                resetViewTitle={`Reset to ${stateData.name} view`}
                resetToDefaultOnClick
                selectedStateCode={stateAbbr}
                radarLayerType="precipitation"
                radarColorScheme={4}
                stateNavSource={NAV_SOURCES.STATE_PAGE_STATE_DROPDOWN}
                currentStateSlug={stateSlug}
                activeCategories={activeCategories}
                showHazardControls={false}
              />
            </section>
          </div>

          <div className="space-y-4 mt-6 lg:mt-0">
            <StateFindLocalWeather
              stateCode={stateAbbr}
              stateName={stateData.name}
            />
            <ActiveStormsForState stateAbbr={stateAbbr} />
          </div>
        </div>

        {stateIntel?.ok && (
          <CurrentStateAlerts
            stateName={stateData.name}
            stateCode={stateAbbr}
            alerts={stateAlerts}
            hazards={stateIntel.hazards}
            activeCategories={activeCategories}
            onAlertOpen={setSelectedAlert}
          />
        )}

        <PopularLocations
          stateAbbr={stateAbbr}
          stateCode={stateAbbr}
          stateSlug={stateSlug}
          stateName={stateData.name}
        />

        <StateCountyBrowse
          stateCode={stateAbbr}
          stateName={stateData.name}
          affectedCounties={stateIntel?.affectedCounties || []}
        />

        <CityDirectory stateAbbr={stateAbbr} stateName={stateData.name} />

        {STATE_ESSENTIALS_VARIANTS[stateAbbr] && (
          <section>
            <EssentialsCard
              variant={STATE_ESSENTIALS_VARIANTS[stateAbbr]}
              placement={`state-${stateSlug}`}
            />
          </section>
        )}

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
                All alerts shown here come directly from the National Weather Service.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                How often are {stateData.name} weather alerts updated?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                This page refreshes alert data from the National Weather Service about every{' '}
                {REFRESH_NORMAL_MIN} minutes under normal conditions, and about every{' '}
                {REFRESH_FAST_MIN} minutes when a tornado warning or flash flood warning is active
                anywhere in the national alert feed. Radar imagery refreshes on its own schedule
                (typically every few minutes).
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                How can I track severe weather in {stateData.name}?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bookmark this page for {stateData.name} weather alerts, use Find Local Weather above
                to jump to your city or county, or open the{' '}
                <Link to="/radar" className="text-sky-400 hover:underline">live radar</Link>{' '}
                for a full-screen view.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                Where do these alerts come from?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Alerts are issued by the National Weather Service and loaded from the official NWS
                active alerts feed. StormTracking normalizes and displays that data; it does not
                rewrite or invent warnings.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-1">
                How do I check alerts for my {stateData.name} county?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use Find Local Weather to pick your county, or browse{' '}
                <button
                  type="button"
                  onClick={scrollToCounties}
                  className="text-sky-400 hover:underline cursor-pointer"
                >
                  {stateData.name} Alerts by County
                </button>
                {' '}below. Counties with active alerts are listed first when county names can be
                matched from the alert area description.
              </p>
            </div>
          </div>
        </section>

        <RelatedWeatherLinks
          stateName={stateData.name}
          stateSlug={stateSlug}
          stateCode={stateAbbr}
          onStateCounties={scrollToCounties}
        />
      </main>

      <SiteFooter />

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
}
