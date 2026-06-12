import { useCallback, useEffect, useState } from 'react';
import { fetchMorningBrief } from '../../lib/adminAnalysisRepo';

const CACHE_PREFIX = 'admin-analysis-morning-brief';

function cacheKey(period) {
  return `${CACHE_PREFIX}:${period}`;
}

function readCache(period) {
  try {
    const raw = localStorage.getItem(cacheKey(period));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed;
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

function mapDashboardRangeToBriefPeriod(dateRange) {
  if (dateRange === 'today') return 'today';
  if (dateRange === '7d') return '7d';
  return '7d';
}

export default function MorningBriefCard({ dateRange }) {
  const period = mapDashboardRangeToBriefPeriod(dateRange);
  const [brief, setBrief] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = readCache(period);
        if (cached) {
          setBrief(cached.data);
          setGeneratedAt(cached.generatedAt);
          return;
        }
      }

      setLoading(true);
      setError('');
      try {
        const result = await fetchMorningBrief(period);
        setBrief(result.brief);
        setGeneratedAt(result.generatedAt || new Date().toISOString());
        writeCache(period, result.brief);
      } catch (err) {
        setError(err.message || 'Failed to generate morning brief');
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="bg-gradient-to-br from-indigo-950/40 to-slate-800 border border-indigo-700/40 rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Morning Brief</h2>
          <p className="text-sm text-slate-400">
            AI summary of key product metrics for the selected period.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg border border-indigo-600 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Generating…' : 'Refresh Brief'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-800/50 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {loading && !brief && (
        <div className="text-sm text-slate-400 py-4">Generating morning brief…</div>
      )}

      {brief && (
        <div className={loading ? 'opacity-60' : ''}>
          {brief.headline && (
            <p className="text-base font-semibold text-white mb-3 leading-snug">
              {brief.headline}
            </p>
          )}
          {brief.bullets?.length > 0 && (
            <ul className="space-y-2">
              {brief.bullets.map((item, i) => (
                <li key={i} className="text-sm text-slate-200 flex gap-2">
                  <span className="text-indigo-400 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {generatedAt && (
            <p className="text-xs text-slate-500 mt-4">
              Generated {formatGeneratedAt(generatedAt)}
              {brief.generated_at_note ? ` · ${brief.generated_at_note}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
