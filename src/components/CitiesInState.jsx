import { Link } from 'react-router-dom';
import citiesIndex from '../content/cities/index.json';
import { compareCityNames } from '../utils/sortCities';

// Eager-load full city JSON so callers can read lat/lon without an extra fetch.
const cityModules = import.meta.glob('../content/cities/*.json', { eager: true });
const CITY_DATA_BY_SLUG = {};
for (const [path, mod] of Object.entries(cityModules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match && match[1] !== 'index') {
    CITY_DATA_BY_SLUG[match[1]] = mod.default || mod;
  }
}

const CITIES_BY_STATE = {};
for (const c of citiesIndex.cities || []) {
  if (!c.state_abbr) continue;
  if (!CITIES_BY_STATE[c.state_abbr]) CITIES_BY_STATE[c.state_abbr] = [];
  CITIES_BY_STATE[c.state_abbr].push(c);
}
// Sort each state's list alphabetically
for (const abbr of Object.keys(CITIES_BY_STATE)) {
  CITIES_BY_STATE[abbr].sort(compareCityNames);
}

export function citiesForState(stateAbbr) {
  return CITIES_BY_STATE[stateAbbr] || [];
}

// Same as citiesForState but joined with lat/lon from each city's full JSON.
// Cities missing coords are omitted so map callers don't have to defend against NaN.
export function citiesWithCoordsForState(stateAbbr) {
  return citiesForState(stateAbbr)
    .map((c) => {
      const full = CITY_DATA_BY_SLUG[c.slug];
      if (!full || typeof full.lat !== 'number' || typeof full.lon !== 'number') return null;
      return { slug: c.slug, city: c.city, state_abbr: c.state_abbr, lat: full.lat, lon: full.lon };
    })
    .filter(Boolean);
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
