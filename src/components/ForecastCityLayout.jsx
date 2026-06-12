import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import { getForecastForCoords } from '../services/forecastService';
import { cityAlertsPath } from '../services/locationCatalogService';
import ForecastLocationPicker from './ForecastLocationPicker';
import { ForecastCurrent, ForecastHourly, ForecastDaily } from './ForecastSections';
import { getTimeOfDayClass } from './ForecastVisuals';
import TornadoWarningBanner from './TornadoWarningBanner';
import StormMap from './StormMap';
import PageHeaderNav from './PageHeaderNav';
import PageBackNav from './PageBackNav';
import ContactLink from './ContactLink';
import CityActiveAlertBanner from './city/CityActiveAlertBanner';
import CityAlertsSection from './city/CityAlertsSection';
import CityRadarSection from './city/CityRadarSection';
import { sortAlertsBySeverity } from '../utils/alertRanking';
import {
  trackCityWeatherPageView,
  trackForecastLocationChanged,
  NAV_SOURCES,
} from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

/**
 * ForecastPage layout for city alert URLs — same sections, spacing, and
 * typography as /forecast/:state with compact alert integration.
 */
export default function ForecastCityLayout({
  cityName,
  citySlug,
  stateSlug,
  stateName,
  stateCode,
  lat,
  lon,
  alerts,
  alertsLoading = false,
  alertsError = false,
  mapAlerts = [],
  jsonLdBlocks = [],
  analyticsSource = 'city_alert_page',
  headerNav,
  extras,
  footerNote,
  onPageView,
}) {
  const navigate = useNavigate();
  const stateData = US_STATES[stateSlug];

  const [coords, setCoords] = useState({
    lat,
    lon,
    displayName: `${cityName}, ${stateCode}`,
  });
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCoords({
      lat,
      lon,
      displayName: `${cityName}, ${stateCode}`,
    });
  }, [lat, lon, cityName, stateCode]);

  const sortedAlerts = useMemo(
    () => (Array.isArray(alerts) ? sortAlertsBySeverity(alerts) : alerts),
    [alerts],
  );
  const alertCount = Array.isArray(sortedAlerts) ? sortedAlerts.length : 0;

  const tornadoWarning = useMemo(() => {
    if (!stateCode) return null;
    const candidates = (mapAlerts || []).filter(
      (a) => a.event === 'Tornado Warning' && a.state === stateCode,
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort(
      (a, b) => new Date(a.expires).getTime() - new Date(b.expires).getTime(),
    )[0];
  }, [mapAlerts, stateCode]);

  const pageViewTrackedRef = useRef(false);

  useEffect(() => {
    if (pageViewTrackedRef.current || alerts === null) return;
    pageViewTrackedRef.current = true;
    trackCityWeatherPageView({
      stateCode,
      city: cityName,
      citySlug,
      hasAlerts: alertCount > 0,
      hasForecastData: Boolean(forecast),
      source: analyticsSource,
    });
    onPageView?.({
      hasAlerts: alertCount > 0,
      hasForecastData: Boolean(forecast),
    });
  }, [cityName, citySlug, stateCode, alerts, alertCount, forecast, analyticsSource, onPageView]);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getForecastForCoords(coords.lat, coords.lon)
      .then((data) => {
        if (!cancelled) setForecast(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load forecast');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [coords]);

  const handleLocationSelect = (pick) => {
    trackForecastLocationChanged(pick.source);
    if (pick.source === 'city' && pick.citySlug && pick.citySlug !== citySlug) {
      navigate(cityAlertsPath(pick.citySlug, RICH_CITY_SLUGS.has(pick.citySlug)));
      return;
    }
    setCoords({ lat: pick.lat, lon: pick.lon, displayName: pick.displayName });
  };

  const todClass = forecast?.location?.timeZone
    ? getTimeOfDayClass(forecast.location.timeZone)
    : 'forecast-tod-day';

  const mapConditions = forecast?.current ? {
    temperature: forecast.current.temperature,
    temperatureUnit: forecast.current.temperatureUnit,
    shortForecast: forecast.current.shortForecast,
  } : null;

  return (
    <div className={`min-h-screen ${todClass}`}>
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          {headerNav ?? <PageHeaderNav source={NAV_SOURCES.HEADER_NAVIGATION} />}
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {cityName}, {stateCode} Weather
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Hourly outlook, 7-day forecast, and live radar — direct from NWS.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <CityActiveAlertBanner
          alerts={sortedAlerts}
          loading={alertsLoading || alerts === null}
        />

        {tornadoWarning && (
          <TornadoWarningBanner alert={tornadoWarning} />
        )}

        <div className="lg:grid lg:grid-cols-[2fr_1fr] gap-4 space-y-4 lg:space-y-0">
          <ForecastLocationPicker
            stateSlug={stateSlug}
            stateName={stateName || stateData?.name || stateCode}
            currentLabel={coords?.displayName || 'Loading…'}
            selectedCitySlug={citySlug}
            onSelect={handleLocationSelect}
          />
          {forecast ? (
            <ForecastCurrent
              current={forecast.current}
              hourly={forecast.hourly}
              location={coords?.displayName}
            />
          ) : (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
              <p className="text-sm text-slate-400">Loading current conditions…</p>
            </div>
          )}
        </div>

        {coords && (
          <CityRadarSection
            cityName={cityName}
            citySlug={citySlug}
            stateCode={stateCode}
            analyticsSource={analyticsSource}
            hasAlerts={alertCount > 0}
          >
            <section aria-label="Live weather radar">
              <StormMap
                weatherData={{}}
                stormPhase="active"
                userLocations={[{
                  id: `city-pin-${citySlug}`,
                  lat: coords.lat,
                  lon: coords.lon,
                  name: coords.displayName,
                  conditions: mapConditions,
                }]}
                alerts={mapAlerts}
                isHero
                selectedStateCode={stateCode}
                centerOn={{ lat: coords.lat, lon: coords.lon, id: `city-${citySlug}`, zoom: 8 }}
              />
            </section>
          </CityRadarSection>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-4 text-sm">
            Forecast unavailable: {error}. This is usually a brief NWS issue — try again in a moment, or pick a different location.
          </div>
        )}

        {loading && !forecast && (
          <p className="text-sm text-slate-400">Loading hourly + 7-day forecast…</p>
        )}

        {forecast && (
          <>
            <ForecastHourly periods={forecast.hourly} timeZone={forecast.location?.timeZone} />
            <div id="forecast-7day">
              <ForecastDaily periods={forecast.daily} />
            </div>
          </>
        )}

        {alertCount > 0 && (
          <CityAlertsSection
            cityName={cityName}
            alerts={sortedAlerts}
            loading={alertsLoading}
            error={alertsError}
            lat={coords.lat}
            lon={coords.lon}
          />
        )}

        {extras}

        <footer className="pt-4 text-xs text-slate-500 text-center">
          {footerNote || (
            <>
              Forecast data from the National Weather Service (api.weather.gov). Updates ~hourly. For severe weather, always defer to{' '}
              <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>{' '}
              and local emergency management. Questions? Reach{' '}
              <ContactLink className="text-sky-400 hover:text-sky-300">StormTracking Support</ContactLink>.
            </>
          )}
        </footer>
      </main>
    </div>
  );
}
