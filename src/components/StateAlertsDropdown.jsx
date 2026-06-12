import { useNavigate } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import {
  trackBrowseByStateClick,
  trackStateSelectorUsed,
  setNavSource,
} from '../utils/analytics';

const DEFAULT_CLASS =
  'appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2.5 pr-2 py-1 rounded focus:outline-none text-xs sm:text-sm font-medium border border-sky-500/30 transition-colors';

/**
 * Shared state selector used in Header, RadarPage, and StormMap radar card.
 * When currentStateSlug is set (state alert pages), shows the active state
 * (e.g. "📍 Florida") and fires State Selector Used analytics.
 */
export default function StateAlertsDropdown({
  source,
  className = DEFAULT_CLASS,
  currentStateSlug = null,
}) {
  const navigate = useNavigate();
  const currentName = currentStateSlug ? US_STATES[currentStateSlug]?.name : null;

  return (
    <select
      value={currentStateSlug || ''}
      onChange={(e) => {
        const slug = e.target.value;
        if (!slug || slug === currentStateSlug) return;

        const abbr = US_STATES[slug]?.abbr;
        const currentAbbr = currentStateSlug ? US_STATES[currentStateSlug]?.abbr : null;
        if (abbr) {
          if (currentAbbr) {
            trackStateSelectorUsed({
              currentStateCode: currentAbbr,
              destinationStateCode: abbr,
              source,
            });
          } else {
            trackBrowseByStateClick({ stateCode: abbr, source });
          }
          setNavSource(source);
          navigate(`/alerts/${slug}`);
        }
      }}
      className={className}
      aria-label={currentName ? `Current state: ${currentName}. Choose another state.` : 'Choose a state for alerts and radar'}
    >
      {!currentStateSlug && (
        <option value="" disabled>
          State Alerts/Radar ▾
        </option>
      )}
      {Object.entries(US_STATES).map(([slug, s]) => (
        <option key={slug} value={slug}>
          {currentStateSlug ? `📍 ${s.name}` : s.name}
        </option>
      ))}
    </select>
  );
}
