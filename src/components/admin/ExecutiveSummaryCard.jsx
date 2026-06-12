import TrendIndicator from './TrendIndicator';

const TREND_KEYS = {
  sessions: 'totalSessions',
  visitors: 'uniqueVisitors',
  'returning-pct': 'returningPct',
  'search-success': 'searchSuccessRate',
  'radar-opens': 'radarOpens',
};

export default function ExecutiveSummaryCard({ summary, metricTrends }) {
  const metrics = summary?.metrics ?? [];

  if (metrics.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-sky-950/50 to-slate-800 border border-sky-700/40 rounded-xl p-4 sm:p-5">
      <h2 className="text-lg font-bold text-white mb-1">Executive Summary</h2>
      <p className="text-sm text-slate-400 mb-3">
        Six key metrics for the selected period with trend vs the prior equivalent period.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {metrics.map((item) => {
          const trendKey = TREND_KEYS[item.id];
          const trend = item.trend ?? (trendKey ? metricTrends?.[trendKey] : null);
          const sentiment = item.id === 'search-success' ? 'positive' : 'positive';

          return (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-700/80 rounded-lg p-2.5"
            >
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">
                {item.label}
              </div>
              <div className="text-base font-bold text-white leading-tight">{item.value}</div>
              {trend && (
                <div className="mt-0.5">
                  <TrendIndicator trend={trend} compact sentiment={sentiment} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
