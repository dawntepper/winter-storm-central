/**
 * Radar Landing Page
 * SEO-optimized page for "weather radar" searches
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { getActiveStormEvents } from '../services/stormEventsService';
import StormMap from './StormMap';

// Event type icons
const typeIcons = {
  winter_storm: '❄️',
  hurricane: '🌀',
  severe_weather: '⛈️',
  flooding: '🌊',
  heat_wave: '🌡️',
  wildfire: '🔥',
  default: '⚠️'
};

const statusColors = {
  active: 'text-emerald-400',
  forecasted: 'text-amber-400'
};

// SEO helper - set meta tags for radar page
function setRadarMetaTags() {
  document.title = 'Live Weather Radar Map | Real-Time Storm Tracking | StormTracking';

  const desc = 'Interactive live weather radar map for the United States. Track severe weather, storms, and precipitation in real-time with radar overlay. Free NOAA/NWS radar data.';

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', 'Live Weather Radar Map | StormTracking');

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', 'Interactive weather radar showing live precipitation, storms, and severe weather alerts across the United States.');

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', 'https://stormtracking.io/radar');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', 'Live Weather Radar Map | StormTracking');

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', 'Track storms with interactive live weather radar. Real-time precipitation and severe weather alerts.');

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io/radar');

  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) metaKeywords.setAttribute('content', 'weather radar, live radar map, weather radar map, interactive radar, real-time radar, storm radar, precipitation radar');
}

// Reset meta tags to homepage defaults
function resetMetaTags() {
  const defaultTitle = 'StormTracking - Live Weather Radar & Real-Time Storm Alerts';
  const defaultDesc = 'Live weather radar with real-time severe weather alerts. Track winter storms, hurricanes, and severe weather with interactive radar maps. Free NOAA/NWS data.';

  document.title = defaultTitle;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', defaultDesc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', defaultTitle);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', defaultDesc);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', 'https://stormtracking.io');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', defaultTitle);

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', defaultDesc);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io');

  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) metaKeywords.setAttribute('content', 'weather radar, live weather radar, radar weather, weather map, storm tracking, severe weather alerts, real-time weather, interactive radar, storm radar');
}

// Active storms list
function ActiveStormsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await getActiveStormEvents();
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  if (loading) return null;

  if (events.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        No major storm events currently active. Check back during severe weather.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((storm) => {
        const icon = typeIcons[storm.type] || typeIcons.default;
        const statusColor = statusColors[storm.status] || 'text-slate-400';
        return (
          <li key={storm.id || storm.slug}>
            <Link
              to={`/storm/${storm.slug}`}
              className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <span className="text-xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{storm.title}</span>
                <span className={`ml-2 text-xs ${statusColor}`}>
                  {storm.status === 'active' ? 'Active Now' : 'Forecasted'}
                </span>
              </div>
              <span className="text-xs text-sky-400 flex-shrink-0">View on Radar →</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function RadarPage() {
  // Get alerts for the map
  const {
    alerts: alertsData,
    loading: alertsLoading
  } = useExtremeWeather(true);

  const mapAlerts = alertsData?.byCategory
    ? Object.values(alertsData.byCategory).flat()
    : [];

  // Set meta tags on mount, reset on unmount
  useEffect(() => {
    setRadarMetaTags();
    return () => resetMetaTags();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
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
        </div>
      </header>

      {/* Page Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Live Weather Radar Map</h1>
          <p className="text-slate-400">
            Track severe weather across the United States with real-time radar data from NOAA
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Intro */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Interactive Weather Radar</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-2">
            Our live weather radar map displays real-time precipitation, storm movements,
            and severe weather alerts across the United States. The interactive radar
            updates every 30 minutes with the latest data from the National Weather Service,
            giving you accurate weather tracking 24/7.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Toggle the radar overlay to view current weather conditions, zoom in to see
            local detail, or click on alert markers to view severe weather warnings.
            Perfect for tracking winter storms, hurricanes, thunderstorms, and other
            extreme weather events.
          </p>
        </section>

        {/* Map */}
        <section>
          <StormMap
            weatherData={{}}
            stormPhase="active"
            userLocations={[]}
            alerts={mapAlerts}
            isHero
          />
        </section>

        {/* How to Use */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">How to Use the Weather Radar</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Toggle Radar Overlay</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click the "Radar On/Off" button to show or hide precipitation on the map.
                The radar displays rain, snow, and mixed precipitation in real-time.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">View Weather Alerts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click the "Alerts" button to see active severe weather warnings, watches,
                and advisories. Alert markers show the location and severity of weather threats.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Zoom & Pan</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use your mouse wheel or pinch to zoom in on specific areas. Drag to pan
                across the map and explore weather conditions in different regions.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Track Storms</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Monitor storm systems in real-time. The radar updates automatically,
                showing storm movement and intensity across the country.
              </p>
            </div>
          </div>
        </section>

        {/* Active Storms */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Active Storm Events</h2>
          <p className="text-slate-400 text-sm mb-4">Track major weather events with dedicated storm pages:</p>
          <ActiveStormsList />
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Weather Radar FAQ</h2>
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">What does the weather radar show?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our live weather radar displays precipitation intensity across the United States.
                Green indicates light rain or snow, yellow shows moderate precipitation, and
                red represents heavy rain or intense storms. The radar updates every 30 minutes
                with data from NOAA weather stations.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">How often does the radar update?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The weather radar map updates automatically every 30 minutes with the latest
                data from the National Weather Service. Severe weather alerts update in
                real-time as they are issued.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Is the weather radar free to use?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes! StormTracking provides free access to live weather radar and severe
                weather alerts. Our data comes from NOAA and the National Weather Service,
                making it freely available to everyone.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Can I use the radar on mobile?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The weather radar map is fully responsive and works on all
                devices including phones and tablets. You can zoom, pan, and interact
                with the map just like on desktop.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-4">
          <h2 className="text-xl font-semibold text-white mb-3">Stay Informed About Severe Weather</h2>
          <p className="text-slate-400 text-sm mb-4 max-w-xl mx-auto">
            Bookmark this page for quick access to live weather radar. Track storms in
            real-time and get severe weather alerts before dangerous conditions arrive.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
          >
            View All Weather Alerts →
          </Link>
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
    </div>
  );
}
