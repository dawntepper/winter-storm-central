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

function SituationPlaceholder() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="content-placeholder h-6 w-3/4 max-w-md" />
      <div className="space-y-2 pt-0.5">
        <div className="content-placeholder h-3.5 w-full max-w-3xl" />
        <div className="content-placeholder h-3.5 w-5/6 max-w-2xl" />
      </div>
      <div className="pt-1 space-y-2">
        <div className="content-placeholder h-2.5 w-24" />
        <div className="content-placeholder h-3.5 w-4/5 max-w-xl" />
      </div>
    </div>
  );
}

/**
 * Current Situation — one deterministic briefing only.
 *
 * Renders: freshness → headline → brief → optional What's changed → Affected States.
 * Does NOT render cached Haiku / manual weatherBrief.summary (legacy Layer 2).
 * When `loading`, keeps the same card shell with reserved placeholders, then
 * fades real copy in once (no section remount / layout jump).
 */
export default function CurrentSituation({
  hazard,
  loading = false,
  onAlertsClick,
  onStateClick,
  onExpandStates,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!hazard && !loading) return null;

  const {
    liveStatus,
    affectedStates = [],
    severityColor,
    freshness,
    activeCount = 0,
    shortLabel,
  } = hazard || {};

  if (!loading && !liveStatus) return null;

  const brief = liveStatus?.brief || liveStatus?.situationSummary || liveStatus?.statusSentence;
  const changeSummary = liveStatus?.changeSummary || null;

  const compactStates = liveStatus?.affectedStatesCompact || {};
  const showExpand = (compactStates.remainingCount || 0) > 0;
  const compactCount = compactStates.compactNames?.length || 4;
  const statesToShow = expanded
    ? affectedStates
    : affectedStates.slice(0, Math.max(compactCount, 1));

  const updatedIso = freshness?.latestSourceUpdateAt || hazard?.updatedAt;
  const relative = !loading ? formatRelativeTime(updatedIso) : null;
  const unavailable = freshness?.dataAvailable === false;
  const short = (shortLabel || '').toLowerCase();

  const ctaLabel = activeCount === 1
    ? 'View Detailed Warning ↓'
    : 'View Detailed Warnings ↓';

  return (
    <section
      aria-labelledby="current-situation-heading"
      aria-busy={loading || undefined}
      className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3.5 sm:px-5 sm:py-4"
      style={{ borderLeftWidth: 4, borderLeftColor: severityColor || '#64748b' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
        <h2
          id="current-situation-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          Current Situation
        </h2>
        {loading ? (
          <p className="text-xs text-slate-500" role="status">
            Checking alerts…
          </p>
        ) : relative ? (
          <p className="text-xs text-slate-500">
            {unavailable ? 'Last successful refresh' : 'Updated'}{' '}
            <time dateTime={updatedIso}>{relative}</time>
          </p>
        ) : null}
      </div>

      {loading ? (
        <SituationPlaceholder />
      ) : (
        <div className="content-appear flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <p
              className="text-lg sm:text-xl font-bold leading-tight"
              style={{ color: unavailable ? '#e2e8f0' : (severityColor || '#f8fafc') }}
            >
              {liveStatus.statusHeadline}
            </p>

            {brief && (
              <p className="mt-2 text-sm sm:text-[15px] text-slate-300 leading-relaxed max-w-3xl">
                {brief}
              </p>
            )}

            {liveStatus.monitoringNote && !liveStatus.hasActiveAlerts && (
              <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-3xl">
                {liveStatus.monitoringNote}
              </p>
            )}

            {changeSummary && (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-3xl">
                <span className="text-slate-400 font-medium">What&apos;s changed: </span>
                {changeSummary}
              </p>
            )}

            {statesToShow.length > 0 && liveStatus.hasActiveAlerts && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Affected States
                </p>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {statesToShow.map((state, i) => {
                    const accessible = short
                      ? `${state.name} ${short} alerts`
                      : `${state.name} weather alerts`;
                    return (
                      <span key={state.code}>
                        {i > 0 && <span className="text-slate-600"> · </span>}
                        {state.href ? (
                          <Link
                            to={state.href}
                            onClick={() => onStateClick?.(state)}
                            className="text-sky-400 hover:text-sky-300 hover:underline"
                            aria-label={accessible}
                          >
                            {state.name}
                            {typeof state.alertCount === 'number' && (
                              <span className="text-slate-500"> ({state.alertCount})</span>
                            )}
                          </Link>
                        ) : (
                          <span>
                            {state.name}
                            {typeof state.alertCount === 'number' && (
                              <span className="text-slate-500"> ({state.alertCount})</span>
                            )}
                          </span>
                        )}
                      </span>
                    );
                  })}
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
                        {compactStates.remainingCount} more
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
          </div>

          {liveStatus.hasActiveAlerts && (
            <div className="shrink-0 sm:pt-1">
              <a
                href="#current-alerts"
                onClick={(e) => {
                  e.preventDefault();
                  onAlertsClick?.();
                  document.getElementById('current-alerts')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/70 text-slate-100 border border-slate-600 hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                {ctaLabel}
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
