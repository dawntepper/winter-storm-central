import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getForecastForCoords } from '../services/forecastService';
import { ForecastHourly, ForecastDaily } from './ForecastSections';
import { FORECAST_SOURCE_PAGES, trackForecastLinkClick } from '../utils/analytics';
import { getForecastIcon } from '../utils/getForecastIcon';

/**
 * NWS-based hourly + 7-day outlook for a city. Lazy-fetches on mount.
 * Used by CityAlertsPage and CatalogCityAlertsPage after map/alerts.
 */
export default function CityForecastSection({
  cityName,
  citySlug,
  stateSlug,
  lat,
  lon,
  showUnavailableFallback = false,
  onForecastLoad,
  forecastLinkSource = 'city-page',
}) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const onForecastLoadRef = useRef(onForecastLoad);
  onForecastLoadRef.current = onForecastLoad;

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setLoading(false);
      setFailed(true);
      onForecastLoadRef.current?.(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getForecastForCoords(lat, lon)
      .then((data) => {
        if (cancelled) return;
        setForecast(data);
        onForecastLoadRef.current?.(data);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onForecastLoadRef.current?.(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (loading && !forecast) {
    return (
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-sm text-slate-400">Loading forecast…</p>
      </section>
    );
  }

  if (!forecast) {
    if (showUnavailableFallback && failed) {
      return (
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-2">
            Forecast
          </h2>
          <p className="text-slate-400 text-sm">
            Forecast data is temporarily unavailable for {cityName}. Current conditions and active alerts above are still live.
          </p>
        </section>
      );
    }
    return null;
  }

  const forecastLinkIcon = getForecastIcon(forecast?.current?.shortForecast);

  return (
    <section className="space-y-4">
      <ForecastHourly
        periods={forecast.hourly}
        timeZone={forecast.location?.timeZone}
        title={`Next 24 hours · ${cityName}`}
      />
      <ForecastDaily periods={forecast.daily} title={`7-day outlook · ${cityName}`} />
      {stateSlug && citySlug && (
        <div className="text-center">
          <Link
            to={`/forecast/${stateSlug}?city=${citySlug}`}
            onClick={() =>
              trackForecastLinkClick(forecastLinkSource, stateSlug, 'city', {
                sourcePage: FORECAST_SOURCE_PAGES.CITY_PAGE,
                city: cityName,
                citySlug,
              })
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 hover:border-sky-400/70 text-sky-300 hover:text-sky-200 text-sm font-semibold rounded-lg transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          >
            {forecastLinkIcon ? (
              <span aria-hidden="true" className="text-base">
                {forecastLinkIcon}
              </span>
            ) : null}
            View full forecast for {cityName}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
