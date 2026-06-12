import { useState } from 'react';
import AdminBarChart from './AdminBarChart';
import AdminChartToggle from './AdminChartToggle';
import TrendIndicator from './TrendIndicator';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

const RANGE_VIEWS = {
  today: 'viewsToday',
  yesterday: 'viewsToday',
  '7d': 'views7d',
  '30d': 'views30d',
  all: 'views30d',
};

export default function MostVisitedPages({ data, dateRange = '7d' }) {
  const [viewMode, setViewMode] = useState('table');
  const pages = data?.pages ?? [];
  const viewsKey = RANGE_VIEWS[dateRange] || 'views7d';

  const chartData = pages.slice(0, 10).map((row) => ({
    label: row.page,
    view_count: row[viewsKey] ?? 0,
  }));

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Most Visited Pages</h3>
          <p className="text-sm text-slate-400">
            Page views from product_events with period-over-period trend.
          </p>
        </div>
        <AdminChartToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'visual' ? (
        <AdminBarChart
          data={chartData}
          dataKey="view_count"
          nameKey="label"
          maxItems={10}
          compact
          emptyMessage="No page views in this period."
        />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-4 font-medium">Page</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Views</th>
                <th className="py-2 pr-4 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-5 text-center text-slate-500">
                    No page views in this period.
                  </td>
                </tr>
              ) : (
                pages.map((row) => (
                  <tr
                    key={`${row.eventName}-${row.stateCode || ''}`}
                    className="border-b border-slate-800/80"
                  >
                    <td className="py-2 pr-4">{row.page}</td>
                    <td className="py-2 pr-4 tabular-nums font-medium">
                      {formatNumber(row[viewsKey])}
                    </td>
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
    </div>
  );
}
