import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminGate from '../components/AdminGate';
import { US_STATES } from '../data/stateConfig';
import { trackIndexNowSubmission } from '../utils/analytics';

const BASE_URL = 'https://stormtracking.io';
const LOG_STORAGE_KEY = 'admin_seo_indexnow_log';
const LOG_MAX_ENTRIES = 50;
const CUSTOM_URLS_MAX = 100;

// Discover storm slugs at build time via Vite's import.meta.glob. Keeps the
// admin UI in lockstep with src/content/storms/ without a runtime read.
const stormModules = import.meta.glob('../content/storms/*.json', { eager: true });
const STORM_SLUGS = Object.values(stormModules)
  .map((m) => m.default?.slug || m.slug)
  .filter(Boolean);

const STATE_SLUGS = Object.keys(US_STATES);

// Core pages — the homepage and the heavily-trafficked landing surfaces.
// Keep this list in sync with scripts/generate-sitemap.js if new top-level
// routes are added.
const CORE_URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/alerts`,
  `${BASE_URL}/radar`,
  `${BASE_URL}/prep`,
];

const STATE_URLS = STATE_SLUGS.map((slug) => `${BASE_URL}/alerts/${slug}`);
const STORM_URLS = STORM_SLUGS.map((slug) => `${BASE_URL}/storm/${slug}`);

function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(entries) {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries.slice(0, LOG_MAX_ENTRIES)));
  } catch {
    /* ignore — quota errors, private mode, etc. */
  }
}

async function submit({ urls, source }) {
  const response = await fetch('/api/submit-to-indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, source }),
  });
  const data = await response.json().catch(() => ({
    success: false,
    submitted: 0,
    message: `HTTP ${response.status} (no JSON body)`,
  }));
  return { ok: response.ok, status: response.status, ...data };
}

function AdminSeoInner() {
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(null); // source string while in-flight
  const [lastResult, setLastResult] = useState(null);
  const [customUrlsText, setCustomUrlsText] = useState('');

  useEffect(() => {
    setLog(loadLog());
  }, []);

  const parsedCustomUrls = useMemo(() => {
    const lines = customUrlsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines;
  }, [customUrlsText]);

  const handleSubmit = async (source, urls) => {
    if (busy) return;
    if (!urls.length) {
      setLastResult({ source, success: false, submitted: 0, message: 'No URLs to submit' });
      return;
    }
    setBusy(source);
    setLastResult(null);
    try {
      const result = await submit({ urls, source });
      setLastResult({ source, ...result });
      trackIndexNowSubmission(source, urls.length, result.success);
      const entry = {
        timestamp: new Date().toISOString(),
        source,
        urls_count: urls.length,
        submitted: result.submitted ?? 0,
        status: result.status,
        success: !!result.success,
        message: result.message || '',
      };
      const next = [entry, ...log].slice(0, LOG_MAX_ENTRIES);
      setLog(next);
      saveLog(next);
    } catch (err) {
      const result = { success: false, submitted: 0, message: err.message || 'Network error' };
      setLastResult({ source, ...result });
      trackIndexNowSubmission(source, urls.length, false);
    } finally {
      setBusy(null);
    }
  };

  const submitState = () => handleSubmit('admin_state_pages', STATE_URLS);
  const submitStorms = () => handleSubmit('admin_storm_pages', STORM_URLS);
  const submitCore = () => handleSubmit('admin_core_pages', CORE_URLS);
  const submitCustom = () => {
    if (parsedCustomUrls.length > CUSTOM_URLS_MAX) {
      setLastResult({
        source: 'admin_custom',
        success: false,
        submitted: 0,
        message: `Too many URLs (${parsedCustomUrls.length}). Max ${CUSTOM_URLS_MAX} per custom submit.`,
      });
      return;
    }
    handleSubmit('admin_custom', parsedCustomUrls);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <h1 className="text-lg font-bold text-white">SEO &amp; Indexing</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* IndexNow Submission */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white mb-2">IndexNow Submission</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-5">
            Submit URLs to Bing&apos;s IndexNow API for accelerated indexing.
            Submitted URLs typically get crawled within hours instead of the
            usual 1–4 weeks of organic discovery.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mb-2">
            <BulkButton
              label={`Submit All State Pages (${STATE_URLS.length})`}
              hint="50 state alert pages + territories"
              onClick={submitState}
              busy={busy === 'admin_state_pages'}
              disabled={!!busy}
            />
            <BulkButton
              label={`Submit Storm Event Pages (${STORM_URLS.length})`}
              hint={STORM_URLS.length ? 'Active + archived storms' : 'No storm pages yet'}
              onClick={submitStorms}
              busy={busy === 'admin_storm_pages'}
              disabled={!!busy || STORM_URLS.length === 0}
            />
            <BulkButton
              label={`Submit Core Pages (${CORE_URLS.length})`}
              hint="Homepage + /alerts + /radar + /prep"
              onClick={submitCore}
              busy={busy === 'admin_core_pages'}
              disabled={!!busy}
            />
          </div>
        </section>

        {/* Custom URL Submission */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white mb-2">Manual URL Submission</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            Paste up to {CUSTOM_URLS_MAX} URLs (one per line). Must be on{' '}
            <code className="text-slate-300">stormtracking.io</code>.
          </p>

          <textarea
            value={customUrlsText}
            onChange={(e) => setCustomUrlsText(e.target.value)}
            rows={8}
            placeholder={`https://stormtracking.io/alerts/oklahoma\nhttps://stormtracking.io/storm/some-slug`}
            className="w-full font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
          />

          <div className="flex items-center justify-between mt-3 gap-3">
            <span className="text-xs text-slate-500">
              {parsedCustomUrls.length} URL{parsedCustomUrls.length === 1 ? '' : 's'} parsed
            </span>
            <button
              type="button"
              onClick={submitCustom}
              disabled={!!busy || parsedCustomUrls.length === 0}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {busy === 'admin_custom' ? 'Submitting…' : 'Submit URLs'}
            </button>
          </div>
        </section>

        {/* Last result */}
        {lastResult && (
          <ResultBanner result={lastResult} />
        )}

        {/* Recent Submissions */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-white">Recent Submissions</h2>
            {log.length > 0 && (
              <button
                type="button"
                onClick={() => { setLog([]); saveLog([]); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                Clear log
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Last {LOG_MAX_ENTRIES} submissions from this browser. Stored in localStorage —
            won&apos;t survive browser data clear. Full history is in Plausible
            (filter <code>IndexNow Submission</code>).
          </p>

          {log.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {log.map((entry, i) => (
                <LogEntry key={`${entry.timestamp}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function BulkButton({ label, hint, onClick, busy, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left p-4 bg-slate-900 border border-slate-700 hover:border-sky-500/50 hover:bg-slate-900/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
    >
      <div className="text-sm font-semibold text-white mb-1">
        {busy ? 'Submitting…' : label}
      </div>
      <div className="text-xs text-slate-500">{hint}</div>
    </button>
  );
}

function ResultBanner({ result }) {
  const tone = result.success
    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
    : 'bg-red-500/10 border-red-500/40 text-red-300';
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm ${tone}`}>
      <span className="font-semibold mr-2">
        {result.success ? '✓' : '✗'} {result.source}:
      </span>
      <span>{result.message || (result.success ? 'Submitted' : 'Failed')}</span>
    </div>
  );
}

function LogEntry({ entry }) {
  const time = new Date(entry.timestamp).toLocaleString();
  const successColor = entry.success ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`text-xs font-mono ${successColor}`}>
          {entry.success ? '✓' : '✗'} {entry.status || '-'}
        </span>
        <span className="text-sm text-slate-300 truncate">{entry.source}</span>
        <span className="text-xs text-slate-500 hidden sm:inline">
          {entry.submitted}/{entry.urls_count} URLs
        </span>
      </div>
      <span className="text-xs text-slate-500 flex-shrink-0">{time}</span>
    </div>
  );
}

export default function AdminSeo() {
  return (
    <AdminGate>
      <AdminSeoInner />
    </AdminGate>
  );
}
