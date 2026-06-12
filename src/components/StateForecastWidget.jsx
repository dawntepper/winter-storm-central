import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { formatHighLowTemps, useCityForecastTemps } from '../hooks/useCityForecastTemps';
import {
  FORECAST_SOURCE_PAGES,
  trackForecastCityClick,
  trackForecastLinkClick,
  trackForecastStateClick,
} from '../utils/analytics';
import { FORECAST_NAV_ICON, getForecastIcon } from '../utils/getForecastIcon';

const forecastCardClassName =
  'group flex items-center gap-3 w-full px-4 py-3 bg-slate-900/60 hover:bg-sky-500/15 border border-slate-700 hover:border-sky-400/70 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/15 cursor-pointer text-sm text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

const citySelectClass =
  'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 cursor-pointer';

function formatCityForecastOptionLabel(city, tempsBySlug) {
  const temps = tempsBySlug[city.slug];
  const icon = getForecastIcon(temps?.shortForecast);
  const tempLabel = formatHighLowTemps(temps?.highTemp, temps?.lowTemp);
  const parts = [icon, city.city, tempLabel].filter(Boolean);
  return parts.join(' ');
}

/**
 * Full-width forecast destination card — city or state CTA.
 */
export function ForecastDestinationCard({
  to,
  label,
  icon = FORECAST_NAV_ICON,
  highTemp,
  lowTemp,
  onClick,
}) {
  const tempLabel = formatHighLowTemps(highTemp, lowTemp);

  return (
    <Link to={to} onClick={onClick} className={forecastCardClassName}>
      {icon ? (
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 min-w-0 font-semibold truncate">{label}</span>
      {tempLabel ? (
        <span className="text-slate-400 text-sm tabular-nums flex-shrink-0 whitespace-nowrap">
          {tempLabel}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="text-sm font-semibold text-sky-400 group-hover:text-sky-300 flex-shrink-0 transition-colors ml-auto"
      >
        More →
      </span>
    </Link>
  );
}

function CityForecastDestinationCard({ city, stateSlug, stateCode, sourcePage, tempsBySlug }) {
  const temps = tempsBySlug[city.slug];
  const icon = getForecastIcon(temps?.shortForecast);

  return (
    <ForecastDestinationCard
      to={`/forecast/${stateSlug}?city=${city.slug}`}
      label={city.city}
      icon={icon}
      highTemp={temps?.highTemp}
      lowTemp={temps?.lowTemp}
      onClick={() =>
        trackForecastCityClick({
          stateCode,
          stateSlug,
          city: city.city,
          citySlug: city.slug,
          sourcePage,
        })
      }
    />
  );
}

/**
 * Popular city forecast links — shown below the state radar map.
 */
export function PopularForecastsSection({ stateSlug, stateName, stateCode, maxCities = 5 }) {
  const cities = getCitiesForStateSlug(stateSlug).slice(0, maxCities);
  const tempsBySlug = useCityForecastTemps(cities);
  if (cities.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-0 mt-4">
      <h2 className="text-lg font-semibold text-white mb-3">
        Popular Forecasts in {stateName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cities.map((c) => (
          <CityForecastDestinationCard
            key={c.slug}
            city={c}
            stateSlug={stateSlug}
            stateCode={stateCode}
            sourcePage={FORECAST_SOURCE_PAGES.POPULAR_FORECASTS}
            tempsBySlug={tempsBySlug}
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
 * City rows lazy-load today's high/low from NWS after paint (see
 * useCityForecastTemps). Full hourly + 7-day forecast renders after click-through.
 */
export default function StateForecastWidget({ stateSlug, stateName, stateCode }) {
  const navigate = useNavigate();
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');

  const cities = getCitiesForStateSlug(stateSlug);
  const tempsBySlug = useCityForecastTemps(cities);
  const [selectedCitySlug, setSelectedCitySlug] = useState(() => cities[0]?.slug ?? '');

  useEffect(() => {
    const stateCities = getCitiesForStateSlug(stateSlug);
    setSelectedCitySlug(stateCities[0]?.slug ?? '');
  }, [stateSlug]);

  const selectedCity =
    cities.find((c) => c.slug === selectedCitySlug) ?? cities[0] ?? null;

  const handleZipSubmit = (e) => {
    e.preventDefault();
    setZipError('');
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a 5-digit ZIP');
      return;
    }
    trackForecastLinkClick('state-page-widget', stateSlug, 'zip', {
      sourcePage: FORECAST_SOURCE_PAGES.FORECASTS_CONDITIONS_CARD,
    });
    navigate(`/forecast/${stateSlug}?zip=${zip}`);
  };

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Forecasts &amp; Conditions</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Hourly + 7-day outlook from NWS — tap a city for details
      </p>

      {cities.length === 1 && (
        <div className="mb-4">
          <CityForecastDestinationCard
            city={cities[0]}
            stateSlug={stateSlug}
            stateCode={stateCode}
            sourcePage={FORECAST_SOURCE_PAGES.FORECASTS_CONDITIONS_CARD}
            tempsBySlug={tempsBySlug}
          />
        </div>
      )}

      {cities.length > 1 && selectedCity && (
        <div className="space-y-2 mb-4">
          <div>
            <label
              htmlFor={`city-forecast-select-${stateSlug}`}
              className="block text-[11px] text-slate-500 uppercase tracking-wide mb-1.5"
            >
              Select City Forecast
            </label>
            <select
              id={`city-forecast-select-${stateSlug}`}
              value={selectedCity.slug}
              onChange={(e) => setSelectedCitySlug(e.target.value)}
              className={citySelectClass}
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {formatCityForecastOptionLabel(c, tempsBySlug)}
                </option>
              ))}
            </select>
          </div>
          <CityForecastDestinationCard
            city={selectedCity}
            stateSlug={stateSlug}
            stateCode={stateCode}
            sourcePage={FORECAST_SOURCE_PAGES.FORECASTS_CONDITIONS_CARD}
            tempsBySlug={tempsBySlug}
          />
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
            sourcePage: FORECAST_SOURCE_PAGES.FORECASTS_CONDITIONS_CARD,
          })
        }
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mt-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 hover:border-sky-400/70 rounded-lg text-sm text-sky-300 hover:text-sky-200 font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        7-Day Forecast for {stateName}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
