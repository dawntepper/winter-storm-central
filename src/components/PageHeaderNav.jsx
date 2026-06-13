import { Link } from 'react-router-dom';
import StateAlertsDropdown from './StateAlertsDropdown';
import {
  trackRadarLinkClick,
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
 * @param {boolean} [props.showStateDropdown=true]  Set false only when no
 *   state selector should appear in this header row.
 * @param {string|null} [props.currentStateSlug]  Active state slug on state
 *   alert pages — passed through to StateAlertsDropdown for pin styling.
 */
export default function PageHeaderNav({
  source = NAV_SOURCES.HEADER_NAVIGATION,
  showStateDropdown = true,
  currentStateSlug = null,
}) {
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
      {showStateDropdown && (
        <span className="relative inline-flex items-center">
          <StateAlertsDropdown source={source} currentStateSlug={currentStateSlug} />
        </span>
      )}
    </div>
  );
}
