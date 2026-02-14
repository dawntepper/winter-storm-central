/**
 * State Alerts Page Component
 * Shows NWS weather alerts filtered for a specific US state,
 * with a radar map zoomed to that state and links to nearby states.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { getActiveStormEvents } from '../services/stormEventsService';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';
import StormMap from './StormMap';
import {
  US_STATES, SLUG_TO_ABBR, STATE_NAMES, NEARBY_STATES, ABBR_TO_SLUG, getStateUrl
} from '../data/stateConfig';
import {
  trackStateAlertsPageView,
  trackStateAlertDetailView,
  trackStateNearbyClick,
  trackBrowseByStateClick,
  trackRadarLinkClick
} from '../utils/analytics';

// =============================================
// SEO META TAGS
// =============================================

function setStateMetaTags(stateName, stateSlug) {
  document.title = `${stateName} Weather Alerts | Live NWS Alerts | StormTracking`;

  const desc = `Active weather alerts for ${stateName}. Track winter storms, severe weather, flood warnings, and more with live radar and real-time NWS data.`;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${stateName} Weather Alerts | StormTracking`);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', `https://stormtracking.io/alerts/${stateSlug}`);

  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', `${stateName} Weather Alerts | StormTracking`);

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
  document.title = 'StormTracking | Live Weather Radar & Real-Time Storm Alerts';

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking. Free NOAA data for winter storms, tornadoes, and extreme weather across the US.');

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', 'StormTracking | Live Weather Radar & Storm Alerts');

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking.');

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', 'https://stormtracking.io');

  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', 'StormTracking | Live Weather Radar & Storm Alerts');

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking.');

  let twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io');

  let keywords = document.querySelector('meta[name="keywords"]');
  if (keywords) keywords.setAttribute('content', 'weather radar, storm tracker, NWS alerts, severe weather, live radar');
}

// =============================================
// ALERT DETAIL MODAL
// =============================================

function AlertDetailModal({ alert, onClose }) {
  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 max-w-lg w-full max-h-[80vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-white">{alert.event}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
              {alert.severity}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">
              {alert.urgency}
            </span>
          </div>

          <p className="text-slate-300">{alert.location}</p>

          {alert.headline && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Headline</h4>
              <p className="text-slate-300 text-xs leading-relaxed">{alert.headline}</p>
            </div>
          )}

          {alert.fullDescription && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Details</h4>
              <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line">
                {alert.fullDescription}
              </p>
            </div>
          )}

          {alert.areaDesc && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Affected Areas</h4>
              <p className="text-slate-400 text-xs">{alert.areaDesc}</p>
            </div>
          )}

          <div className="flex gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
            {alert.onset && <span>Onset: {new Date(alert.onset).toLocaleString()}</span>}
            {alert.expires && <span>Expires: {new Date(alert.expires).toLocaleString()}</span>}
          </div>

          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-sky-400 hover:underline"
            >
              View on weather.gov →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// ALERT LIST BY CATEGORY
// =============================================

function AlertsByCategory({ alerts, stateCode, onViewDetail }) {
  const [expandedCategories, setExpandedCategories] = useState({});

  // Group alerts by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const alert of alerts) {
      const cat = alert.category || 'severe';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(alert);
    }
    return groups;
  }, [alerts]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map(categoryId => {
        const categoryAlerts = grouped[categoryId];
        if (!categoryAlerts || categoryAlerts.length === 0) return null;

        const category = ALERT_CATEGORIES[categoryId];
        const isExpanded = expandedCategories[categoryId] !== false; // default expanded

        return (
          <div key={categoryId} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleCategory(categoryId)}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>{category.icon}</span>
                <span className="font-semibold text-white text-sm">{category.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {categoryAlerts.length}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-700">
                {categoryAlerts.map((alert, idx) => (
                  <button
                    key={alert.id || idx}
                    onClick={() => {
                      trackStateAlertDetailView({ stateCode, alertType: alert.event });
                      onViewDetail(alert);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-700/50 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{alert.event}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.location}</p>
                        {alert.headline && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.headline}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          alert.severity === 'Extreme' ? 'bg-red-500/20 text-red-400' :
                          alert.severity === 'Severe' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {alert.severity}
                        </span>
                        {alert.expires && (
                          <span className="text-[10px] text-slate-500">
                            Exp: {new Date(alert.expires).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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

function NearbyStatesSection({ stateAbbr, alertCountsByState }) {
  const nearby = NEARBY_STATES[stateAbbr] || [];
  if (nearby.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Nearby State Alerts</h2>
      <div className="flex flex-wrap gap-2">
        {nearby.map(abbr => {
          const name = STATE_NAMES[abbr];
          const slug = ABBR_TO_SLUG[abbr];
          const count = alertCountsByState[abbr] || 0;
          if (!name || !slug) return null;

          return (
            <Link
              key={abbr}
              to={`/alerts/${slug}`}
              onClick={() => trackStateNearbyClick({ fromState: stateAbbr, toState: abbr })}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <span className="text-sm text-white font-medium">{name}</span>
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// =============================================
// MAIN PAGE COMPONENT
// =============================================

export default function StateAlertsPage() {
  const { state: stateSlug } = useParams();
  const navigate = useNavigate();
  const stateAbbr = SLUG_TO_ABBR[stateSlug];
  const stateData = stateAbbr ? US_STATES[stateSlug] : null;

  // Alerts
  const {
    alerts: alertsData,
    loading: alertsLoading,
    lastUpdated,
    refresh: refreshAlerts
  } = useExtremeWeather(true);

  // Alert detail modal
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Filter alerts for this state
  const stateAlerts = useMemo(() => {
    if (!alertsData?.allAlerts || !stateAbbr) return [];
    return alertsData.allAlerts.filter(a => a.state === stateAbbr);
  }, [alertsData, stateAbbr]);

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

  // Track page view
  useEffect(() => {
    if (stateData && !alertsLoading) {
      trackStateAlertsPageView({
        stateCode: stateAbbr,
        stateName: stateData.name,
        alertCount: stateAlerts.length
      });
    }
  }, [stateAbbr, stateData, alertsLoading, stateAlerts.length]);

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
            "name": `${stateData.name} Weather Alerts`,
            "description": `Active weather alerts for ${stateData.name}. Real-time NWS warnings, watches, and advisories.`,
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
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline text-sm">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">📡</span>
              <Link to="/" className="text-lg sm:text-xl font-bold text-white">StormTracking</Link>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/radar" onClick={() => trackRadarLinkClick('state_header')} className="text-[10px] sm:text-xs text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 pl-2 pr-2 py-0.5 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const abbr = US_STATES[e.target.value]?.abbr;
                  if (abbr) trackBrowseByStateClick({ stateCode: abbr, source: 'state_header' });
                  navigate(`/alerts/${e.target.value}`);
                  e.target.value = '';
                }
              }}
              className="appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2 pr-1 py-0.5 rounded focus:outline-none text-[10px] sm:text-xs font-medium border border-sky-500/30 transition-colors"
            >
              <option value="" disabled>State Weather Tracker ▾</option>
              {Object.entries(US_STATES).map(([slug, s]) => (
                <option key={slug} value={slug}>{s.name}</option>
              ))}
            </select>
          </div>
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
              {!alertsLoading && (
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
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Map */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">
            Live Weather Radar — {stateData.name}
          </h2>
          <StormMap
            weatherData={{}}
            stormPhase="active"
            userLocations={[]}
            alerts={stateAlerts}
            isHero
            centerOn={{
              lat: stateData.center[0],
              lon: stateData.center[1],
              zoom: stateData.zoom,
              id: `state-${stateAbbr}`
            }}
            selectedStateCode={stateAbbr}
            radarLayerType="precipitation"
            radarColorScheme={4}
          />
        </section>

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
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading alerts...</p>
            </div>
          ) : stateAlerts.length === 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-8 text-center">
              <p className="text-lg font-medium text-emerald-400 mb-1">
                No active weather alerts for {stateData.name}
              </p>
              <p className="text-sm text-slate-400">
                Check back for updates on severe weather conditions. Alerts are updated in real-time from the NWS.
              </p>
            </div>
          ) : (
            <AlertsByCategory
              alerts={stateAlerts}
              stateCode={stateAbbr}
              onViewDetail={setSelectedAlert}
            />
          )}
        </section>

        {/* Nearby States */}
        <NearbyStatesSection stateAbbr={stateAbbr} alertCountsByState={alertCountsByState} />

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
                Weather alerts for {stateData.name} are refreshed every 30 minutes from the National Weather Service.
                New alerts appear as soon as they are issued by the NWS. The radar map also updates automatically.
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
