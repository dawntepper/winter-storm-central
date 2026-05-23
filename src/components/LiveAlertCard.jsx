import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ALERT_CATEGORIES } from '../../shared/nws-alert-parser';
import { getAlertTimeInfo } from '../utils/alertRanking';
import { STATE_NAMES, ABBR_TO_SLUG } from '../data/stateConfig';
import { findCitySlugInText } from '../utils/cityLookup';

/**
 * LiveAlertCard — Reusable alert card with compact and full modes.
 *
 * Props:
 *   alert       — ranked alert object (with .rank, .category, .event, etc.)
 *   mode        — "full" (default) or "compact"
 *   tick        — counter that increments to force time re-render
 *   onAlertTap  — (alert) => void — called when compact card is clicked (centers map)
 *   onAddToMap  — (alert) => void — called when "Add to Map" is clicked
 */
export default function LiveAlertCard({ alert, mode = 'full', tick, onAlertTap, onAddToMap }) {
  const [expanded, setExpanded] = useState(false);

  const cat = ALERT_CATEGORIES[alert.category] || {};
  const color = cat.color || '#64748b';
  const icon = cat.icon || '⚠️';
  const rankStr = String(alert.rank).padStart(2, '0');
  const timeInfo = getAlertTimeInfo(alert);

  // Tornado Warnings get a subtle pulsing halo to mark them as the highest-
  // life-threat alert class. Watches do NOT pulse — same category, different
  // urgency tier — and get an amber WATCH badge instead so users can scan
  // watch-vs-warning without parsing the event string.
  const isTornadoWarning =
    alert.category === 'tornado' && (alert.event || '').includes('Warning');
  const isTornadoWatch =
    alert.category === 'tornado' && (alert.event || '').includes('Watch');

  // Toggle the expanded panel + center the map on first open. Used by both
  // the Show Details button and the clickable event-name in full mode so the
  // event title doubles as a click target (small "Show Details" text is hard
  // to find for users who don't know to look for it).
  const toggleDetails = () => {
    if (!expanded) onAlertTap?.(alert);
    setExpanded(!expanded);
  };

  const stateName = alert.state ? (STATE_NAMES[alert.state] || alert.state) : '';
  const stateSlug = alert.state ? ABBR_TO_SLUG[alert.state] : null;
  const citySlug = alert.state ? findCitySlugInText(alert.location || '', alert.state) : null;

  // Split "Parmer, TX" → ["Parmer", "TX"] so each segment can be linked independently.
  const locMatch = (alert.location || '').match(/^(.*?),\s*([A-Z]{2})$/);
  const locCityPart = locMatch ? locMatch[1] : (alert.location || '');
  const locStateAbbr = locMatch ? locMatch[2] : null;

  const stopProp = (e) => e.stopPropagation();
  const inlineLinkClass = 'text-sky-400 hover:text-sky-300 hover:underline transition-colors';

  // ───── Compact mode (dashboard widget) ─────
  if (mode === 'compact') {
    const handleCompactClick = () => {
      if (!expanded) {
        onAlertTap?.(alert);
      }
      setExpanded(!expanded);
    };

    const handleAddToMap = (e) => {
      e.stopPropagation();
      onAddToMap?.(alert);
      setExpanded(false);
    };

    const detailRef = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
      if (expanded && detailRef.current) {
        setHeight(detailRef.current.scrollHeight);
      } else {
        setHeight(0);
      }
    }, [expanded]);

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCompactClick();
      }
    };

    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          onClick={handleCompactClick}
          onKeyDown={handleKeyDown}
          className={`group flex items-center gap-2 px-3 py-2 hover:bg-slate-700/30 transition-colors rounded w-full text-left cursor-pointer${isTornadoWarning ? ' tornado-warning-pulse' : ''}`}
        >
          {/* Rank badge */}
          <span
            className="text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded"
            style={{ backgroundColor: color + '25', color }}
          >
            {rankStr}
          </span>

          {/* Icon */}
          <span className="text-xs flex-shrink-0">{icon}</span>

          {/* State, City (top) / Warning name (below) */}
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate block">
              {stateSlug && stateName ? (
                <Link to={`/alerts/${stateSlug}`} onClick={stopProp} className={inlineLinkClass}>
                  {stateName}
                </Link>
              ) : (
                stateName
              )}
              {locCityPart && (
                <>
                  {stateName ? ', ' : ''}
                  {citySlug ? (
                    <Link to={`/alerts/${citySlug}`} onClick={stopProp} className={inlineLinkClass}>
                      {locCityPart}
                    </Link>
                  ) : (
                    locCityPart
                  )}
                </>
              )}
              {locStateAbbr && <>{', '}{locStateAbbr}</>}
              <svg
                aria-label={expanded ? 'Collapse' : 'Expand'}
                className={`inline-block w-3 h-3 ml-1.5 -mt-0.5 text-slate-500 group-hover:text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <span className="text-[10px] text-slate-500 truncate block">
              {isTornadoWatch && (
                <span className="text-[8px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-1 py-px rounded mr-1 align-middle">
                  WATCH
                </span>
              )}
              {alert.event}
            </span>
          </div>

          {/* NEW badge */}
          {alert.isNew && (
            <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none">
              NEW
            </span>
          )}

          {/* Time remaining */}
          <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
            {timeInfo.remainingFormatted}
          </span>

          {/* Thin progress bar */}
          <div className="w-12 h-1 bg-slate-700 rounded-full flex-shrink-0 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${timeInfo.progress * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Animated expanded details */}
        <div
          className="overflow-hidden transition-all duration-250 ease-in-out"
          style={{ maxHeight: height }}
        >
          <div ref={detailRef} className="px-3 pb-2.5 pt-1 mx-2 mb-1 space-y-2 rounded-lg bg-amber-950/40 border border-amber-500/15">
            {alert.fullDescription && (
              <p className="text-[10px] text-amber-200/70 leading-relaxed line-clamp-3">
                {alert.fullDescription}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {onAddToMap && (
                <button
                  onClick={handleAddToMap}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                >
                  + Add to Map
                </button>
              )}
              {citySlug && (
                <Link
                  to={`/alerts/${citySlug}`}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View city page &rarr;
                </Link>
              )}
              {stateSlug && (
                <Link
                  to={`/alerts/${stateSlug}`}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  All {stateName} alerts &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───── Full mode (/alerts page) ─────
  return (
    <div
      className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden border-l-4${isTornadoWarning ? ' tornado-warning-pulse' : ''}`}
      style={{ borderLeftColor: color }}
    >
      <div className="p-4 space-y-3">
        {/* Row 1: Rank + NEW badge + State, City + Radar */}
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2 py-1 rounded flex-shrink-0"
            style={{ backgroundColor: color + '25', color }}
          >
            #{rankStr}
          </span>
          {alert.isNew && (
            <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none">
              NEW
            </span>
          )}
          <h3 className="text-sm font-semibold text-white flex-1 truncate">
            {stateSlug && stateName ? (
              <Link to={`/alerts/${stateSlug}`} onClick={stopProp} className={inlineLinkClass}>
                {stateName}
              </Link>
            ) : (
              stateName
            )}
            {locCityPart && (
              <>
                {stateName ? ', ' : ''}
                {citySlug ? (
                  <Link to={`/alerts/${citySlug}`} onClick={stopProp} className={inlineLinkClass}>
                    {locCityPart}
                  </Link>
                ) : (
                  locCityPart
                )}
              </>
            )}
            {locStateAbbr && <>{', '}{locStateAbbr}</>}
          </h3>
        </div>

        {/* Row 2: Warning name (clickable — same action as Show Details) + optional WATCH badge */}
        <p className="flex items-center gap-1.5">
          {isTornadoWatch && (
            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 rounded tracking-wider">
              WATCH
            </span>
          )}
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={expanded}
            className="text-xs font-bold uppercase tracking-wide cursor-pointer text-left transition-colors"
            style={{ color }}
          >
            {alert.event}
            <svg
              aria-hidden="true"
              className={`inline-block w-3 h-3 ml-1 -mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </p>

        {/* Row 3: Status + Duration */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
          <span className="text-slate-300 font-semibold">
            <span className="text-slate-500">Status: </span>
            {timeInfo.remainingFormatted}
            {timeInfo.status === 'active' && ' remaining'}
          </span>
          <span className="text-slate-500">
            Duration: {timeInfo.totalFormatted} total
          </span>
        </div>

        {/* Row 4: Progress bar + Show Details (far right) */}
        <div className="flex items-center gap-3">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex-1">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${timeInfo.progress * 100}%`, backgroundColor: color }}
            />
          </div>
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={expanded}
            className="text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer flex-shrink-0"
          >
            {expanded ? 'Hide Details ▲' : 'Show Details ▼'}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-slate-700">
            {alert.fullDescription && (
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                {alert.fullDescription}
              </p>
            )}
            {alert.areaDesc && (
              <div>
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Affected Areas</h4>
                <p className="text-xs text-slate-400">{alert.areaDesc}</p>
              </div>
            )}
            <div className="flex gap-4 text-[10px] text-slate-500">
              {alert.severity && <span>Severity: {alert.severity}</span>}
              {alert.urgency && <span>Urgency: {alert.urgency}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
