import { useNavigate } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import { trackBrowseByStateClick, setNavSource } from '../utils/analytics';

const DEFAULT_CLASS =
  'appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2.5 pr-2 py-1 rounded focus:outline-none text-xs sm:text-sm font-medium border border-sky-500/30 transition-colors';

/**
 * Shared "State Alerts/Radar" select used in Header, RadarPage, and StormMap.
 * Resets after navigation so the placeholder label always shows.
 */
export default function StateAlertsDropdown({ source, className = DEFAULT_CLASS }) {
  const navigate = useNavigate();

  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) {
          const abbr = US_STATES[e.target.value]?.abbr;
          if (abbr) trackBrowseByStateClick({ stateCode: abbr, source });
          setNavSource(source);
          navigate(`/alerts/${e.target.value}`);
          e.target.value = '';
        }
      }}
      className={className}
    >
      <option value="" disabled>State Alerts/Radar ▾</option>
      {Object.entries(US_STATES).map(([slug, s]) => (
        <option key={slug} value={slug}>{s.name}</option>
      ))}
    </select>
  );
}
