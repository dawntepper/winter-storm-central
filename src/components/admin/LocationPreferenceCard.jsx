import AdminBarChart from './AdminBarChart';
import AdminChartToggle from './AdminChartToggle';
import TrendIndicator from './TrendIndicator';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  return `${n}%`;
}

export default function LocationPreferenceCard({ data, viewMode, onViewModeChange }) {
  const sources = data?.sources ?? [];
  const total = data?.total ?? 0;
  const insight = data?.insight;

  const chartData = sources.map((row) => ({
    source: row.label,
    count: row.count,
  }));

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Location Preference</h3>
          <p className="text-sm text-slate-400">
            How users choose locations — successful events from location_search_events by resolved type.
          </p>
        </div>
        <AdminChartToggle value={viewMode} onChange={onViewModeChange} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            Total interactions
          </div>
          <div className="text-xl font-bold text-white tabular-nums">
            {formatNumber(total)}
          </div>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <AdminBarChart
          data={chartData}
          dataKey="count"
          nameKey="source"
          compact
          emptyMessage="No location preference data in this period."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Count</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Share</th>
                <th className="py-2 pr-4 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                    No location preference data in this period.
                  </td>
                </tr>
              ) : (
                sources.map((row) => (
                  <tr key={row.key} className="border-b border-slate-800/80">
                    <td className="py-2 pr-4">{row.label}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatNumber(row.count)}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatPct(row.pct)}</td>
                    <td className="py-2 pr-4">
                      <TrendIndicator trend={row.trend} compact />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'visual' && sources.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {sources.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"
            >
              <span className="text-slate-300">{row.label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {formatNumber(row.count)} ({formatPct(row.pct)})
                <TrendIndicator trend={row.trend} compact />
              </span>
            </div>
          ))}
        </div>
      )}

      {insight?.blurb && (
        <div className="mt-5 rounded-lg border border-sky-700/40 bg-sky-950/25 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-sky-400 mb-1">
            Insight
            {insight.generatedBy && insight.generatedBy !== 'rule-based' && (
              <span className="ml-2 font-normal normal-case text-sky-500/80">
                via {insight.generatedBy}
              </span>
            )}
          </div>
          <p className="text-sm text-sky-100 leading-relaxed">{insight.blurb}</p>
        </div>
      )}
    </div>
  );
}
