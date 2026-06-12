function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function SuggestionBadge({ text }) {
  return (
    <span className="inline-block text-[10px] uppercase tracking-wide font-semibold text-sky-300 bg-sky-950/50 border border-sky-700/40 px-1.5 py-0.5 rounded">
      {text}
    </span>
  );
}

export default function ExpansionOpportunities({ data }) {
  if (!data) return null;

  const hasFailed = (data.failedSearches?.length ?? 0) > 0;
  const hasCities = (data.topCities?.length ?? 0) > 0;
  const hasCityDemand = (data.cityDemand?.length ?? 0) > 0;

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Expansion Opportunities</h3>
          <p className="text-sm text-slate-400">
            Failed searches, city demand signals, county gaps, and catalog expansion from user behavior.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-slate-300">
            <span className="text-slate-500">Failed:</span>{' '}
            <span className="font-semibold text-amber-300 tabular-nums">
              {formatNumber(data.totalFailed)}
            </span>
          </span>
          <span className="text-slate-300">
            <span className="text-slate-500">City demand:</span>{' '}
            <span className="font-semibold tabular-nums">{formatNumber(data.totalCityDemandRows)}</span>
          </span>
          <span className="text-slate-300">
            <span className="text-slate-500">City searches:</span>{' '}
            <span className="font-semibold tabular-nums">{formatNumber(data.citySearchCount)}</span>
          </span>
          <span className="text-slate-300">
            <span className="text-slate-500">County views:</span>{' '}
            <span className="font-semibold tabular-nums">{formatNumber(data.totalCountyViews)}</span>
          </span>
        </div>
      </div>

      {hasCityDemand && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Most requested cities (city_demand)</h4>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 pr-4 font-medium">Searches</th>
                  <th className="py-2 pr-4 font-medium">Saves</th>
                  <th className="py-2 pr-4 font-medium">Catalog</th>
                  <th className="py-2 pr-4 font-medium">Static page</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {data.cityDemand.slice(0, 10).map((row) => (
                  <tr key={`${row.cityName}-${row.stateCode}`} className="border-b border-slate-800/80">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatNumber(row.searchCount)}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatNumber(row.saveCount)}</td>
                    <td className="py-2 pr-4">
                      {row.inCatalog ? (
                        <span className="text-emerald-400">{row.citySource}</span>
                      ) : (
                        <span className="text-amber-300">missing</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {row.hasStaticPage ? 'yes' : 'no'}
                    </td>
                    <td className="py-2 pr-4">
                      <SuggestionBadge
                        text={row.promotable ? 'Promote candidate' : row.suggestion}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasCities && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Top cities to add</h4>
          <div className="space-y-2">
            {data.topCities.map((city) => (
              <div
                key={`${city.query}-${city.state}`}
                className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{city.label}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatNumber(city.searchCount)} searches
                  </span>
                </div>
                <SuggestionBadge text={city.suggestion} />
              </div>
            ))}
          </div>
        </div>
      )}

      {hasFailed && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Failed searches</h4>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-2 pr-4 font-medium">Query</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Count</th>
                  <th className="py-2 pr-4 font-medium">Suggestion</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {data.failedSearches.slice(0, 8).map((row) => (
                  <tr key={`${row.query}-${row.state}`} className="border-b border-slate-800/80">
                    <td className="py-2 pr-4">{row.query}</td>
                    <td className="py-2 pr-4">{row.state || '—'}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatNumber(row.searchCount)}</td>
                    <td className="py-2 pr-4">
                      <SuggestionBadge text={row.suggestion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data.lowTrafficCounties?.length ?? 0) > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Low-traffic counties</h4>
          <div className="flex flex-wrap gap-2">
            {data.lowTrafficCounties.map((row) => (
              <span
                key={`${row.county}-${row.state}`}
                className="inline-flex items-center gap-1.5 text-sm bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg"
              >
                {row.county}, {row.state}
                <span className="text-slate-500 text-xs">({formatNumber(row.views)} views)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasFailed && !hasCities && !hasCityDemand && (data.lowTrafficCounties?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">No expansion signals in this period.</p>
      )}
    </div>
  );
}
