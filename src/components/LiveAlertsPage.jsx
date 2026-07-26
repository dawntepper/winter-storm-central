import { useState, useEffect, useMemo } from 'react';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { CATEGORY_ORDER } from '../services/noaaAlertsService';
import { setHomepageMetaTags } from '../data/homepageMeta';
import { rankAlerts } from '../utils/alertRanking';
import LiveAlertCard from './LiveAlertCard';
import StormMap from './StormMap';
import PageSiteHeader from './PageSiteHeader';
import { FooterLinks } from './SiteFooter';
import { NAV_SOURCES } from '../utils/analytics';

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
  setHomepageMetaTags();
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function LiveAlertsPage() {
  const { alerts: alertsData, loading, error, refresh } = useExtremeWeather(true);
  const [activeCategories, setActiveCategories] = useState(() => new Set(CATEGORY_ORDER));
  const [tick, setTick] = useState(0);
  const [mapCenterOn, setMapCenterOn] = useState(null);
  const [selectedAlertId, setSelectedAlertId] = useState(null);

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

  // Ranked + filtered alerts (category filter synced from map emoji chips)
  const ranked = useMemo(() => {
    const all = rankAlerts(alertsData?.allAlerts || []);
    return all
      .filter((a) => activeCategories.has(a.category))
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }, [alertsData, activeCategories, tick]);

  // All alerts for map display (same pattern as App.jsx)
  const mapAlerts = useMemo(() => {
    return alertsData?.byCategory
      ? Object.values(alertsData.byCategory).flat()
      : [];
  }, [alertsData]);

  const handleAlertTap = (alert) => {
    if (alert.lat && alert.lon) {
      setMapCenterOn({ lat: alert.lat, lon: alert.lon, id: Date.now() });
      setSelectedAlertId(alert.id);
    }
  };

  const handleFullView = () => {
    setMapCenterOn(null);
    setSelectedAlertId(null);
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

      <PageSiteHeader source={NAV_SOURCES.HEADER_NAVIGATION} />

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
        <div className="lg:grid lg:grid-cols-[3fr_minmax(0,420px)] gap-6 items-start">

          {/* LEFT COLUMN: Sticky map (desktop) / stacked above cards (mobile) */}
          <section className="mb-6 lg:mb-0 lg:sticky lg:top-4">
            <StormMap
              weatherData={{}}
              stormPhase="active"
              alerts={mapAlerts}
              isHero
              centerOn={mapCenterOn}
              selectedAlertId={selectedAlertId}
              selectedAlertUsesCategoryColor
              activeCategories={activeCategories}
              onActiveCategoriesChange={setActiveCategories}
              onResetView={handleFullView}
              resetViewLabel="Full View"
              resetViewTitle="Reset to default US view"
              resetUsesUsDefault
            />
          </section>

          {/* RIGHT COLUMN: Alert cards (filtered by map emoji chips) */}
          <div className="space-y-4">
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
                  {activeCategories.size === 0
                    ? 'Alerts hidden — tap Alerts on the map to show them.'
                    : activeCategories.size < CATEGORY_ORDER.length
                      ? 'No alerts in the selected categories.'
                      : 'No active weather alerts nationwide.'}
                </p>
              </div>
            )}

            {/* Alert cards */}
            <div className="space-y-3">
              {ranked.map((alert) => (
                <LiveAlertCard key={alert.id} alert={alert} mode="full" tick={tick} onAlertTap={handleAlertTap} />
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
          <FooterLinks showHome />
        </div>
      </footer>
    </div>
  );
}
