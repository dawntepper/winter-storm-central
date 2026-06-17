import AdminFunnel from './AdminFunnel';
import AdminBarChart from './AdminBarChart';
import AdminSplitChart from './AdminSplitChart';
import SortableDataTable from './SortableDataTable';
import TrendIndicator from './TrendIndicator';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  return `${n}%`;
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function StatCard({ label, value, hint, trend }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {trend && (
        <div className="mt-1">
          <TrendIndicator trend={trend} compact />
        </div>
      )}
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function SubsectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-slate-300 mb-2">{children}</h3>;
}

function formatRadarSource(source) {
  const labels = {
    homepage: 'Homepage',
    storm_page: 'Storm Page',
    state: 'State',
    city: 'City',
    county: 'County',
    other: 'Other',
  };
  return labels[source] || source || '—';
}

export default function StormEventsCard({ data, viewMode = 'visual' }) {
  if (!data) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        No storm event analytics in this period.
      </p>
    );
  }

  const { activeStorm, overview, trafficSources, funnel, radarOpensBySource, topStorms, retention, summary, trends } = data;
  const hasStormData = (topStorms?.length ?? 0) > 0;

  if (!hasStormData) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        No storm page engagement recorded yet. Events appear when an active storm banner or storm page is viewed.
      </p>
    );
  }

  const funnelStepStats = (funnel || []).map((step) => ({
    step: step.step,
    eventName: step.label,
    sessions: step.sessions,
    completionPct: step.completionPct,
    dropoffPct: step.dropoffPct,
  }));

  const trafficChartData = (trafficSources || []).map((row) => ({
    source: row.source,
    count: row.count,
  }));

  const radarPieSegments = (radarOpensBySource || []).map((row) => ({
    name: formatRadarSource(row.source),
    value: row.count,
  }));

  return (
    <div className="space-y-6">
      {summary && activeStorm && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-sky-400 mb-1">
            {activeStorm.name} summary
          </div>
          <p className="text-sm text-sky-100 leading-relaxed">{summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        <StatCard
          label="Storm page views"
          value={formatNumber(overview?.pageViews)}
          trend={trends?.pageViews}
        />
        <StatCard
          label="Unique visitors"
          value={formatNumber(overview?.uniqueVisitors)}
          trend={trends?.uniqueVisitors}
        />
        <StatCard
          label="Returning visitors"
          value={formatNumber(overview?.returningVisitors)}
          hint={overview?.returningRate != null ? `${formatPct(overview.returningRate)} of unique` : undefined}
        />
        <StatCard
          label="Avg time on page"
          value={formatDuration(overview?.avgTimeOnPageSeconds)}
          hint="From storm landing sessions"
        />
        <StatCard
          label="Radar opens"
          value={formatNumber(overview?.radarOpens)}
          trend={trends?.radarOpens}
        />
        <StatCard
          label="Alert clicks"
          value={formatNumber(overview?.alertClicks)}
        />
        <StatCard
          label="Saved locations"
          value={formatNumber(overview?.locationSaves)}
          trend={trends?.locationSaves}
        />
        <StatCard
          label="Sign-ins started"
          value={formatNumber(overview?.signIns)}
        />
      </div>

      <div>
        <SubsectionTitle>Storm engagement funnel</SubsectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          Homepage through save location for {activeStorm?.name || 'the top storm'} in this period.
        </p>
        {viewMode === 'visual' ? (
          <AdminFunnel
            stepStats={funnelStepStats}
            formatEventName={(name) => name}
            emptyMessage="No funnel data in this period."
            compact
          />
        ) : (
          <SortableDataTable
            columns={[
              { key: 'step', label: 'Step' },
              { key: 'eventName', label: 'Stage' },
              {
                key: 'sessions',
                label: 'Count',
                render: (r) => formatNumber(r.sessions),
              },
              {
                key: 'completionPct',
                label: 'Completion',
                render: (r) => formatPct(r.completionPct),
              },
              {
                key: 'dropoffPct',
                label: 'Drop-off',
                render: (r) => formatPct(r.dropoffPct),
              },
            ]}
            rows={funnelStepStats}
            emptyMessage="No funnel data in this period."
            defaultSortKey="step"
            defaultSortDir="asc"
            compact
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SubsectionTitle>Traffic sources</SubsectionTitle>
          {viewMode === 'visual' ? (
            <AdminBarChart
              data={trafficChartData}
              dataKey="count"
              nameKey="source"
              compact
              emptyMessage="No storm traffic source data."
            />
          ) : (
            <SortableDataTable
              columns={[
                { key: 'source', label: 'Source' },
                {
                  key: 'count',
                  label: 'Sessions',
                  render: (r) => formatNumber(r.count),
                },
                {
                  key: 'pct',
                  label: 'Share',
                  render: (r) => formatPct(r.pct),
                },
              ]}
              rows={trafficSources || []}
              emptyMessage="No storm traffic source data."
              defaultSortKey="count"
              defaultSortDir="desc"
              compact
            />
          )}
        </div>

        <div>
          <SubsectionTitle>Radar opens by source</SubsectionTitle>
          {viewMode === 'visual' ? (
            <AdminSplitChart
              segments={radarPieSegments}
              emptyMessage="No radar source data."
            />
          ) : (
            <SortableDataTable
              columns={[
                { key: 'source', label: 'Source', render: (r) => formatRadarSource(r.source) },
                {
                  key: 'count',
                  label: 'Opens',
                  render: (r) => formatNumber(r.count),
                },
              ]}
              rows={radarOpensBySource || []}
              emptyMessage="No radar source data."
              defaultSortKey="count"
              defaultSortDir="desc"
              compact
            />
          )}
        </div>
      </div>

      <div>
        <SubsectionTitle>Storm page retention</SubsectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
          <StatCard
            label="Same-day return"
            value={formatNumber(retention?.sameDay)}
            hint={`${formatPct(retention?.sameDayPct)} of storm visitors`}
          />
          <StatCard
            label="Next-day return"
            value={formatNumber(retention?.nextDay)}
            hint={`${formatPct(retention?.nextDayPct)} of storm visitors`}
          />
          <StatCard
            label="7-day return"
            value={formatNumber(retention?.sevenDay)}
            hint={`${formatPct(retention?.sevenDayPct)} of storm visitors`}
          />
        </div>
        <p className="text-xs text-slate-500">
          Visitors who viewed a storm page and returned in a later session ({formatNumber(retention?.totalStormVisitors)} tracked).
        </p>
      </div>

      <div>
        <SubsectionTitle>Top storms</SubsectionTitle>
        <SortableDataTable
          columns={[
            { key: 'stormName', label: 'Storm' },
            {
              key: 'views',
              label: 'Views',
              render: (r) => formatNumber(r.views),
            },
            {
              key: 'radarOpens',
              label: 'Radar',
              render: (r) => formatNumber(r.radarOpens),
            },
            {
              key: 'saves',
              label: 'Saves',
              render: (r) => formatNumber(r.saves),
            },
            {
              key: 'returningVisitors',
              label: 'Returning',
              render: (r) => formatNumber(r.returningVisitors),
            },
            {
              key: 'lastActivity',
              label: 'Last activity',
              render: (r) =>
                r.lastActivity
                  ? new Date(r.lastActivity).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : '—',
            },
          ]}
          rows={topStorms || []}
          emptyMessage="No storm events in this period."
          defaultSortKey="views"
          defaultSortDir="desc"
          compact
        />
      </div>
    </div>
  );
}
