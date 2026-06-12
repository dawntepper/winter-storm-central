function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export default function CountyAlertOpportunities({ data }) {
  const opportunities = data?.opportunities ?? [];

  return (
    <div className="bg-slate-900/60 border border-amber-700/30 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">County Alert Opportunities</h3>
          <p className="text-sm text-slate-400">
            States with high alert page traffic but low county search and county page engagement.
          </p>
        </div>
        {opportunities.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 bg-amber-950/40 px-2 py-1 rounded">
            {opportunities.length} states flagged
          </span>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-slate-500">
          No county engagement gaps detected — state and county traffic look balanced for this period.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium tabular-nums">State views</th>
                <th className="py-2 pr-4 font-medium tabular-nums">County searches</th>
                <th className="py-2 pr-4 font-medium tabular-nums">County views</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Gap %</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Score</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {opportunities.map((row) => (
                <tr key={row.stateCode} className="border-b border-slate-800/80">
                  <td className="py-2 pr-4 font-medium text-white">{row.stateCode}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(row.statePageViews)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(row.countySearches)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatNumber(row.countyPageViews)}</td>
                  <td className="py-2 pr-4 tabular-nums text-amber-300">
                    {row.countyEngagementGap}%
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    <span className="inline-flex items-center justify-center min-w-[2.5rem] px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-700/40 text-amber-200 font-semibold text-xs">
                      {row.opportunityScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
