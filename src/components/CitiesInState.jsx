import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import citiesIndex from '../content/cities/index.json';

const CITIES_BY_STATE = {};
for (const c of citiesIndex.cities || []) {
  if (!c.state_abbr) continue;
  if (!CITIES_BY_STATE[c.state_abbr]) CITIES_BY_STATE[c.state_abbr] = [];
  CITIES_BY_STATE[c.state_abbr].push(c);
}
// Sort each state's list alphabetically
for (const abbr of Object.keys(CITIES_BY_STATE)) {
  CITIES_BY_STATE[abbr].sort((a, b) => a.city.localeCompare(b.city));
}

export function citiesForState(stateAbbr) {
  return CITIES_BY_STATE[stateAbbr] || [];
}

export function CitySearchBar({ stateAbbr, stateName }) {
  const cities = CITIES_BY_STATE[stateAbbr] || [];
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.city.toLowerCase().includes(q));
  }, [query, cities]);

  if (cities.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Find your city in {stateName}
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={`Search ${cities.length} cit${cities.length === 1 ? 'y' : 'ies'}...`}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
        />
        {focused && matches.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
            {matches.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/alerts/${c.slug}`}
                  className="block px-3 py-2 text-sm text-sky-300 hover:bg-slate-800 hover:text-sky-200 transition-colors"
                >
                  {c.city}, {c.state_abbr}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {focused && query.trim() && matches.length === 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-500">
            No supported cities match &quot;{query}&quot; in {stateName} yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function CityDirectory({ stateAbbr, stateName }) {
  const cities = CITIES_BY_STATE[stateAbbr] || [];
  if (cities.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-2">Cities in {stateName}</h2>
      <p className="text-sm text-slate-400 mb-4">
        Live alerts and current conditions for major {stateName} cities.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {cities.map((c) => (
          <Link
            key={c.slug}
            to={`/alerts/${c.slug}`}
            className="group flex items-center justify-between bg-slate-800 hover:bg-slate-800/80 border border-slate-700 hover:border-sky-500/50 rounded-lg px-3 py-2.5 transition-all duration-200"
          >
            <span className="text-sm font-medium text-white group-hover:text-sky-300 transition-colors">
              {c.city}
            </span>
            <span
              aria-hidden="true"
              className="text-sky-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-sm"
            >
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
