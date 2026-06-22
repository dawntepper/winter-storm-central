import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  resolveLocationSearch,
  getCountiesForState,
  getCitiesForState,
  getCitiesForCounty,
  resolveCountySelection,
  resolveCityByName,
  trackLocationSearch,
  trackLocationSearchNotFound,
  trackLocationSearchInvalidZip,
  trackCountyAlertView,
  getStateSlugForCode,
  cityAlertsPath,
} from '../services/locationCatalogService';
import { isValidZipFormat, lookupZip, INVALID_ZIP_MESSAGE } from '../services/zipLookupService';
import {
  trackCountyResultClick,
  trackCityResultClick,
  trackCityAlertView,
  FORECAST_SOURCE_PAGES,
  trackForecastLinkClick,
} from '../utils/analytics';
import citiesIndex from '../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

function severityClasses(severity) {
  if (severity === 'Extreme') return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (severity === 'Severe') return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (severity === 'Moderate') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}

const selectClass =
  'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 cursor-pointer disabled:cursor-not-allowed';

function searchSourcePage(matchType) {
  if (matchType === 'zip') return FORECAST_SOURCE_PAGES.STATE_SEARCH_ZIP;
  if (matchType === 'city') return FORECAST_SOURCE_PAGES.STATE_SEARCH_CITY;
  if (matchType === 'county') return FORECAST_SOURCE_PAGES.STATE_SEARCH_COUNTY;
  return null;
}

/**
 * ZIP + county/city search controls and results — embeddable in LocalForecastsAndAlerts.
 */
export function LocationSearchPanel({
  stateCode,
  stateSlug,
  stateName,
  allAlerts = [],
  alertsLoading = false,
  onLocationFocus,
  onClearFocus,
  onViewAlert,
}) {
  const [zip, setZip] = useState('');
  const [selectedCountyId, setSelectedCountyId] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityNotFound, setCityNotFound] = useState(false);
  const [counties, setCounties] = useState([]);
  const [cities, setCities] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [zipNoCoverage, setZipNoCoverage] = useState(null);
  const [result, setResult] = useState(null);
  const [lastMatchType, setLastMatchType] = useState(null);
  const [countyAlerts, setCountyAlerts] = useState([]);
  const [nearbyCities, setNearbyCities] = useState([]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityDropdownShowAll, setCityDropdownShowAll] = useState(false);
  const countySelectRef = useRef(null);
  const cityInputRef = useRef(null);
  const cityDropdownRef = useRef(null);
  const suppressCityDropdownOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      const [stateCounties, stateCities] = await Promise.all([
        getCountiesForState(stateCode),
        getCitiesForState(stateCode),
      ]);
      if (!cancelled) {
        setCounties(stateCounties);
        setCities(stateCities);
        setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  useEffect(() => {
    if (!cityNotFound || !countySelectRef.current) return;
    countySelectRef.current.focus();
    countySelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [cityNotFound]);

  useEffect(() => {
    if (!cityDropdownOpen) return undefined;
    const handleClickOutside = (e) => {
      if (cityDropdownRef.current?.contains(e.target)) return;
      setCityDropdownOpen(false);
      setCityDropdownShowAll(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cityDropdownOpen]);

  const applyResult = async (resolved, matchType, queryLabel) => {
    setResult(resolved);
    setLastMatchType(matchType);
    setCountyAlerts(resolved.alerts || []);
    const linked = resolved.county ? await getCitiesForCounty(resolved.county.id) : [];
    setNearbyCities(linked);

    const lat = resolved.county?.lat ?? resolved.city?.lat;
    const lon = resolved.county?.lon ?? resolved.city?.lon;
    if (lat != null && lon != null) {
      onLocationFocus?.({
        lat,
        lon,
        zoom: resolved.city ? 9 : 8,
        county: resolved.county,
        city: resolved.city,
        zip: resolved.zip,
        alerts: resolved.alerts || [],
      });
    }

    await trackLocationSearch({
      query: queryLabel,
      matchType,
      stateCode,
      cityId: resolved.city?.id,
      countyId: resolved.county?.id,
      zipCode: resolved.zip,
      pageContext: searchSourcePage(matchType) || stateSlug,
      resultCount: (resolved.alerts || []).length,
      success: true,
      resolvedType: matchType,
    });

    if (resolved.county) {
      await trackCountyAlertView({
        countyId: resolved.county.id,
        stateCode: resolved.county.stateCode,
        alertCount: (resolved.alerts || []).length,
        source: 'state-page-search',
        countyName: resolved.county.name,
      });
    }

    if (resolved.city) {
      trackCityAlertView({
        cityId: resolved.city.id,
        stateCode: resolved.city.stateCode,
        source: 'state-page-search',
        cityName: resolved.city.name,
      });
    }
  };

  const handleZipSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setZipNoCoverage(null);
    setResult(null);
    setCountyAlerts([]);
    setNearbyCities([]);
    setSelectedCountyId('');
    setCityQuery('');
    setCityNotFound(false);
    closeCityDropdown();

    const trimmed = zip.trim();
    if (!isValidZipFormat(trimmed)) {
      setError(INVALID_ZIP_MESSAGE);
      await trackLocationSearchInvalidZip({
        query: trimmed,
        stateCode,
        pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_ZIP,
        reason: 'format',
      });
      return;
    }

    setSearching(true);
    try {
      const zipPlace = await lookupZip(trimmed);
      if (!zipPlace) {
        setError(INVALID_ZIP_MESSAGE);
        await trackLocationSearchInvalidZip({
          query: trimmed,
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_ZIP,
          reason: 'unknown',
        });
        return;
      }

      const resolved = await resolveLocationSearch(trimmed, stateCode);
      if (resolved.failureType === 'invalid_zip') {
        setError(INVALID_ZIP_MESSAGE);
        await trackLocationSearchInvalidZip({
          query: trimmed,
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_ZIP,
          reason: 'unknown',
        });
        return;
      }

      if (resolved.error || !resolved.county) {
        const place = resolved.zipPlace || zipPlace;
        const displayName = `${place.city}, ${place.stateAbbr}`;
        const stateSlugForLink = getStateSlugForCode(place.stateAbbr);
        setZipNoCoverage({
          displayName,
          statePath: stateSlugForLink ? `/alerts/${stateSlugForLink}` : null,
        });
        setError(resolved.error || `No coverage yet for ${displayName}`);
        await trackLocationSearchNotFound({
          query: trimmed,
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_ZIP,
          zipPlace: place,
        });
        return;
      }

      const { alerts } = await resolveCountySelection(resolved.county.id, allAlerts);
      await applyResult(
        { ...resolved, alerts },
        'zip',
        trimmed,
      );
    } catch (err) {
      console.warn('CheckAlertsNearYou ZIP search failed:', err);
      setError('Search failed — try again');
    } finally {
      setSearching(false);
    }
  };

  const handleCountyChange = async (e) => {
    const countyId = e.target.value;
    setSelectedCountyId(countyId);
    setZip('');
    setCityQuery('');
    setError('');
    setCityNotFound(false);
    closeCityDropdown();
    setResult(null);
    setCountyAlerts([]);
    setNearbyCities([]);

    if (!countyId) {
      onClearFocus?.();
      return;
    }

    setSearching(true);
    try {
      const resolved = await resolveCountySelection(countyId, allAlerts);
      if (resolved.error || !resolved.county) {
        setError(resolved.error || 'County not found');
        const selectedCounty = counties.find((c) => String(c.id) === countyId);
        await trackLocationSearchNotFound({
          query: selectedCounty?.name || String(countyId),
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_COUNTY,
        });
        return;
      }
      await applyResult(resolved, 'county', resolved.county.name);
    } catch (err) {
      console.warn('CheckAlertsNearYou county select failed:', err);
      setError('Could not load county alerts');
    } finally {
      setSearching(false);
    }
  };

  const closeCityDropdown = () => {
    setCityDropdownOpen(false);
    setCityDropdownShowAll(false);
  };

  const filteredCities =
    cityDropdownShowAll || !cityQuery.trim()
      ? cities
      : cities.filter((city) =>
          city.name.toLowerCase().includes(cityQuery.trim().toLowerCase()),
        );

  const resolveCityQuery = async (cityName) => {
    const trimmed = cityName.trim();
    if (!trimmed) {
      setError('Enter a city name');
      return;
    }

    setZip('');
    setSelectedCountyId('');
    setError('');
    setZipNoCoverage(null);
    setResult(null);
    setCountyAlerts([]);
    setNearbyCities([]);
    setCityNotFound(false);

    setSearching(true);
    try {
      const resolved = await resolveCityByName(trimmed, stateCode, allAlerts);
      if (resolved.error || !resolved.county || resolved.matchType === 'not_found') {
        setCityNotFound(true);
        await trackLocationSearchNotFound({
          query: trimmed,
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_SEARCH_CITY,
        });
        return;
      }
      setCityQuery(resolved.city?.name || trimmed);
      suppressCityDropdownOpenRef.current = true;
      closeCityDropdown();
      await applyResult(resolved, 'city', trimmed);
    } catch (err) {
      console.warn('CheckAlertsNearYou city search failed:', err);
      setError('Could not load city alerts');
    } finally {
      setSearching(false);
    }
  };

  const handleCitySubmit = async (e) => {
    e.preventDefault();
    await resolveCityQuery(cityQuery);
  };

  const handleCityPick = (cityName) => {
    setCityQuery(cityName);
    suppressCityDropdownOpenRef.current = true;
    closeCityDropdown();
    resolveCityQuery(cityName);
  };

  const toggleCityDropdown = () => {
    if (catalogLoading || searching) return;
    if (cityDropdownOpen) {
      suppressCityDropdownOpenRef.current = true;
      closeCityDropdown();
    } else {
      setCityDropdownShowAll(true);
      setCityDropdownOpen(true);
      cityInputRef.current?.focus();
    }
  };

  const resolvedStateSlug = result?.county
    ? getStateSlugForCode(result.county.stateCode) || stateSlug
    : stateSlug;

  return (
    <>
      <div className="space-y-3">
        <form onSubmit={handleZipSubmit} className="space-y-2">
          <label htmlFor="zip-search" className="block text-xs font-medium text-slate-400">
            ZIP code
          </label>
          <div className="flex gap-2">
            <input
              id="zip-search"
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. 20850"
              aria-label="ZIP code"
              className="flex-1 min-w-0 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={searching || zip.length !== 5}
              className="px-4 py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {searching ? '…' : 'Check'}
            </button>
          </div>
        </form>

        <form onSubmit={handleCitySubmit} className="space-y-2">
          <label htmlFor="city-search" className="block text-xs font-medium text-slate-400">
            City
          </label>
          <div
            className={`relative overflow-visible${catalogLoading || searching ? ' opacity-50' : ''}`}
            ref={cityDropdownRef}
          >
            <div
              className={`flex items-center gap-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus-within:border-sky-500 ${
                catalogLoading || searching ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={(e) => {
                if (catalogLoading || searching) return;
                if (e.target.closest('button[type="button"]')) return;
                if (!cityDropdownOpen) {
                  setCityDropdownShowAll(true);
                  setCityDropdownOpen(true);
                }
                cityInputRef.current?.focus();
              }}
            >
              <input
                ref={cityInputRef}
                id="city-search"
                type="text"
                role="combobox"
                aria-expanded={cityDropdownOpen}
                aria-autocomplete="list"
                aria-controls={`city-listbox-${stateCode}`}
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value);
                  setCityDropdownShowAll(false);
                  setCityNotFound(false);
                  if (!catalogLoading && !searching) setCityDropdownOpen(true);
                  if (zip) setZip('');
                  if (selectedCountyId) {
                    setSelectedCountyId('');
                    setResult(null);
                    setCountyAlerts([]);
                    setNearbyCities([]);
                    setError('');
                    onClearFocus?.();
                  }
                }}
                onFocus={() => {
                  if (suppressCityDropdownOpenRef.current) {
                    suppressCityDropdownOpenRef.current = false;
                    return;
                  }
                  if (!catalogLoading && !searching && cities.length > 0) {
                    setCityDropdownShowAll(true);
                    setCityDropdownOpen(true);
                  }
                }}
                placeholder={catalogLoading ? 'Loading cities…' : 'Search...'}
                aria-label="City name"
                disabled={catalogLoading || searching}
                className={`flex-1 min-w-0 bg-transparent border-0 p-0 text-white text-sm placeholder-slate-500 focus:outline-none ${
                  catalogLoading || searching
                    ? 'cursor-not-allowed'
                    : cityDropdownOpen
                      ? 'cursor-text'
                      : 'cursor-pointer'
                }`}
              />
              <button
                type="button"
                onClick={toggleCityDropdown}
                disabled={catalogLoading || searching}
                aria-label={cityDropdownOpen ? 'Close city list' : 'Show all cities in state'}
                aria-expanded={cityDropdownOpen}
                className="shrink-0 p-0 text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {cityDropdownOpen && !catalogLoading && !searching && (
              <ul
                id={`city-listbox-${stateCode}`}
                role="listbox"
                className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-slate-700 bg-slate-900 shadow-lg"
              >
                {filteredCities.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500">No matching cities</li>
                ) : (
                  filteredCities.map((city) => (
                    <li key={city.id} role="option" aria-selected={cityQuery === city.name}>
                      <button
                        type="button"
                        onClick={() => handleCityPick(city.name)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                          cityQuery === city.name
                            ? 'bg-sky-600/30 text-white'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {city.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </form>

        <div>
          <label htmlFor="county-select" className="block text-xs font-medium text-slate-400 mb-1">
            County
          </label>
          <select
            id="county-select"
            ref={countySelectRef}
            value={selectedCountyId}
            onChange={handleCountyChange}
            disabled={catalogLoading || searching}
            className={`${selectClass}${cityNotFound ? ' ring-2 ring-sky-500/60 border-sky-500' : ''}`}
          >
            <option value="">
              {catalogLoading ? 'Loading counties…' : 'Search...'}
            </option>
            {counties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name} County
              </option>
            ))}
          </select>
        </div>

        {cityNotFound && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
            <p className="text-sm text-amber-100/90 leading-relaxed">
              We&apos;re expanding city coverage across the U.S. If your city isn&apos;t listed yet,
              search by county to see active weather alerts near you.
            </p>
            <p className="text-xs text-amber-200/70">
              Try selecting your county below — alerts are shown at the county level.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {zipNoCoverage?.statePath && (
          <p className="text-sm text-amber-300/90">
            <Link to={zipNoCoverage.statePath} className="text-sky-400 hover:text-sky-300 underline">
              View {stateName} alerts instead
            </Link>
          </p>
        )}
      </div>

      {result?.county && (
        <div className="space-y-4 pt-4 mt-4 border-t border-slate-700">
          <div>
            <p className="text-sm text-slate-400">Showing alerts for</p>
            <p className="text-base font-semibold text-white mt-0.5">
              {result.city ? `${result.city.name}, ${result.city.stateCode}` : result.county.name}
              {result.city && (
                <span className="text-slate-400 font-normal">
                  {' '}
                  · {result.county.name} County
                </span>
              )}
              {!result.city && (
                <span className="text-slate-400 font-normal">
                  {' '}
                  County, {result.county.stateCode}
                </span>
              )}
            </p>
            {result.zip && (
              <p className="text-sm text-slate-500 mt-1">ZIP {result.zip}</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Active alerts ({alertsLoading ? '…' : countyAlerts.length})
            </h3>
            {alertsLoading ? (
              <p className="text-sm text-slate-500">Loading alerts…</p>
            ) : countyAlerts.length === 0 ? (
              <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                No active NWS alerts for {result.county.name} County right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {countyAlerts.map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => onViewAlert?.(alert)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors hover:brightness-110 cursor-pointer ${severityClasses(alert.severity)}`}
                    >
                      <p className="text-sm font-semibold">{alert.event}</p>
                      {alert.headline && (
                        <p className="text-sm opacity-90 mt-1 leading-relaxed">{alert.headline}</p>
                      )}
                      {alert.location && (
                        <p className="text-xs text-slate-400 mt-1.5">{alert.location}</p>
                      )}
                      <p className="text-xs text-sky-300/80 mt-2">Tap for full details →</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {nearbyCities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Cities in {result.county.name} County
              </h3>
              <div className="flex flex-wrap gap-2">
                {nearbyCities.slice(0, 8).map((city) => (
                  <Link
                    key={city.id}
                    to={cityAlertsPath(city.slug, RICH_CITY_SLUGS.has(city.slug))}
                    onClick={() =>
                      trackCityResultClick({
                        citySlug: city.slug,
                        stateCode: city.stateCode,
                        source: 'state-page-search',
                      })
                    }
                    className="text-sm px-3 py-1.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 rounded-lg text-slate-300 hover:text-white transition-colors"
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setZip('');
                setSelectedCountyId('');
                setCityQuery('');
                setResult(null);
                setLastMatchType(null);
                setCountyAlerts([]);
                setNearbyCities([]);
                setError('');
                setCityNotFound(false);
                closeCityDropdown();
                onClearFocus?.();
              }}
              className="text-sm px-3 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              View all {stateName} alerts
            </button>
            <Link
              to={`/alerts/county/${result.county.slug}`}
              onClick={() =>
                trackCountyResultClick({
                  countySlug: result.county.slug,
                  stateCode: result.county.stateCode,
                  source: 'state-page-search',
                })
              }
              className="text-sm px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 rounded-lg font-medium transition-colors"
            >
              County alerts →
            </Link>
            {result.city && (
              <Link
                to={cityAlertsPath(result.city.slug, RICH_CITY_SLUGS.has(result.city.slug))}
                onClick={() =>
                  trackCityResultClick({
                    citySlug: result.city.slug,
                    stateCode: result.city.stateCode,
                    source: 'state-page-search',
                  })
                }
                className="text-sm px-3 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                City alerts →
              </Link>
            )}
            <Link
              to="/radar"
              className="text-sm px-3 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              Radar →
            </Link>
            <Link
              to={
                result.zip
                  ? `/forecast/${resolvedStateSlug}?zip=${result.zip}`
                  : result.city
                    ? `/forecast/${resolvedStateSlug}?city=${result.city.slug}`
                    : `/forecast/${resolvedStateSlug}`
              }
              onClick={() =>
                trackForecastLinkClick(
                  'state-page-search',
                  resolvedStateSlug,
                  result.zip ? 'zip' : result.city ? 'city' : 'state-default',
                  {
                    sourcePage:
                      searchSourcePage(lastMatchType) ||
                      FORECAST_SOURCE_PAGES.FORECASTS_CONDITIONS_CARD,
                    ...(result.city
                      ? { city: result.city.name, citySlug: result.city.slug }
                      : {}),
                  },
                )
              }
              className="text-sm px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 hover:border-sky-400/60 text-sky-300 hover:text-sky-200 rounded-lg font-medium transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10"
            >
              Forecast →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
