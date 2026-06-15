import { Link, useLocation } from 'react-router-dom';
import { useStateCityLocations } from '../../hooks/useStateCityLocations';
import { trackPopularLocationClicked } from '../../utils/analytics';

/**
 * State-specific popular location shortcuts above the city directory.
 */
export default function PopularLocations({ stateAbbr, stateCode, stateSlug, stateName }) {
  const { pathname } = useLocation();
  const locations = useStateCityLocations(stateAbbr, stateCode, stateSlug, 8);

  if (locations.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">
        Popular Locations in {stateName}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {locations.map((loc) => {
          const isActive = pathname === loc.path;

          return (
            <Link
              key={loc.slug}
              to={loc.path}
              aria-current={isActive ? 'page' : undefined}
              onClick={() =>
                trackPopularLocationClicked({ state: stateCode, city: loc.name })
              }
              className={[
                'px-5 py-3 rounded-lg border text-sm font-semibold transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
                isActive
                  ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-900/40 ring-2 ring-sky-400/40'
                  : 'bg-slate-800/80 border-slate-600 text-slate-100 hover:bg-sky-600 hover:border-sky-500 hover:text-white hover:shadow-lg hover:shadow-sky-900/35 active:scale-[0.98]',
              ].join(' ')}
            >
              {loc.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
