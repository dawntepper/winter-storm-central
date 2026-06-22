import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';

const BASE_URL = 'https://stormtracking.io';

function setOrCreate(selector, attr, value) {
  let el = document.querySelector(selector);
  if (!el) {
    const match = selector.match(/^(\w+)\[([^=]+)=["']?([^"'\]]+)/);
    if (!match) return;
    el = document.createElement(match[1]);
    el.setAttribute(match[2], match[3]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setLegalMetaTags({ title, description, path }) {
  const url = `${BASE_URL}${path}`;
  document.title = title;
  setOrCreate('meta[name="description"]', 'content', description);
  setOrCreate('link[rel="canonical"]', 'href', url);
  setOrCreate('meta[property="og:title"]', 'content', title);
  setOrCreate('meta[property="og:description"]', 'content', description);
  setOrCreate('meta[property="og:url"]', 'content', url);
  setOrCreate('meta[name="twitter:title"]', 'content', title);
  setOrCreate('meta[name="twitter:description"]', 'content', description);
}

function resetLegalMetaTags() {
  document.title = 'StormTracking - Real-Time Extreme Weather Alerts';
}

export function LegalSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 text-slate-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function LegalPageLayout({ title, description, path, heading, intro, children }) {
  useEffect(() => {
    setLegalMetaTags({ title, description, path });
    return () => resetLegalMetaTags();
  }, [title, description, path]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 space-y-3">
          <p className="text-[11px] sm:text-xs font-semibold tracking-widest text-sky-400 uppercase">
            StormTracking.io
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{heading}</h1>
          {intro && <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{intro}</p>}
          <p className="text-xs text-slate-500">Last updated: June 2026</p>
        </div>

        <article className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 sm:p-8 space-y-8">
          {children}
        </article>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link to="/privacy" className="text-slate-400 hover:text-sky-400 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/terms" className="text-slate-400 hover:text-sky-400 transition-colors">
            Terms of Service
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/" className="text-slate-400 hover:text-sky-400 transition-colors">
            Back to live weather
          </Link>
        </div>
      </main>
    </div>
  );
}
