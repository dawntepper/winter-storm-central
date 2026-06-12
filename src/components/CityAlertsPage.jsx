/**
 * City Alerts Page — reusable template rendered for any city in
 * src/content/cities/[slug].json. Uses ForecastPage layout with compact
 * alert integration and city-scoped radar.
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  NWS_HEADERS,
  INCLUDED_EVENTS,
  getCategoryForEvent,
} from '../../shared/nws-alert-parser';
import { setHomepageMetaTags } from '../data/homepageMeta';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import AlertSignupBar from './AlertSignupBar';
import ForecastCityLayout from './ForecastCityLayout';
import {
  CityRelatedLinks,
  CityNearbyLinks,
  CitySeasonalRisk,
} from './city/CityWeatherDashboard';
import citiesIndex from '../content/cities/index.json';

const BASE_URL = 'https://stormtracking.io';

const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });
const CITY_DATA = {};
for (const [path, mod] of Object.entries(cityModules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match && match[1] !== 'index') {
    CITY_DATA[match[1]] = mod.default || mod;
  }
}

const CITY_INDEX_BY_SLUG = {};
for (const c of citiesIndex.cities || []) {
  CITY_INDEX_BY_SLUG[c.slug] = c;
}

function setCityMetaTags(city) {
  const url = `${BASE_URL}/alerts/${city.slug}`;
  const title = `${city.city} Weather Alerts & Forecast | StormTracking`;
  const description = `Live ${city.city} weather alerts, radar, current conditions, hourly forecast, and 7-day outlook from NWS and NOAA.`;
  const ogImage = `${BASE_URL}/og-image.png`;

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
  setMeta('meta[property="og:image"]', 'content', ogImage);
  setMeta('meta[property="og:type"]', 'content', 'website');
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="twitter:image"]', 'content', ogImage);
  setMeta('meta[property="twitter:title"]', 'content', title);
  setMeta('meta[property="twitter:description"]', 'content', description);
  setMeta('meta[property="twitter:image"]', 'content', ogImage);
  setMeta('link[rel="canonical"]', 'href', url);
  setMeta(
    'meta[name="keywords"]',
    'content',
    `${city.city.toLowerCase()} weather alerts, ${city.city.toLowerCase()} ${city.state.toLowerCase()} weather, ${city.city.toLowerCase()} severe weather warnings, ${city.city.toLowerCase()} radar, NWS ${city.city.toLowerCase()}`,
  );
}

async function fetchCityAlerts(zone) {
  if (!zone) return [];
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(zone)}`,
      { headers: NWS_HEADERS },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const features = data?.features || [];
    return features
      .filter((f) => INCLUDED_EVENTS.includes(f?.properties?.event))
      .map((f) => {
        const p = f.properties || {};
        return {
          id: f.id || p.id,
          event: p.event,
          severity: p.severity,
          urgency: p.urgency,
          headline: p.headline,
          description: p.description,
          instruction: p.instruction,
          areaDesc: p.areaDesc,
          onset: p.onset,
          effective: p.effective,
          expires: p.expires,
          ends: p.ends,
          sender: p.senderName,
          url: p['@id'] || f.id,
          category: getCategoryForEvent(p.event),
        };
      });
  } catch (err) {
    console.warn('fetchCityAlerts failed:', err);
    return null;
  }
}

function currentSeason() {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

function buildJsonLd(city) {
  const url = `${BASE_URL}/alerts/${city.slug}`;
  const now = new Date().toISOString();

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${city.city} Weather Alerts & Forecast | StormTracking`,
    description: `Live ${city.city} weather alerts, radar, current conditions, hourly forecast, and 7-day outlook from NWS and NOAA.`,
    url,
    dateModified: now,
    mainEntity: {
      '@type': 'Place',
      name: `${city.city}, ${city.state}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city.city,
        addressRegion: city.state_abbr,
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: city.lat,
        longitude: city.lon,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'StormTracking.io',
      url: BASE_URL,
    },
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StormTracking.io', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Weather Alerts', item: `${BASE_URL}/alerts` },
      { '@type': 'ListItem', position: 3, name: `${city.state} Alerts`, item: `${BASE_URL}/alerts/${city.state_slug}` },
      { '@type': 'ListItem', position: 4, name: `${city.city} Alerts`, item: url },
    ],
  };

  return [webPage, breadcrumbs];
}

export default function CityAlertsPage() {
  const { slug } = useParams();
  const city = CITY_DATA[slug];

  const [alerts, setAlerts] = useState(null);
  const [alertsError, setAlertsError] = useState(false);

  const { alerts: allAlertsData } = useExtremeWeather(true);

  const mapAlerts = useMemo(() => {
    if (!city || !Array.isArray(alerts) || alerts.length === 0) return [];
    const ids = new Set(alerts.map((a) => a.id));
    const enriched = (allAlertsData?.allAlerts || []).filter((a) => ids.has(a.id));
    if (enriched.length > 0) return enriched;
    return alerts.map((a) => ({
      ...a,
      lat: city.lat,
      lon: city.lon,
      state: city.state_abbr,
      category: a.category || 'severe',
    }));
  }, [city, allAlertsData, alerts]);

  useEffect(() => {
    if (!city) return;
    setCityMetaTags(city);
    return () => setHomepageMetaTags();
  }, [city]);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setAlerts(null);
    setAlertsError(false);
    fetchCityAlerts(city.nws_zone).then((result) => {
      if (cancelled) return;
      if (result === null) setAlertsError(true);
      else setAlerts(result);
    });
    return () => { cancelled = true; };
  }, [city]);

  if (!city) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">City Not Found</h1>
          <p className="text-slate-400 mb-6">We don&apos;t have an alerts page for &quot;{slug}&quot; yet.</p>
          <Link to="/alerts" className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors">
            See all active alerts &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const season = currentSeason();
  const jsonLdBlocks = buildJsonLd(city);

  const nearbyLinks = (city.nearby_cities || [])
    .map((nearbySlug) => {
      const idx = CITY_INDEX_BY_SLUG[nearbySlug];
      if (idx) {
        return {
          slug: nearbySlug,
          href: `/alerts/${nearbySlug}`,
          label: idx.city,
          cityName: idx.city,
          stateCode: idx.state_abbr,
          stateSlug: idx.state_slug,
        };
      }
      return {
        slug: nearbySlug,
        comingSoon: true,
        label: nearbySlug.replace(/-([a-z]{2})$/, ', $1').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      };
    });

  return (
    <>
      <ForecastCityLayout
        jsonLdBlocks={jsonLdBlocks}
        cityName={city.city}
        citySlug={city.slug}
        stateSlug={city.state_slug}
        stateName={city.state}
        stateCode={city.state_abbr}
        lat={city.lat}
        lon={city.lon}
        alerts={alerts}
        alertsLoading={alerts === null && !alertsError}
        alertsError={alertsError}
        mapAlerts={mapAlerts}
        analyticsSource="city_alert_page"
        headerNav={(
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/alerts" className="text-[10px] sm:text-xs text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 pl-2 pr-2 py-0.5 rounded border border-red-500/30 transition-colors">Live Alerts</Link>
            <Link to="/radar" className="text-[10px] sm:text-xs text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 pl-2 pr-2 py-0.5 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
            <Link to={`/alerts/${city.state_slug}`} className="text-[10px] sm:text-xs text-sky-400 hover:bg-sky-500/25 font-medium bg-sky-500/15 pl-2 pr-2 py-0.5 rounded border border-sky-500/30 transition-colors">{city.state_abbr} Alerts</Link>
          </div>
        )}
        extras={(
          <div className="space-y-6">
            <CityNearbyLinks
              title="Nearby Forecasts"
              cities={nearbyLinks}
              stateCode={city.state_abbr}
              stateSlug={city.state_slug}
            />
            <CityRelatedLinks
              cityName={city.city}
              lat={city.lat}
              lon={city.lon}
              stateSlug={city.state_slug}
              stateLabel={city.state}
            />
            <CitySeasonalRisk
              description={city.description_long}
              seasonalRisks={city.seasonal_risks}
              season={season}
            />
          </div>
        )}
        footerNote={(
          <>
            Alerts sourced from the National Weather Service (NWS office: {city.nws_office}, forecast zone {city.nws_zone}).
            Forecast from{' '}
            <a className="text-sky-400 hover:underline" href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">weather.gov</a>.
            Updated continuously. StormTracking.io is not affiliated with NOAA or the NWS.
          </>
        )}
      />
      <AlertSignupBar />
    </>
  );
}
