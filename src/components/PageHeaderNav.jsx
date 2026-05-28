import { Link, useNavigate } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import {
  trackRadarLinkClick,
  trackBrowseByStateClick,
  setNavSource,
  NAV_SOURCES,
} from '../utils/analytics';

/**
 * Shared nav-button cluster — Live Alerts / Live Weather Radar / State
 * Weather-Radar dropdown. Same component used by Header (homepage) and
 * by inline page-headers on state alerts pages, forecast pages, etc.
 *
 * @param {Object} props
 * @param {string} props.source  NAV_SOURCES value attributed to clicks
 *   from this header instance (e.g. 'state_page_state_dropdown',
 *   'forecast_page_state_dropdown').
 */
export default function PageHeaderNav({ source = NAV_SOURCES.HEADER_NAVIGATION }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      <Link
        to="/alerts"
        className="text-xs sm:text-sm text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 px-2.5 py-1 rounded border border-red-500/30 transition-colors"
      >
        Live Alerts
      </Link>
      <Link
        to="/radar"
        onClick={() => { trackRadarLinkClick(source); setNavSource(source); }}
        className="text-xs sm:text-sm text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 px-2.5 py-1 rounded border border-emerald-500/30 transition-colors"
      >
        Live Weather Radar
      </Link>
      <span className="relative inline-flex items-center">
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
          className="appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2.5 pr-2 py-1 rounded focus:outline-none text-xs sm:text-sm font-medium border border-sky-500/30 transition-colors"
        >
          <option value="" disabled>State Alerts/Radar ▾</option>
          {Object.entries(US_STATES).map(([slug, s]) => (
            <option key={slug} value={slug}>{s.name}</option>
          ))}
        </select>
      </span>
    </div>
  );
}
