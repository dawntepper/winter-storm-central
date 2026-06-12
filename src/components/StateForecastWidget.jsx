import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { trackForecastLinkClick } from '../utils/analytics';

function ForecastRowIcon() {
  return (
    <span
      className="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 group-hover:border-sky-400/50 transition-colors"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.5 19H9a7 7 0 1 1 6.71-9.5A5.5 5.5 0 0 1 17.5 19Z"
        />
      </svg>
    </span>
  );
}

const cityLinkClassName =
  'group flex items-center gap-3 px-3 py-2.5 bg-slate-900/50 hover:bg-sky-500/10 border border-slate-700 hover:border-sky-500/60 rounded-lg transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 cursor-pointer text-sm text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

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
export default function StateForecastWidget({ stateSlug, stateName }) {
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
    trackForecastLinkClick('state-page-widget', stateSlug, 'zip');
    navigate(`/forecast/${stateSlug}?zip=${zip}`);
  };

  const handleCityClick = () => {
    trackForecastLinkClick('state-page-widget', stateSlug, 'city');
  };

  const handleStateForecastClick = () => {
    trackForecastLinkClick('state-page-widget', stateSlug, 'state-default');
  };

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Weather Forecast</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Hourly + 7-day outlook from NWS — tap a city for details
      </p>

      {cities.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {cities.map((c) => (
            <Link
              key={c.slug}
              to={`/forecast/${stateSlug}?city=${c.slug}`}
              onClick={handleCityClick}
              className={cityLinkClassName}
            >
              <ForecastRowIcon />
              <span className="flex-1 min-w-0 truncate font-medium">{c.city}</span>
              <span
                aria-hidden="true"
                className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/80 group-hover:text-sky-300 flex-shrink-0"
              >
                Forecast →
              </span>
            </Link>
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
        onClick={handleStateForecastClick}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mt-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/50 hover:border-sky-400/70 rounded-lg text-sm text-sky-300 hover:text-sky-200 font-semibold transition-all duration-150 hover:shadow-md hover:shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        View {stateName} state forecast
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
