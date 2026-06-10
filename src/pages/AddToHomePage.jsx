import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { trackAddToHomePageView } from '../utils/analytics';

export default function AddToHomePage() {
  useEffect(() => {
    document.title = 'Add StormTracking to Your Home Screen';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        'content',
        'Install stormtracking.io on your phone home screen for quick access to live weather radar and NWS alerts.'
      );
    }
    trackAddToHomePageView();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Header />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="text-center space-y-3">
          <p className="text-[11px] sm:text-xs font-semibold tracking-widest text-sky-400 uppercase">
            StormTracking on mobile
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Add to Home Screen</h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Pin StormTracking to your phone for one-tap access to live radar and NWS alerts — no app store required.
          </p>
        </div>

        <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span aria-hidden="true">🍎</span> iPhone &amp; iPad (Safari)
          </h2>
          <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
            <li>Open <strong className="text-slate-200">stormtracking.io</strong> in Safari.</li>
            <li>Tap the <strong className="text-slate-200">Share</strong> button (square with arrow).</li>
            <li>Scroll down and tap <strong className="text-slate-200">Add to Home Screen</strong>.</li>
            <li>Tap <strong className="text-slate-200">Add</strong> in the top-right corner.</li>
          </ol>
        </section>

        <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span aria-hidden="true">🤖</span> Android (Chrome)
          </h2>
          <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
            <li>Open <strong className="text-slate-200">stormtracking.io</strong> in Chrome.</li>
            <li>Tap the <strong className="text-slate-200">menu</strong> (three dots, top-right).</li>
            <li>Tap <strong className="text-slate-200">Add to Home screen</strong> or <strong className="text-slate-200">Install app</strong>.</li>
            <li>Confirm when prompted.</li>
          </ol>
        </section>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          This adds a shortcut that opens StormTracking in your browser. Your saved locations sync when you sign in with email.
        </p>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors"
          >
            ← Back to live radar
          </Link>
        </div>
      </main>
    </div>
  );
}
