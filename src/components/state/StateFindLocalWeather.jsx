import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCitiesForState,
  getCountiesForState,
  cityAlertsPath,
} from '../../services/locationCatalogService';
import {
  trackStateCitySelected,
  trackStateCountySelected,
  trackCountyResultClick,
  trackCityResultClick,
} from '../../utils/analytics';
import { STATE_NAMES } from '../../data/stateConfig';
import citiesIndex from '../../content/cities/index.json';
import StateCatalogCombobox from './StateCatalogCombobox';
import useStatePageGeolocation from './useStatePageGeolocation';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

function isBlockedName(name, stateCode) {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return true;
  const stateName = STATE_NAMES[stateCode]?.toLowerCase();
  if (stateName && normalized === stateName) return true;
  if (normalized === stateCode?.toLowerCase()) return true;
  return false;
}

function NavigationIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

/**
 * Right-rail location discovery: Use My Location + catalog city/county selectors.
 */
export default function StateFindLocalWeather({ stateCode, stateName }) {
  const navigate = useNavigate();
  const { handleUseMyLocation, isLocating, error, gpsMessage } = useStatePageGeolocation(stateCode);
  const [cities, setCities] = useState([]);
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [cityRows, countyRows] = await Promise.all([
        getCitiesForState(stateCode),
        getCountiesForState(stateCode),
      ]);
      if (cancelled) return;
      setCities(
        cityRows.filter((c) => c.name && !isBlockedName(c.name, stateCode)),
      );
      setCounties(
        countyRows.filter((c) => c.name && !isBlockedName(c.name, stateCode)),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  const cityOptions = cities.map((city) => ({
    value: city.slug,
    label: city.name,
    city,
  }));

  const countyOptions = counties.map((county) => ({
    value: county.slug,
    label: `${county.name} County`,
    county,
  }));

  const handleCitySelect = ({ city }) => {
    trackStateCitySelected({ state: stateCode, city: city.name });
    trackCityResultClick({
      citySlug: city.slug,
      stateCode: city.stateCode || stateCode,
      source: 'state-page-selector',
    });
    const hasRich = city.hasStaticPage || RICH_CITY_SLUGS.has(city.slug);
    navigate(cityAlertsPath(city.slug, hasRich));
  };

  const handleCountySelect = ({ county }) => {
    trackStateCountySelected({ state: stateCode, county: county.name });
    trackCountyResultClick({
      countySlug: county.slug,
      stateCode: county.stateCode || stateCode,
      source: 'state-page-selector',
    });
    navigate(`/alerts/county/${county.slug}`);
  };

  return (
    <section
      id="state-local-weather"
      className="scroll-mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4"
      aria-label="Find local weather"
    >
      <h2 className="text-sm font-semibold text-white mb-1">Find Local Weather</h2>
      <p className="text-[11px] text-slate-500 mb-4">
        Jump to alerts and forecasts for a location in {stateName}.
      </p>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-50 cursor-pointer"
        >
          <span aria-hidden="true">📍</span>
          <NavigationIcon className="h-4 w-4" />
          {isLocating ? 'Locating…' : 'Use My Location'}
        </button>

        {(gpsMessage || error) && (
          <p className="text-xs text-amber-400">{error || gpsMessage}</p>
        )}

        <StateCatalogCombobox
          label="City"
          placeholder="Select City"
          options={cityOptions}
          loading={loading}
          onSelect={handleCitySelect}
        />

        <StateCatalogCombobox
          label="County"
          placeholder="Select County"
          options={countyOptions}
          loading={loading}
          onSelect={handleCountySelect}
        />
      </div>
    </section>
  );
}
