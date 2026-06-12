import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminGate from '../components/AdminGate';
import AdminAnalysisNav, { ANALYSIS_SECTIONS } from '../components/admin/AdminAnalysisNav';
import AdminBarChart from '../components/admin/AdminBarChart';
import AdminChartToggle from '../components/admin/AdminChartToggle';
import AdminDualLineChart from '../components/admin/AdminDualLineChart';
import AdminFunnel from '../components/admin/AdminFunnel';
import AdminLineChart from '../components/admin/AdminLineChart';
import AdminSplitChart from '../components/admin/AdminSplitChart';
import CollapsibleAnalysisSection, {
  readSectionExpandedState,
  writeSectionExpandedState,
} from '../components/admin/CollapsibleAnalysisSection';
import MorningBriefCard from '../components/admin/MorningBriefCard';
import OperationsCenter from '../components/admin/OperationsCenter';
import ScrollToTopButton from '../components/admin/ScrollToTopButton';
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

function formatRadarState(row) {
  const code = row.state_code;
  if (!code || code === 'unknown' || code === 'US') return 'National';
  return code;
}

function SectionHeader({ title, description, viewMode, onViewModeChange, showToggle = true }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </div>
      {showToggle && (
        <AdminChartToggle value={viewMode} onChange={onViewModeChange} />
      )}
    </div>
  );
}

function SubsectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-slate-300 mb-3">{children}</h3>;
}

function formatEventName(name) {
  if (!name) return '—';
  return String(name).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const DEFAULT_VIEW_MODES = {
  returningVisitors: 'visual',
  radarEngagement: 'visual',
  locationSearch: 'table',
  savedLocations: 'table',
  userJourneys: 'table',
};

function TrendIndicator({ trend }) {
  if (!trend) return null;
  const { direction, changePct } = trend;
  if (direction === 'flat') {
    return (
      <span className="text-slate-400 text-sm">
        → Flat ({changePct >= 0 ? '+' : ''}{changePct}% vs prior period)
      </span>
    );
  }
  const isUp = direction === 'up';
  return (
    <span className={`text-sm font-medium ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isUp ? '↑' : '↓'} {isUp ? 'Up' : 'Down'} {Math.abs(changePct)}% vs prior period
    </span>
  );
}

function TopInsightsCard({ insights }) {
  if (!insights?.length) return null;
  return (
    <div className="bg-gradient-to-br from-sky-950/50 to-slate-800 border border-sky-700/40 rounded-xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white mb-1">Top Insights</h2>
      <p className="text-sm text-slate-400 mb-5">
        Key metrics from your selected date range.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/70 border border-slate-700/80 rounded-lg p-4"
          >
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
              {item.label}
            </div>
            <div className="text-xl font-bold text-white">{item.value}</div>
            {item.detail && (
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDefaultSectionState() {
  const saved = readSectionExpandedState();
  return Object.fromEntries(
    ANALYSIS_SECTIONS.map((s) => [s.id, saved[s.id] ?? true])
  );
}

function ExpandableBlock({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-900/50 hover:bg-slate-900/80 transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <span className="text-slate-500 text-xs">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function FunnelCard({ id, funnel, viewMode, isMainJourney = false }) {
  const stepStats = Array.isArray(funnel?.stepStats)
    ? funnel.stepStats
    : funnel?.stepStats
      ? Object.values(funnel.stepStats)
      : [];
  const dropOff = funnel?.biggestDropOff;

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-1">
        {FUNNEL_LABELS[id] || id}
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Overall conversion: {formatPct(funnel?.overallCompletionPct)}
        {isMainJourney && ' · Main journey path'}
      </p>
      {dropOff && dropOff.dropoffPct > 0 && (
        <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-950/30 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-rose-400 mb-1">
            Biggest Drop-Off
          </div>
          <div className="text-sm text-rose-100">
            Step {dropOff.step}: {formatEventName(dropOff.eventName)}
          </div>
          <div className="text-xs text-rose-300/80 mt-0.5">
            {formatPct(dropOff.dropoffPct)} lost
            {dropOff.sessionsLost > 0 && ` (${formatNumber(dropOff.sessionsLost)} sessions)`}
            {dropOff.fromEvent && ` after ${formatEventName(dropOff.fromEvent)}`}
          </div>
        </div>
      )}
      {viewMode === 'visual' ? (
        <AdminFunnel
          stepStats={stepStats}
          formatEventName={formatEventName}
          emptyMessage="No funnel data in this period."
        />
      ) : (
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
      )}
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
  const [viewModes, setViewModes] = useState(DEFAULT_VIEW_MODES);
  const [sectionsExpanded, setSectionsExpanded] = useState(buildDefaultSectionState);

  const setViewMode = (section, mode) => {
    setViewModes((prev) => ({ ...prev, [section]: mode }));
  };

  const toggleSection = (id) => {
    setSectionsExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeSectionExpandedState(next);
      return next;
    });
  };

  const collapseAllSections = () => {
    const next = Object.fromEntries(ANALYSIS_SECTIONS.map((s) => [s.id, false]));
    setSectionsExpanded(next);
    writeSectionExpandedState(next);
  };

  const expandAllSections = () => {
    const next = Object.fromEntries(ANALYSIS_SECTIONS.map((s) => [s.id, true]));
    setSectionsExpanded(next);
    writeSectionExpandedState(next);
  };

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
  const missing = data?.missingLocationSearches;
  const missingSearches = missing?.searches ?? (Array.isArray(missing) ? missing : []);
  const countyViews = data?.countyAlertViews;
  const hasMissingSearches = missingSearches.length > 0;

  return (
    <div className="min-h-screen bg-slate-900">
      <header
        id="admin-analysis-header"
        className="bg-slate-800 border-b border-slate-700 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
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

      {data && (
        <AdminAnalysisNav
          onCollapseAll={collapseAllSections}
          onExpandAll={expandAllSections}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-10 space-y-8">
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
            <CollapsibleAnalysisSection
              id="overview"
              title="Overview"
              description="Morning brief, operations center, and top insights for the selected period."
              expanded={sectionsExpanded.overview}
              onToggle={() => toggleSection('overview')}
              className="bg-slate-800/80 border border-slate-700"
            >
              <OperationsCenter
                dashboardDateRange={dateRange}
                variant="mobile-accordion"
              />
              <div className="mt-6 lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-6 items-start">
                <div className="space-y-6 min-w-0">
                  <MorningBriefCard dateRange={dateRange} />
                  <TopInsightsCard insights={data.topInsights} />
                </div>
                <div className="hidden lg:block">
                  <div className="sticky top-14">
                    <OperationsCenter
                      dashboardDateRange={dateRange}
                      variant="sidebar"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="returning-visitors"
              title="Returning Visitors"
              description="Session data from visitor_sessions. Date filter applies to session created_at."
              expanded={sectionsExpanded['returning-visitors']}
              onToggle={() => toggleSection('returning-visitors')}
              headerExtra={
                <AdminChartToggle
                  value={viewModes.returningVisitors}
                  onChange={(mode) => setViewMode('returningVisitors', mode)}
                />
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                <StatCard label="Total sessions" value={formatNumber(rv?.totalSessions)} />
                <StatCard label="Unique visitors" value={formatNumber(rv?.uniqueVisitors)} />
                <StatCard label="New visitors" value={formatNumber(rv?.newVisitors)} />
                <StatCard label="Returning" value={formatNumber(rv?.returningVisitors)} />
                <StatCard label="Returning %" value={formatPct(rv?.returningPct)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <StatCard
                  label="Avg returning %"
                  value={formatPct(rv?.avgReturningPct)}
                  hint="Daily average in range"
                />
                <StatCard
                  label="Highest returning day"
                  value={
                    rv?.highestReturningDay
                      ? formatPct(rv.highestReturningDay.returningPct)
                      : '—'
                  }
                  hint={
                    rv?.highestReturningDay?.day
                      ? rv.highestReturningDay.day
                      : undefined
                  }
                />
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 flex flex-col justify-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Trend</div>
                  <TrendIndicator trend={rv?.returningTrend} />
                </div>
              </div>
              {viewModes.returningVisitors === 'visual' ? (
                <>
                  <SubsectionTitle>New vs returning visitors by day</SubsectionTitle>
                  <AdminDualLineChart
                    data={rv?.dailyBreakdown}
                    emptyMessage="No visitor sessions in this period."
                  />
                </>
              ) : (
                <DataTable
                  columns={[
                    { key: 'day', label: 'Day' },
                    {
                      key: 'newVisitors',
                      label: 'New',
                      render: (r) => formatNumber(r.newVisitors),
                    },
                    {
                      key: 'returningVisitors',
                      label: 'Returning',
                      render: (r) => formatNumber(r.returningVisitors),
                    },
                  ]}
                  rows={rv?.dailyBreakdown || []}
                  emptyMessage="No visitor sessions in this period."
                />
              )}
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="location-searches"
              title="Location Searches"
              description="Missing searches, search performance, and location source breakdown."
              expanded={sectionsExpanded['location-searches']}
              onToggle={() => toggleSection('location-searches')}
            >
              <div
                className={`rounded-xl p-5 sm:p-6 border mb-6 ${
                  hasMissingSearches
                    ? 'bg-amber-950/20 border-amber-600/50'
                    : 'bg-slate-900/60 border-slate-700'
                }`}
              >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    Missing Location Searches
                    {hasMissingSearches && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded">
                        Action needed
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Failed searches from missing_location_searches (all time) or location_search_events (date filter).
                  </p>
                </div>
                {hasMissingSearches && (
                  <div className="text-sm font-semibold text-amber-300 tabular-nums">
                    {formatNumber(missing?.totalFailed)} failed searches
                  </div>
                )}
              </div>

              {(missing?.recommendedCities?.length ?? 0) > 0 && (
                <div className="mb-5">
                  <SubsectionTitle>Recommended Cities To Add</SubsectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {missing.recommendedCities.map((city) => (
                      <span
                        key={`${city.query}-${city.state}`}
                        className="inline-flex items-center gap-1.5 text-sm bg-amber-900/30 border border-amber-700/40 text-amber-100 px-3 py-1.5 rounded-lg"
                      >
                        {city.label}
                        <span className="text-amber-400/80 text-xs">
                          ({formatNumber(city.searchCount)} searches)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ExpandableBlock
                title={`Top missing searches (${missingSearches.length})`}
                defaultOpen={hasMissingSearches}
              >
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
                  rows={missingSearches}
                  emptyMessage="No failed location searches in this period."
                />
              </ExpandableBlock>
              </div>

              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 sm:p-6 mb-6">
              <SectionHeader
                title="Location Search Performance"
                description="Success rate and top searched locations."
                viewMode={viewModes.locationSearch}
                onViewModeChange={(mode) => setViewMode('locationSearch', mode)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total searches" value={formatNumber(ls?.totalSearches)} />
                <StatCard label="Successful" value={formatNumber(ls?.successfulSearches)} />
                <StatCard label="Failed" value={formatNumber(ls?.failedSearches)} />
                <StatCard label="Success rate" value={formatPct(ls?.successRate)} />
              </div>
              <SubsectionTitle>Success rate trend</SubsectionTitle>
              <AdminLineChart
                data={ls?.successRateTrend}
                dataKey="successRate"
                name="Success rate"
                valueSuffix="%"
                formatValue={(v) => [`${v}%`, 'Success rate']}
                emptyMessage="No location searches in this period."
              />

              {(ls?.searchesBySource?.length ?? 0) > 0 && (
                <>
                  <SubsectionTitle>Searches by source</SubsectionTitle>
                  <AdminBarChart
                    data={ls.searchesBySource}
                    dataKey="search_count"
                    nameKey="source"
                    emptyMessage="No source data in this period."
                  />
                </>
              )}

              {viewModes.locationSearch === 'visual' ? (
                <>
                  <SubsectionTitle>Success vs failed searches</SubsectionTitle>
                  <AdminSplitChart
                    segments={[
                      { name: 'Successful', value: ls?.successfulSearches ?? 0 },
                      { name: 'Failed', value: ls?.failedSearches ?? 0 },
                    ]}
                    emptyMessage="No location searches in this period."
                  />
                  <SubsectionTitle>Top searched locations</SubsectionTitle>
                  <AdminBarChart
                    data={(ls?.topLocations || []).map((row) => ({
                      ...row,
                      label: row.state_code
                        ? `${row.query} (${row.state_code})`
                        : row.query,
                    }))}
                    dataKey="search_count"
                    nameKey="label"
                    emptyMessage="No successful location searches in this period."
                  />
                  {(ls?.topMissing?.length ?? 0) > 0 && (
                    <>
                      <SubsectionTitle>Most requested missing</SubsectionTitle>
                      <AdminBarChart
                        data={(ls?.topMissing || []).map((row) => ({
                          ...row,
                          label: row.state_code
                            ? `${row.query} (${row.state_code})`
                            : row.query,
                        }))}
                        dataKey="search_count"
                        nameKey="label"
                        emptyMessage="No failed location searches in this period."
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <SubsectionTitle>Top searched locations</SubsectionTitle>
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
                  <SubsectionTitle>Most requested missing</SubsectionTitle>
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
                </>
              )}
              </div>

              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5 sm:p-6">
              <h3 className="text-lg font-bold text-white mb-1">Location Sources</h3>
              <p className="text-sm text-slate-400 mb-5">
                How users change location — successful events from location_search_events by resolved type.
              </p>
              <LocationSourcesCard sources={locationSources} />
              </div>
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="county-alert-views"
              title="County Alert Views"
              description="Counties ranked by alert page views from county_alert_views (paired with county_alert_view product events)."
              expanded={sectionsExpanded['county-alert-views']}
              onToggle={() => toggleSection('county-alert-views')}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <StatCard label="Total county views" value={formatNumber(countyViews?.totalViews)} />
              </div>
              <div className="space-y-6">
                <div>
                  <SubsectionTitle>Top viewed counties</SubsectionTitle>
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
                        key: 'last_viewed',
                        label: 'Last viewed',
                        render: (r) => formatDate(r.last_viewed),
                      },
                    ]}
                    rows={countyViews?.topViewed || []}
                    emptyMessage="No county alert views in this period."
                  />
                </div>
                <div>
                  <SubsectionTitle>Counties with highest alert counts</SubsectionTitle>
                  <DataTable
                    columns={[
                      { key: 'county_name', label: 'County' },
                      { key: 'state_code', label: 'State' },
                      {
                        key: 'alert_count',
                        label: 'Max alerts',
                        render: (r) => formatNumber(r.alert_count),
                      },
                      {
                        key: 'view_count',
                        label: 'Views',
                        render: (r) => formatNumber(r.view_count),
                      },
                    ]}
                    rows={countyViews?.highestAlertCounts || []}
                    emptyMessage="No county alert data in this period."
                  />
                </div>
                <div>
                  <SubsectionTitle>Counties generating radar views</SubsectionTitle>
                  <DataTable
                    columns={[
                      { key: 'county_name', label: 'County' },
                      { key: 'state_code', label: 'State' },
                      {
                        key: 'radar_view_count',
                        label: 'Radar views',
                        render: (r) => formatNumber(r.radar_view_count),
                      },
                    ]}
                    rows={countyViews?.generatingRadar || []}
                    emptyMessage="No county → radar journeys in this period."
                  />
                </div>
              </div>
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="saved-locations"
              title="Saved Locations"
              description="Signed-in user saves from user_locations. Anonymous localStorage saves are not in Supabase."
              expanded={sectionsExpanded['saved-locations']}
              onToggle={() => toggleSection('saved-locations')}
              headerExtra={
                <AdminChartToggle
                  value={viewModes.savedLocations}
                  onChange={(mode) => setViewMode('savedLocations', mode)}
                />
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <StatCard label="Total saves" value={formatNumber(sl?.totalSaved)} />
                <StatCard label="Signed-in users" value={formatNumber(sl?.signedInUsers)} />
                <StatCard
                  label="Anonymous saves"
                  value="N/A"
                  hint="Not tracked in DB"
                />
              </div>
              {viewModes.savedLocations === 'visual' && (
                <>
                  <SubsectionTitle>Saved locations by state</SubsectionTitle>
                  <AdminBarChart
                    data={sl?.savesByState || []}
                    dataKey="save_count"
                    nameKey="state"
                    emptyMessage="No saved locations in this period."
                  />
                </>
              )}
              <SubsectionTitle>Most saved locations</SubsectionTitle>
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
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="radar-engagement"
              title="Radar Engagement"
              description="Radar opens, types, and location views from radar_events."
              expanded={sectionsExpanded['radar-engagement']}
              onToggle={() => toggleSection('radar-engagement')}
              headerExtra={
                <AdminChartToggle
                  value={viewModes.radarEngagement}
                  onChange={(mode) => setViewMode('radarEngagement', mode)}
                />
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total radar opens" value={formatNumber(radar?.totalOpens)} />
                <StatCard
                  label="Avg opens / session"
                  value={formatNumber(radar?.insights?.avgOpensPerSession)}
                />
                <StatCard
                  label="Top state"
                  value={
                    radar?.insights?.topState
                      ? formatRadarState({ state_code: radar.insights.topState.stateCode })
                      : '—'
                  }
                  hint={
                    radar?.insights?.topState
                      ? `${formatNumber(radar.insights.topState.openCount)} opens`
                      : undefined
                  }
                />
                <StatCard
                  label="Top radar location"
                  value={
                    radar?.insights?.topLocation
                      ? formatRadarState({ state_code: radar.insights.topLocation.stateCode })
                      : '—'
                  }
                  hint={
                    radar?.insights?.topLocation
                      ? `${formatNumber(radar.insights.topLocation.viewCount)} location changes`
                      : undefined
                  }
                />
              </div>
              {viewModes.radarEngagement === 'visual' ? (
                <>
                  <SubsectionTitle>Radar opens by state</SubsectionTitle>
                  <AdminBarChart
                    data={radar?.opensByState || []}
                    dataKey="open_count"
                    nameKey="state_code"
                    formatLabel={formatRadarState}
                    emptyMessage="No radar opens in this period."
                  />
                  <SubsectionTitle>Most viewed radar locations</SubsectionTitle>
                  <AdminBarChart
                    data={radar?.topLocations || []}
                    dataKey="view_count"
                    nameKey="state_code"
                    formatLabel={formatRadarState}
                    emptyMessage="No radar location changes in this period."
                  />
                  {radar?.insights?.showRadarTypes && (
                    <>
                      <SubsectionTitle>Radar type usage</SubsectionTitle>
                      <AdminSplitChart
                        segments={(radar?.topRadarTypes || []).map((row) => ({
                          name: row.radar_type,
                          value: row.event_count,
                        }))}
                        emptyMessage="No radar type changes in this period."
                        height={200}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <SubsectionTitle>Opens by state</SubsectionTitle>
                  <DataTable
                    columns={[
                      {
                        key: 'state_code',
                        label: 'State',
                        render: (r) => formatRadarState(r),
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
                  {radar?.insights?.showRadarTypes && (
                    <>
                      <SubsectionTitle>Most used radar types</SubsectionTitle>
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
                    </>
                  )}
                  <SubsectionTitle>Most viewed radar locations</SubsectionTitle>
                  <DataTable
                    columns={[
                      {
                        key: 'state_code',
                        label: 'State',
                        render: (r) => formatRadarState(r),
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
                </>
              )}
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              id="user-journeys"
              title="User Journeys"
              description="Sequential funnels and top paths from product_events."
              expanded={sectionsExpanded['user-journeys']}
              onToggle={() => toggleSection('user-journeys')}
              headerExtra={
                <AdminChartToggle
                  value={viewModes.userJourneys}
                  onChange={(mode) => setViewMode('userJourneys', mode)}
                />
              }
            >
              {journeys?.mainJourney && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  <StatCard
                    label="Main journey conversion"
                    value={formatPct(journeys.mainJourney.overallCompletionPct)}
                    hint="Homepage → Save Location"
                  />
                  <StatCard
                    label="Largest drop-off step"
                    value={
                      journeys.mainJourney.biggestDropOff
                        ? formatEventName(journeys.mainJourney.biggestDropOff.eventName)
                        : '—'
                    }
                    hint={
                      journeys.mainJourney.biggestDropOff
                        ? `${formatPct(journeys.mainJourney.biggestDropOff.dropoffPct)} lost`
                        : undefined
                    }
                  />
                </div>
              )}
              <div className="space-y-6 mb-8">
                {Object.entries(journeys?.funnels || {}).map(([id, funnel]) => (
                  <FunnelCard
                    key={id}
                    id={id}
                    funnel={funnel}
                    viewMode={viewModes.userJourneys}
                    isMainJourney={id === 'alerts_to_save'}
                  />
                ))}
              </div>
              <SubsectionTitle>Top paths</SubsectionTitle>
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
            </CollapsibleAnalysisSection>
          </>
        )}
      </main>
      <ScrollToTopButton />
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
