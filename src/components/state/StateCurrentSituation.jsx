import { Link } from 'react-router-dom';
import { trackStateHazardClicked, trackStateCurrentAlertsAnchorClicked } from '../../utils/analytics';

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

/**
 * Whether optional cached/manual analysis adds context beyond the deterministic summary.
 * Reserved for future state weather briefs — no AI on page load today.
 */
function getUsefulAnalysis(weatherBrief, situationSummary) {
  if (!weatherBrief?.summary) return null;
  if (weatherBrief.source === 'fallback') return null;

  const analysis = weatherBrief.summary.trim();
  if (!analysis) return null;

  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm(analysis) === norm(situationSummary || '')) return null;

  if (analysis.split(/\s+/).length < 12) return null;

  return {
    summary: analysis,
    notableChange: weatherBrief.notableChange?.trim() || null,
  };
}

function HazardFilterPill({
  hazard,
  selected,
  onClick,
  stateName,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
        selected
          ? 'text-white shadow-sm ring-1'
          : 'bg-slate-700/40 text-slate-400 border-slate-600 hover:bg-slate-700/60 hover:text-slate-300',
      ].join(' ')}
      style={selected ? {
        borderColor: hazard.color,
        backgroundColor: `${hazard.color}40`,
        boxShadow: `0 0 0 1px ${hazard.color}99`,
      } : undefined}
      aria-pressed={selected}
      aria-label={
        selected
          ? `Show all ${stateName} weather alerts`
          : `Filter ${stateName} map and alerts by ${hazard.label}`
      }
    >
      <span aria-hidden="true" className={selected ? undefined : 'opacity-70'}>{hazard.icon}</span>
      <span>{hazard.label}</span>
      <span className={selected ? 'text-white/80' : 'text-slate-500'}>
        {hazard.activeCount}
      </span>
    </button>
  );
}

/**
 * State page Current Situation — answers "what is happening in this state right now?"
 *
 * Active Hazard pills are the page-level filter source of truth: they control
 * StormMap markers and the Current Alerts list. Counts always reflect totals
 * for the state (not the post-filter remainder).
 *
 * Desktop (lg+): compact status card — one-hazard states hide redundant All/filter
 * chrome; multi-hazard keeps filters; CTA sits on the hazard row.
 * Mobile: preserves filter pills + All control; alerts CTA stays hidden.
 */
export default function StateCurrentSituation({
  stateIntel,
  selectedCategory,
  allCategoriesSelected = true,
  onSelectCategory,
  onAlertsClick,
}) {
  if (!stateIntel?.liveStatus) return null;

  const {
    liveStatus,
    hazards = [],
    freshness,
    weatherBrief,
    activeCount = 0,
    stateCode,
    stateName,
  } = stateIntel;

  const situationSummary = liveStatus.situationSummary;
  const analysis = getUsefulAnalysis(weatherBrief, situationSummary);
  const updatedIso = freshness?.latestSourceUpdateAt || stateIntel.updatedAt;
  const relative = formatRelativeTime(updatedIso);
  const unavailable = freshness?.dataAvailable === false;
  const primaryColor = hazards[0]?.color || '#f59e0b';
  const isSingleHazard = hazards.length === 1;
  const hasHazards = hazards.length > 0;

  const handleHazardClick = (hazard) => {
    trackStateHazardClicked({
      stateCode,
      hazardSlug: hazard.slug,
      sourceSection: 'current_situation',
    });
    const next = selectedCategory === hazard.id ? null : hazard.id;
    onSelectCategory?.(next);
  };

  const alertsCta = hasHazards && liveStatus.hasActiveAlerts ? (
    <a
      href="#current-alerts"
      onClick={(e) => {
        e.preventDefault();
        trackStateCurrentAlertsAnchorClicked({
          stateCode,
          sourceSection: 'current_situation',
        });
        onAlertsClick?.();
        document.getElementById('current-alerts')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }}
      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/70 text-slate-100 border border-slate-600 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
    >
      View Alerts ↓
    </a>
  ) : null;

  // National page links only for launched hazard landings (heat/fire
  // configs exist but launch:false until those pages ship).
  // Default: first (or only) pill's page when All is selected.
  // Filtered: selected pill's page when it has one.
  let linkHazard = null;
  if (selectedCategory) {
    linkHazard = hazards.find((h) => h.id === selectedCategory && h.href) || null;
  } else if (hazards.length === 1 && hazards[0].href) {
    linkHazard = hazards[0];
  } else if (hazards[0]?.href) {
    linkHazard = hazards[0];
  }

  const allControl = (
    <button
      type="button"
      onClick={() => onSelectCategory?.(null)}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
        allCategoriesSelected
          ? 'bg-sky-600/90 border-sky-400 text-white shadow-sm shadow-sky-900/40 ring-1 ring-sky-400/50'
          : 'bg-slate-800/80 border-slate-600 text-slate-300 hover:border-slate-500',
      ].join(' ')}
      aria-pressed={allCategoriesSelected}
      aria-label={`Show all ${activeCount} ${stateName} weather alerts on the map and list`}
    >
      All {activeCount}
    </button>
  );

  const multiHazardPills = hazards.map((hazard) => (
    <HazardFilterPill
      key={hazard.id}
      hazard={hazard}
      selected={selectedCategory === hazard.id}
      onClick={() => handleHazardClick(hazard)}
      stateName={stateName}
    />
  ));

  const singleHazardInfo = isSingleHazard ? (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-slate-800/80 text-slate-200"
      style={{ borderColor: hazards[0].color }}
    >
      <span aria-hidden="true">{hazards[0].icon}</span>
      <span>{hazards[0].label}</span>
      <span className="text-slate-400">{hazards[0].activeCount}</span>
    </span>
  ) : null;

  return (
    <section
      aria-labelledby="state-current-situation-heading"
      className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5 lg:px-4 lg:py-2.5"
      style={{ borderLeftWidth: 4, borderLeftColor: unavailable ? '#64748b' : primaryColor }}
    >
      {/* Mobile: label + timestamp split. Desktop: CURRENT SITUATION · Updated … */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-1 lg:justify-start lg:gap-x-0">
        <h2
          id="state-current-situation-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          Current Situation
          {relative && (
            <span className="hidden lg:inline font-normal normal-case tracking-normal text-slate-500">
              <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
              {unavailable ? 'Last successful refresh' : 'Updated'}{' '}
              <time dateTime={updatedIso}>{relative}</time>
            </span>
          )}
        </h2>
        {relative && (
          <p className="text-[11px] text-slate-500 lg:hidden">
            {unavailable ? 'Last successful refresh' : 'Updated'}{' '}
            <time dateTime={updatedIso}>{relative}</time>
          </p>
        )}
      </div>

      <p
        className="text-base lg:text-[17px] font-bold leading-snug"
        style={{ color: unavailable ? '#e2e8f0' : primaryColor }}
      >
        {liveStatus.statusHeadline}
      </p>

      <p className="mt-1 lg:mt-0.5 text-sm text-slate-300 leading-snug max-w-3xl">
        {situationSummary}
      </p>

      {liveStatus.monitoringNote && !liveStatus.hasActiveAlerts && (
        <p className="mt-1 lg:mt-0.5 text-sm text-slate-400 leading-snug max-w-3xl">
          {liveStatus.monitoringNote}
        </p>
      )}

      {analysis && (
        <p className="mt-1.5 lg:mt-1 text-sm text-slate-400 leading-snug max-w-3xl">
          {analysis.summary}
        </p>
      )}

      {analysis?.notableChange && (
        <p className="mt-1 text-sm text-slate-500 leading-snug max-w-3xl">
          <span className="text-slate-400 font-medium">What&apos;s changed: </span>
          {analysis.notableChange}
        </p>
      )}

      {hasHazards && (
        <div className="mt-2 lg:mt-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 lg:mb-1">
            <span className="lg:hidden">Active Hazards</span>
            <span className="hidden lg:inline">
              {isSingleHazard ? 'Active Hazard' : 'Active Hazards'}
            </span>
          </p>

          {/* Mobile — keep All + filter pills (unchanged behavior) */}
          <div className="flex flex-wrap gap-1.5 lg:hidden">
            {allControl}
            {multiHazardPills}
          </div>

          {/* Desktop — one hazard: info pill; multi: filters; CTA on same row */}
          <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-3 lg:gap-y-1.5">
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {isSingleHazard ? (
                singleHazardInfo
              ) : (
                <>
                  {allControl}
                  {multiHazardPills}
                </>
              )}
            </div>
            {alertsCta}
          </div>

          {linkHazard?.href && (
            <p className="mt-1.5 lg:mt-1 text-xs text-slate-500">
              National page:{' '}
              <Link
                to={linkHazard.href}
                className="text-sky-400 hover:underline"
                onClick={() =>
                  trackStateHazardClicked({
                    stateCode,
                    hazardSlug: linkHazard.hazardPageSlug || linkHazard.slug,
                    sourceSection: 'current_situation_hazard_page',
                  })
                }
              >
                {linkHazard.hazardPageLabel || linkHazard.label}
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
