import { Link } from 'react-router-dom';
import StateAlertsDropdown from './StateAlertsDropdown';
import {
  trackRadarLinkClick,
  setNavSource,
  NAV_SOURCES,
} from '../utils/analytics';

const ALERTS_NAV =
  'text-xs sm:text-sm text-red-400 hover:bg-red-500/25 font-medium bg-red-500/15 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded border border-red-500/30 transition-colors whitespace-nowrap';

/** Cyan/sky — primary interactive nav (not green). */
const RADAR_NAV =
  'text-xs sm:text-sm text-sky-400 hover:bg-sky-500/25 font-medium bg-sky-500/15 px-2 sm:px-2.5 py-1.5 sm:py-1 rounded border border-sky-500/30 transition-colors whitespace-nowrap';

/**
 * Shared nav-button cluster — Alerts / Radar / State Alerts.
 * Mobile: short labels. Radar uses cyan/blue (never green).
 */
export default function PageHeaderNav({
  source = NAV_SOURCES.HEADER_NAVIGATION,
  stateSource = null,
  showStateDropdown = true,
  currentStateSlug = null,
  className = '',
  /** When true, keep Alerts/Radar/State in one left cluster (More sits outside). */
  compactCluster = false,
}) {
  const dropdownSource = stateSource || source;

  return (
    <nav
      aria-label="Primary"
      className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
        compactCluster ? '' : 'w-full lg:w-auto justify-between lg:justify-start'
      } ${className}`.trim()}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Link
          to="/alerts"
          aria-label="Live weather alerts"
          className={ALERTS_NAV}
        >
          <span className="md:hidden">Alerts</span>
          <span className="hidden md:inline">Live Alerts</span>
        </Link>
        <Link
          to="/radar"
          aria-label="Live weather radar"
          onClick={() => { trackRadarLinkClick(source); setNavSource(source); }}
          className={RADAR_NAV}
        >
          <span className="md:hidden">Radar</span>
          <span className="hidden md:inline">Live Weather Radar</span>
        </Link>
        {showStateDropdown && compactCluster && (
          <span className="relative inline-flex items-center min-w-0 max-w-[9.5rem] sm:max-w-none shrink-0">
            <StateAlertsDropdown
              source={dropdownSource}
              currentStateSlug={currentStateSlug}
              compactMobileLabel
            />
          </span>
        )}
      </div>
      {showStateDropdown && !compactCluster && (
        <span className="relative inline-flex items-center min-w-0 max-w-[48%] md:max-w-none shrink-0 ml-auto lg:ml-0">
          <StateAlertsDropdown
            source={dropdownSource}
            currentStateSlug={currentStateSlug}
            compactMobileLabel
          />
        </span>
      )}
    </nav>
  );
}
