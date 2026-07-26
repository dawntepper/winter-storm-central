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

function normalizeText(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Optional cached/manual analysis that adds context beyond the deterministic brief.
 * Fallback briefs and near-duplicates of Layer 1 are skipped.
 * "What's changed" is never taken from AI — only deterministic changeSummary.
 */
function getUsefulAnalysis(weatherBrief, brief) {
  if (!weatherBrief?.summary) return null;
  if (weatherBrief.source === 'fallback') return null;

  const analysis = weatherBrief.summary.trim();
  if (!analysis) return null;

  if (normalizeText(analysis) === normalizeText(brief || '')) return null;

  // Reject thin restatements
  const words = analysis.split(/\s+/).length;
  if (words < 12) return null;

  // Reject if it mostly restates "N warnings across M states" without new facts
  const briefNorm = normalizeText(brief);
  const overlap = briefNorm
    .split(/\W+/)
    .filter((w) => w.length > 4 && normalizeText(analysis).includes(w));
  if (overlap.length >= 12 && words < 40) return null;

  return { summary: analysis };
}

/**
 * CurrentSituation — concise live briefing:
 * headline · brief · what's changed (deterministic) · affected states
 */
export default function CurrentSituation({
  hazard,
  onAlertsClick,
  onStateClick,
  onExpandStates,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!hazard?.liveStatus) return null;

  const {
    liveStatus,
    affectedStates = [],
    severityColor,
    freshness,
    weatherBrief,
    activeCount = 0,
    shortLabel,
  } = hazard;

  const brief = liveStatus.brief || liveStatus.situationSummary || liveStatus.statusSentence;
  const analysis = getUsefulAnalysis(weatherBrief, brief);
  // Only deterministic change copy, and only when a prior snapshot existed
  const changeSummary = liveStatus.changeSummary || null;

  const compactStates = liveStatus.affectedStatesCompact || {};
  const showExpand = (compactStates.remainingCount || 0) > 0;
  const compactCount = compactStates.compactNames?.length || 4;
  const statesToShow = expanded
    ? affectedStates
    : affectedStates.slice(0, Math.max(compactCount, 1));

  const updatedIso = freshness?.latestSourceUpdateAt || hazard.updatedAt;
  const relative = formatRelativeTime(updatedIso);
  const unavailable = freshness?.dataAvailable === false;
  const short = (shortLabel || '').toLowerCase();

  const ctaLabel = activeCount === 1
    ? 'View Detailed Warning ↓'
    : 'View Detailed Warnings ↓';

  return (
    <section
      aria-labelledby="current-situation-heading"
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
        {relative && (
          <p className="text-xs text-slate-500">
            {unavailable ? 'Last successful refresh' : 'Updated'}{' '}
            <time dateTime={updatedIso}>{relative}</time>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p
            className="text-lg sm:text-xl font-bold leading-tight"
            style={{ color: unavailable ? '#e2e8f0' : (severityColor || '#f8fafc') }}
          >
            {liveStatus.statusHeadline}
          </p>

          <p className="mt-2 text-sm sm:text-[15px] text-slate-300 leading-relaxed max-w-3xl">
            {brief}
          </p>

          {liveStatus.monitoringNote && !liveStatus.hasActiveAlerts && (
            <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-3xl">
              {liveStatus.monitoringNote}
            </p>
          )}

          {analysis && (
            <p className="mt-2.5 text-sm sm:text-[15px] text-slate-400 leading-relaxed max-w-3xl">
              {analysis.summary}
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
    </section>
  );
}
