import { useCallback, useEffect, useState } from 'react';
import { fetchOperationsAnalysis } from '../../lib/adminAnalysisRepo';

const CACHE_PREFIX = 'admin-analysis-operations';

export const OPS_PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const PRIORITY_BADGE = {
  high: 'bg-rose-950/60 border-rose-600/50 text-rose-300',
  medium: 'bg-amber-950/60 border-amber-600/50 text-amber-300',
  low: 'bg-slate-800 border-slate-600 text-slate-400',
};

function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span
      className={`inline-block text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded border mr-1.5 ${
        PRIORITY_BADGE[priority] || PRIORITY_BADGE.low
      }`}
    >
      {priority}
    </span>
  );
}

function sortByPriority(items) {
  return [...(items || [])].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );
}

function OpsGroup({ title, border, bg, titleColor, items, showPriority = false }) {
  if (!items?.length) return null;

  return (
    <div className={`rounded-lg border p-3 ${border} ${bg}`}>
      <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 ${titleColor}`}>
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-200 flex gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 bg-current opacity-60" />
            <span>
              {showPriority && <PriorityBadge priority={item.priority} />}
              {item.title ? (
                <>
                  <span className="font-medium text-white">{item.title}</span>
                  {item.detail && <span className="text-slate-400"> — {item.detail}</span>}
                  {!item.detail && item.text && (
                    <span className="text-slate-400"> — {item.text}</span>
                  )}
                </>
              ) : (
                item.text
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildGroupedSections(analysis) {
  if (!analysis) return [];

  const issues = sortByPriority([
    ...(analysis.risks || []),
    ...(analysis.attention_needed || []),
  ]).slice(0, 5);

  const opportunities = [
    ...(analysis.opportunities || []),
    ...(analysis.wins || []).map((w) => ({ text: w.text, priority: 'low' })),
  ].slice(0, 5);

  const growthSignals = [
    ...(analysis.what_changed || []),
    ...(analysis.retention_signals || []),
  ].slice(0, 5);

  const weatherActivity = (analysis.weather_drivers || []).slice(0, 4);

  const recommended = (analysis.recommended_actions || []).slice(0, 3);

  return [
    {
      key: 'recommended',
      title: 'Top Actions',
      border: 'border-slate-600/50',
      bg: 'bg-slate-900/50',
      titleColor: 'text-slate-200',
      items: recommended.map((a) => ({
        title: a.title,
        detail: a.detail,
        priority: 'high',
      })),
      showPriority: true,
    },
    {
      key: 'issues',
      title: 'Issues',
      border: 'border-rose-700/50',
      bg: 'bg-rose-950/20',
      titleColor: 'text-rose-300',
      items: issues,
      showPriority: true,
    },
    {
      key: 'opportunities',
      title: 'Opportunities',
      border: 'border-amber-700/50',
      bg: 'bg-amber-950/20',
      titleColor: 'text-amber-300',
      items: opportunities,
    },
    {
      key: 'growth',
      title: 'Growth Signals',
      border: 'border-violet-700/50',
      bg: 'bg-violet-950/20',
      titleColor: 'text-violet-300',
      items: growthSignals,
    },
    {
      key: 'weather',
      title: 'Weather Activity',
      border: 'border-sky-700/50',
      bg: 'bg-sky-950/20',
      titleColor: 'text-sky-300',
      items: weatherActivity,
    },
  ].filter((g) => g.items.length > 0);
}

function cacheKey(period) {
  return `${CACHE_PREFIX}:${period}`;
}

function readCache(period) {
  try {
    const raw = localStorage.getItem(cacheKey(period));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(period, data) {
  try {
    localStorage.setItem(
      cacheKey(period),
      JSON.stringify({ generatedAt: new Date().toISOString(), data })
    );
  } catch {
    /* ignore */
  }
}

function formatGeneratedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function OperationsContent({
  period,
  onPeriodChange,
  analysis,
  generatedAt,
  loading,
  error,
  onRefresh,
  compact = false,
}) {
  const groups = buildGroupedSections(analysis);

  return (
    <div className={compact ? '' : 'space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {OPS_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              disabled={loading}
              className={`px-2 py-1 text-xs rounded border cursor-pointer disabled:opacity-50 ${
                period === p.id
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-sky-500/50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded border border-slate-600 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Analyzing…' : 'Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded px-2 py-1.5 mb-2">
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="text-sm text-slate-400 py-3">Generating operations analysis…</div>
      )}

      {analysis && (
        <div className={`space-y-2 ${loading ? 'opacity-60' : ''}`}>
          {groups.map((group) => (
            <OpsGroup
              key={group.key}
              title={group.title}
              border={group.border}
              bg={group.bg}
              titleColor={group.titleColor}
              items={group.items}
              showPriority={group.showPriority}
            />
          ))}
          {generatedAt && (
            <p className="text-[10px] text-slate-500 pt-1">
              Generated {formatGeneratedAt(generatedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function mapDashboardRangeToOpsPeriod(dateRange) {
  if (dateRange === 'today') return 'today';
  if (dateRange === '7d') return '7d';
  return '7d';
}

export default function OperationsCenter({
  dashboardDateRange,
  variant = 'inline',
}) {
  const [period, setPeriod] = useState(() => mapDashboardRangeToOpsPeriod(dashboardDateRange));
  const [analysis, setAnalysis] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(true);

  useEffect(() => {
    if (dashboardDateRange === 'today' || dashboardDateRange === '7d') {
      setPeriod(dashboardDateRange === 'today' ? 'today' : '7d');
    }
  }, [dashboardDateRange]);

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = readCache(period);
        if (cached?.data) {
          setAnalysis(cached.data);
          setGeneratedAt(cached.generatedAt);
          return;
        }
      }

      setLoading(true);
      setError('');
      try {
        const result = await fetchOperationsAnalysis(period);
        setAnalysis(result.analysis);
        setGeneratedAt(result.generatedAt || new Date().toISOString());
        writeCache(period, result.analysis);
      } catch (err) {
        setError(err.message || 'Failed to generate analysis');
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  if (variant === 'mobile-accordion') {
    return (
      <div className="lg:hidden bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-900/50 hover:bg-slate-900/80 transition-colors cursor-pointer"
        >
          <span className="text-base font-bold text-white">Operations Center</span>
          <span className="text-xs text-slate-400">{mobileOpen ? 'Collapse' : 'Expand'}</span>
        </button>
        {mobileOpen && (
          <div className="px-4 pb-4 pt-2">
            <OperationsContent
              period={period}
              onPeriodChange={setPeriod}
              analysis={analysis}
              generatedAt={generatedAt}
              loading={loading}
              error={error}
              onRefresh={() => load(true)}
              compact
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-base font-bold text-white mb-3">Operations Center</h2>
      <OperationsContent
        period={period}
        onPeriodChange={setPeriod}
        analysis={analysis}
        generatedAt={generatedAt}
        loading={loading}
        error={error}
        onRefresh={() => load(true)}
      />
    </div>
  );
}
