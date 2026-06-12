import TrendIndicator from './TrendIndicator';

function formatTrendId(metricId) {
  const map = {
    'radar-opens': 'radarOpens',
    'returning-visitors': 'returningVisitors',
    'search-success': 'locationSearches',
  };
  return map[metricId] || null;
}

export default function ExecutiveSummaryCard({ summary, metricTrends }) {
  const metrics = summary?.metrics ?? [];
  const aiSummaries = summary?.aiSummaries ?? [];

  if (metrics.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-sky-950/50 to-slate-800 border border-sky-700/40 rounded-xl p-4 sm:p-5">
      <h2 className="text-lg font-bold text-white mb-1">Executive Summary</h2>
      <p className="text-sm text-slate-400 mb-4">
        Key metrics for the selected period — what happened, what&apos;s growing, and what needs attention.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {metrics.map((item) => {
          const trendKey = formatTrendId(item.id);
          const trend = item.trend ?? (trendKey ? metricTrends?.[trendKey] : null);
          const isRisk = item.id === 'biggest-risk';
          const isOpp = item.id === 'biggest-opportunity';

          return (
            <div
              key={item.id}
              className={`bg-slate-900/70 border rounded-lg p-3 ${
                isRisk
                  ? 'border-rose-700/50'
                  : isOpp
                    ? 'border-amber-700/50'
                    : 'border-slate-700/80'
              }`}
            >
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
                {item.label}
              </div>
              <div className="text-lg font-bold text-white leading-tight">{item.value}</div>
              {trend && (
                <div className="mt-0.5">
                  <TrendIndicator trend={trend} compact />
                </div>
              )}
              {item.detail && (
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.detail}</div>
              )}
            </div>
          );
        })}
      </div>
      {aiSummaries.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700/60">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Recommended focus
          </h3>
          <ul className="space-y-1.5">
            {aiSummaries.map((item, i) => (
              <li key={i} className="text-sm text-slate-300 flex gap-2">
                {item.priority && (
                  <span
                    className={`shrink-0 text-[10px] uppercase font-semibold ${
                      item.priority === 'high'
                        ? 'text-rose-400'
                        : item.priority === 'medium'
                          ? 'text-amber-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {item.priority}
                  </span>
                )}
                <span>
                  <span className="font-medium text-white">{item.title}</span>
                  {item.text && <span className="text-slate-400"> — {item.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
