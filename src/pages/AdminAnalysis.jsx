import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminGate from '../components/AdminGate';
import { fetchAdminAnalysis } from '../lib/adminAnalysisRepo';

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  return `${n}%`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, hint }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-slate-500">
        {message}
      </td>
    </tr>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-700">
            {columns.map((col) => (
              <th key={col.key} className="py-2 pr-4 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.length === 0 ? (
            <EmptyRow colSpan={columns.length} message={emptyMessage} />
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i} className="border-b border-slate-800/80">
                {columns.map((col) => (
                  <td key={col.key} className="py-2 pr-4 align-top">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DateRangePicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DATE_RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(range.id)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            value === range.id
              ? 'bg-sky-600 border-sky-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-sky-500/50'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

function AdminAnalysisInner() {
  const [dateRange, setDateRange] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (range) => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchAdminAnalysis(range);
      setData(result);
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(dateRange);
  }, [dateRange, load]);

  const rv = data?.returningVisitors;
  const ls = data?.locationSearch;
  const sl = data?.savedLocations;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-slate-400 hover:text-white text-sm">
              ← Admin
            </Link>
            <h1 className="text-lg font-bold text-white">Product Analysis</h1>
          </div>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            disabled={loading}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm">
            {error}
            <button
              type="button"
              onClick={() => load(dateRange)}
              className="ml-3 underline hover:text-red-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-16 text-slate-400">Loading analytics…</div>
        )}

        {data && (
          <>
            {/* 1. Returning Visitors */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Returning Visitors</h2>
              <p className="text-sm text-slate-400 mb-5">
                Session data from visitor_sessions. Date filter applies to session created_at.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard label="Total sessions" value={formatNumber(rv?.totalSessions)} />
                <StatCard label="Unique visitors" value={formatNumber(rv?.uniqueVisitors)} />
                <StatCard label="New visitors" value={formatNumber(rv?.newVisitors)} />
                <StatCard label="Returning" value={formatNumber(rv?.returningVisitors)} />
                <StatCard label="Returning %" value={formatPct(rv?.returningPct)} />
              </div>
            </section>

            {/* 2. Missing Location Searches */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Missing Location Searches</h2>
              <p className="text-sm text-slate-400 mb-4">
                Failed searches grouped by query and state — catalog gap research.
              </p>
              <DataTable
                columns={[
                  { key: 'query', label: 'Query' },
                  { key: 'state_context', label: 'State', render: (r) => r.state_context || '—' },
                  {
                    key: 'search_count',
                    label: 'Count',
                    render: (r) => formatNumber(r.search_count),
                  },
                  {
                    key: 'last_searched',
                    label: 'Last searched',
                    render: (r) => formatDate(r.last_searched),
                  },
                ]}
                rows={data.missingLocationSearches || []}
                emptyMessage="No failed location searches in this period."
              />
            </section>

            {/* 3. Location Search Performance */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Location Search Performance</h2>
              <p className="text-sm text-slate-400 mb-5">Success rate and top searched locations.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total searches" value={formatNumber(ls?.totalSearches)} />
                <StatCard label="Successful" value={formatNumber(ls?.successfulSearches)} />
                <StatCard label="Failed" value={formatNumber(ls?.failedSearches)} />
                <StatCard label="Success rate" value={formatPct(ls?.successRate)} />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Top searched locations</h3>
              <DataTable
                columns={[
                  { key: 'query', label: 'Query' },
                  { key: 'state_code', label: 'State', render: (r) => r.state_code || '—' },
                  {
                    key: 'search_count',
                    label: 'Searches',
                    render: (r) => formatNumber(r.search_count),
                  },
                ]}
                rows={ls?.topLocations || []}
                emptyMessage="No successful location searches in this period."
              />
              <h3 className="text-sm font-semibold text-slate-300 mb-3 mt-6">Most requested missing</h3>
              <DataTable
                columns={[
                  { key: 'query', label: 'Query' },
                  { key: 'state_code', label: 'State', render: (r) => r.state_code || '—' },
                  {
                    key: 'search_count',
                    label: 'Failed searches',
                    render: (r) => formatNumber(r.search_count),
                  },
                ]}
                rows={ls?.topMissing || []}
                emptyMessage="No failed location searches in this period."
              />
            </section>

            {/* 4. County Alert Views */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">County Alert Views</h2>
              <p className="text-sm text-slate-400 mb-4">
                Counties ranked by alert page views.
              </p>
              <DataTable
                columns={[
                  { key: 'county_name', label: 'County' },
                  { key: 'state_code', label: 'State' },
                  {
                    key: 'view_count',
                    label: 'Views',
                    render: (r) => formatNumber(r.view_count),
                  },
                  {
                    key: 'alert_count',
                    label: 'Max alerts',
                    render: (r) => formatNumber(r.alert_count),
                  },
                  {
                    key: 'last_viewed',
                    label: 'Last viewed',
                    render: (r) => formatDate(r.last_viewed),
                  },
                ]}
                rows={data.countyAlertViews || []}
                emptyMessage="No county alert views in this period."
              />
            </section>

            {/* 5. Saved Locations */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Saved Locations</h2>
              <p className="text-sm text-slate-400 mb-5">
                Signed-in user saves from user_locations. Anonymous localStorage saves are not in Supabase.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <StatCard label="Total saves" value={formatNumber(sl?.totalSaved)} />
                <StatCard label="Signed-in users" value={formatNumber(sl?.signedInUsers)} />
                <StatCard
                  label="Anonymous saves"
                  value="N/A"
                  hint="Not tracked in DB"
                />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Most saved locations</h3>
              <DataTable
                columns={[
                  { key: 'location_name', label: 'Location' },
                  { key: 'state', label: 'State', render: (r) => r.state || '—' },
                  {
                    key: 'save_count',
                    label: 'Saves',
                    render: (r) => formatNumber(r.save_count),
                  },
                  {
                    key: 'last_saved',
                    label: 'Last saved',
                    render: (r) => formatDate(r.last_saved),
                  },
                ]}
                rows={sl?.topLocations || []}
                emptyMessage="No saved locations in this period."
              />
            </section>

            {/* 6. Radar Engagement (placeholder) */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Radar Engagement</h2>
              <div className="bg-slate-900/60 border border-slate-700 border-dashed rounded-lg p-6 text-center">
                <div className="text-3xl mb-2">📡</div>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  {data.radar?.message ||
                    'Radar engagement is tracked via client-side analytics and is not stored in Supabase.'}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminAnalysis() {
  return (
    <AdminGate>
      <AdminAnalysisInner />
    </AdminGate>
  );
}
