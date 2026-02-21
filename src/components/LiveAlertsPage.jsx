import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';
import { US_STATES } from '../data/stateConfig';
import { rankAlerts } from '../utils/alertRanking';
import LiveAlertCard from './LiveAlertCard';
import StormMap from './StormMap';
import { trackRadarLinkClick, trackBrowseByStateClick } from '../utils/analytics';

// =============================================
// SEO META TAGS
// =============================================

function setLiveAlertsMetaTags() {
  document.title = 'Live Weather Alerts | StormTracking';

  const desc = 'All active NWS weather alerts ranked by severity. Track winter storms, severe weather, floods, and more in real-time.';

  const meta = {
    'meta[name="description"]': desc,
    'meta[property="og:title"]': 'Live Weather Alerts | StormTracking',
    'meta[property="og:description"]': desc,
    'meta[property="og:url"]': 'https://stormtracking.io/alerts',
    'meta[property="og:image"]': 'https://stormtracking.io/og-image.png',
    'meta[property="twitter:title"]': 'Live Weather Alerts | StormTracking',
    'meta[property="twitter:description"]': desc,
    'meta[property="twitter:image"]': 'https://stormtracking.io/og-image.png',
  };

  for (const [selector, content] of Object.entries(meta)) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io/alerts');
}

function resetMetaTags() {
  document.title = 'StormTracking | Live Weather Radar & Real-Time Storm Alerts';
  const defaults = {
    'meta[name="description"]': 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking. Free NOAA data for winter storms, tornadoes, and extreme weather across the US.',
    'meta[property="og:title"]': 'StormTracking | Live Weather Radar & Storm Alerts',
    'meta[property="og:description"]': 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking.',
    'meta[property="og:url"]': 'https://stormtracking.io',
    'meta[property="og:image"]': 'https://stormtracking.io/og-image.png',
    'meta[property="twitter:title"]': 'StormTracking | Live Weather Radar & Storm Alerts',
    'meta[property="twitter:description"]': 'Track severe weather in real-time with live radar, NWS alerts, and storm tracking.',
    'meta[property="twitter:image"]': 'https://stormtracking.io/og-image.png',
  };
  for (const [selector, content] of Object.entries(defaults)) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  }
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io');
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function LiveAlertsPage() {
  const navigate = useNavigate();
  const { alerts: alertsData, loading, error, refresh } = useExtremeWeather(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [tick, setTick] = useState(0);

  // SEO meta tags
  useEffect(() => {
    setLiveAlertsMetaTags();
    return () => resetMetaTags();
  }, []);

  // 60-second tick for live time updates
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Ranked + filtered alerts
  const ranked = useMemo(() => {
    const all = rankAlerts(alertsData?.allAlerts || []);
    if (!activeFilter) return all;
    return all
      .filter((a) => a.category === activeFilter)
      .map((a, i) => ({ ...a, rank: i + 1 })); // re-rank within filter
  }, [alertsData, activeFilter, tick]);

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const allRanked = rankAlerts(alertsData?.allAlerts || []);
    const counts = {};
    for (const a of allRanked) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [alertsData]);

  // All alerts for map display (same pattern as App.jsx)
  const mapAlerts = useMemo(() => {
    return alertsData?.byCategory
      ? Object.values(alertsData.byCategory).flat()
      : [];
  }, [alertsData]);

  const handleFilterClick = (catId) => {
    setActiveFilter((prev) => (prev === catId ? null : catId));
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Live Weather Alerts",
            "description": "All active NWS weather alerts ranked by severity.",
            "url": "https://stormtracking.io/alerts",
            "isPartOf": { "@type": "WebSite", "name": "StormTracking", "url": "https://stormtracking.io" },
          }),
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
            <Link to="/alerts" className="text-[10px] sm:text-xs text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 pl-2 pr-2 py-0.5 rounded border border-red-500/30 transition-colors">Live Alerts</Link>
            <Link to="/radar" onClick={() => trackRadarLinkClick('alerts_header')} className="text-[10px] sm:text-xs text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 pl-2 pr-2 py-0.5 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const abbr = US_STATES[e.target.value]?.abbr;
                  if (abbr) trackBrowseByStateClick({ stateCode: abbr, source: 'alerts_header' });
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

      {/* Page title bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Live Weather Alerts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            All active NWS alerts ranked by severity and urgency
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="lg:grid lg:grid-cols-[2fr_3fr] gap-6 items-start">

          {/* LEFT COLUMN: Sticky map (desktop) / stacked above cards (mobile) */}
          <section className="mb-6 lg:mb-0 lg:sticky lg:top-4">
            <StormMap
              weatherData={{}}
              stormPhase="active"
              alerts={mapAlerts}
              isHero
            />
          </section>

          {/* RIGHT COLUMN: Filters + alert cards */}
          <div className="space-y-4">
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.map((catId) => {
                const cat = ALERT_CATEGORIES[catId];
                const count = categoryCounts[catId] || 0;
                if (count === 0) return null;
                const isActive = activeFilter === catId;
                return (
                  <button
                    key={catId}
                    onClick={() => handleFilterClick(catId)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'text-white border-white/30'
                        : 'text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                    style={isActive ? { backgroundColor: cat.color + '30', borderColor: cat.color } : undefined}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-slate-500">{count}</span>
                  </button>
                );
              })}
              {activeFilter && (
                <button
                  onClick={() => setActiveFilter(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1.5 cursor-pointer transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Loading state */}
            {loading && !alertsData && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3 animate-pulse">
                    <div className="flex gap-3">
                      <div className="h-6 w-10 bg-slate-700 rounded" />
                      <div className="flex-1 h-5 bg-slate-700 rounded" />
                      <div className="h-5 w-14 bg-slate-700 rounded" />
                    </div>
                    <div className="h-3 w-1/3 bg-slate-700 rounded" />
                    <div className="h-2 bg-slate-700 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {error && !alertsData && (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-3">Failed to load alerts.</p>
                <button onClick={refresh} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm cursor-pointer transition-colors">
                  Try Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && alertsData && ranked.length === 0 && (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-slate-400">
                  {activeFilter ? 'No alerts in this category.' : 'No active weather alerts nationwide.'}
                </p>
              </div>
            )}

            {/* Alert cards */}
            <div className="space-y-3">
              {ranked.map((alert) => (
                <LiveAlertCard key={alert.id} alert={alert} mode="full" tick={tick} />
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center space-y-3">
          <p className="text-xs text-slate-500 max-w-xl mx-auto">
            Data from the National Weather Service (NWS). For official forecasts and warnings, visit{' '}
            <a href="https://www.weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>.
            StormTracking is not affiliated with NOAA or NWS.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link to="/" className="text-slate-400 hover:text-sky-400 transition-colors">Home</Link>
            <span className="text-slate-600">|</span>
            <Link to="/radar" className="text-slate-400 hover:text-sky-400 transition-colors">Weather Radar</Link>
            <span className="text-slate-600">|</span>
            <a href="https://x.com/dawntepper_" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
