import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import {
  FORECAST_SOURCE_PAGES,
  trackForecastCityClick,
  trackForecastLinkClick,
  trackForecastStateClick,
} from '../utils/analytics';

const GENERIC_FORECAST_ICON = '☀️';

const forecastCardClassName =
  'group flex items-center gap-3 w-full px-4 py-3 bg-slate-900/60 hover:bg-sky-500/15 border border-slate-700 hover:border-sky-400/70 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/15 cursor-pointer text-sm text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

/**
 * Full-width forecast destination card — city or state CTA.
 */
export function ForecastDestinationCard({
  to,
  label,
  icon = GENERIC_FORECAST_ICON,
  onClick,
}) {
  return (
    <Link to={to} onClick={onClick} className={forecastCardClassName}>
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 min-w-0 font-semibold truncate">{label}</span>
      <span
        aria-hidden="true"
        className="text-sm font-semibold text-sky-400 group-hover:text-sky-300 flex-shrink-0 transition-colors"
      >
        →
      </span>
    </Link>
  );
}

/**
 * Popular city forecast links — shown below the state radar map.
 */
export function PopularForecastsSection({ stateSlug, stateName, stateCode, maxCities = 5 }) {
  const cities = getCitiesForStateSlug(stateSlug).slice(0, maxCities);
  if (cities.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-0 mt-4">
      <h2 className="text-lg font-semibold text-white mb-3">
        Popular Forecasts in {stateName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cities.map((c) => (
          <ForecastDestinationCard
            key={c.slug}
            to={`/forecast/${stateSlug}?city=${c.slug}`}
            label={`${c.city} Forecast`}
            onClick={() =>
              trackForecastCityClick({
                stateCode,
                stateSlug,
                city: c.city,
                citySlug: c.slug,
                sourcePage: FORECAST_SOURCE_PAGES.POPULAR_FORECASTS_SECTION,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Compact forecast launcher for the right column of state alert pages.
 * Three entry points into the full /forecast/[state-slug] surface:
 *   - Quick city links (catalogued cities for the current state)
 *   - 5-digit ZIP input (routes to /forecast/[state]?zip= — the forecast
 *     page itself handles cross-state correction if the ZIP is in a
 *     different state)
 *   - "View state forecast" CTA (state-default forecast)
 *
 * Intentionally lean: no inline weather data. Fetching forecasts for 3-5
 * cities would mean 9-15 extra NWS API calls on every state-page load,
 * which doesn't justify the latency cost. The actual forecast renders
 * after the user clicks through to /forecast.
 */
export default function StateForecastWidget({ stateSlug, stateName, stateCode }) {
  const navigate = useNavigate();
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');

  const cities = getCitiesForStateSlug(stateSlug);

  const handleZipSubmit = (e) => {
    e.preventDefault();
    setZipError('');
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a 5-digit ZIP');
      return;
    }
    trackForecastLinkClick('state-page-widget', stateSlug, 'zip', {
      sourcePage: FORECAST_SOURCE_PAGES.WEATHER_FORECAST_CARD,
    });
    navigate(`/forecast/${stateSlug}?zip=${zip}`);
  };

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Weather Forecast</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Hourly + 7-day outlook from NWS — tap a city for details
      </p>

      {cities.length > 0 && (
        <div className="space-y-2 mb-4">
          {cities.map((c) => (
            <ForecastDestinationCard
              key={c.slug}
              to={`/forecast/${stateSlug}?city=${c.slug}`}
              label={`${c.city} Forecast`}
              onClick={() =>
                trackForecastCityClick({
                  stateCode,
                  stateSlug,
                  city: c.city,
                  citySlug: c.slug,
                  sourcePage: FORECAST_SOURCE_PAGES.WEATHER_FORECAST_CARD,
                })
              }
            />
          ))}
        </div>
      )}

      <form onSubmit={handleZipSubmit} className="space-y-1.5 mb-3">
        <label className="block text-[11px] text-slate-500 uppercase tracking-wide">
          Or enter ZIP for any US location
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="ZIP"
            aria-label="ZIP code"
            className="flex-1 min-w-0 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 hover:border-sky-400/60 text-sky-300 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer hover:shadow-md hover:shadow-sky-500/10"
          >
            Go
          </button>
        </div>
        {zipError && <p className="text-[11px] text-red-400">{zipError}</p>}
      </form>

      <Link
        to={`/forecast/${stateSlug}`}
        onClick={() =>
          trackForecastStateClick({
            stateCode,
            stateSlug,
            sourcePage: FORECAST_SOURCE_PAGES.WEATHER_FORECAST_CARD,
          })
        }
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mt-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 hover:border-sky-400/70 rounded-lg text-sm text-sky-300 hover:text-sky-200 font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        View {stateName} state forecast
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
