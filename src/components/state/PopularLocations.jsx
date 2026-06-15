import { Link } from 'react-router-dom';
import { useStateCityLocations } from '../../hooks/useStateCityLocations';
import { trackPopularLocationClicked } from '../../utils/analytics';

/**
 * State-specific popular location pills above the city directory.
 */
export default function PopularLocations({ stateAbbr, stateCode, stateSlug, stateName }) {
  const locations = useStateCityLocations(stateAbbr, stateCode, stateSlug, 8);

  if (locations.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">
        Popular Locations in {stateName}
      </h2>
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            to={loc.path}
            onClick={() =>
              trackPopularLocationClicked({ state: stateCode, city: loc.name })
            }
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-full text-sm font-semibold text-white shadow-sm shadow-sky-900/30 transition-colors"
          >
            {loc.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
