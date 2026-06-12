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

const FUNNEL_LABELS = {
  alerts_to_save: 'Homepage → State Alerts → Location Change → Radar → Save Location',
  radar_to_forecast: 'Homepage → Radar → Location Change → Forecast',
  county_to_radar: 'State Alerts → County Search → County Alert → Radar',
};

function formatEventName(name) {
  if (!name) return '—';
  return String(name).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function FunnelCard({ id, funnel }) {
  const stepStats = Array.isArray(funnel?.stepStats)
    ? funnel.stepStats
    : funnel?.stepStats
      ? Object.values(funnel.stepStats)
      : [];

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-1">
        {FUNNEL_LABELS[id] || id}
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Overall completion: {formatPct(funnel?.overallCompletionPct)}
      </p>
      <DataTable
        columns={[
          { key: 'step', label: 'Step', render: (r) => r.step },
          {
            key: 'eventName',
            label: 'Event',
            render: (r) => formatEventName(r.eventName),
          },
          {
            key: 'sessions',
            label: 'Sessions',
            render: (r) => formatNumber(r.sessions),
          },
          {
            key: 'completionPct',
            label: 'Step completion',
            render: (r) => formatPct(r.completionPct),
          },
          {
            key: 'dropoffPct',
            label: 'Drop-off',
            render: (r) => formatPct(r.dropoffPct),
          },
        ]}
        rows={stepStats}
        emptyMessage="No funnel data in this period."
      />
    </div>
  );
}

const LOCATION_SOURCE_ROWS = [
  { key: 'useMyLocation', label: 'Use My Location (GPS)' },
  { key: 'citySearch', label: 'City Search' },
  { key: 'countySearch', label: 'County Search' },
  { key: 'zipSearch', label: 'ZIP Search' },
  { key: 'savedLocationTap', label: 'Saved Location Tap' },
];

function LocationSourcesCard({ sources }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      {LOCATION_SOURCE_ROWS.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-4 py-2 border-b border-slate-800/80 last:border-0"
        >
          <span className="text-sm text-slate-200">{row.label}</span>
          <span className="text-sm font-semibold text-white tabular-nums">
            {formatNumber(sources?.[row.key] ?? 0)}
          </span>
        </div>
      ))}
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
  const locationSources = data?.locationSources;
  const sl = data?.savedLocations;
  const radar = data?.radar;
  const journeys = data?.userJourneys;

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

            {/* 3b. Location Sources */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Location Sources</h2>
              <p className="text-sm text-slate-400 mb-5">
                How users change location — successful events from location_search_events by resolved type.
              </p>
              <LocationSourcesCard sources={locationSources} />
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

            {/* 6. Radar Engagement */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">Radar Engagement</h2>
              <p className="text-sm text-slate-400 mb-5">
                Radar opens, types, and location views from radar_events.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total radar opens" value={formatNumber(radar?.totalOpens)} />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Opens by state</h3>
              <DataTable
                columns={[
                  {
                    key: 'state_code',
                    label: 'State',
                    render: (r) => {
                      const code = r.state_code;
                      if (!code || code === 'unknown' || code === 'US') return 'National';
                      return code;
                    },
                  },
                  {
                    key: 'open_count',
                    label: 'Opens',
                    render: (r) => formatNumber(r.open_count),
                  },
                ]}
                rows={radar?.opensByState || []}
                emptyMessage="No radar opens in this period."
              />
              <h3 className="text-sm font-semibold text-slate-300 mb-3 mt-6">Most used radar types</h3>
              <DataTable
                columns={[
                  { key: 'radar_type', label: 'Type' },
                  {
                    key: 'event_count',
                    label: 'Events',
                    render: (r) => formatNumber(r.event_count),
                  },
                ]}
                rows={radar?.topRadarTypes || []}
                emptyMessage="No radar type changes in this period."
              />
              <h3 className="text-sm font-semibold text-slate-300 mb-3 mt-6">Most viewed radar locations</h3>
              <DataTable
                columns={[
                  {
                    key: 'state_code',
                    label: 'State',
                    render: (r) => {
                      const code = r.state_code;
                      if (!code || code === 'unknown' || code === 'US') return 'National';
                      return code;
                    },
                  },
                  {
                    key: 'view_count',
                    label: 'Location changes',
                    render: (r) => formatNumber(r.view_count),
                  },
                ]}
                rows={radar?.topLocations || []}
                emptyMessage="No radar location changes in this period."
              />
            </section>

            {/* 7. User Journeys */}
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h2 className="text-xl font-bold text-white mb-1">User Journeys</h2>
              <p className="text-sm text-slate-400 mb-5">
                Sequential funnels and top paths from product_events.
              </p>
              <div className="space-y-6 mb-8">
                {Object.entries(journeys?.funnels || {}).map(([id, funnel]) => (
                  <FunnelCard key={id} id={id} funnel={funnel} />
                ))}
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Top paths</h3>
              <DataTable
                columns={[
                  {
                    key: 'path',
                    label: 'Path',
                    render: (r) => (
                      <span className="text-xs leading-relaxed">
                        {(r.path || '').split(' → ').map(formatEventName).join(' → ')}
                      </span>
                    ),
                  },
                  {
                    key: 'session_count',
                    label: 'Sessions',
                    render: (r) => formatNumber(r.session_count),
                  },
                ]}
                rows={journeys?.topPaths || []}
                emptyMessage="No journey paths in this period."
              />
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
