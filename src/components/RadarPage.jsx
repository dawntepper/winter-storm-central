/**
 * Radar Landing Page
 * SEO-optimized page for "weather radar" searches
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import { getActiveStormEvents } from '../services/stormEventsService';
import StormMap from './StormMap';
import EssentialsCard from './EssentialsCard';
import NearMeHeader from './NearMeHeader';
import ZipCodeSearch from './ZipCodeSearch';
import { setHomepageMetaTags } from '../data/homepageMeta';
import { fetchCountyGeoJSON } from '../services/geoLocationService';
import { ABBR_TO_SLUG } from '../data/stateConfig';
import PageBackNav from './PageBackNav';
import PageHeaderNav from './PageHeaderNav';
import { trackRadarStormEventClick, trackBrowseByStateClick, trackRadarPageView, setNavSource, NAV_SOURCES } from '../utils/analytics';

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
  const title = 'NWS Live Radar Map — NOAA Precipitation & Storms';
  const desc = 'Interactive US weather radar with precipitation, satellite, and forecast layers. Radar refreshes every 5 minutes; NWS alert overlays every 10 minutes (2 min during urgent warnings).';

  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', 'https://stormtracking.io/radar');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', title);

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', desc);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io/radar');

  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) metaKeywords.setAttribute('content', 'weather radar, live radar map, weather radar map, interactive radar, real-time radar, storm radar, precipitation radar');

  // Update OG image to dynamic radar image
  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', 'https://stormtracking.io/api/og-image/radar');

  let twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', 'https://stormtracking.io/api/og-image/radar');
}

// Reset meta tags to seasonal homepage defaults (see homepageMeta.js).
function resetMetaTags() {
  setHomepageMetaTags();
}

// Active storms highlight section
function ActiveStormsHighlight() {
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

  if (loading || events.length === 0) return null;

  return (
    <section className="rounded-xl p-5 sm:p-6 border-2 border-blue-400/50 bg-gradient-to-br from-blue-900 to-blue-700">
      <h2 className="text-lg sm:text-xl font-bold text-white mb-1 flex items-center gap-2">
        <span>🚨</span> Active Storm Events
      </h2>
      <p className="text-sm text-blue-200/80 mb-4">Track major weather events with dedicated storm pages</p>
      <div className="space-y-3">
        {events.map((storm) => {
          const icon = typeIcons[storm.type] || typeIcons.default;
          return (
            <Link
              key={storm.id || storm.slug}
              to={`/storm/${storm.slug}`}
              onClick={() => { trackRadarStormEventClick({ stormSlug: storm.slug, stormName: storm.title }); setNavSource(NAV_SOURCES.RADAR_PAGE_LINK); }}
              className="flex items-center gap-4 px-4 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-all"
            >
              <span className="text-2xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm sm:text-base font-semibold text-white block">{storm.title}</span>
                <span className={`text-xs font-semibold inline-block mt-0.5 px-2.5 py-0.5 rounded-full ${
                  storm.status === 'active'
                    ? 'bg-emerald-500/30 text-emerald-300'
                    : 'bg-amber-400/30 text-amber-300'
                }`}>
                  {storm.status === 'active' ? 'Active Now' : 'Forecasted'}
                </span>
              </div>
              <span className="text-sm font-medium text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors">
                View Details →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function RadarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get alerts for the map
  const { alerts: alertsData } = useExtremeWeather(true);

  const mapAlerts = alertsData?.byCategory
    ? Object.values(alertsData.byCategory).flat()
    : [];

  const [heroLocation, setHeroLocation] = useState(null);

  // GPS center from hero locate / location search. Takes precedence over
  // the ?lat/?lon deep-link so an explicit tap always wins.
  const [gpsCenter, setGpsCenter] = useState(null);
  // State to outline on the map once GPS resolves the user's state.
  const [gpsStateCode, setGpsStateCode] = useState(null);
  // "Your area" county polygon (GeoJSON Feature) once GPS coords resolve.
  const [userArea, setUserArea] = useState(null);
  const areaReqRef = useRef(0);

  const effectiveStateCode = gpsStateCode || heroLocation?.region || null;

  const focusCounty = useCallback((lat, lon) => {
    if (lat == null || lon == null) return;
    const reqId = ++areaReqRef.current;
    fetchCountyGeoJSON(lat, lon).then((feature) => {
      if (reqId === areaReqRef.current) setUserArea(feature);
    });
  }, []);

  const scrollMapIntoView = useCallback(() => {
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.querySelector('#radar-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  const handleGpsLocate = useCallback((c) => {
    setGpsCenter(c);
    focusCounty(c.lat, c.lon);
    scrollMapIntoView();
  }, [focusCounty, scrollMapIntoView]);

  const handleSearchLocationClick = useCallback((locationData) => {
    if (locationData.lat == null || locationData.lon == null) return;
    setGpsCenter({ lat: locationData.lat, lon: locationData.lon, zoom: 9, id: Date.now() });
    focusCounty(locationData.lat, locationData.lon);
    const stateMatch = locationData.name?.match(/,\s*([A-Z]{2})\s*$/);
    if (stateMatch) setGpsStateCode(stateMatch[1]);
    scrollMapIntoView();
  }, [focusCounty, scrollMapIntoView]);

  const handleChangeLocation = () => {
    window.dispatchEvent(new CustomEvent('checkLocationExpand'));
    document.querySelector('#radar-location-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Click the highlighted county → its state alerts/radar page.
  const handleAreaClick = (feature) => {
    const abbr = feature?.properties?.state;
    const slug = abbr ? ABBR_TO_SLUG[abbr] : null;
    if (!slug) return;
    trackBrowseByStateClick({ stateCode: abbr, source: NAV_SOURCES.MAP_COUNTY_CLICK });
    navigate(`/alerts/${slug}`);
  };

  // Optional deep-link: /radar?lat=25.76&lon=-80.19[&zoom=9] centers the map on
  // a specific location (used by city alert pages "Live radar centered on X").
  const centerOn = useMemo(() => {
    const lat = parseFloat(searchParams.get('lat'));
    const lon = parseFloat(searchParams.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const zoomParam = parseFloat(searchParams.get('zoom'));
    const zoom = Number.isFinite(zoomParam) ? zoomParam : 8;
    return { id: `radar-${lat}-${lon}`, lat, lon, zoom };
  }, [searchParams]);

  const displayCenterOn = gpsCenter ?? centerOn;
  const displayHighlightArea = userArea;
  const hasLocalFocus = !!(gpsCenter || userArea);

  const handleMapResetView = useCallback(() => {
    areaReqRef.current += 1;
    if (hasLocalFocus) {
      setGpsCenter(null);
      setUserArea(null);
      setGpsStateCode(null);
    } else if (centerOn) {
      navigate('/radar', { replace: true });
    }
  }, [hasLocalFocus, centerOn, navigate]);

  const mapResetViewLabel = 'Full View';
  const mapResetViewTitle = 'Reset to default US view';

  // Set meta tags on mount, reset on unmount
  useEffect(() => {
    setRadarMetaTags();
    return () => resetMetaTags();
  }, []);

  // Fire 'Radar Page View' once per mount. Source resolves from the
  // sessionStorage nav flag (set by the originating click) or falls back
  // to detectSourceFromReferrer() for direct URL loads / bookmarks.
  useEffect(() => {
    trackRadarPageView();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header — shared nav cluster; state dropdown lives here, not on the map */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          <PageHeaderNav source={NAV_SOURCES.RADAR_PAGE_STATE_DROPDOWN} />
        </div>
      </header>

      {/* Compact hero — single location-focused title */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="max-w-7xl mx-auto">
          <NearMeHeader
            as="h1"
            variant="radar"
            resolvedLocation={heroLocation}
            onResolved={setHeroLocation}
            onLocate={handleGpsLocate}
            onChangeLocation={handleChangeLocation}
            onResolveState={setGpsStateCode}
            className="space-y-1"
            headingClassName="text-lg sm:text-xl font-bold text-white"
          />
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">

        {/* Check Location (full width) → radar map below */}
        <section className="space-y-4">
          <div
            id="radar-location-search"
            className="jump-scroll-target rounded-xl overflow-visible border border-[antiquewhite] bg-[#1a3d2e]"
          >
            <ZipCodeSearch
              stormPhase="active"
              totalLocationCount={0}
              onLocationsChange={() => {}}
              onLocationClick={handleSearchLocationClick}
              onLocate={handleGpsLocate}
              onResolveState={setGpsStateCode}
              onLocationResolved={setHeroLocation}
            />
          </div>

          <div
            id="radar-map"
            className="-mx-3 sm:-mx-4 lg:mx-0 [&_.leaflet-container]:max-lg:!h-[50vh]"
          >
            <StormMap
              weatherData={{}}
              stormPhase="active"
              userLocations={[]}
              alerts={mapAlerts}
              isHero
              radarLayerType="precipitation"
              radarColorScheme={4}
              centerOn={displayCenterOn}
              selectedStateCode={effectiveStateCode}
              highlightArea={displayHighlightArea}
              onAreaClick={handleAreaClick}
              onResetView={handleMapResetView}
              resetViewLabel={mapResetViewLabel}
              resetViewTitle={mapResetViewTitle}
              resetToDefaultOnClick={!hasLocalFocus}
            />
          </div>
        </section>

        {/* Active Storms — below radar utility content */}
        <ActiveStormsHighlight />

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
                Monitor storm systems in real time. Radar imagery refreshes about every
                5 minutes, showing storm movement and intensity across the country.
              </p>
            </div>
          </div>
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
                red represents heavy rain or intense storms. Radar imagery refreshes about every
                5 minutes using NOAA-based precipitation data.
              </p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">How often does the radar update?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Radar imagery refreshes about every 5 minutes. NWS severe weather alerts
                refresh every 10 minutes, or every 2 minutes when tornado or flash flood
                warnings are active.
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

        {/* Storm prep essentials — gated by AFFILIATE_LINKS_ENABLED. Sits
            between the primary radar utility content and the disclaimer
            footer so weather-engaged viewers see prep recommendations at
            a natural pause point. */}
        <section>
          <EssentialsCard variant="radar" placement="radar" />
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
