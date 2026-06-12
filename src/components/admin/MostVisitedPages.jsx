function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

const RANGE_COLUMN = {
  today: 'viewsToday',
  '7d': 'views7d',
  '30d': 'views30d',
  all: 'views30d',
  yesterday: 'viewsToday',
};

export default function MostVisitedPages({ data, dateRange = '7d' }) {
  const pages = data?.pages ?? [];
  const highlightCol = RANGE_COLUMN[dateRange] || 'views7d';

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 sm:p-5">
      <h3 className="text-lg font-bold text-white mb-1">Most Visited Pages</h3>
      <p className="text-sm text-slate-400 mb-4">
        Page views from product_events — Today, 7d, and 30d columns always shown.
      </p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-2 pr-4 font-medium">Page</th>
              <th
                className={`py-2 pr-4 font-medium tabular-nums ${
                  highlightCol === 'viewsToday' ? 'text-sky-300' : ''
                }`}
              >
                Today
              </th>
              <th
                className={`py-2 pr-4 font-medium tabular-nums ${
                  highlightCol === 'views7d' ? 'text-sky-300' : ''
                }`}
              >
                7d
              </th>
              <th
                className={`py-2 pr-4 font-medium tabular-nums ${
                  highlightCol === 'views30d' ? 'text-sky-300' : ''
                }`}
              >
                30d
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {pages.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-5 text-center text-slate-500">
                  No page views in the last 30 days.
                </td>
              </tr>
            ) : (
              pages.map((row) => (
                <tr
                  key={`${row.eventName}-${row.stateCode || ''}`}
                  className="border-b border-slate-800/80"
                >
                  <td className="py-2 pr-4">{row.page}</td>
                  <td
                    className={`py-2 pr-4 tabular-nums ${
                      highlightCol === 'viewsToday' ? 'text-sky-200 font-medium' : ''
                    }`}
                  >
                    {formatNumber(row.viewsToday)}
                  </td>
                  <td
                    className={`py-2 pr-4 tabular-nums ${
                      highlightCol === 'views7d' ? 'text-sky-200 font-medium' : ''
                    }`}
                  >
                    {formatNumber(row.views7d)}
                  </td>
                  <td
                    className={`py-2 pr-4 tabular-nums ${
                      highlightCol === 'views30d' ? 'text-sky-200 font-medium' : ''
                    }`}
                  >
                    {formatNumber(row.views30d)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
