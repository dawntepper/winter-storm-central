import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCityForecast } from '../hooks/useCityForecast';
import { ForecastHourly, ForecastDaily } from './ForecastSections';
import { FORECAST_SOURCE_PAGES, trackForecastLinkClick, trackForecastSectionViewed } from '../utils/analytics';
import { getForecastIcon } from '../utils/getForecastIcon';

/**
 * NWS-based hourly + 7-day outlook for a city. Lazy-fetches on mount.
 * Used by CityAlertsPage and CatalogCityAlertsPage after map/alerts.
 */
export default function CityForecastSection({
  cityName,
  citySlug,
  stateSlug,
  stateCode,
  lat,
  lon,
  showUnavailableFallback = false,
  onForecastLoad,
  forecastLinkSource = 'city-page',
  analyticsSource,
}) {
  const { forecast, loading, failed } = useCityForecast(lat, lon);
  const onForecastLoadRef = useRef(onForecastLoad);
  const sectionRef = useRef(null);
  const viewedRef = useRef(false);
  const lastReportedRef = useRef(undefined);
  onForecastLoadRef.current = onForecastLoad;

  useEffect(() => {
    if (loading) return;
    const key = forecast ? 'ok' : 'fail';
    if (lastReportedRef.current === key) return;
    lastReportedRef.current = key;
    onForecastLoadRef.current?.(forecast ?? null);
  }, [forecast, loading]);

  useEffect(() => {
    if (!forecast || viewedRef.current) return undefined;

    const fireViewed = () => {
      if (viewedRef.current) return;
      viewedRef.current = true;
      trackForecastSectionViewed({
        stateCode: stateCode || forecast.location?.state,
        city: cityName,
        citySlug,
        source: analyticsSource || forecastLinkSource,
        hasForecastData: true,
      });
    };

    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      fireViewed();
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          fireViewed();
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [forecast, cityName, citySlug, stateCode, analyticsSource, forecastLinkSource]);

  if (loading && !forecast) {
    return (
      <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <p className="text-sm text-slate-400">Loading hourly + 7-day forecast…</p>
      </section>
    );
  }

  if (!forecast) {
    if (showUnavailableFallback && failed) {
      return (
        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
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
    <section ref={sectionRef} className="space-y-4" aria-label={`Forecast for ${cityName}`}>
      <ForecastHourly
        periods={forecast.hourly}
        timeZone={forecast.location?.timeZone}
        title={`Next 24 hours · ${cityName}`}
      />
      <div id="forecast-7day">
        <ForecastDaily periods={forecast.daily} title={`7-day outlook · ${cityName}`} />
      </div>
      {stateSlug && citySlug && (
        <p className="text-center">
          <Link
            to={`/forecast/${stateSlug}?city=${citySlug}`}
            onClick={() =>
              trackForecastLinkClick(forecastLinkSource, stateSlug, 'city', {
                sourcePage: FORECAST_SOURCE_PAGES.CITY_PAGE,
                city: cityName,
                citySlug,
              })
            }
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            {forecastLinkIcon ? (
              <span aria-hidden="true" className="text-base">
                {forecastLinkIcon}
              </span>
            ) : null}
            NWS Forecast Details
            <span aria-hidden="true">→</span>
          </Link>
        </p>
      )}
    </section>
  );
}
