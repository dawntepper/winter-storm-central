import { useState } from 'react';
import { Link } from 'react-router-dom';

function formatRelativeTime(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

function scrollToMap() {
  document.getElementById('hazard-radar-map')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

/**
 * LiveHazardStatus — renders Hazard Engine liveStatus + compact state links.
 * Radar CTA scrolls to the on-page map (not /radar).
 */
export default function LiveHazardStatus({
  hazard,
  onRadarClick,
  onAlertsClick,
  onStateClick,
  onExpandStates,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!hazard?.liveStatus) return null;

  const {
    liveStatus,
    affectedStates = [],
    severityColor,
    freshness,
  } = hazard;

  const compactStates = liveStatus.affectedStatesCompact || {};
  const showExpand = (compactStates.remainingCount || 0) > 0;
  const statesToShow = expanded
    ? affectedStates
    : affectedStates.slice(0, compactStates.compactNames?.length || 3);

  const updatedIso = freshness?.latestSourceUpdateAt || hazard.updatedAt;
  const relative = formatRelativeTime(updatedIso);
  const unavailable = freshness?.dataAvailable === false;

  return (
    <section
      aria-labelledby="live-status-heading"
      className={`rounded-xl border border-slate-700/80 bg-slate-900/60 ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}
      style={{ borderLeftWidth: 4, borderLeftColor: severityColor || '#64748b' }}
    >
      <h2
        id="live-status-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2"
      >
        Live Status
      </h2>

      <p
        className={`font-bold text-white leading-tight ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}
        style={{ color: unavailable ? undefined : severityColor }}
      >
        {liveStatus.statusHeadline}
      </p>

      <p className={`mt-2 text-slate-300 leading-relaxed ${compact ? 'text-sm' : 'text-sm sm:text-[15px]'}`}>
        {liveStatus.statusSentence}
      </p>

      {relative && (
        <p className="mt-2 text-xs text-slate-500">
          {unavailable ? 'Last successful refresh' : liveStatus.hasActiveAlerts ? 'Updated' : 'Last checked'}{' '}
          <time dateTime={updatedIso}>{relative}</time>
        </p>
      )}

      {statesToShow.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-400 mb-1.5">Affected states</p>
          <p className="text-sm text-slate-200 leading-relaxed">
            {statesToShow.map((state, i) => (
              <span key={state.code}>
                {i > 0 && <span className="text-slate-600"> · </span>}
                {state.href ? (
                  <Link
                    to={state.href}
                    onClick={() => onStateClick?.(state)}
                    className="text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    {state.name}
                  </Link>
                ) : (
                  <span>{state.name}</span>
                )}
              </span>
            ))}
            {showExpand && !expanded && (
              <>
                <span className="text-slate-600"> · </span>
                <button
                  type="button"
                  className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
                  onClick={() => {
                    setExpanded(true);
                    onExpandStates?.();
                  }}
                  aria-expanded="false"
                >
                  and {compactStates.remainingCount} more
                </button>
              </>
            )}
            {expanded && showExpand && (
              <>
                <span className="text-slate-600"> · </span>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer"
                  onClick={() => setExpanded(false)}
                  aria-expanded="true"
                >
                  Show less
                </button>
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="#hazard-radar-map"
          onClick={(e) => {
            e.preventDefault();
            onRadarClick?.();
            scrollToMap();
          }}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
        >
          {liveStatus.hasActiveAlerts
            ? `View Live ${hazard.shortLabel} Radar`
            : 'View Live Radar'}
        </a>
        {liveStatus.hasActiveAlerts ? (
          <a
            href="#current-alerts"
            onClick={(e) => {
              e.preventDefault();
              onAlertsClick?.();
              document.getElementById('current-alerts')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/60 text-slate-200 border border-slate-600 hover:bg-slate-700 transition-colors"
          >
            View Current Warnings
          </a>
        ) : (
          <Link
            to="/alerts"
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/60 text-slate-200 border border-slate-600 hover:bg-slate-700 transition-colors"
          >
            Browse Current Severe Weather
          </Link>
        )}
      </div>
    </section>
  );
}
