import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { US_STATES } from '../data/stateConfig';
import {
  trackBrowseByStateClick,
  trackStateSelectorUsed,
  setNavSource,
} from '../utils/analytics';

const DEFAULT_CLASS =
  'appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2.5 pr-2 py-1 rounded focus:outline-none text-xs sm:text-sm font-medium border border-sky-500/30 transition-colors';

const STATE_TRIGGER_CLASS =
  '!pl-6 !pr-6 sm:!pl-7 sm:!pr-7 min-w-0 max-w-full truncate';

/**
 * Shared state selector used in Header, RadarPage, and StormMap radar card.
 * When currentStateSlug is set (state alert pages), shows the active state
 * (e.g. "📍 Florida ▼") with pin + caret on the trigger only; dropdown
 * options are plain state names.
 */
export default function StateAlertsDropdown({
  source,
  className = DEFAULT_CLASS,
  currentStateSlug = null,
  /** When true, placeholder uses short mobile-friendly "State Alerts ▾". */
  compactMobileLabel = false,
}) {
  const navigate = useNavigate();
  const currentName = currentStateSlug ? US_STATES[currentStateSlug]?.name : null;
  const isStatePage = Boolean(currentStateSlug);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    if (!compactMobileLabel) return undefined;
    const onResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [compactMobileLabel]);

  const placeholder = compactMobileLabel && isNarrow
    ? 'State Alerts ▾'
    : 'State Alerts/Radar ▾';

  const select = (
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
      className={`${className}${isStatePage ? ` ${STATE_TRIGGER_CLASS}` : ''}`}
      aria-label={
        currentName
          ? `${currentName} weather alerts and radar. Choose another state.`
          : 'State weather alerts and radar. Choose a state.'
      }
    >
      {!currentStateSlug && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {Object.entries(US_STATES).map(([slug, s]) => (
        <option key={slug} value={slug}>
          {s.name}
        </option>
      ))}
    </select>
  );

  if (!isStatePage) {
    return select;
  }

  return (
    <span className="relative inline-flex items-center max-w-[9.5rem] sm:max-w-none min-w-0 flex-shrink-0">
      <span
        className="pointer-events-none absolute left-1.5 sm:left-2 z-10 text-[10px] sm:text-xs leading-none"
        aria-hidden="true"
      >
        📍
      </span>
      {select}
      <span
        className="pointer-events-none absolute right-1 sm:right-1.5 z-10 text-sky-400/75 leading-none"
        aria-hidden="true"
      >
        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </span>
  );
}
