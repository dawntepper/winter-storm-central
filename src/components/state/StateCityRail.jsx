import { Link } from 'react-router-dom';
import { useStateCityLocations } from '../../hooks/useStateCityLocations';
import { trackPopularLocationClicked } from '../../utils/analytics';

const buttonBase =
  'bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm shadow-sky-900/30 transition-colors';

/**
 * City shortcuts beside the state radar map — horizontal scroll on mobile,
 * compact vertical rail on desktop.
 */
export default function StateCityRail({
  stateAbbr,
  stateCode,
  stateSlug,
  layout = 'vertical',
  className = '',
}) {
  const locations = useStateCityLocations(stateAbbr, stateCode, stateSlug, 16);

  if (locations.length === 0) return null;

  const trackClick = (name) => {
    trackPopularLocationClicked({ state: stateCode, city: name });
  };

  if (layout === 'horizontal') {
    return (
      <nav aria-label="Popular cities" className={className}>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {locations.map((loc) => (
            <Link
              key={loc.slug}
              to={loc.path}
              onClick={() => trackClick(loc.name)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm ${buttonBase}`}
            >
              {loc.name}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Popular cities"
      className={`flex flex-col gap-1.5 overflow-y-auto overscroll-contain max-h-[40vh] lg:max-h-[500px] w-[5.5rem] shrink-0 ${className}`}
    >
      {locations.map((loc) => (
        <Link
          key={loc.slug}
          to={loc.path}
          onClick={() => trackClick(loc.name)}
          title={loc.name}
          className={`px-2 py-1.5 rounded-lg text-[11px] leading-tight text-center ${buttonBase}`}
        >
          <span className="line-clamp-2">{loc.name}</span>
        </Link>
      ))}
    </nav>
  );
}
