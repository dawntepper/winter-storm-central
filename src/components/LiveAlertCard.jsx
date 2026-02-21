import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ALERT_CATEGORIES } from '../../shared/nws-alert-parser';
import { getAlertTimeInfo } from '../utils/alertRanking';
import { STATE_NAMES } from '../data/stateConfig';

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

  const stateName = alert.state ? (STATE_NAMES[alert.state] || alert.state) : '';
  const locationLine = [stateName, alert.location].filter(Boolean).join(', ');

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

    return (
      <div>
        <button
          onClick={handleCompactClick}
          className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-700/30 transition-colors rounded w-full text-left cursor-pointer"
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
              {locationLine}
            </span>
            <span className="text-[10px] text-slate-500 truncate block">{alert.event}</span>
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
        </button>

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
            <div className="flex items-center gap-2">
              {onAddToMap && (
                <button
                  onClick={handleAddToMap}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                >
                  + Add to Map
                </button>
              )}
              <Link
                to="/alerts"
                className="text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                View All →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───── Full mode (/alerts page) ─────
  return (
    <div
      className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden border-l-4"
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
            {locationLine}
          </h3>
          <Link
            to="/radar"
            className="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors flex-shrink-0 text-emerald-400 bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25"
          >
            Radar
          </Link>
        </div>

        {/* Row 2: Warning name (category-colored) */}
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          {alert.event}
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

        {/* Row 4: Progress bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${timeInfo.progress * 100}%`, backgroundColor: color }}
          />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
        >
          {expanded ? 'Hide Details ▲' : 'Show Details ▼'}
        </button>

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
