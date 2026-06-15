import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  resolveLocationSearch,
  cityAlertsPath,
  trackLocationSearch,
  trackLocationSearchNotFound,
} from '../../services/locationCatalogService';
import {
  trackStatePageSearchStarted,
  trackStatePageSearchSuccess,
  FORECAST_SOURCE_PAGES,
} from '../../utils/analytics';
import citiesIndex from '../../content/cities/index.json';

const RICH_CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

/**
 * Prominent city/county search for state alert pages.
 * Auto-focus only when triggered externally (not on page load).
 */
const StateLocationSearch = forwardRef(function StateLocationSearch(
  { stateCode },
  ref,
) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const searchStartedRef = useRef(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    focusInput() {
      inputRef.current?.focus();
    },
  }));

  const markSearchStarted = useCallback(() => {
    if (searchStartedRef.current) return;
    searchStartedRef.current = true;
    trackStatePageSearchStarted({ state: stateCode });
  }, [stateCode]);

  const navigateForResolved = useCallback(
    (resolved) => {
      if (resolved.city) {
        trackStatePageSearchSuccess({ state: stateCode, destinationType: 'city' });
        const hasRich = resolved.city.hasStaticPage || RICH_CITY_SLUGS.has(resolved.city.slug);
        navigate(cityAlertsPath(resolved.city.slug, hasRich));
        return;
      }
      if (resolved.county) {
        trackStatePageSearchSuccess({ state: stateCode, destinationType: 'county' });
        navigate(`/alerts/county/${resolved.county.slug}`);
      }
    },
    [navigate, stateCode],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Enter a city or county name');
      return;
    }

    setSearching(true);
    setError('');
    try {
      const resolved = await resolveLocationSearch(trimmed, stateCode);
      if (resolved.error || (!resolved.city && !resolved.county)) {
        setError(resolved.error || 'No matching city or county found');
        await trackLocationSearchNotFound({
          query: trimmed,
          stateCode,
          pageContext: FORECAST_SOURCE_PAGES.STATE_ALERT_PAGE,
        });
        return;
      }

      const matchType = resolved.matchType || (resolved.city ? 'city' : 'county');
      await trackLocationSearch({
        query: trimmed,
        matchType,
        stateCode,
        cityId: resolved.city?.id,
        countyId: resolved.county?.id,
        zipCode: resolved.zip,
        pageContext: FORECAST_SOURCE_PAGES.STATE_ALERT_PAGE,
        success: true,
        resolvedType: matchType,
      });

      navigateForResolved(resolved);
    } catch (err) {
      console.warn('StateLocationSearch failed:', err);
      setError('Search failed — try again');
    } finally {
      setSearching(false);
    }
  };

  return (
    <section
      id="state-location-search"
      className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 sm:p-5"
    >
      <h2 className="text-sm sm:text-base font-semibold text-white mb-1">
        Check weather alerts for your city or county
      </h2>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              markSearchStarted();
              setQuery(e.target.value);
              if (error) setError('');
            }}
            onFocus={markSearchStarted}
            placeholder="Search city or county..."
            aria-label="Search city or county"
            disabled={searching}
            className="flex-1 min-w-0 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </section>
  );
});

export default StateLocationSearch;
