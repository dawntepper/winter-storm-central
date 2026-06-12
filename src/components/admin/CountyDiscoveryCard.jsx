import AdminFunnel from './AdminFunnel';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  return `${n}%`;
}

const CONCLUSION_STYLES = {
  not_attempting: {
    border: 'border-amber-700/40',
    bg: 'bg-amber-950/25',
    label: 'text-amber-400',
    text: 'text-amber-100',
    badge: 'Not attempting',
  },
  abandoning: {
    border: 'border-rose-700/40',
    bg: 'bg-rose-950/25',
    label: 'text-rose-400',
    text: 'text-rose-100',
    badge: 'Abandoning',
  },
  healthy: {
    border: 'border-emerald-700/40',
    bg: 'bg-emerald-950/25',
    label: 'text-emerald-400',
    text: 'text-emerald-100',
    badge: 'Healthy funnel',
  },
  insufficient_data: {
    border: 'border-slate-700',
    bg: 'bg-slate-900/50',
    label: 'text-slate-400',
    text: 'text-slate-300',
    badge: 'Insufficient data',
  },
};

export default function CountyDiscoveryCard({ data }) {
  const metrics = data?.metrics ?? {};
  const funnel = data?.funnel ?? [];
  const conclusion = data?.conclusion ?? {};
  const style = CONCLUSION_STYLES[conclusion.code] ?? CONCLUSION_STYLES.insufficient_data;

  const statRows = [
    { label: 'State page views', value: metrics.statePageViews },
    { label: 'County search attempts', value: metrics.countySearchAttempts },
    { label: 'County page views', value: metrics.countyPageViews },
    { label: 'County alert views', value: metrics.countyAlertViews },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-1">County Discovery Analysis</h3>
        <p className="text-sm text-slate-400">
          Funnel from state pages through county search to county alert views — helps distinguish
          preference (cities over counties) from discovery friction.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {statRows.map((row) => (
          <div
            key={row.label}
            className="bg-slate-800/50 border border-slate-700 rounded-lg p-3"
          >
            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 leading-tight">
              {row.label}
            </div>
            <div className="text-lg font-bold text-white tabular-nums">
              {formatNumber(row.value)}
            </div>
          </div>
        ))}
      </div>

      {(conclusion.searchRatePct != null || conclusion.pageReachPct != null) && (
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-slate-400">
          {conclusion.searchRatePct != null && (
            <span>
              County search rate:{' '}
              <span className="text-slate-200 font-medium tabular-nums">
                {formatPct(conclusion.searchRatePct)}
              </span>{' '}
              of state page views
            </span>
          )}
          {conclusion.pageReachPct != null && (
            <span>
              Page reach:{' '}
              <span className="text-slate-200 font-medium tabular-nums">
                {formatPct(conclusion.pageReachPct)}
              </span>{' '}
              of county searches
            </span>
          )}
        </div>
      )}

      <h4 className="text-sm font-semibold text-slate-300 mb-2">Discovery funnel</h4>
      <AdminFunnel
        stepStats={funnel}
        formatEventName={(name) => name}
        emptyMessage="No county discovery data in this period."
        compact
      />

      {conclusion.blurb && (
        <div className={`mt-5 rounded-lg border px-4 py-3 ${style.border} ${style.bg}`}>
          <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${style.label}`}>
            Conclusion — {style.badge}
            {conclusion.generatedBy && conclusion.generatedBy !== 'rule-based' && (
              <span className="ml-2 font-normal normal-case opacity-80">
                via {conclusion.generatedBy}
              </span>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${style.text}`}>{conclusion.blurb}</p>
        </div>
      )}
    </div>
  );
}
