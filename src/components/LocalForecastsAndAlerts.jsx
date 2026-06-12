import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { useCityForecastTemps } from '../hooks/useCityForecastTemps';
import {
  FORECAST_SOURCE_PAGES,
  trackForecastStateClick,
} from '../utils/analytics';
import { getForecastIcon } from '../utils/getForecastIcon';
import { LocationSearchPanel } from './CheckAlertsNearYou';
import {
  CityForecastDestinationCard,
  citySelectClass,
  formatCityForecastOptionLabel,
} from './StateForecastWidget';

/**
 * Combined right-rail card: popular city forecasts, location alert search,
 * and state-level forecast CTA for state alert pages.
 */
export default function LocalForecastsAndAlerts({
  stateSlug,
  stateName,
  stateCode,
  allAlerts = [],
  alertsLoading = false,
  onLocationFocus,
  onClearFocus,
  onViewAlert,
}) {
  const cities = getCitiesForStateSlug(stateSlug);
  const tempsBySlug = useCityForecastTemps(cities);
  const [selectedCitySlug, setSelectedCitySlug] = useState(() => cities[0]?.slug ?? '');

  useEffect(() => {
    const stateCities = getCitiesForStateSlug(stateSlug);
    setSelectedCitySlug(stateCities[0]?.slug ?? '');
  }, [stateSlug]);

  const selectedCity =
    cities.find((c) => c.slug === selectedCitySlug) ?? cities[0] ?? null;

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col">
      <h2 className="text-sm font-semibold text-white mb-1">Local Forecasts &amp; Alerts</h2>
      <p className="text-[11px] text-slate-500 mb-4">
        Forecasts for major {stateName} cities and any location statewide.
      </p>

      {/* Section 1: Popular Forecasts */}
      <div className="order-1">
        {cities.length === 1 && (
          <CityForecastDestinationCard
            city={cities[0]}
            stateSlug={stateSlug}
            stateCode={stateCode}
            sourcePage={FORECAST_SOURCE_PAGES.STATE_FORECAST_LIST}
            tempsBySlug={tempsBySlug}
          />
        )}

        {cities.length > 1 && selectedCity && (
          <div className="space-y-2">
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
              sourcePage={FORECAST_SOURCE_PAGES.STATE_FORECAST_LIST}
              tempsBySlug={tempsBySlug}
            />
          </div>
        )}
      </div>

      {/* Section 2: Location Search */}
      <div className="order-2 mt-5 pt-5 border-t border-slate-700">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Check another location
        </h3>
        <LocationSearchPanel
          stateCode={stateCode}
          stateSlug={stateSlug}
          stateName={stateName}
          allAlerts={allAlerts}
          alertsLoading={alertsLoading}
          onLocationFocus={onLocationFocus}
          onClearFocus={onClearFocus}
          onViewAlert={onViewAlert}
        />
      </div>

      {/* Section 3: State Forecast CTA */}
      <div className="order-3 mt-4">
        <Link
          to={`/forecast/${stateSlug}`}
          onClick={() =>
            trackForecastStateClick({
              stateCode,
              stateSlug,
              sourcePage: FORECAST_SOURCE_PAGES.STATE_FORECAST_CTA,
            })
          }
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 hover:border-sky-400/70 rounded-lg text-sm text-sky-300 hover:text-sky-200 font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          7-Day Forecast for {stateName}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
