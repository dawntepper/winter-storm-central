import { useEffect, useState } from 'react';

/**
 * Urgent banner shown above the forecast picker when a Tornado Warning
 * is active in the user's currently-viewed state. Live countdown to the
 * NWS-reported expiry, pulsing red border (reuses tornado-warning-pulse
 * keyframe from index.css), and a CTA to weather.gov for shelter guidance.
 *
 * Renders nothing when:
 *   - alert is null/undefined
 *   - alert.expires is missing or unparseable
 *   - the warning has already expired
 *
 * State-level match is intentionally a v1 simplification — we surface the
 * banner whenever a TW is anywhere in the user's state, which is broad but
 * always-relevant for a state-scope forecast page. Future versions could
 * tighten to UGC zone or polygon containment.
 */
export default function TornadoWarningBanner({ alert }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!alert?.expires) return null;

  const expiresMs = new Date(alert.expires).getTime();
  if (!Number.isFinite(expiresMs)) return null;

  const remainingMs = Math.max(0, expiresMs - now);
  if (remainingMs === 0) return null;

  const totalSec = Math.floor(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-xl border-2 border-red-500 bg-red-950/40 p-4 sm:p-5 tornado-warning-pulse"
    >
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl sm:text-3xl flex-shrink-0" aria-hidden="true">🌪</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-red-300 uppercase tracking-wide leading-tight">
            Tornado Warning
          </h2>
          {alert.areaDesc && (
            <p className="text-sm text-slate-200 mt-1 leading-snug">{alert.areaDesc}</p>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
          {min}:{String(sec).padStart(2, '0')}
        </span>
        <span className="text-sm text-slate-400">until NWS-reported expiry</span>
      </div>

      <a
        href="https://www.weather.gov/safety/tornado"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Take shelter now — official guidance →
      </a>
    </section>
  );
}
