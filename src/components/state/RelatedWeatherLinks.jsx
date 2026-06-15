import { Link } from 'react-router-dom';
import { trackRadarLinkClick, trackForecastStateClick, NAV_SOURCES, FORECAST_SOURCE_PAGES } from '../../utils/analytics';

/**
 * Related weather links footer block for state alert pages.
 */
export default function RelatedWeatherLinks({
  stateName,
  stateSlug,
  stateCode,
  onStateRadar,
  onStateCounties,
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Related Weather Information</h2>
      <ul className="space-y-2 text-sm">
        <li>
          <button
            type="button"
            onClick={() => {
              trackRadarLinkClick(NAV_SOURCES.STATE_PAGE_RADAR_LINK);
              onStateRadar?.();
            }}
            className="text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
          >
            {stateName} Radar
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={onStateCounties}
            className="text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
          >
            {stateName} Counties
          </button>
        </li>
        <li>
          <Link
            to={`/forecast/${stateSlug}`}
            onClick={() =>
              trackForecastStateClick({
                stateCode,
                stateSlug,
                sourcePage: FORECAST_SOURCE_PAGES.STATE_ALERT_PAGE,
              })
            }
            className="text-sky-400 hover:text-sky-300 hover:underline transition-colors"
          >
            {stateName} Forecasts
          </Link>
        </li>
        <li>
          <Link
            to="/alerts"
            className="text-sky-400 hover:text-sky-300 hover:underline transition-colors"
          >
            National Alerts
          </Link>
        </li>
      </ul>
    </section>
  );
}
