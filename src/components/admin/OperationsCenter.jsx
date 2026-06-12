import { useCallback, useEffect, useState } from 'react';
import { fetchOperationsAnalysis } from '../../lib/adminAnalysisRepo';

const CACHE_PREFIX = 'admin-analysis-operations';

export const OPS_PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
];

const SECTION_STYLES = {
  attention_needed: {
    title: 'Attention Needed',
    border: 'border-rose-700/50',
    bg: 'bg-rose-950/25',
    titleColor: 'text-rose-300',
    dot: 'bg-rose-500',
  },
  opportunities: {
    title: 'Opportunities',
    border: 'border-amber-700/50',
    bg: 'bg-amber-950/20',
    titleColor: 'text-amber-300',
    dot: 'bg-amber-500',
  },
  weather_drivers: {
    title: 'Weather Drivers',
    border: 'border-sky-700/50',
    bg: 'bg-sky-950/20',
    titleColor: 'text-sky-300',
    dot: 'bg-sky-500',
  },
  retention_signals: {
    title: 'Retention Signals',
    border: 'border-violet-700/50',
    bg: 'bg-violet-950/20',
    titleColor: 'text-violet-300',
    dot: 'bg-violet-500',
  },
  recommended_actions: {
    title: 'Recommended Actions',
    border: 'border-slate-600/50',
    bg: 'bg-slate-900/50',
    titleColor: 'text-slate-200',
    dot: 'bg-slate-400',
  },
  wins: {
    title: 'Wins',
    border: 'border-emerald-700/50',
    bg: 'bg-emerald-950/20',
    titleColor: 'text-emerald-300',
    dot: 'bg-emerald-500',
  },
};

const PRIORITY_STYLES = {
  high: 'text-rose-300 font-semibold',
  medium: 'text-amber-300',
  low: 'text-slate-400',
};

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

function OpsSection({ sectionKey, items }) {
  const style = SECTION_STYLES[sectionKey];
  if (!style || !items?.length) return null;

  return (
    <div className={`rounded-lg border p-3 ${style.border} ${style.bg}`}>
      <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 ${style.titleColor}`}>
        {style.title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-200 flex gap-2">
            <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${style.dot}`} />
            <span>
              {sectionKey === 'attention_needed' && item.priority && (
                <span className={`text-[10px] uppercase mr-1.5 ${PRIORITY_STYLES[item.priority] || ''}`}>
                  {item.priority}
                </span>
              )}
              {sectionKey === 'recommended_actions' ? (
                <>
                  <span className="font-medium text-white">{item.title}</span>
                  {item.detail && (
                    <span className="text-slate-400"> — {item.detail}</span>
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
        <div className={`space-y-2.5 ${loading ? 'opacity-60' : ''}`}>
          <OpsSection sectionKey="attention_needed" items={analysis.attention_needed} />
          <OpsSection sectionKey="opportunities" items={analysis.opportunities} />
          <OpsSection sectionKey="weather_drivers" items={analysis.weather_drivers} />
          <OpsSection sectionKey="retention_signals" items={analysis.retention_signals} />
          <OpsSection sectionKey="recommended_actions" items={analysis.recommended_actions} />
          <OpsSection sectionKey="wins" items={analysis.wins} />
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
  variant = 'sidebar',
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
