/**
 * Hazard Weather Brief admin panel — extends Weather Summary admin.
 * Controls editorial briefs from the Hazard Engine cache (not social copy).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLaunchHazardSlugs, getHazardConfig } from '../../shared/hazard-engine/hazards.js';

const API = '/.netlify/functions/hazard-weather-brief';

async function apiFetch(token, { method = 'GET', query = '', body } = {}) {
  const res = await fetch(`${API}${query}`, {
    method,
    headers: {
      'x-admin-token': token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json };
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function HazardBriefAdmin({ token }) {
  const slugs = getLaunchHazardSlugs();
  const [hazard, setHazard] = useState(slugs[0] || 'tornado-warning');
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [manualText, setManualText] = useState('');
  const [overrideOn, setOverrideOn] = useState(false);

  const config = getHazardConfig(hazard);

  const load = useCallback(async () => {
    if (!token || !hazard) return;
    setLoading(true);
    setError('');
    try {
      const [snapRes, histRes] = await Promise.all([
        apiFetch(token, { query: `?hazard=${encodeURIComponent(hazard)}&skipGenerate=1` }),
        apiFetch(token, { query: `?hazard=${encodeURIComponent(hazard)}&history=1` }),
      ]);
      if (!snapRes.ok) {
        setError(snapRes.json?.error || `Load failed (${snapRes.status})`);
        setSnapshot(null);
      } else {
        setSnapshot(snapRes.json);
        const brief = snapRes.json.cachedBrief;
        setOverrideOn(Boolean(brief?.manual_override));
        setManualText(brief?.manual_summary || '');
      }
      if (histRes.ok) {
        setHistory(histRes.json.history || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, hazard]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await apiFetch(token, {
        method: 'POST',
        body: { action: 'generate', hazard },
      });
      if (!res.ok) {
        setError(res.json?.error || res.json?.regeneration?.error || 'Generate failed');
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveOverride = async () => {
    setError('');
    const res = await apiFetch(token, {
      method: 'POST',
      body: {
        action: 'set_override',
        hazard,
        manual_summary: manualText,
      },
    });
    if (!res.ok) {
      setError(res.json?.error || 'Override save failed');
      return;
    }
    setOverrideOn(true);
    await load();
  };

  const clearOverride = async () => {
    const res = await apiFetch(token, {
      method: 'POST',
      body: { action: 'clear_override', hazard },
    });
    if (!res.ok) {
      setError(res.json?.error || 'Clear override failed');
      return;
    }
    setOverrideOn(false);
    await load();
  };

  const brief = snapshot?.cachedBrief;
  const weatherBrief = snapshot?.weatherBrief;
  const fallback = snapshot?.fallbackPreview;

  return (
    <section className="mt-10 border-t border-slate-700 pt-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Hazard Weather Briefs</h2>
        <p className="text-sm text-slate-400 mt-1">
          Editorial briefs powered by the Hazard Engine. Manual override always wins over Claude.
          {' '}
          <Link to={`/severe-weather/${hazard}`} className="text-sky-400 hover:underline">
            Open public page →
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {slugs.map((slug) => {
          const cfg = getHazardConfig(slug);
          const active = slug === hazard;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setHazard(slug)}
              className={`px-2.5 py-1 text-xs rounded-lg border cursor-pointer ${
                active
                  ? 'bg-sky-600 text-white border-sky-500'
                  : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
              }`}
            >
              {cfg?.shortLabel || slug}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && !snapshot ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Current brief — {config?.pageTitle}
            </h3>
            <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>Status: <span className="text-slate-200">{brief?.status || 'none'}</span></div>
              <div>Source: <span className="text-slate-200">{weatherBrief?.source || '—'}</span></div>
              <div>Generated: <span className="text-slate-200">{formatDate(brief?.generated_at)}</span></div>
              <div>Active count: <span className="text-slate-200">{brief?.active_count ?? snapshot?.activeCount ?? '—'}</span></div>
              <div>Model: <span className="text-slate-200">{brief?.model || '—'}</span></div>
              <div>Prompt: <span className="text-slate-200">{brief?.prompt_version || '—'}</span></div>
              <div className="col-span-2">
                States:{' '}
                <span className="text-slate-200">
                  {(brief?.affected_state_codes || snapshot?.affectedStates?.map((s) => s.code) || []).join(', ') || '—'}
                </span>
              </div>
              <div className="col-span-2">
                Source alerts: <span className="text-slate-200">{(brief?.source_alert_ids || []).length}</span>
              </div>
            </dl>

            <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Displayed summary</p>
              <p className="text-sm text-slate-200 leading-relaxed">
                {weatherBrief?.summary || 'No summary yet — fallback will show on the page.'}
              </p>
            </div>

            {fallback?.summary && (
              <div className="rounded-lg bg-slate-900/40 border border-slate-700/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Deterministic fallback preview</p>
                <p className="text-xs text-slate-400 leading-relaxed">{fallback.summary}</p>
              </div>
            )}

            {snapshot?.regeneration?.error && (
              <p className="text-xs text-amber-400">
                Last generation issue: {snapshot.regeneration.error}
              </p>
            )}

            <button
              type="button"
              onClick={generate}
              disabled={generating || overrideOn}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium rounded-lg cursor-pointer"
              title={overrideOn ? 'Disable manual override to regenerate with Claude' : 'Force regenerate'}
            >
              {generating ? 'Generating…' : 'Generate Now'}
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Manual override</h3>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideOn}
                onChange={(e) => {
                  if (!e.target.checked) clearOverride();
                  else setOverrideOn(true);
                }}
              />
              Use manual summary (blocks Claude replacement)
            </label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={6}
              placeholder="Write an editorial Weather Brief…"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveOverride}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                Save manual summary
              </button>
              {overrideOn && (
                <button
                  type="button"
                  onClick={clearOverride}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg cursor-pointer"
                >
                  Clear override
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Weather Brief history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No archived briefs yet.</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {history.map((row) => (
              <li key={row.id} className="border-b border-slate-700/60 pb-3 last:border-0">
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-1">
                  <span>{formatDate(row.generated_at)}</span>
                  <span>count {row.active_count}</span>
                  <span>{(row.affected_state_codes || []).join(', ') || 'no states'}</span>
                  <span>{row.model || '—'}</span>
                  <span>{row.prompt_version || '—'}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{row.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
