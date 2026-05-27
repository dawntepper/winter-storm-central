import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCitiesForStateSlug } from '../data/cityCatalog';
import { trackForecastLinkClick } from '../utils/analytics';

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

  const handleCityClick = (citySlug) => {
    trackForecastLinkClick('state-page-widget', stateSlug, 'city');
    // Link's `to` does the actual nav — this is just for analytics.
  };

  const handleStateForecastClick = () => {
    trackForecastLinkClick('state-page-widget', stateSlug, 'state-default');
  };

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Weather Forecast</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Hourly + 7-day outlook from NWS
      </p>

      {cities.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {cities.map((c) => (
            <Link
              key={c.slug}
              to={`/forecast/${stateSlug}?city=${c.slug}`}
              onClick={() => handleCityClick(c.slug)}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/40 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 rounded-lg transition-colors text-sm text-slate-200 hover:text-white"
            >
              <span className="truncate">{c.city}</span>
              <span aria-hidden="true" className="text-sky-400 text-xs flex-shrink-0">→</span>
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
            className="px-3 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Go
          </button>
        </div>
        {zipError && <p className="text-[11px] text-red-400">{zipError}</p>}
      </form>

      <Link
        to={`/forecast/${stateSlug}`}
        onClick={handleStateForecastClick}
        className="block text-center text-xs text-sky-400 hover:text-sky-300 font-medium pt-2 border-t border-slate-700"
      >
        View {stateName} state forecast →
      </Link>
    </section>
  );
}
