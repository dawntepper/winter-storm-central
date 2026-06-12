/**
 * Admin Weather Summary (/admin/weather-summary)
 *
 * UI for the generate-weather-summary Netlify Function. Lets the operator:
 *   - Generate a fresh summary (tone × filter × optional state list)
 *   - View the four social formats with one-click copy
 *   - Edit notes + which channels the summary was posted to
 *   - Browse history of prior summaries
 *
 * The function requires an x-admin-token header. The user enters that token
 * once per session — we store it in sessionStorage under admin_function_token.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminGate from '../components/AdminGate';

const API = '/.netlify/functions/generate-weather-summary';
const TOKEN_KEY = 'admin_function_token';

const TONE_OPTIONS = [
  { value: 'standard', label: 'Standard — factual, calm' },
  { value: 'urgent', label: 'Urgent — direct, shorter sentences' },
  { value: 'conversational', label: 'Conversational — friendlier voice' }
];

const FILTER_OPTIONS = [
  { value: 'all-severe', label: 'All severe + extreme alerts (default)' },
  { value: 'tornado-hurricane-blizzard', label: 'Tornado / Hurricane / Blizzard only' },
  { value: 'custom-states', label: 'Custom states…' }
];

const SOCIAL_CHANNELS = ['twitter', 'instagram', 'facebook', 'newsletter'];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || '');
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded cursor-pointer flex items-center gap-1"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function TokenPrompt({ onSet }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="max-w-md mx-auto mt-12 bg-slate-800 rounded-xl border border-slate-700 p-6">
      <h2 className="text-lg font-semibold text-white mb-2">Enter admin function token</h2>
      <p className="text-sm text-slate-400 mb-4 leading-relaxed">
        This screen needs the <code className="px-1 py-0.5 bg-slate-900/60 rounded text-sky-300">ADMIN_FUNCTION_TOKEN</code> value
        from your Netlify env vars. Stored in this browser tab only — re-prompts when you close the tab.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) {
            setError('Token cannot be empty');
            return;
          }
          sessionStorage.setItem(TOKEN_KEY, trimmed);
          onSet(trimmed);
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste the token"
          autoFocus
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 mb-3 font-mono text-sm"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
        >
          Use token
        </button>
      </form>
    </div>
  );
}

async function apiFetch(token, { method = 'GET', query = '', body } = {}) {
  const res = await fetch(`${API}${query}`, {
    method,
    headers: {
      'x-admin-token': token,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json };
}

function StateMultiSelect({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {US_STATES.map(code => {
        const on = selected.includes(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => {
              onChange(on ? selected.filter(c => c !== code) : [...selected, code]);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
              on ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}

function GenerateForm({ token, generating, onGenerate }) {
  const [tone, setTone] = useState('standard');
  const [filterPreset, setFilterPreset] = useState('all-severe');
  const [customStates, setCustomStates] = useState([]);

  const submit = (e) => {
    e.preventDefault();
    const body = { tone_preset: tone, filter_preset: filterPreset };
    if (filterPreset === 'custom-states') {
      if (customStates.length === 0) {
        alert('Pick at least one state for custom-states mode.');
        return;
      }
      body.custom_states = customStates;
    }
    onGenerate(body);
  };

  return (
    <form onSubmit={submit} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <h2 className="text-base font-semibold text-white">Generate new summary</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            {TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Filter</label>
          <select
            value={filterPreset}
            onChange={(e) => setFilterPreset(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            {FILTER_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {filterPreset === 'custom-states' && (
        <div>
          <label className="block text-sm text-slate-300 mb-2">States to include</label>
          <StateMultiSelect selected={customStates} onChange={setCustomStates} />
          {customStates.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">Selected: {customStates.join(', ')}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          Calls Claude Haiku via the function. ~5-15 sec response time.
        </p>
        <button
          type="submit"
          disabled={generating}
          className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-medium rounded-lg cursor-pointer"
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </form>
  );
}

function OutputBlock({ title, text, copyText }) {
  if (!text) return null;
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-slate-700/40 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <CopyButton text={copyText ?? text} />
      </div>
      <pre className="p-4 text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{text}</pre>
    </div>
  );
}

function TwitterThreadBlock({ thread }) {
  if (!Array.isArray(thread) || thread.length === 0) return null;
  const joined = thread.map((t, i) => `${i + 1}/${thread.length}\n${t}`).join('\n\n');
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-slate-700/40 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">X / Twitter thread ({thread.length} posts)</h3>
        <CopyButton text={joined} label="Copy all" />
      </div>
      <div className="p-4 space-y-3">
        {thread.map((t, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{i + 1} / {thread.length}</span>
              <CopyButton text={t} />
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{t}</p>
            <p className="text-[10px] text-slate-600 mt-1">{t.length} chars</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesAndChannels({ summary, token, onUpdated }) {
  const [notes, setNotes] = useState(summary.notes || '');
  const [usedOnSocial, setUsedOnSocial] = useState(summary.used_on_social || []);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setNotes(summary.notes || '');
    setUsedOnSocial(summary.used_on_social || []);
  }, [summary.date]);

  const toggleChannel = (ch) => {
    setUsedOnSocial(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    const { ok, status: code, json } = await apiFetch(token, {
      method: 'PATCH',
      query: `?date=${encodeURIComponent(summary.date)}`,
      body: { notes, used_on_social: usedOnSocial }
    });
    setSaving(false);
    if (ok && json?.summary) {
      setStatus({ type: 'success', text: 'Saved' });
      onUpdated?.(json.summary);
      setTimeout(() => setStatus(null), 2000);
    } else {
      setStatus({ type: 'error', text: json?.error || `HTTP ${code}` });
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
      <div>
        <label className="block text-sm text-slate-300 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
          placeholder="Internal notes about this summary…"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-2">Posted to</label>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_CHANNELS.map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`px-3 py-1.5 text-xs rounded transition-colors cursor-pointer ${
                usedOnSocial.includes(ch)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {usedOnSocial.includes(ch) ? '✓ ' : ''}{ch}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        {status ? (
          <span className={`text-xs ${status.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {status.text}
          </span>
        ) : <span />}
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white text-sm font-medium rounded-lg cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save notes & posted-to'}
        </button>
      </div>
    </div>
  );
}

function SummaryDisplay({ summary, token, onUpdated }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-bold text-white">{summary.headline || '(no headline)'}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Generated {formatDate(summary.generated_at)} · {summary.tone_preset} tone · {summary.filter_preset} filter
              {summary.custom_states?.length > 0 && ` · ${summary.custom_states.join(', ')}`}
            </p>
          </div>
          <CopyButton text={summary.headline || ''} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
          <Stat label="Total alerts" value={summary.alert_count?.total} />
          <Stat label="Severe" value={summary.alert_count?.severe} />
          <Stat label="Extreme" value={summary.alert_count?.extreme} />
          <Stat label="After filter" value={summary.alert_count?.after_filter} />
        </div>
        {summary.primary_threats?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {summary.primary_threats.map(t => (
              <span key={t} className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <OutputBlock title="Newsletter" text={summary.outputs?.newsletter} />
      <TwitterThreadBlock thread={summary.outputs?.twitter_thread} />
      <OutputBlock title="Instagram caption" text={summary.outputs?.instagram_caption} />
      <OutputBlock title="Facebook post" text={summary.outputs?.facebook_post} />

      <NotesAndChannels summary={summary} token={token} onUpdated={onUpdated} />

      <div>
        <button
          type="button"
          onClick={() => setShowRaw(s => !s)}
          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          {showRaw ? '▼' : '▶'} Raw alerts that fed this summary ({summary.raw_alerts?.length || 0})
        </button>
        {showRaw && (
          <pre className="mt-2 p-4 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-400 overflow-x-auto max-h-96">
            {JSON.stringify(summary.raw_alerts || [], null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-700/40 rounded-lg py-2">
      <div className="text-xl font-bold text-white">{value ?? '—'}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function HistoryList({ index, selectedDate, onSelect }) {
  if (!index || index.summaries.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 text-center text-sm text-slate-400">
        No prior summaries yet. Generate one above to get started.
      </div>
    );
  }
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-slate-700/40 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">History ({index.summaries.length})</h3>
      </div>
      <ul className="divide-y divide-slate-700">
        {index.summaries.map(s => (
          <li key={s.date}>
            <button
              onClick={() => onSelect(s.date)}
              className={`w-full px-4 py-3 text-left hover:bg-slate-700/40 transition-colors cursor-pointer ${
                selectedDate === s.date ? 'bg-slate-700/60' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">{s.headline || '(no headline)'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {s.date} · {s.alert_count_total || 0} alerts ({s.alert_count_after_filter || 0} after filter)
                  </div>
                </div>
                {s.primary_threats?.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                    {s.primary_threats.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm flex items-start justify-between gap-3">
      <div>
        <strong className="text-red-200">Error:</strong> {error}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-300 hover:text-white cursor-pointer flex-shrink-0">
          Dismiss
        </button>
      )}
    </div>
  );
}

function StorageNotice({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-amber-900/20 border border-amber-500/40 rounded-lg p-3 text-amber-200 text-sm flex items-start justify-between gap-3">
      <div>
        <strong className="text-amber-100">History storage unavailable.</strong>{' '}
        {message} You can still generate summaries below; they just won&apos;t be saved to history until Blobs is configured.
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-amber-300 hover:text-white cursor-pointer flex-shrink-0">
          Dismiss
        </button>
      )}
    </div>
  );
}

function AdminWeatherSummaryInner() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [index, setIndex] = useState(null);
  const [currentSummary, setCurrentSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);
  const [storageNotice, setStorageNotice] = useState(null);
  const [emptyResult, setEmptyResult] = useState(null);

  const clearTokenAndReprompt = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setError('Token rejected — please re-enter.');
  };

  const fetchIndex = async () => {
    if (!token) return;
    setLoadingIndex(true);
    setError(null);
    const { ok, status, json } = await apiFetch(token);
    setLoadingIndex(false);
    if (!ok) {
      if (status === 401) clearTokenAndReprompt();
      else setError(json?.error || `HTTP ${status}`);
      return;
    }
    setIndex(json.index);
    if (json.storage_unavailable) {
      setStorageNotice(json.storage_error || 'Netlify Blobs is not configured or returned an auth error.');
    }
  };

  const fetchSummary = async (date) => {
    setLoadingSummary(true);
    setError(null);
    setEmptyResult(null);
    const { ok, status, json } = await apiFetch(token, {
      query: `?date=${encodeURIComponent(date)}`
    });
    setLoadingSummary(false);
    if (!ok) {
      if (status === 401) clearTokenAndReprompt();
      else setError(json?.error || `HTTP ${status}`);
      return;
    }
    if (json.storage_unavailable || !json.summary) {
      setStorageNotice(json.storage_error || 'Could not load that summary from history storage.');
      return;
    }
    setCurrentSummary(json.summary);
    setSelectedDate(date);
  };

  const handleGenerate = async (body) => {
    setGenerating(true);
    setError(null);
    setEmptyResult(null);
    const { ok, status, json } = await apiFetch(token, { method: 'POST', body });
    setGenerating(false);
    if (!ok) {
      if (status === 401) clearTokenAndReprompt();
      else setError(json?.error || `HTTP ${status}`);
      return;
    }
    if (json.empty) {
      setEmptyResult(json);
      return;
    }
    setCurrentSummary(json.summary);
    setSelectedDate(json.summary.date);
    if (json.storage_error) {
      setStorageNotice(json.storage_error);
    }
    // Refresh history so the new entry appears (no-op if storage is down)
    fetchIndex();
  };

  // Initial load + when token changes
  useEffect(() => {
    if (token) fetchIndex();
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-slate-400 hover:text-white">← Admin</Link>
              <h1 className="text-lg font-bold text-white">Weather Summary</h1>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          {error && <div className="mb-4"><ErrorBanner error={error} onDismiss={() => setError(null)} /></div>}
          <TokenPrompt onSet={setToken} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-slate-400 hover:text-white">← Admin</Link>
            <h1 className="text-lg font-bold text-white">Weather Summary</h1>
          </div>
          <button
            onClick={clearTokenAndReprompt}
            className="text-xs text-slate-500 hover:text-white cursor-pointer"
          >
            Forget token
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <StorageNotice message={storageNotice} onDismiss={() => setStorageNotice(null)} />

        <GenerateForm token={token} generating={generating} onGenerate={handleGenerate} />

        {emptyResult && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-300">
            <strong className="text-white">No summary generated.</strong> {emptyResult.message}
            {emptyResult.alert_count && (
              <div className="mt-2 text-xs text-slate-500">
                Total active: {emptyResult.alert_count.total} ·
                Severe: {emptyResult.alert_count.severe} ·
                Extreme: {emptyResult.alert_count.extreme}
              </div>
            )}
          </div>
        )}

        {loadingSummary && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-400 text-center">
            Loading summary…
          </div>
        )}

        {currentSummary && !loadingSummary && (
          <SummaryDisplay
            summary={currentSummary}
            token={token}
            onUpdated={(updated) => {
              setCurrentSummary(updated);
              fetchIndex();
            }}
          />
        )}

        {loadingIndex ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-400 text-center">
            Loading history…
          </div>
        ) : (
          <HistoryList
            index={index}
            selectedDate={selectedDate}
            onSelect={fetchSummary}
          />
        )}
      </main>
    </div>
  );
}

export default function AdminWeatherSummary() {
  return (
    <AdminGate>
      <AdminWeatherSummaryInner />
    </AdminGate>
  );
}
